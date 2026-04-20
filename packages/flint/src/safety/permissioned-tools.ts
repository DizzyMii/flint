import type { Tool } from '../types.ts';

export type PermissionedToolsOptions = {
  allow?: string[];
  deny?: string[];
  filter?: (tool: Tool) => boolean;
  requireScopes?: string[];
};

export function permissionedTools(tools: Tool[], opts: PermissionedToolsOptions): Tool[] {
  return tools.filter((t) => {
    if (opts.allow && !opts.allow.includes(t.name)) return false;
    if (opts.deny?.includes(t.name)) return false;
    if (opts.requireScopes) {
      const scopes = t.permissions?.scopes ?? [];
      if (!opts.requireScopes.every((s) => scopes.includes(s))) return false;
    }
    if (opts.filter && !opts.filter(t)) return false;
    return true;
  });
}
