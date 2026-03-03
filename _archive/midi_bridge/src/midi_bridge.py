#!/usr/bin/env python3
"""
HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HeadySync MIDI Bridge - Physical System Administration           ║
║  "Turn system administration into a musical performance"         ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END
"""

import asyncio
import json
import logging
import os
from typing import Dict, Optional

import docker
import mido
from fastapi import FastAPI
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="HeadySync MIDI Bridge", version="1.0.0")

class HeadyMIDIController:
    """Maps MIDI events to system administration actions"""
    
    def __init__(self):
        self.docker_client = docker.from_env()
        self.midi_input = None
        self.midi_output = None
        self.active_containers = {}
        
        # MIDI to Action Mapping
        self.action_map = {
            # Novation Launchkey MK4 mappings
            'C4': self.deploy_production,
            'D4': self.deploy_staging,
            'E4': self.restart_oracle,
            'F4': self.restart_grafana,
            'G4': self.scale_oracle,
            'A4': self.backup_data,
            'B4': self.system_health,
            
            # Pyle Drum Kit mappings
            'crash_cymbal': self.emergency_stop,
            'kick_drum': self.start_all_services,
            'snare': self.restart_all_services,
            'hi_tom': self.scale_up_services,
            'mid_tom': self.scale_down_services,
            'low_tom': self.rotate_logs,
            'hi_hat': self.toggle_maintenance_mode,
            'ride_cymbal': self.generate_report,
            
            # Continuous controllers (knobs/sliders)
            'CC1': self.adjust_ai_temperature,
            'CC2': self.adjust_verification_threshold,
            'CC3': self.adjust_backoff_rate,
        }
        
    async def initialize(self):
        """Initialize MIDI connections"""
        try:
            # Find MIDI devices
            midi_inputs = mido.get_input_names()
            midi_outputs = mido.get_output_names()
            
            logger.info(f"Available MIDI inputs: {midi_inputs}")
            logger.info(f"Available MIDI outputs: {midi_outputs}")
            
            # Try to connect to common devices
            for device_name in midi_inputs:
                if any(keyword in device_name.lower() for keyword in ['launchkey', 'novation', 'pyle', 'midi']):
                    self.midi_input = mido.open_input(device_name)
                    logger.info(f"Connected to MIDI input: {device_name}")
                    break
            
            for device_name in midi_outputs:
                if any(keyword in device_name.lower() for keyword in ['launchkey', 'novation', 'pyle', 'midi']):
                    self.midi_output = mido.open_output(device_name)
                    logger.info(f"Connected to MIDI output: {device_name}")
                    break
            
            if self.midi_input:
                # Start listening for MIDI messages
                asyncio.create_task(self._listen_for_midi())
            else:
                logger.warning("No MIDI input device found - running in simulation mode")
                
        except Exception as e:
            logger.error(f"Error initializing MIDI: {e}")
    
    async def _listen_for_midi(self):
        """Listen for MIDI messages and trigger actions"""
        while True:
            try:
                for msg in self.midi_input.iter_pending():
                    await self._process_midi_message(msg)
                await asyncio.sleep(0.01)  # Small delay to prevent CPU spinning
            except Exception as e:
                logger.error(f"Error processing MIDI message: {e}")
                await asyncio.sleep(1)
    
    async def _process_midi_message(self, msg):
        """Process individual MIDI message"""
        try:
            if msg.type == 'note_on' and msg.velocity > 0:
                note_name = midi.note_number_to_name(msg.note)
                logger.info(f"MIDI Note ON: {note_name} (velocity: {msg.velocity})")
                
                if note_name in self.action_map:
                    await self.action_map[note_name]()
                    self._send_feedback(msg.note, msg.velocity)
                    
            elif msg.type == 'control_change':
                controller_name = f"CC{msg.control}"
                logger.info(f"MIDI CC: {controller_name} (value: {msg.value})")
                
                if controller_name in self.action_map:
                    await self.action_map[controller_name](msg.value)
                    
        except Exception as e:
            logger.error(f"Error processing MIDI message {msg}: {e}")
    
    def _send_feedback(self, note: int, velocity: int):
        """Send visual feedback via MIDI output"""
        if self.midi_output:
            try:
                # Send note back with different velocity for visual feedback
                self.midi_output.send(mido.Message('note_on', note=note, velocity=min(velocity + 20, 127)))
                asyncio.create_task(asyncio.sleep(0.1))
                self.midi_output.send(mido.Message('note_off', note=note))
            except Exception as e:
                logger.error(f"Error sending MIDI feedback: {e}")
    
    # Action implementations
    async def deploy_production(self):
        """Deploy to production (C4 on Launchkey)"""
        logger.info("🚀 DEPLOYING TO PRODUCTION")
        try:
            # Pull latest and restart services
            await self._docker_compose('pull')
            await self._docker_compose('up -d')
            await self._notify_success("Production deployment complete")
        except Exception as e:
            await self._notify_error(f"Production deployment failed: {e}")
    
    async def emergency_stop(self):
        """Emergency stop all services (Crash Cymbal)"""
        logger.info("🛑 EMERGENCY STOP ACTIVATED")
        try:
            await self._docker_compose('down')
            await self._notify_success("All services stopped")
        except Exception as e:
            await self._notify_error(f"Emergency stop failed: {e}")
    
    async def restart_oracle(self):
        """Restart Heady Oracle service"""
        logger.info("🔄 RESTARTING HEADY ORACLE")
        try:
            container = self.docker_client.containers.get('heady_oracle')
            container.restart()
            await self._notify_success("Oracle restarted")
        except Exception as e:
            await self._notify_error(f"Oracle restart failed: {e}")
    
    async def adjust_ai_temperature(self, value: int):
        """Adjust AI model temperature (CC1 knob)"""
        # Map MIDI value (0-127) to temperature (0.1-2.0)
        temperature = 0.1 + (value / 127.0) * 1.9
        logger.info(f"🌡️ Adjusting AI temperature to {temperature:.2f}")
        
        # TODO: Update environment variable in oracle container
        await self._update_env_var('heady_oracle', 'AI_TEMPERATURE', str(temperature))
    
    async def system_health(self):
        """Generate system health report (B4 on Launchkey)"""
        logger.info("📊 GENERATING SYSTEM HEALTH REPORT")
        try:
            health_status = {}
            
            # Check all Heady containers
            containers = ['heady_mqtt', 'heady_vault', 'heady_oracle', 'heady_viz', 'heady_auditor']
            
            for container_name in containers:
                try:
                    container = self.docker_client.containers.get(container_name)
                    health_status[container_name] = {
                        'status': container.status,
                        'health': container.attrs.get('State', {}).get('Health', {}).get('Status', 'unknown')
                    }
                except Exception as e:
                    health_status[container_name] = {'status': 'error', 'error': str(e)}
            
            # Log and store report
            report = {
                'timestamp': asyncio.get_event_loop().time(),
                'health': health_status
            }
            
            logger.info(f"Health Report: {json.dumps(report, indent=2)}")
            await self._notify_success("Health report generated")
            
        except Exception as e:
            await self._notify_error(f"Health report failed: {e}")
    
    async def _docker_compose(self, command: str):
        """Execute docker-compose command"""
        # TODO: Implement actual docker-compose execution
        logger.info(f"Executing: docker-compose {command}")
    
    async def _update_env_var(self, container_name: str, key: str, value: str):
        """Update environment variable in container"""
        # TODO: Implement environment variable update
        logger.info(f"Updating {container_name}: {key}={value}")
    
    async def _notify_success(self, message: str):
        """Send success notification"""
        logger.info(f"✅ {message}")
        # TODO: Send to notification system
    
    async def _notify_error(self, message: str):
        """Send error notification"""
        logger.error(f"❌ {message}")
        # TODO: Send to notification system

# Global MIDI controller instance
midi_controller = HeadyMIDIController()

@app.on_event("startup")
async def startup_event():
    """Initialize MIDI bridge on startup"""
    await midi_controller.initialize()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "midi_input": midi_controller.midi_input is not None,
        "midi_output": midi_controller.midi_output is not None,
        "service": "HeadySync MIDI Bridge",
        "version": "1.0.0"
    }

@app.get("/mappings")
async def get_mappings():
    """Get current MIDI to action mappings"""
    return {
        "action_map": {k: v.__name__ for k, v in midi_controller.action_map.items()},
        "total_mappings": len(midi_controller.action_map)
    }

@app.post("/simulate/{action}")
async def simulate_midi_action(action: str):
    """Simulate MIDI action for testing"""
    if action in midi_controller.action_map:
        await midi_controller.action_map[action]()
        return {"message": f"Executed {action}"}
    else:
        return {"error": f"Unknown action: {action}"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8081)
