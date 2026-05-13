import { wsEndpoint } from "@/lib/config";
import type { WsPayload } from "@/lib/types/chat";
import type { StreamEvent } from "@/lib/types/stream";

export type EventHandler = (event: StreamEvent) => void;
export type WsStatus = "idle" | "connecting" | "connected" | "closed";

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 200;

/**
 * 判断是否为旧版前端心跳触发的后端错误。
 *
 * 输入：
 *   event: 后端返回的流式事件。
 * 输出：
 *   返回 true 表示该事件只用于兼容过滤，不应展示给用户。
 */
function isLegacyHeartbeatError(event: StreamEvent): boolean {
  return event.type === "error" && event.content === "Unknown type: ping";
}

export class UnifiedWsClient {
  private socket: WebSocket | null = null;
  private readonly onEvent: EventHandler;
  private readonly onStatus: (status: WsStatus) => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private intentionalClose = false;
  private activeTurnId: string | null = null;
  private lastSeq = 0;

  constructor(onEvent: EventHandler, onStatus: (status: WsStatus) => void) {
    this.onEvent = onEvent;
    this.onStatus = onStatus;
  }

  /**
   * 建立统一 WebSocket 连接。
   *
   * 输入：
   *   无。
   * 输出：
   *   无；连接成功后更新状态，并在需要时恢复订阅中的 turn。
   */
  connect() {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.intentionalClose = false;
    this.onStatus("connecting");
    this.socket = new WebSocket(wsEndpoint());

    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.onStatus("connected");
      if (this.activeTurnId) {
        this.send({
          type: "resume_from",
          turn_id: this.activeTurnId,
          seq: this.lastSeq
        });
      }
    };

    this.socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as StreamEvent;
        if (isLegacyHeartbeatError(event)) return;
        if (event.turn_id) this.activeTurnId = event.turn_id;
        if (event.seq != null) this.lastSeq = Math.max(this.lastSeq, event.seq);
        this.onEvent(event);
      } catch {
        this.onEvent({
          type: "error",
          source: "learning-assistant-web",
          content: "收到无法解析的 WebSocket 事件。"
        });
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
      this.onStatus("closed");
      if (!this.intentionalClose) this.attemptReconnect();
    };

    this.socket.onerror = () => {
      this.onStatus("closed");
    };
  }

  /**
   * 向后端发送业务消息。
   *
   * 输入：
   *   payload: 统一 WebSocket 协议消息。
   * 输出：
   *   无；连接未打开时只记录前端错误。
   */
  send(payload: WsPayload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error("WebSocket 未连接");
      return;
    }
    this.socket.send(JSON.stringify(payload));
  }

  /**
   * 关闭连接并清理重连状态。
   *
   * 输入：
   *   无。
   * 输出：
   *   无；关闭当前 socket，清空 turn 恢复信息并更新状态。
   */
  close() {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.socket?.close();
    this.socket = null;
    this.activeTurnId = null;
    this.lastSeq = 0;
    this.reconnectAttempt = 0;
    this.onStatus("closed");
  }

  private attemptReconnect() {
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.activeTurnId = null;
      this.lastSeq = 0;
      return;
    }
    const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
