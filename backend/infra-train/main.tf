# SOVA ephemeral training box: short-lived burst runs, destroyed after each run.
# Cost control: nothing here idles. terraform apply -> run -> terraform destroy.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type    = string
  default = "ap-south-1"
}

variable "instance_type" {
  description = "GPU instance type. g5.xlarge = A10G 24GB, 4 vCPU (fits the approved 8 vCPU G/VT quota)."
  type        = string
  default     = "g5.xlarge"
}

variable "public_key_path" {
  type    = string
  default = "sova_train_key.pub"
}

variable "root_volume_size" {
  description = "GB. DL Base AMI snapshot requires >= 75GB; 80 gives pip cache headroom."
  type        = number
  default     = 80
}

variable "use_spot" {
  description = "Spot saves ~60% but can be evicted mid-run; training checkpoints resume."
  type        = bool
  default     = false
}

# SWAPPED: stock Ubuntu + manual driver install loses a DKMS race on ~50% of
# boots (attempts 2 and 3). Use the DL Base AMI proven on the Mumbai serving
# boxes: NVIDIA driver + docker preinstalled, nvidia-smi works on first boot.
data "aws_ssm_parameter" "ubuntu_2404" {
  name = "/aws/service/deeplearning/ami/x86_64/base-oss-nvidia-driver-gpu-ubuntu-22.04/latest/ami-id"
}

resource "aws_key_pair" "train" {
  key_name   = "sova-train-ephemeral"
  public_key = file(var.public_key_path)
}

resource "aws_security_group" "train" {
  name_prefix = "sova-train-ssh-"
  description = "SSH access for ephemeral training bursts"

  ingress {
    description = "SSH key auth only, box lives under 1 day"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_instance" "train" {
  ami                  = data.aws_ssm_parameter.ubuntu_2404.value
  instance_type        = var.instance_type
  key_name             = aws_key_pair.train.key_name
  security_groups      = [aws_security_group.train.name]
  user_data            = base64encode(templatefile("${path.module}/user_data.sh.tftpl", {}))
  user_data_replace_on_change = true

  root_block_device {
    volume_size = var.root_volume_size
    volume_type = "gp3"
    encrypted   = true
  }

  dynamic "instance_market_options" {
    for_each = var.use_spot ? [1] : []
    content {
      market_type = "spot"
    }
  }

  tags = {
    Name    = "sova-train-ephemeral"
    Project = "sova-finance-1"
  }
}

output "public_ip" {
  value = aws_instance.train.public_ip
}

output "instance_id" {
  value = aws_instance.train.id
}
