import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[MOIRA] Supabase env vars not set — auth will be disabled in dev mode');
}

export const supabase = createClient(
    SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_ANON_KEY || 'placeholder',
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
    }
);

/** Sign in with Google OAuth — redirects to /auth/callback */
export async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: { access_type: 'offline', prompt: 'consent' },
        },
    });
    if (error) throw error;
}

/** Sign out current user */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

/** Get current session (null if not logged in) */
export async function getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

/** Get current user */
export async function getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
}

/** Get the JWT access token for backend API calls */
export async function getAccessToken(): Promise<string | null> {
    if (localStorage.getItem('moira_dev_bypass') === 'true') {
        return 'dev-access-token';
    }
    const session = await getSession();
    return session?.access_token ?? null;
}

/** Authenticated fetch — adds Bearer token to every request */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await getAccessToken();
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    });
}
