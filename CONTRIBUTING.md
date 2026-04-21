# Contributing to Flint

Flint is in v0 and the codebase is actively evolving. Contributions are welcome.

## Setup

```sh
git clone https://github.com/DizzyMii/flint.git
cd flint
pnpm install
```

## Build

```sh
pnpm build          # build all packages
pnpm typecheck      # TypeScript type check
pnpm lint           # Biome lint
pnpm format         # Biome format (writes)
```

## Test

```sh
pnpm test           # run all tests (vitest)
```

Tests live in `packages/<name>/test/`. Flint uses real integration-style tests where possible — the mock adapter in `flint/testing` makes this straightforward without an actual API key.

## Docs

```sh
pnpm docs:dev       # start VitePress dev server at localhost:5173
pnpm docs:build     # build static site to docs/.vitepress/dist
pnpm docs:preview   # preview the built site
```

Documentation lives in `docs/`. All pages are Markdown.

## Submitting changes

1. Fork the repo and create a branch: `git checkout -b feat/my-change`
2. Make your changes with tests
3. Run `pnpm test && pnpm typecheck && pnpm lint`
4. Open a pull request against `main`

For breaking changes or new packages, open an issue first to discuss.

## Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning.

```sh
pnpm changeset      # describe your change
```

A changeset file is required for any change that affects a published package's behavior.
