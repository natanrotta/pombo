import { injectable } from "tsyringe";
import {
  IWhatsAppGateway,
  SendResult,
  GroupInfo,
} from "@modules/devices/domain/provider/whatsapp-gateway.interface";
import { ConflictError, ServiceUnavailableError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

/**
 * The gateway bound when `WHATSAPP_ENABLED=false` (the default). It never
 * imports Baileys and never opens a socket — the whole point of the flag is
 * that the app boots and every HTTP endpoint responds without the WhatsApp
 * runtime.
 *
 * `isEnabled()` returns false so `ConnectDeviceUseCase` short-circuits with a
 * clean WA_GATEWAY_DISABLED. `logout` is a safe no-op (so DELETE /devices/:id
 * still works). `sendText`/`resolveJid` throw WA_GATEWAY_DISABLED as a
 * defense-in-depth backstop, though the send use case already blocks on the
 * `isConnected` gate first.
 */
@injectable()
export class DisabledWhatsAppGateway implements IWhatsAppGateway {
  isEnabled(): boolean {
    return false;
  }

  async connect(): Promise<void> {
    throw new ConflictError(
      "The WhatsApp integration is disabled in this environment",
      undefined,
      ErrorCodes.WA_GATEWAY_DISABLED,
    );
  }

  async disconnect(): Promise<void> {
    // no-op — nothing is open
  }

  async logout(): Promise<void> {
    // no-op — safe to call from DELETE /devices/:id even when disabled
  }

  isConnected(): boolean {
    return false;
  }

  getCurrentQr(): string | null {
    return null;
  }

  async listGroups(): Promise<GroupInfo[]> {
    throw this.disabled();
  }

  async resolveJid(): Promise<string | null> {
    throw this.disabled();
  }

  async sendText(): Promise<SendResult> {
    throw this.disabled();
  }

  async sendImage(): Promise<SendResult> {
    throw this.disabled();
  }

  async sendAudio(): Promise<SendResult> {
    throw this.disabled();
  }

  async sendVideo(): Promise<SendResult> {
    throw this.disabled();
  }

  async sendDocument(): Promise<SendResult> {
    throw this.disabled();
  }

  private disabled(): ServiceUnavailableError {
    return new ServiceUnavailableError(
      "The WhatsApp integration is disabled in this environment",
      undefined,
      ErrorCodes.WA_GATEWAY_DISABLED,
    );
  }
}
