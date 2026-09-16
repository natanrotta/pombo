import { assertSafeOutboundUrl, isPrivateAddress } from "./ssrf-guard";
import { ErrorCodes } from "@shared/error/error-codes";

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "127.255.255.254",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1", // CGNAT
    "0.0.0.0",
    "224.0.0.1", // multicast
    "255.255.255.255",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1", // v4-mapped loopback
    "::ffff:10.0.0.5",
    "::ffff:7f00:1", // the same mapped loopback in the hex form `URL` emits
    "::ffff:a00:5",
    "::127.0.0.1", // deprecated IPv4-compatible form
    "::7f00:1", // …as `URL` normalizes it
    "::a00:5",
    "64:ff9b::169.254.169.254", // NAT64 well-known prefix → cloud metadata
    "64:ff9b::a9fe:a9fe",
    "64:ff9b:1::a9fe:a9fe", // NAT64 local-use prefix (/48)
    "64:ff9b:1:0:0:0:a9fe:a9fe",
    "2002:7f00:1::", // 6to4 → 127.0.0.1
    "2002:a9fe:a9fe::1", // 6to4 → 169.254.169.254
  ])("blocks %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "172.32.0.1", // just outside 172.16/12
    "192.169.0.1", // just outside 192.168/16
    "100.128.0.1", // just outside CGNAT
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
    "::ffff:808:808", // 8.8.8.8 mapped, hex form
    "::808:808", // 8.8.8.8, IPv4-compatible form
    "64:ff9b::808:808", // 8.8.8.8 through NAT64
    "64:ff9c::a9fe:a9fe", // NOT the NAT64 prefix — an ordinary global address
    "2002:808:808::", // 6to4 → 8.8.8.8
  ])("allows %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it("treats anything unparseable as private (fail closed)", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
    expect(isPrivateAddress("999.1.1.1")).toBe(true);
    expect(isPrivateAddress("")).toBe(true);
  });
});

describe("assertSafeOutboundUrl", () => {
  beforeEach(() => lookupMock.mockReset());

  const expectBlocked = async (url: string) =>
    expect(assertSafeOutboundUrl(url)).rejects.toMatchObject({
      code: ErrorCodes.OUTBOUND_URL_BLOCKED,
    });

  it("rejects non-http(s) schemes without resolving anything", async () => {
    await expectBlocked("ftp://example.com/x");
    await expectBlocked("file:///etc/passwd");
    await expectBlocked("gopher://example.com");
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed URL", async () => {
    await expectBlocked("not a url");
  });

  it("rejects a private IP literal without resolving", async () => {
    await expectBlocked("http://127.0.0.1:6379/");
    await expectBlocked("http://169.254.169.254/latest/meta-data/");
    await expectBlocked("http://[::1]/");
    await expectBlocked("http://[::ffff:10.0.0.1]/");
    await expectBlocked("http://[::127.0.0.1]/");
    await expectBlocked("http://[64:ff9b::169.254.169.254]/");
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("allows a public IP literal", async () => {
    await expect(
      assertSafeOutboundUrl("https://8.8.8.8/hook"),
    ).resolves.toBeUndefined();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("allows a hostname whose every record is public", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);
    await expect(
      assertSafeOutboundUrl("https://example.com/hook"),
    ).resolves.toBeUndefined();
    expect(lookupMock).toHaveBeenCalledWith("example.com", {
      all: true,
      verbatim: true,
    });
  });

  it("rejects a hostname that resolves to a private address", async () => {
    lookupMock.mockResolvedValue([{ address: "10.0.0.8", family: 4 }]);
    await expectBlocked("https://internal.corp/hook");
  });

  it("rejects a MIXED answer (the DNS-rebinding shape) — one private record is enough", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expectBlocked("https://rebind.example/hook");
  });

  it("rejects a host that does not resolve", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    await expectBlocked("https://does-not-exist.invalid/hook");
    lookupMock.mockResolvedValue([]);
    await expectBlocked("https://empty.invalid/hook");
  });
});
