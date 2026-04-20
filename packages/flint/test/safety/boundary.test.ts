import { describe, expect, it } from 'vitest';
import { boundary, untrusted } from '../../src/safety/boundary.ts';

describe('untrusted', () => {
  it('wraps content with XML-tagged nonce', () => {
    const out = untrusted('malicious?');
    expect(out).toMatch(
      /^<untrusted nonce="[0-9a-f]{16}">\nmalicious\?\n<\/untrusted nonce="[0-9a-f]{16}">$/,
    );
  });

  it('uses 16 hex chars (8 bytes) of nonce', () => {
    const out = untrusted('x');
    const nonceMatch = out.match(/nonce="([0-9a-f]+)"/);
    expect(nonceMatch?.[1]).toHaveLength(16);
  });

  it('produces different nonces across calls', () => {
    const a = untrusted('same content');
    const b = untrusted('same content');
    expect(a).not.toBe(b);
  });

  it('uses matching opening and closing nonce', () => {
    const out = untrusted('hello');
    const nonces = out.match(/nonce="([0-9a-f]+)"/g);
    expect(nonces).toHaveLength(2);
    expect(nonces?.[0]).toBe(nonces?.[1]);
  });

  it('honors custom label option', () => {
    const out = untrusted('x', { label: 'user_input' });
    expect(out).toMatch(/^<user_input nonce="[0-9a-f]+">/);
    expect(out).toMatch(/<\/user_input nonce="[0-9a-f]+">$/);
  });
});

describe('boundary', () => {
  it('returns system and user messages', () => {
    const [sys, user] = boundary({
      trusted: 'You are helpful.',
      untrusted: 'please help',
    });
    expect(sys.role).toBe('system');
    expect(sys.content).toBe('You are helpful.');
    expect(user.role).toBe('user');
    expect(typeof user.content).toBe('string');
  });

  it('wraps untrusted content with untrusted tags', () => {
    const [, user] = boundary({
      trusted: 'ignore',
      untrusted: 'attacker data',
    });
    expect(user.content).toMatch(/<untrusted nonce="[0-9a-f]+">\nattacker data\n/);
  });
});
