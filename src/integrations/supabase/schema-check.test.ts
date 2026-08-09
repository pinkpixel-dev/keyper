/**
 * Tests for un-migrated database detection.
 *
 * These run the real supabase-js client against a real local HTTP server that
 * answers like PostgREST, rather than stubbing our own modules. The error
 * bodies below are the actual responses Postgres/PostgREST produce: the 42703
 * message and hint were copied from a live query against the pre-1.3.0 schema.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type Responder = (url: string) => { status: number; body: unknown };

let server: Server;
let baseUrl: string;
let respond: Responder;

function installLocalStorage(url: string): void {
  const store = new Map<string, string>([
    ['keyper-db-provider', 'supabase'],
    ['keyper-supabase-url', url],
    ['keyper-supabase-key', 'test-anon-key'],
  ]);

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string): string | null => store.get(key) ?? null,
      setItem: (key: string, value: string): void => void store.set(key, value),
      removeItem: (key: string): void => void store.delete(key),
      clear: (): void => store.clear(),
    },
  });
}

beforeEach(async () => {
  server = createServer((req, res) => {
    const { status, body } = respond(req.url ?? '');
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(body));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  installLocalStorage(baseUrl);
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Fresh import per test so the module picks up the current localStorage. */
async function runCheck() {
  const mod = await import('./schema-check');
  return mod.checkSchemaState();
}

describe('checkSchemaState', () => {
  it('flags a pre-1.3.0 database missing owner_id', async () => {
    // Verbatim from Postgres against the old schema.
    respond = () => ({
      status: 400,
      body: {
        code: '42703',
        details: null,
        hint: 'Perhaps you meant to reference the column "vault_config.user_id".',
        message: 'column vault_config.owner_id does not exist',
      },
    });

    const result = await runCheck();

    expect(result.state).toBe('needs-migration');
    expect(result.detail).toContain('owner_id does not exist');
  });

  it('treats a migrated database as healthy', async () => {
    respond = () => ({ status: 200, body: [] });
    expect((await runCheck()).state).toBe('ok');
  });

  it('treats anon being refused as healthy, because that is the fix working', async () => {
    // After migration the anon key has no privileges. That is success, and it
    // must never be mistaken for a schema problem.
    respond = () => ({
      status: 401,
      body: {
        code: '42501',
        details: null,
        hint: null,
        message: 'permission denied for table vault_config',
      },
    });

    expect((await runCheck()).state).toBe('ok');
  });

  it('does not flag migration for an unrelated database error', async () => {
    // Failing open matters: wrongly showing the migration wall would block a
    // healthy vault behind scary instructions.
    respond = () => ({
      status: 500,
      body: { code: '08006', details: null, hint: null, message: 'connection failure' },
    });

    expect((await runCheck()).state).toBe('ok');
  });

  it('skips the probe entirely on local providers', async () => {
    let called = false;
    respond = () => {
      called = true;
      return { status: 200, body: [] };
    };

    localStorage.setItem('keyper-db-provider', 'sqlite');
    expect((await runCheck()).state).toBe('ok');
    expect(called).toBe(false);
  });
});
