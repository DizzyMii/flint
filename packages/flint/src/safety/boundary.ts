import type { Message } from '../types.ts';

function randomNonce(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export type UntrustedOptions = {
  label?: string;
};

export function untrusted(content: string, opts?: UntrustedOptions): string {
  const nonce = randomNonce(8);
  const label = opts?.label ?? 'untrusted';
  return `<${label} nonce="${nonce}">\n${content}\n</${label} nonce="${nonce}">`;
}

export type BoundaryOptions = {
  trusted: string;
  untrusted: string;
};

export function boundary(
  opts: BoundaryOptions,
): [Message & { role: 'system' }, Message & { role: 'user' }] {
  return [
    { role: 'system', content: opts.trusted },
    { role: 'user', content: untrusted(opts.untrusted) },
  ];
}
