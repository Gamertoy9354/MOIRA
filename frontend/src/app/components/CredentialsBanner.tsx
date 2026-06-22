import { motion, AnimatePresence } from 'motion/react';
import { Key, ChevronRight, X, AlertTriangle } from 'lucide-react';

// ──────────────────── Types ─────────────────────────────────────────────────

export interface PendingCredential {
    workflowId: string;
    service: string;          // e.g. "sendgrid"
    serviceName: string;      // e.g. "SendGrid"
    fields: {
        key: string;
        label: string;
        hint?: string;
        isSecret?: boolean;
        required?: boolean;
    }[];
}

interface CredentialsBannerProps {
    pendingCredentials: PendingCredential[];
    onEnterCredentials: (cred: PendingCredential) => void;
    onDismiss: (service: string) => void;
}

// ──────────────────── Component ──────────────────────────────────────────────

export function CredentialsBanner({
    pendingCredentials,
    onEnterCredentials,
    onDismiss,
}: CredentialsBannerProps) {
    if (pendingCredentials.length === 0) return null;

    const first = pendingCredentials[0];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 60, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 60, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                style={{
                    position: 'fixed',
                    bottom: 24,
                    left: 24,
                    zIndex: 9999,
                    width: 'min(360px, calc(100vw - 48px)',
                    background: 'rgba(8, 5, 18, 0.97)',
                    border: '1px solid rgba(251, 191, 36, 0.35)',
                    borderRadius: 14,
                    boxShadow: '0 8px 40px rgba(0,0,0,0.8), 0 0 40px rgba(251,191,36,0.12)',
                    overflow: 'hidden',
                }}
            >
                {/* Amber glow accent */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, #F59E0B, #FCD34D, #F59E0B)',
                }} />

                <div style={{ padding: '14px 16px' }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                        {/* Icon */}
                        <motion.div
                            animate={{ scale: [1, 1.08, 1] }}
                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                            style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(252,211,77,0.12))',
                                border: '1px solid rgba(251,191,36,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <AlertTriangle className="w-4 h-4" style={{ color: '#FCD34D' }} />
                        </motion.div>

                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2,
                            }}>
                                Credentials Needed
                            </div>
                            <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                                {pendingCredentials.length === 1
                                    ? `${first.serviceName} requires credentials to continue the workflow.`
                                    : `${pendingCredentials.length} services need credentials to continue.`}
                            </p>
                        </div>

                        {/* Close */}
                        <button
                            onClick={() => onDismiss(first.service)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'rgba(255,255,255,0.3)', padding: 2, flexShrink: 0,
                                lineHeight: 1,
                            }}
                            title="Dismiss (workflow will still wait)"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Service pills */}
                    {pendingCredentials.length > 1 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                            {pendingCredentials.map(c => (
                                <span
                                    key={c.service}
                                    style={{
                                        fontSize: 10.5, fontWeight: 600,
                                        padding: '3px 8px', borderRadius: 6,
                                        background: 'rgba(251,191,36,0.1)',
                                        border: '1px solid rgba(251,191,36,0.25)',
                                        color: '#FCD34D',
                                    }}
                                >
                                    {c.serviceName}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* CTA button */}
                    <motion.button
                        onClick={() => onEnterCredentials(first)}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 7, padding: '9px 14px',
                            background: 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(252,211,77,0.12))',
                            border: '1px solid rgba(251,191,36,0.4)',
                            borderRadius: 9, color: '#FCD34D', cursor: 'pointer',
                            fontSize: 12.5, fontWeight: 700,
                        }}
                        whileHover={{
                            background: 'linear-gradient(135deg, rgba(245,158,11,0.35), rgba(252,211,77,0.2))',
                            borderColor: 'rgba(251,191,36,0.6)',
                        }}
                        whileTap={{ scale: 0.97 }}
                    >
                        <Key className="w-3.5 h-3.5" />
                        Enter Credentials for {first.serviceName}
                        <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                    </motion.button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
