import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  authorizeDiscordControl,
  dispatchDiscordControl,
  validDiscordControlSettings,
} from "../src/main/discord-control";
import type { InstanceService } from "../src/backend/domains/instances/instance-service";

const guild = "100000000000000001";
const control = "100000000000000002";
const status = "100000000000000003";
const service = "100000000000000004";
const admin = "100000000000000005";
const user = "100000000000000006";
const credential = "a".repeat(64);
const now = Date.parse("2026-11-26T12:00:00Z");
const id = "12345678-1234-1234-1234-123456789012";
const config = {
  bindIp: "192.168.1.10",
  botIp: "192.168.1.11",
  port: 18443,
  tokenSha256: createHash("sha256").update(credential).digest("hex"),
  guildId: guild,
  controlChannelId: control,
  statusChannelId: status,
  serviceUserId: service,
  roleIds: [admin],
  certPath: process.platform === "win32" ? "C:\\local\\cert.pem" : "/local/cert.pem",
  keyPath: process.platform === "win32" ? "C:\\local\\key.pem" : "/local/key.pem",
};
const request = {
  requestId: id,
  credential,
  guildId: guild,
  channelId: control,
  userId: user,
  roleIds: [admin],
  sentUtc: new Date(now).toISOString(),
  kind: "execute",
  action: "restart",
  mapIds: [id],
};

function fixture() {
  const profile = { id, name: "Island", installDir: ".", extraArgs: ["-usestore"], useAsaApi: true };
  const handlers = {
    list: vi.fn().mockReturnValue([profile]),
    statuses: vi.fn().mockReturnValue([{ serverId: id, status: "running", processLive: true, pid: 10 }]),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    restart: vi.fn().mockResolvedValue(undefined),
    sendRcon: vi.fn().mockResolvedValue(""),
    execRcon: vi.fn().mockResolvedValue("No Players Connected"),
  };
  return { handlers, instances: handlers as unknown as InstanceService };
}

describe("NewGen Discord control", () => {
  it("allows only a private host and scoped authorized requests", () => {
    expect(validDiscordControlSettings(config)).toBe(true);
    expect(validDiscordControlSettings({ ...config, bindIp: "0.0.0.0" })).toBe(false);
    expect(validDiscordControlSettings({ ...config, roleIds: [guild] })).toBe(false);
    expect(authorizeDiscordControl(config, request, now)).toBe(true);
    expect(authorizeDiscordControl(config, { ...request, credential: "b".repeat(64) }, now)).toBe(false);
    expect(authorizeDiscordControl(config, { ...request, roleIds: [] }, now)).toBe(false);
    expect(authorizeDiscordControl(config, { ...request, channelId: status }, now)).toBe(false);
    expect(authorizeDiscordControl(config, request, now + 61000)).toBe(false);
    const serviceRequest = { ...request, userId: service, channelId: status };
    expect(authorizeDiscordControl(config, { ...serviceRequest, kind: "status" }, now)).toBe(true);
    expect(authorizeDiscordControl(config, serviceRequest, now)).toBe(false);
  });

  it("dispatches the original lifecycle only once, with no external approval", async () => {
    const { handlers, instances } = fixture();
    const claim = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    const execute = () => dispatchDiscordControl(instances, request, "host", claim, () => true);
    expect(await execute()).toMatchObject({ ok: true });
    expect(await execute()).toMatchObject({ ok: false });
    expect(handlers.restart).toHaveBeenCalledExactlyOnceWith(id);
  });

  it("allows only fixed RCON commands for a tracked running server", async () => {
    const { handlers, instances } = fixture();
    const execute = (action: string) => {
      return dispatchDiscordControl(
        instances,
        { ...request, action },
        "host",
        () => true,
        () => true,
      );
    };
    for (const action of ["save", "wipe"]) {
      expect(await execute(action)).toMatchObject({ ok: true });
    }
    expect(handlers.sendRcon).toHaveBeenNthCalledWith(1, id, "SaveWorld");
    expect(handlers.sendRcon).toHaveBeenNthCalledWith(2, id, "DestroyWildDinos");
    expect(await execute("rcon")).toMatchObject({ ok: false });
    handlers.statuses.mockReturnValue([]);
    expect(await execute("wipe")).toMatchObject({ ok: false });
    expect(handlers.sendRcon).toHaveBeenCalledTimes(2);
  });
});
