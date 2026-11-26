# NewGen: personal CurseForge API access

The NewGen Windows preview does not require a shared CurseForge proxy to build or receive GitHub app updates.

For metadata search without a proxy, run [configure-curseforge-key.ps1](../scripts/configure-curseforge-key.ps1) once as the Windows account that runs NewGen. The prompt is hidden. Windows DPAPI encrypts the key for the current account and machine under `%LOCALAPPDATA%\ObsidianCommandNewGen\curseforge-key.dpapi`. It is outside the installer and remains across upgrades. Configure each host/account separately; do not copy the encrypted file to another PC.

Restart NewGen to load the key. The packaged Electron main process sends it only to the official HTTPS CurseForge API, with redirects disabled. The renderer and the GitHub release do not receive the key. An explicitly configured authorized proxy retains precedence.

Without either configuration, existing mod IDs are preserved, but live metadata/search are unavailable. The GitHub application updater is unaffected. Never publish keys, place them in GitHub repository variables, or bake them into downloadable EXEs. Rotate a key that has already been exposed.

This implements local provisioning, not a hosted proxy or an in-app credential entry dialog. Live API and Windows credential provisioning require host-side acceptance.
