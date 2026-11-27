import { spawnSync } from "node:child_process";

// WGS 1.5.44: Copyright (c) 2025 Windows Game Server Contributors.
// MIT license: see THIRD_PARTY_NOTICES.md.
// The Electron host runs the original C# block in Windows PowerShell.
// Its .NET GC applies to the helper process, not the Electron heap.
const script = `Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class WgsRamOptimization
{
    [DllImport("psapi.dll", SetLastError = true)]
    private static extern bool EmptyWorkingSet(IntPtr hProcess);

    public static void Run()
    {
        GC.Collect(GC.MaxGeneration, GCCollectionMode.Forced, blocking: true);
        try
        {
            foreach (var p in Process.GetProcesses())
                try { EmptyWorkingSet(p.Handle); } catch { }
        }
        catch { }
    }
}
'@
[WgsRamOptimization]::Run()
`;

/** Original WGS pre-launch global working-set trim. */
export function optimizeRamBeforeStart(): void {
  if (process.platform !== "win32") return;
  try {
    spawnSync("powershell.exe", ["-NoProfile", "-NoLogo", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      stdio: "ignore",
    });
  } catch {
    // WGS ignores inaccessible processes / optimization failures.
  }
}
