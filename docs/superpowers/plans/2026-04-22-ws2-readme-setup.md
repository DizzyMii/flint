# WS2: README Setup Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `## Setup` section to README.md between `## Install` and `## Quick start` covering API key configuration, TypeScript config, ESM requirement, and a verification snippet.

**Architecture:** Single file edit to README.md. Insert new section at a specific location.

**Tech Stack:** Markdown

---

### Task 1: Add Setup section to README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read README.md and locate the insertion point**

Read `README.md`. Find the line `## Quick start` — the new section goes immediately before it.

- [ ] **Step 2: Insert the Setup section**

Immediately before the line `## Quick start`, insert this exact content (preserve the blank lines):

```markdown
## Setup

### API key

Flint's Anthropic adapter reads your API key from the environment:

```sh
export ANTHROPIC_API_KEY=sk-ant-...
```

Or use a `.env` file with `dotenv`:

```sh
npm install dotenv
```

```ts
import 'dotenv/config';
import { anthropicAdapter } from '@flint/adapter-anthropic';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });
```

### TypeScript config

Flint requires `moduleResolution: "bundler"` (or `"node16"` / `"nodenext"`) and `strict: true`. Minimum `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist"
  }
}
```

### ESM

Flint is ESM-only. Add `"type": "module"` to your `package.json`:

```json
{
  "type": "module"
}
```

If you're using a bundler (Vite, esbuild, tsup) this is handled automatically.

### Verify your setup

Run this snippet to confirm everything is wired up:

```ts
import { call } from 'flint';
import { anthropicAdapter } from '@flint/adapter-anthropic';

const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });
const res = await call({
  adapter,
  model: 'claude-haiku-4-5-20251001',
  messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
});
console.log(res.ok ? res.value.message.content : res.error.message);
// → "ready"
```

```

- [ ] **Step 3: Verify structure**

Confirm README.md now has this order:

```
## Install
## Setup      ← new
## Quick start
```

Run: `grep "^## " README.md`

Expected to include these three lines in this order:
```
## Install
## Setup
## Quick start
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): add Setup section with API key, tsconfig, ESM, and verification"
```
