import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
    CheckCircle2, Github, ExternalLink, ChevronRight, Zap, 
    ArrowRight, X, Eye, EyeOff, FileSpreadsheet, Slack, 
    Settings, Play, HelpCircle, Shield, AlertTriangle
} from 'lucide-react';
import { authFetch } from '../../lib/supabase';
import { config } from '../../config';

// ── Types ──────────────────────────────────────────────────────────────────
interface ConnectorState {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    required: boolean;
    isConnected: boolean;
}

// ── Mock Visual Components ─────────────────────────────────────────────────

const mockWindowStyle = {
    background: 'rgba(10, 8, 20, 0.95)',
    border: '1px solid rgba(200, 169, 110, 0.2)',
    borderRadius: 12,
    fontFamily: 'monospace',
    overflow: 'hidden',
    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
    marginTop: 12,
};

const mockTitleBarStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
};

const mockDot = (color: string) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
});

const mockTitleStyle = {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 6,
};

const mockBodyStyle = {
    padding: 12,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 1.5,
};

function GitHubVisualMock() {
    return (
        <div style={mockWindowStyle}>
            <div style={mockTitleBarStyle}>
                <div style={mockDot('#ff5f56')} />
                <div style={mockDot('#ffbd2e')} />
                <div style={mockDot('#27c93f')} />
                <span style={mockTitleStyle}>github.com/settings/tokens/new</span>
            </div>
            <div style={mockBodyStyle}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6, marginBottom: 8, fontWeight: 'bold', color: '#fff' }}>
                    New Personal Access Token (classic)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>Note: <code style={{ color: '#E8D5A3', background: 'rgba(255,255,255,0.06)', padding: '2px 4px', borderRadius: 4 }}>MOIRA-Orchestrator</code></div>
                    <div>Expiration: <code style={{ color: '#888' }}>No expiration (recommended)</code></div>
                    <div style={{ fontWeight: 'bold', marginTop: 4, color: '#fff' }}>Select scopes:</div>
                    <div style={{ display: 'flex', gap: 8, paddingLeft: 8 }}>
                        <input type="checkbox" checked readOnly style={{ accentColor: '#C8A96E' }} />
                        <span><strong>repo</strong> (Full control of repositories)</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, paddingLeft: 8 }}>
                        <input type="checkbox" checked readOnly style={{ accentColor: '#C8A96E' }} />
                        <span><strong>read:user</strong> (Read user profile data)</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, paddingLeft: 8 }}>
                        <input type="checkbox" checked readOnly style={{ accentColor: '#C8A96E' }} />
                        <span><strong>workflow</strong> (Update GitHub Action workflows)</span>
                    </div>
                    <div style={{ marginTop: 8, padding: 8, background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 6, color: '#34D399' }}>
                        ✔ Token generated: <code>ghp_KimiPlanClassic2026SecureToken...</code>
                    </div>
                </div>
            </div>
        </div>
    );
}

function JiraVisualMock() {
    return (
        <div style={mockWindowStyle}>
            <div style={mockTitleBarStyle}>
                <div style={mockDot('#ff5f56')} />
                <div style={mockDot('#ffbd2e')} />
                <div style={mockDot('#27c93f')} />
                <span style={mockTitleStyle}>id.atlassian.com/manage-profile/security/api-tokens</span>
            </div>
            <div style={mockBodyStyle}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6, marginBottom: 8, fontWeight: 'bold', color: '#fff' }}>
                    Create an API Token
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>Label: <code style={{ color: '#E8D5A3', background: 'rgba(255,255,255,0.06)', padding: '2px 4px', borderRadius: 4 }}>MOIRA Gateway</code></div>
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <button type="button" style={{ background: '#0052cc', border: 'none', color: '#fff', borderRadius: 4, padding: '4px 10px', fontSize: 10, cursor: 'default' }}>Create</button>
                    </div>
                    <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,82,204,0.08)', border: '1px solid rgba(0,82,204,0.3)', borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>YOUR NEW API TOKEN:</div>
                        <code style={{ color: '#0052cc', fontWeight: 'bold' }}>ATATT3xFfGF0SecureJiraTokenHere...</code>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SlackVisualMock() {
    return (
        <div style={mockWindowStyle}>
            <div style={mockTitleBarStyle}>
                <div style={mockDot('#ff5f56')} />
                <div style={mockDot('#ffbd2e')} />
                <div style={mockDot('#27c93f')} />
                <span style={mockTitleStyle}>api.slack.com/apps</span>
            </div>
            <div style={mockBodyStyle}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6, marginBottom: 8, fontWeight: 'bold', color: '#fff' }}>
                    OAuth & Permissions · Scopes
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontWeight: 'bold', color: '#C8A96E' }}>Bot Token Scopes:</div>
                    <div style={{ display: 'flex', gap: 10, background: 'rgba(255,255,255,0.02)', padding: 4, borderRadius: 4 }}>
                        <span style={{ color: '#A78BFA' }}>chat:write</span>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>- Send messages to Slack</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, background: 'rgba(255,255,255,0.02)', padding: 4, borderRadius: 4 }}>
                        <span style={{ color: '#A78BFA' }}>channels:read</span>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>- List channels in workspace</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, background: 'rgba(255,255,255,0.02)', padding: 4, borderRadius: 4 }}>
                        <span style={{ color: '#A78BFA' }}>channels:history</span>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>- Read message history</span>
                    </div>
                    <div style={{ marginTop: 6, color: '#fff' }}>OAuth Token generated:</div>
                    <code style={{ background: 'rgba(74,21,75,0.15)', border: '1px solid #4A154B', padding: 6, borderRadius: 4, color: '#F472B6' }}>
                        xoxb-your-bot-token
                    </code>
                </div>
            </div>
        </div>
    );
}

function SheetsVisualMock() {
    return (
        <div style={mockWindowStyle}>
            <div style={mockTitleBarStyle}>
                <div style={mockDot('#ff5f56')} />
                <div style={mockDot('#ffbd2e')} />
                <div style={mockDot('#27c93f')} />
                <span style={mockTitleStyle}>console.cloud.google.com/iam-admin/serviceaccounts</span>
            </div>
            <div style={mockBodyStyle}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6, marginBottom: 8, fontWeight: 'bold', color: '#fff' }}>
                    Service Account JSON Credentials
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)' }}>Extract the following values from your downloaded JSON:</div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: 6, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div><code>"client_email": "moira-agent@gcp-project.iam.gserviceaccount.com"</code></div>
                        <div><code>"project_id": "gcp-project-id"</code></div>
                        <div><code>"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg..."</code></div>
                    </div>
                    <div style={{ color: '#C8A96E', fontSize: 9, marginTop: 4 }}>
                        💡 Remember: Share your Google Sheet with the Service Account email address as an Editor!
                    </div>
                </div>
            </div>
        </div>
    );
}


// ── Main Onboarding Component ──────────────────────────────────────────────

export function OnboardingFlow() {
    const navigate = useNavigate();
    const [welcomeActive, setWelcomeActive] = useState(true);
    const [activeConnectorId, setActiveConnectorId] = useState<string | null>(null);

    // Initial connector list
    const [connectors, setConnectors] = useState<ConnectorState[]>([
        { id: 'ai', label: 'AI Providers', description: 'Configure active LLM settings to run planning and synthesis.', icon: <Zap className="w-5 h-5" />, color: '#7c3aed', required: true, isConnected: false },
        { id: 'github', label: 'GitHub', description: 'Access repositories, write code, search logs, and manage pull requests.', icon: <Github className="w-5 h-5" />, color: '#6e40c9', required: false, isConnected: false },
        { id: 'jira', label: 'Jira', description: 'Query tickets, update statuses, and log progress automatically.', icon: <Settings className="w-5 h-5" />, color: '#0052cc', required: false, isConnected: false },
        { id: 'slack', label: 'Slack', description: 'Dispatch real-time updates and execute notifications.', icon: <Slack className="w-5 h-5" />, color: '#4a154b', required: false, isConnected: false },
        { id: 'sheets', label: 'Google Sheets', description: 'Log workflow runs and audit logs in spreadsheet tables.', icon: <FileSpreadsheet className="w-5 h-5" />, color: '#0f9d58', required: false, isConnected: false },
    ]);

    // Credentials values state
    const [formData, setFormData] = useState<Record<string, Record<string, string>>>({
        ai: { ACTIVE_PROVIDER: 'nvidia', NVIDIA_API_KEY: '', NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1', NVIDIA_MODEL: 'meta/llama-3.3-70b-instruct', GROQ_API_KEY: '', GROQ_MODEL: 'llama-3.3-70b-versatile', OPENROUTER_API_KEY: '', OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1', OPENROUTER_MODEL: 'meta-llama/llama-3.3-70b-instruct:free', LMSTUDIO_BASE_URL: 'http://localhost:1234/v1', LMSTUDIO_MODEL: 'local-model', LMSTUDIO_API_KEY: 'lm-studio' },
        github: { GITHUB_TOKEN: '', GITHUB_DEFAULT_REPO_OWNER: '' },
        jira: { JIRA_BASE_URL: '', JIRA_EMAIL: '', JIRA_API_TOKEN: '', JIRA_DEFAULT_PROJECT: '' },
        slack: { SLACK_BOT_TOKEN: '', SLACK_DEFAULT_CHANNEL: '' },
        sheets: { GOOGLE_CLIENT_EMAIL: '', GOOGLE_PRIVATE_KEY: '', GOOGLE_PROJECT_ID: '', GOOGLE_AUDIT_SPREADSHEET_ID: '' },
    });

    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

    // Fetch existing configuration to check what's already connected
    useEffect(() => {
        const fetchInitialState = async () => {
            try {
                const res = await authFetch(`${config.apiUrl}/settings/env`);
                if (res.ok) {
                    const currentEnv = await res.json();
                    
                    // Update connected states based on existing keys
                    setConnectors(prev => prev.map(conn => {
                        let isConnected = false;
                        if (conn.id === 'ai') {
                            const provider = currentEnv.active_provider || 'nvidia';
                            isConnected = !!currentEnv[`${provider}_api_key`] || provider === 'lmstudio';
                        } else if (conn.id === 'github') {
                            isConnected = !!currentEnv.github_token;
                        } else if (conn.id === 'jira') {
                            isConnected = !!currentEnv.jira_api_token;
                        } else if (conn.id === 'slack') {
                            isConnected = !!currentEnv.slack_bot_token;
                        } else if (conn.id === 'sheets') {
                            isConnected = !!currentEnv.google_client_email || !!currentEnv.google_service_account_json;
                        }
                        return { ...conn, isConnected };
                    }));

                    // Load loaded values into form
                    setFormData(prev => {
                        const updated = { ...prev };
                        Object.keys(updated).forEach(connKey => {
                            Object.keys(updated[connKey]).forEach(fieldKey => {
                                const val = currentEnv[fieldKey.toLowerCase()];
                                if (val) updated[connKey][fieldKey] = val;
                            });
                        });
                        return updated;
                    });
                }
            } catch (err) {
                console.error('[OnboardingFlow] Error fetching current settings:', err);
            }
        };
        fetchInitialState();
    }, []);

    const validateForm = (connectorId: string) => {
        const errs: Record<string, string> = {};
        const data = formData[connectorId] || {};
        
        if (connectorId === 'ai') {
            const provider = data.ACTIVE_PROVIDER;
            if (provider !== 'lmstudio') {
                const keyName = `${provider.toUpperCase()}_API_KEY`;
                if (!data[keyName]?.trim()) {
                    errs[keyName] = 'API Key is required';
                }
            }
        } else if (connectorId === 'github') {
            if (!data.GITHUB_TOKEN?.trim()) errs.GITHUB_TOKEN = 'GitHub Personal Token is required';
        } else if (connectorId === 'jira') {
            if (!data.JIRA_BASE_URL?.trim()) errs.JIRA_BASE_URL = 'Jira URL is required';
            if (!data.JIRA_EMAIL?.trim()) errs.JIRA_EMAIL = 'Jira login email is required';
            if (!data.JIRA_API_TOKEN?.trim()) errs.JIRA_API_TOKEN = 'Jira API Token is required';
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleTestConnection = async (connectorId: string) => {
        if (!validateForm(connectorId)) return;
        setTestingId(connectorId);
        setTestResult(null);

        // Map frontend form names to backend expected uppercase parameters
        const payloadConfig: Record<string, string> = {};
        const sourceData = formData[connectorId] || {};

        if (connectorId === 'ai') {
            payloadConfig.ACTIVE_PROVIDER = sourceData.ACTIVE_PROVIDER;
            payloadConfig.AI_API_KEY = sourceData[`${sourceData.ACTIVE_PROVIDER.toUpperCase()}_API_KEY`] || '';
            payloadConfig.AI_MODEL = sourceData[`${sourceData.ACTIVE_PROVIDER.toUpperCase()}_MODEL`] || '';
        } else {
            Object.assign(payloadConfig, sourceData);
        }

        try {
            const resp = await authFetch(`${config.apiUrl}/auth/config/${connectorId}/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: payloadConfig }),
            });
            const data = await resp.json();
            setTestResult(data);
        } catch {
            setTestResult({ success: false, message: 'Server connection failed.' });
        } finally {
            setTestingId(null);
        }
    };

    const handleSaveConnection = async (connectorId: string) => {
        if (!validateForm(connectorId)) return;
        setSaving(true);

        const payloadConfig: Record<string, string> = {};
        const sourceData = formData[connectorId] || {};

        // Merge all values to send
        Object.assign(payloadConfig, sourceData);
        
        // Ensure standard keys are mapped
        if (connectorId === 'ai') {
            payloadConfig.ACTIVE_PROVIDER = sourceData.ACTIVE_PROVIDER;
            payloadConfig.AI_API_KEY = sourceData[`${sourceData.ACTIVE_PROVIDER.toUpperCase()}_API_KEY`] || '';
            payloadConfig.AI_MODEL = sourceData[`${sourceData.ACTIVE_PROVIDER.toUpperCase()}_MODEL`] || '';
        }

        try {
            const saveResp = await authFetch(`${config.apiUrl}/auth/config/${connectorId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: payloadConfig }),
            });

            if (saveResp.ok) {
                await authFetch(`${config.apiUrl}/auth/onboarding/save-step`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ step: connectorId }),
                });

                // Update UI state
                setConnectors(prev => prev.map(c => c.id === connectorId ? { ...c, isConnected: true } : c));
                setActiveConnectorId(null);
                setTestResult(null);
            } else {
                setErrors({ _save: 'Failed to persist credentials.' });
            }
        } catch (err) {
            setErrors({ _save: 'Failed to contact server.' });
        } finally {
            setSaving(false);
        }
    };

    const handleFinishOnboarding = async () => {
        const aiConnected = connectors.find(c => c.id === 'ai')?.isConnected;
        if (!aiConnected) {
            alert('AI Provider configuration is required to initiate MOIRA.');
            return;
        }

        try {
            await authFetch(`${config.apiUrl}/auth/onboarding/save-step`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step: 'complete', mark_complete: true }),
            });
        } catch {}
        navigate('/app', { replace: true });
    };

    const toggleSecretVisible = (key: string) => {
        setVisibleSecrets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Render forms dynamically based on selected connector
    const renderForm = (connectorId: string) => {
        const data = formData[connectorId] || {};
        const updateField = (key: string, val: string) => {
            setFormData(prev => ({
                ...prev,
                [connectorId]: { ...prev[connectorId], [key]: val }
            }));
        };

        if (connectorId === 'ai') {
            const active = data.ACTIVE_PROVIDER || 'nvidia';
            const providers = [
                { id: 'nvidia', label: 'NVIDIA NIM', emoji: '🟢' },
                { id: 'groq', label: 'Groq Cloud', emoji: '🔴' },
                { id: 'openrouter', label: 'OpenRouter', emoji: '🟣' },
                { id: 'lmstudio', label: 'LM Studio (Local)', emoji: '🔵' },
            ];

            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={labelStyle}>Select Provider</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                            {providers.map(p => {
                                const selected = active === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => updateField('ACTIVE_PROVIDER', p.id)}
                                        style={{
                                            padding: '8px 14px', borderRadius: 8,
                                            border: `1.5px solid ${selected ? '#C8A96E' : 'rgba(255,255,255,0.08)'}`,
                                            background: selected ? 'rgba(200,169,110,0.12)' : 'rgba(255,255,255,0.02)',
                                            color: selected ? '#E8D5A3' : 'rgba(255,255,255,0.5)',
                                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                            transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6
                                        }}
                                    >
                                        <span>{p.emoji}</span> {p.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {active === 'nvidia' && (
                        <>
                            {renderInputField('NVIDIA_API_KEY', 'API Key', 'nvapi-... key', true, data, updateField)}
                            {renderInputField('NVIDIA_BASE_URL', 'Base URL', '', false, data, updateField)}
                            {renderInputField('NVIDIA_MODEL', 'Model ID', '', false, data, updateField)}
                        </>
                    )}

                    {active === 'groq' && (
                        <>
                            {renderInputField('GROQ_API_KEY', 'API Key', 'gsk_... key', true, data, updateField)}
                            {renderInputField('GROQ_MODEL', 'Model ID', '', false, data, updateField)}
                        </>
                    )}

                    {active === 'openrouter' && (
                        <>
                            {renderInputField('OPENROUTER_API_KEY', 'API Key', 'sk-or-v1-... key', true, data, updateField)}
                            {renderInputField('OPENROUTER_BASE_URL', 'Base URL', '', false, data, updateField)}
                            {renderInputField('OPENROUTER_MODEL', 'Model ID', '', false, data, updateField)}
                        </>
                    )}

                    {active === 'lmstudio' && (
                        <>
                            {renderInputField('LMSTUDIO_BASE_URL', 'Server URL', 'http://localhost:1234/v1', false, data, updateField)}
                            {renderInputField('LMSTUDIO_MODEL', 'Model Name', 'local-model', false, data, updateField)}
                        </>
                    )}
                </div>
            );
        }

        if (connectorId === 'github') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {renderInputField('GITHUB_TOKEN', 'Personal Access Token', 'ghp_...', true, data, updateField)}
                    {renderInputField('GITHUB_DEFAULT_REPO_OWNER', 'Default Repository Owner', 'e.g. username or organization name', false, data, updateField)}
                </div>
            );
        }

        if (connectorId === 'jira') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {renderInputField('JIRA_BASE_URL', 'Jira URL', 'https://your-site.atlassian.net', false, data, updateField)}
                    {renderInputField('JIRA_EMAIL', 'Atlassian Account Email', 'you@example.com', false, data, updateField)}
                    {renderInputField('JIRA_API_TOKEN', 'API Token', 'ATATT...', true, data, updateField)}
                    {renderInputField('JIRA_DEFAULT_PROJECT', 'Default Project Key', 'e.g. SCRUM', false, data, updateField)}
                </div>
            );
        }

        if (connectorId === 'slack') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {renderInputField('SLACK_BOT_TOKEN', 'Slack Bot OAuth Token', 'xoxb-...', true, data, updateField)}
                    {renderInputField('SLACK_DEFAULT_CHANNEL', 'Default Channel ID', 'e.g. C0123456789', false, data, updateField)}
                </div>
            );
        }

        if (connectorId === 'sheets') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {renderInputField('GOOGLE_CLIENT_EMAIL', 'Service Account Client Email', 'name@project.iam.gserviceaccount.com', false, data, updateField)}
                    {renderInputField('GOOGLE_PRIVATE_KEY', 'Private Key', '-----BEGIN PRIVATE KEY-----...', true, data, updateField, true)}
                    {renderInputField('GOOGLE_PROJECT_ID', 'Google Cloud Project ID', 'my-gcp-project', false, data, updateField)}
                    {renderInputField('GOOGLE_AUDIT_SPREADSHEET_ID', 'Audit Spreadsheet ID (Optional)', 'Spreadsheet ID in URL', false, data, updateField)}
                </div>
            );
        }

        return null;
    };

    const renderInputField = (key: string, label: string, placeholder: string, isSecret: boolean, data: Record<string, string>, updateField: (k: string, v: string) => void, isTextArea: boolean = false) => {
        const visible = visibleSecrets[key] || false;
        const err = errors[key];
        
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{label}</label>
                <div style={{ position: 'relative' }}>
                    {isTextArea ? (
                        <textarea
                            value={data[key] || ''}
                            onChange={e => updateField(key, e.target.value)}
                            placeholder={placeholder}
                            rows={3}
                            style={{
                                ...inputStyle,
                                height: 'auto',
                                fontFamily: 'monospace',
                                resize: 'vertical',
                                borderColor: err ? 'rgba(239,68,68,0.4)' : 'rgba(200,169,110,0.15)'
                            }}
                        />
                    ) : (
                        <input
                            type={isSecret && !visible ? 'password' : 'text'}
                            value={data[key] || ''}
                            onChange={e => updateField(key, e.target.value)}
                            placeholder={placeholder}
                            style={{
                                ...inputStyle,
                                paddingRight: isSecret ? 38 : 12,
                                fontFamily: isSecret ? 'monospace' : 'inherit',
                                borderColor: err ? 'rgba(239,68,68,0.4)' : 'rgba(200,169,110,0.15)'
                            }}
                        />
                    )}
                    {isSecret && !isTextArea && (
                        <button
                            type="button"
                            onClick={() => toggleSecretVisible(key)}
                            style={{
                                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'rgba(200,169,110,0.4)', padding: 4
                            }}
                        >
                            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    )}
                </div>
                {err && <span style={{ fontSize: 10.5, color: '#f87171' }}>{err}</span>}
            </div>
        );
    };

    // Render detailed guides dynamically
    const renderGuide = (connectorId: string) => {
        switch (connectorId) {
            case 'ai':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={guideParagraphStyle}>
                            MOIRA runs advanced multi-step execution. Connecting your own provider allows you to pay exactly what you consume.
                        </p>
                        <ul style={guideListStyle}>
                            <li><strong>NVIDIA NIM</strong>: Log in to builds.nvidia.com, claim free credits, and copy your API key (starts with <code>nvapi-</code>).</li>
                            <li><strong>Groq Cloud</strong>: Generate a <code>gsk_</code> token in console.groq.com. It is incredibly fast and cost-efficient.</li>
                            <li><strong>OpenRouter</strong>: Create a key at openrouter.ai to utilize models like Llama 3.3.</li>
                            <li><strong>LM Studio</strong>: Start a local model server locally on your machine on port 1234. No keys needed!</li>
                        </ul>
                    </div>
                );
            case 'github':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={guideParagraphStyle}>
                            Connecting GitHub lets MOIRA check repositories, commit code, read logs, and manage issues.
                        </p>
                        <ol style={guideListStyle}>
                            <li>Go to your <strong>GitHub Settings</strong> {"\u2192"} <strong>Developer Settings</strong>.</li>
                            <li>Select <strong>Personal Access Tokens (classic)</strong> and click <strong>Generate New Token</strong>.</li>
                            <li>Enable scopes: <code style={codeBadgeStyle}>repo</code>, <code style={codeBadgeStyle}>read:user</code>, and <code style={codeBadgeStyle}>workflow</code>.</li>
                            <li>Copy and paste the generated token below.</li>
                        </ol>
                        <GitHubVisualMock />
                    </div>
                );
            case 'jira':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={guideParagraphStyle}>
                            Jira integration permits the Agent to list backlogs, update task statuses, and query project boards.
                        </p>
                        <ol style={guideListStyle}>
                            <li>Visit <strong>Atlassian Security Settings</strong> (id.atlassian.com).</li>
                            <li>Generate a new <strong>API Token</strong> and copy it.</li>
                            <li>Input your Jira Base URL (e.g. <code>https://my-company.atlassian.net</code>), your login email, and the token.</li>
                        </ol>
                        <JiraVisualMock />
                    </div>
                );
            case 'slack':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={guideParagraphStyle}>
                            Connect Slack so that MOIRA can report execution audits or dispatch messages.
                        </p>
                        <ol style={guideListStyle}>
                            <li>Go to <strong>api.slack.com/apps</strong> and select <strong>Create App</strong> (From Scratch).</li>
                            <li>Navigate to <strong>OAuth & Permissions</strong> {"\u2192"} <strong>Scopes</strong> {"\u2192"} <strong>Bot Token Scopes</strong> and add <code>chat:write</code>, <code>channels:read</code>, and <code>channels:history</code>.</li>
                            <li>Click <strong>Install to Workspace</strong> at the top of the page.</li>
                            <li>Copy your new <strong>Bot OAuth Token</strong> (starts with <code>xoxb-</code>) and paste it below.</li>
                        </ol>
                        <SlackVisualMock />
                    </div>
                );
            case 'sheets':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={guideParagraphStyle}>
                            Allows MOIRA to read spreadsheet data or export process logs.
                        </p>
                        <ol style={guideListStyle}>
                            <li>Access your <strong>Google Cloud Console</strong>.</li>
                            <li>Go to <strong>IAM & Admin</strong> {"\u2192"} <strong>Service Accounts</strong> and create a service account.</li>
                            <li>Create a JSON key under the Service Account and download it.</li>
                            <li>Extract the <code>client_email</code>, <code>project_id</code>, and <code>private_key</code> from the file and input them below.</li>
                            <li><strong>Important</strong>: Share your Google Sheets files with the Service Account email address as an Editor!</li>
                        </ol>
                        <SheetsVisualMock />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div style={containerStyle}>
            {/* Background graphics */}
            <div style={ambientBgStyle}>
                <div style={{ ...glowCircleStyle, top: '8%', left: '10%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', width: 600, height: 600 }} />
                <div style={{ ...glowCircleStyle, bottom: '5%', right: '8%', background: 'radial-gradient(circle, rgba(200,169,110,0.06) 0%, transparent 70%)', width: 500, height: 500 }} />
            </div>

            <AnimatePresence mode="wait">
                {welcomeActive ? (
                    // ── WELCOME VIEW ──
                    <motion.div
                        key="welcome"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={welcomeCardStyle}
                    >
                        <div style={cardHeaderStyle}>
                            <div style={logoIconStyle}>🔮</div>
                            <h1 style={titleStyle}>Welcome to MOIRA</h1>
                            <p style={subtitleStyle}>The Fate-weaving Multi-Agent MCP Gateway</p>
                        </div>
                        
                        <div style={{ padding: '24px 32px' }}>
                            <p style={{ color: 'rgba(240,235,248,0.7)', fontSize: 14.5, lineHeight: 1.7, textAlign: 'center', marginBottom: 28 }}>
                                Before we begin executing tasks, we need to connect your developer accounts and configure your AI model keys. Your keys are stored fully isolated and secured under your personal account.
                            </p>

                            <motion.button
                                onClick={() => setWelcomeActive(false)}
                                whileHover={{ scale: 1.02, boxShadow: '0 0 25px rgba(200,169,110,0.2)' }}
                                whileTap={{ scale: 0.98 }}
                                style={primaryButtonStyle}
                            >
                                Let's Configure Your Oracle <ArrowRight className="w-4 h-4" />
                            </motion.button>
                        </div>
                    </motion.div>
                ) : activeConnectorId ? (
                    // ── DETAILED CONNECTOR VIEW ──
                    <motion.div
                        key="connector"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        style={setupLayoutCardStyle}
                    >
                        {/* Title Bar */}
                        <div style={setupHeaderStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ color: '#C8A96E' }}>
                                    {connectors.find(c => c.id === activeConnectorId)?.icon}
                                </span>
                                <h2 style={setupTitleStyle}>
                                    Setup {connectors.find(c => c.id === activeConnectorId)?.label}
                                </h2>
                            </div>
                            <button onClick={() => { setActiveConnectorId(null); setTestResult(null); }} style={closeButtonStyle}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Grid Content */}
                        <div style={setupBodyGridStyle}>
                            {/* Left Panel: Guide */}
                            <div style={setupGuidePanelStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                    <HelpCircle className="w-4 h-4" style={{ color: '#C8A96E' }} />
                                    <span style={{ fontSize: 12, fontWeight: 750, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Configuration Guide</span>
                                </div>
                                {renderGuide(activeConnectorId)}
                            </div>

                            {/* Right Panel: Form */}
                            <div style={setupFormPanelStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                                    <Shield className="w-4 h-4" style={{ color: '#C8A96E' }} />
                                    <span style={{ fontSize: 12, fontWeight: 750, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Credentials Form</span>
                                </div>

                                {renderForm(activeConnectorId)}

                                {errors._save && (
                                    <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>
                                        ⚠ {errors._save}
                                    </div>
                                )}

                                {/* Test Connection Alert */}
                                {testResult && (
                                    <div style={{
                                        marginTop: 14, padding: '10px 14px', borderRadius: 8,
                                        background: testResult.success ? 'rgba(52,211,153,0.06)' : 'rgba(239,68,68,0.06)',
                                        border: `1px solid ${testResult.success ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                        color: testResult.success ? '#34D399' : '#f87171', fontSize: 12.5
                                    }}>
                                        {testResult.success ? '✓ Connection successful!' : '✗ Test failed:'} {testResult.message}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                                    <motion.button
                                        onClick={() => { setActiveConnectorId(null); setTestResult(null); }}
                                        whileTap={{ scale: 0.97 }}
                                        style={secondaryButtonStyle}
                                    >
                                        Cancel
                                    </motion.button>
                                    <motion.button
                                        onClick={() => handleTestConnection(activeConnectorId)}
                                        disabled={testingId === activeConnectorId}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                        style={testConnectionButtonStyle}
                                    >
                                        {testingId === activeConnectorId ? 'Testing...' : 'Test Connection'}
                                    </motion.button>
                                    <motion.button
                                        onClick={() => handleSaveConnection(activeConnectorId)}
                                        disabled={saving}
                                        whileHover={{ scale: 1.02, boxShadow: '0 0 16px rgba(200,169,110,0.15)' }}
                                        whileTap={{ scale: 0.97 }}
                                        style={saveConnectionButtonStyle}
                                    >
                                        {saving ? 'Saving...' : 'Save & Return'}
                                    </motion.button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    // ── INTERACTIVE INTEGRATIONS DASHBOARD ──
                    <motion.div
                        key="dashboard"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={dashboardCardStyle}
                    >
                        <div style={dashboardHeaderStyle}>
                            <h2 style={dashboardTitleStyle}>Oracle Integrations Hub</h2>
                            <p style={dashboardSubtitleStyle}>Select and connect the services you wish to orchestrate</p>
                        </div>

                        <div style={dashboardBodyStyle}>
                            <div style={gridStyle}>
                                {connectors.map(c => (
                                    <motion.div
                                        key={c.id}
                                        whileHover={{ y: -3, border: `1px solid ${c.color}66`, boxShadow: `0 8px 24px ${c.color}15` }}
                                        style={{
                                            ...cardItemStyle,
                                            border: `1px solid ${c.isConnected ? `${c.color}44` : 'rgba(255,255,255,0.06)'}`,
                                            background: c.isConnected ? `linear-gradient(135deg, rgba(8,6,16,0.95) 0%, ${c.color}0a 100%)` : 'rgba(8,6,16,0.5)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <div style={{ padding: 8, borderRadius: 8, background: `${c.color}20`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {c.icon}
                                            </div>
                                            {c.isConnected ? (
                                                <span style={{ fontSize: 10, fontWeight: 700, color: '#34D399', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 20, padding: '2px 8px', letterSpacing: '0.04em' }}>
                                                    CONNECTED
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '2px 8px', letterSpacing: '0.04em' }}>
                                                    {c.required ? 'REQUIRED' : 'OPTIONAL'}
                                                </span>
                                            )}
                                        </div>

                                        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F0EBF8', margin: '0 0 6px 0' }}>{c.label}</h3>
                                        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', margin: '0 0 16px 0', lineHeight: 1.5, height: 36, overflow: 'hidden' }}>{c.description}</p>

                                        <button
                                            onClick={() => setActiveConnectorId(c.id)}
                                            style={{
                                                width: '100%', padding: '7px 12px', borderRadius: 6,
                                                border: `1px solid ${c.isConnected ? 'rgba(200,169,110,0.12)' : `${c.color}55`}`,
                                                background: c.isConnected ? 'rgba(255,255,255,0.02)' : `${c.color}15`,
                                                color: c.isConnected ? 'rgba(200,169,110,0.7)' : '#F0EBF8',
                                                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                                transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                                            }}
                                        >
                                            {c.isConnected ? 'Edit Settings' : 'Connect Service'} <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Warning if AI is not connected */}
                            {!connectors.find(c => c.id === 'ai')?.isConnected && (
                                <div style={{
                                    display: 'flex', gap: 10, padding: '12px 16px', background: 'rgba(239,68,68,0.05)',
                                    border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, marginTop: 20
                                }}>
                                    <AlertTriangle className="w-4 h-4" style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                                    <span style={{ fontSize: 12, color: '#f87171', lineHeight: 1.5 }}>
                                        AI Providers must be configured before you can complete onboarding. MOIRA requires active LLM keys to plan your workflows and process queries.
                                    </span>
                                </div>
                            )}

                            {/* Bottom CTA */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28 }}>
                                <motion.button
                                    onClick={handleFinishOnboarding}
                                    whileHover={{ scale: 1.02, boxShadow: '0 0 24px rgba(200,169,110,0.2)' }}
                                    whileTap={{ scale: 0.98 }}
                                    style={{
                                        ...primaryButtonStyle,
                                        width: 'auto',
                                        padding: '12px 36px',
                                        opacity: connectors.find(c => c.id === 'ai')?.isConnected ? 1 : 0.5,
                                        cursor: connectors.find(c => c.id === 'ai')?.isConnected ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    Finish Onboarding & Enter Oracle <Play className="w-3.5 h-3.5 fill-current" />
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer */}
            <p style={{ marginTop: 28, color: 'rgba(200,169,110,0.15)', fontSize: 11, letterSpacing: '0.05em', fontFamily: 'Cinzel, serif', zIndex: 1 }}>
                Team InnoCrew · Shis Maheta & Dev Patel
            </p>
        </div>
    );
}

// ── Shared Inline Styles ───────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#04020a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    position: 'relative',
    overflowX: 'hidden',
    fontFamily: 'Inter, sans-serif',
};

const ambientBgStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 0,
};

const glowCircleStyle: React.CSSProperties = {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(80px)',
};

const welcomeCardStyle: React.CSSProperties = {
    width: 'min(500px, 95vw)',
    background: 'rgba(8, 6, 16, 0.98)',
    border: '1px solid rgba(200, 169, 110, 0.18)',
    borderRadius: 16,
    boxShadow: '0 40px 120px rgba(0,0,0,0.9), 0 0 60px rgba(74,14,143,0.2)',
    overflow: 'hidden',
    zIndex: 1,
};

const dashboardCardStyle: React.CSSProperties = {
    width: 'min(980px, 95vw)',
    background: 'rgba(8, 6, 16, 0.98)',
    border: '1px solid rgba(200, 169, 110, 0.18)',
    borderRadius: 16,
    boxShadow: '0 40px 120px rgba(0,0,0,0.9), 0 0 60px rgba(74,14,143,0.2)',
    overflow: 'hidden',
    zIndex: 1,
};

const setupLayoutCardStyle: React.CSSProperties = {
    width: 'min(1080px, 95vw)',
    background: 'rgba(8, 6, 16, 0.98)',
    border: '1px solid rgba(200, 169, 110, 0.18)',
    borderRadius: 16,
    boxShadow: '0 40px 120px rgba(0,0,0,0.9), 0 0 60px rgba(74,14,143,0.2)',
    overflow: 'hidden',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
};

const cardHeaderStyle: React.CSSProperties = {
    padding: '32px 32px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    textAlign: 'center',
};

const logoIconStyle: React.CSSProperties = {
    fontSize: 54,
    marginBottom: 16,
};

const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: '#E8D5A3',
    fontFamily: 'Cinzel, serif',
    letterSpacing: '0.04em',
};

const subtitleStyle: React.CSSProperties = {
    margin: '6px 0 0',
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
};

const primaryButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 24px',
    fontSize: 14,
    fontWeight: 750,
    background: 'linear-gradient(135deg, #4A0E8F, #8B35D6)',
    border: '1px solid rgba(200,169,110,0.3)',
    borderRadius: 10,
    color: '#F0EBF8',
    cursor: 'pointer',
    fontFamily: 'Cinzel, serif',
    letterSpacing: '0.06em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.2s',
};

const secondaryButtonStyle: React.CSSProperties = {
    padding: '8px 18px',
    fontSize: 12.5,
    fontWeight: 600,
    background: 'none',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.45)',
    cursor: 'pointer',
    transition: 'all 0.2s',
};

const testConnectionButtonStyle: React.CSSProperties = {
    padding: '8px 18px',
    fontSize: 12.5,
    fontWeight: 700,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(200,169,110,0.2)',
    borderRadius: 8,
    color: '#E8D5A3',
    cursor: 'pointer',
    transition: 'all 0.2s',
};

const saveConnectionButtonStyle: React.CSSProperties = {
    padding: '8px 22px',
    fontSize: 12.5,
    fontWeight: 750,
    background: 'linear-gradient(135deg, #4A0E8F, #8B35D6)',
    border: '1px solid rgba(200,169,110,0.25)',
    borderRadius: 8,
    color: '#F0EBF8',
    cursor: 'pointer',
    transition: 'all 0.2s',
};

const dashboardHeaderStyle: React.CSSProperties = {
    padding: '24px 28px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
};

const dashboardTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 18,
    fontWeight: 750,
    color: '#E8D5A3',
    fontFamily: 'Cinzel, serif',
    letterSpacing: '0.04em',
};

const dashboardSubtitleStyle: React.CSSProperties = {
    margin: '4px 0 0',
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
};

const dashboardBodyStyle: React.CSSProperties = {
    padding: '28px',
};

const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
};

const cardItemStyle: React.CSSProperties = {
    borderRadius: 12,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.25s',
};

const setupHeaderStyle: React.CSSProperties = {
    padding: '16px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.01)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
};

const setupTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 14,
    fontWeight: 800,
    color: '#E8D5A3',
    fontFamily: 'Cinzel, serif',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
};

const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.35)',
    padding: 4,
};

const setupBodyGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    flex: 1,
    overflow: 'hidden',
};

const setupGuidePanelStyle: React.CSSProperties = {
    padding: '24px',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    overflowY: 'auto',
    background: 'rgba(255,255,255,0.005)',
};

const setupFormPanelStyle: React.CSSProperties = {
    padding: '24px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
};

const guideParagraphStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: 'rgba(240, 235, 248, 0.75)',
    lineHeight: 1.6,
    margin: '0 0 12px 0',
};

const guideListStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'rgba(240, 235, 248, 0.55)',
    lineHeight: 1.6,
    paddingLeft: '20px',
    margin: 0,
};

const labelStyle: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 650,
    color: 'rgba(200, 169, 110, 0.75)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(74, 14, 143, 0.04)',
    border: '1px solid rgba(200, 169, 110, 0.15)',
    borderRadius: 8,
    color: '#F0EBF8',
    padding: '10px 12px',
    fontSize: 12.5,
    outline: 'none',
    transition: 'all 0.2s',
    height: 38,
};

const codeBadgeStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4,
    padding: '1px 4px',
    fontSize: 10.5,
    fontFamily: 'monospace',
    color: '#C8A96E',
};
