import { type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { findWindowsChildProcessByName } from "./windows-child-process";
import type { ServerProfile } from "@shared/types";
import {
  LEFT_RUNNING_SCHEMA_VERSION,
  classifyLeaveCandidate,
  type LeftRunningProcessIdentity,
  type LiveProcessIdentity,
} from "@shared/settings/left-running";
import { AsaSavedLogsTailer, captureAsaLogSessionAnchor } from "./asa-log-tail";
import { disconnectChildStdio } from "./process-spawn";
import type { ProcessStartManaged } from "./process-start";

type LeaveManagedProcess = ProcessStartManaged;

function samePath(a: string | null, b: string): boolean {
  return a !== null && a.replace(/\\/g, "/").toLowerCase() === b.replace(/\\/g, "/").toLowerCase();
}

function serverExe(installDir: string, name: string): string {
  return join(installDir, "ShooterGame", "Binaries", "Win64", name);
}

/** Revalidate the Loader independently: never treat an arbitrary reused PID as ASA. */
export async function verifiedLoaderIdentity(
  installDir: string,
  game: LiveProcessIdentity | null,
  knownPid: number | null | undefined,
  queryOs: (pid: number) => Promise<LiveProcessIdentity | null>,
  previous?: LeftRunningProcessIdentity["loaderIdentity"],
): Promise<LeftRunningProcessIdentity["loaderIdentity"]> {
  const expected = serverExe(installDir, "AsaApiLoader.exe");
  const isLoader = game !== null && samePath(game.executablePath, expected);
  const pid = isLoader ? game.pid : (knownPid ?? game?.parentPid);
  if (pid === undefined || pid === null || pid <= 0) return undefined;
  const live = isLoader ? game : await queryOs(pid);
  if (
    live === null || live.pid !== pid || !samePath(live.executablePath, expected) || !live.osCreationTime ||
    (previous !== undefined && (previous.pid !== pid || previous.osCreationTime !== live.osCreationTime)) ||
    (!isLoader && game?.parentPid !== pid)
  ) return undefined;
  return { pid, executablePath: expected, osCreationTime: live.osCreationTime };
}

export interface ProcessLeaveHost {
  isActive(serverId: string): boolean;
  getManaged(serverId: string): LeaveManagedProcess | undefined;
  queryOsIdentity(pid: number): Promise<LiveProcessIdentity | null>;
  appendRuntimeLog(serverId: string, source: string, message: string): void;
  stopManagedCapture(serverId: string, managed: LeaveManagedProcess): void;
  deleteManaged(serverId: string): void;
  emitStatus(serverId: string): void;
  createAdoptedChild(pid: number): ChildProcess;
  setManaged(serverId: string, managed: LeaveManagedProcess): void;
  writeProcessCheckpoint(
    serverId: string,
    managed: LeaveManagedProcess,
    live?: LiveProcessIdentity | null,
  ): Promise<void>;
  captureRuntimeChunk(serverId: string, source: "log", text: string): void;
  onManagedExit(serverId: string, managed: LeaveManagedProcess, code: number | null): void;
  waitUntilReady(
    profile: ServerProfile,
    managed: LeaveManagedProcess,
    generation: number,
    options?: { terminateOnTimeout?: boolean },
  ): Promise<void>;
}

/**
 * Snapshot process identities for durable recovery metadata.
 * Requires OS creation time so the next launch can reject PID reuse.
 */
export async function collectLeaveIdentities(
  host: ProcessLeaveHost,
  profiles: ServerProfile[],
  options?: {
    queryOsIdentity?: (pid: number) => Promise<LiveProcessIdentity | null>;
    leftAt?: string;
  },
): Promise<LeftRunningProcessIdentity[]> {
  const queryOs = options?.queryOsIdentity ?? ((pid: number) => host.queryOsIdentity(pid));
  const leftAt = options?.leftAt ?? new Date().toISOString();
  const records: LeftRunningProcessIdentity[] = [];

  for (const profile of profiles) {
    const managed = host.getManaged(profile.id);
    if (managed === undefined || !host.isActive(profile.id)) {
      continue;
    }
    const pid = managed.child.pid;
    if (pid === undefined || !Number.isInteger(pid) || pid <= 0) {
      throw new Error(`Cannot leave "${profile.name}" running: process id is unavailable`);
    }

    const live = await queryOs(pid);
    const osCreationTime = live?.osCreationTime?.trim() || null;
    if (osCreationTime === null) {
      throw new Error(
        `Cannot leave "${profile.name}" running: OS process creation time is unavailable (needed to reject PID reuse)`,
      );
    }

    const loaderIdentity = await verifiedLoaderIdentity(
      managed.installDir, live, managed.loaderPid, queryOs, managed.loaderIdentity,
    );
    records.push({
      schemaVersion: LEFT_RUNNING_SCHEMA_VERSION,
      serverId: profile.id,
      pid,
      executablePath: managed.executablePath,
      installDir: managed.installDir,
      startedAt: managed.startedAt,
      expectedCommandLine: managed.expectedCommandLine,
      launchArgs: [...managed.launchArgs],
      runtimePorts: { ...managed.runtimePorts },
      ...(loaderIdentity !== undefined ? { loaderIdentity } : {}),
      osCreationTime,
      osExecutablePath: live?.executablePath ?? null,
      leftAt,
    });
  }

  return records;
}

/**
 * Detach previously snapshotted Leave processes (after durable metadata write).
 */
export function detachAfterLeavePersist(host: ProcessLeaveHost, records: LeftRunningProcessIdentity[]): void {
  // Validate every record before detaching any server.
  for (const record of records) {
    const managed = host.getManaged(record.serverId);
    if (managed !== undefined && host.isActive(record.serverId) && managed.child.pid !== record.pid) {
      throw new Error(`Cannot detach "${record.serverId}": process id changed since Leave snapshot`);
    }
  }
  for (const record of records) {
    const managed = host.getManaged(record.serverId);
    if (managed === undefined || !host.isActive(record.serverId)) {
      continue;
    }

    host.appendRuntimeLog(
      record.serverId,
      "system",
      `Detaching for Leave running (pid ${record.pid}); process stays alive`,
    );
    host.stopManagedCapture(record.serverId, managed);
    managed.readinessGeneration += 1;
    disconnectChildStdio(managed.child);
    try {
      managed.child.unref();
    } catch {
      // Ignore: some test fakes omit unref.
    }
    if (host.getManaged(record.serverId) === managed) {
      host.deleteManaged(record.serverId);
      host.emitStatus(record.serverId);
    }
  }
}

/**
 * @deprecated Prefer {@link collectLeaveIdentities} + {@link detachAfterLeavePersist}.
 */
export async function detachForLeave(
  host: ProcessLeaveHost,
  profiles: ServerProfile[],
  options?: {
    queryOsIdentity?: (pid: number) => Promise<LiveProcessIdentity | null>;
    leftAt?: string;
  },
): Promise<LeftRunningProcessIdentity[]> {
  const records = await collectLeaveIdentities(host, profiles, options);
  detachAfterLeavePersist(host, records);
  return records;
}

/**
 * Reattach to a validated crash-recovery process (same profile + OS identity).
 */
export async function reattachManagedProcess(
  host: ProcessLeaveHost,
  profile: ServerProfile,
  record: LeftRunningProcessIdentity,
  options?: {
    skipReadinessCheck?: boolean;
    queryOsIdentity?: (pid: number) => Promise<LiveProcessIdentity | null>;
  },
): Promise<void> {
  if (host.isActive(profile.id)) {
    throw new Error(`Server "${profile.name}" is already running`);
  }
  if (record.serverId !== profile.id) {
    throw new Error("Leave identity serverId does not match profile");
  }
  if (!Number.isInteger(record.pid) || record.pid <= 0) {
    throw new Error("Leave identity has an invalid process id");
  }

  const queryOs = options?.queryOsIdentity ?? ((pid: number) => host.queryOsIdentity(pid));
  const live = await queryOs(record.pid);
  const classification = classifyLeaveCandidate(record, live);
  if (classification !== "match") {
    throw new Error(`Leave identity for "${profile.name}" failed re-validation (${classification})`);
  }

  let gameRecord = record;
  let gameLive = live;
  if (samePath(record.executablePath, serverExe(record.installDir, "AsaApiLoader.exe"))) {
    const pid = await findWindowsChildProcessByName(record.pid, "ArkAscendedServer.exe");
    const candidate = pid === null ? null : await queryOs(pid);
    const expected = serverExe(record.installDir, "ArkAscendedServer.exe");
    if (candidate === null || candidate.parentPid !== record.pid || !samePath(candidate.executablePath, expected) || !candidate.osCreationTime) {
      throw new Error("ASA Loader is present but the game child is not yet verified");
    }
    gameRecord = { ...record, pid: candidate.pid, executablePath: expected, osExecutablePath: expected, osCreationTime: candidate.osCreationTime };
    gameLive = candidate;
  }
  const loaderIdentity = await verifiedLoaderIdentity(
    record.installDir, gameLive, record.loaderIdentity?.pid, queryOs, record.loaderIdentity,
  );
  const child = host.createAdoptedChild(gameRecord.pid);
  const runtimePorts = record.runtimePorts ?? {
    gamePort: profile.gamePort,
    queryPort: profile.queryPort,
    rconPort: profile.rconPort,
  };
  const managed: LeaveManagedProcess = {
    child,
    identity: {},
    status: "starting",
    startedAt: record.startedAt,
    lastError: null,
    readinessGeneration: 0,
    logTailer: null,
    logSessionAnchor: captureAsaLogSessionAnchor(record.installDir),
    executablePath: gameRecord.executablePath,
    installDir: record.installDir,
    launchArgs: [...record.launchArgs],
    expectedCommandLine: record.expectedCommandLine,
    runtimePorts: { ...runtimePorts },
    adminPassword: profile.adminPassword,
    asaApiLoading: false,
    loaderPid: loaderIdentity?.pid ?? null,
    loaderIdentity,
  };
  host.setManaged(profile.id, managed);
  host.appendRuntimeLog(profile.id, "system", `Reattached to left-running process (pid ${gameRecord.pid})`);
  void host.writeProcessCheckpoint(profile.id, managed, gameLive);

  managed.logTailer = new AsaSavedLogsTailer(profile.installDir, (text) => {
    if (host.getManaged(profile.id) !== managed) return;
    host.captureRuntimeChunk(profile.id, "log", text);
  });
  managed.logTailer.start(managed.logSessionAnchor);
  host.appendRuntimeLog(profile.id, "system", "Waiting for RCON readiness after crash-recovery reattach…");
  host.emitStatus(profile.id);

  child.once("exit", (code) => {
    host.onManagedExit(profile.id, managed, code);
  });

  if (options?.skipReadinessCheck === true) {
    managed.status = "running";
    host.appendRuntimeLog(profile.id, "system", "Readiness skipped after reattach; status running");
    host.emitStatus(profile.id);
    return;
  }

  managed.readinessGeneration += 1;
  void host.waitUntilReady(
    {
      ...profile,
      gamePort: managed.runtimePorts.gamePort,
      queryPort: managed.runtimePorts.queryPort,
      rconPort: managed.runtimePorts.rconPort,
    },
    managed,
    managed.readinessGeneration,
    {
      terminateOnTimeout: false,
    },
  );
}
