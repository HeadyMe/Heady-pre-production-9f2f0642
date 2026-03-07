provider "google" {
  project = "heady-liquid-architecture"
  region  = "us-central1"
}

resource "google_artifact_registry_repository" "heady_repo" {
  location      = "us-central1"
  repository_id = "heady-docker-repo"
  format        = "DOCKER"
}

resource "google_pubsub_topic" "swarm_tasks" {
  name = "heady-swarm-tasks"
}

resource "google_pubsub_topic" "admin_triggers" {
  name = "heady-admin-triggers"
}

resource "google_cloud_run_service" "swarm_orchestrator" {
  name     = "heady-swarm-orchestrator"
  location = "us-central1"

  template {
    spec {
      containers {
        image = "us-central1-docker.pkg.dev/heady-liquid-architecture/heady-docker-repo/orchestrator:latest"
        resources {
          limits = {
            cpu    = "4000m"
            memory = "4Gi"
          }
        }
      }
    }
  }
}

resource "google_cloud_scheduler_job" "nightly_pruner" {
  name      = "trigger-pruner-swarm"
  schedule  = "0 2 * * *"
  time_zone = "America/Denver"

  pubsub_target {
    topic_name = google_pubsub_topic.swarm_tasks.id
    data       = base64encode("{\"task\":\"prune_unused_projections\"}")
  }
}

resource "google_cloud_scheduler_job" "hourly_tester" {
  name      = "trigger-tester-swarm"
  schedule  = "0 * * * *"
  time_zone = "America/Denver"

  pubsub_target {
    topic_name = google_pubsub_topic.swarm_tasks.id
    data       = base64encode("{\"task\":\"simulate_module_federation_traffic\"}")
  }
}
