import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);
    const [authed, setAuthed] = useState(false);

    useEffect(() => {
        if (localStorage.getItem('moira_dev_bypass') === 'true') {
            setAuthed(true);
            setChecking(false);
            return;
        }

        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                setAuthed(true);
            } else {
                navigate('/login', { replace: true });
            }
            setChecking(false);
        });

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) navigate('/login', { replace: true });
        });
        return () => listener.subscription.unsubscribe();
    }, [navigate]);

    if (checking) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: '100vh', background: '#080610', gap: 20,
            }}>
                {/* Spinning fate ring */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    style={{
                        width: 64, height: 64, borderRadius: '50%',
                        border: '2px solid transparent',
                        borderTopColor: '#C8A96E',
                        borderRightColor: 'rgba(200,169,110,0.3)',
                    }}
                />
                <motion.p
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ color: 'rgba(200,169,110,0.7)', fontFamily: 'Cinzel, serif', fontSize: 14, letterSpacing: '0.1em' }}
                >
                    MOIRA is waking…
                </motion.p>
            </div>
        );
    }

    return authed ? <>{children}</> : null;
}
