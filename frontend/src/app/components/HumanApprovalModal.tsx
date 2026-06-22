import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export interface HumanApprovalModalProps {
    open: boolean;
    workflowId: string;
    stepId: string;
    connector: string;
    tool: string;
    reason: string;
    params: any;
    onClose: () => void;
    onSubmit: (approved: boolean, workflowId: string, stepId: string) => Promise<void>;
}

export function HumanApprovalModal({
    open, workflowId, stepId, connector, tool, reason, params, onClose, onSubmit,
}: HumanApprovalModalProps) {
    const [submitting, setSubmitting] = useState(false);

    const handleAction = async (approved: boolean) => {
        setSubmitting(true);
        try { await onSubmit(approved, workflowId, stepId); onClose(); }
        finally { setSubmitting(false); }
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'rgba(0,0,0,0.72)',
                            backdropFilter: 'blur(10px)',
                            zIndex: 60,
                        }}
                    />

                    {/* Modal */}
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 61,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 20, pointerEvents: 'none',
                    }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.93, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.93, y: 20 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                            style={{
                                width: 'min(520px, 100%)',
                                borderRadius: 18,
                                background: 'rgba(8,6,16,0.99)',
                                border: '1px solid rgba(200,169,110,0.22)',
                                boxShadow: '0 40px 120px rgba(0,0,0,0.92), 0 0 80px rgba(200,169,110,0.08)',
                                overflow: 'hidden',
                                pointerEvents: 'all',
                            }}
                        >
                            {/* Top accent — amber/gold for "caution" */}
                            <motion.div
                                style={{ height: 3, background: 'linear-gradient(90deg, #4A0E8F, #C8A96E, #4A0E8F)' }}
                                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                                transition={{ duration: 3, repeat: Infinity }}
                            />

                            {/* Header */}
                            <div style={{
                                padding: '20px 24px 16px',
                                borderBottom: '1px solid rgba(200,169,110,0.07)',
                                background: 'linear-gradient(135deg, rgba(200,169,110,0.08), rgba(74,14,143,0.08))',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {/* Pulsing warning icon */}
                                        <motion.div
                                            animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
                                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                                            style={{
                                                width: 44, height: 44, borderRadius: 12,
                                                background: 'linear-gradient(135deg, rgba(200,169,110,0.25), rgba(74,14,143,0.4))',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0,
                                                border: '1px solid rgba(200,169,110,0.3)',
                                                boxShadow: '0 0 24px rgba(200,169,110,0.2)',
                                            }}
                                        >
                                            <ShieldAlert className="w-5 h-5" style={{ color: '#E8D5A3' }} />
                                        </motion.div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                                                <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#C8A96E' }} />
                                                <span style={{
                                                    fontSize: 10, fontWeight: 700, color: '#C8A96E',
                                                    textTransform: 'uppercase', letterSpacing: '0.1em',
                                                    fontFamily: 'Cinzel, serif',
                                                }}>
                                                    Fate Awaits Your Word
                                                </span>
                                            </div>
                                            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#F0EBF8', margin: 0, fontFamily: 'Cinzel, serif' }}>
                                                Approval Required
                                            </h2>
                                        </div>
                                    </div>
                                    {!submitting && (
                                        <button
                                            onClick={onClose}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(200,169,110,0.4)', padding: 4, flexShrink: 0 }}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Info strip */}
                                <div style={{
                                    marginTop: 14, padding: '11px 14px',
                                    background: 'rgba(200,169,110,0.06)',
                                    border: '1px solid rgba(200,169,110,0.18)',
                                    borderRadius: 10,
                                }}>
                                    <p style={{ fontSize: 13, color: 'rgba(240,235,248,0.85)', margin: 0, lineHeight: 1.5 }}>
                                        <strong style={{ color: '#C8A96E' }}>{connector}.{tool}</strong> seeks to execute — but this action requires your decree.
                                    </p>
                                    <p style={{ color: 'rgba(240,235,248,0.45)', fontSize: 12, marginTop: 6 }}>
                                        {reason}
                                    </p>
                                </div>
                            </div>

                            {/* Body — params */}
                            <div style={{ padding: '20px 24px', maxHeight: '40vh', overflowY: 'auto' }}>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    fontSize: 11, fontWeight: 600,
                                    color: 'rgba(200,169,110,0.5)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    marginBottom: 10,
                                }}>
                                    Tool Parameters
                                </label>
                                <pre style={{
                                    background: 'rgba(74,14,143,0.08)',
                                    border: '1px solid rgba(200,169,110,0.12)',
                                    borderRadius: 10,
                                    color: '#E8D5A3',
                                    padding: '14px',
                                    fontSize: 12,
                                    fontFamily: 'JetBrains Mono, monospace',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                    lineHeight: 1.65,
                                }}>
                                    {JSON.stringify(params, null, 2)}
                                </pre>
                            </div>

                            {/* Footer */}
                            <div style={{
                                padding: '14px 24px',
                                borderTop: '1px solid rgba(200,169,110,0.07)',
                                background: 'rgba(0,0,0,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
                            }}>
                                <motion.button
                                    onClick={() => handleAction(false)}
                                    disabled={submitting}
                                    style={{
                                        padding: '8px 20px', fontSize: 13, fontWeight: 600,
                                        background: 'rgba(239,68,68,0.08)',
                                        border: '1px solid rgba(239,68,68,0.25)',
                                        borderRadius: 10, color: '#fca5a5', cursor: submitting ? 'wait' : 'pointer',
                                    }}
                                    whileHover={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    Deny
                                </motion.button>
                                <motion.button
                                    onClick={() => handleAction(true)}
                                    disabled={submitting}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 7,
                                        padding: '8px 24px', fontSize: 13, fontWeight: 700,
                                        background: 'linear-gradient(135deg, #4A0E8F, #8B35D6)',
                                        border: '1px solid rgba(200,169,110,0.3)',
                                        borderRadius: 10, color: '#F0EBF8', cursor: submitting ? 'wait' : 'pointer',
                                        boxShadow: '0 0 20px rgba(74,14,143,0.5)',
                                        fontFamily: 'Cinzel, serif',
                                        letterSpacing: '0.04em',
                                    }}
                                    whileHover={!submitting ? { scale: 1.02, boxShadow: '0 0 28px rgba(200,169,110,0.2)' } : {}}
                                    whileTap={!submitting ? { scale: 0.97 } : {}}
                                >
                                    {submitting
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <CheckCircle2 className="w-4 h-4" />}
                                    Grant Decree
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
