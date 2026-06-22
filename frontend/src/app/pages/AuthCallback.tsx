import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase, authFetch } from '../../lib/supabase';
import { config } from '../../config';

export function AuthCallback() {
    const navigate = useNavigate();
    const processed = useRef(false);

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

                // Upsert profile on backend
                const resp = await authFetch(`${config.apiUrl}/auth/verify`, {
                    method: 'POST',
                    body: JSON.stringify({
                        display_name: user.user_metadata?.full_name || user.email,
                        avatar_url: user.user_metadata?.avatar_url,
                    }),
                });

                if (!resp.ok) {
                    console.error('Failed to verify user on backend');
                    navigate('/app', { replace: true });
                    return;
                }

                const data2 = await resp.json();
                const isOnboardingComplete = data2?.onboarding?.is_complete;

                // Route based on onboarding status
                navigate(isOnboardingComplete ? '/app' : '/onboarding', { replace: true });
            } catch (err) {
                console.error('Auth callback error:', err);
                navigate('/login?error=callback_error', { replace: true });
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
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ color: 'rgba(200,169,110,0.7)', fontFamily: 'Cinzel, serif', fontSize: 14, letterSpacing: '0.1em' }}
            >
                Fate is verifying your identity…
            </motion.p>
        </div>
    );
}
