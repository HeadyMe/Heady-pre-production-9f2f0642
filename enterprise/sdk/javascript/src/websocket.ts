/**
 * @file websocket.ts
 * @description WebSocket client for real-time HeadyOS event subscriptions.
 * Features φ-exponential backoff auto-reconnect, typed event handling,
 * subscription multiplexing, and heartbeat/ping management.
 */

import WebSocket from 'ws';
import { PHI, fibonacci, type HeadyConfig } from './types';
import type { EventChannel, EventCallback, HeadyEvent, Subscription } from './types';

// ---------------------------------------------------------------------------
// WebSocket Constants
// ---------------------------------------------------------------------------

const WS_CONSTANTS = {
  DEFAULT_WS_URL: 'wss://ws.headyme.com',
  // Reconnect base delay: 1000ms
  RECONNECT_BASE_MS: 1000,
  // Max reconnect delay: 1000ms × φ^8 ≈ 46370ms
  MAX_RECONNECT_DELAY_MS: Math.round(1000 * Math.pow(PHI, 8)),
  // Max reconnect attempts: fib(8)=21
  MAX_RECONNECT_ATTEMPTS: fibonacci(8),
  // Heartbeat interval: 1000ms × φ^5 ≈ 11090ms
  HEARTBEAT_INTERVAL_MS: Math.round(1000 * Math.pow(PHI, 5)),
  // Heartbeat timeout: 1000ms × φ^6 ≈ 17944ms
  HEARTBEAT_TIMEOUT_MS: Math.round(1000 * Math.pow(PHI, 6)),
  // Message queue max size: fib(9)=34
  MESSAGE_QUEUE_MAX: fibonacci(9),
};

type WsState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'closed';

interface WsMessage {
  type: string;
  channel?: string;
  data?: unknown;
  subscriptionId?: string;
  timestamp?: string;
  sequenceId?: number;
}

// ---------------------------------------------------------------------------
// HeadyWebSocketClient
// ---------------------------------------------------------------------------

export class HeadyWebSocketClient {
  private ws: WebSocket | null = null;
  private state: WsState = 'disconnected';
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null;
  private messageQueue: WsMessage[] = [];
  private subscriptions = new Map<string, Set<EventCallback>>();
  private pendingSubscriptions = new Set<EventChannel>();
  private sequenceCounter = 0;

  private readonly wsUrl: string;
  private readonly apiKey: string;
  private readonly tenantId?: string;
  private readonly debug: boolean;

  constructor(config: HeadyConfig) {
    this.wsUrl = config.wsUrl ?? WS_CONSTANTS.DEFAULT_WS_URL;
    this.apiKey = config.apiKey;
    this.tenantId = config.tenantId;
    this.debug = config.debug ?? false;
  }

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  /**
   * Connect to the HeadyOS WebSocket server.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === 'connected') {
        resolve();
        return;
      }

      this.state = 'connecting';
      const url = new URL(this.wsUrl);
      url.searchParams.set('apiKey', this.apiKey);
      if (this.tenantId) url.searchParams.set('tenantId', this.tenantId);

      this.ws = new WebSocket(url.toString(), {
        headers: {
          'X-Heady-SDK': 'javascript/1.0.0',
        },
      });

      const connectTimeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
        this.ws?.close();
      }, WS_CONSTANTS.HEARTBEAT_TIMEOUT_MS);

      this.ws.on('open', () => {
        clearTimeout(connectTimeout);
        this.onConnected();
        resolve();
      });

      this.ws.on('error', (err) => {
        clearTimeout(connectTimeout);
        if (this.state === 'connecting') {
          reject(err);
        }
        this.handleError(err);
      });

      this.ws.on('close', (code, reason) => {
        clearTimeout(connectTimeout);
        this.handleClose(code, reason.toString());
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('pong', () => {
        this.resetHeartbeatTimeout();
      });
    });
  }

  /**
   * Gracefully close the WebSocket connection.
   */
  disconnect(): void {
    this.state = 'closed';
    this.clearTimers();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.subscriptions.clear();
    this.pendingSubscriptions.clear();
  }

  // ---------------------------------------------------------------------------
  // Event Subscription
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to a HeadyOS event channel.
   *
   * @param channel - Channel to subscribe to (e.g., 'agent:my-agent-id', 'task:abc123')
   * @param callback - Event handler
   * @returns Subscription object with unsubscribe()
   */
  subscribe<T = unknown>(channel: EventChannel, callback: EventCallback<T>): Subscription {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      this.sendSubscribeMessage(channel);
    }

    this.subscriptions.get(channel)!.add(callback as EventCallback);

    if (this.debug) {
      console.debug(`[HeadyWS] Subscribed to channel: ${channel}`);
    }

    return {
      channel,
      unsubscribe: () => {
        const callbacks = this.subscriptions.get(channel);
        if (callbacks) {
          callbacks.delete(callback as EventCallback);
          if (callbacks.size === 0) {
            this.subscriptions.delete(channel);
            this.sendUnsubscribeMessage(channel);
          }
        }
      },
    };
  }

  /**
   * Subscribe and wait for the next event on a channel.
   * Useful for one-shot event waiting.
   */
  once<T = unknown>(channel: EventChannel): Promise<HeadyEvent<T>> {
    return new Promise((resolve) => {
      const sub = this.subscribe<T>(channel, (event) => {
        sub.unsubscribe();
        resolve(event);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Message Sending
  // ---------------------------------------------------------------------------

  /**
   * Send a message to the WebSocket server.
   * If not connected, queues the message for delivery after reconnect.
   */
  send(message: WsMessage): void {
    if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message up to max size
      if (this.messageQueue.length < WS_CONSTANTS.MESSAGE_QUEUE_MAX) {
        this.messageQueue.push(message);
      }
    }
  }

  private sendSubscribeMessage(channel: EventChannel): void {
    if (this.state !== 'connected') {
      this.pendingSubscriptions.add(channel);
      return;
    }
    this.send({ type: 'subscribe', channel });
  }

  private sendUnsubscribeMessage(channel: EventChannel): void {
    this.send({ type: 'unsubscribe', channel });
  }

  // ---------------------------------------------------------------------------
  // Event Handling
  // ---------------------------------------------------------------------------

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WsMessage;

      if (message.type === 'pong') {
        this.resetHeartbeatTimeout();
        return;
      }

      if (message.type === 'event' && message.channel) {
        const callbacks = this.subscriptions.get(message.channel as EventChannel);
        if (callbacks && callbacks.size > 0) {
          const event: HeadyEvent = {
            channel: message.channel as EventChannel,
            type: message.type,
            data: message.data,
            timestamp: message.timestamp ?? new Date().toISOString(),
            sequenceId: message.sequenceId ?? ++this.sequenceCounter,
          };

          for (const callback of callbacks) {
            try {
              callback(event);
            } catch (err) {
              console.error('[HeadyWS] Error in event callback:', err);
            }
          }
        }
      }

      if (this.debug) {
        console.debug('[HeadyWS] Received:', { type: message.type, channel: message.channel });
      }
    } catch (err) {
      console.error('[HeadyWS] Failed to parse message:', err);
    }
  }

  private onConnected(): void {
    this.state = 'connected';
    this.reconnectAttempt = 0;

    // Flush message queue
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      this.ws?.send(JSON.stringify(msg));
    }

    // Re-subscribe to all active channels
    for (const channel of this.subscriptions.keys()) {
      this.send({ type: 'subscribe', channel });
    }

    // Re-subscribe to pending subscriptions
    for (const channel of this.pendingSubscriptions) {
      this.send({ type: 'subscribe', channel });
      this.pendingSubscriptions.delete(channel);
    }

    this.startHeartbeat();

    if (this.debug) {
      console.debug('[HeadyWS] Connected');
    }
  }

  private handleClose(code: number, reason: string): void {
    this.clearTimers();

    if (this.state === 'closed') return;

    if (this.debug) {
      console.debug(`[HeadyWS] Closed: code=${code} reason=${reason}`);
    }

    // Reconnect unless intentional close or auth failure
    if (code !== 1000 && code !== 4001 && code !== 4003) {
      this.scheduleReconnect();
    } else {
      this.state = 'disconnected';
    }
  }

  private handleError(err: Error): void {
    if (this.debug) {
      console.error('[HeadyWS] Error:', err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // φ-Exponential Reconnect
  // ---------------------------------------------------------------------------

  /**
   * Schedule reconnect with φ-exponential backoff.
   * delay(n) = min(1000ms × φ^n, MAX_RECONNECT_DELAY_MS)
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= WS_CONSTANTS.MAX_RECONNECT_ATTEMPTS) {
      this.state = 'disconnected';
      console.error('[HeadyWS] Max reconnect attempts reached. Giving up.');
      return;
    }

    this.state = 'reconnecting';
    const delay = Math.min(
      Math.round(WS_CONSTANTS.RECONNECT_BASE_MS * Math.pow(PHI, this.reconnectAttempt)),
      WS_CONSTANTS.MAX_RECONNECT_DELAY_MS
    );

    if (this.debug) {
      console.debug(`[HeadyWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt + 1}/${WS_CONSTANTS.MAX_RECONNECT_ATTEMPTS})`);
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempt++;
      try {
        await this.connect();
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  // ---------------------------------------------------------------------------
  // Heartbeat
  // ---------------------------------------------------------------------------

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.heartbeatTimeoutTimer = setTimeout(() => {
          console.warn('[HeadyWS] Heartbeat timeout. Reconnecting...');
          this.ws?.terminate();
        }, WS_CONSTANTS.HEARTBEAT_TIMEOUT_MS);
      }
    }, WS_CONSTANTS.HEARTBEAT_INTERVAL_MS);
  }

  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.heartbeatTimeoutTimer) { clearTimeout(this.heartbeatTimeoutTimer); this.heartbeatTimeoutTimer = null; }
  }

  get connectionState(): WsState {
    return this.state;
  }

  get activeSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}
