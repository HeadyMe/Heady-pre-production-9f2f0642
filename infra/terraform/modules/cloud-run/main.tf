# =============================================================================
# HeadySystems Inc. — Terraform Module: Cloud Run
# heady-systems v3.2.2
# =============================================================================
# φ = 1.618033988749895 (Golden Ratio)
# Auto-scaling: min=fib(3)=2, max=fib(7)=13
# Concurrency: fib(11)=89 per instance (default)
# =============================================================================

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "project_id"            { type = string }
variable "region"                { type = string }
variable "environment"           { type = string }
variable "service_name"          { type = string }
variable "image"                 { type = string }
variable "min_instances"         { type = number; default = 2 }   # fib(3)=2
variable "max_instances"         { type = number; default = 13 }  # fib(7)=13
variable "cpu"                   { type = string; default = "1" }
variable "memory"                { type = string; default = "512Mi" }
variable "request_timeout"       { type = number; default = 144 }  # fib(12)=144s
variable "concurrency"           { type = number; default = 89 }   # fib(11)=89
variable "vpc_connector"         { type = string; default = "" }
variable "vpc_egress"            { type = string; default = "private-ranges-only" }
variable "service_account_email" { type = string }
variable "env_vars"              { type = map(string); default = {} }
variable "secret_env_vars"       { type = map(string); default = {} }
variable "common_labels"         { type = map(string); default = {} }
variable "port"                  { type = number; default = 8080 }

# Locals
locals {
  # φ-derived CPU throttling threshold: 61.8% (1/φ)
  cpu_throttle_pct = 62

  # φ-derived scale-up threshold: 38.2% max utilization before scaling
  scale_up_threshold = 38

  # Service labels
  service_labels = merge(var.common_labels, {
    service     = var.service_name
    module      = "cloud-run"
    phi         = "1618033988749895"
  })
}

# Cloud Run v2 Service
resource "google_cloud_run_v2_service" "service" {
  name     = var.service_name
  location = var.region
  project  = var.project_id

  labels = local.service_labels

  # Ingress: allow all (load balancer handles restriction)
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    labels = local.service_labels

    # Service account
    service_account = var.service_account_email

    # Scaling — Fibonacci-governed
    scaling {
      # min instances: from variable (fib(3)=2 production default)
      min_instance_count = var.min_instances
      # max instances: from variable (fib(7)=13 production default)
      max_instance_count = var.max_instances
    }

    # Timeout: φ^n seconds (from variable)
    timeout = "${var.request_timeout}s"

    # Max concurrent requests per instance
    # fib(11)=89 for brain/conductor, fib(12)=144 for web
    max_instance_request_concurrency = var.concurrency

    # VPC connector for private service access
    dynamic "vpc_access" {
      for_each = var.vpc_connector != "" ? [1] : []
      content {
        connector = var.vpc_connector
        egress    = var.vpc_egress
      }
    }

    containers {
      image = var.image

      ports {
        name           = "http1"
        container_port = var.port
      }

      # φ-scaled resource limits
      resources {
        # CPU limit: 1 CPU = fib(5)=5 × 200m
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        # CPU always allocated during request processing
        cpu_idle = false
        # Startup CPU boost: 2× normal CPU during startup
        startup_cpu_boost = true
      }

      # Environment variables from values
      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      # Secret environment variables from Secret Manager
      dynamic "env" {
        for_each = var.secret_env_vars
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = split("/", env.value)[3]  # projects/X/secrets/NAME/versions/V
              version = split("/", env.value)[5]
            }
          }
        }
      }

      # φ-scaled liveness probe
      # Interval: fib(6)=8s, timeout: fib(4)=3s, threshold: fib(4)=3
      liveness_probe {
        http_get {
          path = "/health/live"
          port = var.port
        }
        # initialDelaySeconds: fib(7)=13
        initial_delay_seconds = 13
        # periodSeconds: fib(6)=8
        period_seconds = 8
        # failureThreshold: fib(4)=3
        failure_threshold = 3
        # timeoutSeconds: fib(4)=3
        timeout_seconds = 3
      }

      # φ-scaled startup probe
      # Allows up to fib(8)=21 × fib(4)=3s = 63s startup time
      startup_probe {
        http_get {
          path = "/health/live"
          port = var.port
        }
        initial_delay_seconds = 8   # fib(6)=8
        period_seconds        = 3   # fib(4)=3
        failure_threshold     = 21  # fib(8)=21 — 63s total startup
        timeout_seconds       = 5
      }

      # Volume mounts for tmp
      volume_mounts {
        name       = "tmp"
        mount_path = "/tmp"
      }
    }

    # In-memory volumes for temp storage
    volumes {
      name = "tmp"
      empty_dir {
        medium     = "MEMORY"
        # fib(8)=21 × ~5Mi ≈ 100Mi
        size_limit = "100Mi"
      }
    }
  }

  # Traffic routing — 100% to latest revision
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    ignore_changes = [
      # Allow manual deployments to update traffic
      traffic,
    ]
  }
}

# Allow unauthenticated invocations (API gateway handles auth)
resource "google_cloud_run_v2_service_iam_member" "noauth" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.service.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Outputs
output "service_url" {
  description = "Cloud Run service URL"
  value       = google_cloud_run_v2_service.service.uri
}

output "service_name" {
  description = "Cloud Run service name"
  value       = google_cloud_run_v2_service.service.name
}

output "latest_revision" {
  description = "Latest revision name"
  value       = google_cloud_run_v2_service.service.latest_ready_revision
}
