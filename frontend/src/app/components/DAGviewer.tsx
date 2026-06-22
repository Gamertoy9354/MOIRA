import { useEffect, useState, useCallback } from 'react';
import {
    ReactFlow,
    Background,
    Handle,
    Position,
    NodeProps,
    Edge,
    Node as FlowNode,
    NodeChange,
    ReactFlowProvider,
    useReactFlow,
    Controls,
    MiniMap,
    MarkerType,
    applyNodeChanges,
    useNodesState,
    useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    CheckCircle, CircleDashed, AlertTriangle, RefreshCw, XCircle,
    Zap, Flag, Brain, GitBranch, MessageSquare, Database, Sheet,
    ChevronRight,
} from 'lucide-react';
import { DAGNode, NodeStatus } from '../../services/types';
import dagre from 'dagre';

// ── Dimensions ───────────────────────────────────────────────────────────────
const NODE_W = 260;
const NODE_H = 92;
const SPECIAL_W = 164;
const SPECIAL_H = 58;

// ── Connector icon map ────────────────────────────────────────────────────────
const ConnectorIcon = ({ connector }: { connector?: string }) => {
    const cls = 'w-3.5 h-3.5 shrink-0';
    switch (connector) {
        case 'github':   return <GitBranch className={cls} style={{ color: '#a78bfa' }} />;
        case 'slack':    return <MessageSquare className={cls} style={{ color: '#38bdf8' }} />;
        case 'jira':     return <Zap className={cls} style={{ color: '#C8A96E' }} />;
        case 'sheets':   return <Sheet className={cls} style={{ color: '#4ade80' }} />;
        case 'database': return <Database className={cls} style={{ color: '#f472b6' }} />;
        default:         return <Zap className={cls} style={{ color: 'rgba(200,169,110,0.5)' }} />;
    }
};

// ── Status colours — MOIRA palette ───────────────────────────────────────────
const STATUS_BORDER: Record<string, string> = {
    success:  '#C8A96E',
    running:  '#8B35D6',
    failed:   '#ef4444',
    retrying: '#f59e0b',
    pending:  'rgba(200,169,110,0.12)',
};
const STATUS_BG: Record<string, string> = {
    success:  'rgba(200,169,110,0.07)',
    running:  'rgba(74,14,143,0.12)',
    failed:   'rgba(239,68,68,0.07)',
    retrying: 'rgba(245,158,11,0.07)',
    pending:  'rgba(8,6,16,0.5)',
};
const STATUS_GLOW: Record<string, string> = {
    success:  '0 0 18px rgba(200,169,110,0.28)',
    running:  '0 0 22px rgba(139,53,214,0.45)',
    failed:   '0 0 18px rgba(239,68,68,0.25)',
    retrying: '0 0 18px rgba(245,158,11,0.25)',
    pending:  'none',
};

const StatusIcon = ({ status }: { status: NodeStatus }) => {
    switch (status) {
        case 'success': return <CheckCircle className="w-4 h-4" style={{ color: '#C8A96E' }} />;
        case 'running': return <RefreshCw className="w-4 h-4 animate-spin" style={{ color: '#a78bfa' }} />;
        case 'failed':  return <XCircle className="w-4 h-4 text-red-400" />;
        case 'retrying':return <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />;
        default:        return <CircleDashed className="w-4 h-4" style={{ color: 'rgba(200,169,110,0.2)' }} />;
    }
};

// ── Step node ─────────────────────────────────────────────────────────────────
function StepNode({ data }: NodeProps) {
    const node = data.node as DAGNode;
    const status = node.status || 'pending';
    const border = STATUS_BORDER[status] ?? STATUS_BORDER.pending;
    const bg     = STATUS_BG[status]     ?? STATUS_BG.pending;
    const glow   = STATUS_GLOW[status]   ?? 'none';

    return (
        <div
            className="flex flex-col rounded-2xl border overflow-hidden"
            style={{
                width: NODE_W,
                background: bg,
                borderColor: border,
                boxShadow: glow,
                backdropFilter: 'blur(12px)',
            }}
        >
            <Handle type="target" position={Position.Top}
                className="!w-2.5 !h-2.5 !border-0"
                style={{ background: border, opacity: 0.7 }} />

            {/* Top colour bar */}
            <div className="h-[2px] w-full" style={{ background: border, opacity: 0.6 }} />

            <div className="px-3 py-2.5 flex flex-col gap-1.5">
                {/* Header row */}
                <div className="flex items-start gap-2">
                    <StatusIcon status={status} />
                    <div className="flex-1 min-w-0">
                        <div
                            className="text-[12px] font-semibold leading-tight line-clamp-2"
                            style={{ color: '#F0EBF8' }}
                        >
                            {node.label}
                        </div>
                    </div>
                </div>

                {/* Connector + tool + timing row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <ConnectorIcon connector={node.connector} />
                        <span className="font-mono-code" style={{ fontSize: '0.6rem', color: 'rgba(200,169,110,0.5)' }}>
                            {node.connector}.{node.tool}
                        </span>
                    </div>
                    {node.latencyMs !== undefined && (
                        <span className="font-mono-code" style={{ fontSize: '0.6rem', color: '#C8A96E' }}>
                            {node.latencyMs}ms
                        </span>
                    )}
                    {node.retryCount !== undefined && node.retryCount > 0 && (
                        <span className="font-mono-code" style={{ fontSize: '0.6rem', color: '#fbbf24' }}>
                            retry #{node.retryCount}
                        </span>
                    )}
                </div>

                {/* Status pill */}
                <div className="flex items-center gap-1">
                    <span
                        className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md font-cinzel"
                        style={{ background: `${border}22`, color: border }}
                    >
                        {status}
                    </span>
                    {node.status === 'failed' && node.errorType && (
                        <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />{node.errorType}
                        </span>
                    )}
                </div>

                {/* Sub-DAG recovery steps */}
                {node.subDag && node.subDag.length > 0 && (
                    <div className="mt-0.5 pl-2 space-y-0.5" style={{ borderLeft: '2px solid rgba(200,169,110,0.15)' }}>
                        {node.subDag.map(sub => (
                            <div key={sub.id} className="flex items-center gap-1" style={{ fontSize: '0.6rem', color: 'rgba(200,169,110,0.3)' }}>
                                <ChevronRight className="w-2.5 h-2.5 shrink-0" style={{ color: 'rgba(200,169,110,0.3)' }} />
                                <span className="truncate">{sub.label}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Bottom}
                className="!w-2.5 !h-2.5 !border-0"
                style={{ background: border, opacity: 0.7 }} />
        </div>
    );
}

// ── START node ─────────────────────────────────────────────────────────────────
function StartNode({ data }: NodeProps) {
    const isPlanning = data.planning as boolean;
    return (
        <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border"
            style={{
                width: SPECIAL_W,
                background: isPlanning ? 'rgba(74,14,143,0.18)' : 'rgba(74,14,143,0.08)',
                borderColor: isPlanning ? 'rgba(139,53,214,0.6)' : 'rgba(200,169,110,0.2)',
                boxShadow: isPlanning ? '0 0 24px rgba(139,53,214,0.4)' : 'none',
            }}
        >
            <Brain className={`w-4 h-4 ${isPlanning ? 'animate-pulse' : ''}`}
                style={{ color: isPlanning ? '#a78bfa' : 'rgba(200,169,110,0.4)' }} />
            <div>
                <div className="font-cinzel font-bold" style={{ fontSize: '0.65rem', color: '#F0EBF8' }}>LLM Planning</div>
                <div className="font-cinzel uppercase tracking-wider" style={{ fontSize: '0.55rem', color: isPlanning ? '#a78bfa' : 'rgba(200,169,110,0.4)' }}>
                    {isPlanning ? 'weaving...' : 'done'}
                </div>
            </div>
            <Handle type="source" position={Position.Bottom}
                className="!w-2.5 !h-2.5 !border-0"
                style={{ background: 'rgba(200,169,110,0.5)' }} />
        </div>
    );
}

// ── END node ──────────────────────────────────────────────────────────────────
function EndNode({ data }: NodeProps) {
    const status = data.status as string;
    const isSuccess = status === 'completed';
    const isFailed  = status === 'failed';
    const color = isSuccess ? '#C8A96E' : isFailed ? '#ef4444' : 'rgba(200,169,110,0.3)';
    return (
        <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border"
            style={{
                width: SPECIAL_W,
                background: isSuccess ? 'rgba(200,169,110,0.06)' : isFailed ? 'rgba(239,68,68,0.08)' : 'rgba(8,6,16,0.5)',
                borderColor: color,
                boxShadow: isSuccess ? '0 0 20px rgba(200,169,110,0.22)' : isFailed ? '0 0 20px rgba(239,68,68,0.2)' : 'none',
            }}
        >
            <Handle type="target" position={Position.Top}
                className="!w-2.5 !h-2.5 !border-0"
                style={{ background: color }} />
            <Flag className="w-4 h-4" style={{ color }} />
            <div>
                <div className="font-cinzel font-bold" style={{ fontSize: '0.65rem', color: '#F0EBF8' }}>
                    {isSuccess ? 'Fate Fulfilled' : isFailed ? 'Fate Failed' : 'Awaiting'}
                </div>
                <div className="font-cinzel uppercase tracking-wider" style={{ fontSize: '0.55rem', color }}>
                    {status || 'waiting'}
                </div>
            </div>
        </div>
    );
}

const nodeTypes = { step: StepNode, start: StartNode, end: EndNode };

// ── Edge builder ──────────────────────────────────────────────────────────────
function buildEdges(origNodes: DAGNode[], workflowDone: boolean): Edge[] {
    const edges: Edge[] = [];
    const ids = new Set(origNodes.map(n => n.id));

    origNodes.forEach(n => {
        if (!n.dependsOn || n.dependsOn.length === 0) {
            edges.push(makeEdge('__start__', n.id, n.status === 'running' || n.status === 'retrying'));
        }
    });

    origNodes.forEach(n => {
        (n.dependsOn || []).forEach(dep => {
            if (ids.has(dep)) {
                edges.push(makeEdge(dep, n.id, n.status === 'running' || n.status === 'retrying'));
            }
        });
    });

    const hasChildren = new Set(origNodes.flatMap(n => n.dependsOn || []));
    origNodes.forEach(n => {
        if (!hasChildren.has(n.id)) {
            edges.push(makeEdge(n.id, '__end__', false));
        }
    });

    if (origNodes.length > 0 && edges.filter(e => e.source !== '__start__' && e.target !== '__end__').length === 0 && origNodes.length > 1) {
        for (let i = 0; i < origNodes.length - 1; i++) {
            edges.push(makeEdge(origNodes[i].id, origNodes[i + 1].id, false));
        }
    }

    return edges;
}

function makeEdge(src: string, tgt: string, animated: boolean): Edge {
    return {
        id: `e-${src}-${tgt}`,
        source: src,
        target: tgt,
        animated,
        type: 'bezier',
        markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 13,
            height: 13,
            color: animated ? 'rgba(200,169,110,0.7)' : 'rgba(200,169,110,0.35)',
        },
        style: {
            stroke: animated ? 'rgba(200,169,110,0.65)' : 'rgba(200,169,110,0.2)',
            strokeWidth: animated ? 2 : 1.5,
        },
    };
}

// ── Dagre layout ──────────────────────────────────────────────────────────────
function layoutAll(flowNodes: FlowNode[], edges: Edge[]): FlowNode[] {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', nodesep: 55, ranksep: 75 });

    flowNodes.forEach(n => {
        const isSpecial = n.type === 'start' || n.type === 'end';
        g.setNode(n.id, { width: isSpecial ? SPECIAL_W : NODE_W, height: isSpecial ? SPECIAL_H : NODE_H });
    });
    edges.forEach(e => g.setEdge(e.source, e.target));
    dagre.layout(g);

    return flowNodes.map(n => {
        const pos = g.node(n.id);
        const isSpecial = n.type === 'start' || n.type === 'end';
        const w = isSpecial ? SPECIAL_W : NODE_W;
        const h = isSpecial ? SPECIAL_H : NODE_H;
        return { ...n, position: { x: pos.x - w / 2, y: pos.y - h / 2 } };
    });
}

function computeHeight(nodeCount: number): number {
    if (nodeCount <= 0) return 300;
    const rows = Math.ceil(nodeCount / 3) + 2;
    return Math.min(Math.max(rows * 170 + 40, 320), 720);
}

// ── Main flow component ───────────────────────────────────────────────────────
function DAGFlow({ nodes: origNodes, isPlanning, workflowStatus }: {
    nodes: DAGNode[];
    isPlanning: boolean;
    workflowStatus: string;
}) {
    const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
    const [edges, setEdges] = useEdgesState<Edge>([]);
    const { fitView } = useReactFlow();

    const workflowDone = workflowStatus === 'completed' || workflowStatus === 'failed';

    // Track which nodes the user has manually dragged so we don't reset their positions
    const userPositions = new Map<string, { x: number; y: number }>();

    const relayout = useCallback(() => {
        const startNode: FlowNode = {
            id: '__start__',
            type: 'start',
            data: { planning: isPlanning },
            position: { x: 0, y: 0 },
            draggable: true,
        };

        const stepNodes: FlowNode[] = origNodes.map(n => ({
            id: n.id,
            type: 'step',
            data: { node: n },
            position: { x: 0, y: 0 },
            draggable: true,
        }));

        const endNode: FlowNode = {
            id: '__end__',
            type: 'end',
            data: { status: workflowDone ? workflowStatus : origNodes.length > 0 ? 'running' : 'waiting' },
            position: { x: 0, y: 0 },
            draggable: true,
        };

        const allNodes = [startNode, ...stepNodes, endNode];
        const allEdges = buildEdges(origNodes, workflowDone);
        const laid = layoutAll(allNodes, allEdges);

        setNodes(laid);
        setEdges(allEdges);
        setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 80);
    }, [origNodes, isPlanning, workflowStatus, workflowDone, fitView]);

    useEffect(() => { relayout(); }, [relayout]);

    // Handle node status updates without resetting positions
    useEffect(() => {
        setNodes((prev: FlowNode[]) => prev.map((n: FlowNode) => {
            if (n.type === 'step') {
                const updated = origNodes.find(on => on.id === n.id);
                if (updated) {
                    return { ...n, data: { node: updated } };
                }
            }
            if (n.type === 'start') {
                return { ...n, data: { planning: isPlanning } };
            }
            if (n.type === 'end') {
                return { ...n, data: { status: workflowDone ? workflowStatus : origNodes.length > 0 ? 'running' : 'waiting' } };
            }
            return n;
        }));
    }, [origNodes, isPlanning, workflowStatus]);

    return (
        <div className="w-full h-full" style={{ background: '#080610' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                nodeTypes={nodeTypes}
                minZoom={0.08}
                maxZoom={2.5}
                proOptions={{ hideAttribution: true }}
                nodesDraggable={true}
                nodesConnectable={false}
                zoomOnScroll={true}
                zoomOnPinch={true}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                panOnDrag={true}
                selectNodesOnDrag={false}
            >
                <Background color="rgba(200,169,110,0.04)" gap={28} size={1} />
                <Controls
                    showInteractive={false}
                    className="!rounded-xl !p-1"
                />
                {origNodes.length > 5 && (
                    <MiniMap
                        nodeColor={n => {
                            if (n.type === 'start') return '#4A0E8F';
                            if (n.type === 'end') return '#C8A96E';
                            const s = (n.data?.node as DAGNode)?.status;
                            return s === 'success' ? '#C8A96E' : s === 'failed' ? '#ef4444' : s === 'running' ? '#8B35D6' : 'rgba(200,169,110,0.1)';
                        }}
                        className="!rounded-xl"
                        maskColor="rgba(8,6,16,0.75)"
                        style={{
                            background: 'rgba(8,6,16,0.9)',
                            border: '1px solid rgba(200,169,110,0.15)',
                        }}
                    />
                )}
            </ReactFlow>
        </div>
    );
}

// ── Public export ─────────────────────────────────────────────────────────────
export function DAGViewer({ nodes, isPlanning = false, workflowStatus = '' }: {
    nodes: DAGNode[];
    isPlanning?: boolean;
    workflowStatus?: string;
}) {
    const height = computeHeight(nodes.length);
    const isDone = workflowStatus === 'completed';
    const isFailed = workflowStatus === 'failed';

    return (
        <div
            className="w-full rounded-2xl overflow-hidden mt-2 relative"
            style={{
                height,
                border: isDone
                    ? '1px solid rgba(200,169,110,0.35)'
                    : isFailed
                    ? '1px solid rgba(239,68,68,0.25)'
                    : '1px solid rgba(74,14,143,0.3)',
                boxShadow: isDone
                    ? '0 0 40px rgba(200,169,110,0.1), 0 20px 60px rgba(0,0,0,0.7)'
                    : isFailed
                    ? '0 0 40px rgba(239,68,68,0.08), 0 20px 60px rgba(0,0,0,0.7)'
                    : '0 20px 60px rgba(0,0,0,0.7)',
            }}
        >
            <ReactFlowProvider>
                <DAGFlow nodes={nodes} isPlanning={isPlanning} workflowStatus={workflowStatus} />
            </ReactFlowProvider>
        </div>
    );
}
