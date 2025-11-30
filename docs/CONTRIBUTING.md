# Contributing

Thanks for wanting to contribute! This is a small, focused guide to help you get started and make review easier.

## Quick setup

1. Fork the repo and create a feature branch from `master`:

```bash
git checkout -b feat/short-description
```

2. Install and run locally:

```bash
npm install
cp .env.example .env   # optional: uses local sqlite at prisma/dev.db
npx prisma generate
npm run db:push
npm run dev            # development (ts-node)
# or
npm run tui            # start the TUI
```

## Branch & commit guidance

- Use short branch names: `feat/`, `fix/`, `chore/`, `docs/`.
- Keep commits focused and atomic. Follow a simple commit message style:

  ```text
  <type>(scope): short description
  ```

  e.g. `feat(tui): add project import flow`

## Conventional Commits

- This project follows the Conventional Commits specification to keep the history readable and enable automation (release notes, changelogs, semantic versioning).
- Commit messages should follow the form:

  ```text
  type(scope?): short summary
  ```

  where type is one of: feat, fix, docs, style, refactor, perf, test, chore, ci, build

  Examples:
  - `feat(tui): add project import flow`
  - `fix(api): handle missing relay responses`
  - `docs: update development quickstart`

- Commit messages are validated with `commitlint` and a `husky` `commit-msg` hook. To enable this locally:

```bash
npm install
npm run prepare   # run husky install
chmod +x .husky/commit-msg  # ensure hook is executable if necessary
```

If a commit is rejected, `commitlint` will print the reason — adjust your message and try again.

## Testing & build

- Run unit tests before opening a PR:

```bash
npm test
```

- Verify TypeScript build if your change affects types or production code:

```bash
npm run build
```

## PR checklist

- [ ] Branch created from latest `master`
- [ ] Tests added/updated and passing locally
- [ ] Build succeeds (`npm run build`)
- [ ] No sensitive data committed (do not commit `.env` or private keys)
- [ ] `DEVELOPMENT.md` or `README.md` updated if the change affects developer workflow

## Reporting issues

- Open an issue with a short title, steps to reproduce, expected vs actual behavior, and any relevant logs. All issues are being tracked with NostrTrack.

## Communication

- Add context in your PR description and link any related issues. If your change touches Nostr relays or keys, describe expected behavior and privacy considerations.

Thank you — small, focused contributions make the project better for everyone.
