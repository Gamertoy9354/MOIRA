import { OrchestrationProvider, OrchestrationEvent, DAGNode, TerminalLine, TerminalLevel } from './types';
import { config } from '../config';

export class WebSocketProvider implements OrchestrationProvider {
    private ws: WebSocket | null = null;
    private listeners: ((event: OrchestrationEvent) => void)[] = [];
    private isManuallyDisconnected = false;
    private currentWorkflowId: string | null = null;
    private selectedModelId: string | null = null;
    private selectedProvider: string | null = null;

    public setModel(modelId: string) {
        this.selectedModelId = modelId;
    }

    public setProvider(provider: string) {
        this.selectedProvider = provider;
    }

    public onEvent(callback: (event: OrchestrationEvent) => void): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private emit(event: OrchestrationEvent) {
        this.listeners.forEach(l => l(event));
    }

    public async connect() {
        console.log('[WebSocketProvider] Ready (waiting for workflow start)');
        this.emit({ type: 'connection:status', connected: true });
    }

    public disconnect() {
        this.isManuallyDisconnected = true;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.emit({ type: 'connection:status', connected: false });
    }

    public async sendMessage(text: string, _imageFile?: File) {
        const id = `u-${Date.now()}`;
        this.emit({
            type: 'message:new',
            message: { id, role: 'user', content: text, timestamp: Date.now(), mode: 'chat' }
        });
        this.emit({ type: 'message:typing', isTyping: true });

        try {
            // ── Intent classification: try /chat first for conversational queries ──
            const chatRes = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, model_id: this.selectedModelId, provider: this.selectedProvider })
            });

            if (chatRes.ok) {
                const chatData = await chatRes.json();
                if (chatData.mode === 'chat') {
                    // Direct chat response — no DAG
                    this.emit({ type: 'message:typing', isTyping: false });
                    this.emit({ type: 'mode:change', mode: 'chat' });
                    this.emit({
                        type: 'message:new',
                        message: {
                            id: `chat-${Date.now()}`,
                            role: 'assistant',
                            content: chatData.response,
                            timestamp: Date.now(),
                            mode: 'chat',
                        }
                    });
                    this.termLog(`💬 Chat response (${chatData.tokens || '?'} tokens)`, 'dim');
                    return;  // Don't proceed to workflow execution
                }
                // If mode === 'execution', fall through to workflow
            }
            // If /chat endpoint not available or returned execution mode, run as workflow

            const body: any = { user_request: text };
            if (this.selectedModelId) body.model_id = this.selectedModelId;
            if (this.selectedProvider) body.provider = this.selectedProvider;
            try {
                const disabled = JSON.parse(localStorage.getItem('mcp_disabled_tools') || '[]');
                if (Array.isArray(disabled) && disabled.length > 0) {
                    body.disabled_tools = disabled;
                }
            } catch (e) {}

            const response = await fetch(`${config.apiUrl}/workflows`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server returned ${response.status}: ${errText}`);
            }
            const data = await response.json();
            this.currentWorkflowId = data.workflow_id;
            (window as any).__currentWorkflowId = data.workflow_id;
            (window as any).__currentPrompt = text;  // store for Pause & Edit
            this.emit({ type: 'mode:change', mode: 'execution' });
            this.termLog(`◆ Workflow created: ${data.workflow_id}`, 'dim');
            this.termLog(`◆ Planning DAG with LLM${this.selectedProvider ? ` [${this.selectedProvider}]` : ''}...`, 'dim');
            this.connectToWebSocket(this.currentWorkflowId!);

        } catch (err) {
            console.error('[WebSocketProvider] Error starting workflow:', err);
            this.emit({ type: 'message:typing', isTyping: false });
            this.emit({
                type: 'message:new',
                message: {
                    id: `e-${Date.now()}`,
                    role: 'assistant',
                    content: `Error: Could not connect to backend. Please ensure the server is running at ${config.apiUrl}`,
                    timestamp: Date.now()
                }
            });
        }
    }

    private connectToWebSocket(workflowId: string) {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        const url = `${config.wsUrl}/${workflowId}`;
        console.log(`[WebSocketProvider] Connecting to ${url}`);
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log(`[WebSocketProvider] WebSocket connected for workflow ${workflowId}`);
        };

        this.ws.onmessage = (msg) => {
            try {
                const backendEvent = JSON.parse(msg.data);
                console.log('[WebSocketProvider] Event received:', backendEvent.event_type);
                this.mapAndEmit(backendEvent);
            } catch (err) {
                console.error('[WebSocketProvider] Parse error:', err, msg.data);
            }
        };

        this.ws.onerror = (err) => {
            console.error('[WebSocketProvider] WebSocket error:', err);
        };

        this.ws.onclose = (evt) => {
            if (!this.isManuallyDisconnected) {
                console.warn(`[WebSocketProvider] WebSocket closed (code=${evt.code}, reason=${evt.reason})`);
            }
        };
    }

    private termLog(text: string, level: TerminalLevel = 'info') {
        const now = new Date();
        const ts = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
        const line: TerminalLine = { id: `${Date.now()}-${Math.random()}`, ts, level, text };
        this.emit({ type: 'terminal:log', line });
    }

    private mapAndEmit(backendEvent: any) {
        const { event_type, workflow_id, ...data } = backendEvent;

        switch (event_type) {
            case 'workflow_started':
                this.emit({ type: 'message:typing', isTyping: false });
                this.emit({
                    type: 'message:new',
                    message: {
                        id: `a-${Date.now()}`,
                        role: 'assistant',
                        content: "I've analyzed your request and generated an orchestration plan. Starting execution now.",
                        hasDAG: true,
                        timestamp: Date.now()
                    }
                });
                if (data.dag && data.dag.steps) {
                    const steps = Object.values(data.dag.steps) as any[];
                    this.termLog(`▶ Workflow started — ${steps.length} step(s) planned`, 'info');
                    steps.forEach((s: any) => {
                        const deps = s.depends_on?.length ? ` → deps: [${s.depends_on.join(', ')}]` : '';
                        this.termLog(`  • ${s.id}: ${s.description} [${s.connector}.${s.tool}]${deps}`, 'dim');
                    });
                    const frontendNodes: DAGNode[] = steps.map((step: any) => ({
                        id: step.id,
                        label: step.description || `${step.connector}:${step.tool}`,
                        status: this.mapStatus(step.status),
                        connector: step.connector,
                        tool: step.tool,
                        dependsOn: step.depends_on || [],
                    }));
                    this.emit({ type: 'dag:init', nodes: frontendNodes });
                }
                // Forward to mcp:workflow so app.tsx can track active workflow
                window.dispatchEvent(
                    new CustomEvent('mcp:workflow', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            case 'step_started': {
                const paramKeys = data.params ? Object.keys(data.params).slice(0, 4).join(', ') : '';
                const paramsHint = paramKeys ? ` {${paramKeys}}` : '';
                this.termLog(`⚡ ${data.step_id} — running  [${data.connector}.${data.tool}]${paramsHint}`, 'info');
                this.emit({ type: 'dag:node-update', nodeId: data.step_id, updates: { status: 'running' } });
                break;
            }

            case 'step_completed': {
                const latency = data.latency_ms != null ? `${Math.round(data.latency_ms)}ms` : '—';
                const resultStr = data.result ? JSON.stringify(data.result) : '';
                const resultSnippet = resultStr
                    ? ` → ${resultStr.slice(0, 80)}${resultStr.length > 80 ? '…' : ''}`
                    : '';
                this.termLog(`✓ ${data.step_id} — completed  (${latency})${resultSnippet}`, 'success');
                this.emit({ type: 'dag:node-update', nodeId: data.step_id, updates: { status: 'success', latencyMs: Math.round(data.latency_ms) } });
                this.emit({
                    type: 'audit:log-row',
                    row: { timestamp: new Date().toISOString(), tool: data.step_id, action: 'completed', status: 'success' }
                });
                break;
            }

            case 'step_failed':
                this.termLog(`✗ ${data.step_id} — FAILED [${data.connector || '?'}.${data.tool || '?'}]: ${data.error}`, 'error');
                this.emit({
                    type: 'dag:node-update',
                    nodeId: data.step_id,
                    updates: { status: 'failed', retryCount: data.attempt_number }
                });
                this.emit({
                    type: 'audit:log-row',
                    row: { timestamp: new Date().toISOString(), tool: data.step_id, action: 'failed', status: 'failed', error: data.error }
                });
                break;

            case 'step_retrying':
                this.termLog(`↻ ${data.step_id} — retrying (attempt ${data.attempt_number})`, 'warn');
                this.emit({ type: 'dag:node-update', nodeId: data.step_id, updates: { status: 'retrying', retryCount: data.attempt_number } });
                break;

            case 'recovery_started':
                this.termLog(`🧠 Recovery started for ${data.step_id}`, 'warn');
                this.termLog(`   Context: ${data.error_context?.slice(0, 120) || '—'}`, 'dim');
                this.emit({ type: 'dag:node-update', nodeId: data.step_id, updates: { status: 'retrying' } });
                break;

            case 'recovery_decision':
                this.termLog(`💡 Recovery decision: ${data.action}`, 'warn');
                if (data.reasoning) {
                    this.termLog(`   Reasoning: ${data.reasoning.slice(0, 160)}${data.reasoning.length > 160 ? '…' : ''}`, 'dim');
                }
                break;

            case 'dag_patched':
                this.termLog(`🔧 DAG patched: ${data.step_id} params updated`, 'warn');
                this.emit({ type: 'dag:node-update', nodeId: data.step_id, updates: { status: 'pending' } });
                break;

            case 'dag_updated':
                if (data.new_steps && Array.isArray(data.new_steps)) {
                    this.termLog(`➕ DAG updated: ${data.new_steps.length} step(s) inserted before ${data.insert_before}`, 'warn');
                    const newNodes: DAGNode[] = data.new_steps.map((step: any) => ({
                        id: step.id,
                        label: step.description || `${step.connector}:${step.tool}`,
                        status: 'pending' as const,
                        connector: step.connector,
                        tool: step.tool,
                        dependsOn: step.depends_on || [],
                    }));
                    this.emit({ type: 'dag:init', nodes: newNodes });
                }
                break;

            case 'escalation_required':
                this.termLog(`🚨 Escalation: ${data.user_message}`, 'error');
                this.emit({ type: 'error:sensitive', nodeId: data.step_id, error: data.user_message || 'Manual intervention required' });
                this.emit({ type: 'message:typing', isTyping: false });
                this.emit({
                    type: 'message:new',
                    message: {
                        id: `err-${Date.now()}`,
                        role: 'assistant',
                        content: `⚠️ ${data.user_message || 'Workflow could not complete. Please try again.'}`,
                        timestamp: Date.now(),
                    }
                });
                break;

            case 'circuit_breaker':
                this.termLog(`⚡ Circuit breaker: ${data.step_id} (${data.recovery_attempts}/${data.max_attempts} attempts)`, 'error');
                this.emit({
                    type: 'dag:node-update',
                    nodeId: data.step_id,
                    updates: { status: 'failed', errorType: 'major', retryCount: data.recovery_attempts, maxRetries: data.max_attempts }
                });
                break;

            case 'human_approval_requested':
                this.termLog(`👤 Approval required: ${data.step_id} — ${data.reason}`, 'warn');
                this.emit({ type: 'dag:node-update', nodeId: data.step_id, updates: { status: 'running', errorType: 'sensitive' } });
                window.dispatchEvent(
                    new CustomEvent('mcp:approval', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            case 'steps_parallel':
                this.termLog(`⚡ Parallel execution: [${data.step_ids?.join(', ')}]`, 'info');
                break;

            case 'workflow_completed':
                this.termLog(`🏁 ${data.summary}`, 'success');
                this.emit({ type: 'dag:complete' });
                this.emit({
                    type: 'audit:entry',
                    entry: { id: workflow_id, title: data.summary || 'Workflow Completed', date: new Date(), status: 'success' }
                });
                this.emit({
                    type: 'message:new',
                    message: {
                        id: `done-${Date.now()}`,
                        role: 'assistant',
                        content: data.summary || `Workflow completed: ${data.step_count} steps in ${Math.round(data.total_duration_ms)}ms`,
                        timestamp: Date.now(),
                    }
                });
                // Forward to mcp:workflow so app.tsx can clear active workflow state
                window.dispatchEvent(
                    new CustomEvent('mcp:workflow', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            case 'workflow_killed':
                this.termLog(`⛔ Workflow terminated by user: ${workflow_id}`, 'error');
                this.emit({ type: 'dag:complete' });
                this.emit({ type: 'message:typing', isTyping: false });
                window.dispatchEvent(
                    new CustomEvent('mcp:workflow', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            case 'workflow_paused':
                this.termLog(`⏸ Workflow paused: ${workflow_id}`, 'warn');
                window.dispatchEvent(
                    new CustomEvent('mcp:workflow', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            case 'workflow_resumed':
                this.termLog(`▶ Workflow resumed: ${workflow_id}`, 'info');
                window.dispatchEvent(
                    new CustomEvent('mcp:workflow', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            case 'credentials_saved':
                this.termLog(`✓ Credentials saved for: ${data.service || ''}`, 'success');
                window.dispatchEvent(
                    new CustomEvent('mcp:synthesis', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            // ── Tool Gap Detection ──────────────────────────────────────────────
            // BUG FIX: Only log synthesis info if actual gaps were found.
            // When all tools are covered, show a quiet dim log instead.
            case 'tool_gap_detected': {
                const gapCount = data.gap_count ?? (data.gaps?.length ?? 0);
                const coveredCount = data.covered_intents?.length ?? 0;

                if (gapCount === 0) {
                    // No synthesis needed — quiet log, don't dispatch synthesis event
                    this.termLog(
                        `✔ Tool analysis — all ${coveredCount} intent(s) covered by existing connectors`,
                        'dim'
                    );
                } else {
                    // Real gaps found — log and forward to synthesis panel
                    const gapList = (data.gaps as any[] | undefined)
                        ?.map((g: any) => g.suggested_service || g.intent).join(', ') || '';
                    this.termLog(
                        `🔍 Gap detected — ${gapCount} missing connector(s)${gapList ? `: ${gapList}` : ''}`,
                        'warn'
                    );
                    window.dispatchEvent(
                        new CustomEvent('mcp:synthesis', { detail: { event_type, workflow_id, ...data } })
                    );
                }
                break;
            }

            // ── Self-Evolving Tool Synthesis Events ─────────────────────────────
            case 'synthesis_approval_requested':
                this.termLog(`🔬 Synthesis approval requested — ${data.service || data.service_name || ''}`, 'warn');
                window.dispatchEvent(
                    new CustomEvent('mcp:synthesis', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            case 'tool_synthesis_started':
                this.termLog(`🔬 Synthesizing connector for: ${data.service || ''}`, 'info');
                window.dispatchEvent(
                    new CustomEvent('mcp:synthesis', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            case 'tool_synthesis_streaming':
                // Streaming tokens — forward to synthesis panel only, no terminal spam
                window.dispatchEvent(
                    new CustomEvent('mcp:synthesis', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            case 'tool_synthesized':
                this.termLog(`✓ New connector synthesized: ${data.service || data.tool_name || ''}`, 'success');
                window.dispatchEvent(
                    new CustomEvent('mcp:synthesis', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            case 'tool_synthesis_blocked':
                this.termLog(`🚫 Synthesis blocked: ${data.reason || data.service || ''}`, 'error');
                window.dispatchEvent(
                    new CustomEvent('mcp:synthesis', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            case 'credential_required':
                this.termLog(`🔑 Credentials required for: ${data.service || ''}`, 'warn');
                window.dispatchEvent(
                    new CustomEvent('mcp:synthesis', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            case 'guide_generated':
                this.termLog(`📖 Setup guide generated for: ${data.service || ''}`, 'info');
                window.dispatchEvent(
                    new CustomEvent('mcp:synthesis', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            // ── Chat response (direct, no DAG) ─────────────────────────────────
            case 'chat_response':
                this.emit({ type: 'message:typing', isTyping: false });
                this.emit({ type: 'mode:change', mode: 'chat' });
                this.emit({
                    type: 'message:new',
                    message: {
                        id: `chat-${Date.now()}`,
                        role: 'assistant',
                        content: data.response || data.text || '',
                        timestamp: Date.now(),
                        mode: 'chat',
                    }
                });
                this.termLog(`💬 Chat: ${(data.response || '').slice(0, 60)}…`, 'dim');
                break;

            // ── Model Thinking / Streaming ──────────────────────────────────────
            case 'think:chunk':
            case 'llm:output':
                window.dispatchEvent(
                    new CustomEvent('mcp:thinking', { detail: { event_type, workflow_id, ...data } })
                );
                break;

            default:
                this.termLog(`  ${event_type}`, 'dim');
        }
    }

    private mapStatus(backendStatus: string): any {
        const mapping: Record<string, string> = {
            'pending': 'pending', 'running': 'running', 'success': 'success',
            'failed': 'failed', 'blocked': 'failed', 'recovering': 'retrying',
            'awaiting_approval': 'running', 'skipped': 'pending', 'circuit_broken': 'failed',
        };
        return mapping[backendStatus] || 'pending';
    }

    public startNewRun() {
        this.currentWorkflowId = null;
        this.isManuallyDisconnected = false;
        if (this.ws) { this.ws.close(); this.ws = null; }
        this.emit({ type: 'dag:init', nodes: [] });
    }

    public exportAudit(_format: 'pdf' | 'sheets') {
        const id = this.currentWorkflowId;
        if (!id) { alert('No active workflow to export.'); return; }
        if (_format === 'sheets') {
            let spreadsheetId = '1GevBw5GFWVMRH0Rp7eJ7F-XI0b49_PVfJ5L2khPg0lg';
            try {
                const cached = localStorage.getItem('mcp_env_config');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed.google_audit_spreadsheet_id) {
                        spreadsheetId = parsed.google_audit_spreadsheet_id;
                    }
                }
            } catch (e) {
                console.error('[ws-provider] Failed to read cached spreadsheet ID:', e);
            }
            window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=0#gid=0`, '_blank');
        } else {
            window.open(`${config.apiUrl}/workflows/${id}/audit`, '_blank');
        }
    }
}
