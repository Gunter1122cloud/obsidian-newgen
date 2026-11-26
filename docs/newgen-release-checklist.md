# NewGen release checklist

Do not publish a production-ready installer merely because packaging succeeds. The current development branches must pass the original Windows CI (typecheck, lint, format, knip, tests and Electron E2E). The tagged release must be the current main commit with a successful push CI. Verify Setup, Portable, latest.yml and SHA256SUMS. Keep the original GPL-3.0 license and source available.

The first installation is separate from the old Obsidian manager. Do not replace its files or start imported instances until migration, process adoption, shared cluster/Store, and Discord acceptance are verified on a disposable Windows host. Two managers must never control the same live process concurrently.

Repository owner: enable Actions on the fork. CurseForge metadata is independent of Windows packaging and GitHub app updates. A shared proxy URL is optional; if configured it must be an authorized HTTPS endpoint. Without one, metadata search requires local configuration. Existing mod IDs are preserved. Never embed a personal API key in the distributed application or Git history.

This checklist does not certify that migration or live control is implemented.
