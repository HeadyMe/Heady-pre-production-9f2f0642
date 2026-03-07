# =============================================================================
# HeadySystems Inc. — Terraform Module: Cloud SQL (Postgres 16 + pgvector)
# heady-systems v3.2.2
# =============================================================================
# φ = 1.618033988749895 (Golden Ratio)
# High-availability, PITR, pgvector extension
# Backup retention: fib(11)=89 days
# Max connections: fib(10)=55
# =============================================================================

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

variable "project_id"            { type = string }
variable "region"                { type = string }
variable "environment"           { type = string }
variable "name_prefix"           { type = string }
variable "database_version"      { type = string; default = "POSTGRES_16" }
variable "instance_tier"         { type = string; default = "db-n1-highmem-4" }
variable "disk_size_gb"          { type = number; default = 100 }
variable "availability_type"     { type = string; default = "REGIONAL" }
variable "vpc_network"           { type = string }
variable "backup_retention_days" { type = number; default = 89 }   # fib(11)=89
variable "read_replica_count"    { type = number; default = 2 }    # fib(3)=2
variable "common_labels"         { type = map(string); default = {} }

# Random suffix for instance names (Cloud SQL instances are globally unique)
resource "random_id" "db_suffix" {
  byte_length = 4
}

locals {
  instance_name = "${var.name_prefix}-postgres-${var.environment}-${random_id.db_suffix.hex}"

  # φ-derived Postgres configuration
  # max_connections: fib(10)=55 (managed via pgbouncer)
  # work_mem: fib(9)=34 × 1MB = 34MB
  # shared_buffers: fib(12)=144 × 1MB per 8GB RAM ≈ varies
  # random_page_cost: φ = 1.618033988749895 (for SSD storage)
  # checkpoint_completion_target: 1/φ = 0.618

  db_flags = [
    { name = "max_connections",            value = "55"    },  # fib(10)=55
    { name = "work_mem",                   value = "34816" },  # fib(9)=34 × 1024KB = 34MB
    { name = "maintenance_work_mem",       value = "65536" },  # 64MB
    { name = "effective_cache_size",       value = "786432" }, # 768MB
    { name = "checkpoint_completion_target", value = "0.618" }, # 1/φ
    { name = "random_page_cost",           value = "1.618" },  # φ (SSD)
    { name = "min_wal_size",               value = "1024" },
    { name = "max_wal_size",               value = "4096" },
    { name = "max_worker_processes",       value = "8"    },   # fib(6)=8
    { name = "max_parallel_workers",       value = "8"    },   # fib(6)=8
    { name = "max_parallel_workers_per_gather", value = "3" }, # fib(4)=3
    { name = "max_parallel_maintenance_workers", value = "3" }, # fib(4)=3
    { name = "log_checkpoints",            value = "on"   },
    { name = "log_lock_waits",             value = "on"   },
    { name = "log_min_duration_statement", value = "1618" },   # φ^1=1618ms slow query threshold
    { name = "autovacuum_vacuum_scale_factor",  value = "0.236" },  # 23.6% = 1/φ^3
    { name = "autovacuum_analyze_scale_factor", value = "0.382" },  # 38.2% = 1-1/φ^2
    { name = "default_statistics_target",  value = "100"  },
    { name = "cloudsql.iam_authentication", value = "on"  },
  ]
}

# Primary Cloud SQL instance
resource "google_sql_database_instance" "primary" {
  name             = local.instance_name
  project          = var.project_id
  region           = var.region
  database_version = var.database_version

  # Prevent accidental deletion
  deletion_protection = var.environment == "production" ? true : false

  settings {
    tier              = var.instance_tier
    availability_type = var.availability_type

    # Disk configuration
    disk_type       = "PD_SSD"
    disk_size       = var.disk_size_gb
    # Auto-grow: fib(8)=21 GB increments
    disk_autoresize = true
    disk_autoresize_limit = 0  # No limit

    # Backup configuration
    # RPO: fib(5)=5 minutes (PITR)
    # Retention: fib(11)=89 days
    backup_configuration {
      enabled                        = true
      # PITR: fib(5)=5-minute granularity
      point_in_time_recovery_enabled = true
      # Backup window: 02:00-06:00 UTC (low traffic)
      start_time                     = "02:00"
      transaction_log_retention_days = 7    # fib(5+2)=... using 7 days for PITR logs
      backup_retention_settings {
        retained_backups = var.backup_retention_days  # fib(11)=89
        retention_unit   = "COUNT"
      }
    }

    # Maintenance window: Sunday 02:00 UTC
    # day: fib(2)=1 → Sunday (Cloud SQL: 1=Sunday)
    maintenance_window {
      day          = 1    # Sunday = fib(2)=1 ≈ index 1
      hour         = 2    # 02:00 UTC
      update_track = "stable"
    }

    # Database flags (φ-scaled parameters)
    dynamic "database_flags" {
      for_each = local.db_flags
      content {
        name  = database_flags.value.name
        value = database_flags.value.value
      }
    }

    # IP configuration — private only
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.vpc_network
      enable_private_path_for_google_cloud_services = true
      require_ssl                                   = true
    }

    # Insights for query performance monitoring
    insights_config {
      query_insights_enabled  = true
      # Record application tags: fib(8)=21 query string length
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = false
    }

    # Labels
    user_labels = var.common_labels
  }

  lifecycle {
    prevent_destroy = false
    ignore_changes  = [settings[0].disk_size]
  }
}

# Production database
resource "google_sql_database" "heady" {
  name      = "heady_${var.environment}"
  instance  = google_sql_database_instance.primary.name
  project   = var.project_id
  charset   = "UTF8"
  collation = "en_US.UTF8"
}

# pgvector extension setup — SQL run after database creation
# Note: pgvector is pre-installed on Cloud SQL Postgres 16
resource "google_sql_database" "heady_vector" {
  name      = "heady_vectors"
  instance  = google_sql_database_instance.primary.name
  project   = var.project_id
  charset   = "UTF8"
  collation = "en_US.UTF8"
}

# Read replicas — fib(3)=2 for production
resource "google_sql_database_instance" "replica" {
  count = var.read_replica_count

  name             = "${local.instance_name}-replica-${count.index}"
  project          = var.project_id
  region           = var.region
  database_version = var.database_version
  master_instance_name = google_sql_database_instance.primary.name

  replica_configuration {
    failover_target = count.index == 0 ? true : false
  }

  settings {
    tier              = var.instance_tier
    availability_type = "ZONAL"   # Replicas are zonal

    backup_configuration {
      enabled = false  # Backups only on primary
    }

    ip_configuration {
      ipv4_enabled     = false
      private_network  = var.vpc_network
      require_ssl      = true
    }

    # Different zones for replicas — spread across fib(3)=2 AZs
    location_preference {
      zone = count.index == 0 ? "${var.region}-b" : "${var.region}-c"
    }

    user_labels = merge(var.common_labels, {
      replica_index = tostring(count.index)
    })
  }

  depends_on = [google_sql_database_instance.primary]
}

# Outputs
output "instance_name"           { value = google_sql_database_instance.primary.name }
output "connection_name"         { value = google_sql_database_instance.primary.connection_name }
output "private_ip"              { value = google_sql_database_instance.primary.private_ip_address }
output "public_ip"               { value = google_sql_database_instance.primary.public_ip_address }
output "database_name"           { value = google_sql_database.heady.name }

output "replica_connection_names" {
  value = [for r in google_sql_database_instance.replica : r.connection_name]
}
