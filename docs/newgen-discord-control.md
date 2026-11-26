# NewGen Discord Control (preview)

Separate opt-in TLS transport, not a replacement server engine. The original instance service owns Start/Stop/Restart and RCON. No bot token in the manager. No extra confirmation protocol: an authorized execute request invokes the normal service once.

On each Windows host, provision a TLS key/certificate in a private ACL-protected directory; set up a unique random 32-byte hex bearer and SHA-256 of its UTF-8 hex string. Configure the bot to pin each host's certificate fingerprint before sending credentials. Restrict inbound firewall to the bot's private IP, never forward the port to the internet.

Create discord-control.json under the NewGen local app-data directory (not in Git). Keys: bindIp, botIp, port, tokenSha256, guildId, controlChannelId, statusChannelId, serviceUserId, roleIds, certPath, keyPath. Distinct private status/control channels; only the configured owner/admin roles may send commands. The bot is responsible for freshly fetching actual guild membership and verifying channel privacy. The service user can only read status and player count.

Transport: TLS 1.2+, one request/connection, 4-byte unsigned big-endian length then UTF-8 JSON. Request fields: requestId UUID, credential (64 hex), guildId, channelId, userId, roleIds, sentUtc ISO, kind. Status: kind=status. Players: kind=players and mapId. Control: kind=execute, mapIds=[one registered NewGen ID], action=start|stop|restart|save|wipe. Response {ok,data} or {ok:false,error}. Dispatch is not proof of game readiness or save completion. No arbitrary RCON, no retry of a timed-out request. Persistent request IDs prevent replay; they do not lock server lifecycle. CPU is normalized over logical processors; unknown observations remain null. Untracked processes are not assumed stopped. Map IDs differ from the old Manager; always rediscover from status.

Disabled without local config, packaged builds only. Windows CI, actual TLS transport, host provisioning and disposable-server acceptance still required. Existing bot must be adapted to this subset of the legacy wire contract. No real server, bot, firewall or credentials changed in CI.
