# =============================================================================
# HeadySystems Inc. — Terraform Main Configuration
# heady-systems v3.2.2 — GCP Infrastructure
# =============================================================================
# φ = 1.618033988749895 (Golden Ratio)
# Fibonacci: 1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597
#
# Resources provisioned:
# - Cloud Run services (heady-brain, heady-conductor, heady-mcp, heady-web)
# - Cloud SQL (Postgres 16 with pgvector)
# - Memorystore Redis 7
# - Cloud CDN + Load Balancer
# - VPC, subnets, firewall rules
# - IAM service accounts
# =============================================================================

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
  backend "gcs" {
    bucket = "heady-systems-terraform-state"
    prefix = "heady-platform"
  }
}

# Configure providers
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Local φ constants for computations
locals {
  # φ = 1.618033988749895
  phi = 1.618033988749895

  # Fibonacci sequence (first 17 values)
  fib = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597]

  # Common labels applied to all resources
  common_labels = {
    environment       = var.environment
    managed_by        = "terraform"
    project           = "heady-platform"
    version           = "3-2-2"
    phi               = "1618033988749895" # φ without decimal (label constraint)
    headysystems_tier = "infrastructure"
  }

  # Environment-specific suffixes
  env_suffix = var.environment == "production" ? "" : "-${var.environment}"

  # φ-scaled memory sizes for Redis (MB)
  # fib(12)=144 × ~3.5 ≈ 512MB base, doubled for production
  redis_memory_mb = var.environment == "production" ? 1024 : 512

  # Cloud Run min/max instances (Fibonacci)
  # min: fib(3)=2 (production), fib(2)=1 (staging), fib(1)=1 (dev)
  cloud_run_min_instances = {
    production = 2   # fib(3)=2
    staging    = 1   # fib(2)=1
    dev        = 0   # fib(1)=0 (scale to zero for dev)
  }

  # max: fib(7)=13 (production), fib(6)=8 (staging), fib(5)=5 (dev)
  cloud_run_max_instances = {
    production = 13  # fib(7)=13
    staging    = 8   # fib(6)=8
    dev        = 5   # fib(5)=5
  }
}

# =============================================================================
# Networking Module
# =============================================================================
module "networking" {
  source = "./modules/networking"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  name_prefix = var.name_prefix

  # φ-scaled VPC CIDR: using /16 for production
  vpc_cidr = var.vpc_cidr

  # Fibonacci-indexed subnets
  # Primary: 10.0.fib(n).0/24
  subnet_primary_cidr    = var.subnet_primary_cidr    # 10.0.1.0/24
  subnet_secondary_cidr  = var.subnet_secondary_cidr  # 10.0.2.0/24
  subnet_database_cidr   = var.subnet_database_cidr   # 10.0.3.0/24

  common_labels = local.common_labels
}

# =============================================================================
# Cloud SQL Module (Postgres 16 + pgvector)
# =============================================================================
module "cloud_sql" {
  source = "./modules/cloud-sql"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  name_prefix = var.name_prefix

  # Postgres 16 with pgvector
  database_version = "POSTGRES_16"

  # φ-scaled instance tier
  # n2-highmem-2 (2 vCPU, 16GB) for production
  # n1-standard-2 for staging
  instance_tier = var.db_instance_tier

  # Storage: fib(11)=89 × 10GB = 890GB production
  # fib(8)=21 × 10GB = 210GB staging
  disk_size_gb = var.db_disk_size_gb

  # High-availability for production
  availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"

  # Connection name for Cloud Run
  vpc_network = module.networking.vpc_network_id

  # Backup configuration (φ-scaled retention)
  # RPO: fib(5)=5 minutes (PITR)
  # Backup retention: fib(11)=89 days
  backup_retention_days = 89   # fib(11)=89

  # Read replicas: fib(3)=2 for production, fib(2)=1 for staging
  read_replica_count = var.environment == "production" ? 2 : 1

  common_labels = local.common_labels

  depends_on = [module.networking]
}

# =============================================================================
# Memorystore Redis Module
# =============================================================================
module "memorystore" {
  source = "./modules/memorystore"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  name_prefix = var.name_prefix

  # Redis 7 with AOF persistence
  redis_version = "REDIS_7_0"

  # Memory: 1GB production (fib(12)=144 × ~7MB ≈ 1008MB ≈ 1GB)
  #         512MB staging  (fib(12)=144 × ~3.5MB ≈ 504MB ≈ 512MB)
  memory_size_gb = var.redis_memory_gb

  # HA for production: replication enabled
  replica_count = var.environment == "production" ? 1 : 0

  # Network
  authorized_network = module.networking.vpc_network_id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  # φ-scaled maintenance window: Sunday at 02:00 UTC (minimal traffic)
  maintenance_day   = 1   # Sunday
  maintenance_hour  = 2   # 02:00 UTC

  common_labels = local.common_labels

  depends_on = [module.networking]
}

# =============================================================================
# Cloud Run Services
# =============================================================================

# heady-brain — fib(7)=13 max instances, fib(3)=2 min
module "cloud_run_brain" {
  source = "./modules/cloud-run"

  project_id   = var.project_id
  region       = var.region
  environment  = var.environment
  service_name = "heady-brain${local.env_suffix}"
  image        = "${var.image_registry}/heady-brain:${var.image_tag}"

  # Fibonacci-scaled instance counts
  min_instances = local.cloud_run_min_instances[var.environment]  # fib(3)=2
  max_instances = local.cloud_run_max_instances[var.environment]  # fib(7)=13

  # φ-scaled resources
  # cpu: fib(5)=5 → 1 CPU (1000m)
  # memory: fib(12)=144 × ~3.5Mi ≈ 512Mi
  cpu    = var.cloud_run_cpu
  memory = var.cloud_run_memory

  # Request timeout: φ^5 = 11090ms → 300s max for Cloud Run
  request_timeout = var.cloud_run_request_timeout

  # Concurrency: fib(11)=89 concurrent requests per instance
  concurrency = 89  # fib(11)=89

  # VPC connector for private access to Cloud SQL and Memorystore
  vpc_connector = module.networking.vpc_connector_id
  vpc_egress    = "private-ranges-only"

  # Environment variables
  env_vars = {
    NODE_ENV                  = var.environment
    PHI                       = "1.618033988749895"
    SERVICE_NAME              = "heady-brain"
    SERVICE_VERSION           = "3.2.2"
    WORKER_CONCURRENCY        = "13"         # fib(7)=13
    QUEUE_MAX_DEPTH           = "55"         # fib(10)=55
    REQUEST_TIMEOUT_MS        = "4236"       # φ^3
    UPSTREAM_TIMEOUT_MS       = "11090"      # φ^5
    CONNECTION_POOL_SIZE      = "34"         # fib(9)=34
    RATE_LIMIT_RPS            = "144"        # fib(12)=144
    RATE_LIMIT_BURST          = "233"        # fib(13)=233
    OTEL_EXPORTER_OTLP_ENDPOINT = var.otel_endpoint
    OTEL_SERVICE_NAME         = "heady-brain"
    OTEL_TRACES_SAMPLER_ARG   = "0.236"      # 1/φ^3
  }

  # Secret references from Secret Manager
  secret_env_vars = {
    DATABASE_URL    = "${var.project_id}/secrets/postgres-url/versions/latest"
    REDIS_URL       = "${var.project_id}/secrets/redis-url/versions/latest"
    JWT_SECRET      = "${var.project_id}/secrets/jwt-rsa-private-key/versions/latest"
    OPENAI_API_KEY  = "${var.project_id}/secrets/openai-api-key/versions/latest"
  }

  service_account_email = google_service_account.heady_brain_sa.email

  common_labels = local.common_labels
}

# heady-conductor
module "cloud_run_conductor" {
  source = "./modules/cloud-run"

  project_id   = var.project_id
  region       = var.region
  environment  = var.environment
  service_name = "heady-conductor${local.env_suffix}"
  image        = "${var.image_registry}/heady-conductor:${var.image_tag}"

  # fib(3)=2 min, fib(7)=13 max
  min_instances = local.cloud_run_min_instances[var.environment]
  max_instances = local.cloud_run_max_instances[var.environment]

  cpu    = var.cloud_run_cpu
  memory = var.cloud_run_memory

  # φ^6=17944ms → 300s max
  request_timeout = var.cloud_run_request_timeout

  # fib(8)=21 concurrent requests (orchestration is CPU-bound)
  concurrency = 21  # fib(8)=21

  vpc_connector = module.networking.vpc_connector_id
  vpc_egress    = "private-ranges-only"

  env_vars = {
    NODE_ENV               = var.environment
    PHI                    = "1.618033988749895"
    SERVICE_NAME           = "heady-conductor"
    ORCHESTRATION_WORKERS  = "8"       # fib(6)=8
    MAX_CONCURRENT_AGENTS  = "55"      # fib(10)=55
    AGENT_TIMEOUT_MS       = "6854"    # φ^4
    MAX_RETRIES            = "13"      # fib(7)=13
  }

  secret_env_vars = {
    DATABASE_URL = "${var.project_id}/secrets/postgres-url/versions/latest"
    REDIS_URL    = "${var.project_id}/secrets/redis-url/versions/latest"
    JWT_SECRET   = "${var.project_id}/secrets/jwt-rsa-private-key/versions/latest"
  }

  service_account_email = google_service_account.heady_conductor_sa.email
  common_labels         = local.common_labels
}

# heady-mcp
module "cloud_run_mcp" {
  source = "./modules/cloud-run"

  project_id   = var.project_id
  region       = var.region
  environment  = var.environment
  service_name = "heady-mcp${local.env_suffix}"
  image        = "${var.image_registry}/heady-mcp:${var.image_tag}"

  min_instances = local.cloud_run_min_instances[var.environment]
  max_instances = local.cloud_run_max_instances[var.environment]

  cpu    = "1"
  memory = "512Mi"

  request_timeout = var.cloud_run_request_timeout

  # fib(10)=55 concurrent MCP sessions per instance
  concurrency = 55  # fib(10)=55

  vpc_connector = module.networking.vpc_connector_id
  vpc_egress    = "private-ranges-only"

  env_vars = {
    NODE_ENV                    = var.environment
    PHI                         = "1.618033988749895"
    SERVICE_NAME                = "heady-mcp"
    MCP_TOOL_SLOTS              = "13"     # fib(7)=13
    MAX_TOOL_CALLS_PER_SESSION  = "21"     # fib(8)=21
    TOOL_EXECUTION_TIMEOUT_MS   = "4236"   # φ^3
    MAX_ACTIVE_SESSIONS         = "89"     # fib(11)=89
  }

  secret_env_vars = {
    DATABASE_URL   = "${var.project_id}/secrets/postgres-url/versions/latest"
    REDIS_URL      = "${var.project_id}/secrets/redis-url/versions/latest"
    JWT_SECRET     = "${var.project_id}/secrets/jwt-rsa-private-key/versions/latest"
    OPENAI_API_KEY = "${var.project_id}/secrets/openai-api-key/versions/latest"
  }

  service_account_email = google_service_account.heady_mcp_sa.email
  common_labels         = local.common_labels
}

# heady-web
module "cloud_run_web" {
  source = "./modules/cloud-run"

  project_id   = var.project_id
  region       = var.region
  environment  = var.environment
  service_name = "heady-web${local.env_suffix}"
  image        = "${var.image_registry}/heady-web:${var.image_tag}"

  # Web layer: fib(4)=3 min (higher floor), fib(8)=21 max
  min_instances = var.environment == "production" ? 3 : 1   # fib(4)=3
  max_instances = var.environment == "production" ? 21 : 8  # fib(8)=21

  cpu    = "1"
  memory = "512Mi"

  request_timeout = 60  # Web requests should complete in <60s

  # fib(12)=144 concurrent web requests per instance
  concurrency = 144  # fib(12)=144

  vpc_connector = module.networking.vpc_connector_id
  vpc_egress    = "private-ranges-only"

  env_vars = {
    NODE_ENV           = var.environment
    PHI                = "1.618033988749895"
    SERVICE_NAME       = "heady-web"
    RATE_LIMIT_PER_POD = "144"   # fib(12)=144
    STATIC_CACHE_TTL_S = "5340"  # fib(11)=89 × 60s
  }

  secret_env_vars = {
    REDIS_URL     = "${var.project_id}/secrets/redis-url/versions/latest"
    JWT_SECRET    = "${var.project_id}/secrets/jwt-rsa-private-key/versions/latest"
    SESSION_SECRET = "${var.project_id}/secrets/session-secret/versions/latest"
  }

  service_account_email = google_service_account.heady_web_sa.email
  common_labels         = local.common_labels
}

# =============================================================================
# IAM Service Accounts
# =============================================================================

resource "google_service_account" "heady_brain_sa" {
  account_id   = "heady-brain-sa"
  display_name = "HeadySystems Brain Service Account"
  description  = "SA for heady-brain Cloud Run service — φ-governed"
  project      = var.project_id
}

resource "google_service_account" "heady_conductor_sa" {
  account_id   = "heady-conductor-sa"
  display_name = "HeadySystems Conductor Service Account"
  project      = var.project_id
}

resource "google_service_account" "heady_mcp_sa" {
  account_id   = "heady-mcp-sa"
  display_name = "HeadySystems MCP Service Account"
  project      = var.project_id
}

resource "google_service_account" "heady_web_sa" {
  account_id   = "heady-web-sa"
  display_name = "HeadySystems Web Service Account"
  project      = var.project_id
}

# Grant Secret Manager access to service accounts
resource "google_project_iam_member" "brain_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.heady_brain_sa.email}"
}

resource "google_project_iam_member" "conductor_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.heady_conductor_sa.email}"
}

resource "google_project_iam_member" "mcp_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.heady_mcp_sa.email}"
}

resource "google_project_iam_member" "web_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.heady_web_sa.email}"
}

# Cloud SQL client access for brain and conductor
resource "google_project_iam_member" "brain_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.heady_brain_sa.email}"
}

resource "google_project_iam_member" "conductor_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.heady_conductor_sa.email}"
}

# Cloud Trace and Monitoring for all services
resource "google_project_iam_member" "brain_trace" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.heady_brain_sa.email}"
}

resource "google_project_iam_member" "brain_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.heady_brain_sa.email}"
}
