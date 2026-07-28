import makeWASocket, {
  fetchLatestBaileysVersion,
  jidDecode,
  proto,
} from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import type { IDomainEventBus } from "@shared/provider/domain-event-bus.interface";
import type { ILoggerProvider } from "@shared/provider/logger-provider.interface";
import type { DomainMessageStatus } from "@shared/provider/domain-event-bus.interface";
import {
  SendResult,
  SendImagePayload,
  SendAudioPayload,
  SendVideoPayload,
  SendDocumentPayload,
  GroupInfo,
} from "@modules/devices/domain/provider/whatsapp-gateway.interface";
import { ServiceUnavailableError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { makePrismaAuthState } from "./prisma-auth-state";
import { baseSocketConfig } from "./socket-config";
import { classifyDisconnect, computeReconnectDelay } from "./reconnect-policy";

export interface SessionManagerConfig {
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
}

export interface SessionManagerDeps {
  bus: IDomainEventBus;
  logger: ILoggerProvider;
  config: SessionManagerConfig;
  /** Resolves an outbox row's original text from a waMessageId (Baileys
   *  getMessage) — injected so `devices` doesn't import `messaging`. */
  resolveOutboxText: (waMessageId: string) => Promise<string | null>;
}

export interface SessionManager {
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  logout(deviceId: string): Promise<void>;
  isConnected(deviceId: string): boolean;
  getCurrentQr(deviceId: string): string | null;
  listGroups(deviceId: string): Promise<GroupInfo[]>;
  resolveJid(deviceId: string, phone: string): Promise<string | null>;
  sendText(deviceId: string, jid: string, text: string): Promise<SendResult>;
  sendImage(
    deviceId: string,
    jid: string,
    payload: SendImagePayload,
  ): Promise<SendResult>;
  sendAudio(
    deviceId: string,
    jid: string,
    payload: SendAudioPayload,
  ): Promise<SendResult>;
  sendVideo(
    deviceId: string,
    jid: string,
    payload: SendVideoPayload,
  ): Promise<SendResult>;
  sendDocument(
    deviceId: string,
    jid: string,
    payload: SendDocumentPayload,
  ): Promise<SendResult>;
  setTyping(deviceId: string, jid: string, on: boolean): Promise<void>;
  closeAll(): void;
}

// The Baileys close error is a Boom; read its status code structurally so we
// don't take a direct @hapi/boom dependency.
const closeStatusCode = (error: unknown): number | undefined =>
  (error as { output?: { statusCode?: number } } | undefined)?.output
    ?.statusCode;

const S = proto.WebMessageInfo.Status;
const mapMessageStatus = (
  status: number | null | undefined,
): DomainMessageStatus | null => {
  switch (status) {
    case S.SERVER_ACK:
      return "SERVER_ACK";
    case S.DELIVERY_ACK:
      return "DELIVERY_ACK";
    case S.READ:
    case S.PLAYED:
      return "READ";
    case S.ERROR:
      return "FAILED";
    default:
      return null;
  }
};

// How long the cached WhatsApp Web version is trusted before a refresh. A
// long-lived process must not pin an increasingly stale version that WhatsApp
// eventually rejects.
const WA_VERSION_TTL_MS = 6 * 60 * 60 * 1000;

// Max consecutive 0-delay reconnects for `restartRequired` (the post-pairing
// 515) before falling back to jittered backoff — a safety valve so a broken
// session can't spin in a tight 0-delay reconnect loop.
const MAX_IMMEDIATE_RECONNECTS = 5;

// ── Rich send helpers ───────────────────────────────────────────────────────

// The socket-readiness gate (openDevices, not just sockets: a socket mid-
// handshake is in the map but not yet open) shared by every send method.
const requireOpenSocket = (
  sockets: Map<string, WASocket>,
  openDevices: Set<string>,
  deviceId: string,
): WASocket => {
  const sock = sockets.get(deviceId);
  if (!sock || !openDevices.has(deviceId)) {
    throw new ServiceUnavailableError(
      "The device is not connected",
      undefined,
      ErrorCodes.DEVICE_OFFLINE,
    );
  }
  return sock;
};

const extractWaMessageId = (
  sent: Awaited<ReturnType<WASocket["sendMessage"]>>,
): string => {
  const waMessageId = sent?.key.id;
  if (!waMessageId) {
    throw new ServiceUnavailableError(
      "The WhatsApp send produced no message id",
      undefined,
      ErrorCodes.DEVICE_OFFLINE,
    );
  }
  return waMessageId;
};

// A media field is a URL or base64 (optionally a data URL). Baileys takes a
// `{ url }` for remote media, or a Buffer for inline bytes.
const HTTP_URL = /^https?:\/\//i;
const toWaMedia = (value: string): { url: string } | Buffer => {
  if (HTTP_URL.test(value)) return { url: value };
  const base64 = value.includes(",")
    ? value.slice(value.indexOf(",") + 1)
    : value;
  return Buffer.from(base64, "base64");
};

// Owner of everything alive: the Map<deviceId, socket>. Translates the Baileys
// `sock.ev` stream into DomainEvents on the bus and carries NO business rule
// (that lives in the handle-session-* use cases). This file, socket-config.ts,
// and prisma-auth-state.ts are the only places Baileys types appear.
export const makeSessionManager = (
  deps: SessionManagerDeps,
): SessionManager => {
  const sockets = new Map<string, WASocket>();
  const openDevices = new Set<string>();
  const pending = new Set<string>();
  // Consecutive failed reconnect attempts per device — drives the backoff.
  // Reset to 0 on a successful `open` so a device that stabilizes recovers its
  // FAST reconnect: a burst of early flaps must not pin it at the 5-min cap
  // forever. Lives here (not in the socket closure) precisely so `open` can
  // clear it across socket generations.
  const reconnectAttempts = new Map<string, number>();
  // Last QR string emitted per device, for the GET /devices/:id/qr poll. Set on
  // a `qr` update, cleared once the socket opens / closes / logs out.
  const lastQr = new Map<string, string>();
  let shuttingDown = false;

  // The WhatsApp Web version, refreshed on a TTL (WA_VERSION_TTL_MS). Re-fetch
  // periodically, but fall back to the cached value if a refresh fails — a
  // network blip must not break an otherwise-fine reconnect.
  let cachedVersion:
    | Awaited<ReturnType<typeof fetchLatestBaileysVersion>>["version"]
    | undefined;
  let cachedVersionAt = 0;
  const resolveVersion = async (): Promise<typeof cachedVersion> => {
    const now = Date.now();
    if (!cachedVersion || now - cachedVersionAt > WA_VERSION_TTL_MS) {
      try {
        cachedVersion = (await fetchLatestBaileysVersion()).version;
        cachedVersionAt = now;
      } catch (error) {
        if (!cachedVersion) throw error; // the first fetch must succeed
        deps.logger.warn(
          { error },
          "failed to refresh WhatsApp version; using cached",
        );
      }
    }
    return cachedVersion;
  };

  const openSocket = async (deviceId: string): Promise<void> => {
    // Reserve the slot SYNCHRONOUSLY, before any await. Otherwise two concurrent
    // opens both pass the `sockets.has` check and create a socket on the SAME
    // authState — two sockets, one Signal key store → corruption. Also bail if
    // shutting down: a reconnect timer must not resurrect a socket after
    // closeAll().
    if (shuttingDown || sockets.has(deviceId) || pending.has(deviceId)) return;
    pending.add(deviceId);

    try {
      const { state, saveCreds } = await makePrismaAuthState(deviceId);
      const version = await resolveVersion();
      const sock = makeWASocket({
        ...baseSocketConfig,
        auth: state,
        version,
        getMessage: async (key: { id?: string | null }) => {
          const text = key.id ? await deps.resolveOutboxText(key.id) : null;
          return text ? { conversation: text } : undefined;
        },
      });
      sockets.set(deviceId, sock);

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on(
        "messages.update",
        (
          updates: Array<{
            key: { id?: string | null };
            update: { status?: number | null };
          }>,
        ) => {
          for (const { key, update } of updates) {
            const raw = update.status;
            const status = mapMessageStatus(raw);
            if (status && key.id) {
              deps.bus.publish({
                type: "session.message_status",
                deviceId,
                waMessageId: key.id,
                status,
              });
            } else if (raw != null && raw !== S.PENDING) {
              deps.logger.warn(
                { deviceId, status: raw },
                "unmapped WhatsApp message status",
              );
            }
          }
        },
      );

      // Group delivery/read is PER-PARTICIPANT: WhatsApp emits no aggregate
      // status on `messages.update` for a group send (that's why a group message
      // would otherwise sit at PENDING forever), so the receipts land here, one
      // per participant. "At least one" semantics: the first participant to
      // receive moves the message to DELIVERY_ACK, the first to read/play to
      // READ. The downstream monotonic guard makes this idempotent and never
      // regresses — so it's also harmless for 1:1 (redundant with the status
      // above). Only our own outbound messages (`fromMe`) carry a send status.
      sock.ev.on(
        "message-receipt.update",
        (
          updates: Array<{
            key: { id?: string | null; fromMe?: boolean | null };
            receipt: {
              receiptTimestamp?: number | null;
              readTimestamp?: number | null;
              playedTimestamp?: number | null;
            };
          }>,
        ) => {
          for (const { key, receipt } of updates) {
            if (!key.fromMe || !key.id) continue;
            const status: DomainMessageStatus | null =
              receipt.readTimestamp != null || receipt.playedTimestamp != null
                ? "READ"
                : receipt.receiptTimestamp != null
                  ? "DELIVERY_ACK"
                  : null;
            if (status) {
              deps.bus.publish({
                type: "session.message_status",
                deviceId,
                waMessageId: key.id,
                status,
              });
            }
          }
        },
      );

      sock.ev.on(
        "connection.update",
        (update: {
          connection?: string;
          lastDisconnect?: { error?: unknown };
          qr?: string;
        }) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            lastQr.set(deviceId, qr);
            deps.bus.publish({ type: "session.qr", deviceId, qr });
          }

          if (connection === "open") {
            openDevices.add(deviceId);
            lastQr.delete(deviceId);
            reconnectAttempts.delete(deviceId); // stable again → reset backoff
            const identifier = sock.user?.id
              ? (jidDecode(sock.user.id)?.user ?? "")
              : "";
            deps.bus.publish({
              type: "session.connected",
              deviceId,
              identifier,
            });
          }

          if (connection === "close") {
            openDevices.delete(deviceId);
            sockets.delete(deviceId);
            lastQr.delete(deviceId);

            if (shuttingDown) return;

            const statusCode = closeStatusCode(lastDisconnect?.error);
            const decision = classifyDisconnect(statusCode);
            const attempt = reconnectAttempts.get(deviceId) ?? 0;

            // The one record of WHY a device dropped — the raw material for a
            // "top causes of disconnection" report (until Onda 2 persists it).
            deps.logger.warn(
              {
                deviceId,
                statusCode,
                reason: decision.reason,
                attempt,
                action: decision.action,
              },
              "whatsapp session closed",
            );

            // Pairing is gone (user unlinked / WhatsApp forced) → re-pair via
            // QR, never reconnect.
            if (decision.action === "logged-out") {
              reconnectAttempts.delete(deviceId);
              deps.bus.publish({ type: "session.logged_out", deviceId });
              return;
            }

            // Every non-logout drop marks the device disconnected, carrying the
            // real reason. The webhook side debounces flaps and the DB update is
            // idempotent, so publishing on each close is safe and yields honest
            // status + observability.
            deps.bus.publish({
              type: "session.disconnected",
              deviceId,
              reason: decision.reason,
            });

            // Banned / protocol-mismatch → reconnecting just hammers a dead
            // number. Stop; leave it DISCONNECTED with the reason logged.
            if (decision.action === "stop") {
              reconnectAttempts.delete(deviceId);
              return;
            }

            // `restartRequired` (the post-pairing 515) reopens immediately —
            // but only for the first few consecutive tries. If it keeps firing
            // without ever reaching `open`, fall back to backoff so a broken
            // session can't spin in a tight 0-delay loop. A successful open
            // resets `attempt`, so the normal one-shot 515 never pays a delay.
            const immediate =
              decision.action === "reconnect-immediate" &&
              attempt < MAX_IMMEDIATE_RECONNECTS;
            const delay = immediate
              ? 0
              : computeReconnectDelay({
                  attempt,
                  baseMs: deps.config.reconnectBaseDelayMs,
                  maxMs: deps.config.reconnectMaxDelayMs,
                  random: Math.random(),
                });
            reconnectAttempts.set(deviceId, attempt + 1);
            // unref so a pending reconnect timer never keeps the event loop
            // alive during graceful shutdown (closeAll() sets shuttingDown, so
            // if it does fire, openSocket returns immediately). Without this the
            // process would wait up to RECONNECT_MAX_DELAY_MS to exit on SIGTERM.
            setTimeout(() => void openSocket(deviceId), delay).unref();
          }
        },
      );
    } catch (error) {
      // Setup failed BEFORE the socket went live — a DB/authState error or a
      // cold version fetch (network down at boot), both awaited before the
      // socket is created/tracked. Don't orphan the device: log it and schedule
      // a backoff retry so it self-heals when the dependency recovers. (Without
      // this, a boot rehydration would surface as an unhandled rejection with
      // no reopen.)
      if (!shuttingDown) {
        const attempt = reconnectAttempts.get(deviceId) ?? 0;
        deps.logger.error(
          { deviceId, error, attempt },
          "failed to open WhatsApp socket; scheduling retry",
        );
        const delay = computeReconnectDelay({
          attempt,
          baseMs: deps.config.reconnectBaseDelayMs,
          maxMs: deps.config.reconnectMaxDelayMs,
          random: Math.random(),
        });
        reconnectAttempts.set(deviceId, attempt + 1);
        setTimeout(() => void openSocket(deviceId), delay).unref();
      }
    } finally {
      pending.delete(deviceId);
    }
  };

  return {
    // Explicit (re)connect: clear any stale backoff so a manual connect starts
    // fresh from attempt 0.
    connect: (deviceId) => {
      reconnectAttempts.delete(deviceId);
      return openSocket(deviceId);
    },

    async disconnect(deviceId) {
      openDevices.delete(deviceId);
      lastQr.delete(deviceId);
      reconnectAttempts.delete(deviceId);
      const sock = sockets.get(deviceId);
      sockets.delete(deviceId);
      sock?.end(undefined); // close, not logout
    },

    async logout(deviceId) {
      openDevices.delete(deviceId);
      lastQr.delete(deviceId);
      reconnectAttempts.delete(deviceId);
      const sock = sockets.get(deviceId);
      sockets.delete(deviceId);
      // Unpair. The in-process state above is already cleared, so a Baileys
      // throw here (e.g. logging out a mid-handshake QR_PENDING socket) must not
      // bubble a 500 — the device is disconnected regardless. Log and swallow.
      if (sock) {
        try {
          await sock.logout();
        } catch (error) {
          deps.logger.warn({ deviceId, error }, "sock.logout failed (ignored)");
        }
      }
    },

    isConnected: (deviceId) => openDevices.has(deviceId),

    getCurrentQr: (deviceId) => lastQr.get(deviceId) ?? null,

    async resolveJid(deviceId, phone) {
      const sock = sockets.get(deviceId);
      if (!sock) return null;
      const results = await sock.onWhatsApp(phone);
      const match = results?.[0];
      return match?.exists ? match.jid : null;
    },

    // The groups the device participates in. `groupFetchAllParticipating` needs
    // a live socket (no offline queue for a read), so the readiness gate throws
    // DEVICE_OFFLINE when the device isn't connected. Map the Baileys
    // GroupMetadata down to the domain GroupInfo here — the only place a group
    // shape crosses into the app.
    async listGroups(deviceId) {
      const sock = requireOpenSocket(sockets, openDevices, deviceId);
      // Map the Baileys metadata down to the domain GroupInfo. Typed via a
      // minimal structural shape (only id + subject) because Baileys'
      // `GroupMetadata` is ambiguously re-exported from the package root and
      // can't be imported by name — this adapter is the anti-corruption boundary.
      const groups = (await sock.groupFetchAllParticipating()) as Record<
        string,
        { id: string; subject: string }
      >;
      return Object.values(groups).map((group) => ({
        jid: group.id,
        name: group.subject,
      }));
    },

    async sendText(deviceId, jid, text) {
      const sock = requireOpenSocket(sockets, openDevices, deviceId);
      const sent = await sock.sendMessage(jid, { text });
      return { waMessageId: extractWaMessageId(sent) };
    },

    async sendImage(deviceId, jid, payload) {
      const sock = requireOpenSocket(sockets, openDevices, deviceId);
      const sent = await sock.sendMessage(jid, {
        image: toWaMedia(payload.image),
        ...(payload.caption ? { caption: payload.caption } : {}),
      });
      return { waMessageId: extractWaMessageId(sent) };
    },

    async sendAudio(deviceId, jid, payload) {
      const sock = requireOpenSocket(sockets, openDevices, deviceId);
      const sent = await sock.sendMessage(jid, {
        audio: toWaMedia(payload.audio),
        mimetype: "audio/mp4",
        ptt: true,
      });
      return { waMessageId: extractWaMessageId(sent) };
    },

    async sendVideo(deviceId, jid, payload) {
      const sock = requireOpenSocket(sockets, openDevices, deviceId);
      const sent = await sock.sendMessage(jid, {
        video: toWaMedia(payload.video),
        ...(payload.caption ? { caption: payload.caption } : {}),
      });
      return { waMessageId: extractWaMessageId(sent) };
    },

    async sendDocument(deviceId, jid, payload) {
      const sock = requireOpenSocket(sockets, openDevices, deviceId);
      const sent = await sock.sendMessage(jid, {
        document: toWaMedia(payload.document),
        fileName: payload.fileName ?? "document",
        ...(payload.caption ? { caption: payload.caption } : {}),
      });
      return { waMessageId: extractWaMessageId(sent) };
    },

    // Best-effort "typing…" presence. No-op when the socket isn't open —
    // presence is cosmetic and must never throw into a send path (unlike the
    // send* methods, which surface DEVICE_OFFLINE). Mirrors requireOpenSocket's
    // readiness check without the throw. `composing` shows typing; `paused`
    // clears it. WhatsApp auto-expires `composing` after ~10s — the caller
    // (roadmap E3) is responsible for refreshing it during a long typing window.
    // KNOWN UNKNOWN (resolve at E1's live-validation gate): some Baileys setups
    // need an `available` presence before `composing` renders to the recipient.
    // If so, E3 must send `available` first — captured here so it isn't lost.
    async setTyping(deviceId, jid, on) {
      const sock = sockets.get(deviceId);
      if (!sock || !openDevices.has(deviceId)) return;
      await sock.sendPresenceUpdate(on ? "composing" : "paused", jid);
    },

    // Graceful shutdown: close() every socket, NEVER logout() — logout wipes the
    // pairing. The sockets rehydrate from authState on boot.
    closeAll() {
      shuttingDown = true;
      for (const sock of sockets.values()) sock.end(undefined);
      sockets.clear();
      openDevices.clear();
      lastQr.clear();
      reconnectAttempts.clear();
    },
  };
};
