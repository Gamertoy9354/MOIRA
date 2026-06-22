import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase, authFetch } from '../../lib/supabase';
import { config } from '../../config';

/** Retry an async fn up to `maxAttempts` times with exponential back-off */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4, baseDelayMs = 1500): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (attempt < maxAttempts - 1) {
                // Exponential back-off: 1.5s, 3s, 6s…
                await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
            }
        }
    }
    throw lastErr;
}

export function AuthCallback() {
    const navigate = useNavigate();
    const processed = useRef(false);
    const [statusMsg, setStatusMsg] = useState('Fate is verifying your identity…');

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;

        const handle = async () => {
            try {
                // Supabase handles the hash/code exchange automatically
                const { data, error } = await supabase.auth.getSession();
                if (error || !data.session) {
                    navigate('/login?error=auth_failed', { replace: true });
                    return;
                }

                const user = data.session.user;

                // Upsert profile on backend — retries up to 4 times to handle cold starts
                setStatusMsg('Weaving your fate thread…');
                const resp = await withRetry(() =>
                    authFetch(`${config.apiUrl}/auth/verify`, {
                        method: 'POST',
                        body: JSON.stringify({
                            display_name: user.user_metadata?.full_name || user.email,
                            avatar_url: user.user_metadata?.avatar_url,
                        }),
                    }),
                    4,
                    1500
                );

                if (!resp.ok) {
                    // Backend responded but returned an error (5xx, 4xx).
                    // Log it and navigate to /app — the app will handle auth state.
                    console.error('Backend verify returned non-ok', resp.status, await resp.text().catch(() => ''));
                    navigate('/app', { replace: true });
                    return;
                }

                const data2 = await resp.json();
                const isOnboardingComplete = data2?.onboarding?.is_complete;

                // Route based on onboarding status
                navigate(isOnboardingComplete ? '/app' : '/onboarding', { replace: true });
            } catch (err) {
                // Only end up here on a genuine network error after all retries.
                // Navigate to /app instead of a dead-end error page.
                console.error('Auth callback error after retries:', err);
                navigate('/app', { replace: true });
            }
        };

        handle();
    }, [navigate]);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100vh', background: '#080610', gap: 20,
        }}>
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{
                    width: 60, height: 60, borderRadius: '50%',
                    border: '2px solid rgba(200,169,110,0.2)',
                    borderTopColor: '#C8A96E',
                }}
            />
            <motion.p
                key={statusMsg}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ color: 'rgba(200,169,110,0.7)', fontFamily: 'Cinzel, serif', fontSize: 14, letterSpacing: '0.1em' }}
            >
                {statusMsg}
            </motion.p>
        </div>
    );
}
