import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Settings, X, Github, Slack, FileSpreadsheet,
    Eye, EyeOff, Save, CheckCircle2, AlertCircle,
    ChevronRight, Zap, Shield, Globe, Database,
    ToggleLeft, ToggleRight, Library, FileText,
} from 'lucide-react';
import { SynthesizedToolsLibrary } from './SynthesizedToolsLibrary';
import { authFetch } from '../../lib/supabase';
import { config } from '../../config';

// ──────────────────── Types ─────────────────────────────────────────────────
interface Tool {
    id: string;
    name: string;
    description: string;
    sensitive: boolean;
    enabled: boolean;
}

interface ConnectorConfig {
    id: string;
    label: string;
    color: string;
    glowColor: string;
    icon: React.ReactNode;
    tools: Tool[];
}

// ──────────────────── Initial State ─────────────────────────────────────────
// ──────────────────── Initial State ─────────────────────────────────────────
const initialEnvConfig = {
    // ── Active Provider ──────────────────────────────────────────────────────
    active_provider: 'nvidia',
    // ── NVIDIA NIM ───────────────────────────────────────────────────────────
    nvidia_api_key: '',
    nvidia_base_url: 'https://integrate.api.nvidia.com/v1',
    nvidia_model: 'meta/llama-3.3-70b-instruct',
    // ── Groq ─────────────────────────────────────────────────────────────────
    groq_api_key: '',
    groq_model: 'llama-3.3-70b-versatile',
    // ── OpenRouter ───────────────────────────────────────────────────────────
    openrouter_api_key: '',
    openrouter_base_url: 'https://openrouter.ai/api/v1',
    openrouter_model: 'meta-llama/llama-3.3-70b-instruct:free',
    // ── LM Studio (local) ────────────────────────────────────────────────────
    lmstudio_base_url: 'http://localhost:1234/v1',
    lmstudio_model: 'local-model',
    lmstudio_api_key: 'lm-studio',
    // GitHub
    github_token: '',
    github_default_repo_owner: '',
    // Jira
    jira_base_url: '',
    jira_email: '',
    jira_api_token: '',
    jira_default_project: '',
    // Slack
    slack_bot_token: '',
    slack_default_channel: '',
    // Google Sheets
    google_client_email: '',
    google_private_key: '',
    google_project_id: '',
    google_audit_spreadsheet_id: '',
};

const initialConnectors: ConnectorConfig[] = [
    {
        id: 'github',
        label: 'GitHub',
        color: '#6e40c9',
        glowColor: 'rgba(110,64,201,0.4)',
        icon: <Github className="w-4 h-4" />,
        tools: [
            { id: 'get_repo_info', name: 'get_repo_info', description: 'Get metadata about a GitHub repository', sensitive: false, enabled: true },
            { id: 'create_branch', name: 'create_branch', description: 'Create a new git branch in a repository', sensitive: false, enabled: true },
            { id: 'create_issue', name: 'create_issue', description: 'Create a GitHub issue', sensitive: false, enabled: true },
            { id: 'list_issues', name: 'list_issues', description: 'List issues in a repository', sensitive: false, enabled: true },
            { id: 'close_issue', name: 'close_issue', description: 'Close a GitHub issue (destructive)', sensitive: true, enabled: true },
            { id: 'push_file', name: 'push_file', description: 'Push (create or update) a file in a repository', sensitive: true, enabled: true },
        ],
    },
    {
        id: 'jira',
        label: 'Jira',
        color: '#0052CC',
        glowColor: 'rgba(0,82,204,0.4)',
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 00-.84-.84H11.53zM6.77 6.8a4.362 4.362 0 004.35 4.34h1.78v1.72a4.362 4.362 0 004.35 4.34V7.63a.841.841 0 00-.84-.83H6.77zM2 11.6c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7A4.35 4.35 0 0012.48 22V12.43a.84.84 0 00-.84-.83H2z" />
            </svg>
        ),
        tools: [
            { id: 'create_issue', name: 'create_issue', description: 'Create a new Jira issue (bug, task, story, etc.)', sensitive: false, enabled: true },
            { id: 'get_issue', name: 'get_issue', description: 'Get details of a specific Jira issue by key', sensitive: false, enabled: true },
            { id: 'list_issues', name: 'list_issues', description: 'List issues in a Jira project with optional filters', sensitive: false, enabled: true },
            { id: 'update_issue_status', name: 'update_issue_status', description: 'Transition a Jira issue to a new status', sensitive: false, enabled: true },
            { id: 'add_comment', name: 'add_comment', description: 'Add a comment to an existing Jira issue', sensitive: false, enabled: true },
            { id: 'assign_issue', name: 'assign_issue', description: 'Assign a Jira issue to a user by their account ID or email', sensitive: false, enabled: true },
        ],
    },
    {
        id: 'slack',
        label: 'Slack',
        color: '#4A154B',
        glowColor: 'rgba(74,21,75,0.55)',
        icon: <Slack className="w-4 h-4" />,
        tools: [
            { id: 'send_message', name: 'send_message', description: 'Send a message to a Slack channel', sensitive: false, enabled: true },
            { id: 'list_channels', name: 'list_channels', description: 'List all Slack channels', sensitive: false, enabled: true },
            { id: 'get_channel_history', name: 'get_channel_history', description: 'Get recent messages from a Slack channel', sensitive: false, enabled: true },
            { id: 'set_channel_topic', name: 'set_channel_topic', description: 'Set the topic of a Slack channel', sensitive: true, enabled: true },
        ],
    },
    {
        id: 'sheets',
        label: 'Google Sheets',
        color: '#0F9D58',
        glowColor: 'rgba(15,157,88,0.4)',
        icon: <FileSpreadsheet className="w-4 h-4" />,
        tools: [
            { id: 'append_row', name: 'append_row', description: 'Append one or multiple rows of values to a Google Sheet', sensitive: false, enabled: true },
            { id: 'read_range', name: 'read_range', description: 'Read a cell range from a Google Sheet', sensitive: false, enabled: true },
            { id: 'update_cell', name: 'update_cell', description: 'Update a single cell in a Google Sheet', sensitive: false, enabled: true },
            { id: 'create_spreadsheet', name: 'create_spreadsheet', description: 'Create a new blank Google Spreadsheet', sensitive: false, enabled: true },
            { id: 'find_spreadsheet_by_name', name: 'find_spreadsheet_by_name', description: 'Find a spreadsheet ID by its name in Google Drive', sensitive: false, enabled: true },
        ],
    },
];

// ──────────────────── Sub-Components ────────────────────────────────────────

function SecretInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="relative">
            <input
                id={id}
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: 'rgba(255,255,255,0.85)',
                    padding: '8px 40px 8px 12px',
                    width: '100%',
                    fontSize: 13,
                    outline: 'none',
                    fontFamily: 'monospace',
                    transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(192,132,252,0.55)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
            <button
                type="button"
                onClick={() => setVisible(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', background: 'none', border: 'none' }}
            >
                {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
    );
}

function TextInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <input
            id={id}
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.85)',
                padding: '8px 12px',
                width: '100%',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'monospace',
                transition: 'border-color 0.2s',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(192,132,252,0.55)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
        />
    );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
            {children}
            {hint && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{hint}</p>}
        </div>
    );
}

function SectionBlock({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ color: '#C084FC' }}>{icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)', marginLeft: 8 }} />
            </div>
            {children}
        </div>
    );
}

function ToolToggleCard({ tool, color, onToggle }: { tool: Tool; color: string; onToggle: () => void }) {
    return (
        <motion.div
            layout
            style={{
                background: tool.enabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
                border: `1px solid ${tool.enabled ? `${color}55` : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'all 0.2s',
            }}
        >
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: tool.enabled ? color : 'rgba(255,255,255,0.3)',
                        transition: 'color 0.2s',
                    }}>
                        {tool.name}
                    </code>
                    {tool.sensitive && (
                        <span style={{
                            fontSize: 10,
                            background: 'rgba(239,68,68,0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 4,
                            padding: '1px 5px',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                        }}>
                            SENSITIVE
                        </span>
                    )}
                </div>
                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{tool.description}</p>
            </div>

            {/* Toggle */}
            <motion.button
                onClick={onToggle}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                whileTap={{ scale: 0.93 }}
            >
                <motion.div
                    style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        background: tool.enabled ? color : 'rgba(255,255,255,0.12)',
                        position: 'relative',
                        transition: 'background 0.2s',
                    }}
                    animate={{ background: tool.enabled ? color : 'rgba(255,255,255,0.12)' }}
                >
                    <motion.div
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: '#fff',
                            position: 'absolute',
                            top: 3,
                        }}
                        animate={{ left: tool.enabled ? 23 : 3 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                </motion.div>
            </motion.button>
        </motion.div>
    );
}

// ──────────────────── Slides ─────────────────────────────────────────────────

function EnvironmentSlide({ config, setConfig }: { config: typeof initialEnvConfig; setConfig: React.Dispatch<React.SetStateAction<typeof initialEnvConfig>> }) {
    const upd = (key: keyof typeof initialEnvConfig) => (v: string) => setConfig(c => ({ ...c, [key]: v }));

    const providerColor: Record<string, string> = {
        nvidia: '#76b900',
        groq:   '#f55036',
        openrouter: '#7c3aed',
        lmstudio: '#0ea5e9',
    };
    const providers = [
        { id: 'nvidia', label: 'NVIDIA NIM', emoji: '🟢' },
        { id: 'groq',   label: 'Groq',       emoji: '🔴' },
        { id: 'openrouter', label: 'OpenRouter', emoji: '🟣' },
        { id: 'lmstudio',  label: 'LM Studio (Local)', emoji: '🔵' },
    ];

    return (
        <div style={{ padding: '24px 28px' }}>

            {/* ── AI Provider Selector ─────────────────────────────────── */}
            <SectionBlock title="AI Providers" icon={<Zap className="w-4 h-4" />}>
                {/* Active provider pills */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {providers.map(p => {
                        const active = config.active_provider === p.id;
                        return (
                            <button
                                key={p.id}
                                onClick={() => upd('active_provider')(p.id)}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: 999,
                                    border: `1.5px solid ${active ? providerColor[p.id] : 'rgba(255,255,255,0.1)'}`,
                                    background: active ? `${providerColor[p.id]}22` : 'rgba(255,255,255,0.03)',
                                    color: active ? providerColor[p.id] : 'rgba(255,255,255,0.45)',
                                    fontSize: 12.5,
                                    fontWeight: active ? 700 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                }}
                            >
                                <span>{p.emoji}</span>
                                {p.label}
                                {active && <span style={{ fontSize: 10, background: providerColor[p.id], color: '#fff', borderRadius: 4, padding: '1px 5px', marginLeft: 2 }}>ACTIVE</span>}
                            </button>
                        );
                    })}
                </div>

                {/* NVIDIA NIM fields */}
                {config.active_provider === 'nvidia' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <FieldRow label="NVIDIA API Key" hint="Required for NVIDIA NIM (nvapi-...)">
                                <SecretInput id="nvidia_api_key" value={config.nvidia_api_key} onChange={upd('nvidia_api_key')} placeholder="nvapi-..." />
                            </FieldRow>
                        </div>
                        <FieldRow label="NVIDIA Base URL">
                            <TextInput id="nvidia_base_url" value={config.nvidia_base_url} onChange={upd('nvidia_base_url')} />
                        </FieldRow>
                        <FieldRow label="Model" hint="e.g. meta/llama-3.3-70b-instruct">
                            <TextInput id="nvidia_model" value={config.nvidia_model} onChange={upd('nvidia_model')} placeholder="meta/llama-3.3-70b-instruct" />
                        </FieldRow>
                    </div>
                )}

                {/* Groq fields */}
                {config.active_provider === 'groq' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <FieldRow label="Groq API Key" hint="gsk_... key from console.groq.com">
                                <SecretInput id="groq_api_key" value={config.groq_api_key} onChange={upd('groq_api_key')} placeholder="gsk_..." />
                            </FieldRow>
                        </div>
                        <FieldRow label="Model" hint="e.g. llama-3.3-70b-versatile">
                            <TextInput id="groq_model" value={config.groq_model} onChange={upd('groq_model')} placeholder="llama-3.3-70b-versatile" />
                        </FieldRow>
                    </div>
                )}

                {/* OpenRouter fields */}
                {config.active_provider === 'openrouter' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <FieldRow label="OpenRouter API Key" hint="sk-or-v1-... key from openrouter.ai">
                                <SecretInput id="openrouter_api_key" value={config.openrouter_api_key} onChange={upd('openrouter_api_key')} placeholder="sk-or-v1-..." />
                            </FieldRow>
                        </div>
                        <FieldRow label="Base URL">
                            <TextInput id="openrouter_base_url" value={config.openrouter_base_url} onChange={upd('openrouter_base_url')} />
                        </FieldRow>
                        <FieldRow label="Model" hint="Exact model ID from openrouter.ai/models">
                            <TextInput id="openrouter_model" value={config.openrouter_model} onChange={upd('openrouter_model')} placeholder="meta-llama/llama-3.3-70b-instruct:free" />
                        </FieldRow>
                    </div>
                )}

                {/* LM Studio fields */}
                {config.active_provider === 'lmstudio' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <FieldRow label="LM Studio Server URL" hint="Default: http://localhost:1234/v1">
                            <TextInput id="lmstudio_base_url" value={config.lmstudio_base_url} onChange={upd('lmstudio_base_url')} placeholder="http://localhost:1234/v1" />
                        </FieldRow>
                        <FieldRow label="Model Name" hint="Exact identifier shown in LM Studio (e.g. lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF)">
                            <TextInput id="lmstudio_model" value={config.lmstudio_model} onChange={upd('lmstudio_model')} placeholder="lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF" />
                        </FieldRow>
                    </div>
                )}
            </SectionBlock>
        </div>
    );
}

function ConnectorSlide({ connector, onChange, envConfig, setEnvConfig }: { connector: ConnectorConfig; onChange: (updated: ConnectorConfig) => void, envConfig: typeof initialEnvConfig, setEnvConfig: React.Dispatch<React.SetStateAction<typeof initialEnvConfig>> }) {
    const upd = (key: keyof typeof initialEnvConfig) => (v: string) => setEnvConfig(c => ({ ...c, [key]: v }));
    const toggleTool = (toolId: string) => {
        onChange({
            ...connector,
            tools: connector.tools.map(t => t.id === toolId ? { ...t, enabled: !t.enabled } : t),
        });
    };
    const enabledCount = connector.tools.filter(t => t.enabled).length;

    const renderCredentials = () => {
        if (connector.id === 'github') {
            return (
                <SectionBlock title="GitHub Credentials" icon={<Github className="w-4 h-4" />}>
                    <FieldRow label="GitHub Personal Access Token" hint="ghp_... token with repo, issues, and branches scopes">
                        <SecretInput id="github_token" value={envConfig.github_token} onChange={upd('github_token')} placeholder="ghp_..." />
                    </FieldRow>
                    <FieldRow label="Default Repository Owner" hint="Used when repo is specified without owner prefix">
                        <TextInput id="github_default_repo_owner" value={envConfig.github_default_repo_owner} onChange={upd('github_default_repo_owner')} placeholder="my-org or username" />
                    </FieldRow>
                </SectionBlock>
            );
        }
        if (connector.id === 'jira') {
            return (
                <SectionBlock title="Jira Credentials" icon={
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 00-.84-.84H11.53zM6.77 6.8a4.362 4.362 0 004.35 4.34h1.78v1.72a4.362 4.362 0 004.35 4.34V7.63a.841.841 0 00-.84-.83H6.77zM2 11.6c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7A4.35 4.35 0 0012.48 22V12.43a.84.84 0 00-.84-.83H2z" />
                    </svg>
                }>
                    <FieldRow label="Jira Base URL" hint="Your Atlassian Cloud URL, e.g. https://yoursite.atlassian.net">
                        <TextInput id="jira_base_url" value={envConfig.jira_base_url} onChange={upd('jira_base_url')} placeholder="https://yoursite.atlassian.net" />
                    </FieldRow>
                    <FieldRow label="Jira Email">
                        <TextInput id="jira_email" value={envConfig.jira_email} onChange={upd('jira_email')} placeholder="you@example.com" />
                    </FieldRow>
                    <FieldRow label="Jira API Token" hint="Generate at id.atlassian.com/manage-profile/security/api-tokens">
                        <SecretInput id="jira_api_token" value={envConfig.jira_api_token} onChange={upd('jira_api_token')} placeholder="ATATT3x..." />
                    </FieldRow>
                    <FieldRow label="Default Project Key" hint="e.g. SCRUM, DEV, PROJ">
                        <TextInput id="jira_default_project" value={envConfig.jira_default_project} onChange={upd('jira_default_project')} placeholder="SCRUM" />
                    </FieldRow>
                </SectionBlock>
            );
        }
        if (connector.id === 'slack') {
            return (
                <SectionBlock title="Slack Credentials" icon={<Slack className="w-4 h-4" />}>
                    <FieldRow label="Slack Bot Token" hint="xoxb-... token from your Slack App configuration">
                        <SecretInput id="slack_bot_token" value={envConfig.slack_bot_token} onChange={upd('slack_bot_token')} placeholder="xoxb-..." />
                    </FieldRow>
                    <FieldRow label="Default Channel ID" hint="Channel ID (e.g. C0AQ6Q0GYK0) — found in channel details">
                        <TextInput id="slack_default_channel" value={envConfig.slack_default_channel} onChange={upd('slack_default_channel')} placeholder="C0AQ6Q0GYK0" />
                    </FieldRow>
                </SectionBlock>
            );
        }
        if (connector.id === 'sheets') {
            return (
                <SectionBlock title="Google Sheets Credentials" icon={<FileSpreadsheet className="w-4 h-4" />}>
                    <FieldRow label="Google Service Account Email" hint="Your service account client email (e.g. name@project.iam.gserviceaccount.com)">
                        <TextInput id="google_client_email" value={envConfig.google_client_email} onChange={upd('google_client_email')} placeholder="name@project.iam.gserviceaccount.com" />
                    </FieldRow>
                    <FieldRow label="Private Key" hint="Your Google Service Account Private Key (-----BEGIN PRIVATE KEY-----...)">
                        <SecretInput id="google_private_key" value={envConfig.google_private_key} onChange={upd('google_private_key')} placeholder="-----BEGIN PRIVATE KEY-----..." />
                    </FieldRow>
                    <FieldRow label="Project ID" hint="Your Google Cloud Project ID">
                        <TextInput id="google_project_id" value={envConfig.google_project_id} onChange={upd('google_project_id')} placeholder="my-gcp-project" />
                    </FieldRow>
                    <FieldRow label="Audit Spreadsheet ID" hint="The Google Sheets ID used for workflow audit logging">
                        <TextInput id="google_audit_spreadsheet_id" value={envConfig.google_audit_spreadsheet_id} onChange={upd('google_audit_spreadsheet_id')} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" />
                    </FieldRow>
                </SectionBlock>
            );
        }
        return null;
    };

    return (
        <div style={{ padding: '24px 28px' }}>
            {renderCredentials()}

            <SectionBlock title="Tools" icon={<Zap className="w-4 h-4" />}>
                {/* Stats bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 16,
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                        {enabledCount} of {connector.tools.length} tools enabled
                    </span>
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                        <motion.div
                            style={{ height: '100%', background: connector.color, borderRadius: 4 }}
                            animate={{ width: `${(enabledCount / connector.tools.length) * 100}%` }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                    </div>
                    <button
                        onClick={() => onChange({ ...connector, tools: connector.tools.map(t => ({ ...t, enabled: enabledCount < connector.tools.length })) })}
                        style={{
                            fontSize: 11, fontWeight: 600, color: connector.color,
                            background: 'none', border: 'none', cursor: 'pointer',
                            textDecoration: 'underline',
                        }}
                    >
                        {enabledCount < connector.tools.length ? 'Enable All' : 'Disable All'}
                    </button>
                </div>

                {connector.tools.map(tool => (
                    <ToolToggleCard key={tool.id} tool={tool} color={connector.color} onToggle={() => toggleTool(tool.id)} />
                ))}
            </SectionBlock>
        </div>
    );
}

// ──────────────────── Main Component ────────────────────────────────────────
const TABS = [
    { id: 'env', label: 'Environment', shortLabel: '⚙ Env', icon: <Settings className="w-3.5 h-3.5" /> },
    { id: 'github', label: 'GitHub', shortLabel: '🐙 GitHub', icon: <Github className="w-3.5 h-3.5" /> },
    { id: 'jira', label: 'Jira', shortLabel: '🎯 Jira', icon: null },
    { id: 'slack', label: 'Slack', shortLabel: '💬 Slack', icon: <Slack className="w-3.5 h-3.5" /> },
    { id: 'sheets', label: 'Sheets', shortLabel: '📊 Sheets', icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
    { id: 'synth', label: 'Synthesized', shortLabel: '⚡ Synth', icon: <Library className="w-3.5 h-3.5" /> },
    { id: 'templates', label: 'Templates', shortLabel: '📝 Templates', icon: <FileText className="w-3.5 h-3.5" /> },
];

interface MCPSettingsProps {
    open: boolean;
    onClose: () => void;
    onViewGuide?: (service: string) => void;
    onConfigureConnector?: (service: string, displayName: string, fields: any[]) => void;
}

export function MCPSettings({ open, onClose, onViewGuide, onConfigureConnector }: MCPSettingsProps) {
    const [activeTab, setActiveTab] = useState('env');
    const [envConfig, setEnvConfig] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('mcp_env_config') || '{}');
            return { ...initialEnvConfig, ...saved };
        } catch (e) {}
        return initialEnvConfig;
    });
    const [connectors, setConnectors] = useState<ConnectorConfig[]>(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('mcp_disabled_tools') || '[]');
            if (Array.isArray(saved) && saved.length > 0) {
                return initialConnectors.map(c => ({
                    ...c,
                    tools: c.tools.map(t => ({
                        ...t,
                        enabled: !saved.includes(`${c.id}.${t.id}`)
                    }))
                }));
            }
        } catch (e) {}
        return initialConnectors;
    });
    const [saved, setSaved] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
    const [saveError, setSaveError] = useState('');

    // Templates state
    const [templates, setTemplates] = useState<{ id: string; name: string; content: string }[]>(() => {
        try {
            const saved = localStorage.getItem('mcp_gateway_templates');
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return [
            { id: '1', name: 'Jira & Slack Sync', content: 'Check Jira for unresolved issues in the SCRUM project and post the list to #general on Slack.' },
            { id: '2', name: 'Audit Report', content: 'Fetch all tool usage logs and export them to our audit Google Sheet.' }
        ];
    });
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateContent, setNewTemplateContent] = useState('');

    const handleAddTemplate = () => {
        if (!newTemplateName.trim() || !newTemplateContent.trim()) return;
        const newTemp = {
            id: Date.now().toString(),
            name: newTemplateName.trim(),
            content: newTemplateContent.trim(),
        };
        const updated = [...templates, newTemp];
        setTemplates(updated);
        localStorage.setItem('mcp_gateway_templates', JSON.stringify(updated));
        setNewTemplateName('');
        setNewTemplateContent('');
    };

    const handleDeleteTemplate = (id: string) => {
        const updated = templates.filter(t => t.id !== id);
        setTemplates(updated);
        localStorage.setItem('mcp_gateway_templates', JSON.stringify(updated));
    };

    useEffect(() => {
        if (!open) return;
        const fetchSettings = async () => {
            try {
                const res = await authFetch(`${config.apiUrl}/settings/env`);
                if (res.ok) {
                    const data = await res.json();
                    setEnvConfig((c: typeof initialEnvConfig) => ({
                        ...c,
                        ...data,
                    }));
                }
            } catch (err) {
                console.error('[MCPSettings] Failed to fetch current settings:', err);
            }
        };
        fetchSettings();
    }, [open]);

    const handleSave = async () => {
        setSaved('saving');
        setSaveError('');
        const disabledTools = connectors.flatMap(c => c.tools.filter(t => !t.enabled).map(t => `${c.id}.${t.id}`));
        localStorage.setItem('mcp_disabled_tools', JSON.stringify(disabledTools));
        localStorage.setItem('mcp_env_config', JSON.stringify(envConfig));

        // Hot-reload backend via settings API
        try {
            const res = await authFetch(`${config.apiUrl}/settings/env`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: envConfig }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setSaved('ok');
        } catch (err) {
            console.error('[MCPSettings] Hot-reload failed:', err);
            setSaveError('Backend unreachable — saved locally only.');
            setSaved('error');
        }
        setTimeout(() => setSaved('idle'), 3000);
    };

    const activeConnector = connectors.find(c => c.id === activeTab);
    const tabColor = activeConnector?.color ?? '#C084FC';

    const handleConnectorChange = (updated: ConnectorConfig) => {
        setConnectors(cs => cs.map(c => c.id === updated.id ? updated : c));
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'rgba(0,0,0,0.65)',
                            backdropFilter: 'blur(6px)',
                            zIndex: 50,
                        }}
                    />

                    {/* Modal wrapper — centres without conflicting with framer transforms */}
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 51,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        pointerEvents: 'none',
                    }}>
                    <motion.div
                        drag
                        dragMomentum={false}
                        dragElastic={0}
                        initial={{ opacity: 0, scale: 0.95, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 16 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                        style={{
                            width: 'min(880px, 100%)',
                            height: 'min(680px, 90vh)',
                            borderRadius: 16,
                            background: 'rgba(8,6,16,0.99)',
                            border: '1px solid rgba(200,169,110,0.15)',
                            boxShadow: '0 40px 120px rgba(0,0,0,0.9), 0 0 60px rgba(74,14,143,0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            pointerEvents: 'all',
                            cursor: 'default',
                        }}
                    >
                        {/* ── Title Bar — drag handle ── */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '14px 18px',
                                borderBottom: '1px solid rgba(255,255,255,0.07)',
                                background: 'rgba(255,255,255,0.02)',
                                flexShrink: 0,
                                cursor: 'grab',
                                userSelect: 'none',
                            }}
                        >
                            <div style={{ display: 'flex', gap: 6 }}>
                                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57', cursor: 'pointer' }} onClick={onClose} />
                                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FFBD2E' }} />
                                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
                            </div>
                            <Settings className="w-4 h-4" style={{ color: '#C8A96E', marginLeft: 6 }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(240,235,248,0.85)', fontFamily: 'Cinzel, serif', letterSpacing: '0.08em' }}>MOIRA · Configuration</span>
                            <div style={{ flex: 1 }} />
                            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 4 }}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* ── Chrome-style Tab Bar ── */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: 0,
                            padding: '0 14px',
                            background: 'rgba(0,0,0,0.35)',
                            borderBottom: '1px solid rgba(200,169,110,0.08)',
                            overflowX: 'auto',
                            flexShrink: 0,
                        }}>
                            {TABS.map((tab, i) => {
                                const isActive = activeTab === tab.id;
                                const connector = connectors.find(c => c.id === tab.id);
                                const color = connector?.color ?? '#C084FC';
                                return (
                                    <motion.button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        style={{
                                            position: 'relative',
                                            padding: '10px 18px 9px',
                                            fontSize: 12.5,
                                            fontWeight: isActive ? 700 : 500,
                                            color: isActive ? '#E8D5A3' : 'rgba(200,169,110,0.45)',
                                            background: isActive ? 'rgba(74,14,143,0.15)' : 'transparent',
                                            border: 'none',
                                            borderTopLeftRadius: isActive ? 8 : 0,
                                            borderTopRightRadius: isActive ? 8 : 0,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                            transition: 'color 0.15s',
                                            marginTop: 6,
                                        }}
                                        whileHover={{ color: isActive ? '#E8D5A3' : 'rgba(200,169,110,0.75)' }}
                                    >
                                        <span style={{ color: isActive ? color : 'inherit' }}>
                                            {tab.id === 'jira' ? (
                                                <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 00-.84-.84H11.53zM6.77 6.8a4.362 4.362 0 004.35 4.34h1.78v1.72a4.362 4.362 0 004.35 4.34V7.63a.841.841 0 00-.84-.83H6.77zM2 11.6c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7A4.35 4.35 0 0012.48 22V12.43a.84.84 0 00-.84-.83H2z" />
                                                </svg>
                                            ) : tab.icon}
                                        </span>
                                        {tab.label}
                                        {/* Active indicator line */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="tab-indicator"
                                                style={{
                                                    position: 'absolute',
                                                    bottom: 0, left: 0, right: 0,
                                                    height: 2,
                                                    background: 'linear-gradient(90deg, #C8A96E, rgba(200,169,110,0.4))',
                                                    borderRadius: '2px 2px 0 0',
                                                }}
                                                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                                            />
                                        )}
                                    </motion.button>
                                );
                            })}
                            <div style={{ flex: 1 }} />
                        </div>

                        {/* ── Slide Content ── */}
                        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, overflowX: 'hidden', scrollbarWidth: 'thin', scrollbarColor: 'rgba(200,169,110,0.2) transparent' }}>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, x: 12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -12 }}
                                    transition={{ duration: 0.18 }}
                                >
                                    {activeTab === 'env' && (
                                        <EnvironmentSlide config={envConfig} setConfig={setEnvConfig} />
                                    )}
                                    {activeConnector && (
                                        <ConnectorSlide connector={activeConnector} onChange={handleConnectorChange} envConfig={envConfig} setEnvConfig={setEnvConfig} />
                                    )}
                                    {activeTab === 'synth' && (
                                        <div style={{ padding: '20px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                                                <Library className="w-4 h-4" style={{ color: '#C084FC' }} />
                                                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Synthesized Tools</span>
                                                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)', marginLeft: 8 }} />
                                            </div>
                                            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.35)', marginBottom: 20, lineHeight: 1.55 }}>
                                                When the orchestrator encounters a missing service connector, it synthesizes one using AI.
                                                All auto-generated connectors appear here — you can test, manage, and view their setup guides.
                                            </p>
                                            <SynthesizedToolsLibrary
                                                onViewGuide={onViewGuide}
                                                onConfigureConnector={onConfigureConnector}
                                            />
                                        </div>
                                    )}
                                    {activeTab === 'templates' && (
                                        <div style={{ padding: '20px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                                                <FileText className="w-4 h-4" style={{ color: '#C084FC' }} />
                                                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Prompt Templates</span>
                                                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)', marginLeft: 8 }} />
                                            </div>
                                            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.35)', marginBottom: 20, lineHeight: 1.55 }}>
                                                Create reusable templates for your workflows. You can access and insert these templates quickly during chat using the "Use Template" button.
                                            </p>

                                            {/* Add Template Form */}
                                            <div style={{
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                borderRadius: 12,
                                                padding: 16,
                                                marginBottom: 24,
                                            }}>
                                                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Template Name</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. Sync Jira issues"
                                                            value={newTemplateName}
                                                            onChange={e => setNewTemplateName(e.target.value)}
                                                            style={{
                                                                background: 'rgba(255,255,255,0.04)',
                                                                border: '1px solid rgba(255,255,255,0.1)',
                                                                borderRadius: 8,
                                                                color: '#fff',
                                                                padding: '8px 12px',
                                                                width: '100%',
                                                                fontSize: 13,
                                                                outline: 'none',
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <div style={{ marginBottom: 16 }}>
                                                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Prompt Content</label>
                                                    <textarea
                                                        placeholder="Enter the template prompt content here..."
                                                        value={newTemplateContent}
                                                        onChange={e => setNewTemplateContent(e.target.value)}
                                                        rows={3}
                                                        style={{
                                                            background: 'rgba(255,255,255,0.04)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: 8,
                                                            color: '#fff',
                                                            padding: '8px 12px',
                                                            width: '100%',
                                                            fontSize: 13,
                                                            outline: 'none',
                                                            resize: 'none',
                                                            fontFamily: 'inherit',
                                                        }}
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleAddTemplate}
                                                    disabled={!newTemplateName.trim() || !newTemplateContent.trim()}
                                                    style={{
                                                        padding: '8px 16px',
                                                        fontSize: 12.5,
                                                        fontWeight: 700,
                                                        background: (!newTemplateName.trim() || !newTemplateContent.trim()) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #7C3AED, #C084FC)',
                                                        color: (!newTemplateName.trim() || !newTemplateContent.trim()) ? 'rgba(255,255,255,0.3)' : '#fff',
                                                        border: 'none',
                                                        borderRadius: 8,
                                                        cursor: (!newTemplateName.trim() || !newTemplateContent.trim()) ? 'not-allowed' : 'pointer',
                                                        transition: 'all 0.2s',
                                                    }}
                                                >
                                                    Add Template
                                                </button>
                                            </div>

                                            {/* Templates List */}
                                            <div>
                                                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.04em' }}>Your Templates ({templates.length})</h4>
                                                {templates.length === 0 ? (
                                                    <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.3)', fontSize: 13, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10 }}>
                                                        No templates created yet. Fill the form above to add one!
                                                    </div>
                                                ) : (
                                                    templates.map(t => (
                                                        <div key={t.id} style={{
                                                            background: 'rgba(255,255,255,0.03)',
                                                            border: '1px solid rgba(255,255,255,0.06)',
                                                            borderRadius: 10,
                                                            padding: '12px 16px',
                                                            marginBottom: 10,
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'flex-start',
                                                            gap: 16,
                                                        }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <h5 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{t.name}</h5>
                                                                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{t.content}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleDeleteTemplate(t.id)}
                                                                style={{
                                                                    background: 'rgba(239,68,68,0.1)',
                                                                    border: '1px solid rgba(239,68,68,0.2)',
                                                                    color: '#f87171',
                                                                    padding: '4px 10px',
                                                                    borderRadius: 6,
                                                                    fontSize: 11.5,
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s',
                                                                }}
                                                                onMouseEnter={e => {
                                                                    e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                                                                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
                                                                }}
                                                                onMouseLeave={e => {
                                                                    e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                                                                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
                                                                }}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* ── Footer / Save ── */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 10,
                            padding: '12px 20px',
                            borderTop: '1px solid rgba(255,255,255,0.07)',
                            background: 'rgba(0,0,0,0.3)',
                            flexShrink: 0,
                        }}>
                            <div style={{ marginRight: 'auto' }}>
                                {saved === 'error' && (
                                    <span style={{ fontSize: 11.5, color: '#fbbf24' }}>
                                        ⚠ {saveError || 'Backend unreachable — saved locally only.'}
                                    </span>
                                )}
                                {saved === 'idle' && (
                                    <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.25)' }}>
                                        Changes are saved to your local .env configuration
                                    </span>
                                )}
                            </div>
                            <motion.button
                                onClick={onClose}
                                style={{
                                    padding: '7px 16px', fontSize: 12.5, fontWeight: 600,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 8, color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                                }}
                                whileHover={{ background: 'rgba(255,255,255,0.09)' }}
                                whileTap={{ scale: 0.97 }}
                            >
                                Cancel
                            </motion.button>
                            <motion.button
                                onClick={handleSave}
                                disabled={saved === 'saving'}
                                style={{
                                    padding: '7px 20px', fontSize: 12.5, fontWeight: 700,
                                    background: saved === 'ok'
                                        ? 'linear-gradient(135deg, #16a34a, #15803d)'
                                        : saved === 'error'
                                        ? 'linear-gradient(135deg, #b45309, #92400e)'
                                        : saved === 'saving'
                                        ? 'linear-gradient(135deg, #6d28d9, #7C3AED)'
                                        : 'linear-gradient(135deg, #7C3AED, #C084FC)',
                                    border: 'none',
                                    borderRadius: 8, color: '#fff', cursor: saved === 'saving' ? 'wait' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    boxShadow: saved === 'ok' ? '0 0 20px rgba(22,163,74,0.4)' : '0 0 20px rgba(124,58,237,0.4)',
                                    transition: 'background 0.3s, box-shadow 0.3s',
                                    opacity: saved === 'saving' ? 0.8 : 1,
                                }}
                                whileHover={{ scale: saved === 'saving' ? 1 : 1.02 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                {saved === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                {saved === 'ok' ? 'Saved & Hot-Reloaded ✓'
                                 : saved === 'saving' ? 'Saving...'
                                 : saved === 'error' ? 'Saved Locally'
                                 : 'Save Settings'}
                            </motion.button>
                        </div>
                    </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
