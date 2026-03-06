# ══════════════════════════════════════════════════════════════════
# Heady Liquid Architecture — Terraform Variables
# ══════════════════════════════════════════════════════════════════

variable "project_id" {
  description = "GCP project ID for the Heady infrastructure"
  type        = string
  default     = "heady-liquid-architecture"
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "orchestrator_image" {
  description = "Docker image URL for the swarm orchestrator"
  type        = string
  default     = "us-central1-docker.pkg.dev/heady-liquid-architecture/heady-docker-repo/heady-orchestrator:latest"
}
