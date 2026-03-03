# HeadyMe Anycast IP Cloudflare Terraform Configuration
# Purpose: Broadcasts HeadyMe globally via BGP for ultra-low latency

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "The Zone ID for HeadySystems.com"
  type        = string
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# In a true Enterprise Cloudflare setup, you'd use Spectrum or Magic Transit 
# for raw TCP Anycast routing. Here we configure standard DNS and Spectrum Anycast.

resource "cloudflare_spectrum_application" "headyme_anycast" {
  zone_id      = var.cloudflare_zone_id
  protocol     = "tcp/8443"
  dns {
    type = "CNAME"
    name = "admin.headysystems.com"
  }
  
  origin_direct = [
    "tcp://primary-datacenter.headysystems.internal:8443",
    "tcp://secondary-datacenter.headysystems.internal:8443"
  ]
  
  edge_ips {
    type = "dynamic"
    connectivity = "all"
  }
  
  # TLS enforcement is handled by our mtls_terminator.go
  tls = "off"
}

output "anycast_dns_name" {
  value = cloudflare_spectrum_application.headyme_anycast.dns[0].name
  description = "The Global Anycast endpoint for HeadyMe Edge Connectivity"
}
