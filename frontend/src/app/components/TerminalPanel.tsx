import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Trash2, ChevronDown, Filter, Zap, Brain, CheckCircle, XCircle, RefreshCw, Wrench, AlertTriangle, Clock } from 'lucide-react';
import { TerminalLine } from '../../services/types';

interface TerminalPanelProps {
    lines: TerminalLine[];
    onClear: () => void;
    width?: number;
}

type FilterTab = 'all' | 'plan' | 'exec' | 'errors';

const FILTER_TABS: { id: FilterTab; label: string }[] = [
    { id: 'all',    label: 'All' },
    { id: 'plan',   label: 'Plan' },
    { id: 'exec',   label: 'Exec' },
    { id: 'errors', label: 'Errors' },
];

function classifyLine(text: string, level: string): { category: FilterTab; icon: React.ReactNode; color: string } {
    const t = text.toLowerCase();

    if (level === 'error' || t.includes('failed') || t.includes('error') || t.includes('✗')) {
        return { category: 'errors', icon: <XCircle className="w-3 h-3 shrink-0" />, color: '#f87171' };
    }
    if (t.includes('planning') || t.includes('llm') || t.includes('◆') || t.includes('brain') || t.includes('analyzing') || t.includes('workflow created')) {
        return { category: 'plan', icon: <Brain className="w-3 h-3 shrink-0" />, color: '#a78bfa' };
    }
    if (t.includes('recovery') || t.includes('retrying') || t.includes('↻') || t.includes('patched') || t.includes('circuit')) {
        return { category: 'exec', icon: <Wrench className="w-3 h-3 shrink-0" />, color: '#fbbf24' };
    }
    if (level === 'success' || t.includes('✓') || t.includes('completed') || t.includes('success')) {
        return { category: 'exec', icon: <CheckCircle className="w-3 h-3 shrink-0" />, color: '#34d399' };
    }
    if (t.includes('running') || t.includes('⚡') || t.includes('started') || t.includes('▶')) {
        return { category: 'exec', icon: <Zap className="w-3 h-3 shrink-0" />, color: '#C8A96E' };
    }
    if (level === 'warn' || t.includes('warn')) {
        return { category: 'exec', icon: <AlertTriangle className="w-3 h-3 shrink-0" />, color: '#fbbf24' };
    }

    return { category: 'plan', icon: <Terminal className="w-3 h-3 shrink-0" />, color: 'rgba(240,235,248,0.35)' };
}

export function TerminalPanel({ lines, onClear, width = 320 }: TerminalPanelProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [showScrollBtn, setShowScrollBtn] = useState(false);

    // Auto-scroll to bottom on new lines
    useEffect(() => {
        if (isAutoScroll) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [lines, isAutoScroll]);

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        setIsAutoScroll(isAtBottom);
        setShowScrollBtn(!isAtBottom);
    };

    const scrollToBottom = () => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        setIsAutoScroll(true);
        setShowScrollBtn(false);
    };

    const filteredLines = lines.filter(line => {
        if (activeFilter === 'all') return true;
        const { category } = classifyLine(line.text, line.level);
        return category === activeFilter;
    });

    const errorCount = lines.filter(l => {
        const { category } = classifyLine(l.text, l.level);
        return category === 'errors';
    }).length;

    return (
        <div
            className="h-full flex flex-col flex-shrink-0 relative"
            style={{
                width,
                minWidth: 260,
                background: 'rgba(6,4,14,0.96)',
                borderLeft: '1px solid rgba(200,169,110,0.1)',
            }}
        >
            {/* Gold edge glow */}
            <div className="absolute inset-y-0 left-0 w-px pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, transparent, rgba(200,169,110,0.2) 30%, rgba(74,14,143,0.15) 70%, transparent)' }} />

            {/* ── Header ── */}
            <div
                className="flex items-center justify-between px-4 py-3 shrink-0"
                style={{ borderBottom: '1px solid rgba(200,169,110,0.08)' }}
            >
                <div className="flex items-center gap-2">
                    <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(74,14,143,0.25)', border: '1px solid rgba(200,169,110,0.2)' }}
                    >
                        <Terminal className="w-3.5 h-3.5" style={{ color: '#C8A96E' }} />
                    </div>
                    <div>
                        <span className="font-cinzel text-xs font-bold tracking-wider uppercase"
                            style={{ color: '#C8A96E' }}>
                            Oracle Log
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: lines.length > 0 ? '#34d399' : 'rgba(200,169,110,0.3)' }} />
                            <span className="font-mono-code" style={{ fontSize: '0.6rem', color: 'rgba(200,169,110,0.4)' }}>
                                {lines.length} events
                            </span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onClear}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'rgba(240,235,248,0.25)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,235,248,0.25)')}
                    title="Clear log"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* ── Filter tabs ── */}
            <div
                className="flex items-center gap-1 px-3 py-2 shrink-0"
                style={{ borderBottom: '1px solid rgba(200,169,110,0.06)' }}
            >
                {FILTER_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveFilter(tab.id)}
                        className="relative px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                        style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '0.7rem',
                            background: activeFilter === tab.id ? 'rgba(74,14,143,0.3)' : 'transparent',
                            color: activeFilter === tab.id ? '#E8D5A3' : 'rgba(240,235,248,0.3)',
                            border: activeFilter === tab.id ? '1px solid rgba(200,169,110,0.25)' : '1px solid transparent',
                        }}
                    >
                        {tab.label}
                        {tab.id === 'errors' && errorCount > 0 && (
                            <span
                                className="ml-1 px-1 rounded-full font-mono-code"
                                style={{ fontSize: '0.6rem', background: 'rgba(248,113,113,0.2)', color: '#f87171' }}
                            >
                                {errorCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Log lines ── */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 relative"
                onScroll={handleScroll}
                style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace' }}
            >
                {filteredLines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(74,14,143,0.1)', border: '1px solid rgba(200,169,110,0.1)' }}
                        >
                            <Clock className="w-5 h-5" style={{ color: 'rgba(200,169,110,0.3)' }} />
                        </div>
                        <div className="text-center font-cinzel"
                            style={{ fontSize: '0.6rem', color: 'rgba(200,169,110,0.22)', letterSpacing: '0.1em', lineHeight: 1.8 }}>
                            {activeFilter === 'all' ? 'Awaiting the threads of fate…' : `No ${activeFilter} events yet`}
                        </div>
                    </div>
                ) : (
                    filteredLines.map((line, idx) => {
                        const { icon, color } = classifyLine(line.text, line.level);
                        const isLast = idx >= filteredLines.length - 3;
                        return (
                            <div
                                key={line.id}
                                className={`flex gap-1.5 py-[2px] px-1 rounded-sm leading-5 ${isLast ? 'terminal-line-new' : ''}`}
                                style={{
                                    background: 'transparent',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,14,143,0.08)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                {/* Timestamp */}
                                <span
                                    className="shrink-0 select-none mt-[2px]"
                                    style={{ color: 'rgba(200,169,110,0.22)', fontSize: '0.6rem', minWidth: '58px' }}
                                >
                                    {line.ts}
                                </span>

                                {/* Icon */}
                                <span className="shrink-0 mt-[3px]" style={{ color }}>
                                    {icon}
                                </span>

                                {/* Text */}
                                <span
                                    style={{
                                        color,
                                        wordBreak: 'break-all',
                                        lineHeight: 1.5,
                                        whiteSpace: 'pre-wrap',
                                    }}
                                >
                                    {line.text}
                                </span>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Scroll to bottom button */}
            <AnimatePresence>
                {showScrollBtn && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        onClick={scrollToBottom}
                        className="absolute bottom-4 right-4 flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
                        style={{
                            background: 'rgba(74,14,143,0.8)',
                            border: '1px solid rgba(200,169,110,0.3)',
                            color: '#E8D5A3',
                            fontSize: '0.65rem',
                            fontFamily: 'Inter, sans-serif',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                        }}
                    >
                        <ChevronDown className="w-3 h-3" />
                        Latest
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ── Stats footer ── */}
            <div
                className="px-3 py-2 flex items-center justify-between shrink-0"
                style={{ borderTop: '1px solid rgba(200,169,110,0.06)' }}
            >
                <div className="flex items-center gap-3">
                    <StatDot color="#a78bfa" count={lines.filter(l => classifyLine(l.text, l.level).category === 'plan').length} label="Plan" />
                    <StatDot color="#C8A96E" count={lines.filter(l => classifyLine(l.text, l.level).category === 'exec').length} label="Exec" />
                    {errorCount > 0 && <StatDot color="#f87171" count={errorCount} label="Err" />}
                </div>
                <span className="font-cinzel" style={{ fontSize: '0.5rem', color: 'rgba(200,169,110,0.2)', letterSpacing: '0.1em' }}>ORACLE</span>
            </div>
        </div>
    );
}

function StatDot({ color, count, label }: { color: string; count: number; label: string }) {
    return (
        <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, opacity: 0.7 }} />
            <span style={{ fontSize: '0.6rem', color: 'rgba(240,235,248,0.3)', fontFamily: 'JetBrains Mono, monospace' }}>
                {count} {label}
            </span>
        </div>
    );
}
