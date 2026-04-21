---
layout: home

hero:
  image:
    src: /logo.png
    alt: Flint
  name: Flint
  tagline: Token-efficient agentic TypeScript runtime
  text: Six primitives. One agent loop. No magic.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: View on GitHub
      link: https://github.com/DizzyMii/flint

features:
  - icon: ⚡
    title: Six composable primitives
    details: call, stream, validate, tool, execute, count — combine them yourself. No hidden orchestration.
  - icon: 🪙
    title: Budget-aware by default
    details: Hard caps on steps, tokens, and dollars. Every agent loop enforces them automatically.
  - icon: 🌊
    title: Streaming first
    details: Native AsyncIterable<StreamChunk> support. No callback soup, no buffering by default.
  - icon: 🔒
    title: Safety included
    details: Injection detection, output redaction, permission checks, and approval gates ship in core.
  - icon: 🔌
    title: Pluggable adapters
    details: Swap LLM providers without changing agent code. Anthropic and OpenAI-compatible adapters included.
  - icon: 🗺️
    title: State machine workflows
    details: The @flint/graph package adds typed state machine workflows with memory checkpointing.
---

<div style="text-align:center;margin:2rem 0;padding:1rem;background:var(--vp-c-bg-soft);border-radius:8px;border:1px solid var(--vp-c-warning-2)">
  <strong>v0 · under active development · not yet published to npm</strong><br>
  <span style="font-size:0.9em">API may change before 1.0. <a href="/flint/guide/v0-status">See stability notes.</a></span>
</div>
