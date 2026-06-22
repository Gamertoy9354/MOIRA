import { motion } from 'motion/react';
import { signInWithGoogle } from '../../lib/supabase';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGoogle = async () => {
        setLoading(true);
        setError('');
        try {
            await signInWithGoogle();
        } catch (e: any) {
            setError(e.message || 'Sign-in failed');
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#080610',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'Inter, sans-serif',
        }}>
            {/* Background orbs */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '20%', left: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,14,143,0.2) 0%, transparent 70%)', filter: 'blur(40px)' }} />
                <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,169,110,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
            </div>

            {/* Card */}
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{
                    background: 'rgba(13,9,32,0.9)',
                    border: '1px solid rgba(200,169,110,0.2)',
                    borderRadius: 24,
                    padding: '48px 40px',
                    width: 'min(420px, 90vw)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 60px rgba(74,14,143,0.2)',
                    textAlign: 'center',
                    zIndex: 1,
                }}
            >
                {/* Animated Omega Logo */}
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
                    style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}
                >
                    <div style={{ position: 'relative', width: 80, height: 80 }}>
                        {/* Outer ring */}
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                            style={{
                                position: 'absolute', inset: 0, borderRadius: '50%',
                                border: '1px solid rgba(200,169,110,0.3)',
                                borderTopColor: '#C8A96E',
                            }}
                        />
                        <motion.div
                            animate={{ rotate: -360 }}
                            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                            style={{
                                position: 'absolute', inset: 6, borderRadius: '50%',
                                border: '1px solid rgba(139,53,214,0.2)',
                                borderBottomColor: '#8B35D6',
                            }}
                        />
                        {/* Ω */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 32, fontFamily: 'Cinzel, serif',
                            background: 'linear-gradient(135deg, #C8A96E, #E8D5A3)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            fontWeight: 700,
                        }}>Ω</div>
                    </div>
                </motion.div>

                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{
                        fontFamily: 'Cinzel, serif',
                        fontSize: 28, fontWeight: 700,
                        background: 'linear-gradient(135deg, #C8A96E, #E8D5A3, #C8A96E)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        margin: '0 0 8px',
                        letterSpacing: '0.08em',
                    }}
                >
                    MOIRA
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    style={{ color: 'rgba(200,169,110,0.55)', fontSize: 13, marginBottom: 32, letterSpacing: '0.06em', fontFamily: 'Cinzel, serif' }}
                >
                    The Oracle Awaits
                </motion.p>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    style={{ color: 'rgba(240,235,248,0.4)', fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}
                >
                    Sign in to begin weaving your automated workflows
                </motion.p>

                {/* Google Sign In Button */}
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    onClick={handleGoogle}
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.02, boxShadow: '0 0 30px rgba(200,169,110,0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        width: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                        padding: '14px 24px',
                        background: loading ? 'rgba(74,14,143,0.3)' : 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(200,169,110,0.3)',
                        borderRadius: 12,
                        color: '#F0EBF8',
                        fontSize: 15, fontWeight: 600,
                        cursor: loading ? 'wait' : 'pointer',
                        transition: 'all 0.2s',
                        letterSpacing: '0.02em',
                    }}
                >
                    {loading ? (
                        <>
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(200,169,110,0.3)', borderTopColor: '#C8A96E' }}
                            />
                            Redirecting to Google…
                        </>
                    ) : (
                        <>
                            {/* Google G logo */}
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Sign in with Google
                        </>
                    )}
                </motion.button>

                {error && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ color: '#f87171', fontSize: 12, marginTop: 12 }}
                    >
                        {error}
                    </motion.p>
                )}

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    style={{ color: 'rgba(200,169,110,0.2)', fontSize: 11, marginTop: 28, letterSpacing: '0.04em' }}
                >
                    Your data is isolated and encrypted. Fate sees all, but no one else does.
                </motion.p>
            </motion.div>

            {/* Footer */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                style={{
                    marginTop: 32, color: 'rgba(200,169,110,0.3)',
                    fontSize: 12, letterSpacing: '0.05em', zIndex: 1,
                    fontFamily: 'Cinzel, serif',
                }}
            >
                Built by Team InnoCrew · Shis Maheta & Dev Patel
            </motion.p>
        </div>
    );
}
