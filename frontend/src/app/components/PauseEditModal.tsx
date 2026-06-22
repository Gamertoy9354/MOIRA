import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Pause, Play, RotateCcw, Send, Edit3 } from 'lucide-react';

// ──────────────────── Types ─────────────────────────────────────────────────

interface PauseEditModalProps {
    open: boolean;
    originalPrompt: string;
    workflowId: string;
    onClose: () => void;
    onResubmit: (newPrompt: string) => void;
    onResume: () => void;
}

// ──────────────────── Component ──────────────────────────────────────────────

export function PauseEditModal({
    open,
    originalPrompt,
    workflowId,
    onClose,
    onResubmit,
    onResume,
}: PauseEditModalProps) {
    const [prompt, setPrompt] = useState(originalPrompt);

    useEffect(() => {
        if (open) setPrompt(originalPrompt);
    }, [open, originalPrompt]);

    const hasChanges = prompt.trim() !== originalPrompt.trim();

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'rgba(0,0,0,0.65)',
                            backdropFilter: 'blur(6px)',
                            zIndex: 9000,
                        }}
                    />

                    {/* Modal */}
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 9001,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 20, pointerEvents: 'none',
                    }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 24 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 24 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                            style={{
                                width: 'min(580px, 100%)',
                                borderRadius: 18,
                                background: 'rgba(8,5,18,0.99)',
                                border: '1px solid rgba(251,191,36,0.25)',
                                boxShadow: '0 40px 120px rgba(0,0,0,0.9), 0 0 60px rgba(251,191,36,0.1)',
                                overflow: 'hidden',
                                pointerEvents: 'all',
                            }}
                        >
                            {/* Top accent bar */}
                            <div style={{
                                height: 2,
                                background: 'linear-gradient(90deg, #F59E0B, #FCD34D, #F59E0B)',
                            }} />

                            {/* Header */}
                            <div style={{
                                padding: '20px 24px 16px',
                                borderBottom: '1px solid rgba(255,255,255,0.07)',
                                background: 'linear-gradient(135deg, rgba(245,158,11,0.08), transparent)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 11,
                                        background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(252,211,77,0.12))',
                                        border: '1px solid rgba(251,191,36,0.3)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Pause className="w-4.5 h-4.5" style={{ color: '#FCD34D' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                                            Workflow Paused
                                        </div>
                                        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>
                                            Edit &amp; Re-run
                                        </h2>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 4 }}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Body */}
                            <div style={{ padding: '20px 24px' }}>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                                    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
                                }}>
                                    <Edit3 className="w-3 h-3" />
                                    Your Prompt
                                </label>
                                <textarea
                                    value={prompt}
                                    onChange={e => setPrompt(e.target.value)}
                                    rows={6}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 10,
                                        color: 'rgba(255,255,255,0.85)',
                                        padding: '12px 14px',
                                        fontSize: 13.5,
                                        lineHeight: 1.6,
                                        fontFamily: 'inherit',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        resize: 'vertical',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => (e.target.style.borderColor = 'rgba(251,191,36,0.4)')}
                                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                                />
                                {hasChanges && (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        style={{ fontSize: 11.5, color: 'rgba(251,191,36,0.7)', marginTop: 6 }}
                                    >
                                        ✎ You've modified the prompt — clicking "Re-run" will kill the current workflow and start fresh.
                                    </motion.p>
                                )}
                                {!hasChanges && (
                                    <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>
                                        Modify the prompt above then re-run, or resume the paused workflow as-is.
                                    </p>
                                )}
                            </div>

                            {/* Footer */}
                            <div style={{
                                padding: '14px 24px',
                                borderTop: '1px solid rgba(255,255,255,0.07)',
                                background: 'rgba(0,0,0,0.3)',
                                display: 'flex', alignItems: 'center', gap: 10,
                            }}>
                                {/* Resume */}
                                <motion.button
                                    onClick={onResume}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '8px 16px', fontSize: 12.5, fontWeight: 600,
                                        background: 'rgba(52,211,153,0.1)',
                                        border: '1px solid rgba(52,211,153,0.25)',
                                        borderRadius: 9, color: '#34D399', cursor: 'pointer',
                                    }}
                                    whileHover={{ background: 'rgba(52,211,153,0.18)', borderColor: 'rgba(52,211,153,0.45)' }}
                                    whileTap={{ scale: 0.96 }}
                                >
                                    <Play className="w-3.5 h-3.5" />
                                    Resume
                                </motion.button>

                                <div style={{ flex: 1 }} />

                                {/* Cancel */}
                                <motion.button
                                    onClick={onClose}
                                    style={{
                                        padding: '8px 14px', fontSize: 12.5, fontWeight: 600,
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 9, color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                                    }}
                                    whileHover={{ background: 'rgba(255,255,255,0.09)' }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    Cancel
                                </motion.button>

                                {/* Re-run */}
                                <motion.button
                                    onClick={() => onResubmit(prompt.trim())}
                                    disabled={!prompt.trim()}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '8px 20px', fontSize: 12.5, fontWeight: 700,
                                        background: hasChanges
                                            ? 'linear-gradient(135deg, #F59E0B, #FCD34D)'
                                            : 'linear-gradient(135deg, #7C3AED, #C084FC)',
                                        border: 'none', borderRadius: 9, color: hasChanges ? '#000' : '#fff',
                                        cursor: prompt.trim() ? 'pointer' : 'not-allowed',
                                        opacity: prompt.trim() ? 1 : 0.5,
                                        boxShadow: hasChanges
                                            ? '0 0 20px rgba(245,158,11,0.35)'
                                            : '0 0 20px rgba(124,58,237,0.35)',
                                        transition: 'background 0.3s, box-shadow 0.3s',
                                    }}
                                    whileHover={prompt.trim() ? { scale: 1.02 } : {}}
                                    whileTap={prompt.trim() ? { scale: 0.97 } : {}}
                                >
                                    {hasChanges ? <RotateCcw className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                                    {hasChanges ? 'Kill & Re-run' : 'Re-run Same'}
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
