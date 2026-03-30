import {WS_BASE_URL, ENDPOINTS} from '../constants/api';

type MessageHandler = (data: any) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private routeId: string | null = null;
  private onMessage: MessageHandler | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(routeId: string, onMessage: MessageHandler) {
    this.disconnect();
    this.routeId = routeId;
    this.onMessage = onMessage;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  private doConnect() {
    if (!this.routeId) return;

    const url = `${WS_BASE_URL}${ENDPOINTS.WS_TRACK(this.routeId)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      if (__DEV__) console.log(`[WS] Connected to route ${this.routeId}`);
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessage?.(data);
      } catch (e) {
        console.warn('[WS] Failed to parse message:', e);
      }
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] Max reconnect attempts reached');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      30000,
    );
    this.reconnectAttempts++;

    if (__DEV__ && this.reconnectAttempts <= 1) console.log(`[WS] Reconnecting route ${this.routeId} (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect on intentional close
      this.ws.close();
      this.ws = null;
    }
    this.routeId = null;
    this.onMessage = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsManager = new WebSocketManager();
