# Infrastructure

The LAN database entry point remains `../compose.yaml` to preserve the existing Compose project and PostgreSQL volume. Run `npm run db` from the project root; configuration comes from the root `.env`.

TLS ingress, TURN and SFU deployment belong here when Internet hosting is approved and available. None is required or deployed in the current LAN build. See [architecture](../docs/ARCHITECTURE.md) and [LAN guide](../docs/LAN_GUIDE.md).
