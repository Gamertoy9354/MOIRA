/**
 * Shared Types for MOIRA Orchestration System
 */

// ─── DAG Types ───

export type NodeStatus = 'pending' | 'running' | 'success' | 'failed' | 'retrying';

export type ErrorType = 'minor' | 'major' | 'sensitive';

export interface DAGNode {
    id: string;
    label: string;
    status: NodeStatus;
    connector?: string;
    tool?: string;
    latencyMs?: number;
    dependsOn?: string[];
    errorType?: ErrorType;
    retryCount?: number;
    maxRetries?: number;
    subDag?: DAGNode[];
}

// ─── Message Types ───

export type MessageMode = 'chat' | 'execution';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    hasDAG?: boolean;
    timestamp?: number;
    mode?: MessageMode;  // 'chat' for conversational, 'execution' for workflow
}

// ─── Chat Response ───
export interface ChatResponse {
    text: string;
    visualType?: 'table' | 'code' | 'list' | 'none';
    language?: string;  // for code blocks
}

// ─── Audit Types ───

export type AuditStatus = 'success' | 'failed' | 'running';

export interface AuditEntry {
    id: string;
    title: string;
    date: Date;
    status: AuditStatus;
    nodeCount?: number;
}

export interface AuditLogRow {
    timestamp: string;
    tool: string;
    action: string;
    status: string;
    error?: string;
    resolution?: string;
}

// ─── Terminal Types ───

export type TerminalLevel = 'info' | 'success' | 'error' | 'warn' | 'dim';

export interface TerminalLine {
    id: string;
    ts: string;       // HH:MM:SS.mmm
    level: TerminalLevel;
    text: string;
}

// ─── Orchestration Events (WebSocket Protocol) ───

export type OrchestrationEvent =
    | { type: 'dag:init'; nodes: DAGNode[] }
    | { type: 'dag:node-update'; nodeId: string; updates: Partial<DAGNode> }
    | { type: 'dag:complete' }
    | { type: 'message:new'; message: Message }
    | { type: 'message:typing'; isTyping: boolean }
    | { type: 'message:chat'; text: string }     // direct LLM chat response
    | { type: 'mode:change'; mode: MessageMode } // switch UI mode
    | { type: 'audit:entry'; entry: AuditEntry }
    | { type: 'audit:log-row'; row: AuditLogRow }
    | { type: 'audit:export-ready'; format: 'pdf' | 'sheets'; url: string }
    | { type: 'error:sensitive'; nodeId: string; error: string; details?: string }
    | { type: 'connection:status'; connected: boolean }
    | { type: 'terminal:log'; line: TerminalLine };

// ─── Service Provider Interface ───

export interface OrchestrationProvider {
    connect(): void;
    disconnect(): void;
    sendMessage(text: string, imageFile?: File): void;
    exportAudit(format: 'pdf' | 'sheets'): void;
    onEvent(callback: (event: OrchestrationEvent) => void): () => void;
    startNewRun(): void;
    setModel(modelId: string): void;
}
