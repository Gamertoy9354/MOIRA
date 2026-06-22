import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { InputArea } from './components/InputArea';
import { MeshBackground } from './components/MeshBackground';
import { TerminalPanel } from './components/TerminalPanel';
import { FileSpreadsheet, Settings, Square, Pause, Play, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { MCPSettings } from './components/MCPSettings';
import { useOrchestration } from '../hooks/useOrchestration';
import { toast } from 'sonner';
import { CredentialInputModal, type CredentialField } from './components/CredentialInputModal';
import { ToolSynthesisPanel, type SynthesisPhase, type DetectedGap } from './components/ToolSynthesisPanel';
import { SetupGuideModal, type GuideStep, type CommonError } from './components/SetupGuideModal';
import { HumanApprovalModal } from './components/HumanApprovalModal';
import { CredentialsBanner, type PendingCredential } from './components/CredentialsBanner';
import { PauseEditModal } from './components/PauseEditModal';
import { MoiraLogo } from './components/MoiraLogo';
import { config } from '../config';

// Terminal panel clear state (local to app)
const useLocalTerminalLines = (lines: any[]) => {
    const [clearedCount, setClearedCount] = useState(0);
    const visibleLines = lines.slice(clearedCount);
    const clearLines = () => setClearedCount(lines.length);
    return { visibleLines, clearLines };
};

export default function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isTerminalOpen, setIsTerminalOpen] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [terminalWidth, setTerminalWidth] = useState(320);
    const isResizingRef = useRef(false);
    const lastXRef = useRef(0);

    // ── Synthesis state ──
    const [synthPanelOpen, setSynthPanelOpen] = useState(false);
    const [synthPhase, setSynthPhase] = useState<SynthesisPhase>('gap_detected');
    const [synthGap, setSynthGap] = useState<DetectedGap | undefined>();
    const [synthServiceName, setSynthServiceName] = useState<string | undefined>();
    const [synthStreamCode, setSynthStreamCode] = useState('');
    const [synthTools, setSynthTools] = useState<string[]>([]);
    const [synthBlockReason, setSynthBlockReason] = useState<string | undefined>();

    const [credModalOpen, setCredModalOpen] = useState(false);
    const [credServiceName, setCredServiceName] = useState('');
    const [credServiceId, setCredServiceId] = useState('');
    const [credFields, setCredFields] = useState<CredentialField[]>([]);
    const [credWorkflowId, setCredWorkflowId] = useState<string | null>(null);
    const [pendingCredentials, setPendingCredentials] = useState<PendingCredential[]>([]);

    const [guideOpen, setGuideOpen] = useState(false);
    const [guideService, setGuideService] = useState('');
    const [guideSteps, setGuideSteps] = useState<GuideStep[]>([]);
    const [guideErrors, setGuideErrors] = useState<CommonError[]>([]);
    const [guidePricing, setGuidePricing] = useState<string | undefined>();

    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [approvalData, setApprovalData] = useState<{
        workflowId: string; stepId: string; connector: string; tool: string; reason: string; params: any;
    } | null>(null);

    const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
    const [isWorkflowPaused, setIsWorkflowPaused] = useState(false);
    const [pauseEditOpen, setPauseEditOpen] = useState(false);
    const [currentPrompt, setCurrentPrompt] = useState('');

    const {
        messages, dagNodes, history, isTyping,
        terminalLines, isPlanning, workflowStatus, currentMode,
        sendMessage, startNewRun, exportAudit, setModel,
    } = useOrchestration();

    const { visibleLines, clearLines } = useLocalTerminalLines(terminalLines);

    // ── Resizable terminal panel ──
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        isResizingRef.current = true;
        lastXRef.current = e.clientX;

        const handleMove = (me: MouseEvent) => {
            if (!isResizingRef.current) return;
            const delta = lastXRef.current - me.clientX;
            lastXRef.current = me.clientX;
            setTerminalWidth(w => Math.max(220, Math.min(600, w + delta)));
        };
        const handleUp = () => {
            isResizingRef.current = false;
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    }, []);

    // ── Synthesis event listeners ──
    useEffect(() => {
        const handler = (e: Event) => {
            const ev = (e as CustomEvent).detail;
            if (!ev) return;

            switch (ev.event_type) {
                case 'workflow_started':
                    if (ev.workflow_id) {
                        setActiveWorkflowId(ev.workflow_id);
                        setIsWorkflowPaused(false);
                        (window as any).__currentWorkflowId = ev.workflow_id;
                    }
                    break;
                case 'workflow_completed':
                case 'workflow_killed':
                    setActiveWorkflowId(null);
                    setIsWorkflowPaused(false);
                    if (ev.event_type === 'workflow_killed') {
                        toast.error('⛔ Workflow terminated.');
                    }
                    break;
                case 'workflow_paused':
                    setIsWorkflowPaused(true);
                    break;
                case 'workflow_resumed':
                    setIsWorkflowPaused(false);
                    break;
                case 'tool_gap_detected':
                    break;
                case 'synthesis_approval_requested':
                    setSynthGap({ service: ev.service, reason: ev.reason, suggestedTools: ev.suggested_tools ?? [] });
                    setSynthServiceName(ev.service);
                    setSynthStreamCode('');
                    setSynthTools([]);
                    setSynthBlockReason(undefined);
                    setSynthPhase('gap_detected');
                    setSynthPanelOpen(true);
                    break;
                case 'tool_synthesis_started':
                    setSynthPhase('synthesizing');
                    break;
                case 'tool_synthesis_streaming':
                    setSynthPhase('streaming');
                    setSynthStreamCode(prev => prev + (ev.code_chunk ?? ''));
                    break;
                case 'tool_synthesized':
                    setSynthPhase('success');
                    setSynthTools(ev.tools ?? []);
                    toast.success(`✨ ${ev.service} connector synthesized!`);
                    break;
                case 'tool_synthesis_blocked':
                    setSynthPhase('blocked');
                    setSynthBlockReason(ev.reason);
                    toast.error(`Synthesis blocked: ${ev.reason}`);
                    break;
                case 'credential_required': {
                    const rawFields: CredentialField[] = (ev.credentials_needed ?? []).map((k: string) => ({
                        key: k,
                        label: k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                        isSecret: k.toLowerCase().includes('key') || k.toLowerCase().includes('token') || k.toLowerCase().includes('secret'),
                        required: true,
                        placeholder: `Enter ${k}`,
                    }));
                    const svcName = ev.service ?? 'Service';
                    const displayName = svcName.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                    setCredServiceName(displayName);
                    setCredServiceId(svcName);
                    setCredFields(rawFields);
                    setCredWorkflowId(ev.workflow_id ?? null);
                    setCredModalOpen(true);
                    const pending: PendingCredential = {
                        workflowId: ev.workflow_id ?? '',
                        service: svcName,
                        serviceName: displayName,
                        fields: rawFields.map(f => ({
                            key: f.key, label: f.label, hint: f.hint,
                            isSecret: f.isSecret, required: f.required,
                        })),
                    };
                    setPendingCredentials(prev => [...prev.filter(p => p.service !== svcName), pending]);
                    break;
                }
                case 'credentials_saved': {
                    const savedSvc = ev.service ?? '';
                    setPendingCredentials(prev => prev.filter(p => p.service !== savedSvc));
                    break;
                }
                case 'guide_generated': {
                    const guide = ev.guide ?? {};
                    setGuideService(ev.service ?? '');
                    setGuidePricing(guide.pricing_info);
                    setGuideSteps(guide.steps ?? []);
                    setGuideErrors(guide.common_errors ?? []);
                    break;
                }
                case 'human_approval_requested': {
                    setApprovalData({
                        workflowId: ev.workflow_id,
                        stepId: ev.step_id,
                        connector: ev.connector,
                        tool: ev.tool,
                        reason: ev.reason,
                        params: ev.params,
                    });
                    setApprovalModalOpen(true);
                    break;
                }
                default:
                    break;
            }
        };

        window.addEventListener('mcp:synthesis', handler);
        window.addEventListener('mcp:approval', handler);
        window.addEventListener('mcp:workflow', handler);
        return () => {
            window.removeEventListener('mcp:synthesis', handler);
            window.removeEventListener('mcp:approval', handler);
            window.removeEventListener('mcp:workflow', handler);
        };
    }, []);

    const handleCredentialSubmit = async (values: Record<string, string>) => {
        setCredModalOpen(false);
        const service = credServiceId || credServiceName.toLowerCase().replace(/\s+/g, '_');
        setCredServiceId('');
        setPendingCredentials(prev => prev.filter(p => p.service !== service));
        try {
            await fetch(`${config.apiUrl}/synthesized-tools/${service}/credentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credentials: values, workflow_id: credWorkflowId }),
            });
            toast.success(credWorkflowId ? 'Credentials saved — resuming workflow…' : 'Credentials saved.');
        } catch (err) {
            toast.error('Failed to save credentials.');
        }
    };

    const handleViewGuide = () => { setSynthPanelOpen(false); setGuideOpen(true); };

    const handleViewGuideForService = async (service: string) => {
        try {
            const r = await fetch(`${config.apiUrl}/synthesized-tools/${service}/guide`);
            if (!r.ok) throw new Error(`Server error ${r.status}`);
            const data = await r.json();
            const guide = data.guide ?? {};
            setGuideService(service);
            setGuidePricing(guide.pricing_info);
            setGuideSteps(guide.steps ?? []);
            setGuideErrors(guide.common_errors ?? []);
            const envSnippet = guide.env_file_snippet ?? '';
            const keys = envSnippet.split('\n').map((l: string) => l.trim())
                .filter((l: string) => l && !l.startsWith('#') && l.includes('='))
                .map((l: string) => l.split('=')[0].trim());
            const rawFields: CredentialField[] = keys.map((k: string) => ({
                key: k,
                label: k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                isSecret: k.toLowerCase().includes('key') || k.toLowerCase().includes('token') || k.toLowerCase().includes('secret'),
                required: true,
                placeholder: `Enter ${k}`,
            }));
            const displayName = service.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            setCredServiceName(displayName);
            setCredServiceId(service);
            setCredFields(rawFields);
            setCredWorkflowId(null);
            setGuideOpen(true);
        } catch (err: any) {
            toast.error(`Failed to load setup guide: ${err.message}`);
        }
    };

    const handleApprovalSubmit = async (approved: boolean, workflowId: string, stepId: string) => {
        try {
            await fetch(`${config.apiUrl}/workflows/${workflowId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step_id: stepId, approved, approver: 'User' }),
            });
            if (approved) toast.success('Approval granted'); else toast.error('Approval denied');
        } catch { toast.error('Failed to submit approval.'); }
    };

    const handleKillWorkflow = async () => {
        if (!activeWorkflowId) return;
        try {
            await fetch(`${config.apiUrl}/workflows/${activeWorkflowId}`, { method: 'DELETE' });
            setActiveWorkflowId(null);
            setIsWorkflowPaused(false);
            toast.error('⛔ Workflow terminated.');
        } catch { toast.error('Failed to terminate workflow.'); }
    };

    const handlePauseWorkflow = async () => {
        if (!activeWorkflowId) return;
        try {
            await fetch(`${config.apiUrl}/workflows/${activeWorkflowId}/pause`, { method: 'POST' });
            setIsWorkflowPaused(true);
            setPauseEditOpen(true);
            setCurrentPrompt((window as any).__currentPrompt ?? '');
        } catch { toast.error('Failed to pause workflow.'); }
    };

    const handleResumeWorkflow = async () => {
        if (!activeWorkflowId) return;
        try {
            await fetch(`${config.apiUrl}/workflows/${activeWorkflowId}/resume`, { method: 'POST' });
            setIsWorkflowPaused(false);
            setPauseEditOpen(false);
            toast.success('Workflow resumed.');
        } catch { toast.error('Failed to resume workflow.'); }
    };

    const handleResubmitWorkflow = async (newPrompt: string) => {
        setPauseEditOpen(false);
        if (activeWorkflowId) {
            try { await fetch(`${config.apiUrl}/workflows/${activeWorkflowId}`, { method: 'DELETE' }); } catch {}
        }
        setActiveWorkflowId(null);
        setIsWorkflowPaused(false);
        sendMessage(newPrompt);
        toast.success('Re-running with updated prompt…');
    };

    useEffect(() => {
        const check = () => { if (window.innerWidth < 1024) setIsSidebarOpen(false); };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    return (
        <div
            className="flex h-screen w-full overflow-hidden"
            style={{ background: '#080610', fontFamily: 'Inter, sans-serif', color: '#F0EBF8' }}
        >
            <MeshBackground />

            {/* ════════════════════════════════════════════════════
                LEFT PANEL — Sidebar
            ════════════════════════════════════════════════════ */}
            <div className="relative z-20 h-full">
                <Sidebar
                    isOpen={isSidebarOpen}
                    onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                    history={history}
                    onNewRun={startNewRun}
                    onExport={exportAudit}
                />
            </div>

            {/* ════════════════════════════════════════════════════
                CENTER PANEL — Main content
            ════════════════════════════════════════════════════ */}
            <main className="flex-1 flex flex-col relative z-10 min-w-0 h-full">

                {/* ── Top Header Bar ── */}
                <header
                    className="h-14 flex items-center justify-between px-4 sm:px-5 shrink-0 relative z-20"
                    style={{
                        background: 'rgba(8,6,16,0.7)',
                        backdropFilter: 'blur(12px)',
                        borderBottom: '1px solid rgba(200,169,110,0.07)',
                    }}
                >
                    {/* Left: MOIRA title (shown when sidebar is collapsed) */}
                    <div className="flex items-center gap-3">
                        {!isSidebarOpen && (
                            <MoiraLogo size={28} showText={true} animate={true} />
                        )}
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2">
                        {/* Kill button */}
                        <AnimatePresence>
                            {activeWorkflowId && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.85, x: 8 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.85 }}
                                    onClick={handleKillWorkflow}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium cursor-pointer"
                                    style={{
                                        background: 'rgba(239,68,68,0.1)',
                                        border: '1px solid rgba(239,68,68,0.28)',
                                        color: '#f87171',
                                        fontFamily: 'Inter, sans-serif',
                                        fontSize: '0.8rem',
                                    }}
                                    whileHover={{ background: 'rgba(239,68,68,0.2)', boxShadow: '0 0 14px rgba(239,68,68,0.3)' }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Square className="w-3.5 h-3.5" fill="currentColor" />
                                    Kill
                                </motion.button>
                            )}
                        </AnimatePresence>

                        {/* Pause/Resume */}
                        <AnimatePresence>
                            {activeWorkflowId && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.85, x: 8 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.85 }}
                                    onClick={isWorkflowPaused ? handleResumeWorkflow : handlePauseWorkflow}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium cursor-pointer"
                                    style={{
                                        background: isWorkflowPaused ? 'rgba(52,211,153,0.1)' : 'rgba(200,169,110,0.08)',
                                        border: `1px solid ${isWorkflowPaused ? 'rgba(52,211,153,0.3)' : 'rgba(200,169,110,0.2)'}`,
                                        color: isWorkflowPaused ? '#34d399' : '#C8A96E',
                                        fontFamily: 'Inter, sans-serif',
                                        fontSize: '0.8rem',
                                    }}
                                    whileHover={{ boxShadow: isWorkflowPaused ? '0 0 14px rgba(52,211,153,0.3)' : '0 0 14px rgba(200,169,110,0.3)' }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {isWorkflowPaused
                                        ? <><Play className="w-3.5 h-3.5" />Resume</>
                                        : <><Pause className="w-3.5 h-3.5" />Pause</>}
                                </motion.button>
                            )}
                        </AnimatePresence>

                        {/* Sheets Audit */}
                        <motion.button
                            onClick={() => { exportAudit('sheets'); toast.success('Opening Oracle Sheet…'); }}
                            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium cursor-pointer"
                            style={{
                                background: 'rgba(74,14,143,0.08)',
                                border: '1px solid rgba(200,169,110,0.15)',
                                color: 'rgba(200,169,110,0.65)',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '0.8rem',
                            }}
                            whileHover={{ background: 'rgba(74,14,143,0.18)', borderColor: 'rgba(200,169,110,0.4)', color: '#C8A96E', y: -1 }}
                            whileTap={{ scale: 0.96 }}
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Audit Sheet
                        </motion.button>

                        {/* Settings */}
                        <motion.button
                            onClick={() => setSettingsOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium cursor-pointer"
                            style={{
                                background: 'rgba(74,14,143,0.08)',
                                border: '1px solid rgba(200,169,110,0.15)',
                                color: 'rgba(240,235,248,0.55)',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '0.8rem',
                            }}
                            whileHover={{ background: 'rgba(74,14,143,0.2)', borderColor: 'rgba(200,169,110,0.4)', color: '#E8D5A3', y: -1 }}
                            whileTap={{ scale: 0.96 }}
                        >
                            <Settings className="w-4 h-4" />
                            Settings
                        </motion.button>

                        {/* Terminal toggle */}
                        <motion.button
                            onClick={() => setIsTerminalOpen(v => !v)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium cursor-pointer"
                            style={{
                                background: isTerminalOpen ? 'rgba(74,14,143,0.2)' : 'rgba(74,14,143,0.06)',
                                border: `1px solid ${isTerminalOpen ? 'rgba(200,169,110,0.3)' : 'rgba(200,169,110,0.12)'}`,
                                color: isTerminalOpen ? '#C8A96E' : 'rgba(240,235,248,0.4)',
                            }}
                            whileHover={{ color: '#C8A96E', borderColor: 'rgba(200,169,110,0.35)', y: -1 }}
                            whileTap={{ scale: 0.96 }}
                            title={isTerminalOpen ? 'Hide Oracle Log' : 'Show Oracle Log'}
                        >
                            {isTerminalOpen
                                ? <PanelRightClose className="w-4 h-4" />
                                : <PanelRightOpen className="w-4 h-4" />}
                        </motion.button>
                    </div>
                </header>

                {/* ── Main scrollable content area ── */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                    {/* ChatArea (scrollable) */}
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0 pt-2">
                        <ChatArea
                            messages={messages}
                            dagNodes={dagNodes}
                            isTyping={isTyping}
                            isPlanning={isPlanning}
                            workflowStatus={workflowStatus}
                            currentMode={currentMode}
                            onSend={sendMessage}
                            onExportPDF={() => exportAudit('pdf')}
                        />
                    </div>

                    {/* Input overlay (pinned to bottom) */}
                    <div
                        className="w-full pt-8 pb-5 px-4 shrink-0"
                        style={{
                            background: 'linear-gradient(to top, #080610 40%, rgba(8,6,16,0.8) 75%, transparent 100%)',
                        }}
                    >
                        <InputArea onSend={sendMessage} disabled={isTyping} mode={currentMode} />
                    </div>
                </div>
            </main>

            {/* ════════════════════════════════════════════════════
                RIGHT PANEL — Live Oracle Terminal (always visible)
            ════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {isTerminalOpen && (
                    <>
                        {/* Resize handle */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="resize-handle z-20"
                            onMouseDown={handleResizeStart}
                            style={{ cursor: 'col-resize' }}
                        />
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: terminalWidth, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
                            className="z-20 h-full overflow-hidden shrink-0"
                        >
                            <TerminalPanel
                                lines={visibleLines}
                                onClear={clearLines}
                                width={terminalWidth}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ════════════════════════════════════════════════════
                MODALS & OVERLAYS
            ════════════════════════════════════════════════════ */}
            <MCPSettings
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                onViewGuide={handleViewGuideForService}
                onConfigureConnector={(service, displayName, fields) => {
                    setCredServiceName(displayName);
                    setCredServiceId(service);
                    setCredFields(fields);
                    setCredWorkflowId(null);
                    setCredModalOpen(true);
                }}
            />

            <ToolSynthesisPanel
                open={synthPanelOpen}
                phase={synthPhase}
                gap={synthGap}
                serviceName={synthServiceName}
                streamingCode={synthStreamCode}
                synthesizedTools={synthTools}
                blockReason={synthBlockReason}
                onViewGuide={guideSteps.length > 0 ? handleViewGuide : undefined}
                onDismiss={() => setSynthPanelOpen(false)}
                onApprove={async () => {
                    const workflowId = (window as any).__currentWorkflowId;
                    const service = synthServiceName?.toLowerCase().replace(/\s+/g, '_');
                    if (workflowId && service) {
                        try {
                            await fetch(`${config.apiUrl}/workflows/${workflowId}/approve`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ step_id: `synthesis_${service}`, approved: true, approver: 'User' }),
                            });
                            toast.success('Synthesis approved!');
                        } catch { toast.error('Failed to submit approval.'); }
                    }
                }}
                onReject={async () => {
                    const workflowId = (window as any).__currentWorkflowId;
                    const service = synthServiceName?.toLowerCase().replace(/\s+/g, '_');
                    if (workflowId && service) {
                        try {
                            await fetch(`${config.apiUrl}/workflows/${workflowId}/approve`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ step_id: `synthesis_${service}`, approved: false, approver: 'User' }),
                            });
                            toast.error('Synthesis rejected.');
                            setSynthPanelOpen(false);
                        } catch { toast.error('Failed to submit rejection.'); }
                    }
                }}
            />

            <CredentialInputModal
                open={credModalOpen}
                serviceName={credServiceName}
                fields={credFields}
                onSubmit={handleCredentialSubmit}
                onViewGuide={guideSteps.length > 0 ? handleViewGuide : undefined}
                onClose={() => setCredModalOpen(false)}
            />

            <SetupGuideModal
                open={guideOpen}
                serviceName={guideService}
                steps={guideSteps}
                commonErrors={guideErrors}
                pricingInfo={guidePricing}
                onClose={() => setGuideOpen(false)}
                onEnterCredentials={credFields.length > 0 ? () => { setGuideOpen(false); setCredModalOpen(true); } : undefined}
            />

            {approvalData && (
                <HumanApprovalModal
                    open={approvalModalOpen}
                    workflowId={approvalData.workflowId}
                    stepId={approvalData.stepId}
                    connector={approvalData.connector}
                    tool={approvalData.tool}
                    reason={approvalData.reason}
                    params={approvalData.params}
                    onClose={() => setApprovalModalOpen(false)}
                    onSubmit={handleApprovalSubmit}
                />
            )}

            <CredentialsBanner
                pendingCredentials={pendingCredentials}
                onEnterCredentials={(cred) => {
                    setCredServiceName(cred.serviceName);
                    setCredFields(cred.fields);
                    setCredWorkflowId(cred.workflowId);
                    setCredModalOpen(true);
                }}
                onDismiss={(service) => {
                    setPendingCredentials(prev => prev.filter(p => p.service !== service));
                }}
            />

            <PauseEditModal
                open={pauseEditOpen}
                originalPrompt={currentPrompt}
                workflowId={activeWorkflowId ?? ''}
                onClose={() => setPauseEditOpen(false)}
                onResume={handleResumeWorkflow}
                onResubmit={handleResubmitWorkflow}
            />
        </div>
    );
}
