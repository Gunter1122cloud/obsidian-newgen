import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, openSync, closeSync } from "node:fs";
import { hostname, cpus } from "node:os";
import { statfs } from "node:fs/promises";
import { queryWindowsProcessResources, cpuPercentFromDeltas } from "../backend/infra/process/windows-process-sample";
import { parseListPlayersResponse } from "../backend/domains/backups/list-players";
import { join, isAbsolute } from "node:path";
import { createServer, type Server, type TLSSocket } from "node:tls";
import type { InstanceService } from "../backend/domains/instances/instance-service";

const MAX_FRAME = 16384;
const snowflake = /^\d{17,20}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const privateIp = (ip: string): boolean => {
  if (typeof ip !== "string") return false;
  const parts = ip.split(".");
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168);
};

interface ControlSettings {
  bindIp: string;
  botIp: string;
  port: number;
  tokenSha256: string;
  guildId: string;
  controlChannelId: string;
  statusChannelId: string;
  serviceUserId: string;
  roleIds: string[];
  certPath: string;
  keyPath: string;
}

type Request = {
  requestId: string;
  credential: string;
  guildId: string;
  channelId: string;
  userId: string;
  roleIds: string[];
  sentUtc: string;
  kind: string;
  action?: string;
  mapIds?: string[];
  mapId?: string;
};

export function validDiscordControlSettings(s: ControlSettings): boolean {
  return (
    privateIp(s.bindIp) &&
    privateIp(s.botIp) &&
    Number.isInteger(s.port) &&
    s.port > 1024 &&
    s.port <= 65535 &&
    /^[0-9a-f]{64}$/i.test(s.tokenSha256) &&
    [s.guildId, s.controlChannelId, s.statusChannelId, s.serviceUserId].every((id) => snowflake.test(id)) &&
    s.controlChannelId !== s.statusChannelId &&
    Array.isArray(s.roleIds) &&
    s.roleIds.length > 0 &&
    s.roleIds.length <= 20 &&
    s.roleIds.every((id) => snowflake.test(id) && id !== s.guildId) &&
    isAbsolute(s.certPath) &&
    isAbsolute(s.keyPath)
  );
}

export function authorizeDiscordControl(s: ControlSettings, q: Request, now = Date.now()): boolean {
  if (
    !q ||
    typeof q.credential !== "string" ||
    !/^[0-9a-f]{64}$/i.test(q.credential) ||
    typeof q.requestId !== "string" ||
    !uuid.test(q.requestId) ||
    typeof q.sentUtc !== "string" ||
    q.guildId !== s.guildId ||
    !snowflake.test(q.userId) ||
    !Number.isFinite(Date.parse(q.sentUtc)) ||
    Math.abs(now - Date.parse(q.sentUtc)) > 60000
  ) {
    return false;
  }
  if (!timingSafeEqual(createHash("sha256").update(q.credential).digest(), Buffer.from(s.tokenSha256, "hex"))) {
    return false;
  }
  if (q.userId === s.serviceUserId) {
    return q.channelId === s.statusChannelId && ["status", "players"].includes(q.kind);
  }
  return (
    q.channelId === s.controlChannelId &&
    ["status", "players", "execute"].includes(q.kind) &&
    Array.isArray(q.roleIds) &&
    q.roleIds.length <= 100 &&
    q.roleIds.some((id) => s.roleIds.includes(id))
  );
}

const ok = (data: unknown) => ({ ok: true, data });
const denied = (error: string) => ({ ok: false, error });

type Metric = { cpuSeconds: number; atMs: number; startedAt: string | null };

export async function dispatchDiscordControl(
  instances: Pick<InstanceService, "list" | "statuses" | "start" | "stop" | "restart" | "sendRcon" | "execRcon">,
  q: Request,
  hostId: string,
  claim: (id: string) => boolean,
  canExecute: () => boolean,
  priorMetrics = new Map<number, Metric>(),
): Promise<unknown> {
  const profiles = instances.list();
  if (q.kind === "status") {
    const states = new Map(instances.statuses().map((s) => [s.serverId, s]));
    const now = Date.now();
    const resources = await queryWindowsProcessResources(
      [...states.values()].flatMap((state) => state.processLive && state.pid !== null ? [state.pid] : []),
    );
    const nextMetrics = new Map<number, Metric>();
    const maps = await Promise.all(profiles.map(async (p) => {
      const state = states.get(p.id);
      const pid = state?.processLive ? state.pid : null;
      const sample = pid == null ? undefined : resources.get(pid);
      const prior = pid == null ? undefined : priorMetrics.get(pid);
      const cpu = sample && prior && prior.startedAt === state?.startedAt
        ? cpuPercentFromDeltas({ prevCpuSeconds: prior.cpuSeconds, nextCpuSeconds: sample.cpuSeconds, prevAtMs: prior.atMs, nextAtMs: now })
        : null;
      if (pid != null && sample && state) nextMetrics.set(pid, { cpuSeconds: sample.cpuSeconds, atMs: now, startedAt: state.startedAt });
      const disk = await statfs(p.installDir).catch(() => null);
      return {
        mapId: p.id,
        mapName: p.name,
        running: state?.status === "running" && state.processLive,
        confirmedStopped: false,
        status: state?.processLive ? state.status : "unknown",
        pid,
        uptimeSeconds: state?.processLive && state.startedAt ? Math.max(0, Math.floor((now - Date.parse(state.startedAt)) / 1000)) : null,
        playerCount: null,
        memoryMiB: sample ? Math.round(sample.workingSetBytes / 1048576) : null,
        cpuPercent: cpu == null ? null : cpu / Math.max(1, cpus().length),
        freeBytes: disk ? disk.bavail * disk.bsize : null,
        totalBytes: disk ? disk.blocks * disk.bsize : null,
        storeV1: p.extraArgs.some((arg) => /^-usestore$/i.test(arg)),
        useApi: p.useAsaApi,
      };
    }));
    priorMetrics.clear();
    for (const [pid, sample] of nextMetrics) priorMetrics.set(pid, sample);
    return ok({
      hostId,
      hostName: hostname(),
      observedUtc: new Date(now).toISOString(),
      maps,
    });
  }
  if (q.kind === "players") {
    const p = profiles.find((row) => row.id === q.mapId);
    if (!p) return denied("UM-DC-MAP-NOT-FOUND");
    const state = instances.statuses().find((row) => row.serverId === p.id);
    if (state?.status !== "running" || !state.processLive) return ok({ mapId: p.id, playerCount: null });
    const raw = await instances.execRcon(p.id, "ListPlayers", { recordEvent: false });
    const players = parseListPlayersResponse(raw);
    const count = players.length > 0 || /^No Players Connected\.?$/i.test(raw.trim()) ? players.length : null;
    return ok({ mapId: p.id, playerCount: count, observedUtc: new Date().toISOString() });
  }
  if (
    q.kind !== "execute" ||
    !Array.isArray(q.mapIds) ||
    q.mapIds.length !== 1 ||
    !profiles.some((p) => p.id === q.mapIds![0]) ||
    !["start", "stop", "restart", "save", "wipe"].includes(q.action ?? "")
  ) {
    return denied("UM-DC-METHOD-DENIED");
  }
  const id = q.mapIds[0]!;
  if (!canExecute()) return denied("UM-DC-MANAGER-CLOSING");
  if (!claim(q.requestId)) return denied("UM-DC-DUPLICATE-REQUEST");
  switch (q.action) {
    case "start":
      await instances.start(id);
      break;
    case "stop":
      await instances.stop(id);
      break;
    case "restart":
      await instances.restart(id);
      break;
    case "save":
    case "wipe": {
      const state = instances.statuses().find((row) => row.serverId === id);
      if (state?.status !== "running" || !state.processLive) return denied("UM-DC-SERVER-NOT-RUNNING");
      await instances.sendRcon(id, q.action === "save" ? "SaveWorld" : "DestroyWildDinos");
      break;
    }
  }
  return ok({ operationId: q.requestId, action: q.action, mapId: id, state: "dispatched" });
}

/** Disabled unless explicitly provisioned on the local host. No engine or server files are modified. */
export function startDiscordControl(
  profileRoot: string,
  instances: InstanceService,
  canExecute: () => boolean,
): Server | null {
  const configPath = join(profileRoot, "discord-control.json");
  if (!existsSync(configPath)) return null;
  try {
    const s = JSON.parse(readFileSync(configPath, "utf8")) as ControlSettings;
    if (!validDiscordControlSettings(s)) throw new Error("Invalid Discord control settings");
    const receipts = join(profileRoot, "discord-request-ids");
    mkdirSync(receipts, { recursive: true });
    const claim = (id: string): boolean => {
      try {
        closeSync(openSync(join(receipts, id.toLowerCase()), "wx"));
        return true;
      } catch {
        return false;
      }
    };
    const sockets = new Set<TLSSocket>();
    const priorMetrics = new Map<number, Metric>();
    const server = createServer(
      { cert: readFileSync(s.certPath), key: readFileSync(s.keyPath), minVersion: "TLSv1.2" },
      (socket) => {
        if (socket.remoteAddress !== s.botIp || sockets.size >= 8) {
          socket.destroy();
          return;
        }
        sockets.add(socket);
        socket.once("close", () => sockets.delete(socket));
        socket.on("error", () => socket.destroy());
        socket.setTimeout(10000, () => socket.destroy());
        let bytes = Buffer.alloc(0);
        let handled = false;
        socket.on("data", (chunk: Buffer) => {
          if (handled || bytes.length + chunk.length > MAX_FRAME + 4) {
            socket.destroy();
            return;
          }
          bytes = Buffer.concat([bytes, chunk]);
          if (bytes.length < 4) return;
          const length = bytes.readUInt32BE(0);
          if (length < 2 || length > MAX_FRAME || bytes.length > length + 4) {
            socket.destroy();
            return;
          }
          if (bytes.length !== length + 4) return;
          handled = true;
          socket.setTimeout(0);
          const send = (response: unknown): void => {
            if (socket.destroyed) return;
            const payload = Buffer.from(JSON.stringify(response), "utf8");
            const size = Buffer.alloc(4);
            size.writeUInt32BE(payload.length);
            socket.end(Buffer.concat([size, payload]));
          };
          void (async () => {
            const q = JSON.parse(bytes.subarray(4).toString("utf8")) as Request;
            if (!authorizeDiscordControl(s, q)) return denied("UM-DC-UNAUTHORIZED");
            return dispatchDiscordControl(instances, q, hostname(), claim, canExecute, priorMetrics);
          })().then(send, () => send(denied("UM-DC-REQUEST-FAILED-NO-REPLAY")));
        });
      },
    );
    server.on("error", () => console.warn("Discord control listener unavailable"));
    server.on("close", () => {
      for (const socket of sockets) socket.destroy();
    });
    server.listen(s.port, s.bindIp);
    return server;
  } catch {
    console.warn("Discord control configuration unavailable or invalid");
    return null;
  }
}
