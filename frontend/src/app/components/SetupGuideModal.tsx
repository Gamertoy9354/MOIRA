import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, BookOpen, Copy, Check, ChevronDown, ChevronRight,
    Terminal, Key, AlertCircle, CheckCircle2, ExternalLink,
    DollarSign, Zap,
} from 'lucide-react';

// ──────────────────── Types ─────────────────────────────────────────────────

export interface GuideStep {
    title: string;
    description: string;
    envVars?: Array<{ key: string; example: string; hint?: string }>;
    commands?: string[];
    url?: string;
    urlLabel?: string;
}

export interface CommonError {
    error: string;
    solution: string;
}

export interface SetupGuideModalProps {
    open: boolean;
    serviceName: string;
    serviceDescription?: string;
    pricingInfo?: string;
    steps: GuideStep[];
    commonErrors?: CommonError[];
    onClose: () => void;
    onEnterCredentials?: () => void;
}

// ──────────────────── Utility ────────────────────────────────────────────────

function useCopy(timeout = 1800) {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const copy = (text: string, key: string) => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), timeout);
    };
    return { copiedKey, copy };
}

// ──────────────────── Sub-components ────────────────────────────────────────

function CopyButton({ text, id, copiedKey, onCopy }: { text: string; id: string; copiedKey: string | null; onCopy: (t: string, k: string) => void }) {
    const copied = copiedKey === id;
    return (
        <motion.button
            onClick={() => onCopy(text, id)}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', fontSize: 11, fontWeight: 600,
                background: copied ? 'rgba(52,211,153,0.12)' : 'rgba(200,169,110,0.06)',
                border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(200,169,110,0.15)'}`,
                borderRadius: 6, color: copied ? '#34D399' : 'rgba(200,169,110,0.55)',
                cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
            }}
            whileTap={{ scale: 0.95 }}
        >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
        </motion.button>
    );
}

function StepCard({
    step, index, isActive, isCompleted, onToggle, copiedKey, onCopy,
}: {
    step: GuideStep;
    index: number;
    isActive: boolean;
    isCompleted: boolean;
    onToggle: () => void;
    copiedKey: string | null;
    onCopy: (t: string, k: string) => void;
}) {
    return (
        <div style={{
            border: `1px solid ${isActive ? 'rgba(200,169,110,0.3)' : isCompleted ? 'rgba(52,211,153,0.2)' : 'rgba(200,169,110,0.07)'}`,
            borderRadius: 12,
            background: isActive ? 'rgba(74,14,143,0.1)' : 'rgba(200,169,110,0.02)',
            marginBottom: 10,
            overflow: 'hidden',
            transition: 'border-color 0.2s, background 0.2s',
        }}>
            <button
                onClick={onToggle}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
            >
                <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: isCompleted ? '#34D399' : isActive ? '#C8A96E' : 'rgba(200,169,110,0.08)',
                    border: `2px solid ${isCompleted ? '#34D399' : isActive ? '#C8A96E' : 'rgba(200,169,110,0.15)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s',
                    boxShadow: isActive ? '0 0 10px rgba(200,169,110,0.3)' : 'none',
                }}>
                    {isCompleted
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        : <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#080610' : 'rgba(200,169,110,0.4)' }}>{index + 1}</span>
                    }
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#E8D5A3' : 'rgba(240,235,248,0.6)', margin: 0 }}>
                        {step.title}
                    </p>
                </div>

                {step.url && (
                    <a
                        href={step.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#C8A96E', textDecoration: 'none' }}
                    >
                        {step.urlLabel ?? 'Open'}
                        <ExternalLink className="w-3 h-3" />
                    </a>
                )}

                <motion.div animate={{ rotate: isActive ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4" style={{ color: 'rgba(200,169,110,0.35)' }} />
                </motion.div>
            </button>

            <AnimatePresence>
                {isActive && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ padding: '0 16px 16px' }}>
                            <p style={{ fontSize: 12.5, color: 'rgba(240,235,248,0.45)', marginBottom: 14, lineHeight: 1.6 }}>
                                {step.description}
                            </p>

                            {step.envVars && step.envVars.length > 0 && (
                                <div style={{ marginBottom: 14 }}>
                                    <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(200,169,110,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                                        Environment Variables
                                    </p>
                                    {step.envVars.map((ev, i) => (
                                        <div key={i} style={{
                                            background: 'rgba(74,14,143,0.08)',
                                            border: '1px solid rgba(200,169,110,0.1)',
                                            borderRadius: 8, padding: '10px 12px',
                                            marginBottom: 8,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: ev.hint ? 5 : 0 }}>
                                                <Key className="w-3 h-3" style={{ color: '#C8A96E', flexShrink: 0 }} />
                                                <code style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#C8A96E', flex: 1 }}>{ev.key}</code>
                                                <code style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace', color: 'rgba(240,235,248,0.35)', flex: 1 }}>= {ev.example}</code>
                                                <CopyButton text={`${ev.key}=${ev.example}`} id={`ev-${i}-${ev.key}`} copiedKey={copiedKey} onCopy={onCopy} />
                                            </div>
                                            {ev.hint && (
                                                <p style={{ fontSize: 11, color: 'rgba(200,169,110,0.28)', margin: '4px 0 0 22px' }}>{ev.hint}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {step.commands && step.commands.length > 0 && (
                                <div>
                                    <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(200,169,110,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                                        Commands
                                    </p>
                                    {step.commands.map((cmd, i) => (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            background: 'rgba(0,0,0,0.45)',
                                            border: '1px solid rgba(200,169,110,0.08)',
                                            borderRadius: 8, padding: '9px 12px',
                                            marginBottom: 6,
                                        }}>
                                            <Terminal className="w-3.5 h-3.5" style={{ color: 'rgba(200,169,110,0.3)', flexShrink: 0 }} />
                                            <code style={{ flex: 1, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#86EFAC' }}>{cmd}</code>
                                            <CopyButton text={cmd} id={`cmd-${i}`} copiedKey={copiedKey} onCopy={onCopy} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ──────────────────── Main Component ────────────────────────────────────────

export function SetupGuideModal({
    open, serviceName, serviceDescription, pricingInfo,
    steps, commonErrors = [], onClose, onEnterCredentials,
}: SetupGuideModalProps) {
    const [activeStep, setActiveStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [errorsExpanded, setErrorsExpanded] = useState(false);
    const { copiedKey, copy } = useCopy();

    const toggleStep = (i: number) => { setActiveStep(prev => prev === i ? -1 : i); };

    const markDone = (i: number) => {
        setCompletedSteps(prev => { const next = new Set(prev); next.add(i); return next; });
        if (i < steps.length - 1) setActiveStep(i + 1);
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'rgba(0,0,0,0.72)',
                            backdropFilter: 'blur(10px)',
                            zIndex: 62,
                        }}
                    />

                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 63,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 20, pointerEvents: 'none',
                    }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 20 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                            style={{
                                width: 'min(620px, 100%)',
                                maxHeight: '88vh',
                                borderRadius: 18,
                                background: 'rgba(8,6,16,0.99)',
                                border: '1px solid rgba(200,169,110,0.18)',
                                boxShadow: '0 40px 120px rgba(0,0,0,0.92), 0 0 80px rgba(74,14,143,0.2)',
                                display: 'flex', flexDirection: 'column',
                                overflow: 'hidden',
                                pointerEvents: 'all',
                            }}
                        >
                            {/* Top accent */}
                            <div style={{ height: 2, background: 'linear-gradient(90deg, #4A0E8F, #C8A96E, #4A0E8F)', flexShrink: 0 }} />

                            {/* Header */}
                            <div style={{
                                padding: '20px 24px 16px',
                                borderBottom: '1px solid rgba(200,169,110,0.07)',
                                background: 'linear-gradient(135deg, rgba(74,14,143,0.15), transparent)',
                                flexShrink: 0,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{
                                            width: 42, height: 42, borderRadius: 12,
                                            background: 'linear-gradient(135deg, #4A0E8F, #8B35D6)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: '0 0 24px rgba(139,53,214,0.4)',
                                            border: '1px solid rgba(200,169,110,0.2)',
                                        }}>
                                            <BookOpen className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: '#C8A96E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3, fontFamily: 'Cinzel, serif' }}>
                                                Oracle's Guide
                                            </div>
                                            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#F0EBF8', margin: 0, fontFamily: 'Cinzel, serif' }}>
                                                {serviceName} Integration
                                            </h2>
                                            {serviceDescription && (
                                                <p style={{ fontSize: 12, color: 'rgba(200,169,110,0.4)', margin: '2px 0 0' }}>
                                                    {serviceDescription}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(200,169,110,0.4)', padding: 4 }}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {pricingInfo && (
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '5px 12px',
                                        background: 'rgba(52,211,153,0.07)',
                                        border: '1px solid rgba(52,211,153,0.18)',
                                        borderRadius: 20,
                                    }}>
                                        <DollarSign className="w-3.5 h-3.5" style={{ color: '#34D399' }} />
                                        <span style={{ fontSize: 11.5, color: 'rgba(240,235,248,0.5)' }}>{pricingInfo}</span>
                                    </div>
                                )}

                                {/* Progress bar */}
                                <div style={{ marginTop: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontSize: 11, color: 'rgba(200,169,110,0.4)' }}>
                                            {completedSteps.size} of {steps.length} steps complete
                                        </span>
                                        <span style={{ fontSize: 11, color: '#C8A96E' }}>
                                            {Math.round((completedSteps.size / Math.max(steps.length, 1)) * 100)}%
                                        </span>
                                    </div>
                                    <div style={{ height: 3, background: 'rgba(200,169,110,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                                        <motion.div
                                            style={{ height: '100%', background: 'linear-gradient(90deg, #4A0E8F, #C8A96E)', borderRadius: 4 }}
                                            animate={{ width: `${(completedSteps.size / Math.max(steps.length, 1)) * 100}%` }}
                                            transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable body */}
                            <div style={{
                                flex: 1, overflowY: 'auto', padding: '16px 24px',
                                scrollbarWidth: 'thin', scrollbarColor: 'rgba(200,169,110,0.2) transparent',
                            }}>
                                {steps.map((step, i) => (
                                    <div key={i}>
                                        <StepCard
                                            step={step} index={i}
                                            isActive={activeStep === i}
                                            isCompleted={completedSteps.has(i)}
                                            onToggle={() => toggleStep(i)}
                                            copiedKey={copiedKey}
                                            onCopy={copy}
                                        />
                                        {activeStep === i && !completedSteps.has(i) && (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10, marginTop: -4 }}>
                                                <motion.button
                                                    onClick={() => markDone(i)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 5,
                                                        padding: '5px 14px', fontSize: 11.5, fontWeight: 600,
                                                        background: 'rgba(52,211,153,0.08)',
                                                        border: '1px solid rgba(52,211,153,0.25)',
                                                        borderRadius: 7, color: '#34D399', cursor: 'pointer',
                                                    }}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.97 }}
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Mark as done
                                                </motion.button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {commonErrors.length > 0 && (
                                    <div style={{ marginTop: 8 }}>
                                        <button
                                            onClick={() => setErrorsExpanded(v => !v)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 7,
                                                width: '100%', background: 'none', border: 'none',
                                                cursor: 'pointer', padding: '10px 0',
                                                color: 'rgba(200,169,110,0.45)', fontSize: 12, fontWeight: 600,
                                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                            }}
                                        >
                                            <AlertCircle className="w-3.5 h-3.5" style={{ color: '#C8A96E' }} />
                                            Common Errors & Fixes ({commonErrors.length})
                                            {errorsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        </button>
                                        <AnimatePresence>
                                            {errorsExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    {commonErrors.map((ce, i) => (
                                                        <div key={i} style={{
                                                            padding: '10px 14px',
                                                            background: 'rgba(200,169,110,0.05)',
                                                            border: '1px solid rgba(200,169,110,0.12)',
                                                            borderRadius: 9, marginBottom: 8,
                                                        }}>
                                                            <p style={{ fontSize: 12, fontWeight: 600, color: '#C8A96E', margin: '0 0 5px' }}>
                                                                ⚠️ {ce.error}
                                                            </p>
                                                            <p style={{ fontSize: 12, color: 'rgba(240,235,248,0.4)', margin: 0 }}>
                                                                ✓ {ce.solution}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div style={{
                                padding: '14px 24px',
                                borderTop: '1px solid rgba(200,169,110,0.07)',
                                background: 'rgba(0,0,0,0.3)',
                                display: 'flex', alignItems: 'center', gap: 10,
                                flexShrink: 0,
                            }}>
                                <span style={{ fontSize: 11.5, color: 'rgba(200,169,110,0.25)', marginRight: 'auto' }}>
                                    {completedSteps.size === steps.length
                                        ? '✓ All steps complete — ready to connect'
                                        : `Complete all ${steps.length} steps to configure ${serviceName}`}
                                </span>
                                <motion.button
                                    onClick={onClose}
                                    style={{
                                        padding: '7px 16px', fontSize: 12.5, fontWeight: 600,
                                        background: 'rgba(200,169,110,0.04)',
                                        border: '1px solid rgba(200,169,110,0.1)',
                                        borderRadius: 8, color: 'rgba(200,169,110,0.45)', cursor: 'pointer',
                                    }}
                                    whileHover={{ background: 'rgba(200,169,110,0.08)', color: 'rgba(200,169,110,0.7)' }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    Close
                                </motion.button>
                                {onEnterCredentials && (
                                    <motion.button
                                        onClick={onEnterCredentials}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 7,
                                            padding: '7px 20px', fontSize: 12.5, fontWeight: 700,
                                            background: 'linear-gradient(135deg, #4A0E8F, #8B35D6)',
                                            border: '1px solid rgba(200,169,110,0.25)',
                                            borderRadius: 8, color: '#F0EBF8', cursor: 'pointer',
                                            boxShadow: '0 0 20px rgba(74,14,143,0.4)',
                                        }}
                                        whileHover={{ scale: 1.02, boxShadow: '0 0 28px rgba(200,169,110,0.2)' }}
                                        whileTap={{ scale: 0.97 }}
                                    >
                                        <Zap className="w-4 h-4" />
                                        Enter Keys
                                    </motion.button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
