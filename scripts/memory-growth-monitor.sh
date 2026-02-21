#!/bin/bash
# Memory Growth Monitor - Ensures continuous memory growth

MEMORY_LOCATIONS=(
    "/home/headyme/HeadyApps/Heady/.heady/memory-cache.json"
    "/home/headyme/HeadyLocal/services/Heady/.heady/memory-cache.json"
)

LOG_FILE="/home/headyme/.headyme/logs/memory-growth.log"

monitor_memory_growth() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    for location in "${MEMORY_LOCATIONS[@]}"; do
        if [ -f "$location" ]; then
            local count=$(jq -r '.memories.total' "$location" 2>/dev/null || echo "0")
            local growth_enabled=$(jq -r '.memories.growth_enabled' "$location" 2>/dev/null || echo "false")
            
            echo "[$timestamp] Memory Monitor - Location: $location, Count: $count, Growth: $growth_enabled" >> "$LOG_FILE"
            
            # Alert if growth is disabled or count is stuck
            if [ "$growth_enabled" = "false" ] || [ "$count" = "150" ]; then
                echo "[$timestamp] ALERT: Memory growth issue detected!" >> "$LOG_FILE"
                # Trigger automatic fix
                /home/headyme/CascadeProjects/Heady/scripts/fix-memory-system-asap.sh
            fi
        fi
    done
}

# Run monitoring every 5 minutes
while true; do
    monitor_memory_growth
    sleep 300
done
