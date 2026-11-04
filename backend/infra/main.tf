# Sova production serving — GPU ASG behind an ALB, one vLLM box.
# Applies entirely from your machine; AWS sees only API calls.
# State: local by default. Enable the s3 backend before team/shared use.

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  # backend "s3" {
  #   bucket = "sova-tfstate-<suffix>"
  #   key    = "serving/prod.tfstate"
  #   region = "us-east-2"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.tags
  }
}

data "aws_ssm_parameter" "dl_base_ami" {
  name = "/aws/service/deeplearning/ami/x86_64/base-oss-nvidia-driver-gpu-ubuntu-22.04/latest/ami-id"
}

locals {
  tags = {
    Project   = var.project
    Env       = var.environment
    ManagedBy = "terraform"
    Teardown  = "approved-kill-switch"
  }
}

# ---------------------------------------------------------------------------
# Networking: one VPC, two public subnets (ALB requires two AZs)
# ---------------------------------------------------------------------------

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project}-serving-vpc" }
}

resource "aws_internet_gateway" "this" {
  tags = { Name = "${var.project}-serving-igw" }
}

resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${var.project}-serving-public-${count.index}" }
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = { Name = "${var.project}-serving-rt" }
}

resource "aws_route_table_association" "public" {
  count = 2

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------------------
# Security groups: world -> ALB -> GPU box. No SSH; access via SSM session.
# ---------------------------------------------------------------------------

resource "aws_security_group" "alb" {
  vpc_id = aws_vpc.this.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-serving-alb-sg" }
}

resource "aws_security_group" "gpu" {
  vpc_id = aws_vpc.this.id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-serving-gpu-sg" }
}

# ---------------------------------------------------------------------------
# IAM: SSM session access only. Models come from Hugging Face, not AWS.
# ---------------------------------------------------------------------------

resource "aws_iam_role" "instance" {
  name = "${var.project}-serving-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "this" {
  name = "${var.project}-serving-instance-profile"
  role = aws_iam_role.instance.name
}

# ---------------------------------------------------------------------------
# Launch template: DL Base AMI (driver + docker preinstalled), vLLM on boot
# ---------------------------------------------------------------------------

resource "aws_launch_template" "gpu" {
  name_prefix   = "${var.project}-serving-"
  image_id      = data.aws_ssm_parameter.dl_base_ami.value
  instance_type = var.instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.this.name
  }

  metadata_options {
    http_tokens = "required"
  }

  block_device_mappings {
    device_name = "/dev/sda1"

    ebs {
      volume_size           = var.root_volume_size
      volume_type           = "gp3"
      delete_on_termination = true
    }
  }

  user_data = base64encode(templatefile("${path.module}/user_data.sh.tftpl", {
    vllm_image       = var.vllm_image
    model            = var.model
    model_revision   = var.model_revision
    served_model_name = var.served_model_name
    hf_token         = var.hf_token
    max_model_len    = var.max_model_len
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project}-serving-gpu"
      Role = "vllm"
    }
  }
}

# ---------------------------------------------------------------------------
# ASG: spot with capacity rebalance; on-demand via variable flip.
# One model per box; scale horizontally per model later.
# ---------------------------------------------------------------------------

resource "aws_autoscaling_group" "gpu" {
  name                      = "${var.project}-serving-gpu-asg"
  min_size                  = var.min_size
  max_size                  = var.max_size
  desired_capacity          = var.min_size
  vpc_zone_identifier       = aws_subnet.public[*].id
  health_check_type         = "ELB"
  health_check_grace_period = 600 # model load takes minutes before /health is up
  capacity_rebalance        = true

  mixed_instances_policy {
    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.gpu.id
        version            = "$Latest"
      }
    }

    instances_distribution {
      on_demand_percentage_above_base_capacity = var.use_spot ? 0 : 100
      spot_allocation_strategy                 = "capacity-optimized"
    }
  }

  tag {
    key                 = "Name"
    value               = "${var.project}-serving-gpu"
    propagate_at_launch = true
  }
}

resource "aws_autoscaling_attachment" "gpu" {
  autoscaling_group_name = aws_autoscaling_group.gpu.name
  lb_target_group_arn    = aws_lb_target_group.vllm.arn
}

# ---------------------------------------------------------------------------
# ALB: public HTTP (TLS via ACM once the domain is wired), forwards to vLLM
# ---------------------------------------------------------------------------

resource "aws_lb" "this" {
  name               = "${var.project}-serving-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  drop_invalid_header_fields = true
}

resource "aws_lb_target_group" "vllm" {
  name     = "${var.project}-vllm-tg"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = aws_vpc.this.id

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 5
  }

  deregistration_delay = 30
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.vllm.arn
  }
}

# ---------------------------------------------------------------------------
# Cost control + health alarms. Budget alarm fires to email before surprises.
# ---------------------------------------------------------------------------

resource "aws_budgets_budget" "monthly" {
  name         = "${var.project}-serving-monthly"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = var.alert_email != "" ? [1] : []

    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = 80
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.alert_email]
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_host" {
  alarm_name          = "${var.project}-serving-no-healthy-hosts"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  dimensions          = { LoadBalancer = aws_lb.this.arn_suffix, TargetGroup = aws_lb_target_group.vllm.arn_suffix }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 15
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_description   = "vLLM box unhealthy or model not up for 15 minutes"
  treat_missing_data  = "notBreaching"
}
