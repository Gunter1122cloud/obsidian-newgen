# NewGen release checklist

Do not publish a production-ready installer merely because packaging succeeds. The current development branches must pass the original Windows CI (typecheck, lint, format, knip, tests and Electron E2E). The tagged release must be the current main commit with a successful push CI. Verify Setup, Portable, latest.yml and SHA256SUMS. Keep the original GPL-3.0 license and source available.

The first installation is separate from the old Obsidian manager. Do not replace its files or start imported instances until migration, process adoption, shared cluster/Store, and Discord acceptance are verified on a disposable Windows host. Two managers must never control the same live process concurrently.

Repository owner: enable Actions on the fork, and configure the existing CurseForge proxy variable using a proxy you are authorized to use. The existing release workflow deliberately fails rather than ship a package with unavailable metadata. Do not use the upstream project's credentials or silently bypass this gate.

This checklist does not certify that migration or live control is implemented.
