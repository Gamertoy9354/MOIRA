import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Sparkles, ChevronDown, ChevronRight, Code2,
    CheckCircle2, XCircle, Loader2, BookOpen,
    Zap, AlertTriangle, Terminal,
} from 'lucide-react';

// ──────────────────── Types ──────────────────────────────────────────────────

export type SynthesisPhase =
    | 'gap_detected'
    | 'synthesizing'
    | 'streaming'
    | 'validating'
    | 'success'
    | 'blocked'
    | 'failed';

export interface DetectedGap {
    service: string;
    reason: string;
    suggestedTools: string[];
}

export interface ToolSynthesisPanelProps {
    open: boolean;
    phase: SynthesisPhase;
    gap?: DetectedGap;
    serviceName?: string;
    streamingCode?: string;
    synthesizedTools?: string[];
    blockReason?: string;
    onViewGuide?: () => void;
    onDismiss: () => void;
    onApprove?: () => void;
    onReject?: () => void;
}

// ──────────────────── Phase config ──────────────────────────────────────────

const PHASE_META: Record<SynthesisPhase, { label: string; color: string; icon: React.ReactNode }> = {
    gap_detected:  { label: 'Gap Detected',    color: '#C8A96E', icon: <AlertTriangle className="w-4 h-4" /> },
    synthesizing:  { label: 'Synthesizing',    color: '#8B35D6', icon: <Sparkles className="w-4 h-4" /> },
    streaming:     { label: 'Generating Code', color: '#9B6FDB', icon: <Code2 className="w-4 h-4" /> },
    validating:    { label: 'Validating',      color: '#C8A96E', icon: <Loader2 className="w-4 h-4" /> },
    success:       { label: 'Woven!',          color: '#34D399', icon: <CheckCircle2 className="w-4 h-4" /> },
    blocked:       { label: 'Blocked',         color: '#F87171', icon: <XCircle className="w-4 h-4" /> },
    failed:        { label: 'Failed',          color: '#F87171', icon: <XCircle className="w-4 h-4" /> },
};

// ──────────────────── Code streaming window ──────────────────────────────────

function CodeWindow({ code, isStreaming }: { code: string; isStreaming: boolean }) {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [code]);

    const lines = code.split('\n');

    return (
        <div style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(200,169,110,0.12)',
            borderRadius: 10,
            overflow: 'hidden',
        }}>
            {/* Title bar */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px',
                background: 'rgba(74,14,143,0.15)',
                borderBottom: '1px solid rgba(200,169,110,0.08)',
            }}>
                <div style={{ display: 'flex', gap: 5 }}>
                    {['#FF5F57', '#FFBD2E', '#28C840'].map(c => (
                        <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
                    ))}
                </div>
                <Terminal className="w-3.5 h-3.5" style={{ color: 'rgba(200,169,110,0.4)' }} />
                <span style={{ fontSize: 11, color: 'rgba(200,169,110,0.5)', fontFamily: 'JetBrains Mono, monospace' }}>
                    synthesized_connector.py
                </span>
                {isStreaming && (
                    <motion.div
                        style={{ marginLeft: 'auto' }}
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                    >
                        <span style={{ fontSize: 10, color: '#C8A96E', fontWeight: 600 }}>● WEAVING</span>
                    </motion.div>
                )}
            </div>

            {/* Code content */}
            <div style={{
                maxHeight: 180,
                overflowY: 'auto',
                padding: '12px 0',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(200,169,110,0.2) transparent',
            }}>
                {lines.map((line, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{
                            display: 'flex',
                            padding: '1px 14px',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11.5,
                            lineHeight: 1.65,
                        }}
                    >
                        <span style={{ color: 'rgba(200,169,110,0.25)', minWidth: 28, userSelect: 'none', textAlign: 'right', paddingRight: 12 }}>
                            {i + 1}
                        </span>
                        <span style={{ color: colorSyntax(line) }}>{line || ' '}</span>
                    </motion.div>
                ))}
                {isStreaming && (
                    <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity }}
                        style={{ display: 'inline-block', width: 7, height: 13, background: '#C8A96E', marginLeft: 42, borderRadius: 1 }}
                    />
                )}
                <div ref={endRef} />
            </div>
        </div>
    );
}

function colorSyntax(line: string): string {
    const t = line.trimStart();
    if (t.startsWith('def ') || t.startsWith('class ') || t.startsWith('async def ')) return '#C8A96E';
    if (t.startsWith('#')) return 'rgba(200,169,110,0.35)';
    if (t.startsWith('return ')) return '#E8D5A3';
    if (t.startsWith('import ') || t.startsWith('from ')) return '#9B6FDB';
    if (t.startsWith('"') || t.startsWith("'")) return '#86EFAC';
    return 'rgba(240,235,248,0.78)';
}

// ──────────────────── Progress Steps ────────────────────────────────────────

const STEPS: SynthesisPhase[] = ['gap_detected', 'synthesizing', 'streaming', 'validating', 'success'];

function ProgressSteps({ phase }: { phase: SynthesisPhase }) {
    const currentIdx = STEPS.indexOf(phase);
    const isFailure = phase === 'blocked' || phase === 'failed';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16 }}>
            {STEPS.map((step, i) => {
                const done = currentIdx > i || phase === 'success';
                const active = currentIdx === i && !isFailure;
                const meta = PHASE_META[step];
                return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                        <div style={{
                            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                            background: done ? '#34D399' : active ? meta.color : 'rgba(200,169,110,0.08)',
                            border: `2px solid ${done ? '#34D399' : active ? meta.color : 'rgba(200,169,110,0.15)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.3s',
                            boxShadow: active ? `0 0 12px ${meta.color}66` : 'none',
                        }}>
                            {done ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            ) : active ? (
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                                    <Loader2 className="w-3.5 h-3.5 text-white" />
                                </motion.div>
                            ) : (
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(200,169,110,0.3)' }} />
                            )}
                        </div>
                        {i < STEPS.length - 1 && (
                            <div style={{
                                flex: 1, height: 2,
                                margin: '0 8px',
                                background: done ? 'linear-gradient(90deg, #34D399, #C8A96E)' : 'rgba(200,169,110,0.08)',
                                transition: 'background 0.4s',
                            }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ──────────────────── Main Component ────────────────────────────────────────

export function ToolSynthesisPanel({
    open, phase, gap, serviceName,
    streamingCode = '', synthesizedTools = [],
    blockReason, onViewGuide, onDismiss, onApprove, onReject,
}: ToolSynthesisPanelProps) {
    const [codeExpanded, setCodeExpanded] = useState(true);
    const meta = PHASE_META[phase];
    const isFailure = phase === 'blocked' || phase === 'failed';
    const isSuccess = phase === 'success';
    const isStreaming = phase === 'streaming';

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                    style={{
                        position: 'fixed',
                        bottom: 96,
                        right: 24,
                        width: 'min(480px, calc(100vw - 48px))',
                        borderRadius: 16,
                        background: 'rgba(8,6,16,0.97)',
                        border: `1px solid ${isFailure ? 'rgba(248,113,113,0.3)' : isSuccess ? 'rgba(52,211,153,0.3)' : 'rgba(200,169,110,0.2)'}`,
                        boxShadow: `0 30px 80px rgba(0,0,0,0.85), 0 0 60px ${isFailure ? 'rgba(239,68,68,0.1)' : isSuccess ? 'rgba(52,211,153,0.1)' : 'rgba(74,14,143,0.2)'}`,
                        zIndex: 55,
                        overflow: 'hidden',
                    }}
                >
                    {/* Animated top stripe */}
                    <motion.div
                        style={{ height: 3, background: `linear-gradient(90deg, ${meta.color}, ${meta.color}44, transparent)` }}
                        animate={{ scaleX: isStreaming ? [0.3, 1, 0.3] : 1 }}
                        transition={{ duration: 2, repeat: isStreaming ? Infinity : 0, ease: 'easeInOut' }}
                    />

                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '14px 18px 12px',
                        borderBottom: '1px solid rgba(200,169,110,0.07)',
                        background: 'rgba(74,14,143,0.06)',
                    }}>
                        <motion.div
                            style={{
                                width: 34, height: 34, borderRadius: 10,
                                background: `${meta.color}1A`,
                                border: `1px solid ${meta.color}33`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: meta.color, flexShrink: 0,
                            }}
                            animate={!isFailure && !isSuccess ? { boxShadow: [`0 0 0px ${meta.color}00`, `0 0 14px ${meta.color}55`, `0 0 0px ${meta.color}00`] } : {}}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            {meta.icon}
                        </motion.div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#F0EBF8', fontFamily: 'Cinzel, serif' }}>
                                    {isSuccess ? `${serviceName ?? gap?.service} Woven` : 'Thread Synthesis Engine'}
                                </span>
                                <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 7px',
                                    background: `${meta.color}1A`,
                                    border: `1px solid ${meta.color}33`,
                                    borderRadius: 20, color: meta.color,
                                    textTransform: 'uppercase', letterSpacing: '0.05em',
                                }}>
                                    {meta.label}
                                </span>
                            </div>
                            <p style={{ fontSize: 11.5, color: 'rgba(240,235,248,0.4)', margin: '2px 0 0' }}>
                                {isSuccess
                                    ? `${synthesizedTools.length} thread(s) woven into the loom`
                                    : gap
                                        ? `No connector found for "${gap.service}" — weaving now`
                                        : 'Generating a new MCP connector on-the-fly'}
                            </p>
                        </div>

                        <button
                            onClick={onDismiss}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(200,169,110,0.4)', padding: 4, flexShrink: 0, fontSize: 14 }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '14px 18px' }}>
                        <ProgressSteps phase={phase} />

                        {/* Gap info */}
                        {gap && phase === 'gap_detected' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                style={{
                                    padding: '10px 13px',
                                    background: 'rgba(200,169,110,0.06)',
                                    border: '1px solid rgba(200,169,110,0.2)',
                                    borderRadius: 9,
                                    marginBottom: 12,
                                }}
                            >
                                <p style={{ fontSize: 12, color: '#C8A96E', fontWeight: 600, margin: '0 0 5px' }}>
                                    Missing Thread: {gap.service}
                                </p>
                                <p style={{ fontSize: 11.5, color: 'rgba(240,235,248,0.45)', margin: '0 0 8px' }}>{gap.reason}</p>
                                {gap.suggestedTools.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                        {gap.suggestedTools.map(t => (
                                            <span key={t} style={{
                                                fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace',
                                                background: 'rgba(200,169,110,0.1)',
                                                border: '1px solid rgba(200,169,110,0.2)',
                                                borderRadius: 5, padding: '2px 7px',
                                                color: '#E8D5A3',
                                            }}>{t}</span>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Streaming code */}
                        {(isStreaming || phase === 'validating' || isSuccess) && streamingCode && (
                            <div style={{ marginBottom: 12 }}>
                                <button
                                    onClick={() => setCodeExpanded(v => !v)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 5,
                                        width: '100%', background: 'none', border: 'none',
                                        cursor: 'pointer', color: 'rgba(200,169,110,0.55)',
                                        fontSize: 11.5, fontWeight: 600, padding: '0 0 8px',
                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                    }}
                                >
                                    <Code2 className="w-3.5 h-3.5" />
                                    Woven Code
                                    {codeExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>
                                <AnimatePresence>
                                    {codeExpanded && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                        >
                                            <CodeWindow code={streamingCode} isStreaming={isStreaming} />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Success state */}
                        {isSuccess && synthesizedTools.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    padding: '11px 13px',
                                    background: 'rgba(52,211,153,0.07)',
                                    border: '1px solid rgba(52,211,153,0.2)',
                                    borderRadius: 9,
                                    marginBottom: 12,
                                }}
                            >
                                <p style={{ fontSize: 12, color: '#34D399', fontWeight: 600, margin: '0 0 7px', display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <Zap className="w-3.5 h-3.5" />
                                    {synthesizedTools.length} thread(s) now in the loom
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                    {synthesizedTools.map(t => (
                                        <span key={t} style={{
                                            fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                                            background: 'rgba(52,211,153,0.1)',
                                            border: '1px solid rgba(52,211,153,0.25)',
                                            borderRadius: 5, padding: '2px 8px', color: '#6EE7B7',
                                        }}>{t}</span>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Blocked/failed */}
                        {isFailure && blockReason && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    padding: '10px 13px',
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    borderRadius: 9,
                                    marginBottom: 12,
                                }}
                            >
                                <p style={{ fontSize: 12, color: '#F87171', fontWeight: 600, margin: '0 0 4px' }}>
                                    {phase === 'blocked' ? "🛡️ Fate's Will Denied" : '❌ Thread Broke'}
                                </p>
                                <p style={{ fontSize: 11.5, color: 'rgba(240,235,248,0.4)', margin: 0 }}>{blockReason}</p>
                            </motion.div>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            {phase === 'gap_detected' && onApprove && onReject && (
                                <>
                                    <motion.button
                                        onClick={onReject}
                                        style={{
                                            padding: '7px 16px', fontSize: 12, fontWeight: 600,
                                            background: 'rgba(239,68,68,0.08)',
                                            border: '1px solid rgba(239,68,68,0.25)',
                                            borderRadius: 8, color: '#F87171', cursor: 'pointer',
                                        }}
                                        whileHover={{ background: 'rgba(239,68,68,0.16)' }}
                                        whileTap={{ scale: 0.97 }}
                                    >
                                        Reject
                                    </motion.button>
                                    <motion.button
                                        onClick={onApprove}
                                        style={{
                                            padding: '7px 16px', fontSize: 12, fontWeight: 600,
                                            background: 'linear-gradient(135deg, rgba(74,14,143,0.6), rgba(139,53,214,0.6))',
                                            border: '1px solid rgba(200,169,110,0.3)',
                                            borderRadius: 8, color: '#E8D5A3', cursor: 'pointer',
                                        }}
                                        whileHover={{ borderColor: 'rgba(200,169,110,0.6)', boxShadow: '0 0 16px rgba(200,169,110,0.2)' }}
                                        whileTap={{ scale: 0.97 }}
                                    >
                                        Approve & Weave
                                    </motion.button>
                                </>
                            )}
                            {isSuccess && onViewGuide && (
                                <motion.button
                                    onClick={onViewGuide}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 5,
                                        padding: '7px 14px', fontSize: 12, fontWeight: 600,
                                        background: 'rgba(52,211,153,0.08)',
                                        border: '1px solid rgba(52,211,153,0.25)',
                                        borderRadius: 8, color: '#34D399', cursor: 'pointer',
                                    }}
                                    whileHover={{ background: 'rgba(52,211,153,0.16)' }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    Oracle Guide
                                </motion.button>
                            )}
                            {phase !== 'gap_detected' && (
                                <motion.button
                                    onClick={onDismiss}
                                    style={{
                                        padding: '7px 16px', fontSize: 12, fontWeight: 600,
                                        background: 'rgba(200,169,110,0.05)',
                                        border: '1px solid rgba(200,169,110,0.12)',
                                        borderRadius: 8, color: 'rgba(200,169,110,0.6)', cursor: 'pointer',
                                    }}
                                    whileHover={{ background: 'rgba(200,169,110,0.1)', color: '#C8A96E' }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    {isSuccess ? 'Continue' : 'Dismiss'}
                                </motion.button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
