import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Zap, Shield, GitBranch, BarChart3, Terminal,
    ChevronDown, ArrowRight, CheckCircle2, Globe, Code2,
    Network, Users, Layers, Eye, Play, Check, AlertTriangle, Lock, RefreshCw, X
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Premium SVG Icons (Replacing Emojis)
// ─────────────────────────────────────────────────────────────────────────────

function GitHubIcon({ size = 20, className = "" }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
        </svg>
    );
}

function JiraIcon({ size = 20, className = "" }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
    );
}

function SlackIcon({ size = 20, className = "" }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
    );
}

function SheetsIcon({ size = 20, className = "" }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="16" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
    );
}

function DatabaseIcon({ size = 20, className = "" }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </svg>
    );
}

function SparklesIcon({ size = 20, className = "" }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
        </svg>
    );
}

function CustomLightningIcon({ size = 32, className = "" }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#C8A96E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    );
}

function CustomGalaxyIcon({ size = 32, className = "" }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#C8A96E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <path d="M2 12h20" />
            <circle cx="12" cy="12" r="4" />
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Thread Canvas Animation (GSAP Controlled)
// ─────────────────────────────────────────────────────────────────────────────

interface ThreadNode { x: number; y: number; baseX: number; baseY: number; vx: number; vy: number }

function ThreadCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const scrollRef = useRef(0);
    const nodesRef = useRef<ThreadNode[]>([]);
    const animRef = useRef<number>(0);

    useEffect(() => {
        // Register ScrollTrigger to record progress
        const st = ScrollTrigger.create({
            trigger: document.body,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            onUpdate: (self) => {
                scrollRef.current = self.progress;
            }
        });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // Build nodes
        const numNodes = 28;
        nodesRef.current = Array.from({ length: numNodes }, () => {
            const rx = Math.random() * canvas.width;
            const ry = Math.random() * canvas.height;
            return {
                x: rx,
                y: ry,
                baseX: rx,
                baseY: ry,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3
            };
        });

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const nodes = nodesRef.current;
            const p = scrollRef.current; // 0.0 to 1.0

            // Update positions based on scroll phases
            nodes.forEach((n, idx) => {
                // Base float
                n.baseX += n.vx;
                n.baseY += n.vy;
                if (n.baseX < 0 || n.baseX > canvas.width) n.vx *= -1;
                if (n.baseY < 0 || n.baseY > canvas.height) n.vy *= -1;

                let targetX = n.baseX;
                let targetY = n.baseY;

                if (p < 0.25) {
                    // Phase 1: Gentle float (Hero)
                    targetX = n.baseX;
                    targetY = n.baseY;
                } else if (p >= 0.25 && p < 0.5) {
                    // Phase 2: Spaghetti Crisis (Knotting, pulling into center)
                    const factor = (p - 0.25) / 0.25; // 0 to 1
                    const cx = canvas.width / 2;
                    const cy = canvas.height / 2;
                    // Spiral pull
                    const angle = idx * (Math.PI / 4) + factor * Math.PI * 2;
                    const radius = (1 - factor * 0.7) * (canvas.width * 0.25) + Math.sin(idx) * 50;
                    targetX = cx + Math.cos(angle) * radius;
                    targetY = cy + Math.sin(angle) * radius;
                } else if (p >= 0.5 && p < 0.75) {
                    // Phase 3: MCP Grid alignment (Weaving, untangling)
                    const factor = (p - 0.5) / 0.25; // 0 to 1
                    const cols = 4;
                    const rows = 7;
                    const cIdx = idx % cols;
                    const rIdx = Math.floor(idx / cols);
                    const cellW = canvas.width / (cols + 1);
                    const cellH = canvas.height / (rows + 1);
                    const gx = (cIdx + 1) * cellW;
                    const gy = (rIdx + 1) * cellH;

                    // Blend from previous central spiral to grid
                    const prevFactor = 1 - factor;
                    const cx = canvas.width / 2;
                    const cy = canvas.height / 2;
                    const angle = idx * (Math.PI / 4) + Math.PI * 2;
                    const radius = 0.3 * (canvas.width * 0.25) + Math.sin(idx) * 50;
                    const sx = cx + Math.cos(angle) * radius;
                    const sy = cy + Math.sin(angle) * radius;

                    targetX = sx * prevFactor + gx * factor;
                    targetY = sy * prevFactor + gy * factor;
                } else {
                    // Phase 4: Circular Loom rotation around Team section
                    const factor = (p - 0.75) / 0.25; // 0 to 1
                    const cx = canvas.width / 2;
                    const cy = canvas.height * 0.6;
                    const angle = idx * (Math.PI / 14) + (factor * Math.PI * 0.5) + (n.vx * 2);
                    const radius = canvas.width * 0.3;
                    targetX = cx + Math.cos(angle) * radius;
                    targetY = cy + Math.sin(angle) * radius;
                }

                // Smooth interpolation to target
                n.x += (targetX - n.x) * 0.08;
                n.y += (targetY - n.y) * 0.08;
            });

            // Draw connecting bezier threads
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const a = nodes[i];
                    const b = nodes[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // Dynamic max link distance based on scroll progress
                    let maxLink = canvas.width * 0.25;
                    if (p >= 0.25 && p < 0.5) maxLink = canvas.width * 0.45; // larger range to show chaos
                    if (p >= 0.5 && p < 0.75) maxLink = canvas.width * 0.2;  // tighter range for structured grid

                    if (dist < maxLink) {
                        const alpha = (1 - dist / maxLink) * (p >= 0.25 && p < 0.5 ? 0.32 : 0.18);
                        const mx = (a.x + b.x) / 2 + Math.sin(idxRef.current + i) * (p >= 0.25 && p < 0.5 ? 60 : 15);
                        const my = (a.y + b.y) / 2 + Math.cos(idxRef.current + j) * (p >= 0.25 && p < 0.5 ? 60 : 15);

                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.quadraticCurveTo(mx, my, b.x, b.y);
                        ctx.strokeStyle = p >= 0.25 && p < 0.5 
                            ? `rgba(139, 53, 214, ${alpha})` // purple lines in crisis
                            : `rgba(200, 169, 110, ${alpha})`; // weathered gold elsewhere
                        ctx.lineWidth = p >= 0.25 && p < 0.5 ? 1.2 : 0.75;
                        ctx.stroke();
                    }
                }
            }

            // Draw nodes
            nodes.forEach(n => {
                ctx.beginPath();
                ctx.arc(n.x, n.y, p >= 0.25 && p < 0.5 ? 2.5 : 1.8, 0, Math.PI * 2);
                ctx.fillStyle = p >= 0.25 && p < 0.5 ? 'rgba(232,213,163,0.7)' : 'rgba(200, 169, 110, 0.45)';
                ctx.fill();
            });

            idxRef.current += 0.005;
            animRef.current = requestAnimationFrame(draw);
        };

        const idxRef = { current: 0 };
        draw();

        return () => {
            st.kill();
            cancelAnimationFrame(animRef.current);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
        />
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Spaghetti Crisis Visualizer
// ─────────────────────────────────────────────────────────────────────────────

function SpaghettiVisualizer() {
    const [crisisMode, setCrisisMode] = useState<boolean>(true);
    const [alerts, setAlerts] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (crisisMode) {
            const timer = setInterval(() => {
                const msgs = [
                    "GitHub API: 403 Rate Limit Exceeded",
                    "Jira Auth: Expired OAuth Token",
                    "Slack Webhook: Connection Timeout",
                    "System: Incompatible JSON Schema Change",
                    "Error: Broken Pipeline Dependency"
                ];
                setAlerts(prev => [msgs[Math.floor(Math.random() * msgs.length)], ...prev.slice(0, 2)]);
            }, 2500);
            return () => clearInterval(timer);
        } else {
            setAlerts([]);
        }
    }, [crisisMode]);

    return (
        <div 
            ref={containerRef}
            style={{
                width: '100%', maxWidth: 720, background: 'rgba(10, 7, 24, 0.85)',
                border: crisisMode ? '1px dashed rgba(248, 113, 113, 0.3)' : '1px solid rgba(200, 169, 110, 0.35)',
                borderRadius: 20, padding: 24, position: 'relative', overflow: 'hidden',
                boxShadow: crisisMode ? '0 10px 40px rgba(248, 113, 113, 0.08)' : '0 10px 40px rgba(74, 14, 143, 0.15)',
                transition: 'border-color 0.4s, box-shadow 0.4s'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontFamily: 'Cinzel, serif', color: crisisMode ? '#f87171' : '#E8D5A3', fontWeight: 600, letterSpacing: '0.05em' }}>
                    {crisisMode ? "CRITICAL: SPAGHETTI API MESH" : "RESOLVED: UNTANGLED VIA MOIRA"}
                </span>
                <button 
                    onClick={() => setCrisisMode(!crisisMode)}
                    style={{
                        padding: '6px 14px', fontSize: 11, fontWeight: 700, borderRadius: 8,
                        background: crisisMode ? 'linear-gradient(135deg, #4A0E8F, #8B35D6)' : 'rgba(248, 113, 113, 0.15)',
                        border: '1px solid rgba(200, 169, 110, 0.25)', color: '#F0EBF8', cursor: 'pointer',
                        fontFamily: 'Cinzel, serif', transition: 'all 0.3s'
                    }}
                >
                    {crisisMode ? "Apply MOIRA Loom" : "Induce API Chaos"}
                </button>
            </div>

            <div style={{ height: 260, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="100%" height="100%" viewBox="0 0 600 240" style={{ position: 'absolute', inset: 0 }}>
                    {/* Background Grid */}
                    <defs>
                        <pattern id="spag-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#spag-grid)" />

                    {/* API Connections */}
                    {crisisMode ? (
                        <>
                            {/* Chaos lines */}
                            <path d="M50 50 Q 250 190 350 40" fill="none" stroke="#f87171" strokeWidth="1.5" strokeDasharray="3 3" />
                            <path d="M350 40 Q 400 220 520 60" fill="none" stroke="#f87171" strokeWidth="1" />
                            <path d="M520 60 Q 200 40 50 180" fill="none" stroke="#f87171" strokeWidth="1.5" />
                            <path d="M50 180 Q 200 220 520 180" fill="none" stroke="#f87171" strokeWidth="1" strokeDasharray="4 2" />
                            <path d="M520 180 Q 300 20 50 50" fill="none" stroke="#f87171" strokeWidth="1.2" />
                            <path d="M180 120 Q 320 30 520 60" fill="none" stroke="#f87171" strokeWidth="1" />
                            <path d="M50 180 Q 350 120 350 40" fill="none" stroke="#f87171" strokeWidth="1.5" />
                        </>
                    ) : (
                        <>
                            {/* Clean orchestration paths */}
                            <path d="M50 50 L 300 120" fill="none" stroke="#C8A96E" strokeWidth="2" opacity="0.6" />
                            <path d="M50 180 L 300 120" fill="none" stroke="#C8A96E" strokeWidth="2" opacity="0.6" />
                            <path d="M300 120 L 520 60" fill="none" stroke="#C8A96E" strokeWidth="2" opacity="0.6" />
                            <path d="M300 120 L 520 180" fill="none" stroke="#C8A96E" strokeWidth="2" opacity="0.6" />
                            
                            {/* Pulsing signal dots */}
                            <circle cx="300" cy="120" r="4" fill="#E8D5A3">
                                <animate attributeName="r" values="3;9;3" dur="2s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                            </circle>
                        </>
                    )}

                    {/* Nodes representing tools */}
                    <g transform="translate(50, 50)">
                        <circle r="22" fill="#080610" stroke={crisisMode ? "#f87171" : "#C8A96E"} strokeWidth="1.5" />
                        <text y="5" textAnchor="middle" fill="#F0EBF8" fontSize="10" fontFamily="Cinzel, serif">GitHub</text>
                    </g>
                    <g transform="translate(50, 180)">
                        <circle r="22" fill="#080610" stroke={crisisMode ? "#f87171" : "#C8A96E"} strokeWidth="1.5" />
                        <text y="5" textAnchor="middle" fill="#F0EBF8" fontSize="10" fontFamily="Cinzel, serif">Jira</text>
                    </g>
                    <g transform="translate(520, 60)">
                        <circle r="22" fill="#080610" stroke={crisisMode ? "#f87171" : "#C8A96E"} strokeWidth="1.5" />
                        <text y="5" textAnchor="middle" fill="#F0EBF8" fontSize="10" fontFamily="Cinzel, serif">Slack</text>
                    </g>
                    <g transform="translate(520, 180)">
                        <circle r="22" fill="#080610" stroke={crisisMode ? "#f87171" : "#C8A96E"} strokeWidth="1.5" />
                        <text y="5" textAnchor="middle" fill="#F0EBF8" fontSize="10" fontFamily="Cinzel, serif">Sheets</text>
                    </g>

                    {!crisisMode && (
                        <g transform="translate(300, 120)">
                            <circle r="28" fill="#4A0E8F" stroke="#C8A96E" strokeWidth="2" />
                            <text y="5" textAnchor="middle" fill="#E8D5A3" fontSize="11" fontWeight="700" fontFamily="Cinzel, serif">MOIRA</text>
                        </g>
                    )}
                </svg>

                {/* Floating alert flags in crisis mode */}
                {crisisMode && (
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                        <AnimatePresence>
                            {alerts.map((alert, i) => (
                                <motion.div
                                    key={alert + i}
                                    initial={{ opacity: 0, scale: 0.8, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.8, y: -15 }}
                                    transition={{ duration: 0.4 }}
                                    style={{
                                        position: 'absolute',
                                        top: 30 + (i * 50),
                                        left: i % 2 === 0 ? '15%' : '50%',
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                        padding: '5px 12px', borderRadius: 6,
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        color: '#fca5a5', fontSize: 11, fontWeight: 500
                                    }}
                                >
                                    <AlertTriangle size={12} />
                                    {alert}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive MCP Packet Visualizer
// ─────────────────────────────────────────────────────────────────────────────

function MCPPacketVisualizer() {
    const [selectedTool, setSelectedTool] = useState<string>("create_issue");
    const [payloadText, setPayloadText] = useState<string>("");
    const [step, setStep] = useState<number>(0);
    const [animating, setAnimating] = useState<boolean>(false);

    const payloadMap: Record<string, { req: string; res: string }> = {
        create_issue: {
            req: `{\n  "method": "tools/call",\n  "params": {\n    "name": "create_issue",\n    "arguments": {\n      "repo": "owner/repo",\n      "title": "Fix memory leak",\n      "body": "Profile runs show growth in ws pool..."\n    }\n  }\n}`,
            res: `{\n  "result": {\n    "content": [\n      {\n        "type": "text",\n        "text": "Issue #42 created successfully: https://github.com/..."\n      }\n    ]\n  }\n}`
        },
        post_message: {
            req: `{\n  "method": "tools/call",\n  "params": {\n    "name": "post_message",\n    "arguments": {\n      "channel": "#general",\n      "text": "🔮 MOIRA: Workflow step completed successfully."\n    }\n  }\n}`,
            res: `{\n  "result": {\n    "content": [\n      {\n        "type": "text",\n        "text": "Message posted successfully to channel #general."\n      }\n    ]\n  }\n}`
        },
        append_row: {
            req: `{\n  "method": "tools/call",\n  "params": {\n    "name": "append_row",\n    "arguments": {\n      "spreadsheet_id": "1GevBw5...",\n      "values": ["2026-06-22", "dev-user-id", "Success"]\n    }\n  }\n}`,
            res: `{\n  "result": {\n    "content": [\n      {\n        "type": "text",\n        "text": "Appended row successfully to range Sheet1!A:C."\n      }\n    ]\n  }\n}`
        }
    };

    useEffect(() => {
        setPayloadText(payloadMap[selectedTool].req);
        setStep(0);
    }, [selectedTool]);

    const runTransmission = () => {
        if (animating) return;
        setAnimating(true);
        setStep(1); // Packet starts moving to Orchestrator

        setTimeout(() => {
            setStep(2); // Packet reaches Server
            setPayloadText(payloadMap[selectedTool].res);
        }, 1500);

        setTimeout(() => {
            setStep(3); // Packet returns to Client
        }, 3000);

        setTimeout(() => {
            setStep(0);
            setPayloadText(payloadMap[selectedTool].req);
            setAnimating(false);
        }, 4500);
    };

    return (
        <div style={{
            width: '100%', maxWidth: 720, background: 'rgba(10, 7, 24, 0.85)',
            border: '1px solid rgba(200, 169, 110, 0.15)', borderRadius: 20, padding: 24,
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <span style={{ fontSize: 13, fontFamily: 'Cinzel, serif', color: '#E8D5A3', fontWeight: 600, letterSpacing: '0.05em' }}>
                    MCP SCHEMA TRANSACTION VISUALIZER
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                    {["create_issue", "post_message", "append_row"].map(t => (
                        <button
                            key={t}
                            onClick={() => !animating && setSelectedTool(t)}
                            disabled={animating}
                            style={{
                                padding: '5px 10px', fontSize: 10, borderRadius: 6,
                                background: selectedTool === t ? 'rgba(200,169,110,0.12)' : 'transparent',
                                border: selectedTool === t ? '1px solid #C8A96E' : '1px solid rgba(200,169,110,0.1)',
                                color: selectedTool === t ? '#E8D5A3' : 'rgba(240,235,248,0.4)',
                                cursor: animating ? 'default' : 'pointer', transition: 'all 0.2s',
                                fontFamily: 'Cinzel, serif'
                            }}
                        >
                            {t.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, minHeight: 280, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Visual diagram */}
                <div style={{ position: 'relative', height: 260, border: '1px solid rgba(255,255,255,0.03)', borderRadius: 12, background: 'rgba(5,3,12,0.4)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 20 }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%', position: 'relative' }}>
                        {/* Wire line */}
                        <div style={{ position: 'absolute', left: 40, right: 40, height: 1, background: 'rgba(200,169,110,0.15)', zIndex: 0 }} />

                        {/* Client Node */}
                        <div style={{ zIndex: 1, textAlign: 'center' }}>
                            <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(13,9,32,0.9)', border: '1.5px solid #C8A96E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C8A96E' }}>
                                <Globe size={20} />
                            </div>
                            <span style={{ fontSize: 10, display: 'block', marginTop: 8, color: 'rgba(240,235,248,0.5)', fontFamily: 'Cinzel, serif' }}>Client</span>
                        </div>

                        {/* Orchestrator Node */}
                        <div style={{ zIndex: 1, textAlign: 'center' }}>
                            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#4A0E8F', border: '2px solid #E8D5A3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8D5A3', boxShadow: '0 0 20px rgba(139,53,214,0.4)' }}>
                                <text style={{ fontFamily: 'Cinzel, serif', fontWeight: 900, fontSize: 18 }}>Ω</text>
                            </div>
                            <span style={{ fontSize: 10, display: 'block', marginTop: 8, color: '#E8D5A3', fontFamily: 'Cinzel, serif' }}>MOIRA</span>
                        </div>

                        {/* Server Node */}
                        <div style={{ zIndex: 1, textAlign: 'center' }}>
                            <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(13,9,32,0.9)', border: '1.5px solid #C8A96E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C8A96E' }}>
                                <Code2 size={20} />
                            </div>
                            <span style={{ fontSize: 10, display: 'block', marginTop: 8, color: 'rgba(240,235,248,0.5)', fontFamily: 'Cinzel, serif' }}>Server</span>
                        </div>

                        {/* Transmission Packet (Animate using simple absolute positions based on step state) */}
                        {step > 0 && (
                            <motion.div
                                animate={
                                    step === 1 ? { left: [40, 160], top: [110, 105] } :
                                    step === 2 ? { left: [160, 270], top: [105, 110] } :
                                    { left: [270, 40], top: [110, 110] }
                                }
                                transition={{ duration: 1.5, ease: 'easeInOut' }}
                                style={{
                                    position: 'absolute', width: 10, height: 10, borderRadius: '50%',
                                    background: '#E8D5A3', zIndex: 2,
                                    boxShadow: '0 0 12px #E8D5A3, 0 0 24px #C8A96E'
                                }}
                            />
                        )}
                    </div>

                    <button
                        onClick={runTransmission}
                        disabled={animating}
                        style={{
                            width: '100%', padding: '10px 0', borderRadius: 8,
                            background: animating ? 'rgba(200,169,110,0.05)' : 'linear-gradient(135deg, #4A0E8F, #8B35D6)',
                            border: '1px solid rgba(200,169,110,0.25)', color: '#F0EBF8',
                            fontSize: 12, fontWeight: 700, cursor: animating ? 'default' : 'pointer',
                            fontFamily: 'Cinzel, serif', transition: 'all 0.3s'
                        }}
                    >
                        {animating ? "Packet Transmitting..." : "Send Request Packet"}
                    </button>
                </div>

                {/* Code payload display */}
                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', top: -10, right: 10, fontSize: 9, color: 'rgba(200,169,110,0.4)', fontFamily: 'monospace' }}>
                        {step === 2 ? "RESPONSE_JSON" : "REQUEST_JSON"}
                    </div>
                    <pre style={{
                        margin: 0, padding: '16px 14px', borderRadius: 12,
                        background: '#05030c', border: '1px solid rgba(200,169,110,0.08)',
                        color: 'rgba(240,235,248,0.7)', fontSize: 10.5, fontFamily: 'monospace',
                        overflowX: 'auto', minHeight: 220, lineHeight: 1.5
                    }}><code>{payloadText}</code></pre>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Play Sandbox (Visualizer + Terminal Mock)
// ─────────────────────────────────────────────────────────────────────────────

interface SandboxStep { name: string; connector: string; status: 'pending' | 'active' | 'success' | 'failed' }

function SandboxPlayground() {
    const [activePreset, setActivePreset] = useState<number | null>(null);
    const [promptText, setPromptText] = useState<string>("");
    const [running, setRunning] = useState<boolean>(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [steps, setSteps] = useState<SandboxStep[]>([]);
    const [showApproval, setShowApproval] = useState<boolean>(false);

    const logTimeoutRef = useRef<number[]>([]);

    const presets = [
        {
            title: "Onboard Employee Dev Patel",
            prompt: "Onboard new hire Dev Patel: Create GitHub branch, create Jira ticket, and post notification to Slack.",
            steps: [
                { name: "Create Jira Ticket", connector: "jira", status: "pending" },
                { name: "Create Git Branch", connector: "github", status: "pending" },
                { name: "Post Slack Alert", connector: "slack", status: "pending" }
            ],
            logs: [
                "[ORACLE] Intent Parse: EXECUTE_WORKFLOW",
                "[PLANNER] Weaving graph dependencies...",
                "[EXECUTOR] Triggering Act I: Execution starts",
                "[EXECUTOR] Step 1/3: jira.create_issue -> Parameters: {summary: 'Onboard Dev Patel'}",
                "[JIRA] Issue created: JIRA-8402 (Connected as Dev Patel)",
                "[EXECUTOR] Step 2/3: github.create_branch -> Parameters: {branch_name: 'dev-patel-onboarding'}",
                "[GITHUB] Branch refs/heads/dev-patel-onboarding created successfully",
                "[EXECUTOR] Step 3/3: slack.post_message (Approval Required)",
                "!!WAITING_APPROVAL!!",
                "[SLACK] Message sent to channel #general: 'Dev Patel successfully onboarded!'",
                "[AUDITOR] Appending workflow run record to Google Sheets ID: 1GevBw5...",
                "[SHEETS] Appended row to Sheet1 range A2:E2 successfully",
                "[ORACLE] Fate decree executed successfully in 3.4s"
            ]
        },
        {
            title: "Post Weather Update",
            prompt: "Get current weather in Seoul and post a formatted summary to Slack.",
            steps: [
                { name: "Forge Weather API Tool", connector: "synthesized", status: "pending" },
                { name: "Get Weather Data", connector: "openweather", status: "pending" },
                { name: "Post Slack Summary", connector: "slack", status: "pending" }
            ],
            logs: [
                "[ORACLE] Intent Parse: EXECUTE_WORKFLOW",
                "[PLANNER] Gap detected: No weather connector available.",
                "[SYNTHESIZER] Act II: Triggering Forge Engine...",
                "[SYNTHESIZER] Synthesizing python file: backend/connectors/synthesized/openweather.py",
                "[SYNTHESIZER] Streaming code lines... [100% compile pass]",
                "[SYNTHESIZER] Registering synthesized tool: openweather.get_weather",
                "[EXECUTOR] Step 1/3: openweather.get_weather -> Parameters: {city: 'Seoul'}",
                "[WEATHER] Query response: Temp 24C, Clear Sky",
                "[EXECUTOR] Step 2/3: slack.post_message -> Parameters: {text: 'Social post: Weather in Seoul is Clear...'}",
                "[SLACK] Message sent to channel #social successfully",
                "[AUDITOR] Appending workflow run record to Google Sheets ID: 1GevBw5...",
                "[SHEETS] Audit record written successfully",
                "[ORACLE] Fate decree executed successfully in 4.8s"
            ]
        }
    ];

    const runPreset = (idx: number) => {
        if (running) return;
        setRunning(true);
        setActivePreset(idx);
        setPromptText(presets[idx].prompt);
        setLogs([]);
        setSteps(presets[idx].steps.map(s => ({ ...s, status: 'pending' as const })));
        setShowApproval(false);

        // Cancel previous timeouts if any
        logTimeoutRef.current.forEach(clearTimeout);
        logTimeoutRef.current = [];

        let currentLogIndex = 0;
        const allLogs = presets[idx].logs;

        const processNextLog = () => {
            if (currentLogIndex >= allLogs.length) {
                setRunning(false);
                return;
            }

            const line = allLogs[currentLogIndex];

            if (line === "!!WAITING_APPROVAL!!") {
                setShowApproval(true);
                return; // Stop log streaming until clicked
            }

            setLogs(prev => [...prev, line]);

            // Update step statuses based on log content
            if (line.includes("Step 1/3")) {
                setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'active' as const } : s));
            } else if (line.includes("Step 2/3") || line.includes("JIRA") || line.includes("WEATHER")) {
                setSteps(prev => prev.map((s, i) => {
                    if (i === 0) return { ...s, status: 'success' as const };
                    if (i === 1) return { ...s, status: 'active' as const };
                    return s;
                }));
            } else if (line.includes("Step 3/3") || line.includes("GITHUB")) {
                setSteps(prev => prev.map((s, i) => {
                    if (i === 1) return { ...s, status: 'success' as const };
                    if (i === 2) return { ...s, status: 'active' as const };
                    return s;
                }));
            } else if (line.includes("decree executed")) {
                setSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'success' as const } : s));
            }

            currentLogIndex++;
            const tid = window.setTimeout(processNextLog, 600);
            logTimeoutRef.current.push(tid);
        };

        const firstTid = window.setTimeout(processNextLog, 400);
        logTimeoutRef.current.push(firstTid);

        // Save resume trigger context in window object briefly
        (window as any)._resumeSandbox = () => {
            setShowApproval(false);
            setLogs(prev => [...prev, "[APPROVAL] Gate Authorized by Weaver"]);
            currentLogIndex++;
            processNextLog();
        };
    };

    return (
        <div style={{
            width: '100%', maxWidth: 1000, background: 'rgba(10,6,22,0.9)',
            border: '1px solid rgba(200,169,110,0.18)', borderRadius: 24, overflow: 'hidden',
            boxShadow: '0 40px 120px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column'
        }}>
            {/* Header / Presets bar */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(200,169,110,0.08)', background: 'rgba(5,3,12,0.5)', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontFamily: 'Cinzel, serif', color: '#C8A96E', fontWeight: 700, letterSpacing: '0.04em' }}>
                    SELECT ORACLE TEMPLATE:
                </span>
                {presets.map((p, idx) => (
                    <button
                        key={idx}
                        onClick={() => runPreset(idx)}
                        disabled={running}
                        style={{
                            padding: '8px 16px', fontSize: 11, borderRadius: 8,
                            background: activePreset === idx ? 'rgba(200,169,110,0.15)' : 'rgba(255,255,255,0.02)',
                            border: activePreset === idx ? '1px solid #C8A96E' : '1px solid rgba(255,255,255,0.05)',
                            color: activePreset === idx ? '#E8D5A3' : 'rgba(240,235,248,0.5)',
                            cursor: running ? 'not-allowed' : 'pointer', fontFamily: 'Cinzel, serif',
                            transition: 'all 0.2s'
                        }}
                    >
                        {p.title}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', minHeight: 320, flexWrap: 'wrap' }}>
                {/* Left panel: Simulated visualizer */}
                <div style={{ padding: 24, borderRight: '1px solid rgba(200,169,110,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 300 }}>
                    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: 12, marginBottom: 16 }}>
                        <span style={{ fontSize: 11, color: 'rgba(200,169,110,0.4)', fontFamily: 'monospace' }}>MOCK_DAG_FLOW</span>
                        <input
                            type="text"
                            value={promptText}
                            readOnly
                            placeholder="Select a template above..."
                            style={{
                                width: '100%', background: 'transparent', border: 'none',
                                color: '#F0EBF8', fontSize: 14, marginTop: 8, outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center', flex: 1 }}>
                        {steps.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'rgba(200,169,110,0.25)', fontSize: 13, padding: '40px 0', fontFamily: 'Cinzel, serif' }}>
                                Initiate a template run above to weave the DAG graph...
                            </div>
                        ) : (
                            steps.map((s, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 24, height: 24, borderRadius: '50%',
                                        background: s.status === 'success' ? '#4A0E8F' : s.status === 'active' ? 'rgba(200,169,110,0.1)' : 'transparent',
                                        border: s.status === 'success' ? '1px solid #C8A96E' : s.status === 'active' ? '1.5px solid #C8A96E' : '1px solid rgba(255,255,255,0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: s.status === 'success' ? '#E8D5A3' : 'rgba(240,235,248,0.4)',
                                        fontSize: 10, fontWeight: 700
                                    }}>
                                        {s.status === 'success' ? <Check size={12} /> : idx + 1}
                                    </div>
                                    <div style={{
                                        flex: 1, padding: '10px 16px', borderRadius: 10,
                                        background: s.status === 'active' ? 'rgba(74,14,143,0.12)' : 'rgba(255,255,255,0.02)',
                                        border: s.status === 'active' ? '1px solid rgba(200,169,110,0.3)' : '1px solid rgba(255,255,255,0.04)',
                                        color: s.status === 'success' ? 'rgba(240,235,248,0.8)' : 'rgba(240,235,248,0.4)',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}>
                                        <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>
                                        <span style={{
                                            fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em',
                                            color: s.status === 'success' ? '#86efac' : s.status === 'active' ? '#fde047' : 'rgba(240,235,248,0.2)'
                                        }}>
                                            {s.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right panel: Terminal mock */}
                <div style={{ background: '#05030c', padding: 20, display: 'flex', flexDirection: 'column', minHeight: 300 }}>
                    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 10, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: 'rgba(200,169,110,0.4)', fontFamily: 'monospace' }}>ORACLE_LIVE_STREAM</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171' }} />
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24' }} />
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11.5, lineHeight: 1.6, color: 'rgba(240,235,248,0.7)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {logs.map((log, i) => (
                            <div key={i} style={{
                                color: log.startsWith("!!") ? '#fca5a5' : log.includes("Decree") || log.includes("Act") ? '#E8D5A3' : 'rgba(240,235,248,0.7)',
                                borderLeft: log.includes("decree") ? '2.5px solid #86efac' : 'none',
                                paddingLeft: log.includes("decree") ? 8 : 0
                            }}>
                                {log}
                            </div>
                        ))}

                        {showApproval && (
                            <div style={{
                                marginTop: 14, padding: 14, background: 'rgba(200,169,110,0.06)',
                                border: '1px solid rgba(200,169,110,0.3)', borderRadius: 10,
                                textAlign: 'center'
                            }}>
                                <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#E8D5A3', fontFamily: 'Cinzel, serif' }}>
                                    ⚠️ DECISION GATE: Slack Post contains sensitive payload.
                                </p>
                                <button
                                    onClick={() => {
                                        if ((window as any)._resumeSandbox) (window as any)._resumeSandbox();
                                    }}
                                    style={{
                                        padding: '6px 16px', fontSize: 11, borderRadius: 6,
                                        background: 'linear-gradient(135deg, #4A0E8F, #8B35D6)',
                                        border: '1px solid rgba(200,169,110,0.3)', color: '#F0EBF8',
                                        cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 700
                                    }}
                                >
                                    Authorize Decree
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Wrapper with Scroll Reveal
// ─────────────────────────────────────────────────────────────────────────────

function RevealSection({ children, style, id }: { children: React.ReactNode; style?: React.CSSProperties; id?: string }) {
    const sectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = sectionRef.current;
        if (!el) return;

        gsap.fromTo(el, 
            { opacity: 0, y: 50 },
            { 
                opacity: 1, y: 0, duration: 0.8, ease: "power2.out",
                scrollTrigger: {
                    trigger: el,
                    start: "top 80%",
                    toggleActions: "play none none reverse"
                }
            }
        );
    }, []);

    return (
        <section ref={sectionRef} id={id} style={style}>
            {children}
        </section>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Label
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
    return (
        <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#C8A96E',
            fontFamily: 'Cinzel, serif', marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
            <span style={{ width: 24, height: 1, background: 'rgba(200,169,110,0.4)', display: 'inline-block' }} />
            {children}
            <span style={{ width: 24, height: 1, background: 'rgba(200,169,110,0.4)', display: 'inline-block' }} />
        </p>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Navbar
// ─────────────────────────────────────────────────────────────────────────────

function Navbar({ onGetStarted }: { onGetStarted: () => void }) {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const h = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', h);
        return () => window.removeEventListener('scroll', h);
    }, []);

    return (
        <motion.nav
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 30 }}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                padding: '0 5%',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                height: 64,
                background: scrolled ? 'rgba(8,6,16,0.92)' : 'transparent',
                backdropFilter: scrolled ? 'blur(20px)' : 'none',
                borderBottom: scrolled ? '1px solid rgba(200,169,110,0.1)' : 'none',
                transition: 'background 0.3s, border-color 0.3s',
            }}
        >
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24, fontFamily: 'Cinzel, serif', background: 'linear-gradient(135deg, #C8A96E, #E8D5A3)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700, letterSpacing: '0.08em' }}>Ω MOIRA</span>
            </div>

            {/* Nav links (desktop) */}
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                {['Crisis', 'MCP Standard', 'Working', 'Sandbox', 'Security', 'Creators'].map(link => (
                    <a key={link} href={`#${link.toLowerCase().replace(/ /g, '-')}`}
                        style={{ color: 'rgba(200,169,110,0.55)', fontSize: 13, textDecoration: 'none', letterSpacing: '0.04em', fontWeight: 500, transition: 'color 0.2s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#C8A96E')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(200,169,110,0.55)')}
                    >{link}</a>
                ))}
            </div>

            {/* CTA */}
            <div style={{ display: 'flex', gap: 10 }}>
                <motion.button onClick={onGetStarted}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, #4A0E8F, #8B35D6)', border: '1px solid rgba(200,169,110,0.25)', borderRadius: 9, color: '#F0EBF8', cursor: 'pointer', fontFamily: 'Cinzel, serif', letterSpacing: '0.04em' }}>
                    Get Started
                </motion.button>
            </div>
        </motion.nav>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Landing Page
// ─────────────────────────────────────────────────────────────────────────────

export function LandingPage() {
    const navigate = useNavigate();

    useEffect(() => {
        // Auto-redirect if already logged in
        const checkSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (data?.session) {
                try {
                    const { authFetch } = await import('../../lib/supabase');
                    const { config } = await import('../../config');
                    const resp = await authFetch(`${config.apiUrl}/auth/verify`, {
                        method: 'POST',
                        body: JSON.stringify({}),
                    });
                    if (resp.ok) {
                        const data2 = await resp.json();
                        const isComplete = data2?.onboarding?.is_complete;
                        navigate(isComplete ? '/app' : '/onboarding', { replace: true });
                    } else {
                        navigate('/app', { replace: true });
                    }
                } catch {
                    navigate('/app', { replace: true });
                }
            }
        };
        checkSession();
    }, [navigate]);

    const handleGetStarted = async () => {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
            try {
                const { authFetch } = await import('../../lib/supabase');
                const { config } = await import('../../config');
                const resp = await authFetch(`${config.apiUrl}/auth/verify`, {
                    method: 'POST',
                    body: JSON.stringify({}),
                });
                if (resp.ok) {
                    const data2 = await resp.json();
                    const isComplete = data2?.onboarding?.is_complete;
                    navigate(isComplete ? '/app' : '/onboarding');
                } else {
                    navigate('/app');
                }
            } catch {
                navigate('/app');
            }
        } else {
            navigate('/login');
        }
    };

    return (
        <div style={{ background: '#080610', color: '#F0EBF8', minHeight: '100vh', overflowX: 'hidden', fontFamily: 'Inter, sans-serif' }}>
            <Navbar onGetStarted={handleGetStarted} />
            <ThreadCanvas />

            {/* ════════════════════════════════════════════════════════════
                HERO
            ════════════════════════════════════════════════════════════ */}
            <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {/* Dark gradient overlays */}
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(74,14,143,0.15) 0%, transparent 75%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', background: 'linear-gradient(to top, #080610, transparent)', pointerEvents: 'none' }} />

                <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, padding: '100px 5% 40px' }}>
                    {/* Ω badge */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0, rotate: -180 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 180, damping: 20, delay: 0.1 }}
                        style={{ display: 'inline-block', marginBottom: 28 }}
                    >
                        <div style={{ position: 'relative', width: 110, height: 110, margin: '0 auto' }}>
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
                                style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(200,169,110,0.3)', borderTopColor: '#C8A96E' }} />
                            <motion.div animate={{ rotate: -360 }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
                                style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '1px solid rgba(139,53,214,0.2)', borderBottomColor: '#8B35D6' }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, fontFamily: 'Cinzel, serif', background: 'linear-gradient(135deg, #C8A96E, #E8D5A3)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>Ω</div>
                        </div>
                    </motion.div>

                    {/* Hero heading */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            fontSize: 'clamp(54px, 8vw, 100px)', fontWeight: 900,
                            fontFamily: 'Cinzel, serif', letterSpacing: '0.06em',
                            background: 'linear-gradient(135deg, #E8D5A3 0%, #C8A96E 40%, #F0EBF8 70%, #C8A96E 100%)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            margin: '0 0 16px', lineHeight: 1.05,
                        }}
                    >
                        MOIRA
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45, duration: 0.7 }}
                        style={{ fontSize: 'clamp(16px, 2.5vw, 22px)', color: 'rgba(200,169,110,0.7)', fontFamily: 'Cinzel, serif', letterSpacing: '0.08em', marginBottom: 16 }}
                    >
                        Ancient. Inevitable. Timeless.
                    </motion.p>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        style={{ fontSize: 'clamp(14px, 1.8vw, 17px)', color: 'rgba(240,235,248,0.45)', maxWidth: 640, margin: '0 auto 40px', lineHeight: 1.7 }}
                    >
                        The Greek Goddess of Fate, reborn as an intelligent Model Context Protocol (MCP) orchestrator. Weave APIs, local tools, and databases into secure, self-healing graphs through natural language.
                    </motion.p>

                    {/* CTA buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.75 }}
                        style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}
                    >
                        <motion.button onClick={handleGetStarted}
                            whileHover={{ scale: 1.04, boxShadow: '0 0 40px rgba(200,169,110,0.25)' }}
                            whileTap={{ scale: 0.97 }}
                            style={{ padding: '14px 36px', fontSize: 16, fontWeight: 700, background: 'linear-gradient(135deg, #4A0E8F, #8B35D6)', border: '1px solid rgba(200,169,110,0.3)', borderRadius: 12, color: '#F0EBF8', cursor: 'pointer', fontFamily: 'Cinzel, serif', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 8 }}>
                            Step Into Fate <ArrowRight size={18} />
                        </motion.button>
                        <motion.button onClick={handleGetStarted}
                            whileHover={{ scale: 1.04, borderColor: 'rgba(200,169,110,0.5)' }}
                            whileTap={{ scale: 0.97 }}
                            style={{ padding: '14px 32px', fontSize: 16, fontWeight: 600, background: 'rgba(200,169,110,0.05)', border: '1px solid rgba(200,169,110,0.2)', borderRadius: 12, color: '#C8A96E', cursor: 'pointer', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 8 }}>
                            Developer Login
                        </motion.button>
                    </motion.div>

                    {/* Scroll indicator */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.4 }}
                        style={{ marginTop: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                    >
                        <p style={{ fontSize: 11, color: 'rgba(200,169,110,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Cinzel, serif' }}>Scroll to explore the documentary</p>
                        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
                            <ChevronDown size={18} color="rgba(200,169,110,0.35)" />
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════════
                THE CRISIS (Spaghetti API Mesh)
            ════════════════════════════════════════════════════════════ */}
            <RevealSection id="crisis" style={{ padding: 'clamp(60px, 8vw, 100px) 5%', background: 'rgba(74,14,143,0.01)', borderTop: '1px solid rgba(200,169,110,0.07)' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'clamp(40px, 6vw, 80px)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                        <SectionLabel>The Problem</SectionLabel>
                        <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#E8D5A3', marginBottom: 20, lineHeight: 1.15 }}>
                            The API Spaghetti Crisis
                        </h2>
                        <p style={{ color: 'rgba(240,235,248,0.7)', fontSize: 15.5, lineHeight: 1.8, marginBottom: 20 }}>
                            Modern enterprise pipelines are held together by digital duct tape. Developers spend hundreds of hours writing ad-hoc script integrations, parsing mismatched JSON payloads, and managing authentication tokens across distinct SDKs.
                        </p>
                        <p style={{ color: 'rgba(240,235,248,0.45)', fontSize: 14.5, lineHeight: 1.8, marginBottom: 0 }}>
                            When one schema changes, or a token expires, the entire pipeline crashes silently, leading to cascading failures, data loss, and debugging nightmares.
                        </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <SpaghettiVisualizer />
                    </div>
                </div>
            </RevealSection>

            {/* ════════════════════════════════════════════════════════════
                THE STANDARD (MCP Protocol)
            ════════════════════════════════════════════════════════════ */}
            <RevealSection id="mcp-standard" style={{ padding: 'clamp(60px, 8vw, 100px) 5%', background: 'rgba(5, 3, 12, 0.4)', borderTop: '1px solid rgba(200,169,110,0.07)' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 'clamp(40px, 6vw, 80px)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', order: window.innerWidth < 768 ? 2 : 1 }}>
                        <MCPPacketVisualizer />
                    </div>
                    <div style={{ order: window.innerWidth < 768 ? 1 : 2 }}>
                        <SectionLabel>The Protocol</SectionLabel>
                        <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#E8D5A3', marginBottom: 20, lineHeight: 1.15 }}>
                            Model Context Protocol
                        </h2>
                        <p style={{ color: 'rgba(240,235,248,0.7)', fontSize: 15.5, lineHeight: 1.8, marginBottom: 20 }}>
                            Model Context Protocol (MCP) is an open standard that decouples LLMs from custom tool bindings. Instead of implementing custom SDK wrappers, developers define standard client-server interfaces where LLMs can query schemas, run commands, and read resources securely.
                        </p>
                        <p style={{ color: 'rgba(240,235,248,0.45)', fontSize: 14.5, lineHeight: 1.8, marginBottom: 0 }}>
                            MOIRA acts as the central orchestrator, listening to your intent, planning execution blocks, synthesizing missing connectors, and running operations across these standard interfaces.
                        </p>
                    </div>
                </div>
            </RevealSection>

            {/* ════════════════════════════════════════════════════════════
                THE DOCUMENTARY (How MOIRA Works - 4 Acts)
            ════════════════════════════════════════════════════════════ */}
            <RevealSection id="working" style={{ padding: 'clamp(80px, 10vw, 120px) 5%', background: 'rgba(74,14,143,0.02)', borderTop: '1px solid rgba(200,169,110,0.07)' }}>
                <div style={{ textAlign: 'center', marginBottom: 64 }}>
                    <SectionLabel>Under the Hood</SectionLabel>
                    <h2 style={{ fontSize: 'clamp(32px, 5vw, 54px)', fontFamily: 'Cinzel, serif', fontWeight: 900, color: '#E8D5A3' }}>
                        The Weaving of Fate
                    </h2>
                    <p style={{ color: 'rgba(240,235,248,0.4)', fontSize: 16, maxWidth: 600, margin: '16px auto 0', lineHeight: 1.6 }}>
                        A deep dive documentary detailing the 4 acts of MOIRA's runtime execution.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 64, maxWidth: 1000, margin: '0 auto' }}>
                    {/* ACT I */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#C8A96E', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em' }}>ACT I</span>
                            <h3 style={{ fontSize: 24, fontWeight: 700, color: '#E8D5A3', fontFamily: 'Cinzel, serif', marginTop: 8, marginBottom: 16 }}>
                                Intent parsing
                            </h3>
                            <p style={{ fontSize: 14.5, color: 'rgba(240,235,248,0.7)', lineHeight: 1.8 }}>
                                When a command is submitted, MOIRA's LLM engine parses the text to determine intent. If it's a simple query, it responds in conversational Chat mode. If it requires API interaction, it flags it as an execution workflow and identifies the required tools.
                            </p>
                        </div>
                        <pre style={{
                            margin: 0, padding: 16, borderRadius: 12, background: '#05030c',
                            border: '1px solid rgba(200, 169, 110, 0.1)', overflowX: 'auto',
                            fontSize: 11, color: 'rgba(240,235,248,0.6)', lineHeight: 1.5
                        }}><code>{`# Intent Classification Prompt
system_prompt = """
Is the user asking for direct knowledge (CHAT) or automated workflow (EXECUTE)?
User: "Onboard new hire Dev Patel in GitHub and Slack"
"""

# Output structure
{
  "intent": "EXECUTE",
  "connectors_required": ["github", "slack"]
}`}</code></pre>
                    </div>

                    {/* ACT II */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ order: window.innerWidth < 768 ? 2 : 1 }}>
                            <pre style={{
                                margin: 0, padding: 16, borderRadius: 12, background: '#05030c',
                                border: '1px solid rgba(200, 169, 110, 0.1)', overflowX: 'auto',
                                fontSize: 11, color: 'rgba(240,235,248,0.6)', lineHeight: 1.5
                            }}><code>{`class WeatherConnector(MCPConnector):
    # Synthesized on-the-fly by MOIRA
    async def get_weather(self, city: str):
        url = f"https://api.openweathermap.org/data/2.5/weather"
        async with httpx.AsyncClient() as client:
            r = await client.get(url, params={"q": city})
            return r.json()`}</code></pre>
                        </div>
                        <div style={{ order: window.innerWidth < 768 ? 1 : 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#C8A96E', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em' }}>ACT II</span>
                            <h3 style={{ fontSize: 24, fontWeight: 700, color: '#E8D5A3', fontFamily: 'Cinzel, serif', marginTop: 8, marginBottom: 16 }}>
                                Tool Synthesis
                            </h3>
                            <p style={{ fontSize: 14.5, color: 'rgba(240,235,248,0.7)', lineHeight: 1.8 }}>
                                If a required connector or tool does not exist in the registry (e.g. OpenWeather), MOIRA's **Thread Synthesis Engine** fetches the API's OpenAPI schema, writes python connector classes dynamically on-the-fly, compiles them, and hot-loads them into memory instantly.
                            </p>
                        </div>
                    </div>

                    {/* ACT III */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#C8A96E', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em' }}>ACT III</span>
                            <h3 style={{ fontSize: 24, fontWeight: 700, color: '#E8D5A3', fontFamily: 'Cinzel, serif', marginTop: 8, marginBottom: 16 }}>
                                Graph Weaving (DAG)
                            </h3>
                            <p style={{ fontSize: 14.5, color: 'rgba(240,235,248,0.7)', lineHeight: 1.8 }}>
                                With all tools in hand, the planner arranges the workflow into a Directed Acyclic Graph (DAG). It resolves input/output dependencies (e.g. using the Jira Ticket URL returned in step 1 as an input parameter for the Slack message in step 2), ensuring a clean logic path.
                            </p>
                        </div>
                        <pre style={{
                            margin: 0, padding: 16, borderRadius: 12, background: '#05030c',
                            border: '1px solid rgba(200, 169, 110, 0.1)', overflowX: 'auto',
                            fontSize: 11, color: 'rgba(240,235,248,0.6)', lineHeight: 1.5
                        }}><code>{`# Synthesized DAG Structure
{
  "workflow_id": "wf-840a32",
  "steps": {
    "1": { "tool": "jira.create_issue", "dependencies": [] },
    "2": { 
       "tool": "slack.post_message", 
       "dependencies": ["1"],
       "inputs": { "text": "Jira ticket created: {{steps.1.output.url}}" }
    }
  }
}`}</code></pre>
                    </div>

                    {/* ACT IV */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ order: window.innerWidth < 768 ? 2 : 1 }}>
                            <div style={{ border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, background: '#05030c', padding: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#E8D5A3', fontSize: 12, fontWeight: 600, fontFamily: 'Cinzel, serif', marginBottom: 12 }}>
                                    <BarChart3 size={14} /> LIVE SPREADSHEET AUDIT LOG
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, fontFamily: 'monospace', color: 'rgba(240,235,248,0.6)' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            <th style={{ textAlign: 'left', padding: '6px 4px' }}>TIMESTAMP</th>
                                            <th style={{ textAlign: 'left', padding: '6px 4px' }}>USER</th>
                                            <th style={{ textAlign: 'left', padding: '6px 4px' }}>WORKFLOW</th>
                                            <th style={{ textAlign: 'left', padding: '6px 4px' }}>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '6px 4px' }}>2026-06-22 08:33:29</td>
                                            <td style={{ padding: '6px 4px' }}>dev-user-id</td>
                                            <td style={{ padding: '6px 4px' }}>Onboard Hire</td>
                                            <td style={{ padding: '6px 4px', color: '#86efac' }}>SUCCESS</td>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: '6px 4px' }}>2026-06-22 08:14:12</td>
                                            <td style={{ padding: '6px 4px' }}>dev-user-id</td>
                                            <td style={{ padding: '6px 4px' }}>Post Weather</td>
                                            <td style={{ padding: '6px 4px', color: '#86efac' }}>SUCCESS</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div style={{ order: window.innerWidth < 768 ? 1 : 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#C8A96E', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em' }}>ACT IV</span>
                            <h3 style={{ fontSize: 24, fontWeight: 700, color: '#E8D5A3', fontFamily: 'Cinzel, serif', marginTop: 8, marginBottom: 16 }}>
                                Oracle Execution
                            </h3>
                            <p style={{ fontSize: 14.5, color: 'rgba(240,235,248,0.7)', lineHeight: 1.8 }}>
                                The **FastAPI/Redis execution core** runs the DAG. Steps with met dependencies execute in parallel. For destructive operations, execution pauses at human approval gates. Finally, a complete execution summary is written to a designated Google Sheet, creating an audit log.
                            </p>
                        </div>
                    </div>
                </div>
            </RevealSection>

            {/* ════════════════════════════════════════════════════════════
                SANDBOX PLAYGROUND
            ════════════════════════════════════════════════════════════ */}
            <RevealSection id="sandbox" style={{ padding: 'clamp(60px, 8vw, 100px) 5%', background: 'rgba(5, 3, 12, 0.4)', borderTop: '1px solid rgba(200, 169, 110, 0.07)' }}>
                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <SectionLabel>Interactive Sandbox</SectionLabel>
                    <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#E8D5A3' }}>
                        Test the Loom of Fate
                    </h2>
                    <p style={{ color: 'rgba(240,235,248,0.4)', fontSize: 15, maxWidth: 500, margin: '12px auto 0', lineHeight: 1.6 }}>
                        Select a prompt template below to watch how MOIRA plans, pauses, and executes graphs in real-time.
                    </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <SandboxPlayground />
                </div>
            </RevealSection>

            {/* ════════════════════════════════════════════════════════════
                SECURITY (Citadel)
            ════════════════════════════════════════════════════════════ */}
            <RevealSection id="security" style={{ padding: 'clamp(60px, 8vw, 100px) 5%', background: 'rgba(74,14,143,0.01)', borderTop: '1px solid rgba(200, 169, 110, 0.07)' }}>
                <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 48 }}>
                        <SectionLabel>Security Model</SectionLabel>
                        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#E8D5A3' }}>
                            The Security Citadel
                        </h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                        <div style={{ background: 'rgba(10,7,24,0.8)', border: '1px solid rgba(200,169,110,0.1)', borderRadius: 16, padding: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#C8A96E', fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: 15, marginBottom: 14 }}>
                                <Lock size={16} /> Row-Level Security
                            </div>
                            <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(240,235,248,0.45)', lineHeight: 1.7 }}>
                                Supabase PostgreSQL tables utilize strict **Row-Level Security (RLS)**. User profiles, connection configurations, and audit logs are securely isolated so tenants can never query or view other users' data.
                            </p>
                        </div>

                        <div style={{ background: 'rgba(10,7,24,0.8)', border: '1px solid rgba(200,169,110,0.1)', borderRadius: 16, padding: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#C8A96E', fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: 15, marginBottom: 14 }}>
                                <Shield size={16} /> AES-256 Encryption
                            </div>
                            <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(240,235,248,0.45)', lineHeight: 1.7 }}>
                                All credentials (tokens, webhooks, domain secrets) submitted during onboarding are AES-256 encrypted before writing to database tables, preventing exposure in plaintext.
                            </p>
                        </div>

                        <div style={{ background: 'rgba(10,7,24,0.8)', border: '1px solid rgba(200,169,110,0.1)', borderRadius: 16, padding: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#C8A96E', fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: 15, marginBottom: 14 }}>
                                <RefreshCw size={16} /> Local Developer Bypass
                            </div>
                            <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(240,235,248,0.45)', lineHeight: 1.7 }}>
                                For local sandbox validation, MOIRA supports a **Mock Developer Bypass** that runs auth entirely in-memory with local `.env` configuration file updates, allowing zero-config code testing.
                            </p>
                        </div>
                    </div>

                    {/* Google OAuth & API Disclosure Section */}
                    <div style={{
                        marginTop: 40,
                        background: 'rgba(74,14,143,0.06)',
                        border: '1px dashed rgba(200,169,110,0.3)',
                        borderRadius: 20,
                        padding: 32,
                        textAlign: 'left'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#C8A96E', fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: 17, marginBottom: 14 }}>
                            <Globe size={20} /> Google API & OAuth Scope Disclosure
                        </div>
                        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'rgba(240,235,248,0.7)', lineHeight: 1.7 }}>
                            <strong>MOIRA</strong> uses Google OAuth strictly to authenticate developers and verify identity during signup/login. We request your public email address and avatar strictly to create your unique multi-tenant profile under our secure, RLS-isolated Supabase backend.
                        </p>
                        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'rgba(240,235,248,0.7)', lineHeight: 1.7 }}>
                            <strong>Google Sheets API Usage</strong>: In the integration wizard, users can optionally grant Google Sheets read/write permissions. MOIRA uses this scope strictly to write flat-table execution summaries and latency metrics to your own designated Google Sheets for audit purposes. We do not store, inspect, or transfer any private spreadsheet data to external servers.
                        </p>
                        <p style={{ margin: 0, fontSize: 13, color: 'rgba(200,169,110,0.45)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Shield size={14} style={{ color: '#C8A96E' }} /> For more details on user data security and storage practices, please read our public <a href="/privacy" style={{ color: '#E8D5A3', textDecoration: 'underline' }}>Privacy Policy</a> and <a href="/terms" style={{ color: '#E8D5A3', textDecoration: 'underline' }}>Terms of Service</a>.
                        </p>
                    </div>
                </div>
            </RevealSection>

            {/* ════════════════════════════════════════════════════════════
                THE CREATORS (Team InnoCrew)
            ════════════════════════════════════════════════════════════ */}
            <RevealSection id="creators" style={{ padding: 'clamp(80px, 10vw, 140px) 5%', textAlign: 'center', position: 'relative', borderTop: '1px solid rgba(200, 169, 110, 0.07)' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <SectionLabel>The Weavers</SectionLabel>
                    <p style={{ fontSize: 14, color: 'rgba(200,169,110,0.45)', marginBottom: 8, letterSpacing: '0.06em' }}>
                        Designed and compiled with fate by
                     </p>

                    <h2 style={{
                        fontSize: 'clamp(32px, 5vw, 64px)', fontFamily: 'Cinzel, serif',
                        fontWeight: 900, letterSpacing: '0.1em', marginBottom: 16,
                        background: 'linear-gradient(135deg, #C8A96E, #E8D5A3, #C8A96E)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                        Team InnoCrew
                    </h2>

                    <div style={{ display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap', marginTop: 40 }}>
                        {[
                            { name: 'Shis Maheta', icon: <CustomGalaxyIcon />, role: 'Orchestrator Architect', bio: 'Specialist in distributed DAG planning, async transaction safety, and large language model intent classification models.' },
                            { name: 'Dev Patel', icon: <CustomLightningIcon />, role: 'Loom UI/UX Designer', bio: 'Architect of premium Web interfaces, GSAP scroll animation systems, real-time terminals, and secure credential caching.' }
                        ].map((m) => (
                            <motion.div 
                                key={m.name}
                                whileHover={{ y: -6, boxShadow: '0 20px 60px rgba(74,14,143,0.32), 0 0 0 1px rgba(200,169,110,0.25)' }}
                                style={{
                                    padding: '36px 28px', background: 'rgba(13,9,32,0.92)',
                                    border: '1px solid rgba(200,169,110,0.18)', borderRadius: 20,
                                    maxWidth: 320, transition: 'box-shadow 0.3s, transform 0.3s',
                                    textAlign: 'left'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(200,169,110,0.06)', border: '1px solid rgba(200,169,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {m.icon}
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#E8D5A3', fontFamily: 'Cinzel, serif', margin: 0 }}>{m.name}</h3>
                                        <span style={{ fontSize: 11, color: 'rgba(200,169,110,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginTop: 2 }}>{m.role}</span>
                                    </div>
                                </div>
                                <p style={{ fontSize: 13, color: 'rgba(240,235,248,0.45)', lineHeight: 1.7, margin: 0 }}>{m.bio}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </RevealSection>

            {/* ════════════════════════════════════════════════════════════
                FINAL CTA
            ════════════════════════════════════════════════════════════ */}
            <section style={{ padding: 'clamp(80px, 10vw, 140px) 5%', textAlign: 'center', position: 'relative', background: 'linear-gradient(180deg, #080610 0%, rgba(74,14,143,0.15) 50%, #080610 100%)', overflow: 'hidden', borderTop: '1px solid rgba(200, 169, 110, 0.07)' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <div style={{ fontSize: 56, marginBottom: 20, color: '#E8D5A3' }}>Ω</div>
                        <h2 style={{ fontSize: 'clamp(32px, 5vw, 64px)', fontFamily: 'Cinzel, serif', fontWeight: 900, color: '#E8D5A3', marginBottom: 16, letterSpacing: '0.05em' }}>
                            Begin Your Fate
                        </h2>
                        <p style={{ fontSize: 18, color: 'rgba(240,235,248,0.4)', maxWidth: 500, margin: '0 auto 40px', lineHeight: 1.7 }}>
                            Your workflows are waiting to be woven. Connect your repository, define your tools, and witness destiny.
                        </p>
                        <motion.button onClick={handleGetStarted}
                            whileHover={{ scale: 1.05, boxShadow: '0 0 60px rgba(200,169,110,0.25)' }}
                            whileTap={{ scale: 0.97 }}
                            style={{
                                padding: '16px 48px', fontSize: 18, fontWeight: 700,
                                background: 'linear-gradient(135deg, #4A0E8F, #8B35D6)',
                                border: '1px solid rgba(200,169,110,0.35)', borderRadius: 14,
                                color: '#F0EBF8', cursor: 'pointer', fontFamily: 'Cinzel, serif',
                                letterSpacing: '0.06em',
                            }}>
                            Wield The Loom
                        </motion.button>
                    </motion.div>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════════
                FOOTER (Year 2026 Updated)
            ════════════════════════════════════════════════════════════ */}
            <footer style={{ padding: '32px 5%', borderTop: '1px solid rgba(200,169,110,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 12 }}>
                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: 14, color: 'rgba(200,169,110,0.5)', letterSpacing: '0.06em' }}>Ω MOIRA</span>
                    <span style={{ fontSize: 12, color: 'rgba(200,169,110,0.28)', letterSpacing: '0.04em', textAlign: 'center' }}>
                        © 2026 Team InnoCrew · Shis Maheta & Dev Patel · moira.sinaai.in
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(200,169,110,0.2)' }}>Ancient. Inevitable. Timeless.</span>
                </div>
                <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
                    <Link to="/privacy" style={{ color: 'rgba(200,169,110,0.4)', textDecoration: 'none', transition: 'color 0.2s', fontFamily: 'Cinzel, serif', letterSpacing: '0.04em' }} onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#C8A96E'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = 'rgba(200,169,110,0.4)'}>Privacy Policy</Link>
                    <Link to="/terms" style={{ color: 'rgba(200,169,110,0.4)', textDecoration: 'none', transition: 'color 0.2s', fontFamily: 'Cinzel, serif', letterSpacing: '0.04em' }} onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#C8A96E'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = 'rgba(200,169,110,0.4)'}>Terms of Service</Link>
                </div>
            </footer>
        </div>
    );
}
