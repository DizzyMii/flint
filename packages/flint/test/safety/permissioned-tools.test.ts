import { describe, expect, it } from 'vitest';
import { tool } from '../../src/primitives/tool.ts';
import { permissionedTools } from '../../src/safety/permissioned-tools.ts';
import type { StandardSchemaV1 } from '../../src/types.ts';

function anySchema(): StandardSchemaV1<unknown, unknown> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (raw) => ({ value: raw }),
    },
  };
}

const read = tool({
  name: 'read',
  description: 'read',
  input: anySchema(),
  handler: () => 'r',
  permissions: { scopes: ['read'] },
});

const write = tool({
  name: 'write',
  description: 'write',
  input: anySchema(),
  handler: () => 'w',
  permissions: { scopes: ['write'], destructive: true },
});

const del = tool({
  name: 'delete',
  description: 'delete',
  input: anySchema(),
  handler: () => 'd',
  permissions: { scopes: ['write', 'admin'], destructive: true },
});

const all = [read, write, del];

describe('permissionedTools', () => {
  it('returns all tools when options are empty', () => {
    expect(permissionedTools(all, {})).toHaveLength(3);
  });

  it('allow keeps only named tools', () => {
    const out = permissionedTools(all, { allow: ['read', 'write'] });
    expect(out.map((t) => t.name)).toEqual(['read', 'write']);
  });

  it('deny filters out named tools', () => {
    const out = permissionedTools(all, { deny: ['delete'] });
    expect(out.map((t) => t.name)).toEqual(['read', 'write']);
  });

  it('filter predicate drops tools when false', () => {
    const out = permissionedTools(all, {
      filter: (t) => !t.permissions?.destructive,
    });
    expect(out.map((t) => t.name)).toEqual(['read']);
  });

  it('requireScopes keeps tools that have all listed scopes', () => {
    const out = permissionedTools(all, { requireScopes: ['admin'] });
    expect(out.map((t) => t.name)).toEqual(['delete']);
  });

  it('requireScopes requires ALL listed scopes (AND)', () => {
    const out = permissionedTools(all, { requireScopes: ['write', 'admin'] });
    expect(out.map((t) => t.name)).toEqual(['delete']);
  });

  it('combines allow and requireScopes (AND)', () => {
    const out = permissionedTools(all, {
      allow: ['write', 'delete'],
      requireScopes: ['admin'],
    });
    expect(out.map((t) => t.name)).toEqual(['delete']);
  });

  it('returns a new array (does not mutate input)', () => {
    const out = permissionedTools(all, { allow: ['read'] });
    expect(out).not.toBe(all);
    expect(all).toHaveLength(3);
  });

  it('treats tools without permissions.scopes as empty scope set', () => {
    const scopeless = tool({
      name: 'scopeless',
      description: 'x',
      input: anySchema(),
      handler: () => null,
    });
    const out = permissionedTools([scopeless], { requireScopes: ['read'] });
    expect(out).toHaveLength(0);
  });
});
