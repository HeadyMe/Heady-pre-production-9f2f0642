/**
 * Dynamic Nibble Assignment System
 * Allows runtime selection of bit-depth (4, 8, 16, 32, 64, 128, 256, 4096 bits)
 * for adaptive precision based on task requirements
 */

export type NibbleBitDepth = 4 | 8 | 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096;

export interface DynamicNibbleConfig {
  bitDepth: NibbleBitDepth;
  name: string;
  decimalDigits: number;
  speedFactor: number;  // Relative to 64-bit standard
  memoryBytes: number;
}

/**
 * Predefined nibble configurations for common use cases
 */
export const NIBBLE_PRESETS: Record<string, DynamicNibbleConfig> = {
  'ultra_low_power': { bitDepth: 4, name: 'ULP_4bit', decimalDigits: 1, speedFactor: 10, memoryBytes: 0.5 },
  'iot_edge': { bitDepth: 8, name: 'IoT_8bit', decimalDigits: 2, speedFactor: 5, memoryBytes: 1 },
  'embedded': { bitDepth: 16, name: 'FP16', decimalDigits: 3, speedFactor: 2, memoryBytes: 2 },
  'standard': { bitDepth: 64, name: 'FP64', decimalDigits: 15, speedFactor: 1, memoryBytes: 8 },
  'high': { bitDepth: 128, name: 'Quad128', decimalDigits: 34, speedFactor: 0.02, memoryBytes: 16 },
  'octuple': { bitDepth: 256, name: 'Octuple256', decimalDigits: 71, speedFactor: 0.001, memoryBytes: 32 },
  'crypto_1024': { bitDepth: 1024, name: 'Crypto1K', decimalDigits: 308, speedFactor: 0.0001, memoryBytes: 128 },
  'crypto_2048': { bitDepth: 2048, name: 'Crypto2K', decimalDigits: 617, speedFactor: 0.00005, memoryBytes: 256 },
  'rsa_4096': { bitDepth: 4096, name: 'RSA4K', decimalDigits: 1233, speedFactor: 0.00001, memoryBytes: 512 }
};

/**
 * Dynamic Nibble Manager for runtime bit-depth selection
 */
export class DynamicNibbleManager {
  private activeConfig: DynamicNibbleConfig;
  private conversionCache = new Map<string, any>();

  constructor(config: DynamicNibbleConfig | string = 'standard') {
    this.activeConfig = typeof config === 'string' 
      ? NIBBLE_PRESETS[config] 
      : config;
  }

  getConfig(): DynamicNibbleConfig {
    return this.activeConfig;
  }

  /**
   * Change bit depth at runtime
   */
  switchBitDepth(newConfig: DynamicNibbleConfig | string): void {
    this.activeConfig = typeof newConfig === 'string'
      ? NIBBLE_PRESETS[newConfig]
      : newConfig;
    this.conversionCache.clear();
  }

  /**
   * Convert truth value to active bit depth
   */
  encode(value: number): bigint | number {
    const key = `encode_${value}_${this.activeConfig.bitDepth}`;
    if (this.conversionCache.has(key)) {
      return this.conversionCache.get(key);
    }

    const clamped = Math.max(0, Math.min(1, value));
    const maxValue = (BigInt(1) << BigInt(this.activeConfig.bitDepth)) - BigInt(1);
    const encoded = BigInt(Math.floor(clamped * Number(maxValue)));

    this.conversionCache.set(key, encoded);
    return encoded;
  }

  /**
   * Decode from active bit depth back to [0, 1]
   */
  decode(encoded: bigint | number): number {
    const key = `decode_${encoded}_${this.activeConfig.bitDepth}`;
    if (this.conversionCache.has(key)) {
      return this.conversionCache.get(key);
    }

    const maxValue = (BigInt(1) << BigInt(this.activeConfig.bitDepth)) - BigInt(1);
    const decoded = Number(BigInt(encoded)) / Number(maxValue);

    this.conversionCache.set(key, decoded);
    return decoded;
  }

  /**
   * Convert between different bit depths
   */
  transcode(value: bigint | number, fromBits: NibbleBitDepth, toBits: NibbleBitDepth): bigint {
    const fromMax = (BigInt(1) << BigInt(fromBits)) - BigInt(1);
    const toMax = (BigInt(1) << BigInt(toBits)) - BigInt(1);

    const normalized = Number(BigInt(value)) / Number(fromMax);
    return BigInt(Math.floor(normalized * Number(toMax)));
  }

  /**
   * Adaptive bit-depth selection based on task characteristics
   */
  static selectOptimalBitDepth(task: {
    realtime?: boolean;
    cryptographic?: boolean;
    financial?: boolean;
    iot?: boolean;
    accuracy_required?: 'low' | 'medium' | 'high' | 'extreme';
    iterations?: number;
  }): string {
    // Real-time tasks prioritize speed
    if (task.realtime) return 'standard';

    // IoT/edge devices need low power
    if (task.iot) return 'iot_edge';

    // Cryptographic operations need high precision
    if (task.cryptographic) return 'rsa_4096';

    // Financial calculations need balanced precision
    if (task.financial) return 'octuple';

    // Long-running simulations accumulate error
    if (task.iterations && task.iterations > 1e6) return 'octuple';

    // Accuracy-based selection
    switch (task.accuracy_required) {
      case 'low': return 'embedded';
      case 'medium': return 'standard';
      case 'high': return 'high';
      case 'extreme': return 'rsa_4096';
      default: return 'standard';
    }
  }

  /**
   * Get estimated performance characteristics
   */
  estimatePerformance(operations: number): {
    executionTimeMs: number;
    memoryUsageMB: number;
    powerConsumptionMw: number;
  } {
    const baseTimeMs = 0.001; // 1μs per operation at standard precision
    const executionTimeMs = (operations * baseTimeMs) / this.activeConfig.speedFactor;

    const memoryUsageMB = (operations * this.activeConfig.memoryBytes) / (1024 * 1024);

    // Power scales with memory bandwidth and computation time
    const powerConsumptionMw = (memoryUsageMB * 10) + (executionTimeMs * 0.5);

    return { executionTimeMs, memoryUsageMB, powerConsumptionMw };
  }

  toString(): string {
    return `DynamicNibble[${this.activeConfig.name}, ${this.activeConfig.bitDepth}bit, ${this.activeConfig.decimalDigits}digits]`;
  }
}

/**
 * Multi-resolution gate that operates on different bit depths
 */
export class MultiResolutionGate {
  private nibbleManager: DynamicNibbleManager;

  constructor(config: DynamicNibbleConfig | string = 'standard') {
    this.nibbleManager = new DynamicNibbleManager(config);
  }

  /**
   * AND gate with dynamic bit depth
   */
  AND(inputs: number[]): number {
    const encoded = inputs.map(v => this.nibbleManager.encode(v));

    // Min operation in encoded space
    const minEncoded = encoded.reduce((min, val) => 
      BigInt(val) < BigInt(min) ? val : min
    );

    return this.nibbleManager.decode(minEncoded);
  }

  /**
   * OR gate with dynamic bit depth
   */
  OR(inputs: number[]): number {
    const encoded = inputs.map(v => this.nibbleManager.encode(v));

    // Max operation in encoded space
    const maxEncoded = encoded.reduce((max, val) => 
      BigInt(val) > BigInt(max) ? val : max
    );

    return this.nibbleManager.decode(maxEncoded);
  }

  /**
   * Switch resolution at runtime
   */
  setResolution(config: string | DynamicNibbleConfig): void {
    this.nibbleManager.switchBitDepth(config);
  }

  getResolution(): DynamicNibbleConfig {
    return this.nibbleManager.getConfig();
  }
}

/**
 * Adaptive nibble pipeline that adjusts precision based on load
 */
export class AdaptiveNibblePipeline {
  private stages: Map<string, DynamicNibbleManager> = new Map();
  private performanceHistory: number[] = [];

  constructor() {
    // Initialize with different precision stages
    this.stages.set('intake', new DynamicNibbleManager('standard'));
    this.stages.set('processing', new DynamicNibbleManager('high'));
    this.stages.set('output', new DynamicNibbleManager('standard'));
  }

  /**
   * Auto-tune precision based on system load
   */
  autoTune(systemLoad: number): void {
    // High load (>80%): reduce precision for speed
    if (systemLoad > 0.8) {
      this.stages.get('processing')?.switchBitDepth('standard');
    } 
    // Low load (<30%): increase precision for accuracy
    else if (systemLoad < 0.3) {
      this.stages.get('processing')?.switchBitDepth('octuple');
    }
    // Medium load: balanced precision
    else {
      this.stages.get('processing')?.switchBitDepth('high');
    }
  }

  /**
   * Process value through adaptive pipeline
   */
  process(value: number, stage: string = 'processing'): number {
    const manager = this.stages.get(stage);
    if (!manager) throw new Error(`Unknown stage: ${stage}`);

    const encoded = manager.encode(value);
    return manager.decode(encoded);
  }

  /**
   * Get current pipeline configuration
   */
  getPipelineStatus(): Record<string, string> {
    const status: Record<string, string> = {};
    for (const [stage, manager] of this.stages) {
      status[stage] = manager.getConfig().name;
    }
    return status;
  }
}
