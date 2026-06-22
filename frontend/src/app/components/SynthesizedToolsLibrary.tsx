import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Library, Trash2, TestTube2, BookOpen, RefreshCw,
    CheckCircle2, XCircle, Clock, Zap, Search,
    ChevronDown, ChevronRight, Filter, MoreHorizontal,
    Loader2, AlertTriangle, Code2, Settings, Key,
} from 'lucide-react';
import { config } from '../../config';

// ──────────────────── Types ─────────────────────────────────────────────────

export interface SynthesizedTool {
    id: string;
    service: string;            // e.g. "sendgrid"
    display_name: string;       // e.g. "SendGrid"
    description?: string;
    tools: string[];            // list of tool names
    status: 'active' | 'invalid' | 'testing';
    usage_count: number;
    last_used?: string;         // ISO date string
    created_at: string;
    has_guide: boolean;
}

interface SynthesizedToolsLibraryProps {
    onViewGuide?: (service: string) => void;
    onDelete?: (service: string) => void;
    onConfigureConnector?: (service: string, displayName: string, fields: any[]) => void;
}

// ──────────────────── Helpers ────────────────────────────────────────────────

function statusPill(status: SynthesizedTool['status']) {
    const map: Record<SynthesizedTool['status'], { label: string; color: string; bg: string }> = {
        active:   { label: 'Active',   color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
        invalid:  { label: 'Invalid',  color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
        testing:  { label: 'Testing',  color: '#FCD34D', bg: 'rgba(252,211,77,0.12)' },
    };
    const m = map[status];
    return (
        <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px',
            background: m.bg, border: `1px solid ${m.color}44`,
            borderRadius: 20, color: m.color,
            textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
            {m.label}
        </span>
    );
}

function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

// ──────────────────── Tool Row ───────────────────────────────────────────────

function ToolRow({
    tool,
    onTest,
    onDelete,
    onViewGuide,
    onConfigure,
    testingId,
}: {
    tool: SynthesizedTool;
    onTest: (service: string) => void;
    onDelete: (service: string) => void;
    onViewGuide?: (service: string) => void;
    onConfigure: (service: string, displayName: string) => void;
    testingId: string | null;
}) {
    const [expanded, setExpanded] = useState(false);
    const isTesting = testingId === tool.service;

    return (
        <motion.div
            layout
            style={{
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.02)',
                marginBottom: 10,
                overflow: 'hidden',
                transition: 'border-color 0.2s',
            }}
            whileHover={{ borderColor: 'rgba(192,132,252,0.25)' }}
        >
            {/* Row header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px',
            }}>
                {/* Service icon */}
                <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(192,132,252,0.15))',
                    border: '1px solid rgba(192,132,252,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Zap className="w-4 h-4" style={{ color: '#C084FC' }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{tool.display_name}</span>
                        {statusPill(tool.status)}
                        <span style={{
                            fontSize: 10.5, color: 'rgba(255,255,255,0.3)',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 5, padding: '1px 7px',
                        }}>
                            {tool.tools.length} tool{tool.tools.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    {tool.description && (
                        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.38)', margin: '3px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {tool.description}
                        </p>
                    )}
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#C084FC' }}>{tool.usage_count}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>uses</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                            {tool.last_used ? relativeTime(tool.last_used) : '—'}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>last used</div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {tool.has_guide && onViewGuide && (
                        <motion.button
                            onClick={() => onViewGuide(tool.service)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '6px 10px', fontSize: 11.5, fontWeight: 600,
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 7, color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
                            }}
                            whileHover={{ background: 'rgba(192,132,252,0.12)', color: '#C084FC', borderColor: 'rgba(192,132,252,0.3)' }}
                            whileTap={{ scale: 0.95 }}
                            title="View Setup Guide"
                        >
                            <BookOpen className="w-3.5 h-3.5" />
                        </motion.button>
                    )}

                    <motion.button
                        onClick={() => onConfigure(tool.service, tool.display_name)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '6px 10px', fontSize: 11.5, fontWeight: 600,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 7, color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
                        }}
                        whileHover={{ background: 'rgba(192,132,252,0.12)', color: '#C084FC', borderColor: 'rgba(192,132,252,0.3)' }}
                        whileTap={{ scale: 0.95 }}
                        title="Configure Credentials"
                    >
                        <Settings className="w-3.5 h-3.5" />
                    </motion.button>

                    <motion.button
                        onClick={() => onTest(tool.service)}
                        disabled={isTesting}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '6px 10px', fontSize: 11.5, fontWeight: 600,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 7, color: 'rgba(255,255,255,0.55)', cursor: isTesting ? 'wait' : 'pointer',
                            opacity: isTesting ? 0.7 : 1,
                        }}
                        whileHover={!isTesting ? { background: 'rgba(52,211,153,0.1)', color: '#34D399', borderColor: 'rgba(52,211,153,0.3)' } : {}}
                        whileTap={!isTesting ? { scale: 0.95 } : {}}
                        title="Test Connector"
                    >
                        {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />}
                    </motion.button>

                    <motion.button
                        onClick={() => onDelete(tool.service)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '6px 10px', fontSize: 11.5, fontWeight: 600,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 7, color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
                        }}
                        whileHover={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', borderColor: 'rgba(239,68,68,0.3)' }}
                        whileTap={{ scale: 0.95 }}
                        title="Delete Connector"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </motion.button>

                    <motion.button
                        onClick={() => setExpanded(v => !v)}
                        style={{
                            display: 'flex', alignItems: 'center',
                            padding: '6px 8px', fontSize: 11.5,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 7, color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                        }}
                        whileHover={{ background: 'rgba(255,255,255,0.08)' }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDown className="w-3.5 h-3.5" />
                        </motion.div>
                    </motion.button>
                </div>
            </div>

            {/* Expanded: tools list + meta */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{
                            padding: '0 16px 14px',
                            borderTop: '1px solid rgba(255,255,255,0.05)',
                            paddingTop: 12,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <Code2 className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.35)' }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Available Tools
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                {tool.tools.map(t => (
                                    <span key={t} style={{
                                        fontSize: 11.5, fontFamily: 'monospace',
                                        background: 'rgba(192,132,252,0.08)',
                                        border: '1px solid rgba(192,132,252,0.2)',
                                        borderRadius: 6, padding: '3px 9px', color: '#C084FC',
                                    }}>
                                        {tool.service}.{t}
                                    </span>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 20 }}>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                                    <Clock className="w-3 h-3" style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                                    Created {relativeTime(tool.created_at)}
                                </span>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
                                    ID: {tool.id.slice(0, 8)}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ──────────────────── Main Component ────────────────────────────────────────

export function SynthesizedToolsLibrary({ onViewGuide, onDelete, onConfigureConnector }: SynthesizedToolsLibraryProps) {
    const [tools, setTools] = useState<SynthesizedTool[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | SynthesizedTool['status']>('all');
    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, 'ok' | 'fail'>>({});
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const handleConfigure = async (service: string, displayName: string) => {
        try {
            const r = await fetch(`${config.apiUrl}/synthesized-tools/${service}/guide`);
            if (!r.ok) throw new Error(`Failed to load guide: ${r.status}`);
            const data = await r.json();
            const guide = data.guide ?? {};
            const envSnippet = guide.env_file_snippet ?? '';
            
            // Parse environment variables from the snippet (e.g. "KEY=value")
            const keys = envSnippet
                .split('\n')
                .map((line: string) => line.trim())
                .filter((line: string) => line && !line.startsWith('#') && line.includes('='))
                .map((line: string) => line.split('=')[0].trim());

            if (keys.length === 0) {
                alert('No credentials configured for this tool.');
                return;
            }

            const fields = keys.map((k: string) => ({
                key: k,
                label: k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                isSecret: k.toLowerCase().includes('key') || k.toLowerCase().includes('token') || k.toLowerCase().includes('secret'),
                required: true,
                placeholder: `Enter ${k}`,
            }));

            onConfigureConnector?.(service, displayName, fields);
        } catch (e: any) {
            console.error('[SynthesizedToolsLibrary] Configure failed:', e);
            alert(`Failed to load connector configuration: ${e.message}`);
        }
    };

    const fetchTools = async () => {
        setLoading(true);
        setError(null);
        try {
            const r = await fetch(`${config.apiUrl}/synthesized-tools`);
            if (!r.ok) throw new Error(`Server error ${r.status}`);
            const data = await r.json();
            // Backend returns { synthesized_tools: [...], total: N }
            // Map backend shape → component SynthesizedTool shape
            const raw: any[] = data.synthesized_tools ?? data.tools ?? [];
            const mapped: SynthesizedTool[] = raw.map((item: any) => ({
                id: item.id ?? item.service_name ?? item.service ?? Math.random().toString(36).slice(2),
                service: item.service_name ?? item.service ?? '',
                display_name: item.display_name ?? item.service_name ?? item.service ?? 'Unknown',
                description: item.description ?? undefined,
                tools: item.tool_names ?? item.tools ?? [],
                status: item.validation_passed === false ? 'invalid' : 'active',
                usage_count: item.times_used ?? item.usage_count ?? 0,
                last_used: item.last_used ?? undefined,
                created_at: item.created_at ?? new Date().toISOString(),
                has_guide: item.guide_available ?? item.has_guide ?? false,
            }));
            setTools(mapped);
        } catch (e: any) {
            setError(`Failed to load tools: ${e.message}`);
            setTools([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTools(); }, []);

    const handleTest = async (service: string) => {
        setTestingId(service);
        try {
            const r = await fetch(`${config.apiUrl}/synthesized-tools/${service}/test`, { method: 'POST' });
            setTestResults(prev => ({ ...prev, [service]: r.ok ? 'ok' : 'fail' }));
        } catch {
            setTestResults(prev => ({ ...prev, [service]: 'fail' }));
        } finally {
            setTestingId(null);
            setTimeout(() => setTestResults(prev => { const n = { ...prev }; delete n[service]; return n; }), 3000);
        }
    };

    const handleDelete = async (service: string) => {
        if (confirmDelete !== service) {
            setConfirmDelete(service);
            setTimeout(() => setConfirmDelete(null), 3000);
            return;
        }
        try {
            await fetch(`${config.apiUrl}/synthesized-tools/${service}`, { method: 'DELETE' });
            setTools(prev => prev.filter(t => t.service !== service));
            onDelete?.(service);
        } catch {
            // If offline, still remove from UI
            setTools(prev => prev.filter(t => t.service !== service));
        }
        setConfirmDelete(null);
    };

    const filtered = tools.filter(t => {
        const matchSearch = !searchQuery ||
            t.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.tools.some(tool => tool.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchStatus = statusFilter === 'all' || t.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const stats = {
        total: tools.length,
        active: tools.filter(t => t.status === 'active').length,
        totalUses: tools.reduce((s, t) => s + t.usage_count, 0),
    };

    return (
        <div style={{ padding: '0 0 8px' }}>
            {/* Stats bar */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10, marginBottom: 18,
            }}>
                {[
                    { label: 'Synthesized Tools', value: stats.total, color: '#C084FC', icon: <Library className="w-4 h-4" /> },
                    { label: 'Active', value: stats.active, color: '#34D399', icon: <CheckCircle2 className="w-4 h-4" /> },
                    { label: 'Total Uses', value: stats.totalUses, color: '#60A5FA', icon: <Zap className="w-4 h-4" /> },
                ].map(stat => (
                    <div key={stat.label} style={{
                        padding: '12px 14px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 10,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ color: stat.color }}>{stat.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {stat.label}
                            </span>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Search + filter bar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search className="w-3.5 h-3.5" style={{
                        position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                        color: 'rgba(255,255,255,0.3)',
                    }} />
                    <input
                        type="text"
                        placeholder="Search tools..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.09)',
                            borderRadius: 8, color: 'rgba(255,255,255,0.8)',
                            padding: '8px 12px 8px 32px', fontSize: 13,
                            outline: 'none', boxSizing: 'border-box',
                        }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(192,132,252,0.4)')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')}
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        borderRadius: 8, color: 'rgba(255,255,255,0.7)',
                        padding: '8px 12px', fontSize: 12.5, outline: 'none', cursor: 'pointer',
                    }}
                >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="invalid">Invalid</option>
                    <option value="testing">Testing</option>
                </select>

                <motion.button
                    onClick={fetchTools}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 36, height: 36,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                        flexShrink: 0,
                    }}
                    whileHover={{ background: 'rgba(192,132,252,0.1)', color: '#C084FC' }}
                    whileTap={{ scale: 0.93 }}
                    title="Refresh"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </motion.button>
            </div>

            {/* Content */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 12 }}>
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#C084FC' }} />
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Loading synthesized tools…</p>
                </div>
            ) : error ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 16,
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <AlertTriangle className="w-7 h-7" style={{ color: '#F87171', opacity: 0.7 }} />
                    </div>
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Could not load tools</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', maxWidth: 280 }}>{error}</p>
                    <button onClick={fetchTools} style={{
                        marginTop: 6, padding: '7px 18px', fontSize: 12, fontWeight: 600,
                        background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.3)',
                        borderRadius: 8, color: '#C084FC', cursor: 'pointer',
                    }}>Retry</button>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 16,
                        background: 'rgba(192,132,252,0.08)',
                        border: '1px solid rgba(192,132,252,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Library className="w-7 h-7" style={{ color: '#C084FC', opacity: 0.5 }} />
                    </div>
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                        {searchQuery ? 'No tools match your search' : 'No synthesized tools yet'}
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', maxWidth: 280 }}>
                        {searchQuery
                            ? 'Try a different search term or clear the filter'
                            : 'When the orchestrator encounters a missing connector, it will synthesize one and show it here'}
                    </p>
                </div>
            ) : (
                <AnimatePresence>
                    {filtered.map(tool => (
                        <motion.div
                            key={tool.service}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                        >
                            {/* Delete confirmation overlay */}
                            {confirmDelete === tool.service && (
                                <div style={{
                                    marginBottom: 8, padding: '10px 14px',
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: 9,
                                    display: 'flex', alignItems: 'center', gap: 10,
                                }}>
                                    <AlertTriangle className="w-4 h-4" style={{ color: '#F87171', flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', flex: 1 }}>
                                        Click delete again to confirm removing <strong style={{ color: '#fff' }}>{tool.display_name}</strong>
                                    </span>
                                    <button onClick={() => setConfirmDelete(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 12 }}>
                                        Cancel
                                    </button>
                                </div>
                            )}

                            {/* Test result toast */}
                            <AnimatePresence>
                                {testResults[tool.service] && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        style={{
                                            marginBottom: 6, padding: '7px 12px',
                                            background: testResults[tool.service] === 'ok' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                                            border: `1px solid ${testResults[tool.service] === 'ok' ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                            borderRadius: 8, display: 'flex', alignItems: 'center', gap: 7,
                                        }}
                                    >
                                        {testResults[tool.service] === 'ok'
                                            ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#34D399' }} />
                                            : <XCircle className="w-3.5 h-3.5" style={{ color: '#F87171' }} />
                                        }
                                        <span style={{ fontSize: 12, color: testResults[tool.service] === 'ok' ? '#34D399' : '#F87171' }}>
                                            {tool.display_name} test {testResults[tool.service] === 'ok' ? 'passed ✓' : 'failed ✗'}
                                        </span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <ToolRow
                                tool={tool}
                                onTest={handleTest}
                                onDelete={handleDelete}
                                onViewGuide={onViewGuide}
                                onConfigure={handleConfigure}
                                testingId={testingId}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
            )}
        </div>
    );
}

// ──────────────────── Mock Data ──────────────────────────────────────────────

const MOCK_TOOLS: SynthesizedTool[] = [
    {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        service: 'sendgrid',
        display_name: 'SendGrid',
        description: 'Transactional email delivery API',
        tools: ['send_email', 'list_templates', 'get_stats'],
        status: 'active',
        usage_count: 14,
        last_used: new Date(Date.now() - 2 * 3600000).toISOString(),
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        has_guide: true,
    },
    {
        id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        service: 'twilio',
        display_name: 'Twilio',
        description: 'SMS, voice, and messaging platform',
        tools: ['send_sms', 'make_call', 'lookup_number'],
        status: 'active',
        usage_count: 7,
        last_used: new Date(Date.now() - 24 * 3600000).toISOString(),
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        has_guide: true,
    },
];
