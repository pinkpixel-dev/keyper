import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { __setNeonQueryExecutorForTests } from '@/integrations/database/neon-client';
import {
  clearNeonCredentials,
  clearSqliteDatabasePath,
  clearSupabaseCredentials,
  DB_PROVIDER_KEY,
  disconnectDatabase,
  getDatabaseProvider,
  getNeonConnectionString,
  getNeonMode,
  hasConfiguredDatabase,
  NEON_CONNECTION_STRING_KEY,
  NEON_MODE_KEY,
  refreshSupabaseClient,
  saveDatabaseProvider,
  saveNeonCredentials,
  saveSqliteDatabasePath,
  saveSupabaseCredentials,
  SQLITE_DB_PATH_KEY,
  SUPABASE_KEY_KEY,
  SUPABASE_URL_KEY,
  SUPABASE_USERNAME_KEY,
  supabase,
  testSupabaseProviderConnection,
} from './client';

type MockStorage = Record<string, string>;

function installMemoryLocalStorage(): MockStorage {
  const storage: MockStorage = {};

  vi.mocked(localStorage.getItem).mockImplementation((key: string) => storage[key] ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => {
    storage[key] = value;
  });
  vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
    delete storage[key];
  });
  vi.mocked(localStorage.clear).mockImplementation(() => {
    for (const key of Object.keys(storage)) {
      delete storage[key];
    }
  });

  return storage;
}

describe('database provider routing', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    __setNeonQueryExecutorForTests(null);
  });

  it('recognizes and stores Neon provider configuration', () => {
    const saved = saveNeonCredentials('postgres://neon:npg@localhost:5432/neondb', 'local', 'alice');

    expect(saved).toBe(true);
    expect(getDatabaseProvider()).toBe('neon');
    expect(getNeonConnectionString()).toBe('postgres://neon:npg@localhost:5432/neondb');
    expect(getNeonMode()).toBe('local');
  });

  it('clears Neon configuration without clearing Supabase or SQLite settings', () => {
    localStorage.setItem(SQLITE_DB_PATH_KEY, 'local-db');
    saveSupabaseCredentials('https://project.supabase.co', 'anon-key', 'alice');
    saveNeonCredentials('postgres://neon:npg@localhost:5432/neondb', 'cloud', 'alice');

    clearNeonCredentials();

    expect(localStorage.getItem(NEON_CONNECTION_STRING_KEY)).toBeNull();
    expect(localStorage.getItem(NEON_MODE_KEY)).toBeNull();
    expect(localStorage.getItem(SUPABASE_URL_KEY)).toBe('https://project.supabase.co');
    expect(localStorage.getItem(SUPABASE_KEY_KEY)).toBe('anon-key');
    expect(localStorage.getItem(SQLITE_DB_PATH_KEY)).toBe('local-db');
  });

  it('routes supabase compatibility calls to Neon when Neon is active', async () => {
    const execute = vi.fn(async () => [{ user_id: 'alice' }]);
    __setNeonQueryExecutorForTests(execute);
    saveNeonCredentials('postgres://neon:npg@localhost:5432/neondb', 'local', 'alice');

    refreshSupabaseClient();

    const result = await supabase
      .from('vault_config')
      .select('user_id')
      .eq('user_id', 'alice');

    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ user_id: 'alice' }]);
    expect(execute).toHaveBeenCalledWith('SELECT "user_id" FROM "vault_config" WHERE "user_id" = $1', ['alice']);
  });

  it('can switch between saved providers', () => {
    saveDatabaseProvider('sqlite');
    expect(getDatabaseProvider()).toBe('sqlite');

    saveNeonCredentials('postgres://neon:npg@localhost:5432/neondb', 'local');
    expect(getDatabaseProvider()).toBe('neon');

    saveSupabaseCredentials('https://project.supabase.co', 'anon-key');
    expect(getDatabaseProvider()).toBe('supabase');

    clearSupabaseCredentials();
    clearSqliteDatabasePath();
    clearNeonCredentials();
    localStorage.removeItem(DB_PROVIDER_KEY);
    expect(getDatabaseProvider()).toBe('supabase');
  });
});

describe('disconnectDatabase', () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = installMemoryLocalStorage();
    __setNeonQueryExecutorForTests(null);
  });

  it('clears every provider key so the app returns to setup', () => {
    saveSupabaseCredentials('https://project.supabase.co', 'anon-key', 'alice');
    saveSqliteDatabasePath('/tmp/keyper-test.db');
    saveNeonCredentials('postgres://neon:npg@localhost:5432/neondb', 'local');
    expect(hasConfiguredDatabase()).toBe(true);

    expect(disconnectDatabase()).toBe(true);

    expect(storage[SUPABASE_URL_KEY]).toBeUndefined();
    expect(storage[SUPABASE_KEY_KEY]).toBeUndefined();
    expect(storage[SUPABASE_USERNAME_KEY]).toBeUndefined();
    expect(storage[NEON_CONNECTION_STRING_KEY]).toBeUndefined();
    expect(storage[NEON_MODE_KEY]).toBeUndefined();
    expect(storage[SQLITE_DB_PATH_KEY]).toBeUndefined();
    expect(storage[DB_PROVIDER_KEY]).toBeUndefined();
    expect(hasConfiguredDatabase()).toBe(false);
  });

  it('leaves unrelated preferences alone', () => {
    // The card this replaces called localStorage.clear(), which also threw away
    // the user's theme and font. Disconnecting a database must not do that.
    saveSupabaseCredentials('https://project.supabase.co', 'anon-key', 'alice');
    localStorage.setItem('keyper-font-preference', 'font-outfit');
    localStorage.setItem('keyper-view-mode', 'list');
    localStorage.setItem('theme', 'theme-deep-purple');

    disconnectDatabase();

    expect(storage['keyper-font-preference']).toBe('font-outfit');
    expect(storage['keyper-view-mode']).toBe('list');
    expect(storage['theme']).toBe('theme-deep-purple');
  });
});

interface CapturedRequest {
  method?: string;
  url?: string;
  apiKey?: string;
  authorization?: string;
  accept?: string;
}

interface AuthServerResponse {
  status: number;
  contentType?: string;
  body: string;
}

async function withAuthServer(
  response: AuthServerResponse,
  run: (baseUrl: string, request: CapturedRequest) => Promise<void>,
): Promise<void> {
  const request: CapturedRequest = {};
  const server = createServer((incoming: IncomingMessage, outgoing: ServerResponse) => {
    request.method = incoming.method;
    request.url = incoming.url;
    request.apiKey = incoming.headers.apikey as string | undefined;
    request.authorization = incoming.headers.authorization;
    request.accept = incoming.headers.accept;

    outgoing.writeHead(response.status, {
      'Content-Type': response.contentType ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    outgoing.end(response.body);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;

  try {
    await run(`http://127.0.0.1:${address.port}`, request);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe('Supabase connection test', () => {
  it('validates Auth with the publishable key without querying a protected table', async () => {
    await withAuthServer(
      {
        status: 200,
        body: JSON.stringify({ external: {}, disable_signup: false }),
      },
      async (baseUrl, request) => {
        const result = await testSupabaseProviderConnection(`${baseUrl}/`, 'test-publishable-key');

        expect(result.error).toBeNull();
        expect(result.data?.endpoint).toBe(`${baseUrl}/auth/v1/settings`);
        expect(request).toEqual({
          method: 'GET',
          url: '/auth/v1/settings',
          apiKey: 'test-publishable-key',
          authorization: 'Bearer test-publishable-key',
          accept: 'application/json',
        });
        expect(request.url).not.toContain('/rest/v1/credentials');
      },
    );
  });

  it('preserves a self-hosted base path when resolving the Auth endpoint', async () => {
    await withAuthServer(
      { status: 200, body: JSON.stringify({ external: {} }) },
      async (baseUrl, request) => {
        const result = await testSupabaseProviderConnection(`${baseUrl}/supabase`, 'test-anon-key');

        expect(result.error).toBeNull();
        expect(request.url).toBe('/supabase/auth/v1/settings');
      },
    );
  });

  it('accepts valid Auth JSON when a self-hosted proxy omits the JSON content type', async () => {
    await withAuthServer(
      { status: 200, contentType: 'text/plain', body: JSON.stringify({ external: {} }) },
      async (baseUrl) => {
        const result = await testSupabaseProviderConnection(baseUrl, 'test-anon-key');
        expect(result.error).toBeNull();
      },
    );
  });

  it('reports a rejected API key without exposing it in the error', async () => {
    await withAuthServer(
      { status: 401, body: JSON.stringify({ message: 'Invalid API key' }) },
      async (baseUrl) => {
        const key = 'do-not-repeat-this-key';
        const result = await testSupabaseProviderConnection(baseUrl, key);

        expect(result.data).toBeNull();
        expect(result.error?.message).toBe('Supabase rejected this publishable or anon API key.');
        expect(result.error?.message).not.toContain(key);
      },
    );
  });

  it('also treats a forbidden response as a rejected API key', async () => {
    await withAuthServer(
      { status: 403, body: JSON.stringify({ message: 'Forbidden' }) },
      async (baseUrl) => {
        const result = await testSupabaseProviderConnection(baseUrl, 'test-anon-key');
        expect(result.error?.message).toBe('Supabase rejected this publishable or anon API key.');
      },
    );
  });

  it('distinguishes a missing Auth endpoint from a temporary Auth failure', async () => {
    await withAuthServer(
      { status: 404, body: JSON.stringify({ message: 'Not found' }) },
      async (baseUrl) => {
        const result = await testSupabaseProviderConnection(baseUrl, 'test-anon-key');
        expect(result.error?.message).toBe('Supabase Auth was not found at this project URL.');
      },
    );

    await withAuthServer(
      { status: 503, body: JSON.stringify({ message: 'Unavailable' }) },
      async (baseUrl) => {
        const result = await testSupabaseProviderConnection(baseUrl, 'test-anon-key');
        expect(result.error?.message).toBe('Supabase Auth is temporarily unavailable (HTTP 503).');
      },
    );
  });

  it('rejects a successful non-JSON response from a non-Supabase URL', async () => {
    await withAuthServer(
      { status: 200, contentType: 'text/html', body: '<!doctype html><title>Not Supabase</title>' },
      async (baseUrl) => {
        const result = await testSupabaseProviderConnection(baseUrl, 'test-anon-key');

        expect(result.data).toBeNull();
        expect(result.error?.message).toBe('The project URL did not return a Supabase Auth response.');
      },
    );
  });

  it('rejects malformed JSON from the Auth endpoint', async () => {
    await withAuthServer(
      { status: 200, body: '{not-json' },
      async (baseUrl) => {
        const result = await testSupabaseProviderConnection(baseUrl, 'test-anon-key');

        expect(result.data).toBeNull();
        expect(result.error?.message).toBe('The project URL returned an invalid Supabase Auth response.');
      },
    );
  });

  it('rejects missing and non-HTTP connection details before making a request', async () => {
    expect((await testSupabaseProviderConnection('', '')).error?.message).toBe(
      'Supabase URL and API key are required.',
    );
    expect((await testSupabaseProviderConnection('file:///tmp/keyper', 'test-anon-key')).error?.message).toBe(
      'Supabase URL must use http:// or https://.',
    );
  });
});
