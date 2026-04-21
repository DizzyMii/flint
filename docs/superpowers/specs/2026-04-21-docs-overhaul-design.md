# Flint Docs Overhaul — Design Spec

**Date:** 2026-04-21  
**Status:** Approved

## Goal

Make Flint's documentation professional-grade: a polished README for GitHub/npm discoverability, a full VitePress docs site with guide, API reference, and examples, and automated GitHub Pages deployment. Tone is honest about v0 status throughout.

---

## 1. Logo

**Source:** `C:\Users\KadeHeglin\Downloads\Gemini_Generated_Image_szk0svszk0svszk0.png`  
**Destination:** `docs/public/logo.png`

Copy the image file into the repo. It is referenced from:
- The root `README.md` (centered, `width="200"`)
- The VitePress config as `logo: '/logo.png'` (appears in site navbar)

No image processing needed — copy as-is.

---

## 2. README Rewrite

**File:** `README.md` (root)

### Structure (top to bottom)

1. **Logo** — centered `<img src="docs/public/logo.png" width="200" alt="Flint">`
2. **Tagline** — `Token-efficient agentic TypeScript runtime`
3. **Badges row** — static version badge (v0 — not yet on npm so use `img.shields.io/badge/version-v0-orange`), license (MIT), docs deploy status, node ≥20, TypeScript. Omit npm version badge until published.
4. **Nav links** — `[Docs](https://dizzymii.github.io/flint)` · `[API Reference](https://dizzymii.github.io/flint/primitives/call)` · `[Examples](https://dizzymii.github.io/flint/examples/basic-call)`
5. **Pitch paragraph** — 2–3 sentences. What Flint is, what makes it different (no framework magic, composable primitives). Include the v0 honest caveat inline.
6. **Install block** — `npm install flint @flint/adapter-anthropic`
7. **Quick start** — two examples side by side: one-shot `call()` then `agent()` with a tool + budget. Verbatim working code from the current README (already verified).
8. **What you get** — four subsections with bullet lists: Core (`flint`), Adapters, Graph, Platform
9. **Package table** — four-row table: package name, description
10. **Why Flint** — short bulleted contrast vs heavier frameworks: one dependency, no classes/chains, Standard Schema, budget-aware, streaming-first, safety included
11. **Links** — Docs site, Contributing guide, License

### Tone

Honest. "v0 · under development · not yet published" remains visible. No marketing superlatives. Short sentences.

---

## 3. VitePress Site

### Setup

- **Location:** `docs/` (existing directory; internal design specs remain in `docs/superpowers/` and are excluded from nav)
- **VitePress version:** latest stable (^1.x)
- **Config file:** `docs/.vitepress/config.ts`
- **Root package.json scripts added:**
  - `"docs:dev": "vitepress dev docs"`
  - `"docs:build": "vitepress build docs"`
  - `"docs:preview": "vitepress preview docs"`
- **VitePress added to root devDependencies**

### Config (`docs/.vitepress/config.ts`)

```ts
export default defineConfig({
  title: 'Flint',
  description: 'Token-efficient agentic TypeScript runtime',
  base: '/flint/',           // GitHub Pages subpath
  logo: '/logo.png',
  themeConfig: {
    nav: [ Home, Guide, API, Examples, GitHub link ],
    sidebar: { ... },        // see sidebar structure below
    socialLinks: [{ icon: 'github', link: '...' }],
    footer: { message: 'MIT License' }
  }
})
```

### Sidebar Structure

```
Guide
  ├── What is Flint?          guide/index.md
  ├── Installation            guide/installation.md
  ├── Quick Start             guide/quick-start.md
  └── v0 Status               guide/v0-status.md

Primitives
  ├── call()                  primitives/call.md
  ├── stream()                primitives/stream.md
  ├── validate()              primitives/validate.md
  ├── tool()                  primitives/tool.md
  ├── execute()               primitives/execute.md
  ├── count()                 primitives/count.md
  └── agent()                 primitives/agent.md

Features
  ├── Budget                  features/budget.md
  ├── Compress & Pipeline     features/compress.md
  ├── Memory                  features/memory.md
  ├── RAG                     features/rag.md
  ├── Recipes                 features/recipes.md
  ├── Safety                  features/safety.md
  └── Graph                   features/graph.md

Adapters
  ├── Anthropic               adapters/anthropic.md
  ├── OpenAI-Compatible       adapters/openai-compat.md
  └── Writing an Adapter      adapters/custom.md

Examples
  ├── Basic Call              examples/basic-call.md
  ├── Tool Use                examples/tools.md
  ├── Agent Loop              examples/agent.md
  ├── Streaming               examples/streaming.md
  └── ReAct Pattern           examples/react-pattern.md
```

### Home Page (`docs/index.md`)

VitePress `layout: home` with:
- `hero`: tagline "Token-efficient agentic TypeScript runtime", subtext "Six primitives. One agent loop. No magic.", two action buttons (Get Started → /guide/, View on GitHub → external)
- `features`: six feature boxes — 6 Primitives, Budget-aware, Streaming-first, Safety included, Adapter pattern, Graph workflows

### Page Content Standard

Every page follows:
1. **Title** (h1) — matches sidebar label
2. **One-sentence description**
3. **Overview paragraph** — what this module does and when to use it
4. **API signature(s)** — TypeScript type block
5. **Parameters table** — name, type, required, description
6. **Return value** — type + description
7. **Code example(s)** — working, minimal
8. **See also** — links to related pages

For v0 pages where behavior may change: a `:::warning v0 API` callout at the top.

### v0-status.md

Dedicated page explaining:
- What v0 means for Flint (API may change before 1.0, not yet published to npm)
- What is considered stable (primitive signatures, adapter interface)
- What may change (compress transform signatures, recipes API, graph DSL)
- How to pin versions and watch for changes

---

## 4. GitHub Actions

**File:** `.github/workflows/docs.yml`

```yaml
name: Deploy docs
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm docs:build
      - uses: actions/upload-pages-artifact@v3
        with: { path: docs/.vitepress/dist }

  deploy:
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

GitHub Pages must be enabled in repo Settings → Pages → Source: GitHub Actions.

---

## 5. .gitignore Updates

Add:
```
docs/.vitepress/dist
docs/.vitepress/cache
.superpowers/
```

---

## 6. Out of Scope

- Auto-generated API docs from TypeScript source (e.g. TypeDoc) — hand-written docs give better narrative control for a v0 library
- Versioned docs (VitePress versioning plugin) — one version only until v1
- i18n / translations
- Blog / changelog page — changelogs live in `.changeset/`
- Search plugin (VitePress default local search is sufficient)

---

## 7. File Delivery Summary

| Action | File |
|---|---|
| Copy logo | `docs/public/logo.png` |
| Rewrite | `README.md` |
| Create | `docs/.vitepress/config.ts` |
| Create | `docs/index.md` |
| Create | `docs/guide/index.md`, `installation.md`, `quick-start.md`, `v0-status.md` |
| Create | `docs/primitives/call.md`, `stream.md`, `validate.md`, `tool.md`, `execute.md`, `count.md`, `agent.md` |
| Create | `docs/features/budget.md`, `compress.md`, `memory.md`, `rag.md`, `recipes.md`, `safety.md`, `graph.md` |
| Create | `docs/adapters/anthropic.md`, `openai-compat.md`, `custom.md` |
| Replace | `examples/README.md` — rewrite with links to VitePress examples section and brief code snippets |
| Create | `docs/examples/basic-call.md`, `tools.md`, `agent.md`, `streaming.md`, `react-pattern.md` |
| Create | `CONTRIBUTING.md` — minimal: clone, pnpm install, build, test, docs:dev |
| Update | `package.json` (docs scripts + vitepress devDep) |
| Create | `.github/workflows/docs.yml` |
| Update | `.gitignore` |
