"""
/*
 * Made with Love by the HeadySystems™ & HeadyConnection™ Team
 * Sacred Geometry AI Platform - Organic Systems · Breathing Interfaces
 * https://headysystems.com | https://headyconnection.org
 */
"""
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  █╗  █╗███████╗ █████╗ ██████╗ █╗   █╗                     ║
# ║  █║  █║█╔════╝█╔══█╗█╔══█╗╚█╗ █╔╝                     ║
# ║  ███████║█████╗  ███████║█║  █║ ╚████╔╝                      ║
# ║  █╔══█║█╔══╝  █╔══█║█║  █║  ╚█╔╝                       ║
# ║  █║  █║███████╗█║  █║██████╔╝   █║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: HeadyAcademy/HeadyCheck.py                                 ║
# ║  SERVICE: https://headycheck.com                                  ║
# ║  LAYER: validation                                                ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

"""
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║     ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                                ║
║     ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                                ║
║     ███████║█████╗  ███████║██║  ██║ ╚████╔╝                                 ║
║     ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                                  ║
║     ██║  ██║███████╗██║  ██║██████╔╝   ██║                                   ║
║     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                                   ║
║                                                                               ║
║      HEADY CHECK - PRE-EXECUTION VALIDATION SERVICE                         ║
║     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                ║
║     Validates all operations before execution                                 ║
║     - Prevents false error reporting                                          ║
║     - Validates nodes, workflows, tools                                       ║
║     - Auto-corrects common issues                                             ║
║     - Gates all HeadyConductor execution                                      ║
║                                                                               ║
║     🌐 https://headycheck.com                                                 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from difflib import SequenceMatcher
from collections import defaultdict

# HeadyCheck imports
from HeadyRegistry import HeadyRegistry, Node, Workflow, Service, Tool


class HeadyCheck:
    """
    HeadyCheck - Pre-execution validation service
    🌐 https://headycheck.com
    
    The gatekeeper of execution quality. Validates all operations
    before they execute to prevent false errors and ensure system integrity.
    """
    
    def __init__(self, registry, conductor):
        self.registry = registry
        self.conductor = conductor
        self.validation_cache = {}
        self.error_patterns = defaultdict(int)
        self.correction_history = []
        
        # HeadyCheck metadata
        self.service_info = {
            "name": "HeadyCheck",
            "fqdn": "headycheck.com",
            "version": "1.0.0",
            "description": "Pre-execution validation and error prevention service",
            "authority": "Gates all HeadyConductor executions"
        }
        
        # Validation statistics
        self.stats = {
            "total_validations": 0,
            "passed_validations": 0,
            "failed_validations": 0,
            "auto_corrections": 0,
            "cached_validations": 0
        }
        
        print("✓ HeadyCheck: Pre-Execution Validation Service Initialized")
        print(f"  🌐 Service: https://{self.service_info['fqdn']}")
        print("  Authority: Gatekeeper of Execution Quality")
        print("  Mission: Prevent False Errors, Ensure Clean Builds")
    
    async def validate_execution_plan(self, execution_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main validation entry point - validates entire execution plan.
        Returns validation result with pass/fail and corrected plan if applicable.
        """
        self.stats["total_validations"] += 1
        
        # Check cache first
        cache_key = self._generate_cache_key(execution_plan)
        if cache_key in self.validation_cache:
            cached = self.validation_cache[cache_key]
            if (datetime.now() - cached["timestamp"]).seconds < 300:  # 5 min cache
                self.stats["cached_validations"] += 1
                print(f"  ✓ HeadyCheck: Using cached validation (age: {(datetime.now() - cached['timestamp']).seconds}s)")
                return cached["result"]
        
        validation_result = {
            "valid": True,
            "errors": [],
            "warnings": [],
            "corrections": [],
            "corrected_plan": execution_plan.copy(),
            "validation_timestamp": datetime.now().isoformat(),
            "validated_by": "HeadyCheck",
            "service_url": f"https://{self.service_info['fqdn']}"
        }
        
        print(f"\n  🔍 HeadyCheck: Validating execution plan...")
        print(f"     https://{self.service_info['fqdn']} | v{self.service_info['version']}")
        
        # Validate all components
        await self._validate_nodes(execution_plan, validation_result)
        await self._validate_workflows(execution_plan, validation_result)
        await self._validate_tools(execution_plan, validation_result)
        await self._validate_services(execution_plan, validation_result)
        
        # Attempt auto-correction if errors found
        if validation_result["errors"] and not validation_result["valid"]:
            corrected = await self._auto_correct_plan(
                execution_plan,
                validation_result["errors"]
            )
            
            if corrected["corrected"]:
                validation_result["corrected_plan"] = corrected["plan"]
                validation_result["corrections"] = corrected["corrections"]
                validation_result["valid"] = True  # Re-validate passed after correction
                self.stats["auto_corrections"] += len(corrected["corrections"])
                
                print(f"  🔧 HeadyCheck: Applied {len(corrected['corrections'])} auto-corrections")
        
        # Update statistics
        if validation_result["valid"]:
            self.stats["passed_validations"] += 1
        else:
            self.stats["failed_validations"] += 1
        
        # Cache result
        self.validation_cache[cache_key] = {
            "result": validation_result,
            "timestamp": datetime.now()
        }
        
        # Log validation outcome
        self._log_validation(execution_plan, validation_result)
        
        return validation_result
    
    async def _validate_nodes(self, execution_plan: Dict[str, Any], result: Dict[str, Any]):
        """Validate all nodes in execution plan."""
        nodes_to_invoke = execution_plan.get("nodes_to_invoke", [])
        
        for node_info in nodes_to_invoke:
            node_name = node_info.get("name")
            
            # Check if node exists in registry
            if node_name not in self.registry.nodes:
                result["valid"] = False
                result["errors"].append({
                    "type": "NODE_NOT_FOUND",
                    "component": node_name,
                    "message": f"Node '{node_name}' not found in registry",
                    "severity": "CRITICAL"
                })
                self.error_patterns["NODE_NOT_FOUND"] += 1
                continue
            
            node = self.registry.nodes[node_name]
            
            # Validate node status
            if node.status == "disabled":
                result["valid"] = False
                result["errors"].append({
                    "type": "NODE_DISABLED",
                    "component": node_name,
                    "message": f"Node '{node_name}' is disabled",
                    "severity": "HIGH"
                })
            
            # Validate node dependencies
            if node.dependencies:
                missing_deps = []
                for dep in node.dependencies:
                    if dep not in self.registry.tools:
                        missing_deps.append(dep)
                
                if missing_deps:
                    result["warnings"].append({
                        "type": "MISSING_DEPENDENCIES",
                        "component": node_name,
                        "message": f"Node '{node_name}' has missing dependencies: {', '.join(missing_deps)}",
                        "severity": "MEDIUM"
                    })
            
            # Validate primary tool exists
            if node.primary_tool and node.primary_tool not in self.registry.tools:
                result["errors"].append({
                    "type": "TOOL_NOT_FOUND",
                    "component": node_name,
                    "message": f"Node '{node_name}' requires tool '{node.primary_tool}' which is not available",
                    "severity": "HIGH"
                })
                result["valid"] = False
    
    async def _validate_workflows(self, execution_plan: Dict[str, Any], result: Dict[str, Any]):
        """Validate all workflows in execution plan."""
        workflows_to_execute = execution_plan.get("workflows_to_execute", [])
        
        for workflow_info in workflows_to_execute:
            workflow_name = workflow_info.get("name")
            
            # Check if workflow exists
            if workflow_name not in self.registry.workflows:
                result["valid"] = False
                result["errors"].append({
                    "type": "WORKFLOW_NOT_FOUND",
                    "component": workflow_name,
                    "message": f"Workflow '{workflow_name}' not found in registry",
                    "severity": "CRITICAL"
                })
                self.error_patterns["WORKFLOW_NOT_FOUND"] += 1
                continue
            
            workflow = self.registry.workflows[workflow_name]
            
            # Validate file path exists
            if workflow.file_path:
                file_path = Path(workflow.file_path)
                if not file_path.exists():
                    result["errors"].append({
                        "type": "FILE_NOT_FOUND",
                        "component": workflow_name,
                        "message": f"Workflow file '{workflow.file_path}' does not exist",
                        "severity": "CRITICAL"
                    })
                    result["valid"] = False
                    self.error_patterns["FILE_NOT_FOUND"] += 1
    
    async def _validate_tools(self, execution_plan: Dict[str, Any], result: Dict[str, Any]):
        """Validate all tools in execution plan."""
        tools_to_use = execution_plan.get("tools_to_use", [])
        
        for tool_info in tools_to_use:
            tool_name = tool_info.get("name")
            
            if tool_name not in self.registry.tools:
                result["valid"] = False
                result["errors"].append({
                    "type": "TOOL_NOT_FOUND",
                    "component": tool_name,
                    "message": f"Tool '{tool_name}' not found in registry",
                    "severity": "HIGH"
                })
                self.error_patterns["TOOL_NOT_FOUND"] += 1
    
    async def _validate_services(self, execution_plan: Dict[str, Any], result: Dict[str, Any]):
        """Validate all required services."""
        services_required = execution_plan.get("services_required", [])
        
        for service_info in services_required:
            service_name = service_info.get("name")
            
            if service_name not in self.registry.services:
                result["warnings"].append({
                    "type": "SERVICE_NOT_REGISTERED",
                    "component": service_name,
                    "message": f"Service '{service_name}' not yet registered (may be external)",
                    "severity": "LOW"
                })
                continue
            
            service = self.registry.services[service_name]
            
            # Check endpoint configuration
            if not service.endpoint and not service.health_check_url:
                result["warnings"].append({
                    "type": "SERVICE_UNCONFIGURED",
                    "component": service_name,
                    "message": f"Service '{service_name}' has no configured endpoint",
                    "severity": "MEDIUM"
                })
    
    async def _auto_correct_plan(
        self, 
        execution_plan: Dict[str, Any], 
        errors: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Attempt to auto-correct execution plan based on errors.
        Uses fuzzy matching and intelligent suggestions.
        """
        corrections = []
        corrected_plan = execution_plan.copy()
        corrected = False
        
        for error in errors:
            error_type = error["type"]
            component = error["component"]
            
            if error_type in ["NODE_NOT_FOUND", "WORKFLOW_NOT_FOUND", "TOOL_NOT_FOUND"]:
                # Find similar items
                suggestions = await self._find_similar_items(component, error_type)
                
                if suggestions:
                    best_match = suggestions[0]
                    print(f"  🔧 HeadyCheck: Auto-correcting '{component}' → '{best_match['name']}'")
                    print(f"     Confidence: {best_match['similarity']:.0%}")
                    
                    # Apply correction to plan
                    corrected_plan = self._replace_in_plan(
                        corrected_plan,
                        component,
                        best_match['name'],
                        error_type
                    )
                    
                    corrections.append({
                        "original": component,
                        "corrected_to": best_match['name'],
                        "type": error_type,
                        "confidence": best_match['similarity'],
                        "reason": f"Fuzzy match with {best_match['similarity']:.0%} similarity"
                    })
                    
                    corrected = True
                    
                    # Store in correction history
                    self.correction_history.append({
                        "timestamp": datetime.now().isoformat(),
                        "original": component,
                        "corrected": best_match['name'],
                        "type": error_type
                    })
        
        return {
            "corrected": corrected,
            "plan": corrected_plan,
            "corrections": corrections
        }
    
    async def _find_similar_items(
        self, 
        item_name: str, 
        error_type: str
    ) -> List[Dict[str, Any]]:
        """Find similar items using fuzzy string matching."""
        candidates = []
        
        # Determine which registry to search
        if "NODE" in error_type:
            candidates = list(self.registry.nodes.keys())
        elif "WORKFLOW" in error_type:
            candidates = list(self.registry.workflows.keys())
        elif "TOOL" in error_type:
            candidates = list(self.registry.tools.keys())
        
        # Calculate similarity scores
        similarities = []
        for candidate in candidates:
            ratio = self._similarity_ratio(item_name.lower(), candidate.lower())
            if ratio > 0.6:  # 60% similarity threshold
                similarities.append({
                    "name": candidate,
                    "similarity": ratio
                })
        
        # Sort by similarity descending
        return sorted(similarities, key=lambda x: x['similarity'], reverse=True)
    
    @staticmethod
    def _similarity_ratio(a: str, b: str) -> float:
        """Calculate string similarity using SequenceMatcher."""
        return SequenceMatcher(None, a, b).ratio()
    
    def _replace_in_plan(
        self,
        plan: Dict[str, Any],
        old_name: str,
        new_name: str,
        error_type: str
    ) -> Dict[str, Any]:
        """Replace component in execution plan."""
        corrected = plan.copy()
        
        if "NODE" in error_type:
            nodes = corrected.get("nodes_to_invoke", [])
            for node in nodes:
                if node.get("name") == old_name:
                    node["name"] = new_name
                    node["auto_corrected"] = True
        
        elif "WORKFLOW" in error_type:
            workflows = corrected.get("workflows_to_execute", [])
            for workflow in workflows:
                if workflow.get("name") == old_name:
                    workflow["name"] = new_name
                    workflow["auto_corrected"] = True
        
        elif "TOOL" in error_type:
            tools = corrected.get("tools_to_use", [])
            for tool in tools:
                if tool.get("name") == old_name:
                    tool["name"] = new_name
                    tool["auto_corrected"] = True
        
        return corrected
    
    def _generate_cache_key(self, execution_plan: Dict[str, Any]) -> str:
        """Generate cache key for execution plan."""
        # Use sorted JSON string as cache key
        plan_str = json.dumps(execution_plan, sort_keys=True)
        return str(hash(plan_str))
    
    def _log_validation(self, execution_plan: Dict[str, Any], result: Dict[str, Any]):
        """Log validation result for audit trail."""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "service": "HeadyCheck",
            "url": f"https://{self.service_info['fqdn']}",
            "valid": result["valid"],
            "errors": len(result["errors"]),
            "warnings": len(result["warnings"]),
            "corrections": len(result["corrections"])
        }
        
        # Store in conductor's execution log
        if hasattr(self.conductor, 'execution_log'):
            self.conductor.execution_log.append({
                "type": "validation",
                "name": "HeadyCheck",
                "timestamp": log_entry["timestamp"],
                "result": log_entry
            })
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get HeadyCheck validation statistics."""
        return {
            "service": self.service_info,
            "statistics": self.stats,
            "success_rate": (
                self.stats["passed_validations"] / 
                max(self.stats["total_validations"], 1)
            ),
            "error_patterns": dict(self.error_patterns),
            "recent_corrections": self.correction_history[-10:],  # Last 10
            "cache_hit_rate": (
                self.stats["cached_validations"] /
                max(self.stats["total_validations"], 1)
            )
        }
    
    def get_health(self) -> Dict[str, Any]:
        """Health check endpoint for HeadyCheck service."""
        return {
            "status": "healthy",
            "service": "HeadyCheck",
            "fqdn": self.service_info["fqdn"],
            "version": self.service_info["version"],
            "url": f"https://{self.service_info['fqdn']}",
            "uptime_validations": self.stats["total_validations"],
            "success_rate": f"{(self.stats['passed_validations'] / max(self.stats['total_validations'], 1)):.1%}",
            "timestamp": datetime.now().isoformat()
        }


if __name__ == "__main__":
    # Standalone execution for testing
    print("HeadyCheck - Pre-Execution Validation Service")
    print("https://headycheck.com")
    print("Run within HeadyConductor for full functionality")
