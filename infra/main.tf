# ═══════════════════════════════════════════════════════════════
# Heady Liquid Architecture — Terraform Infrastructure
# ═══════════════════════════════════════════════════════════════
#
# Provisions the entire gcloud ecosystem deterministically.
# If the environment goes down, `terraform apply` rebuilds
# everything in minutes.
#
# Usage:
#   terraform init
#   terraform plan -out=heady.tfplan
#   terraform apply heady.tfplan
# ═══════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "heady-liquid-architecture"
}

variable "region" {
  description = "Primary GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ═══════════════════════════════════════════════════════════════
# 1. Container Registry for Dynamic Projections and Bees
# ═══════════════════════════════════════════════════════════════

resource "google_artifact_registry_repository" "heady_repo" {
  location      = var.region
  repository_id = "heady-docker-repo"
  format        = "DOCKER"
  description   = "Heady ecosystem container registry"

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ═══════════════════════════════════════════════════════════════
# 2. Pub/Sub Nervous System
# ═══════════════════════════════════════════════════════════════

# Standard background tasks
resource "google_pubsub_topic" "swarm_tasks" {
  name = "heady-swarm-tasks"
  labels = {
    priority = "background"
  }
}

# Full-Throttle Auto-Success lane (God Mode)
resource "google_pubsub_topic" "admin_triggers" {
  name = "heady-admin-triggers"
  labels = {
    priority = "critical"
    mode     = "god-mode"
  }
}

# Dead letter topic for failed messages
resource "google_pubsub_topic" "dead_letter" {
  name = "heady-dead-letter"
}

# ═══════════════════════════════════════════════════════════════
# 3. Cloud Run Services
# ═══════════════════════════════════════════════════════════════

# Main Heady Manager service
resource "google_cloud_run_v2_service" "heady_manager" {
  name     = "heady-manager"
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/heady-docker-repo/heady-manager:latest"

      resources {
        limits = {
          cpu    = "2000m"
          memory = "2Gi"
        }
        cpu_idle = true
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "8080"
      }

      ports {
        container_port = 8080
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        period_seconds = 30
      }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 10
    }

    labels = {
      environment = var.environment
      service     = "heady-manager"
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Swarm Orchestrator (high-compute)
resource "google_cloud_run_v2_service" "swarm_orchestrator" {
  name     = "heady-swarm-orchestrator"
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/heady-docker-repo/orchestrator:latest"

      resources {
        limits = {
          cpu    = "4000m"
          memory = "4Gi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "SWARM_MODE"
        value = "orchestrator"
      }

      ports {
        container_port = 8080
      }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 20
    }
  }
}

# ═══════════════════════════════════════════════════════════════
# 4. Pub/Sub Subscriptions → Cloud Run
# ═══════════════════════════════════════════════════════════════

resource "google_pubsub_subscription" "swarm_background" {
  name  = "swarm-background-sub"
  topic = google_pubsub_topic.swarm_tasks.id

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.swarm_orchestrator.uri}/api/v1/swarm/background"
  }

  ack_deadline_seconds = 120
  message_retention_duration = "600s"

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }
}

resource "google_pubsub_subscription" "swarm_admin" {
  name  = "swarm-admin-sub"
  topic = google_pubsub_topic.admin_triggers.id

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.swarm_orchestrator.uri}/api/v1/swarm/priority"
  }

  ack_deadline_seconds = 600  # 10 minutes for complex recursive loops
  message_retention_duration = "3600s"
}

# ═══════════════════════════════════════════════════════════════
# 5. Cloud Scheduler (The Heartbeat)
# ═══════════════════════════════════════════════════════════════

resource "google_cloud_scheduler_job" "nightly_pruner" {
  name             = "trigger-pruner-swarm"
  description      = "Nightly: PrunerBee cleans orphaned projections"
  schedule         = "0 2 * * *"
  time_zone        = "America/Denver"

  pubsub_target {
    topic_name = google_pubsub_topic.swarm_tasks.id
    data       = base64encode(jsonencode({
      task = "prune_unused_projections"
      priority = "background"
    }))
  }
}

resource "google_cloud_scheduler_job" "hourly_tester" {
  name             = "trigger-tester-swarm"
  description      = "Hourly: TesterBee sweeps all endpoints"
  schedule         = "0 * * * *"
  time_zone        = "America/Denver"

  pubsub_target {
    topic_name = google_pubsub_topic.swarm_tasks.id
    data       = base64encode(jsonencode({
      task = "health_sweep"
      priority = "background"
    }))
  }
}

resource "google_cloud_scheduler_job" "daily_self_healing" {
  name             = "trigger-self-healing"
  description      = "Daily: Self-healing cycle + projection noise cleanup"
  schedule         = "30 3 * * *"
  time_zone        = "America/Denver"

  pubsub_target {
    topic_name = google_pubsub_topic.swarm_tasks.id
    data       = base64encode(jsonencode({
      task = "self_healing_cycle"
      priority = "maintenance"
    }))
  }
}

# ═══════════════════════════════════════════════════════════════
# 6. Cloud Storage (Archive & Assets)
# ═══════════════════════════════════════════════════════════════

resource "google_storage_bucket" "heady_assets" {
  name          = "${var.project_id}-assets"
  location      = var.region
  force_destroy = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  labels = {
    environment = var.environment
  }
}

resource "google_storage_bucket" "heady_cold_archive" {
  name          = "${var.project_id}-cold-archive"
  location      = var.region
  storage_class = "ARCHIVE"
  force_destroy = false

  labels = {
    purpose = "disaster-recovery"
  }
}

# ═══════════════════════════════════════════════════════════════
# 7. IAM (Allow Cloud Run to receive Pub/Sub)
# ═══════════════════════════════════════════════════════════════

resource "google_cloud_run_v2_service_iam_member" "manager_public" {
  name     = google_cloud_run_v2_service.heady_manager.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ═══════════════════════════════════════════════════════════════
# Outputs
# ═══════════════════════════════════════════════════════════════

output "heady_manager_url" {
  value       = google_cloud_run_v2_service.heady_manager.uri
  description = "Heady Manager Cloud Run URL"
}

output "swarm_orchestrator_url" {
  value       = google_cloud_run_v2_service.swarm_orchestrator.uri
  description = "Swarm Orchestrator Cloud Run URL"
}

output "docker_registry" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.heady_repo.repository_id}"
  description = "Docker registry path"
}
