# NostrTrack (Nostr-native, TUI-first)

NostrTrack is a Nostr-native, terminal-first project tracker built for small distributed teams. It treats Nostr events as the canonical, censorship-resistant event stream and uses a local Prisma + SQLite database as an optional offline cache and working set. Identity is pubkey-first (Nostr keys), and projects/tickets use UUIDs so they can be created and referenced safely across disconnected peers.

## Quick summary

- Canonical store: Nostr relays — signed events are the source of truth and carry provenance (pubkey, sig).
- Local cache: Prisma + SQLite (file: `prisma/dev.db`) — fast, offline-friendly cache that is safe to recreate.
- Identity: Nostr pubkeys are first-class identities; no centralized user accounts.
- Identifiers: UUIDs for projects and tickets to ensure distributed uniqueness across peers.
- UX: TUI-first CLI workflow for speed and privacy; optional locally hosted web UI available.

## Development & contributing

The full development quickstart, environment notes, and contributor guidelines live in separate docs to keep this `README` focused.

- [Development quickstart](./docs/DEVELOPMENT.md): commands to install, generate Prisma client, run the TUI, and reset the local DB.

- [Contribution guidelines and commit conventions](./docs/CONTRIBUTING.md): branch/commit guidance, testing/build checks, and Conventional Commits instructions.

- [Vision & impact](./docs/ABOUT.md): project description and guiding principles.

### Quick install (short)

```bash
git clone https://github.com/TheRealCheebs/nostrtrack.git
cd nostrtrack
npm install
cp .env.example .env   # optional: uses local sqlite at prisma/dev.db
npx prisma generate
npm run db:push
```

---

## Scripts

- `npm run build` — compile TypeScript (`tsc`)
- `npm run dev` — run in dev mode with `ts-node` (entry: `src/index.ts`)
- `npm run test` — run unit tests (Vitest)
- `npm run tui` — run the TUI via `npx tsx ./src/app/main.ts`
- `npm run db:push` — push Prisma schema to the DB

---

## TUI (terminal UI) usage

The primary user interface is a terminal-based UI (TUI). Run it with:

```bash
npm run tui
```

This launches the interactive TUI implemented under `src/tui` and wired from `src/app/main.ts`.

## Getting started

Quick: run the TUI (recommended):

```bash
npm run tui
```

## Running a local Nostr relay (for testing)

For reproducible local testing we include a Compose file at `dev/docker-compose.yml`. It uses scsibus's `nostr-rs-relay` by default and maps the relay to `wss://localhost:7000`.

Start the relay with Docker Compose:

```bash
docker compose -f dev/docker-compose.yml up -d
```

If you use Podman, your existing command works too (equivalent form):

```bash
podman run -it --rm -p 7000:8080 \
  -v $(pwd)/data:/usr/src/app/db \
  -v $(pwd)/config.toml:/usr/src/app/config.toml:ro \
  --name nostr-relay docker.io/scsibug/nostr-rs-relay:0.9.0
```

Default relay URL: `ws://localhost:7000` — add this URL to your relays configuration so the app will connect. You can either:

- Open the TUI → Settings → Modify Relays and add `ws://localhost:7000`, or
- Create `~/.config/nostrtrack/relays.json` with:

```json
{ "relays": ["ws://localhost:7000"] }
```

License: MIT
