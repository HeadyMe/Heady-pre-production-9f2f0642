// ═══════════════════════════════════════════════════════════════
// 🧠 HEADY RESOURCE ALLOCATION MANAGER
// ═══════════════════════════════════════════════════════════════
// 90% baseline / 100% peak resource allocation with attention-aware management

import { Docker } from 'dockerode';
import { EventEmitter } from 'events';

export interface ResourceLimits {
  cpus: string;
  memory: string;
}

export interface ResourceAllocation {
  serviceName: string;
  limits: ResourceLimits;
  reservations: ResourceLimits;
  priority: PriorityLevel;
  mode: ResourceMode;
  cpuShares: number;
}

export enum PriorityLevel {
  VERY_LOW = 25,      // Background learning
  LOW = 40,           // Maintenance tasks
  MEDIUM_LOW = 65,    // Autonomous operations
  MEDIUM = 80,        // Default baseline
  MEDIUM_HIGH = 90,   // Important background tasks
  HIGH = 125,         // User-initiated tasks
  VERY_HIGH = 150     // Critical user interactions
}

export enum ResourceMode {
  BASELINE = 'baseline',  // 90% allocation
  PEAK = 'peak',          // 100% allocation
  THROTTLED = 'throttled' // Reduced allocation
}

export interface AttentionPattern {
  userId: string;
  componentFocused: string;
  attentionLevel: number;
  timestamp: Date;
  predictedNextComponent?: string;
  confidence?: number;
}

export interface ServiceMetrics {
  cpu: number;
  memory: number;
  latency: number;
  throughput: number;
  errorRate: number;
}

export class ResourceAllocationManager extends EventEmitter {
  private docker: Docker;
  private allocations: Map<string, ResourceAllocation> = new Map();
  private attentionPatterns: Map<string, AttentionPattern[]> = new Map();
  private serviceMetrics: Map<string, ServiceMetrics> = new Map();
  private readonly MAX_CONCURRENT_PEAK_WORKFLOWS = 2;
  private readonly CONTEXT_SWITCH_COST = 0.3; // 30% productivity loss
  private readonly BASELINE_RATIO = 0.9; // 90% baseline allocation

  constructor() {
    super();
    this.docker = new Docker();
    this.initializeDefaultAllocations();
    this.startMetricsCollection();
    this.startAttentionMonitoring();
  }

  /**
   * Initialize default resource allocations for all Heady services
   */
  private initializeDefaultAllocations(): void {
    const defaultAllocations: ResourceAllocation[] = [
      {
        serviceName: 'heady-conductor',
        limits: { cpus: '2.0', memory: '4G' },
        reservations: { cpus: '1.8', memory: '3.6G' }, // 90% baseline
        priority: PriorityLevel.MEDIUM,
        mode: ResourceMode.BASELINE,
        cpuShares: 512
      },
      {
        serviceName: 'heady-soul',
        limits: { cpus: '4.0', memory: '8G' },
        reservations: { cpus: '3.6', memory: '7.2G' }, // 90% baseline
        priority: PriorityLevel.MEDIUM,
        mode: ResourceMode.BASELINE,
        cpuShares: 512
      },
      {
        serviceName: 'heady-mcp',
        limits: { cpus: '1.0', memory: '2G' },
        reservations: { cpus: '0.9', memory: '1.8G' }, // 90% baseline
        priority: PriorityLevel.MEDIUM,
        mode: ResourceMode.BASELINE,
        cpuShares: 512
      },
      {
        serviceName: 'heady-web',
        limits: { cpus: '1.0', memory: '2G' },
        reservations: { cpus: '0.9', memory: '1.8G' }, // 90% baseline
        priority: PriorityLevel.MEDIUM,
        mode: ResourceMode.BASELINE,
        cpuShares: 512
      },
      {
        serviceName: 'heady-buddy',
        limits: { cpus: '2.0', memory: '4G' },
        reservations: { cpus: '1.8', memory: '3.6G' }, // 90% baseline
        priority: PriorityLevel.MEDIUM,
        mode: ResourceMode.BASELINE,
        cpuShares: 512
      },
      {
        serviceName: 'heady-lens',
        limits: { cpus: '3.0', memory: '6G' },
        reservations: { cpus: '2.7', memory: '5.4G' }, // 90% baseline
        priority: PriorityLevel.MEDIUM_LOW,
        mode: ResourceMode.BASELINE,
        cpuShares: 256
      },
      {
        serviceName: 'heady-vinci',
        limits: { cpus: '4.0', memory: '8G' },
        reservations: { cpus: '3.6', memory: '7.2G' }, // 90% baseline
        priority: PriorityLevel.MEDIUM_LOW,
        mode: ResourceMode.BASELINE,
        cpuShares: 256
      }
    ];

    defaultAllocations.forEach(allocation => {
      this.allocations.set(allocation.serviceName, allocation);
    });
  }

  /**
   * Handle user interaction and escalate resources to peak
   */
  async handleUserInteraction(userId: string, component: string, interactionType: 'click' | 'focus' | 'request'): Promise<void> {
    // Record attention pattern
    await this.recordAttentionPattern(userId, component, interactionType);
    
    // Predict attention shift
    const prediction = await this.predictAttentionShift(userId);
    
    // Pre-allocate resources if confidence is high
    if (prediction.confidence > 0.8 && prediction.nextComponent) {
      await this.preAllocateResources(prediction.nextComponent);
    }
    
    // Escalate current component to peak
    await this.escalateToPeak(component);
    
    // Optimize concurrent workflows
    await this.optimizeConcurrentWorkflows();
    
    this.emit('userInteraction', { userId, component, interactionType, prediction });
  }

  /**
   * Escalate service to 100% peak allocation
   */
  async escalateToPeak(serviceName: string): Promise<void> {
    const allocation = this.allocations.get(serviceName);
    if (!allocation) {
      throw new Error(`Service ${serviceName} not found in allocations`);
    }

    // Update allocation to peak mode
    const peakAllocation: ResourceAllocation = {
      ...allocation,
      mode: ResourceMode.PEAK,
      priority: PriorityLevel.HIGH,
      cpuShares: 1024,
      reservations: allocation.limits // 100% allocation
    };

    // Apply to Docker container
    await this.applyResourceAllocation(serviceName, peakAllocation);
    
    // Update internal state
    this.allocations.set(serviceName, peakAllocation);
    
    // Schedule return to baseline after inactivity
    this.scheduleReturnToBaseline(serviceName);
    
    this.emit('resourceEscalation', { serviceName, allocation: peakAllocation });
  }

  /**
   * Pre-allocate resources for predicted attention shift
   */
  async preAllocateResources(serviceName: string): Promise<void> {
    const allocation = this.allocations.get(serviceName);
    if (!allocation) return;

    // Increase to medium-high priority in anticipation
    const preAllocated: ResourceAllocation = {
      ...allocation,
      priority: PriorityLevel.MEDIUM_HIGH,
      cpuShares: 768,
      reservations: {
        cpus: (parseFloat(allocation.limits.cpus) * 0.95).toString(),
        memory: this.calculateMemoryAllocation(allocation.limits.memory, 0.95)
      }
    };

    await this.applyResourceAllocation(serviceName, preAllocated);
    this.allocations.set(serviceName, preAllocated);
    
    this.emit('resourcePreAllocation', { serviceName, allocation: preAllocated });
  }

  /**
   * Return service to baseline allocation
   */
  async returnToBaseline(serviceName: string): Promise<void> {
    const allocation = this.allocations.get(serviceName);
    if (!allocation) return;

    const baselineAllocation: ResourceAllocation = {
      ...allocation,
      mode: ResourceMode.BASELINE,
      priority: this.getDefaultPriority(serviceName),
      cpuShares: 512,
      reservations: {
        cpus: (parseFloat(allocation.limits.cpus) * this.BASELINE_RATIO).toString(),
        memory: this.calculateMemoryAllocation(allocation.limits.memory, this.BASELINE_RATIO)
      }
    };

    await this.applyResourceAllocation(serviceName, baselineAllocation);
    this.allocations.set(serviceName, baselineAllocation);
    
    this.emit('resourceBaseline', { serviceName, allocation: baselineAllocation });
  }

  /**
   * Optimize concurrent workflows to prevent context dilution
   */
  async optimizeConcurrentWorkflows(): Promise<void> {
    const peakServices = Array.from(this.allocations.entries())
      .filter(([_, allocation]) => allocation.mode === ResourceMode.PEAK)
      .map(([name]) => name);

    if (peakServices.length > this.MAX_CONCURRENT_PEAK_WORKFLOWS) {
      // Sort by priority and attention level
      const prioritized = peakServices.sort((a, b) => {
        const allocationA = this.allocations.get(a)!;
        const allocationB = this.allocations.get(b)!;
        
        // Consider both priority and recent attention
        const scoreA = allocationA.priority + this.getAttentionScore(a);
        const scoreB = allocationB.priority + this.getAttentionScore(b);
        
        return scoreB - scoreA;
      });

      // Throttle lower priority services
      for (const service of prioritized.slice(this.MAX_CONCURRENT_PEAK_WORKFLOWS)) {
        await this.throttleService(service);
      }
    }
  }

  /**
   * Throttle service to reduce resource consumption
   */
  async throttleService(serviceName: string): Promise<void> {
    const allocation = this.allocations.get(serviceName);
    if (!allocation) return;

    const throttledAllocation: ResourceAllocation = {
      ...allocation,
      mode: ResourceMode.THROTTLED,
      priority: PriorityLevel.LOW,
      cpuShares: 256,
      reservations: {
        cpus: (parseFloat(allocation.limits.cpus) * 0.5).toString(),
        memory: this.calculateMemoryAllocation(allocation.limits.memory, 0.5)
      }
    };

    await this.applyResourceAllocation(serviceName, throttledAllocation);
    this.allocations.set(serviceName, throttledAllocation);
    
    this.emit('resourceThrottling', { serviceName, allocation: throttledAllocation });
  }

  /**
   * Apply resource allocation to Docker container
   */
  private async applyResourceAllocation(serviceName: string, allocation: ResourceAllocation): Promise<void> {
    try {
      const container = this.docker.getContainer(serviceName);
      
      await container.update({
        RestartPolicy: { Name: 'unless-stopped' },
        Resources: {
          Limits: {
            NanoCPUs: this.parseCpus(allocation.limits.cpus),
            MemoryBytes: this.parseMemory(allocation.limits.memory)
          },
          Reservations: {
            NanoCPUs: this.parseCpus(allocation.reservations.cpus),
            MemoryBytes: this.parseMemory(allocation.reservations.memory)
          }
        },
        CpuShares: allocation.cpuShares
      });
    } catch (error) {
      console.error(`Failed to apply resource allocation for ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Record attention pattern for learning
   */
  private async recordAttentionPattern(userId: string, component: string, interactionType: string): Promise<void> {
    const pattern: AttentionPattern = {
      userId,
      componentFocused: component,
      attentionLevel: this.calculateAttentionLevel(interactionType),
      timestamp: new Date()
    };

    if (!this.attentionPatterns.has(userId)) {
      this.attentionPatterns.set(userId, []);
    }

    const userPatterns = this.attentionPatterns.get(userId)!;
    userPatterns.push(pattern);

    // Keep only last 100 patterns per user
    if (userPatterns.length > 100) {
      userPatterns.shift();
    }

    this.emit('attentionPattern', pattern);
  }

  /**
   * Predict next attention shift based on historical patterns
   */
  private async predictAttentionShift(userId: string): Promise<{ nextComponent?: string; confidence: number }> {
    const patterns = this.attentionPatterns.get(userId);
    if (!patterns || patterns.length < 5) {
      return { confidence: 0 };
    }

    // Simple pattern recognition - can be enhanced with ML
    const recentPatterns = patterns.slice(-10);
    const componentTransitions = new Map<string, number>();

    for (let i = 0; i < recentPatterns.length - 1; i++) {
      const current = recentPatterns[i];
      const next = recentPatterns[i + 1];
      
      if (current.componentFocused === recentPatterns[recentPatterns.length - 1].componentFocused) {
        const count = componentTransitions.get(next.componentFocused) || 0;
        componentTransitions.set(next.componentFocused, count + 1);
      }
    }

    if (componentTransitions.size === 0) {
      return { confidence: 0 };
    }

    // Find most likely next component
    let maxCount = 0;
    let nextComponent = '';
    for (const [component, count] of componentTransitions) {
      if (count > maxCount) {
        maxCount = count;
        nextComponent = component;
      }
    }

    const confidence = maxCount / recentPatterns.length;
    return { nextComponent, confidence };
  }

  /**
   * Calculate attention level based on interaction type
   */
  private calculateAttentionLevel(interactionType: string): number {
    switch (interactionType) {
      case 'click': return 1.0;
      case 'focus': return 0.8;
      case 'request': return 0.9;
      default: return 0.5;
    }
  }

  /**
   * Get attention score for a service
   */
  private getAttentionScore(serviceName: string): number {
    const recentPatterns = Array.from(this.attentionPatterns.values())
      .flat()
      .filter(pattern => pattern.componentFocused === serviceName && 
              Date.now() - pattern.timestamp.getTime() < 300000); // Last 5 minutes

    return recentPatterns.reduce((sum, pattern) => sum + pattern.attentionLevel, 0);
  }

  /**
   * Get default priority for a service
   */
  private getDefaultPriority(serviceName: string): PriorityLevel {
    const learningServices = ['heady-vinci', 'heady-soul'];
    const userFacingServices = ['heady-buddy', 'heady-web'];
    
    if (learningServices.includes(serviceName)) {
      return PriorityLevel.MEDIUM_LOW;
    } else if (userFacingServices.includes(serviceName)) {
      return PriorityLevel.MEDIUM;
    } else {
      return PriorityLevel.MEDIUM;
    }
  }

  /**
   * Schedule return to baseline after inactivity
   */
  private scheduleReturnToBaseline(serviceName: string): void {
    setTimeout(async () => {
      const attentionScore = this.getAttentionScore(serviceName);
      if (attentionScore < 0.1) { // No recent attention
        await this.returnToBaseline(serviceName);
      }
    }, 30000); // 30 seconds of inactivity
  }

  /**
   * Start metrics collection from all services
   */
  private startMetricsCollection(): void {
    setInterval(async () => {
      for (const serviceName of this.allocations.keys()) {
        try {
          const metrics = await this.collectServiceMetrics(serviceName);
          this.serviceMetrics.set(serviceName, metrics);
        } catch (error) {
          console.error(`Failed to collect metrics for ${serviceName}:`, error);
        }
      }
    }, 5000); // Collect every 5 seconds
  }

  /**
   * Collect metrics from a service
   */
  private async collectServiceMetrics(serviceName: string): Promise<ServiceMetrics> {
    try {
      const container = this.docker.getContainer(serviceName);
      const stats = await container.stats({ stream: false });
      
      const cpuUsage = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemCpuUsage = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent = (cpuUsage / systemCpuUsage) * stats.cpu_stats.online_cpus * 100;
      
      const memoryUsage = stats.memory_stats.usage;
      const memoryLimit = stats.memory_stats.limit;
      const memoryPercent = (memoryUsage / memoryLimit) * 100;

      return {
        cpu: cpuPercent,
        memory: memoryPercent,
        latency: 0, // Would be collected from service metrics endpoint
        throughput: 0, // Would be collected from service metrics endpoint
        errorRate: 0 // Would be collected from service metrics endpoint
      };
    } catch (error) {
      return {
        cpu: 0,
        memory: 0,
        latency: 0,
        throughput: 0,
        errorRate: 1
      };
    }
  }

  /**
   * Start attention monitoring
   */
  private startAttentionMonitoring(): void {
    setInterval(() => {
      // Clean old patterns
      for (const [userId, patterns] of this.attentionPatterns) {
        const recentPatterns = patterns.filter(pattern => 
          Date.now() - pattern.timestamp.getTime() < 3600000 // Keep last hour
        );
        this.attentionPatterns.set(userId, recentPatterns);
      }
    }, 60000); // Clean every minute
  }

  /**
   * Utility functions
   */
  private parseCpus(cpus: string): number {
    return parseFloat(cpus) * 1000000000; // Convert to nanoseconds
  }

  private parseMemory(memory: string): number {
    const units: { [key: string]: number } = {
      'B': 1,
      'K': 1024,
      'M': 1024 * 1024,
      'G': 1024 * 1024 * 1024
    };

    const match = memory.match(/^(\d+(?:\.\d+)?)([KMG]?)$/);
    if (!match) throw new Error(`Invalid memory format: ${memory}`);

    const [, value, unit] = match;
    return parseFloat(value) * (units[unit] || 1);
  }

  private calculateMemoryAllocation(memory: string, ratio: number): string {
    const match = memory.match(/^(\d+(?:\.\d+)?)([KMG]?)$/);
    if (!match) throw new Error(`Invalid memory format: ${memory}`);

    const [, value, unit] = match;
    const allocated = parseFloat(value) * ratio;
    return `${allocated}${unit}`;
  }

  /**
   * Get current resource allocation status
   */
  getResourceStatus(): { [serviceName: string]: ResourceAllocation & { metrics?: ServiceMetrics } } {
    const status: { [serviceName: string]: ResourceAllocation & { metrics?: ServiceMetrics } } = {};
    
    for (const [serviceName, allocation] of this.allocations) {
      status[serviceName] = {
        ...allocation,
        metrics: this.serviceMetrics.get(serviceName)
      };
    }
    
    return status;
  }

  /**
   * Get system-wide resource utilization
   */
  getSystemUtilization(): { totalCpu: number; totalMemory: number; allocatedCpu: number; allocatedMemory: number } {
    let totalCpu = 0;
    let totalMemory = 0;
    let allocatedCpu = 0;
    let allocatedMemory = 0;

    for (const allocation of this.allocations.values()) {
      totalCpu += parseFloat(allocation.limits.cpus);
      totalMemory += this.parseMemory(allocation.limits.memory);
      allocatedCpu += parseFloat(allocation.reservations.cpus);
      allocatedMemory += this.parseMemory(allocation.reservations.memory);
    }

    return {
      totalCpu,
      totalMemory,
      allocatedCpu,
      allocatedMemory
    };
  }
}
