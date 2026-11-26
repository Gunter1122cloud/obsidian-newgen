import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** The key is provisioned once per Windows user, outside the install directory and update payload. */
export function createLocalCurseForgeKeyReader(): () => Promise<string | null> {
  let pending: Promise<string | null> | undefined;
  return () => {
    pending ??= readLocalKey();
    return pending;
  };
}

async function readLocalKey(): Promise<string | null> {
  if (process.platform !== "win32" || !process.env.LOCALAPPDATA) return null;
  const file = join(process.env.LOCALAPPDATA, "ObsidianCommandNewGen", "curseforge-key.dpapi");
  if (!existsSync(file)) return null;
  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  const powershell = join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const command = [
    "$ErrorActionPreference = 'Stop'",
    "$secret = Get-Content -LiteralPath $env:OBSIDIAN_KEY_FILE -Raw | ConvertTo-SecureString",
    "$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)",
    "try { [Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)) }",
    "finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $secret.Dispose() }",
  ].join("; ");
  try {
    const { stdout } = await execFileAsync(
      powershell,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
      {
        env: { ...process.env, OBSIDIAN_KEY_FILE: file },
        windowsHide: true,
        timeout: 10_000,
        maxBuffer: 4096,
      },
    );
    return stdout.trim() || null;
  } catch {
    // Never surface subprocess output, command details or the credential in application logs.
    throw new Error(
      "Could not read the local CurseForge credential. Run the local key setup again and restart NewGen.",
    );
  }
}
