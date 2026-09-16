import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { BadRequestError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

/**
 * Outbound-fetch guard (SEC-C6). The API fetches URLs a customer typed — the
 * webhook sender is an SSRF surface by construction. This is the allowlist
 * side of the contract: only `http(s)`, only hosts that resolve to PUBLIC
 * addresses. Everything a request from inside the network could reach but a
 * stranger on the internet could not (loopback, RFC 1918, link-local — the
 * cloud metadata endpoint lives there —, CGNAT, ULA, multicast, unspecified)
 * is refused.
 *
 * Generic on purpose: it knows nothing about webhooks, so it can guard any
 * future outbound call (`shared/` rule — zero domain knowledge).
 */

const IPV4_PRIVATE_BLOCKS: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 8], // 0.0.0.0/8      "this" network / unspecified
  [0x0a000000, 8], // 10.0.0.0/8     RFC 1918
  [0x64400000, 10], // 100.64.0.0/10 CGNAT
  [0x7f000000, 8], // 127.0.0.0/8    loopback
  [0xa9fe0000, 16], // 169.254.0.0/16 link-local (cloud metadata)
  [0xac100000, 12], // 172.16.0.0/12  RFC 1918
  [0xc0000000, 24], // 192.0.0.0/24   IETF protocol assignments
  [0xc0a80000, 16], // 192.168.0.0/16 RFC 1918
  [0xc6120000, 15], // 198.18.0.0/15  benchmarking
  [0xe0000000, 4], // 224.0.0.0/4    multicast
  [0xf0000000, 4], // 240.0.0.0/4    reserved + broadcast
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

function isPrivateIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return true; // unparseable → never trust it
  return IPV4_PRIVATE_BLOCKS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) >>> 0 === base;
  });
}

/**
 * The 8 16-bit groups of an IPv6 address, or null when unparseable. Accepts
 * the `::` gap and a trailing dotted quad (`::ffff:10.0.0.1`) — `URL`
 * normalizes the latter to hex groups (`::ffff:a00:1`), DNS answers and
 * direct callers may still hand over the dotted form.
 */
function expandIpv6(ip: string): number[] | null {
  let text = ip;
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted) {
    const v4 = ipv4ToInt(dotted[1]!);
    if (v4 === null) return null;
    text =
      text.slice(0, -dotted[1]!.length) +
      `${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string): number[] =>
    part === "" ? [] : part.split(":").map((group) => parseInt(group, 16));
  const head = parse(halves[0]!);
  const tail = halves.length === 2 ? parse(halves[1]!) : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...head, ...new Array<number>(missing).fill(0), ...tail];
  return groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff)
    ? groups
    : null;
}

/**
 * The IPv4 address an IPv6 address embeds in its last 32 bits, for every
 * transition form a `URL` or a resolver can produce: IPv4-mapped
 * (`::ffff:0:0/96`), the deprecated IPv4-compatible form (`::/96`, e.g.
 * `::127.0.0.1` → `::7f00:1`), the NAT64 well-known prefixes
 * (`64:ff9b::/96`, `64:ff9b:1::/48`) — the classic blocklist bypass on
 * IPv6-only networks — and 6to4 (`2002:V4V4:V4V4::/16`, the IPv4 sits in
 * groups 1-2). Null when the address embeds nothing.
 */
function embeddedIpv4(groups: number[]): string | null {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const zeroPrefix = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  const mapped = zeroPrefix && g5 === 0xffff;
  const compatible = zeroPrefix && g5 === 0;
  const nat64 =
    g0 === 0x64 &&
    g1 === 0xff9b &&
    ((g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) || g2 === 1);
  if (g0 === 0x2002) return `${g1 >> 8}.${g1 & 0xff}.${g2 >> 8}.${g2 & 0xff}`;
  if (!mapped && !compatible && !nat64) return null;
  return `${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`;
}

function isPrivateIpv6(ip: string): boolean {
  const groups = expandIpv6(ip.toLowerCase());
  if (groups === null) return true; // unparseable → never trust it
  const embedded = embeddedIpv4(groups);
  if (embedded !== null) return isPrivateIpv4(embedded); // covers :: and ::1 too
  const first = groups[0]!;
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7  ULA
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8  multicast
  return false;
}

/** True when `ip` (v4 or v6) is NOT a routable public address. Pure. */
export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true;
}

function blocked(reason: string): BadRequestError {
  return new BadRequestError(
    `Outbound URL blocked: ${reason}`,
    undefined,
    ErrorCodes.OUTBOUND_URL_BLOCKED,
  );
}

/**
 * Throws `BadRequestError(OUTBOUND_URL_BLOCKED)` unless `rawUrl` is an
 * `http(s)` URL whose host resolves ONLY to public addresses.
 *
 * Resolution happens here, at call time, so the caller must invoke this right
 * before each `fetch` (not once at validation time): a hostname can change what
 * it points at between validation and delivery (DNS rebinding). The residual
 * window between this lookup and the socket's own lookup is documented and
 * accepted — closing it would mean connecting by IP and losing TLS/SNI.
 */
export async function assertSafeOutboundUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw blocked("malformed URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw blocked(`scheme ${url.protocol} not allowed`);
  }
  // `URL.hostname` keeps the brackets around an IPv6 literal.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host.length === 0) throw blocked("empty host");

  if (isIP(host)) {
    if (isPrivateAddress(host)) throw blocked("private address");
    return;
  }

  let addresses: ReadonlyArray<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw blocked("host does not resolve");
  }
  if (addresses.length === 0) throw blocked("host does not resolve");
  // ALL records must be public — a mixed answer is the rebinding trick.
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw blocked("host resolves to a private address");
  }
}
