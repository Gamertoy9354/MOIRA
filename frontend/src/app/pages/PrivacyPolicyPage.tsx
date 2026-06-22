import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Scroll } from 'lucide-react';

export function PrivacyPolicyPage() {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: '100vh',
            background: '#080610',
            color: '#F0EBF8',
            fontFamily: 'Inter, sans-serif',
            position: 'relative',
            overflow: 'hidden',
            padding: '80px 24px',
            boxSizing: 'border-box',
        }}>
            {/* Ambient Background Glows */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '10%', left: '15%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,14,143,0.18) 0%, transparent 70%)', filter: 'blur(50px)' }} />
                <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,169,110,0.08) 0%, transparent 70%)', filter: 'blur(50px)' }} />
            </div>

            {/* Back Button */}
            <div style={{ maxWidth: 800, margin: '0 auto 40px', position: 'relative', zIndex: 10 }}>
                <motion.button
                    onClick={() => navigate('/')}
                    whileHover={{ scale: 1.03, x: -4 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'none',
                        border: '1px solid rgba(200,169,110,0.2)',
                        padding: '10px 20px',
                        borderRadius: 30,
                        color: '#C8A96E',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'Cinzel, serif',
                        letterSpacing: '0.05em',
                        backdropFilter: 'blur(10px)',
                    }}
                >
                    <ArrowLeft size={16} /> Back to Sanctuary
                </motion.button>
            </div>

            {/* Main Content Card */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                style={{
                    maxWidth: 800,
                    margin: '0 auto',
                    background: 'rgba(13,9,32,0.85)',
                    border: '1px solid rgba(200,169,110,0.18)',
                    borderRadius: 24,
                    padding: '48px 40px',
                    boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 60px rgba(74,14,143,0.15)',
                    position: 'relative',
                    zIndex: 5,
                    backdropFilter: 'blur(20px)',
                }}
            >
                {/* Header Icon & Title */}
                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.1 }}
                        style={{
                            width: 64, height: 64, borderRadius: '50%',
                            background: 'rgba(74,14,143,0.15)',
                            border: '1px solid rgba(200,169,110,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px',
                            color: '#C8A96E',
                        }}
                    >
                        <Shield size={32} />
                    </motion.div>

                    <h1 style={{
                        fontFamily: 'Cinzel, serif',
                        fontSize: 32,
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #C8A96E, #E8D5A3, #C8A96E)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        margin: '0 0 12px',
                        letterSpacing: '0.06em',
                    }}>
                        Privacy Policy
                    </h1>
                    <p style={{ color: 'rgba(200,169,110,0.55)', fontSize: 13, fontFamily: 'Cinzel, serif', letterSpacing: '0.04em' }}>
                        Last Updated: June 22, 2026
                    </p>
                </div>

                {/* Introductory Banner */}
                <div style={{
                    background: 'rgba(74,14,143,0.12)',
                    border: '1px solid rgba(200,169,110,0.15)',
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 36,
                    lineHeight: 1.6,
                    fontSize: 14,
                    color: 'rgba(240,235,248,0.8)',
                }}>
                    <strong>Greetings, Seeker.</strong> MOIRA (operated by Team InnoCrew) is committed to protecting your digital footprint. As you orchestrate automated workflows across your enterprise stack, this document describes how we handle, process, and secure your authentication tokens, keys, and session data.
                </div>

                {/* Privacy Sections */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <Lock size={18} style={{ color: '#C8A96E' }} />
                            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: '#E8D5A3', margin: 0, letterSpacing: '0.03em' }}>
                                1. Token Encryption & Isolation
                            </h2>
                        </div>
                        <p style={{ fontSize: 14, color: 'rgba(240,235,248,0.7)', lineHeight: 1.7, margin: 0 }}>
                            When you onboard integrations like GitHub, Jira, Slack, or Google Sheets, your access tokens and credentials are encrypted on the client side using AES-256 standard and stored inside your isolated Supabase Database vault. At no point do we store or inspect these credentials in plaintext.
                        </p>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <Eye size={18} style={{ color: '#C8A96E' }} />
                            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: '#E8D5A3', margin: 0, letterSpacing: '0.03em' }}>
                                2. AI Key Privacy
                            </h2>
                        </div>
                        <p style={{ fontSize: 14, color: 'rgba(240,235,248,0.7)', lineHeight: 1.7, margin: 0 }}>
                            Following our latest architecture updates, all AI planning, routing, and tool synthesis run strictly using the custom AI API Key (Nvidia, Groq, or OpenRouter) that you supply during onboarding. We do not inspect, log, or reuse your keys for other users, nor do we train LLM models on your workflow requests.
                        </p>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <Scroll size={18} style={{ color: '#C8A96E' }} />
                            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: '#E8D5A3', margin: 0, letterSpacing: '0.03em' }}>
                                3. Auditing & Logs
                            </h2>
                        </div>
                        <p style={{ fontSize: 14, color: 'rgba(240,235,248,0.7)', lineHeight: 1.7, margin: 0 }}>
                            To allow transparency, MOIRA writes logs to a local execution list or exports them to your dedicated Google Audit Sheets tab (if enabled). These logs contain timestamp, connector name, step status, and latency. Sensitive parameter values are hashed using SHA-256 to ensure absolute confidentiality.
                        </p>
                    </div>

                    <div>
                        <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: '#E8D5A3', marginBottom: 14, letterSpacing: '0.03em' }}>
                            4. Third-Party Services
                        </h2>
                        <p style={{ fontSize: 14, color: 'rgba(240,235,248,0.7)', lineHeight: 1.7, margin: 0 }}>
                            Because MOIRA interfaces directly with external APIs (Atlassian Jira, GitHub, Slack, Google Workspace), your usage is governed by the respective terms and privacy agreements of those providers. Please review their policies when granting scopes.
                        </p>
                    </div>
                </div>

                {/* Footer Credits */}
                <div style={{
                    marginTop: 48,
                    paddingTop: 28,
                    borderTop: '1px solid rgba(200,169,110,0.1)',
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'rgba(200,169,110,0.3)',
                    fontFamily: 'Cinzel, serif',
                    letterSpacing: '0.05em',
                }}>
                    Team InnoCrew · Shis Maheta & Dev Patel · Year 2026
                </div>
            </motion.div>
        </div>
    );
}
