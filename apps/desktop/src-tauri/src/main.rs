// HeadyWeb Desktop — Tauri v2 Backend
// Sacred Geometry AI Browser
//
// This is the Rust backend that provides:
// - Tab management commands
// - Ad/tracker blocking via DNS rules
// - Heady Manager API proxy
// - System tray integration

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri::Manager;

// ── Tab Data ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Tab {
    id: String,
    url: String,
    title: String,
    is_active: bool,
}

// ── Tauri Commands ──────────────────────────────────────────────────────

#[tauri::command]
async fn check_heady_health(api_url: String) -> Result<bool, String> {
    let url = format!("{}/api/health", api_url);
    match reqwest::get(&url).await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(e) => Err(format!("Health check failed: {}", e)),
    }
}

#[tauri::command]
async fn ask_heady(message: String, api_url: String) -> Result<String, String> {
    let url = format!("{}/api/buddy/chat", api_url);
    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "message": message,
        "history": []
    });

    match client.post(&url).json(&body).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
                let reply = data["reply"]
                    .as_str()
                    .or(data["message"].as_str())
                    .unwrap_or("I'm here to help!");
                Ok(reply.to_string())
            } else {
                Err(format!("API returned status {}", resp.status()))
            }
        }
        Err(e) => Err(format!("Request failed: {}", e)),
    }
}

#[tauri::command]
fn is_blocked_url(url: String) -> bool {
    // Basic ad/tracker blocking via domain matching
    let blocked_domains = [
        "doubleclick.net",
        "googlesyndication.com",
        "googleadservices.com",
        "facebook.com/tr",
        "analytics.google.com",
        "pixel.facebook.com",
        "ads.twitter.com",
        "amazon-adsystem.com",
        "adnxs.com",
        "criteo.com",
        "outbrain.com",
        "taboola.com",
        "scorecardresearch.com",
        "quantserve.com",
        "adsrvr.org",
        "rubiconproject.com",
    ];

    let url_lower = url.to_lowercase();
    blocked_domains.iter().any(|domain| url_lower.contains(domain))
}

// ── Main ────────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            check_heady_health,
            ask_heady,
            is_blocked_url,
        ])
        .setup(|app| {
            // Future: system tray setup
            // let _tray = app.tray_by_id("main").unwrap();
            println!("HeadyWeb Desktop started — Sacred Geometry Architecture");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running HeadyWeb Desktop");
}
