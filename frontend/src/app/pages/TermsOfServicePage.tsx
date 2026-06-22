import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Scale, FileCheck, HelpCircle } from 'lucide-react';

export function TermsOfServicePage() {
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
                <div style={{ position: 'absolute', top: '15%', right: '15%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,14,143,0.18) 0%, transparent 70%)', filter: 'blur(50px)' }} />
                <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,169,110,0.08) 0%, transparent 70%)', filter: 'blur(50px)' }} />
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
                        <BookOpen size={32} />
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
                        Terms of Service
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
                    Welcome to the MOIRA platform. By accessing or using our AI-driven Model Context Protocol (MCP) orchestration engine, you agree to comply with and be bound by the following terms. Please read these terms carefully.
                </div>

                {/* Terms Sections */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <Scale size={18} style={{ color: '#C8A96E' }} />
                            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: '#E8D5A3', margin: 0, letterSpacing: '0.03em' }}>
                                1. Provision of Service & AI Usage
                            </h2>
                        </div>
                        <p style={{ fontSize: 14, color: 'rgba(240,235,248,0.7)', lineHeight: 1.7, margin: 0 }}>
                            MOIRA provides a multi-tenant workspace allowing you to weave and execute automated DAGs across your connectors. As a user, you agree to supply your own AI API keys to pay for the inference costs of planning and tool generation. You are solely responsible for the usage fees incurred under your credentials.
                        </p>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <FileCheck size={18} style={{ color: '#C8A96E' }} />
                            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: '#E8D5A3', margin: 0, letterSpacing: '0.03em' }}>
                                2. SafeGuard Layers & Intent Approval
                            </h2>
                        </div>
                        <p style={{ fontSize: 14, color: 'rgba(240,235,248,0.7)', lineHeight: 1.7, margin: 0 }}>
                            To prevent unwanted mutations, MOIRA includes built-in SafeGuard verification. Some actions are marked as SENSITIVE and will block execution until you manually grant human approval in the UI. Bypassing or attempting to disable these safeguards in a malicious manner is strictly prohibited.
                        </p>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <HelpCircle size={18} style={{ color: '#C8A96E' }} />
                            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: '#E8D5A3', margin: 0, letterSpacing: '0.03em' }}>
                                3. Acceptable Use Policy
                            </h2>
                        </div>
                        <p style={{ fontSize: 14, color: 'rgba(240,235,248,0.7)', lineHeight: 1.7, margin: 0 }}>
                            You agree not to use MOIRA to automate workflows that violate third-party API policies, write spam, compromise repositories you do not own, or generate code/connectors designed for hacking or denial-of-service attacks.
                        </p>
                    </div>

                    <div>
                        <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: '#E8D5A3', marginBottom: 14, letterSpacing: '0.03em' }}>
                            4. Disclaimer of Warranty
                        </h2>
                        <p style={{ fontSize: 14, color: 'rgba(240,235,248,0.7)', lineHeight: 1.7, margin: 0 }}>
                            The platform is provided "as is" and "as available". We do not guarantee that the synthesized connectors or the AI-generated execution plans will be 100% bug-free. User discretion and safe manual testing are advised when executing complex DAGs.
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
