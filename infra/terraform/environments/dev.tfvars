# =============================================================================
# HeadySystems Inc. — Terraform: Dev Environment
# heady-systems v3.2.2
# =============================================================================
# φ = 1.618033988749895 — Fibonacci-scaled dev sizing
# Dev uses minimum Fibonacci values for cost efficiency
# =============================================================================

project_id  = "heady-systems-dev"
region      = "us-central1"
zone        = "us-central1-a"
environment = "dev"
name_prefix = "heady"

# Image
image_registry = "gcr.io/heady-systems"
image_tag      = "3.2.2-dev"

# Networking
vpc_cidr              = "10.0.0.0/16"
subnet_primary_cidr   = "10.0.1.0/24"
subnet_secondary_cidr = "10.0.2.0/24"
subnet_database_cidr  = "10.0.3.0/24"

# Cloud SQL — minimal dev tier
# fib(1)=1 × cores: db-f1-micro (dev only)
db_instance_tier         = "db-f1-micro"
# fib(5)=5 × 10GB = 50GB (minimal)
db_disk_size_gb          = 10    # fib(1)=1 × 10GB
db_max_connections       = 13    # fib(7)=13 (fewer than production fib(10)=55)
db_backup_retention_days = 8     # fib(6)=8 days (shorter than production fib(11)=89)
db_read_replicas         = 0     # No replicas in dev

# Redis — minimal
redis_memory_gb    = 1     # fib(2)=1 GB
redis_replica_count = 0    # No HA in dev

# Cloud Run — scale to zero in dev
cloud_run_cpu              = "1"
cloud_run_memory           = "256Mi"   # half production
cloud_run_request_timeout  = 89        # fib(11)=89s (shorter than prod fib(12)=144)
cloud_run_max_concurrency  = 13        # fib(7)=13 (less than prod fib(11)=89)

# CDN — reduced TTLs for dev iteration speed
cdn_default_ttl = 8     # fib(6)=8 seconds (very short for dev)
cdn_max_ttl     = 21    # fib(8)=21 seconds

# OTEL
otel_endpoint = "http://localhost:4318"

# Domains — dev subdomains
primary_domain = "dev.headyme.com"
domains = [
  "dev.headyme.com",
  "dev.headyconnection.com"
]

# GKE — disabled in dev (use Cloud Run)
gke_enabled          = false
gke_node_count       = 1     # fib(2)=1 (unused)
gke_node_machine_type = "n1-standard-2"
gke_min_nodes        = 1
gke_max_nodes        = 3     # fib(4)=3
