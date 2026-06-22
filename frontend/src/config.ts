/**
 * MOIRA App Configuration
 *
 * In development: uses localhost backend
 * In production (Render): uses VITE_API_URL env var
 */

const isProd = import.meta.env.PROD;
const prodApiUrl = import.meta.env.VITE_API_URL as string;
const prodWsUrl = import.meta.env.VITE_WS_URL as string;

export const config = {
    mode: 'live' as 'mock' | 'live',

    /** REST API base URL */
    apiUrl: isProd && prodApiUrl ? prodApiUrl : 'http://127.0.0.1:8001/api/v1',

    /** WebSocket base URL */
    wsUrl: isProd && prodWsUrl ? prodWsUrl : 'ws://127.0.0.1:8001/ws',

    /** Supabase */
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,

    /** Auto-reconnect settings */
    reconnect: {
        maxAttempts: 10,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
    },
} as const;
