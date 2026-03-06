variable "project_id" {
  description = "GCP project id for Heady liquid architecture"
  type        = string
  default     = "heady-liquid-architecture"
}

variable "region" {
  description = "Primary region for orchestration resources"
  type        = string
  default     = "us-central1"
}

variable "swarm_orchestrator_image" {
  description = "Cloud Run image for the swarm orchestrator"
  type        = string
  default     = "us-central1-docker.pkg.dev/heady-liquid-architecture/heady-docker-repo/orchestrator:latest"
}
