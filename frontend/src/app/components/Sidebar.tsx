import { motion, AnimatePresence } from 'motion/react';
import { SidebarClose, SidebarOpen, DownloadCloud, Plus, MessageSquare, ExternalLink, Scroll, LogOut } from 'lucide-react';
import { isToday } from 'date-fns';
import { AuditEntry } from '../../services/types';
import { toast } from 'sonner';
import { MoiraLogo } from './MoiraLogo';
import { signOut } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    history: AuditEntry[];
    onNewRun: () => void;
    onExport: (format: 'pdf' | 'sheets') => void;
}

export function Sidebar({ isOpen, onToggle, history, onNewRun, onExport }: SidebarProps) {
    const navigate = useNavigate();
    const todayItems = history.filter(item => isToday(item.date));
    const previousItems = history.filter(item => !isToday(item.date));

    const handleLogout = async () => {
        localStorage.removeItem('moira_dev_bypass');
        try {
            await signOut();
        } catch (e) {
            console.error('Failed to sign out', e);
        }
        navigate('/login', { replace: true });
        toast.success('You have stepped out of fate.');
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 264, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
                        className="h-full flex-shrink-0 flex flex-col z-20 overflow-hidden relative"
                        style={{
                            background: 'rgba(8,6,16,0.92)',
                            backdropFilter: 'blur(28px)',
                            WebkitBackdropFilter: 'blur(28px)',
                            borderRight: '1px solid rgba(200,169,110,0.1)',
                        }}
                    >
                        {/* Gold edge glow line */}
                        <div className="absolute inset-y-0 right-0 w-px pointer-events-none"
                            style={{ background: 'linear-gradient(to bottom, transparent, rgba(200,169,110,0.25) 30%, rgba(74,14,143,0.2) 70%, transparent)' }} />

                        {/* ── MOIRA Brand Header ── */}
                        <div
                            className="px-4 pt-5 pb-4 flex flex-col gap-1"
                            style={{ borderBottom: '1px solid rgba(200,169,110,0.08)' }}
                        >
                            <div className="flex items-center justify-between">
                                <MoiraLogo size={36} showText={true} animate={true} />
                                <button onClick={onToggle} className="purple-icon-btn flex-shrink-0">
                                    <SidebarClose className="w-4 h-4" />
                                </button>
                            </div>
                            <p
                                className="font-cinzel mt-1 pl-0.5"
                                style={{ fontSize: '0.6rem', color: 'rgba(200,169,110,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase' }}
                            >
                                Fate decides. You command.
                            </p>
                        </div>

                        {/* ── New Run button ── */}
                        <div className="px-3 py-3">
                            <button className="purple-new-btn w-full" onClick={onNewRun}>
                                <Plus className="w-4 h-4" />
                                <span>New Weave</span>
                            </button>
                        </div>

                        {/* ── Fate divider ── */}
                        <div className="fate-divider mx-3 mb-2" />

                        {/* ── History list ── */}
                        <div className="flex-1 overflow-y-auto px-3 py-1 custom-scrollbar">
                            {history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-3 py-12">
                                    <Scroll className="w-8 h-8" style={{ color: 'rgba(200,169,110,0.18)' }} />
                                    <p className="text-center font-cinzel" style={{ fontSize: '0.65rem', color: 'rgba(200,169,110,0.25)', letterSpacing: '0.1em', lineHeight: 1.6 }}>
                                        The threads of fate<br />await your command
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {todayItems.length > 0 && <HistoryGroup label="Today" items={todayItems} />}
                                    {previousItems.length > 0 && <HistoryGroup label="Previous" items={previousItems} />}
                                </>
                            )}
                        </div>

                        {/* ── Footer ── */}
                        <div className="p-3 flex flex-col gap-0.5"
                            style={{ borderTop: '1px solid rgba(200,169,110,0.08)', background: 'rgba(5,3,12,0.6)' }}>
                            <SidebarFooterBtn
                                icon={<DownloadCloud className="w-4 h-4" />}
                                label="Export Audit PDF"
                                onClick={() => {
                                    toast.loading('Weaving PDF scroll…', { id: 'pdf-export' });
                                    onExport('pdf');
                                    setTimeout(() => toast.dismiss('pdf-export'), 3000);
                                }}
                            />
                            <SidebarFooterBtn
                                icon={<ExternalLink className="w-4 h-4" />}
                                label="Open Audit Sheet"
                                onClick={() => {
                                    onExport('sheets');
                                    toast.success('Opening the Oracle Sheet…');
                                }}
                            />
                            <SidebarFooterBtn
                                icon={<LogOut className="w-4 h-4" />}
                                label="Sign Out of Oracle"
                                onClick={handleLogout}
                            />

                            {/* Fate signature */}
                            <div
                                className="mt-2 px-3 py-2.5 rounded-xl text-center font-cinzel"
                                style={{
                                    background: 'rgba(74,14,143,0.08)',
                                    border: '1px solid rgba(200,169,110,0.1)',
                                    fontSize: '0.55rem',
                                    color: 'rgba(200,169,110,0.28)',
                                    letterSpacing: '0.15em',
                                    textTransform: 'uppercase',
                                }}
                            >
                                MOIRA · MCP Orchestration Engine
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Collapsed toggle */}
            {!isOpen && (
                <div className="absolute top-4 left-4 z-30">
                    <motion.button
                        onClick={onToggle}
                        className="p-2 rounded-xl"
                        style={{
                            background: 'rgba(8,6,16,0.9)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(200,169,110,0.18)',
                            color: 'rgba(240,235,248,0.5)',
                        }}
                        whileHover={{
                            borderColor: 'rgba(200,169,110,0.45)',
                            color: '#E8D5A3',
                            boxShadow: '0 0 16px rgba(200,169,110,0.25), 0 0 30px rgba(74,14,143,0.12)',
                        }}
                        transition={{ duration: 0.2 }}
                    >
                        <SidebarOpen className="w-4 h-4" />
                    </motion.button>
                </div>
            )}
        </>
    );
}

function HistoryGroup({ label, items }: { label: string; items: AuditEntry[] }) {
    return (
        <div className="mb-5">
            <div
                className="font-cinzel px-2 mb-2 uppercase tracking-widest"
                style={{ fontSize: '0.6rem', color: 'rgba(200,169,110,0.35)' }}
            >
                {label}
            </div>
            {items.map(item => <HistoryItem key={item.id} item={item} />)}
        </div>
    );
}

function HistoryItem({ item }: { item: AuditEntry }) {
    return (
        <motion.button
            className="w-full text-left flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl group"
            style={{ color: 'rgba(240,235,248,0.5)' }}
            whileHover={{
                background: 'rgba(74,14,143,0.12)',
                color: 'rgba(240,235,248,0.92)',
                x: 2,
            }}
            transition={{ duration: 0.18 }}
        >
            <MessageSquare
                className="w-3.5 h-3.5 shrink-0 transition-colors"
                style={{ color: item.status === 'failed' ? 'rgba(248,113,113,0.6)' : 'rgba(200,169,110,0.4)' }}
            />
            <div className="flex-1 overflow-hidden">
                <div className="text-sm truncate" style={{ fontSize: '0.8125rem' }}>{item.title}</div>
            </div>
            {item.status === 'failed' && (
                <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: '#f87171' }} />
            )}
            {item.status === 'success' && (
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'rgba(200,169,110,0.5)' }} />
            )}
        </motion.button>
    );
}

function SidebarFooterBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string, onClick?: () => void }) {
    return (
        <motion.button
            onClick={onClick}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full text-left"
            style={{ color: 'rgba(240,235,248,0.42)' }}
            whileHover={{
                background: 'rgba(200,169,110,0.06)',
                color: 'rgba(232,213,163,0.85)',
                x: 2,
            }}
            transition={{ duration: 0.18 }}
        >
            <span style={{ color: 'rgba(200,169,110,0.5)' }}>{icon}</span>
            <span style={{ fontSize: '0.8125rem' }}>{label}</span>
        </motion.button>
    );
}
