# Development quickstart

This file is a concise checklist for getting the project running locally for development.

## Prerequisites

- Node.js (recommended: Node 18+)
- npm
- Git
- (Optional) Docker + Docker Compose (or podman) if you want to run a local Nostr relay

## Quickstart

### 1) Clone and install dependencies

```bash
git clone https://github.com/TheRealCheebs/nostrtrack.git
cd nostrtrack
npm install
```

### 2) Prepare environment

- Copy the example env file if you want to use the included SQLite dev DB:

```bash
cp .env.example .env
```

### 3) Generate Prisma client and push schema

```bash
npx prisma generate
npm run db:push
```

### Notes

- The local dev DB file is stored at `prisma/dev.db` by default. If it's removed, `npm run db:push` will recreate the schema.
- Application-specific relay configuration is stored per-user at: `~/.config/nostrtrack/relays.json`.

## Common commands

- Run the interactive TUI (recommended):

```bash
npm run tui
```

- Run in development mode (ts-node):

```bash
npm run dev
```

- Run the compiled build (after `npm run build`):

```bash
npm run build
npm start
```

- Run tests (Vitest):

```bash
npm test
# or
npm run test:ui
```

## Resetting the local DB

- To reset the SQLite dev DB (start fresh):

```bash
rm -f prisma/dev.db
npm run db:push
```

## Troubleshooting

- Prisma errors about client not found: run `npx prisma generate`.
- If `keytar` or other native deps fail to install on Linux, make sure you have system build tools and libsecret installed (Debian/Ubuntu example):

```bash
sudo apt-get update
sudo apt-get install build-essential libsecret-1-dev
```

- If the app complains about relays being missing, open the TUI and go to Settings → Modify Relays, or create `~/.config/nostrtrack/relays.json` with contents like:

```json
{ "relays": ["wss://relay.damus.io", "wss://nostr-pub.wellorder.net"] }
```

## Security notes

- Do not commit `.env` or private keys to source control. A `.env.example` is included to show the expected variables.

## Active development — relay caution

This project is still under active development. When publishing events to Nostr relays you should be careful:

- Prefer a local relay or relays you control for testing. The `dev/docker-compose.yml` provides a safe local relay you can use.
- Only publish to relays you trust and that explicitly accept the project's custom event kinds/tags (projects/tickets). Public relays may reject unknown kinds or expose test data to third parties.
- Avoid publishing sensitive or production data to public relays while the protocol and event formats are evolving.
- If you must use public relays for testing, use throwaway identities or limit the scope of test events.

When in doubt, run a local relay (see below) or coordinate with the relay operator before publishing non-trivial events.

## Local relay with Docker Compose

If you want a reproducible local relay for testing, start the included compose file located at `dev/docker-compose.yml`:

```bash
docker compose -f dev/docker-compose.yml up -d
```

**Default relay URL:** `ws://localhost:7000`

Add that to your relays config so the app will connect (TUI → Settings → Modify Relays), or create `~/.config/nostrtrack/relays.json` with:

```json
{ "relays": ["ws://localhost:7000"] }
```

Before starting the relay, provide a minimal `config.toml` and a `data` directory. A sample `dev/config.toml.example` is included — copy it to the project root:

```bash
cp dev/config.toml.example ./config.toml
mkdir -p data
```

Then start the relay. The relay will persist its DB under `./data`.
