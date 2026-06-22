/**
 * MOIRA App Configuration
 *
 * In development: uses localhost backend
 * In production: uses the Render backend service URL
 */

const PROD_API_URL = 'https://moira-backend-ly1o.onrender.com/api/v1';
const PROD_WS_URL  = 'wss://moira-backend-ly1o.onrender.com/ws';

export const config = {
    mode: 'live' as 'mock' | 'live',

    /** REST API base URL */
    apiUrl: import.meta.env.PROD ? PROD_API_URL : 'http://127.0.0.1:8001/api/v1',

    /** WebSocket base URL */
    wsUrl: import.meta.env.PROD ? PROD_WS_URL : 'ws://127.0.0.1:8001/ws',

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
