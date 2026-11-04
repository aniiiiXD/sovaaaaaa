variable "aws_region" {
  type    = string
  default = "us-east-2" # reliable g5 capacity, cheaper than us-east-1 at times
}

variable "project" {
  type    = string
  default = "sova"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "vpc_cidr" {
  type    = string
  default = "10.42.0.0/16"
}

variable "instance_type" {
  type    = string
  default = "g5.2xlarge" # A10G 24GB: Qwen3-8B or GLM-4-9B in bf16
}

variable "use_spot" {
  description = "Spot with capacity rebalance when true; flip to false for on-demand."
  type        = bool
  default     = true
}

variable "min_size" {
  type    = number
  default = 1
}

variable "max_size" {
  type    = number
  default = 1
}

variable "root_volume_size" {
  type    = number
  default = 100 # DL AMI snapshot demands >=75GB; docker + model cache need headroom
}

variable "vllm_image" {
  description = "Pinned vLLM OpenAI server image. Bump deliberately, never floating."
  type        = string
  default     = "vllm/vllm-openai:v0.11.0"
}

variable "model" {
  description = "Hugging Face repo id of the served model."
  type        = string
  default     = "Qwen/Qwen3-8B"
}

variable "model_revision" {
  description = "Pinned HF commit hash. Rig discipline: never float on main."
  type        = string
  default     = "" # set a real commit hash in terraform.tfvars before apply
}

variable "served_model_name" {
  description = "Model id the API exposes in /v1/models and chat requests."
  type        = string
  default     = "qwen3-8b"
}

variable "max_model_len" {
  type    = number
  default = 8192
}

variable "hf_token" {
  description = "Hugging Face token (gated downloads). Sensitive; keep in tfvars, never in git."
  type        = string
  default     = ""
  sensitive   = true
}

variable "hf_endpoint" {
  description = "HF API endpoint override (e.g. https://hf-mirror.com to dodge anonymous rate limits). Empty = official HF."
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  type    = string
  default = "50"
}

variable "alert_email" {
  type    = string
  default = ""
}
