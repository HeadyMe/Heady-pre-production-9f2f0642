# =============================================================================
# HeadySystems Inc. — Terraform: Staging Environment
# heady-systems v3.2.2
# =============================================================================
# φ = 1.618033988749895 — Fibonacci-scaled staging sizing
# Staging uses n-1 Fibonacci values below production
# =============================================================================

project_id  = "heady-systems-staging"
region      = "us-central1"
zone        = "us-central1-b"
environment = "staging"
name_prefix = "heady"

# Image
image_registry = "gcr.io/heady-systems"
image_tag      = "3.2.2-rc"

# Networking
vpc_cidr              = "10.10.0.0/16"
subnet_primary_cidr   = "10.10.1.0/24"
subnet_secondary_cidr = "10.10.2.0/24"
subnet_database_cidr  = "10.10.3.0/24"

# Cloud SQL — staging tier
# n1-standard-2: fib(3)=2 vCPU
db_instance_tier         = "db-n1-standard-2"
# fib(8)=21 × 10GB = 210GB
db_disk_size_gb          = 50    # fib(10)=55 ≈ 50GB
db_max_connections       = 34    # fib(9)=34
# fib(8)=21 days backup retention (production: fib(11)=89)
db_backup_retention_days = 21
# fib(2)=1 read replica for staging
db_read_replicas         = 1

# Redis — HA in staging to mirror production
# fib(2)=1 GB (half production)
redis_memory_gb    = 1
redis_replica_count = 1    # fib(2)=1 — HA enabled in staging for accurate testing

# Cloud Run — fib(6)=8 max (one step below production fib(7)=13)
cloud_run_cpu              = "1"
cloud_run_memory           = "512Mi"
# fib(11)=89s timeout (one step below production fib(12)=144)
cloud_run_request_timeout  = 89
# fib(10)=55 concurrency (one step below production fib(11)=89)
cloud_run_max_concurrency  = 55

# CDN — shorter TTLs for staging (enable cache busting)
# fib(9)=34 × 60s = 2040s default TTL (shorter than production fib(11)=89 × 60s)
cdn_default_ttl = 2040
# fib(10)=55 × 60s = 3300s max TTL
cdn_max_ttl     = 3300

# OTEL
otel_endpoint = "https://otel-staging.headyme.com:4318"

# Domains — staging subdomains
primary_domain = "staging.headyme.com"
domains = [
  "staging.headyme.com",
  "staging.headyconnection.com",
  "staging.headysystems.com"
]

# GKE — optional in staging
gke_enabled           = false
gke_node_count        = 2     # fib(3)=2
gke_node_machine_type = "n1-standard-2"
gke_min_nodes         = 1     # fib(2)=1
gke_max_nodes         = 8     # fib(6)=8 (one step below production fib(7)=13)
