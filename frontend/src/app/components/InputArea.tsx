import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp, FileText } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface InputAreaProps {
    onSend: (text: string) => void;
    disabled: boolean;
    mode?: 'chat' | 'execution';
}

export function InputArea({ onSend, disabled, mode = 'chat' }: InputAreaProps) {
    const [text, setText] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [templates, setTemplates] = useState<{ id: string; name: string; content: string }[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const templatesDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (showTemplates) {
            try {
                const saved = localStorage.getItem('mcp_gateway_templates');
                if (saved) {
                    setTemplates(JSON.parse(saved));
                } else {
                    setTemplates([
                        { id: '1', name: 'Jira & Slack Sync', content: 'Check Jira for unresolved issues in the SCRUM project and post the list to #general on Slack.' },
                        { id: '2', name: 'Audit Report', content: 'Fetch all tool usage logs and export them to our audit Google Sheet.' }
                    ]);
                }
            } catch (e) {
                setTemplates([]);
            }
        }
    }, [showTemplates]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (templatesDropdownRef.current && !templatesDropdownRef.current.contains(e.target as Node)) {
                setShowTemplates(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    };

    const handleSend = () => {
        if (text.trim() && !disabled) {
            onSend(text);
            setText('');
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const canSend = text.trim() && !disabled;

    const placeholders = [
        'Command fate…',
        'What shall MOIRA weave today?',
        'Describe the workflow to execute…',
        'Ask anything or command an execution…',
    ];
    const placeholder = placeholders[0];

    return (
        <div className="w-full relative px-4" style={{ maxWidth: '860px', margin: '0 auto' }}>
            {/* Templates dropdown */}
            <AnimatePresence>
                {showTemplates && (
                    <motion.div
                        ref={templatesDropdownRef}
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full mb-3 left-4 w-76 rounded-2xl p-2 z-50 shadow-2xl"
                        style={{
                            background: 'rgba(8,6,16,0.98)',
                            border: '1px solid rgba(200,169,110,0.2)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(74,14,143,0.15)',
                            backdropFilter: 'blur(24px)',
                        }}
                    >
                        <div className="font-cinzel uppercase tracking-widest px-3 py-2"
                            style={{ fontSize: '0.6rem', color: 'rgba(200,169,110,0.4)', borderBottom: '1px solid rgba(200,169,110,0.08)' }}>
                            Fate Templates
                        </div>
                        <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 4 }} className="custom-scrollbar">
                            {templates.length === 0 ? (
                                <div className="font-cinzel text-center py-4"
                                    style={{ fontSize: '0.6rem', color: 'rgba(200,169,110,0.25)', lineHeight: 1.8 }}>
                                    No templates found.<br />Create them in Settings.
                                </div>
                            ) : (
                                templates.map(t => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => {
                                            setText(t.content);
                                            setShowTemplates(false);
                                            if (textareaRef.current) {
                                                textareaRef.current.style.height = 'auto';
                                                setTimeout(() => {
                                                    if (textareaRef.current) {
                                                        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
                                                    }
                                                }, 0);
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#F0EBF8',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 2,
                                            transition: 'background 0.18s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,14,143,0.15)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#E8D5A3' }}>{t.name}</span>
                                        <span style={{ fontSize: '0.7rem', color: 'rgba(200,169,110,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{t.content}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Main input box ── */}
            <div className="relative">
                {/* Glow layer */}
                <div
                    className={`absolute -inset-[3px] rounded-[28px] transition-all duration-500 ${isFocused ? 'input-glow--focused' : 'input-glow'}`}
                    style={{ opacity: isFocused ? 0.8 : 0.3 }}
                />

                {/* Gold spectrum border */}
                <div
                    className="relative spectrum-border rounded-[25px] p-[1.5px]"
                    style={{ opacity: isFocused ? 1 : 0.5, transition: 'opacity 0.4s ease' }}
                >
                    {/* Dark glass inner */}
                    <div
                        className="rounded-[23.5px] p-2 flex flex-col"
                        style={{
                            background: 'rgba(8,6,16,0.94)',
                            backdropFilter: 'blur(28px)',
                            WebkitBackdropFilter: 'blur(28px)',
                        }}
                    >
                        <textarea
                            ref={textareaRef}
                            value={text}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder={placeholder}
                            className="w-full bg-transparent placeholder:text-white/20 resize-none outline-none py-3 px-4 max-h-[200px] min-h-[44px] overflow-y-auto custom-scrollbar"
                            style={{
                                fontSize: '0.9375rem',
                                lineHeight: '1.6',
                                fontFamily: 'Inter, sans-serif',
                                color: '#F0EBF8',
                            }}
                            rows={1}
                            disabled={disabled}
                        />

                        <div className="flex items-center justify-between px-2 pt-1.5 pb-1">
                            <div className="flex items-center gap-1.5">
                                {/* Templates button */}
                                <button
                                    onClick={() => setShowTemplates(v => !v)}
                                    className="purple-ghost-btn"
                                    type="button"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Templates</span>
                                </button>

                                {/* Mode indicator */}
                                {disabled && (
                                    <div
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-cinzel"
                                        style={{
                                            background: 'rgba(74,14,143,0.15)',
                                            border: '1px solid rgba(200,169,110,0.15)',
                                            fontSize: '0.6rem',
                                            color: 'rgba(200,169,110,0.6)',
                                            letterSpacing: '0.08em',
                                        }}
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#a78bfa' }} />
                                        FATE WEAVING…
                                    </div>
                                )}
                            </div>

                            {/* Send button */}
                            <motion.button
                                onClick={handleSend}
                                disabled={!canSend}
                                whileHover={canSend ? { scale: 1.08 } : {}}
                                whileTap={canSend ? { scale: 0.92 } : {}}
                                className="disabled:opacity-25 disabled:cursor-not-allowed"
                                style={{
                                    width: '2.25rem', height: '2.25rem',
                                    borderRadius: '0.85rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: canSend
                                        ? 'linear-gradient(135deg, #E8D5A3 0%, #C8A96E 40%, #8A7048 80%, #4A0E8F 100%)'
                                        : 'rgba(240,235,248,0.05)',
                                    boxShadow: canSend
                                        ? '0 0 20px rgba(200,169,110,0.5), 0 0 40px rgba(74,14,143,0.25), inset 0 1px 0 rgba(255,255,255,0.15)'
                                        : 'none',
                                    border: canSend ? '1px solid rgba(232,213,163,0.3)' : '1px solid rgba(240,235,248,0.06)',
                                    transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                                    cursor: canSend ? 'pointer' : 'not-allowed',
                                }}
                            >
                                <ArrowUp className="w-4 h-4" style={{ color: canSend ? '#080610' : 'rgba(240,235,248,0.3)' }} />
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-center mt-2.5 font-cinzel"
                style={{ fontSize: '0.55rem', color: 'rgba(200,169,110,0.2)', letterSpacing: '0.12em' }}>
                MOIRA · ALL FATES ARE LOGGED AND IMMUTABLE
            </div>
        </div>
    );
}
