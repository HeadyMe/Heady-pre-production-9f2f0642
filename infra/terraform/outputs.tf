# =============================================================================
# HeadySystems Inc. — Terraform Outputs
# heady-systems v3.2.2 — GCP Infrastructure
# =============================================================================

# =============================================================================
# Cloud Run Service URLs
# =============================================================================

output "heady_brain_url" {
  description = "Cloud Run URL for heady-brain service"
  value       = module.cloud_run_brain.service_url
  sensitive   = false
}

output "heady_conductor_url" {
  description = "Cloud Run URL for heady-conductor service"
  value       = module.cloud_run_conductor.service_url
  sensitive   = false
}

output "heady_mcp_url" {
  description = "Cloud Run URL for heady-mcp service"
  value       = module.cloud_run_mcp.service_url
  sensitive   = false
}

output "heady_web_url" {
  description = "Cloud Run URL for heady-web service"
  value       = module.cloud_run_web.service_url
  sensitive   = false
}

# =============================================================================
# Cloud SQL (PostgreSQL)
# =============================================================================

output "db_connection_name" {
  description = "Cloud SQL connection name (for Cloud SQL proxy / Cloud Run connection)"
  value       = module.cloud_sql.connection_name
  sensitive   = false
}

output "db_private_ip" {
  description = "Cloud SQL private IP address (for VPC-connected services)"
  value       = module.cloud_sql.private_ip
  sensitive   = false
}

output "db_public_ip" {
  description = "Cloud SQL public IP address (disabled in production)"
  value       = module.cloud_sql.public_ip
  sensitive   = false
}

output "db_instance_name" {
  description = "Cloud SQL instance name"
  value       = module.cloud_sql.instance_name
  sensitive   = false
}

output "db_replica_connection_names" {
  description = "Connection names for read replicas (fib(3)=2 replicas in production)"
  value       = module.cloud_sql.replica_connection_names
  sensitive   = false
}

# =============================================================================
# Memorystore Redis
# =============================================================================

output "redis_host" {
  description = "Memorystore Redis host IP"
  value       = module.memorystore.host
  sensitive   = false
}

output "redis_port" {
  description = "Memorystore Redis port (default 6379)"
  value       = module.memorystore.port
  sensitive   = false
}

output "redis_connection_string" {
  description = "Redis connection string (password from Secret Manager)"
  value       = "redis://:SECRET@${module.memorystore.host}:${module.memorystore.port}"
  sensitive   = false
}

# =============================================================================
# Networking
# =============================================================================

output "vpc_network_id" {
  description = "VPC network resource ID"
  value       = module.networking.vpc_network_id
  sensitive   = false
}

output "vpc_network_name" {
  description = "VPC network name"
  value       = module.networking.vpc_network_name
  sensitive   = false
}

output "subnet_primary_id" {
  description = "Primary subnet resource ID"
  value       = module.networking.subnet_primary_id
  sensitive   = false
}

output "vpc_connector_id" {
  description = "Serverless VPC access connector ID for Cloud Run"
  value       = module.networking.vpc_connector_id
  sensitive   = false
}

output "load_balancer_ip" {
  description = "Global Load Balancer external IP address"
  value       = module.networking.load_balancer_ip
  sensitive   = false
}

output "cdn_backend_bucket_name" {
  description = "Cloud CDN backend bucket name for static assets"
  value       = module.networking.cdn_backend_bucket_name
  sensitive   = false
}

# =============================================================================
# IAM Service Accounts
# =============================================================================

output "service_account_emails" {
  description = "Map of service → SA email for all heady-* Cloud Run services"
  value = {
    heady_brain     = google_service_account.heady_brain_sa.email
    heady_conductor = google_service_account.heady_conductor_sa.email
    heady_mcp       = google_service_account.heady_mcp_sa.email
    heady_web       = google_service_account.heady_web_sa.email
  }
  sensitive = false
}

# =============================================================================
# φ Metadata (for debugging / documentation)
# =============================================================================

output "phi_parameters" {
  description = "Summary of all φ-governed parameters deployed in this environment"
  value = {
    phi                      = "1.618033988749895"
    fibonacci_sequence       = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597]
    cloud_run_min_instances  = 2   # fib(3)=2
    cloud_run_max_instances  = 13  # fib(7)=13
    web_min_instances        = 3   # fib(4)=3
    web_max_instances        = 21  # fib(8)=21
    redis_memory_gb          = var.redis_memory_gb
    db_max_connections       = 55  # fib(10)=55
    db_backup_retention_days = 89  # fib(11)=89
    request_timeout_s        = var.cloud_run_request_timeout
    cdn_default_ttl_s        = 5340  # fib(11)=89 × 60s
    cache_max_entries        = 987   # fib(16)=987
    rate_limit_enterprise    = 233   # fib(13)=233 rps
    environment              = var.environment
  }
  sensitive = false
}

# =============================================================================
# Deployment Summary
# =============================================================================

output "deployment_summary" {
  description = "Deployment summary for all HeadySystems services"
  value = {
    project_id      = var.project_id
    region          = var.region
    environment     = var.environment
    image_tag       = var.image_tag
    primary_domain  = var.primary_domain
    domain_count    = length(var.domains)
    services        = ["heady-brain", "heady-conductor", "heady-mcp", "heady-web"]
    version         = "3.2.2"
  }
  sensitive = false
}
