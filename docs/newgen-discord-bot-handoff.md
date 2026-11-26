# Obsidian Command NewGen — Discord bot handoff

Implement this in the existing Node.js Discord bot, not in the NewGen server engine. The authoritative protocol and provisioning requirements are in [newgen-discord-control.md](newgen-discord-control.md). The implementation is a preview until tested with a disposable server and both hosts.

## Host configuration

- Configure independent TLS endpoints for UK-HOME-01 (HP, blue) and UK-HOME-02 (Ryzen, red); use each actual LAN address. Keep credentials and certificate fingerprints local, outside Git and logs.
- Each manager has a local `discord-control.json` with its own bearer SHA-256, TLS key/certificate, bind IP, bot IP, port, guild/channel IDs and allowed role IDs. Restrict the firewall to the bot's private IP.
- Pin the actual certificate fingerprint and require TLS 1.2 or higher. Never expose these ports to the internet or disable certificate validation without an explicit verified pin.

## Protocol

One request per TLS connection. Encode a four-byte unsigned big-endian length followed by UTF-8 JSON. Use a new UUID for each request and current ISO UTC timestamp. Read a length-prefixed JSON response. Requests include `requestId`, `credential`, `guildId`, `channelId`, `userId`, `roleIds`, `sentUtc`, and `kind`.

- Read fleet state: `kind=status`.
- Read players: `kind=players`, `mapId`.
- Execute: `kind=execute`, `mapIds=[one current NewGen server ID]`, `action=start|stop|restart|save|wipe`.

Fetch IDs from each host's status response; never reuse the old Manager IDs. Treat unknown CPU/RAM/player readings as unknown, not zero. Keep separate status and control channels. Freshly verify guild membership and role permissions for each control interaction, and validate channel privacy. Owner and Admin roles should be configured identically where authorized. Read-only service user must never execute. A timed-out control must not be retried automatically; rediscover status. An accepted response is not proof of game readiness or completed save.

## Acceptance

- Existing bot remains responsible for embeds/buttons and role verification; keep existing message IDs and avoid duplicates.
- Maintain the two host colors and a distinct Event map card. Discover new maps from each host independently.
- Test read-only access, role/channel denial, replay rejection, invalid certificate, unavailable host, unknown map, and each fixed action on an isolated disposable server.
- Do not modify the live ARK installation, start/stop any production map, expose secrets, or migrate existing bot configuration without explicit host-side approval.
- Report actual results separately from mocked tests. Do not claim live compatibility until both hosts and the actual Discord bot are verified.
