import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import {
  IWhatsAppGateway,
  SendResult,
  SendImagePayload,
  SendAudioPayload,
  SendVideoPayload,
  SendDocumentPayload,
  GroupInfo,
} from "@modules/devices/domain/provider/whatsapp-gateway.interface";
import type { IDomainEventBus } from "@shared/provider/domain-event-bus.interface";
import type { ILoggerProvider } from "@shared/provider/logger-provider.interface";
import type { AppConfig } from "@shared/provider/app-config.interface";
import type { SessionManager } from "./session-manager";

/**
 * The real WhatsApp gateway. It implements the port by delegating to a Baileys
 * session manager that is created LAZILY via a dynamic `import()` — so
 * `@whiskeysockets/baileys` never enters the module load-time chain (it is only
 * pulled in when this gateway is bound, i.e. `WHATSAPP_ENABLED=true`, and first
 * used). Deliberately thin — no business rule; the lifecycle logic lives in the
 * handle-session-* use cases.
 *
 * Only bound in the container when `WHATSAPP_ENABLED=true`.
 */
@injectable()
export class BaileysWhatsAppGateway implements IWhatsAppGateway {
  private manager: SessionManager | null = null;
  private managerPromise: Promise<SessionManager> | null = null;

  constructor(
    @inject(DI_TOKENS.DomainEventBus)
    private readonly bus: IDomainEventBus,
    @inject(DI_TOKENS.LoggerProvider)
    private readonly logger: ILoggerProvider,
    @inject(DI_TOKENS.AppConfig)
    private readonly config: AppConfig,
    @inject(DI_TOKENS.ResolveOutboxText)
    private readonly resolveOutboxText: (
      waMessageId: string,
    ) => Promise<string | null>,
  ) {}

  isEnabled(): boolean {
    return true;
  }

  // Lazily build the session manager on first use. The `import()` is what keeps
  // Baileys out of the load-time graph.
  private async getManager(): Promise<SessionManager> {
    if (this.manager) return this.manager;
    if (!this.managerPromise) {
      this.managerPromise = import("./session-manager.js").then(
        ({ makeSessionManager }) => {
          const manager = makeSessionManager({
            bus: this.bus,
            logger: this.logger,
            config: {
              reconnectBaseDelayMs: this.config.RECONNECT_BASE_DELAY_MS,
              reconnectMaxDelayMs: this.config.RECONNECT_MAX_DELAY_MS,
            },
            resolveOutboxText: this.resolveOutboxText,
          });
          this.manager = manager;
          return manager;
        },
      );
    }
    return this.managerPromise;
  }

  async connect(deviceId: string): Promise<void> {
    const manager = await this.getManager();
    return manager.connect(deviceId);
  }

  async disconnect(deviceId: string): Promise<void> {
    const manager = await this.getManager();
    return manager.disconnect(deviceId);
  }

  async logout(deviceId: string): Promise<void> {
    const manager = await this.getManager();
    return manager.logout(deviceId);
  }

  isConnected(deviceId: string): boolean {
    // Synchronous by contract. Before the manager is built (no socket opened
    // yet) nothing can be connected.
    return this.manager ? this.manager.isConnected(deviceId) : false;
  }

  getCurrentQr(deviceId: string): string | null {
    // Synchronous by contract. No manager yet → no pending QR.
    return this.manager ? this.manager.getCurrentQr(deviceId) : null;
  }

  async listGroups(deviceId: string): Promise<GroupInfo[]> {
    const manager = await this.getManager();
    return manager.listGroups(deviceId);
  }

  async resolveJid(deviceId: string, phone: string): Promise<string | null> {
    const manager = await this.getManager();
    return manager.resolveJid(deviceId, phone);
  }

  async sendText(
    deviceId: string,
    jid: string,
    text: string,
  ): Promise<SendResult> {
    const manager = await this.getManager();
    return manager.sendText(deviceId, jid, text);
  }

  async sendImage(
    deviceId: string,
    jid: string,
    payload: SendImagePayload,
  ): Promise<SendResult> {
    const manager = await this.getManager();
    return manager.sendImage(deviceId, jid, payload);
  }

  async sendAudio(
    deviceId: string,
    jid: string,
    payload: SendAudioPayload,
  ): Promise<SendResult> {
    const manager = await this.getManager();
    return manager.sendAudio(deviceId, jid, payload);
  }

  async sendVideo(
    deviceId: string,
    jid: string,
    payload: SendVideoPayload,
  ): Promise<SendResult> {
    const manager = await this.getManager();
    return manager.sendVideo(deviceId, jid, payload);
  }

  async sendDocument(
    deviceId: string,
    jid: string,
    payload: SendDocumentPayload,
  ): Promise<SendResult> {
    const manager = await this.getManager();
    return manager.sendDocument(deviceId, jid, payload);
  }

  /** Composition-root helper: close all sockets on graceful shutdown. No-op if
   *  the manager was never built. */
  closeAll(): void {
    this.manager?.closeAll();
  }
}
