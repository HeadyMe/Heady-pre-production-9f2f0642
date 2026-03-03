# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/usr/bin/env python3
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: scripts/ops/profile_node.py                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

"""
HeadySystems Node Profile Detection
Detects whether the current node is Desktop (Heavy Compute) or Laptop (Mobile Efficiency)
"""

import os
import sys
import json
import platform
import psutil
from pathlib import Path

def get_project_root():
    """Find the project root directory"""
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / 'PROJECT_STATE.json').exists():
            return parent
    return Path.cwd()

def detect_node_profile():
    """Detect node characteristics and classify as Desktop or Laptop"""
    
    # Get system information
    cpu_count = psutil.cpu_count(logical=False)  # Physical cores
    total_ram_gb = psutil.virtual_memory().total / (1024**3)
    
    # Check if on battery (laptop indicator)
    battery = psutil.sensors_battery()
    has_battery = battery is not None
    
    # Determine node type
    if has_battery:
        node_type = "laptop"
        compute_tier = "mobile_efficiency"
    elif cpu_count >= 8 and total_ram_gb >= 32:
        node_type = "desktop"
        compute_tier = "heavy_compute"
    elif cpu_count >= 6 and total_ram_gb >= 16:
        node_type = "workstation"
        compute_tier = "balanced"
    else:
        node_type = "light"
        compute_tier = "efficiency"
    
    profile = {
        "type": node_type,
        "compute_tier": compute_tier,
        "specs": {
            "cpu_cores": cpu_count,
            "ram_gb": round(total_ram_gb, 2),
            "has_battery": has_battery,
            "platform": platform.system(),
            "machine": platform.machine()
        },
        "recommendations": get_recommendations(compute_tier)
    }
    
    return profile

def get_recommendations(compute_tier):
    """Get optimization recommendations based on compute tier"""
    recommendations = {
        "heavy_compute": {
            "parallel_tasks": 8,
            "cache_size_mb": 2048,
            "enable_ml_optimization": True,
            "worker_processes": 4
        },
        "balanced": {
            "parallel_tasks": 4,
            "cache_size_mb": 1024,
            "enable_ml_optimization": True,
            "worker_processes": 2
        },
        "mobile_efficiency": {
            "parallel_tasks": 2,
            "cache_size_mb": 512,
            "enable_ml_optimization": False,
            "worker_processes": 1
        },
        "efficiency": {
            "parallel_tasks": 2,
            "cache_size_mb": 256,
            "enable_ml_optimization": False,
            "worker_processes": 1
        }
    }
    
    return recommendations.get(compute_tier, recommendations["efficiency"])

def update_project_state(profile):
    """Update PROJECT_STATE.json with node profile"""
    project_root = get_project_root()
    state_file = project_root / 'PROJECT_STATE.json'
    
    if not state_file.exists():
        print(f"⚠️  PROJECT_STATE.json not found at {state_file}", file=sys.stderr)
        return False
    
    try:
        with open(state_file, 'r', encoding='utf-8') as f:
            state = json.load(f)
        
        # Update node profile
        from datetime import datetime
        state['node_profile'] = profile
        state['node_profile']['last_detected'] = datetime.utcnow().isoformat() + 'Z'
        
        with open(state_file, 'w', encoding='utf-8') as f:
            json.dump(state, f, indent=2)
        
        return True
    except Exception as e:
        print(f"❌ Error updating PROJECT_STATE.json: {e}", file=sys.stderr)
        return False

def main():
    """Main execution"""
    print("🔍 Detecting node profile...")
    
    profile = detect_node_profile()
    
    print(f"\n📊 Node Profile:")
    print(f"   Type: {profile['type'].upper()}")
    print(f"   Compute Tier: {profile['compute_tier']}")
    print(f"   CPU Cores: {profile['specs']['cpu_cores']}")
    print(f"   RAM: {profile['specs']['ram_gb']} GB")
    print(f"   Platform: {profile['specs']['platform']}")
    
    print(f"\n⚙️  Recommendations:")
    for key, value in profile['recommendations'].items():
        print(f"   {key}: {value}")
    
    # Update PROJECT_STATE.json
    if update_project_state(profile):
        print(f"\n✅ PROJECT_STATE.json updated successfully")
    else:
        print(f"\n⚠️  Could not update PROJECT_STATE.json")
    
    # Return profile as JSON for programmatic use
    return profile

if __name__ == "__main__":
    profile = main()
    sys.exit(0)
