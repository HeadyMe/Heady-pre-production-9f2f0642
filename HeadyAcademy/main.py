#!/usr/bin/env python3
"""
FastAPI Main Entry Point for Python Worker
Integrates Socratic Dialogue and AI Tools
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import redis
import json
import asyncio
from datetime import datetime
import uuid

app = FastAPI(title="Heady Python Worker", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://headyme.com", "https://headyme.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis connection
try:
    redis_client = redis.Redis(host='redis', port=6379, decode_responses=True)
except:
    redis_client = None

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "heady-python-worker",
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Heady Python Worker",
        "status": "running",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/socratic/dialogue")
async def socratic_dialogue(request: dict):
    """Process Socratic dialogue request"""
    try:
        # Import SocraticDialogue
        import sys
        sys.path.append('/app/academy/Tools')
        from SocraticDialogue import SOFRATES
        
        query = request.get("query", "")
        mode = request.get("mode", "exploratory")
        
        # Initialize SOFRATES
        sof = SOFRATES()
        
        # Process dialogue
        result = await sof.process_query(query, mode)
        
        return {
            "success": True,
            "result": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@app.post("/ai/execute")
async def ai_execute(request: dict):
    """Execute AI task"""
    try:
        task_type = request.get("task_type", "")
        parameters = request.get("parameters", {})
        
        # Cache result in Redis if available
        if redis_client:
            cache_key = f"ai_task:{task_type}:{hash(str(parameters))}"
            cached_result = redis_client.get(cache_key)
            if cached_result:
                return json.loads(cached_result)
        
        # Process task based on type
        result = {
            "task_type": task_type,
            "status": "completed",
            "result": f"Processed {task_type} with parameters {parameters}",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Cache result
        if redis_client:
            redis_client.setex(cache_key, 3600, json.dumps(result))
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="manager.headyme.com", port=5000)
