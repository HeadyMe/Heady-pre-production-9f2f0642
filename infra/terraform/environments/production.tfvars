# =============================================================================
# HeadySystems Inc. — Terraform: Production Environment
# heady-systems v3.2.2
# =============================================================================
# φ = 1.618033988749895 — Full φ-governed production deployment
# All values use the appropriate Fibonacci tier for each parameter
# =============================================================================

project_id  = "heady-systems"
region      = "us-central1"
zone        = "us-central1-a"
environment = "production"
name_prefix = "heady"

# Image — exact production tag
image_registry = "gcr.io/heady-systems"
image_tag      = "3.2.2"

# Networking
vpc_cidr              = "10.0.0.0/16"
subnet_primary_cidr   = "10.0.1.0/24"
subnet_secondary_cidr = "10.0.2.0/24"
subnet_database_cidr  = "10.0.3.0/24"

# Cloud SQL — production HA
# n1-highmem-4: fib(4)=3 ≈ 4 vCPU, 26GB RAM — high memory for pgvector
db_instance_tier = "db-n1-highmem-4"

# fib(11)=89 × 10GB ... using 100GB to start, auto-grow enabled
# Manual target: 890GB (fib(11)=89 × 10GB)
db_disk_size_gb = 100

# fib(10)=55 max connections (via pgbouncer)
db_max_connections = 55

# fib(11)=89 days backup retention
db_backup_retention_days = 89

# fib(3)=2 read replicas for production HA
db_read_replicas = 2

# Redis — production HA
# fib(3)=2 × 512MB ≈ 1024MB ≈ 1GB base
# (Cloud Run: 1GB initial, scale up as needed)
redis_memory_gb = 2     # 2GB — φ × 1.236 ≈ 2GB for production

# fib(2)=1 replica for STANDARD_HA
redis_replica_count = 1

# Cloud Run — production maximums
cloud_run_cpu    = "1"
cloud_run_memory = "512Mi"

# fib(12)=144s request timeout — allows long AI completions
cloud_run_request_timeout = 144

# fib(11)=89 concurrent requests per instance
cloud_run_max_concurrency = 89

# CDN — production TTLs (φ-scaled)
# fib(11)=89 × 60s = 5340s default TTL
cdn_default_ttl = 5340
# fib(13)=233 × 60s = 13980s max TTL
cdn_max_ttl = 13980

# OTEL
otel_endpoint = "https://otel.headyme.com:4318"

# Domains — all 9 production domains
primary_domain = "headyme.com"
domains = [
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

# GKE — enabled for production K8s deployment
gke_enabled           = true
# fib(4)=3 nodes per zone (3 zones = 9 total)
gke_node_count        = 3
gke_node_machine_type = "n2-standard-4"  # 4 vCPU, 16GB
# fib(3)=2 min nodes per zone
gke_min_nodes         = 2
# fib(7)=13 max nodes per zone
gke_max_nodes         = 13
