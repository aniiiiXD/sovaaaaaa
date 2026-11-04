output "alb_dns_name" {
  description = "Point the gateway (SOVA_VLLM_BASE_URL) at this."
  value       = aws_lb.this.dns_name
}

output "asg_name" {
  value = aws_autoscaling_group.gpu.name
}

output "budget_name" {
  value = aws_budgets_budget.monthly.name
}

output "monthly_cost_estimate_usd" {
  description = "Rough: instance on-demand ~$1.21/hr, spot ~$0.40/hr + EBS + ALB."
  value = {
    spot       = var.use_spot ? "~$350/mo" : "n/a"
    on_demand  = "~$950/mo"
    note       = "verify current AWS pricing; budget alarm caps surprises"
  }
}

output "smoke_test" {
  value = "curl http://${aws_lb.this.dns_name}/v1/models"
}
