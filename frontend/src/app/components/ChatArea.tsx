import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Download, Activity, Loader2, MessageCircle } from 'lucide-react';
import { DAGViewer } from './DAGviewer';
import { clsx } from 'clsx';
import { Message, DAGNode, MessageMode } from '../../services/types';
import { toast } from "sonner";
import { config } from '../../config';
import { authFetch } from '../../lib/supabase';
import { MoiraLogo } from './MoiraLogo';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "./ui/dialouge";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";

interface ChatAreaProps {
    messages: Message[];
    dagNodes: DAGNode[];
    isTyping: boolean;
    isPlanning: boolean;
    workflowStatus: string;
    currentMode: MessageMode;
    onSend: (msg: string) => void;
    onExportPDF: () => void;
}

const suggestions = [
    'Audit access permissions',
    'Sync Jira tickets to Slack',
    'Onboard new team member',
    'What is MCP Gateway?',
];

// Very simple markdown renderer (handles bold, italic, code, and newlines)
function MarkdownText({ text }: { text: string }) {
    // Split on triple backticks for code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    return (
        <div className="moira-prose">
            {parts.map((part, i) => {
                if (part.startsWith('```')) {
                    const lines = part.slice(3).split('\n');
                    const lang = lines[0].trim();
                    const code = lines.slice(1, -1).join('\n');
                    return (
                        <pre key={i}>
                            {lang && <div style={{ fontSize: '0.6rem', color: 'rgba(200,169,110,0.45)', marginBottom: 6 }}>{lang}</div>}
                            <code>{code}</code>
                        </pre>
                    );
                }
                // Inline formatting
                return (
                    <span key={i}>
                        {part.split('\n').map((line, li) => (
                            <React.Fragment key={li}>
                                {li > 0 && <br />}
                                {line}
                            </React.Fragment>
                        ))}
                    </span>
                );
            })}
        </div>
    );
}

export function ChatArea({ messages, dagNodes, isTyping, isPlanning, workflowStatus, currentMode, onSend, onExportPDF }: ChatAreaProps) {
    const [auditLogOpen, setAuditLogOpen] = React.useState(false);
    const [auditRows, setAuditRows] = React.useState<any[]>([]);
    const [auditLoading, setAuditLoading] = React.useState(false);
    const [activeAuditNodes, setActiveAuditNodes] = React.useState<DAGNode[]>([]);

    const getCurrentWorkflowId = (): string | null => {
        return (window as any).__currentWorkflowId || null;
    };

    const handleViewAuditLog = async (nodes: DAGNode[]) => {
        setActiveAuditNodes(nodes);
        setAuditLogOpen(true);
        setAuditLoading(true);
        setAuditRows([]);
        const wfId = getCurrentWorkflowId();
        if (wfId) {
            try {
                const r = await authFetch(`${config.apiUrl}/workflows/${wfId}/audit`);
                const data = await r.json();
                if (data.audit_log && data.audit_log.length > 0) {
                    setAuditRows(data.audit_log);
                } else {
                    const r2 = await authFetch(`${config.apiUrl}/workflows/${wfId}`);
                    const wf = await r2.json();
                    const steps = wf?.dag?.steps || {};
                    const rows = Object.values(steps).map((s: any) => ({
                        created_at: s.completed_at || s.started_at,
                        step_id: s.id,
                        connector: s.connector,
                        tool: s.tool,
                        safeguard_result: s.status === 'success' ? 'allowed' : s.status,
                        safeguard_reason: s.error || 'All SafeGuard layers passed',
                        executed: s.status === 'success',
                    }));
                    setAuditRows(rows);
                }
            } catch (e) {
                console.error('[AuditLog] fetch error:', e);
            }
        }
        setAuditLoading(false);
    };

    // Determine if we should show the DAG as hero (execution mode with nodes)
    const showDAGHero = currentMode === 'execution' && dagNodes.length > 0;
    const chatMessages = messages.filter(m => m.mode === 'chat' || !m.hasDAG || m.role === 'user');

    return (
        <div className="flex-1 w-full flex flex-col overflow-hidden">

            {/* ── Empty state ── */}
            {messages.length === 0 && !isTyping && (
                <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                        className="flex flex-col items-center text-center"
                    >
                        {/* Logo animation */}
                        <div className="mb-8">
                            <MoiraLogo size={72} animate={true} />
                        </div>

                        <h1
                            className="font-cinzel font-bold mb-3"
                            style={{
                                fontSize: '2rem',
                                letterSpacing: '0.2em',
                                background: 'linear-gradient(135deg, #E8D5A3 0%, #C8A96E 50%, #8A7048 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                textTransform: 'uppercase',
                            }}
                        >
                            MOIRA
                        </h1>
                        <p
                            className="font-cinzel mb-2"
                            style={{ fontSize: '0.75rem', color: 'rgba(200,169,110,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' }}
                        >
                            The Greek Goddess of Fate
                        </p>
                        <p
                            className="mb-8 max-w-sm"
                            style={{ fontSize: '0.875rem', color: 'rgba(240,235,248,0.35)', lineHeight: 1.7 }}
                        >
                            Execute complex workflows across Jira, Slack, GitHub, and more.
                            Every action logged. Every fate sealed.
                        </p>

                        {/* Suggestion chips */}
                        <div className="flex flex-wrap gap-2 justify-center">
                            {suggestions.map((s, i) => (
                                <motion.button
                                    key={s}
                                    onClick={() => onSend(s)}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="px-3.5 py-1.5 rounded-full text-sm relative overflow-hidden"
                                    style={{
                                        background: 'rgba(74,14,143,0.08)',
                                        border: '1px solid rgba(200,169,110,0.14)',
                                        color: 'rgba(240,235,248,0.55)',
                                        fontFamily: 'Inter, sans-serif',
                                        fontSize: '0.8rem',
                                    }}
                                    whileHover={{
                                        background: 'rgba(74,14,143,0.18)',
                                        borderColor: 'rgba(200,169,110,0.4)',
                                        color: 'rgba(232,213,163,0.9)',
                                        y: -2,
                                        boxShadow: '0 0 16px rgba(200,169,110,0.2), 0 4px 20px rgba(74,14,143,0.12)',
                                    }}
                                    whileTap={{ scale: 0.96 }}
                                    transition={{ duration: 0.25, delay: 0.1 + i * 0.06 }}
                                >
                                    {s}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}

            {/* ── EXECUTION MODE: DAG Visualizer as hero ── */}
            {showDAGHero && (
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 flex flex-col">
                    {/* Execution header */}
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-3 flex items-center gap-3"
                    >
                        <div
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-cinzel"
                            style={{
                                background: 'rgba(74,14,143,0.15)',
                                border: '1px solid rgba(200,169,110,0.2)',
                                fontSize: '0.65rem',
                                color: '#C8A96E',
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                            }}
                        >
                            <div
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                    background: workflowStatus === 'completed' ? '#C8A96E' :
                                                workflowStatus === 'failed' ? '#ef4444' : '#a78bfa',
                                    animation: workflowStatus === 'completed' || workflowStatus === 'failed' ? 'none' : 'ancientPulse 2s ease-in-out infinite',
                                }}
                            />
                            {isPlanning ? 'Planning Fate…' :
                             workflowStatus === 'completed' ? 'Fate Fulfilled' :
                             workflowStatus === 'failed' ? 'Fate Broken' : 'Weaving…'}
                        </div>
                        {/* Show user request */}
                        {messages.filter(m => m.role === 'user').slice(-1).map(m => (
                            <span key={m.id} style={{ fontSize: '0.75rem', color: 'rgba(240,235,248,0.4)', fontStyle: 'italic' }}>
                                "{m.content.slice(0, 60)}{m.content.length > 60 ? '…' : ''}"
                            </span>
                        ))}
                    </motion.div>

                    {/* DAG as hero */}
                    <DAGViewer nodes={dagNodes} isPlanning={isPlanning} workflowStatus={workflowStatus} />

                    {/* Action buttons below DAG */}
                    <div className="mt-3 flex items-center gap-3 pb-4">
                        <motion.button
                            onClick={() => handleViewAuditLog(dagNodes)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                            style={{
                                background: 'rgba(74,14,143,0.1)',
                                border: '1px solid rgba(200,169,110,0.25)',
                                color: '#C8A96E',
                            }}
                            whileHover={{
                                background: 'rgba(74,14,143,0.2)',
                                borderColor: 'rgba(200,169,110,0.5)',
                                color: '#E8D5A3',
                                boxShadow: '0 0 16px rgba(200,169,110,0.25)',
                                y: -1,
                            }}
                            whileTap={{ scale: 0.96 }}
                        >
                            <Activity className="w-3.5 h-3.5" />
                            <span className="font-cinzel uppercase tracking-wider" style={{ fontSize: '0.6rem' }}>View Audit</span>
                        </motion.button>
                        <motion.button
                            onClick={onExportPDF}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                            style={{
                                background: 'rgba(8,6,16,0.5)',
                                border: '1px solid rgba(200,169,110,0.15)',
                                color: 'rgba(200,169,110,0.6)',
                            }}
                            whileHover={{
                                background: 'rgba(74,14,143,0.12)',
                                borderColor: 'rgba(200,169,110,0.35)',
                                color: '#C8A96E',
                                y: -1,
                            }}
                            whileTap={{ scale: 0.96 }}
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span className="font-cinzel uppercase tracking-wider" style={{ fontSize: '0.6rem' }}>Export PDF</span>
                        </motion.button>

                        {/* Workflow summary message */}
                        {messages.filter(m => m.role === 'assistant' && !m.hasDAG && m.mode !== 'chat').slice(-1).map(m => (
                            <div
                                key={m.id}
                                className="text-sm"
                                style={{ color: 'rgba(240,235,248,0.5)', flex: 1, textAlign: 'right', fontSize: '0.75rem' }}
                            >
                                {m.content}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── CHAT MODE: Conversational messages ── */}
            {!showDAGHero && messages.length > 0 && (
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 pb-4 flex flex-col gap-5">
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                            className={clsx('flex gap-3 w-full', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                        >
                            {msg.role === 'assistant' && (
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
                                    style={{
                                        background: 'rgba(74,14,143,0.2)',
                                        border: '1px solid rgba(200,169,110,0.2)',
                                        boxShadow: '0 0 12px rgba(200,169,110,0.12)',
                                    }}
                                >
                                    <MoiraLogo size={20} animate={false} />
                                </div>
                            )}

                            <div className={clsx('flex flex-col gap-2', msg.role === 'user' ? 'items-end max-w-[80%]' : 'items-start flex-1 max-w-[85%]')}>
                                {msg.content && (
                                    <div
                                        className={msg.role === 'user' ? 'px-4 py-3 rounded-2xl' : 'px-1 py-1 rounded-2xl'}
                                        style={
                                            msg.role === 'user'
                                                ? {
                                                    background: 'linear-gradient(135deg, rgba(74,14,143,0.2), rgba(74,14,143,0.12))',
                                                    border: '1px solid rgba(200,169,110,0.18)',
                                                    color: '#F0EBF8',
                                                    borderBottomRightRadius: '5px',
                                                    fontSize: '0.9375rem',
                                                    lineHeight: '1.65',
                                                }
                                                : {
                                                    background: 'transparent',
                                                    color: 'rgba(240,235,248,0.85)',
                                                    fontSize: '0.9375rem',
                                                    lineHeight: '1.65',
                                                }
                                        }
                                    >
                                        {msg.role === 'assistant' && msg.mode === 'chat' ? (
                                            <MarkdownText text={msg.content} />
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                )}

                                {/* DAG in chat messages (for messages with hasDAG that are in chat scroll) */}
                                {msg.hasDAG && dagNodes.length > 0 && currentMode !== 'execution' && (
                                    <div id={`dag-container-${msg.id}`} className="w-full mt-2">
                                        <DAGViewer nodes={dagNodes} isPlanning={isPlanning} workflowStatus={workflowStatus} />
                                        <div className="mt-2 flex items-center gap-3">
                                            <motion.button
                                                onClick={() => handleViewAuditLog(dagNodes)}
                                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                                                style={{
                                                    background: 'rgba(74,14,143,0.1)',
                                                    border: '1px solid rgba(200,169,110,0.25)',
                                                    color: '#C8A96E',
                                                }}
                                                whileHover={{ background: 'rgba(74,14,143,0.2)', y: -1 }}
                                                whileTap={{ scale: 0.96 }}
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                <span className="font-cinzel uppercase tracking-wider" style={{ fontSize: '0.6rem' }}>Audit Log</span>
                                            </motion.button>
                                            <motion.button
                                                onClick={onExportPDF}
                                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                                                style={{
                                                    background: 'rgba(8,6,16,0.5)',
                                                    border: '1px solid rgba(200,169,110,0.12)',
                                                    color: 'rgba(200,169,110,0.5)',
                                                }}
                                                whileHover={{ borderColor: 'rgba(200,169,110,0.35)', y: -1 }}
                                                whileTap={{ scale: 0.96 }}
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                <span className="font-cinzel uppercase tracking-wider" style={{ fontSize: '0.6rem' }}>Export PDF</span>
                                            </motion.button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}

                    {/* Typing indicator */}
                    {isTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex gap-3 w-full justify-start"
                        >
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                style={{
                                    background: 'rgba(74,14,143,0.2)',
                                    border: '1px solid rgba(200,169,110,0.2)',
                                }}
                            >
                                <MoiraLogo size={20} animate={true} />
                            </div>
                            <div
                                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl"
                                style={{
                                    background: 'rgba(74,14,143,0.08)',
                                    border: '1px solid rgba(200,169,110,0.1)',
                                }}
                            >
                                {[0, 0.2, 0.4].map((delay, i) => (
                                    <motion.div
                                        key={i}
                                        animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.2, 0.8] }}
                                        transition={{ repeat: Infinity, duration: 1.4, delay }}
                                        className="w-2 h-2 rounded-full"
                                        style={{ background: 'linear-gradient(135deg, #C8A96E, #4A0E8F)' }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>
            )}

            {/* Typing indicator (for empty state) */}
            {isTyping && messages.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <MoiraLogo size={48} animate={true} />
                        <div className="font-cinzel" style={{ fontSize: '0.7rem', color: 'rgba(200,169,110,0.4)', letterSpacing: '0.15em' }}>
                            WEAVING FATE…
                        </div>
                    </motion.div>
                </div>
            )}

            {/* ── Audit Log Dialog ── */}
            <Dialog open={auditLogOpen} onOpenChange={setAuditLogOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0 text-white"
                    style={{ background: '#080610', border: '1px solid rgba(200,169,110,0.2)' }}>
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl flex items-center gap-2 font-cinzel"
                            style={{ color: '#E8D5A3', letterSpacing: '0.1em' }}>
                            <Activity className="w-5 h-5" style={{ color: '#C8A96E' }} />
                            Fate Audit Scroll
                        </DialogTitle>
                        <DialogDescription style={{ color: 'rgba(200,169,110,0.4)', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>
                            Complete trace of all MCP tool executions and SafeGuard verdicts.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden p-6 pt-2">
                        {auditLoading ? (
                            <div className="flex items-center justify-center h-32 gap-2" style={{ color: 'rgba(200,169,110,0.4)' }}>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Reading the scroll…
                            </div>
                        ) : auditRows.length > 0 ? (
                            <ScrollArea className="h-full rounded-md" style={{ border: '1px solid rgba(200,169,110,0.1)', background: 'rgba(8,6,16,0.7)' }}>
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="sticky top-0" style={{ background: 'rgba(13,9,32,0.98)' }}>
                                        <tr style={{ borderBottom: '1px solid rgba(200,169,110,0.12)' }}>
                                            {['Time', 'Step', 'Connector', 'Tool', 'Verdict', 'Result'].map(h => (
                                                <th key={h} className="p-3 font-cinzel uppercase"
                                                    style={{ fontSize: '0.6rem', color: 'rgba(200,169,110,0.5)', letterSpacing: '0.1em' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditRows.map((row: any, i: number) => (
                                            <tr key={i} className="hover:bg-white/3 transition-colors"
                                                style={{ borderBottom: '1px solid rgba(200,169,110,0.05)' }}>
                                                <td className="p-3 font-mono-code text-xs" style={{ color: 'rgba(200,169,110,0.35)' }}>
                                                    {row.created_at ? new Date(row.created_at).toLocaleTimeString() : '—'}
                                                </td>
                                                <td className="p-3 font-mono-code text-xs" style={{ color: '#a78bfa' }}>{row.step_id}</td>
                                                <td className="p-3 text-xs" style={{ color: 'rgba(240,235,248,0.6)' }}>{row.connector}</td>
                                                <td className="p-3 font-mono-code text-xs" style={{ color: '#C8A96E' }}>{row.tool}</td>
                                                <td className="p-3 text-xs" style={{ color: 'rgba(240,235,248,0.4)' }}>{row.safeguard_reason || 'All layers passed'}</td>
                                                <td className="p-3">
                                                    <Badge variant="outline" className={clsx(
                                                        "text-xs capitalize font-cinzel",
                                                        row.safeguard_result === 'allowed' ? "border-emerald-500/50 text-emerald-400" :
                                                        row.safeguard_result === 'block' ? "border-red-500/50 text-red-400" :
                                                        "border-amber-500/50 text-amber-400"
                                                    )}>
                                                        {row.safeguard_result}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </ScrollArea>
                        ) : (
                            <ScrollArea className="h-full rounded-md" style={{ border: '1px solid rgba(200,169,110,0.1)', background: 'rgba(8,6,16,0.7)' }}>
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="sticky top-0" style={{ background: 'rgba(13,9,32,0.98)' }}>
                                        <tr style={{ borderBottom: '1px solid rgba(200,169,110,0.12)' }}>
                                            {['Step', 'Connector.Tool', 'Status', 'Latency'].map(h => (
                                                <th key={h} className="p-3 font-cinzel uppercase"
                                                    style={{ fontSize: '0.6rem', color: 'rgba(200,169,110,0.5)', letterSpacing: '0.1em' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeAuditNodes.map((node) => (
                                            <tr key={node.id} className="hover:bg-white/3 transition-colors"
                                                style={{ borderBottom: '1px solid rgba(200,169,110,0.05)' }}>
                                                <td className="p-3 text-xs" style={{ color: 'rgba(240,235,248,0.7)' }}>{node.label}</td>
                                                <td className="p-3 font-mono-code text-xs" style={{ color: '#C8A96E' }}>{node.connector || '—'}.{node.tool || '—'}</td>
                                                <td className="p-3">
                                                    <Badge variant="outline" className={clsx(
                                                        "capitalize text-xs font-cinzel",
                                                        node.status === 'success' ? "border-emerald-500/50 text-emerald-400" :
                                                        node.status === 'failed' ? "border-red-500/50 text-red-400" :
                                                        "border-purple-500/50 text-purple-400"
                                                    )}>
                                                        {node.status}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 font-mono-code text-xs" style={{ color: 'rgba(200,169,110,0.4)' }}>
                                                    {node.latencyMs ? `${node.latencyMs}ms` : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </ScrollArea>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
