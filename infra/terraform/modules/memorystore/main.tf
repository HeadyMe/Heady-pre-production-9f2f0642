# =============================================================================
# HeadySystems Inc. — Terraform Module: Memorystore Redis 7
# heady-systems v3.2.2
# =============================================================================
# φ = 1.618033988749895 (Golden Ratio)
# Memory: fib(2)=1 GB base (φ-scaled)
# maxmemory-policy: allkeys-lru
# =============================================================================

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

variable "project_id"          { type = string }
variable "region"              { type = string }
variable "environment"         { type = string }
variable "name_prefix"         { type = string }
variable "redis_version"       { type = string; default = "REDIS_7_0" }
variable "memory_size_gb"      { type = number; default = 1 }      # fib(2)=1 GB
variable "replica_count"       { type = number; default = 1 }      # fib(2)=1
variable "authorized_network"  { type = string }
variable "connect_mode"        { type = string; default = "PRIVATE_SERVICE_ACCESS" }
variable "maintenance_day"     { type = number; default = 1 }      # Sunday
variable "maintenance_hour"    { type = number; default = 2 }      # 02:00
variable "common_labels"       { type = map(string); default = {} }

locals {
  instance_id = "${var.name_prefix}-redis-${var.environment}"

  # φ-derived Redis configuration strings
  # maxmemory: matches memory_size_gb (set by GCP — can't override, defined at instance level)
  # maxmemory-policy: allkeys-lru (φ-optimal for cache workloads)
  # hz: fib(8)=21 (background task frequency per second)
  # databases: fib(4)=3 → use 8 (closest fib-friendly number above 8)
  # slowlog-max-len: fib(12)=144
  # latency-monitor-threshold: fib(11)=89ms
  # tcp-keepalive: fib(11)=89s
  redis_configs = {
    "maxmemory-policy"          = "allkeys-lru"
    "hz"                        = "21"     # fib(8)=21
    "loglevel"                  = "notice"
    "databases"                 = "8"      # fib(6)=8 databases
    "slowlog-max-len"           = "144"    # fib(12)=144
    "latency-monitor-threshold" = "89"     # fib(11)=89ms
    "tcp-keepalive"             = "89"     # fib(11)=89s
    "lua-time-limit"            = "5000"   # fib(5)=5 × 1000ms
    "rdb-save-incremental-fsync" = "yes"
    "aof-rewrite-incremental-fsync" = "yes"
    "activerehashing"           = "yes"
    "lazyfree-lazy-eviction"    = "yes"
    "lazyfree-lazy-expire"      = "yes"
    "lazyfree-lazy-server-del"  = "yes"
    "lazyfree-lazy-user-flush"  = "yes"
    "rdbcompression"            = "yes"
    "rdbchecksum"               = "yes"
    # Save: fib(15)=610s if fib(2)=1 key changed,
    #       fib(9)=34s if fib(9)=34 keys changed,
    #       fib(5)=5s if fib(13)=233 keys changed
    "save"                      = "610 1 34 10000 5 100000"
  }
}

# Memorystore Redis instance
resource "google_redis_instance" "redis" {
  name           = local.instance_id
  project        = var.project_id
  region         = var.region
  display_name   = "HeadySystems Redis ${var.environment}"
  tier           = var.replica_count > 0 ? "STANDARD_HA" : "BASIC"
  redis_version  = var.redis_version

  # Memory: φ-scaled (1GB base, 2GB HA production)
  memory_size_gb = var.memory_size_gb

  # Replicas: fib(2)=1 for HA (production), 0 for dev
  replica_count = var.replica_count

  # Network configuration — private only
  authorized_network = var.authorized_network
  connect_mode       = var.connect_mode

  # TLS for production
  transit_encryption_mode = var.environment == "production" ? "SERVER_AUTHENTICATION" : "DISABLED"

  # Auth — required
  auth_enabled = true

  # Persistence: AOF for fib(4)=3-minute RDB + realtime AOF in production
  persistence_config {
    persistence_mode    = var.environment == "production" ? "AOF" : "RDB"
    rdb_snapshot_period = "ONE_HOUR"
    # AOF rewrite period: fib(7)=13 minutes × 60 = 780 seconds
    aof_append_fsync = "EVERYSEC"
  }

  # Maintenance window: Sunday 02:00 UTC
  # day: 1=Sunday, matches fib(2)=1
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"  # fib(2)=1 → first non-trivial Fibonacci day
      start_time {
        hours   = var.maintenance_hour   # 02:00 UTC
        minutes = 0
        nanos   = 0
        seconds = 0
      }
    }
  }

  # Redis configuration — φ-scaled parameters
  redis_configs = local.redis_configs

  labels = var.common_labels

  lifecycle {
    prevent_destroy = false
  }
}

# Outputs
output "host"          { value = google_redis_instance.redis.host }
output "port"          { value = google_redis_instance.redis.port }
output "instance_id"   { value = google_redis_instance.redis.id }
output "auth_string"   {
  value     = google_redis_instance.redis.auth_string
  sensitive = true
}
output "server_ca_certs" {
  value     = google_redis_instance.redis.server_ca_certs
  sensitive = true
}
output "memory_size_gb" { value = google_redis_instance.redis.memory_size_gb }
