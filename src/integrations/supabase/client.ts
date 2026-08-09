// Keyper database client configuration with provider support.
// Made with love by Pink Pixel.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import {
  sqliteClient,
  initializeSqliteDatabase,
  testSqliteConnection,
  type DbResponse,
} from '@/integrations/database/sqlite-client';
import {
  neonClient,
  configureNeonProvider,
  testNeonConnection,
  type NeonMode,
} from '@/integrations/database/neon-client';

export type DatabaseProvider = 'supabase' | 'sqlite' | 'neon';

// Default Supabase configuration - placeholder values for self-hosted version
const DEFAULT_SUPABASE_URL = 'https://your-project.supabase.co';
const DEFAULT_SUPABASE_KEY = 'your-anon-key';

// Storage keys
export const DB_PROVIDER_KEY = 'keyper-db-provider';
export const SUPABASE_URL_KEY = 'keyper-supabase-url';
export const SUPABASE_KEY_KEY = 'keyper-supabase-key';
export const SUPABASE_USERNAME_KEY = 'keyper-username';
export const SQLITE_DB_PATH_KEY = 'keyper-sqlite-db-path';
export const NEON_CONNECTION_STRING_KEY = 'keyper-neon-connection-string';
export const NEON_MODE_KEY = 'keyper-neon-mode';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function isElectronApp(): boolean {
  return Boolean(isBrowser() && window.keyperElectron?.isElectron);
}

export const getDatabaseProvider = (): DatabaseProvider => {
  if (!isBrowser()) return 'supabase';
  const provider = localStorage.getItem(DB_PROVIDER_KEY);
  if (provider === 'neon') return 'neon';
  return provider === 'sqlite' ? 'sqlite' : 'supabase';
};

export const saveDatabaseProvider = (provider: DatabaseProvider): boolean => {
  if (!isBrowser()) return false;
  try {
    localStorage.setItem(DB_PROVIDER_KEY, provider);
    return true;
  } catch (error) {
    console.error('Error saving database provider:', error);
    return false;
  }
};

export const getSqliteDatabasePath = (): string => {
  if (!isBrowser()) return '';
  return localStorage.getItem(SQLITE_DB_PATH_KEY) || '';
};

export const saveSqliteDatabasePath = (path: string): boolean => {
  if (!isBrowser()) return false;
  try {
    if (path.trim()) {
      localStorage.setItem(SQLITE_DB_PATH_KEY, path.trim());
    } else {
      localStorage.removeItem(SQLITE_DB_PATH_KEY);
    }
    return true;
  } catch (error) {
    console.error('Error saving SQLite DB path:', error);
    return false;
  }
};

export const clearSqliteDatabasePath = (): boolean => {
  if (!isBrowser()) return false;
  try {
    localStorage.removeItem(SQLITE_DB_PATH_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing SQLite DB path:', error);
    return false;
  }
};

export const getNeonConnectionString = (): string => {
  if (!isBrowser()) return '';
  return localStorage.getItem(NEON_CONNECTION_STRING_KEY) || '';
};

export const getNeonMode = (): NeonMode => {
  if (!isBrowser()) return 'cloud';
  return localStorage.getItem(NEON_MODE_KEY) === 'local' ? 'local' : 'cloud';
};

export const saveNeonCredentials = (connectionString: string, mode: NeonMode, username?: string): boolean => {
  if (!isBrowser()) return false;
  try {
    localStorage.setItem(NEON_CONNECTION_STRING_KEY, connectionString.trim());
    localStorage.setItem(NEON_MODE_KEY, mode);
    localStorage.setItem(DB_PROVIDER_KEY, 'neon');
    if (username) {
      localStorage.setItem(SUPABASE_USERNAME_KEY, username);
    }
    configureNeonProvider({
      connectionString: connectionString.trim(),
      mode,
    });
    return true;
  } catch (error) {
    console.error('Error saving Neon credentials:', error);
    return false;
  }
};

export const clearNeonCredentials = (): boolean => {
  if (!isBrowser()) return false;
  try {
    localStorage.removeItem(NEON_CONNECTION_STRING_KEY);
    localStorage.removeItem(NEON_MODE_KEY);
    configureNeonProvider(null);
    return true;
  } catch (error) {
    console.error('Error clearing Neon credentials:', error);
    return false;
  }
};

// Helper function to get the current Supabase URL and key
export const getSupabaseCredentials = () => {
  try {
    const customUrl = localStorage.getItem(SUPABASE_URL_KEY);
    const customKey = localStorage.getItem(SUPABASE_KEY_KEY);
    const username = localStorage.getItem(SUPABASE_USERNAME_KEY);

    return {
      supabaseUrl: customUrl || DEFAULT_SUPABASE_URL,
      supabaseKey: customKey || DEFAULT_SUPABASE_KEY,
      username: username || 'self-hosted-user',
    };
  } catch (error) {
    console.error('Error retrieving Supabase credentials from localStorage:', error);
    return {
      supabaseUrl: DEFAULT_SUPABASE_URL,
      supabaseKey: DEFAULT_SUPABASE_KEY,
      username: 'self-hosted-user',
    };
  }
};

// Helper function to check if Supabase credentials are configured (non-default)
export const hasCustomSupabaseCredentials = () => {
  const credentials = getSupabaseCredentials();
  return credentials.supabaseUrl !== DEFAULT_SUPABASE_URL && credentials.supabaseKey !== DEFAULT_SUPABASE_KEY;
};

export const hasConfiguredDatabase = () => {
  const provider = getDatabaseProvider();
  if (provider === 'sqlite') {
    return true;
  }
  if (provider === 'neon') {
    return getNeonConnectionString().trim().length > 0;
  }
  return hasCustomSupabaseCredentials();
};

// Function to clear custom Supabase credentials and revert to defaults
export const clearSupabaseCredentials = () => {
  try {
    localStorage.removeItem(SUPABASE_URL_KEY);
    localStorage.removeItem(SUPABASE_KEY_KEY);
    localStorage.removeItem(SUPABASE_USERNAME_KEY);
    console.log('Supabase credentials cleared, reverting to defaults');
    return true;
  } catch (error) {
    console.error('Error clearing Supabase credentials:', error);
    return false;
  }
};

// Helper function to get the current username for filtering
export const getCurrentUsername = () => {
  try {
    return localStorage.getItem(SUPABASE_USERNAME_KEY) || 'self-hosted-user';
  } catch (error) {
    console.error('Error retrieving username from localStorage:', error);
    return 'self-hosted-user';
  }
};

export const saveCurrentUsername = (username: string): boolean => {
  try {
    localStorage.setItem(SUPABASE_USERNAME_KEY, username.trim() || 'self-hosted-user');
    return true;
  } catch (error) {
    console.error('Error saving username:', error);
    return false;
  }
};

// Function to save Supabase credentials to localStorage
export const saveSupabaseCredentials = (url: string, key: string, username?: string) => {
  try {
    localStorage.setItem(SUPABASE_URL_KEY, url);
    localStorage.setItem(SUPABASE_KEY_KEY, key);
    if (username) {
      localStorage.setItem(SUPABASE_USERNAME_KEY, username);
    }
    localStorage.setItem(DB_PROVIDER_KEY, 'supabase');
    console.log('Supabase credentials saved to localStorage');
    return true;
  } catch (error) {
    console.error('Error saving Supabase credentials:', error);
    return false;
  }
};

configureNeonProvider(
  getNeonConnectionString()
    ? {
        connectionString: getNeonConnectionString(),
        mode: getNeonMode(),
      }
    : null,
);

let supabaseClient: ReturnType<typeof createClient<Database>>;

const initializeSupabaseClient = () => {
  const { supabaseUrl, supabaseKey } = getSupabaseCredentials();

  supabaseClient = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseClient;
};

initializeSupabaseClient();

const getActiveClient = () => {
  const provider = getDatabaseProvider();
  if (provider === 'sqlite') {
    return sqliteClient;
  }
  if (provider === 'neon') {
    return neonClient;
  }
  return supabaseClient;
};

// Export a compatibility client so existing supabase.from(...) callsites keep working.
export const supabase = {
  from(table: string) {
    return getActiveClient().from(table);
  },
};

/**
 * The real Supabase client, for auth calls.
 *
 * Deliberately separate from the `supabase` compatibility wrapper above: that
 * wrapper routes `from()` to whichever provider is active, and SQLite and Neon
 * have no auth at all. Anything touching sessions needs the genuine client, so
 * it asks for it explicitly rather than getting a provider-dependent object.
 */
export const getAuthClient = () => supabaseClient;

// Function to create a new Supabase client with the latest credentials
export const createSupabaseClient = () => {
  const { supabaseUrl, supabaseKey } = getSupabaseCredentials();

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
};

// Function to create a test Supabase client with custom credentials
export const createTestSupabaseClient = (url: string, key: string) => {
  if (!url || !key) {
    throw new Error('URL and API key are required');
  }

  try {
    const urlObj = new URL(url);

    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('URL must use http:// or https:// protocol');
    }

    const hostname = urlObj.hostname.toLowerCase();

    console.log('Supabase URL validation - accepting all valid HTTP/HTTPS URLs:', {
      url,
      hostname,
      protocol: urlObj.protocol,
      port: urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80'),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Invalid URL format: ${url}. Please ensure it includes the protocol (http:// or https://)`);
    }
    throw error;
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};

export const initializeSqliteProvider = async (dbPath?: string): Promise<DbResponse<{ path?: string }>> => {
  return initializeSqliteDatabase(dbPath || getSqliteDatabasePath());
};

export const testSqliteProviderConnection = async (dbPath?: string): Promise<DbResponse<{ path?: string }>> => {
  return testSqliteConnection(dbPath || getSqliteDatabasePath());
};

export const testNeonProviderConnection = async (
  connectionString = getNeonConnectionString(),
  mode = getNeonMode(),
): Promise<DbResponse<{ mode: NeonMode }>> => {
  return testNeonConnection({ connectionString, mode });
};

// Function to refresh the active client after credentials/provider change
export const refreshSupabaseClient = () => {
  const provider = getDatabaseProvider();

  if (provider === 'sqlite') {
    void initializeSqliteProvider().then((sqliteInit) => {
      if (sqliteInit.error) {
        console.error('Failed to initialize SQLite provider:', sqliteInit.error.message);
      }
    });
    return supabase;
  }

  if (provider === 'neon') {
    configureNeonProvider(
      getNeonConnectionString()
        ? {
            connectionString: getNeonConnectionString(),
            mode: getNeonMode(),
          }
        : null,
    );
    return supabase;
  }

  initializeSupabaseClient();
  return supabase;
};
