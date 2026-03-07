# =============================================================================
# HeadySystems Inc. — Terraform Variables
# heady-systems v3.2.2 — GCP Infrastructure
# =============================================================================
# φ = 1.618033988749895 (Golden Ratio)
# All defaults use Fibonacci values where applicable
# =============================================================================

variable "project_id" {
  type        = string
  description = "GCP project ID for HeadySystems infrastructure"
  default     = "heady-systems"
}

variable "region" {
  type        = string
  description = "GCP primary region — us-central1 (Iowa)"
  default     = "us-central1"
}

variable "zone" {
  type        = string
  description = "GCP primary zone"
  default     = "us-central1-a"
}

variable "environment" {
  type        = string
  description = "Deployment environment: dev | staging | production"
  default     = "production"
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "name_prefix" {
  type        = string
  description = "Resource name prefix for all GCP resources"
  default     = "heady"
}

# =============================================================================
# Image Configuration
# =============================================================================
variable "image_registry" {
  type        = string
  description = "Container image registry"
  default     = "gcr.io/heady-systems"
}

variable "image_tag" {
  type        = string
  description = "Container image tag — matches heady-systems monorepo version"
  default     = "3.2.2"
}

# =============================================================================
# Networking
# =============================================================================
variable "vpc_cidr" {
  type        = string
  description = "VPC primary CIDR block"
  default     = "10.0.0.0/16"
}

variable "subnet_primary_cidr" {
  type        = string
  description = "Primary subnet CIDR — fib(1)=1 → 10.0.1.0/24"
  default     = "10.0.1.0/24"
}

variable "subnet_secondary_cidr" {
  type        = string
  description = "Secondary subnet CIDR — fib(2)=1 → 10.0.2.0/24 (but index 2 to be unique)"
  default     = "10.0.2.0/24"
}

variable "subnet_database_cidr" {
  type        = string
  description = "Database subnet CIDR — fib(3)=2... uses 10.0.3.0/24 for third subnet"
  default     = "10.0.3.0/24"
}

variable "pods_cidr" {
  type        = string
  description = "GKE pod CIDR (secondary range)"
  default     = "10.100.0.0/16"
}

variable "services_cidr" {
  type        = string
  description = "GKE services CIDR (secondary range)"
  default     = "10.200.0.0/20"
}

# =============================================================================
# Cloud SQL (PostgreSQL 16 + pgvector)
# =============================================================================
variable "db_instance_tier" {
  type        = string
  description = "Cloud SQL instance tier — φ-scaled for workload"
  # Production: db-n1-highmem-4 (4 vCPU, 26GB RAM)
  # fib(4)=3 ≈ 4 vCPU
  default     = "db-n1-highmem-4"
}

variable "db_disk_size_gb" {
  type        = number
  description = "Cloud SQL disk size in GB — fib(11)=89 × 10GB = 890GB production"
  # Production: fib(11)=89 × 10 = 890 ≈ 1000GB
  # Staging: fib(8)=21 × 10 = 210GB
  default     = 100
  validation {
    condition     = var.db_disk_size_gb >= 10 && var.db_disk_size_gb <= 65536
    error_message = "Disk size must be between 10 and 65536 GB."
  }
}

variable "db_max_connections" {
  type        = number
  description = "Maximum database connections — fib(10)=55"
  default     = 55  # fib(10)=55
}

variable "db_backup_retention_days" {
  type        = number
  description = "Cloud SQL backup retention days — fib(11)=89 days"
  default     = 89  # fib(11)=89 days
}

variable "db_read_replicas" {
  type        = number
  description = "Number of read replicas — fib(3)=2 for production"
  default     = 2   # fib(3)=2
  validation {
    condition     = var.db_read_replicas >= 0 && var.db_read_replicas <= 5
    error_message = "Read replicas must be between 0 and fib(5)=5."
  }
}

# =============================================================================
# Memorystore Redis
# =============================================================================
variable "redis_memory_gb" {
  type        = number
  description = "Redis memory in GB — fib(2)=1 GB production"
  # 1GB = fib(2)=1 unit × 1GB — scales with demand
  default     = 1
  validation {
    condition     = var.redis_memory_gb >= 1 && var.redis_memory_gb <= 300
    error_message = "Redis memory must be between 1 and 300 GB."
  }
}

variable "redis_replica_count" {
  type        = number
  description = "Redis replica count — fib(2)=1 for HA, 0 for dev"
  default     = 1  # fib(2)=1
}

# =============================================================================
# Cloud Run
# =============================================================================
variable "cloud_run_cpu" {
  type        = string
  description = "Cloud Run CPU allocation — 1 CPU = fib(5)=5 × 200m ≈ 1000m"
  default     = "1"
}

variable "cloud_run_memory" {
  type        = string
  description = "Cloud Run memory allocation — 512Mi = fib(12)=144 × ~3.5Mi"
  default     = "512Mi"
}

variable "cloud_run_request_timeout" {
  type        = number
  description = "Cloud Run request timeout seconds — fib(8)=21 × fib(6)=8 ≈ 168 → use 300s max"
  # φ^7=29034ms ≈ 30s; Cloud Run max is 3600s
  # Production AI workloads need up to fib(12)=144s for long completions
  default     = 144  # fib(12)=144 seconds
}

variable "cloud_run_max_concurrency" {
  type        = number
  description = "Max concurrent requests per Cloud Run instance — fib(11)=89"
  default     = 89  # fib(11)=89
}

# =============================================================================
# CDN / Load Balancer
# =============================================================================
variable "cdn_cache_mode" {
  type        = string
  description = "Cloud CDN cache mode"
  default     = "CACHE_ALL_STATIC"
}

variable "cdn_default_ttl" {
  type        = number
  description = "CDN default TTL seconds — fib(11)=89 × 60s = 5340s"
  default     = 5340  # fib(11)=89 × 60s
}

variable "cdn_max_ttl" {
  type        = number
  description = "CDN max TTL seconds — fib(13)=233 × 60s = 13980s"
  default     = 13980  # fib(13)=233 × 60s
}

# =============================================================================
# Observability
# =============================================================================
variable "otel_endpoint" {
  type        = string
  description = "OpenTelemetry collector endpoint"
  default     = "https://otel.headyme.com:4318"
}

# =============================================================================
# Domains
# =============================================================================
variable "domains" {
  type        = list(string)
  description = "All 9 HeadySystems domains (matches context brief)"
  default = [
    "headyme.com",
    "headyconnection.com",
    "headyconnection.org",
    "headyos.com",
    "heady.exchange",
    "heady.investments",
    "headysystems.com",
    "headyai.com",
    "admin.headyme.com"
  ]
}

variable "primary_domain" {
  type        = string
  description = "Primary domain for the platform"
  default     = "headyme.com"
}

# =============================================================================
# GKE (optional — for K8s-based deployments)
# =============================================================================
variable "gke_enabled" {
  type        = bool
  description = "Enable GKE cluster (alternative to Cloud Run)"
  default     = false
}

variable "gke_node_count" {
  type        = number
  description = "GKE initial node count — fib(4)=3 per zone"
  default     = 3  # fib(4)=3
}

variable "gke_node_machine_type" {
  type        = string
  description = "GKE node machine type"
  default     = "n2-standard-4"  # 4 vCPU ≈ fib(4)=3+1
}

variable "gke_min_nodes" {
  type        = number
  description = "GKE autoscaler min nodes — fib(3)=2"
  default     = 2   # fib(3)=2
}

variable "gke_max_nodes" {
  type        = number
  description = "GKE autoscaler max nodes — fib(7)=13"
  default     = 13  # fib(7)=13
}
