import {
  IWhatsAppGateway,
  SendResult,
  SendImagePayload,
  SendAudioPayload,
  SendVideoPayload,
  SendDocumentPayload,
  GroupInfo,
} from "@modules/devices/domain/provider/whatsapp-gateway.interface";
import { type RichMessageType } from "@modules/messaging/domain/value-object/message-type";
import { ServiceUnavailableError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

/**
 * In-memory WhatsApp gateway for specs — no real socket. Records calls and lets
 * a test drive connection state / jid resolution / send results. Mirrors the
 * enabled real gateway (`isEnabled()` → true) so the connect/send use cases run
 * their full logic.
 */
export class FakeWhatsAppGateway implements IWhatsAppGateway {
  public connectCalls: string[] = [];
  public logoutCalls: string[] = [];
  public sentTexts: { deviceId: string; jid: string; text: string }[] = [];
  /** Every rich (non-text) send, in order — assert the dispatched `type`. */
  public sentRich: {
    deviceId: string;
    jid: string;
    type: RichMessageType;
    payload: unknown;
  }[] = [];
  /** Every setTyping call, in order: `{ deviceId, jid, on }`. Recorded
   *  unconditionally (even when the device isn't "connected") — assert the
   *  on/off presence sequence in E3 specs. */
  public typingCalls: { deviceId: string; jid: string; on: boolean }[] = [];
  /** Ordered log of presence-vs-send actions, to assert a "typing…" (composing)
   *  precedes its send. `"typing"` on setTyping(on=true), `"text"`/`"rich"` on a
   *  send. */
  public callLog: ("typing" | "text" | "rich")[] = [];
  /** Set a type to force its send to throw (drives the FAILED-path specs). */
  public failTypes = new Set<RichMessageType | "text">();

  /** Count of resolveJid calls — assert the offline path skips WA resolution. */
  public resolveCalls = 0;

  private connected = new Set<string>();
  private jidByPhone = new Map<string, string | null>();
  private qrByDevice = new Map<string, string>();
  private groupsByDevice = new Map<string, GroupInfo[]>();
  private nextWaMessageId = 0;
  private enabled = true;

  // ── Test controls ────────────────────────────────────────────────────────
  setConnected(deviceId: string, value: boolean): void {
    if (value) this.connected.add(deviceId);
    else this.connected.delete(deviceId);
  }

  setJid(phone: string, jid: string | null): void {
    this.jidByPhone.set(phone, jid);
  }

  setQr(deviceId: string, qr: string | null): void {
    if (qr === null) this.qrByDevice.delete(deviceId);
    else this.qrByDevice.set(deviceId, qr);
  }

  setGroups(deviceId: string, groups: GroupInfo[]): void {
    this.groupsByDevice.set(deviceId, groups);
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  // ── IWhatsAppGateway ─────────────────────────────────────────────────────
  isEnabled(): boolean {
    return this.enabled;
  }

  async connect(deviceId: string): Promise<void> {
    this.connectCalls.push(deviceId);
  }

  async disconnect(deviceId: string): Promise<void> {
    this.connected.delete(deviceId);
  }

  async logout(deviceId: string): Promise<void> {
    this.logoutCalls.push(deviceId);
    this.connected.delete(deviceId);
  }

  isConnected(deviceId: string): boolean {
    return this.connected.has(deviceId);
  }

  getCurrentQr(deviceId: string): string | null {
    return this.qrByDevice.get(deviceId) ?? null;
  }

  // Mirrors the real gateway: a live socket is required, so an offline device
  // throws DEVICE_OFFLINE rather than returning an empty list.
  async listGroups(deviceId: string): Promise<GroupInfo[]> {
    if (!this.connected.has(deviceId)) {
      throw new ServiceUnavailableError(
        "The device is not connected",
        undefined,
        ErrorCodes.DEVICE_OFFLINE,
      );
    }
    return this.groupsByDevice.get(deviceId) ?? [];
  }

  async resolveJid(_deviceId: string, phone: string): Promise<string | null> {
    this.resolveCalls += 1;
    // Default: echo a jid derived from the phone unless overridden.
    if (this.jidByPhone.has(phone)) return this.jidByPhone.get(phone) ?? null;
    return `${phone}@s.whatsapp.net`;
  }

  async sendText(
    deviceId: string,
    jid: string,
    text: string,
  ): Promise<SendResult> {
    if (this.failTypes.has("text")) throw new Error("send failed");
    this.sentTexts.push({ deviceId, jid, text });
    this.callLog.push("text");
    return this.nextResult();
  }

  async sendImage(
    deviceId: string,
    jid: string,
    payload: SendImagePayload,
  ): Promise<SendResult> {
    return this.recordRich(deviceId, jid, "image", payload);
  }

  async sendAudio(
    deviceId: string,
    jid: string,
    payload: SendAudioPayload,
  ): Promise<SendResult> {
    return this.recordRich(deviceId, jid, "audio", payload);
  }

  async sendVideo(
    deviceId: string,
    jid: string,
    payload: SendVideoPayload,
  ): Promise<SendResult> {
    return this.recordRich(deviceId, jid, "video", payload);
  }

  async sendDocument(
    deviceId: string,
    jid: string,
    payload: SendDocumentPayload,
  ): Promise<SendResult> {
    return this.recordRich(deviceId, jid, "document", payload);
  }

  async setTyping(deviceId: string, jid: string, on: boolean): Promise<void> {
    this.typingCalls.push({ deviceId, jid, on });
    if (on) this.callLog.push("typing");
  }

  private recordRich(
    deviceId: string,
    jid: string,
    type: RichMessageType,
    payload: unknown,
  ): SendResult {
    if (this.failTypes.has(type)) throw new Error("send failed");
    this.sentRich.push({ deviceId, jid, type, payload });
    this.callLog.push("rich");
    return this.nextResult();
  }

  private nextResult(): SendResult {
    this.nextWaMessageId += 1;
    return { waMessageId: `wa-${this.nextWaMessageId}` };
  }
}
