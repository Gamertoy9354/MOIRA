import { useState, useEffect, useCallback } from 'react';
import { orchestrationService } from '../services/orchestration';
import { Message, DAGNode, AuditEntry, OrchestrationEvent, TerminalLine, MessageMode } from '../services/types';

export function useOrchestration() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [dagNodes, setDagNodes] = useState<DAGNode[]>([]);
    const [history, setHistory] = useState<AuditEntry[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
    const [isPlanning, setIsPlanning] = useState(false);
    const [workflowStatus, setWorkflowStatus] = useState('');
    const [currentMode, setCurrentMode] = useState<MessageMode>('chat');

    useEffect(() => {
        const handleEvent = (event: OrchestrationEvent) => {
            switch (event.type) {
                case 'connection:status':
                    setIsConnected(event.connected);
                    break;
                case 'mode:change':
                    setCurrentMode(event.mode);
                    break;
                case 'message:new':
                    setMessages(prev => [...prev, event.message]);
                    break;
                case 'message:typing':
                    setIsTyping(event.isTyping);
                    // When typing starts = LLM is planning
                    if (event.isTyping) { setIsPlanning(true); setWorkflowStatus(''); }
                    break;
                case 'dag:init':
                    setIsPlanning(false);
                    setWorkflowStatus('running');
                    setDagNodes(prev => {
                        // If prev is empty, just set. Otherwise append new nodes (recovery inserts).
                        if (prev.length === 0) return event.nodes;
                        const existingIds = new Set(prev.map(n => n.id));
                        const newOnes = event.nodes.filter(n => !existingIds.has(n.id));
                        return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
                    });
                    break;
                case 'dag:node-update':
                    setDagNodes(prev => prev.map(node => 
                        node.id === event.nodeId 
                            ? { ...node, ...event.updates } 
                            : node
                    ));
                    break;
                case 'dag:complete':
                    setWorkflowStatus('completed');
                    break;
                case 'audit:entry':
                    setHistory(prev => {
                        const exists = prev.some(h => h.id === event.entry.id);
                        if (exists) return prev;
                        return [event.entry, ...prev].sort((a, b) => b.date.getTime() - a.date.getTime());
                    });
                    break;
                case 'audit:export-ready':
                    alert(`Export ready: ${event.url}`);
                    break;
                case 'terminal:log':
                    setTerminalLines(prev => [...prev.slice(-499), event.line]);
                    break;
            }
        };

        const unsubscribe = orchestrationService.onEvent(handleEvent);
        orchestrationService.connect();

        return () => {
            unsubscribe();
            orchestrationService.disconnect();
        };
    }, []);

    const sendMessage = useCallback((text: string, _imageFile?: File) => {
        setDagNodes([]);
        setTerminalLines([]);
        setIsPlanning(true);
        setWorkflowStatus('');
        setCurrentMode('chat'); // will switch to 'execution' if backend returns a DAG
        orchestrationService.sendMessage(text, _imageFile);
    }, []);

    const startNewRun = useCallback(() => {
        setDagNodes([]);
        setTerminalLines([]);
        setIsPlanning(false);
        setWorkflowStatus('');
        orchestrationService.startNewRun();
    }, []);

    const exportAudit = useCallback(async (format: 'pdf' | 'sheets') => {
        if (format === 'sheets') {
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
                console.error('[useOrchestration] Failed to read cached spreadsheet ID:', e);
            }
            window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=0#gid=0`, '_blank');
            return;
        }

        // PDF — fetch ALL workflows and generate a full audit report
        try {
            const { config } = await import('../config');
            const r = await fetch(`${config.apiUrl}/workflows`);
            const data = await r.json();
            const allWorkflows: any[] = data.workflows || [];

            if (allWorkflows.length === 0) {
                alert('No workflows found. Run a workflow first.');
                return;
            }

            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF("p", "mm", "a4");
            const pageW = pdf.internal.pageSize.getWidth();
            let y = 0;

            const addPage = () => {
                pdf.addPage();
                pdf.setFillColor(255, 255, 255);
                pdf.rect(0, 0, pageW, 297, "F");
                y = 20;
            };

            // Cover page
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageW, 297, "F");
            pdf.setFillColor(20, 8, 50);
            pdf.rect(0, 0, pageW, 50, "F");
            pdf.setFontSize(20);
            pdf.setTextColor(210, 170, 255);
            pdf.text("MCP Gateway", pageW / 2, 22, { align: "center" });
            pdf.setFontSize(13);
            pdf.setTextColor(180, 150, 230);
            pdf.text("Full Workflow Audit Report", pageW / 2, 33, { align: "center" });
            pdf.setFontSize(8);
            pdf.setTextColor(150, 130, 190);
            pdf.text(`Generated: ${new Date().toLocaleString()}   ·   ${allWorkflows.length} workflow(s)`, pageW / 2, 43, { align: "center" });

            y = 65;

            // Summary table of all workflows
            pdf.setFontSize(11);
            pdf.setTextColor(40, 20, 80);
            pdf.setFont("helvetica", "bold");
            pdf.text("Workflow Summary", 14, y);
            pdf.setFont("helvetica", "normal");
            y += 7;

            // Table header
            pdf.setFillColor(230, 220, 255);
            pdf.rect(14, y - 5, pageW - 28, 8, "F");
            pdf.setFontSize(8);
            pdf.setTextColor(50, 25, 90);
            pdf.setFont("helvetica", "bold");
            pdf.text("#", 16, y);
            pdf.text("Date & Time", 24, y);
            pdf.text("Request", 70, y);
            pdf.text("Status", 155, y);
            pdf.text("Steps", 178, y);
            pdf.setFont("helvetica", "normal");
            y += 8;

            allWorkflows.forEach((wf: any, i: number) => {
                if (y > 270) { addPage(); }
                if (i % 2 === 0) { pdf.setFillColor(248, 245, 255); pdf.rect(14, y - 4.5, pageW - 28, 7, "F"); }

                const sc = wf.status === 'completed' ? [22, 163, 74] : wf.status === 'failed' ? [220, 38, 38] : [100, 100, 150];
                pdf.setFontSize(7.5);
                pdf.setTextColor(80, 60, 120);
                pdf.text(String(i + 1), 16, y);
                pdf.setTextColor(60, 40, 100);
                const dt = wf.created_at ? new Date(wf.created_at).toLocaleString() : '—';
                pdf.text(dt.slice(0, 20), 24, y);
                pdf.setTextColor(30, 20, 50);
                const req = (wf.user_request || '').slice(0, 50);
                pdf.text(req, 70, y);
                pdf.setTextColor(sc[0], sc[1], sc[2]);
                pdf.setFont("helvetica", "bold");
                pdf.text(wf.status?.toUpperCase() || '—', 155, y);
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(60, 80, 120);
                const succeeded = (wf.steps || []).filter((s: any) => s.status === 'success').length;
                pdf.text(`${succeeded}/${(wf.steps || []).length}`, 178, y);
                y += 7;
            });

            // Detailed section per workflow
            allWorkflows.forEach((wf: any, wi: number) => {
                if ((wf.steps || []).length === 0) return;
                addPage();

                // Workflow header
                pdf.setFillColor(20, 8, 50);
                pdf.rect(0, 0, pageW, 22, "F");
                pdf.setFontSize(11);
                pdf.setTextColor(210, 170, 255);
                pdf.text(`Workflow ${wi + 1}: ${(wf.user_request || '').slice(0, 55)}`, 14, 10);
                pdf.setFontSize(7.5);
                pdf.setTextColor(160, 140, 200);
                const dt2 = wf.created_at ? new Date(wf.created_at).toLocaleString() : '—';
                pdf.text(`ID: ${wf.id}   ·   ${dt2}   ·   Status: ${(wf.status || '').toUpperCase()}`, 14, 18);
                y = 32;

                // Steps table header
                pdf.setFillColor(230, 220, 255);
                pdf.rect(14, y - 5, pageW - 28, 8, "F");
                pdf.setFontSize(8);
                pdf.setTextColor(50, 25, 90);
                pdf.setFont("helvetica", "bold");
                pdf.text("Step", 16, y);
                pdf.text("Connector.Tool", 65, y);
                pdf.text("Status", 125, y);
                pdf.text("Latency", 150, y);
                pdf.text("Time", 170, y);
                pdf.setFont("helvetica", "normal");
                y += 8;

                (wf.steps || []).forEach((s: any, si: number) => {
                    if (y > 265) { addPage(); }
                    if (si % 2 === 0) { pdf.setFillColor(248, 245, 255); pdf.rect(14, y - 4.5, pageW - 28, 7, "F"); }

                    const sc2 = s.status === 'success' ? [22,163,74] : s.status === 'failed' || s.status === 'circuit_broken' ? [220,38,38] : s.status === 'recovering' ? [217,119,6] : [100,100,120];
                    pdf.setFillColor(sc2[0], sc2[1], sc2[2]);
                    pdf.circle(16, y - 1, 1.2, "F");

                    pdf.setFontSize(7.5);
                    pdf.setTextColor(30, 20, 50);
                    const desc = (s.description || s.id || '').slice(0, 28);
                    pdf.text(desc, 19, y);

                    pdf.setTextColor(80, 50, 140);
                    pdf.text(`${s.connector}.${s.tool}`, 65, y);

                    pdf.setTextColor(sc2[0], sc2[1], sc2[2]);
                    pdf.setFont("helvetica", "bold");
                    pdf.text(s.status || '—', 125, y);
                    pdf.setFont("helvetica", "normal");

                    pdf.setTextColor(60, 120, 60);
                    pdf.text(s.latency_ms ? `${s.latency_ms}ms` : '—', 150, y);

                    pdf.setTextColor(100, 80, 140);
                    const t = s.completed_at ? new Date(s.completed_at).toLocaleTimeString() : '—';
                    pdf.text(t, 170, y);

                    y += 7;

                    if (s.error) {
                        if (y > 265) { addPage(); }
                        pdf.setFillColor(255, 238, 238);
                        pdf.rect(19, y - 4, pageW - 33, 6, "F");
                        pdf.setFontSize(6.5);
                        pdf.setTextColor(180, 40, 40);
                        pdf.text(`↳ Error: ${(s.error || '').slice(0, 95)}`, 21, y);
                        y += 7;
                    }
                });
            });

            // Footer on last page
            y += 6;
            if (y > 270) { addPage(); }
            pdf.setDrawColor(180, 160, 220);
            pdf.setLineWidth(0.3);
            pdf.line(14, y, pageW - 14, y);
            y += 6;
            pdf.setFontSize(7);
            pdf.setTextColor(150, 130, 180);
            pdf.text("Generated by MCP Gateway — All workflow actions are immutably logged.", 14, y);

            pdf.save(`mcp-gateway-full-audit-${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('Export audit failed:', err);
            alert('Export failed. Please try again.');
        }
    }, [dagNodes]);

    const setModel = useCallback((modelId: string) => {
        orchestrationService.setModel(modelId);
    }, []);

    return {
        messages, dagNodes, history, isTyping, isConnected,
        terminalLines, isPlanning, workflowStatus, currentMode,
        sendMessage, startNewRun, exportAudit, setModel,
    };
}
