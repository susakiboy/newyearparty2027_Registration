import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const normalizeSupabaseUrl = (raw: string): string => {
  let u = (raw || '').trim();
  u = u.replace(/\/+$/, '');
  u = u.replace(/\/rest\/v1\/?$/i, '');
  u = u.replace(/\/+$/, '');
  return u;
};

// Storage Keys for Permanent Persistence
export const SUPABASE_STORAGE_KEYS = {
  URL: 'VITE_SUPABASE_URL',
  ANON_KEY: 'VITE_SUPABASE_ANON_KEY',
  PERMANENT_URL: 'sd_supabase_url_permanent',
  PERMANENT_KEY: 'sd_supabase_key_permanent',
  FALLBACK_URL: 'supabase_url',
  FALLBACK_KEY: 'supabase_anon_key',
  LAST_HEALTH: 'sd_supabase_last_health',
};

// Default Production Supabase Project (Ready for cross-device cloud persistence)
export const DEFAULT_SUPABASE_URL = 'https://mxtjyyzhpuzgmzjzzzss.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_ga8O_pQjYDoxYm-BRGbtrw_kuVMmx9K';

// Read from Vite environment variables (if provided at build/dev time)
const envUrl = normalizeSupabaseUrl((import.meta as any).env?.VITE_SUPABASE_URL || '');
const envAnonKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();

/**
 * Get stored Supabase configuration with multi-layer fallback:
 * 1. Primary localStorage keys (VITE_SUPABASE_URL / custom admin override)
 * 2. Permanent backup localStorage keys (sd_supabase_url_permanent)
 * 3. Build-time environment variables
 * 4. Production Cloud Defaults (DEFAULT_SUPABASE_URL / DEFAULT_SUPABASE_ANON_KEY)
 *
 * This ensures that when opening from ANY device, phone, or new machine,
 * the app connects immediately to the live Supabase cloud database.
 */
export const getStoredConfig = (): {
  url: string;
  anonKey: string;
  isCustom: boolean;
  isDefault: boolean;
} => {
  try {
    const customUrl =
      localStorage.getItem(SUPABASE_STORAGE_KEYS.URL) ||
      localStorage.getItem(SUPABASE_STORAGE_KEYS.PERMANENT_URL) ||
      localStorage.getItem(SUPABASE_STORAGE_KEYS.FALLBACK_URL) ||
      '';

    const customKey =
      localStorage.getItem(SUPABASE_STORAGE_KEYS.ANON_KEY) ||
      localStorage.getItem(SUPABASE_STORAGE_KEYS.PERMANENT_KEY) ||
      localStorage.getItem(SUPABASE_STORAGE_KEYS.FALLBACK_KEY) ||
      '';

    const cleanCustomUrl = normalizeSupabaseUrl(customUrl);
    const cleanCustomKey = customKey.trim();
    const hasCustom = Boolean(cleanCustomUrl && cleanCustomKey);

    const effectiveUrl = cleanCustomUrl || envUrl || DEFAULT_SUPABASE_URL;
    const effectiveKey = cleanCustomKey || envAnonKey || DEFAULT_SUPABASE_ANON_KEY;

    return {
      url: effectiveUrl,
      anonKey: effectiveKey,
      isCustom: hasCustom,
      isDefault: !hasCustom,
    };
  } catch (err) {
    console.warn('Could not read Supabase config from localStorage:', err);
    return {
      url: envUrl || DEFAULT_SUPABASE_URL,
      anonKey: envAnonKey || DEFAULT_SUPABASE_ANON_KEY,
      isCustom: false,
      isDefault: true,
    };
  }
};

let clientInstance: SupabaseClient | null = null;
let currentConfigKey = '';

export const isSupabaseConfigured = (): boolean => {
  const { url, anonKey } = getStoredConfig();
  return Boolean(
    url &&
    anonKey &&
    (url.startsWith('https://') || url.startsWith('http://localhost')) &&
    !url.includes('your-project.supabase.co') &&
    anonKey !== 'your-anon-key' &&
    anonKey.length > 15
  );
};

export const getSupabaseUrl = (): string => {
  return getStoredConfig().url;
};

export const getSupabaseAnonKey = (): string => {
  return getStoredConfig().anonKey;
};

export const getSupabase = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const { url, anonKey } = getStoredConfig();
  const configKey = `${url}::${anonKey}`;
  if (!clientInstance || currentConfigKey !== configKey) {
    clientInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    currentConfigKey = configKey;
  }
  return clientInstance;
};

/**
 * Permanently saves Supabase URL and Anon Key across all persistent storage locations
 * and instantly broadcasts the change to all listeners.
 */
export const setSupabaseCredentials = (url: string, anonKey: string): void => {
  const cleanUrl = normalizeSupabaseUrl(url);
  const cleanKey = anonKey.trim();

  try {
    if (cleanUrl) {
      localStorage.setItem(SUPABASE_STORAGE_KEYS.URL, cleanUrl);
      localStorage.setItem(SUPABASE_STORAGE_KEYS.PERMANENT_URL, cleanUrl);
      localStorage.setItem(SUPABASE_STORAGE_KEYS.FALLBACK_URL, cleanUrl);
    } else {
      localStorage.removeItem(SUPABASE_STORAGE_KEYS.URL);
      localStorage.removeItem(SUPABASE_STORAGE_KEYS.PERMANENT_URL);
      localStorage.removeItem(SUPABASE_STORAGE_KEYS.FALLBACK_URL);
    }

    if (cleanKey) {
      localStorage.setItem(SUPABASE_STORAGE_KEYS.ANON_KEY, cleanKey);
      localStorage.setItem(SUPABASE_STORAGE_KEYS.PERMANENT_KEY, cleanKey);
      localStorage.setItem(SUPABASE_STORAGE_KEYS.FALLBACK_KEY, cleanKey);
    } else {
      localStorage.removeItem(SUPABASE_STORAGE_KEYS.ANON_KEY);
      localStorage.removeItem(SUPABASE_STORAGE_KEYS.PERMANENT_KEY);
      localStorage.removeItem(SUPABASE_STORAGE_KEYS.FALLBACK_KEY);
    }
  } catch (err) {
    console.error('Failed to save Supabase credentials to localStorage:', err);
  }

  // Invalidate cached client instance so next getSupabase() creates with new credentials
  clientInstance = null;
  currentConfigKey = '';

  // Broadcast event across windows / tabs and within current tab
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('supabase-config-changed', {
        detail: { url: cleanUrl, anonKey: cleanKey },
      })
    );
  }
};

/**
 * Clears custom credentials and reverts to default project cloud credentials
 */
export const clearSupabaseCredentials = (): void => {
  try {
    localStorage.removeItem(SUPABASE_STORAGE_KEYS.URL);
    localStorage.removeItem(SUPABASE_STORAGE_KEYS.PERMANENT_URL);
    localStorage.removeItem(SUPABASE_STORAGE_KEYS.FALLBACK_URL);
    localStorage.removeItem(SUPABASE_STORAGE_KEYS.ANON_KEY);
    localStorage.removeItem(SUPABASE_STORAGE_KEYS.PERMANENT_KEY);
    localStorage.removeItem(SUPABASE_STORAGE_KEYS.FALLBACK_KEY);
    localStorage.removeItem(SUPABASE_STORAGE_KEYS.LAST_HEALTH);
  } catch (err) {
    console.error('Failed to clear Supabase credentials:', err);
  }

  clientInstance = null;
  currentConfigKey = '';

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('supabase-config-changed', {
        detail: { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY },
      })
    );
  }
};

/**
 * Resets configuration directly to the project default Supabase instance
 */
export const resetToDefaultSupabase = (): void => {
  clearSupabaseCredentials();
};

// Dynamic proxy export for direct access that always uses the latest configured client
export const supabase: SupabaseClient | null = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      return null;
    }
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});
