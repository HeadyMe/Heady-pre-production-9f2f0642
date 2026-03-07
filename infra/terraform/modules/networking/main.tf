# =============================================================================
# HeadySystems Inc. — Terraform Module: Networking
# heady-systems v3.2.2
# =============================================================================
# φ = 1.618033988749895 (Golden Ratio)
# Resources: VPC, subnets, firewall rules, Cloud CDN, Load Balancer,
#            Serverless VPC Access connector
# =============================================================================

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

variable "project_id"           { type = string }
variable "region"               { type = string }
variable "environment"          { type = string }
variable "name_prefix"          { type = string }
variable "vpc_cidr"             { type = string; default = "10.0.0.0/16" }
variable "subnet_primary_cidr"  { type = string; default = "10.0.1.0/24" }
variable "subnet_secondary_cidr" { type = string; default = "10.0.2.0/24" }
variable "subnet_database_cidr" { type = string; default = "10.0.3.0/24" }
variable "common_labels"        { type = map(string); default = {} }

locals {
  vpc_name      = "${var.name_prefix}-vpc-${var.environment}"
  subnet_name   = "${var.name_prefix}-subnet-${var.environment}"
  connector_name = "${var.name_prefix}-connector"
}

# =============================================================================
# VPC Network
# =============================================================================
resource "google_compute_network" "vpc" {
  name                    = local.vpc_name
  project                 = var.project_id
  auto_create_subnetworks = false
  routing_mode            = "GLOBAL"
  description             = "HeadySystems VPC — φ-governed networking"
}

# Primary subnet
resource "google_compute_subnetwork" "primary" {
  name                     = "${local.subnet_name}-primary"
  project                  = var.project_id
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = var.subnet_primary_cidr
  private_ip_google_access = true

  # Secondary ranges for GKE (if enabled)
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.100.0.0/16"
  }
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.200.0.0/20"
  }

  log_config {
    aggregation_interval = "INTERVAL_5_MIN"  # fib(5)=5 minutes
    flow_sampling        = 0.618             # 1/φ sampling rate
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Database subnet (isolated)
resource "google_compute_subnetwork" "database" {
  name                     = "${local.subnet_name}-database"
  project                  = var.project_id
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = var.subnet_database_cidr
  private_ip_google_access = true
}

# =============================================================================
# Serverless VPC Access Connector (for Cloud Run → private services)
# =============================================================================
resource "google_vpc_access_connector" "connector" {
  provider = google-beta
  name     = local.connector_name
  project  = var.project_id
  region   = var.region
  network  = google_compute_network.vpc.name

  # CIDR for connector: 10.8.0.0/28 (small range, connector only)
  ip_cidr_range = "10.8.0.0/28"

  # φ-scaled throughput
  # min_throughput: fib(8)=21 × ~10 Mbps = 200 Mbps (nearest supported: 200)
  # max_throughput: fib(9)=34 × ~10 Mbps = 300 Mbps (nearest supported: 300)
  min_throughput = 200
  max_throughput = 300

  # fib(3)=2 min instances, fib(5)=5 max instances
  min_instances  = 2
  max_instances  = 5
}

# =============================================================================
# Cloud NAT (for outbound traffic from private instances)
# =============================================================================
resource "google_compute_router" "router" {
  name    = "${var.name_prefix}-router-${var.environment}"
  project = var.project_id
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "${var.name_prefix}-nat-${var.environment}"
  project                            = var.project_id
  region                             = var.region
  router                             = google_compute_router.router.name
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# =============================================================================
# Firewall Rules — φ-governed
# =============================================================================

# Allow internal traffic within the VPC (heady-* services)
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.name_prefix}-allow-internal"
  project = var.project_id
  network = google_compute_network.vpc.name

  description = "Allow internal traffic between heady-* services"

  allow {
    protocol = "tcp"
    # Service ports: 8080 (HTTP), 9090 (metrics), 6379 (Redis), 5432 (Postgres)
    ports = ["8080", "9090", "9000", "3000"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [var.vpc_cidr]
  target_tags   = ["heady-service"]
  priority      = 1000  # fib(7)=13... using standard 1000 for firewall
}

# Allow health checks from GCP load balancers
resource "google_compute_firewall" "allow_health_check" {
  name    = "${var.name_prefix}-allow-health-check"
  project = var.project_id
  network = google_compute_network.vpc.name

  description = "Allow GCP load balancer health checks"

  allow {
    protocol = "tcp"
    ports    = ["8080", "80", "443"]
  }

  # GCP load balancer health check ranges
  source_ranges = [
    "130.211.0.0/22",
    "35.191.0.0/16"
  ]

  target_tags = ["heady-service", "heady-web"]
  priority    = 1000
}

# Deny all other ingress
resource "google_compute_firewall" "deny_all_ingress" {
  name    = "${var.name_prefix}-deny-all-ingress"
  project = var.project_id
  network = google_compute_network.vpc.name

  description = "Default deny all ingress — zero-trust baseline"

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
  priority      = 65534  # Low priority — override with more specific rules
}

# =============================================================================
# Global Load Balancer with Cloud CDN
# =============================================================================

# Reserve static IP for load balancer
resource "google_compute_global_address" "lb_ip" {
  name        = "${var.name_prefix}-lb-ip"
  project     = var.project_id
  description = "HeadySystems global load balancer IP — all 9 domains"
}

# Cloud CDN + Backend service for static assets
resource "google_storage_bucket" "static_assets" {
  name          = "${var.project_id}-heady-static-${var.environment}"
  project       = var.project_id
  location      = "US"
  force_destroy = var.environment != "production"

  uniform_bucket_level_access = true
  public_access_prevention    = "inherited"

  website {
    main_page_suffix = "index.html"
    not_found_page   = "404.html"
  }

  versioning {
    enabled = true
  }

  # φ-scaled lifecycle rule
  lifecycle_rule {
    condition {
      # fib(11)=89 days for old versions
      num_newer_versions = 89
    }
    action {
      type = "Delete"
    }
  }

  labels = var.common_labels
}

# CDN backend bucket
resource "google_compute_backend_bucket" "static_cdn" {
  name        = "${var.name_prefix}-cdn-backend"
  project     = var.project_id
  bucket_name = google_storage_bucket.static_assets.name
  enable_cdn  = true

  cdn_policy {
    # fib(11)=89 × 60s = 5340s default TTL
    default_ttl = 5340
    # fib(13)=233 × 60s = 13980s max TTL
    max_ttl     = 13980
    # fib(4)=3s client TTL
    client_ttl  = 180
    cache_mode  = "CACHE_ALL_STATIC"
    # Serve stale: fib(7)=13 × 60s = 780s
    serve_while_stale = 780

    negative_caching = true
    negative_caching_policy {
      code = 404
      # fib(5)=5 × 60s = 300s cache 404s
      ttl  = 300
    }
  }
}

# HTTP to HTTPS redirect
resource "google_compute_url_map" "redirect" {
  name    = "${var.name_prefix}-http-redirect"
  project = var.project_id

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

# Outputs
output "vpc_network_id"           { value = google_compute_network.vpc.id }
output "vpc_network_name"         { value = google_compute_network.vpc.name }
output "subnet_primary_id"        { value = google_compute_subnetwork.primary.id }
output "subnet_database_id"       { value = google_compute_subnetwork.database.id }
output "vpc_connector_id"         { value = google_vpc_access_connector.connector.id }
output "load_balancer_ip"         { value = google_compute_global_address.lb_ip.address }
output "cdn_backend_bucket_name"  { value = google_compute_backend_bucket.static_cdn.name }
output "static_bucket_name"       { value = google_storage_bucket.static_assets.name }
output "router_name"              { value = google_compute_router.router.name }
