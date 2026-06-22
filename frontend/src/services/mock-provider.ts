import { OrchestrationProvider, OrchestrationEvent, DAGNode, Message, AuditEntry } from './types';
import { subDays } from 'date-fns';

export class MockProvider implements OrchestrationProvider {
    private listeners: ((event: OrchestrationEvent) => void)[] = [];
    private timers: number[] = [];
    private messageCount = 0;

    // Initial state matching the current UI mock
    private getInitialNodes(): DAGNode[] {
        return [
            { id: '1', label: 'Extract Parameters', status: 'pending' },
            { id: '2', label: 'Jira: Create Ticket', status: 'pending' },
            { id: '3', label: 'Slack: Notify Channel', status: 'pending' },
            { id: '4', label: 'GitHub: Provision Repo', status: 'pending' },
            { id: '5', label: 'Sheets: Audit Log', status: 'pending' },
            { id: '6', label: 'Finalize Output', status: 'pending' },
        ];
    }

    private emit(event: OrchestrationEvent) {
        this.listeners.forEach(l => l(event));
    }

    public onEvent(callback: (event: OrchestrationEvent) => void): () => void {
        this.listeners.push(callback);
        // Dispatch mock history immediately so the sidebar populates
        this.emitMockHistory();
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    public connect() {
        this.emit({ type: 'connection:status', connected: true });
        console.log('[MockProvider] Connected');
        this.emitMockHistory();
    }

    public disconnect() {
        this.emit({ type: 'connection:status', connected: false });
        this.clearTimers();
        console.log('[MockProvider] Disconnected');
    }

    public sendMessage(text: string, imageFile?: File) {
        this.messageCount++;
        const msgId = `u-${Date.now()}`;
        
        // Echo user message immediately
        this.emit({ type: 'message:new', message: { id: msgId, role: 'user', content: text, timestamp: Date.now() } });
        
        // Simulate typing
        this.emit({ type: 'message:typing', isTyping: true });

        // Simulate thinking before responding
        this.schedule(() => {
            this.emit({ type: 'message:typing', isTyping: false });
            
            const astMsgId = `a-${Date.now()}`;
            this.emit({ 
                type: 'message:new', 
                message: { 
                    id: astMsgId, 
                    role: 'assistant', 
                    content: "I've analyzed your request and generated the following orchestration DAG. Extracting parameters and beginning parallel execution.", 
                    hasDAG: true,
                    timestamp: Date.now()
                } 
            });

            this.simulateDAGRun();
        }, 1500);
    }

    public startNewRun() {
        this.sendMessage("Start a new audit workflow", undefined);
    }

    public exportAudit(format: 'pdf' | 'sheets') {
        console.log(`[MockProvider] Exporting audit as ${format}...`);
        this.schedule(() => {
            this.emit({ type: 'audit:export-ready', format, url: 'https://example.com/mock-export' });
        }, 800);
    }

    // no-op for mock
    public setModel(_modelId: string) {}

    // Extracted exactly from the DAGviewer.tsx useEffect
    private simulateDAGRun() {
        this.clearTimers();
        this.emit({ type: 'dag:init', nodes: this.getInitialNodes() });

        // Step 1: Start Extract
        this.schedule(() => {
            this.emit({ type: 'dag:node-update', nodeId: '1', updates: { status: 'running' } });
        }, 1000);

        // Step 2: Complete Extract, Start Parallel Execution
        this.schedule(() => {
            this.emit({ type: 'dag:node-update', nodeId: '1', updates: { status: 'success' } });
            this.emit({ type: 'dag:node-update', nodeId: '2', updates: { status: 'running' } });
            this.emit({ type: 'dag:node-update', nodeId: '3', updates: { status: 'running' } });
            this.emit({ type: 'dag:node-update', nodeId: '4', updates: { status: 'running' } });
            this.emit({ type: 'dag:node-update', nodeId: '5', updates: { status: 'running' } });
        }, 2500);

        // Step 3: Progress Parallel Exec: Sheets success, GitHub minor error, Slack major error, Jira running
        this.schedule(() => {
            this.emit({ type: 'dag:node-update', nodeId: '5', updates: { status: 'success' } });
            this.emit({ type: 'dag:node-update', nodeId: '4', updates: { status: 'failed', errorType: 'minor', retryCount: 1 } });
            this.emit({ type: 'dag:node-update', nodeId: '3', updates: { status: 'failed', errorType: 'major', retryCount: 0 } });
        }, 4500);

        // Step 4: Retrying GitHub, Generate SubDAG for Slack
        this.schedule(() => {
            this.emit({ type: 'dag:node-update', nodeId: '4', updates: { status: 'retrying', retryCount: 1 } });
            this.emit({ 
                type: 'dag:node-update', 
                nodeId: '3', 
                updates: { 
                    status: 'retrying',
                    subDag: [
                        { id: '3a', label: 'Verify Auth Token', status: 'running' },
                        { id: '3b', label: 'Re-send Webhook', status: 'pending' }
                    ]
                } 
            });
        }, 6000);

        // Step 5: GitHub succeeds, Jira succeeds, SubDAG proceeds
        this.schedule(() => {
            this.emit({ type: 'dag:node-update', nodeId: '2', updates: { status: 'success' } });
            this.emit({ type: 'dag:node-update', nodeId: '4', updates: { status: 'success' } });
            this.emit({ 
                type: 'dag:node-update', 
                nodeId: '3', 
                updates: { 
                    status: 'retrying',
                    subDag: [
                        { id: '3a', label: 'Verify Auth Token', status: 'success' },
                        { id: '3b', label: 'Re-send Webhook', status: 'running' }
                    ]
                } 
            });
        }, 8000);

        // Step 6: SubDAG succeeds, Slack succeeds
        this.schedule(() => {
            this.emit({ 
                type: 'dag:node-update', 
                nodeId: '3', 
                updates: { 
                    status: 'success',
                    subDag: [
                        { id: '3a', label: 'Verify Auth Token', status: 'success' },
                        { id: '3b', label: 'Re-send Webhook', status: 'success' }
                    ]
                } 
            });
        }, 10000);

        // Step 7: Finalize running
        this.schedule(() => {
            this.emit({ type: 'dag:node-update', nodeId: '6', updates: { status: 'running' } });
        }, 10500);

        // Step 8: Finalize success
        this.schedule(() => {
            this.emit({ type: 'dag:node-update', nodeId: '6', updates: { status: 'success' } });
            this.emit({ type: 'dag:complete' });
            
            // Add to history
            this.emit({ 
                type: 'audit:entry', 
                entry: { 
                    id: Date.now().toString(), 
                    title: `Audit Run ${this.messageCount}`, 
                    date: new Date(), 
                    status: 'success' 
                } 
            });
        }, 11500);
    }

    private emitMockHistory() {
        const history: AuditEntry[] = [
            { id: '1', title: 'Slack & Jira Integration Audit', date: new Date(), status: 'success' },
            { id: '2', title: 'GitHub Org Config Update', date: new Date(), status: 'success' },
            { id: '3', title: 'Database Auth Token Rotation', date: subDays(new Date(), 1), status: 'failed' },
            { id: '4', title: 'Weekly Access Review', date: subDays(new Date(), 2), status: 'success' },
            { id: '5', title: 'Onboard Employee: Jane Doe', date: subDays(new Date(), 3), status: 'success' },
            { id: '6', title: 'CI/CD Pipeline Hardening', date: subDays(new Date(), 5), status: 'success' },
        ];
        
        // Delay slightly so UI is ready to catch
        setTimeout(() => {
            history.forEach(entry => this.emit({ type: 'audit:entry', entry }));
        }, 100);
    }

    private schedule(fn: () => void, delayMs: number) {
        const id = window.setTimeout(fn, delayMs);
        this.timers.push(id);
    }

    private clearTimers() {
        this.timers.forEach(clearTimeout);
        this.timers = [];
    }
}
