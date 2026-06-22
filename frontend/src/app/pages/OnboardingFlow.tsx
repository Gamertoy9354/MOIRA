import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Github, ExternalLink, ChevronRight, Zap, ArrowRight, X, Eye, EyeOff } from 'lucide-react';
import { authFetch, supabase } from '../../lib/supabase';
import { config } from '../../config';

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
    { id: 'welcome', title: 'Welcome to MOIRA', icon: 'Ω' },
    { id: 'ai', title: 'AI Provider', icon: '🧠' },
    { id: 'github', title: 'GitHub', icon: '🐙' },
    { id: 'jira', title: 'Jira', icon: '🔷' },
    { id: 'slack', title: 'Slack', icon: '💬' },
    { id: 'sheets', title: 'Google Sheets', icon: '📊' },
    { id: 'ready', title: 'You\'re Ready', icon: '✨' },
];

// ── Connector field configs ───────────────────────────────────────────────────

const CONNECTOR_FIELDS: Record<string, Array<{ key: string; label: string; hint: string; url?: string; urlLabel?: string; secret?: boolean; required?: boolean }>> = {
    ai: [
        {
            key: 'ACTIVE_PROVIDER',
            label: 'AI Provider',
            hint: 'Choose: nvidia, groq, openrouter, or lmstudio',
            required: true,
        },
        {
            key: 'AI_API_KEY',
            label: 'API Key',
            hint: 'Enter the API key for your chosen provider (or "lm-studio" for LM Studio)',
            secret: true,
            required: true,
        },
        {
            key: 'AI_MODEL',
            label: 'Model ID (Optional)',
            hint: 'Override the default model (e.g. meta/llama-3.3-70b-instruct)',
            required: false,
        },
    ],
    github: [
        {
            key: 'GITHUB_TOKEN',
            label: 'Personal Access Token',
            hint: 'Needs: repo, read:user, workflow scopes',
            url: 'https://github.com/settings/tokens/new',
            urlLabel: 'Generate on GitHub →',
            secret: true,
            required: true,
        },
    ],
    jira: [
        { key: 'JIRA_DOMAIN', label: 'Your Jira Domain', hint: 'e.g. yourcompany.atlassian.net (no https://)', required: true },
        { key: 'JIRA_EMAIL', label: 'Your Jira Email', hint: 'The email you log in with', required: true },
        {
            key: 'JIRA_API_TOKEN',
            label: 'API Token',
            hint: 'Create at id.atlassian.com/manage/api-tokens',
            url: 'https://id.atlassian.com/manage/api-tokens',
            urlLabel: 'Create API Token →',
            secret: true,
            required: true,
        },
    ],
    slack: [
        {
            key: 'SLACK_WEBHOOK_URL',
            label: 'Incoming Webhook URL',
            hint: 'Create a Slack App → Incoming Webhooks → Activate',
            url: 'https://api.slack.com/apps',
            urlLabel: 'Create Slack App →',
            secret: true,
            required: false,
        },
    ],
    sheets: [
        { key: 'GOOGLE_SHEET_ID', label: 'Google Spreadsheet ID', hint: 'The long ID in the Sheet URL', required: false },
        { key: 'GOOGLE_SERVICE_ACCOUNT_JSON', label: 'Service Account JSON', hint: 'Paste the full contents of your service account .json file', secret: true, required: false },
    ],
};

// ── Field Input ───────────────────────────────────────────────────────────────

function FieldInput({ field, value, onChange, error }: {
    field: typeof CONNECTOR_FIELDS['github'][0];
    value: string;
    onChange: (v: string) => void;
    error?: string;
}) {
    const [visible, setVisible] = useState(false);
    return (
        <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(200,169,110,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {field.label} {field.required && <span style={{ color: '#f87171' }}>*</span>}
                </label>
                {field.url && (
                    <a href={field.url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#C8A96E', textDecoration: 'none', opacity: 0.8 }}>
                        {field.urlLabel} <ExternalLink size={10} />
                    </a>
                )}
            </div>
            <div style={{ position: 'relative' }}>
                {field.key === 'GOOGLE_SERVICE_ACCOUNT_JSON' ? (
                    <textarea
                        value={value} onChange={e => onChange(e.target.value)}
                        placeholder='{ "type": "service_account", ... }'
                        rows={4}
                        style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'rgba(74,14,143,0.08)', border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(200,169,110,0.15)'}`,
                            borderRadius: 8, color: '#F0EBF8', padding: '10px 12px',
                            fontSize: 12, fontFamily: 'JetBrains Mono, monospace', outline: 'none',
                            resize: 'vertical', transition: 'border-color 0.2s',
                        }}
                        onFocus={e => { e.target.style.borderColor = 'rgba(200,169,110,0.45)'; }}
                        onBlur={e => { e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(200,169,110,0.15)'; }}
                    />
                ) : (
                    <input
                        type={field.secret && !visible ? 'password' : 'text'}
                        value={value} onChange={e => onChange(e.target.value)}
                        placeholder={`Enter ${field.label}`}
                        style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'rgba(74,14,143,0.08)', border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(200,169,110,0.15)'}`,
                            borderRadius: 8, color: '#F0EBF8', padding: field.secret ? '10px 38px 10px 12px' : '10px 12px',
                            fontSize: 13, fontFamily: 'JetBrains Mono, monospace', outline: 'none', transition: 'border-color 0.2s',
                        }}
                        onFocus={e => { e.target.style.borderColor = 'rgba(200,169,110,0.45)'; }}
                        onBlur={e => { e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(200,169,110,0.15)'; }}
                    />
                )}
                {field.secret && field.key !== 'GOOGLE_SERVICE_ACCOUNT_JSON' && (
                    <button type="button" onClick={() => setVisible(v => !v)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(200,169,110,0.4)', padding: 0 }}>
                        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                )}
            </div>
            <p style={{ fontSize: 11, color: 'rgba(200,169,110,0.35)', marginTop: 5 }}>{field.hint}</p>
            {error && <p style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>⚠ {error}</p>}
        </div>
    );
}

// ── Connector Step ────────────────────────────────────────────────────────────

function ConnectorStep({ connector, onNext, onSkip, stepIdx }: {
    connector: string; onNext: (saved: boolean) => void; onSkip: () => void; stepIdx: number;
}) {
    const fields = CONNECTOR_FIELDS[connector] || [];
    const [values, setValues] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [saving, setSaving] = useState(false);

    const validate = () => {
        const errs: Record<string, string> = {};
        fields.forEach(f => { if (f.required && !values[f.key]?.trim()) errs[f.key] = 'Required'; });
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleTest = async () => {
        if (!validate()) return;
        setTesting(true);
        setTestResult(null);
        try {
            const resp = await authFetch(`${config.apiUrl}/auth/config/${connector}/test`, {
                method: 'POST', body: JSON.stringify({ config: values }),
            });
            const data = await resp.json();
            setTestResult(data);
        } catch {
            setTestResult({ success: false, message: 'Network error — check your connection' });
        }
        setTesting(false);
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            await authFetch(`${config.apiUrl}/auth/config/${connector}`, {
                method: 'POST', body: JSON.stringify({ config: values }),
            });
            await authFetch(`${config.apiUrl}/auth/onboarding/save-step`, {
                method: 'POST', body: JSON.stringify({ step: connector }),
            });
            onNext(true);
        } catch {
            setErrors({ _save: 'Failed to save. Try again.' });
        }
        setSaving(false);
    };

    const stepInfo: Record<string, { why: string; optional: boolean }> = {
        ai: { why: 'Connect your own AI key so MOIRA can plan workflows and synthesize tools using your own AI budget.', optional: false },
        github: { why: 'Lets MOIRA read PRs, issues, repos, and trigger workflows on your behalf.', optional: false },
        jira: { why: 'Allows MOIRA to create/update Jira tickets and track project progress automatically.', optional: false },
        slack: { why: 'MOIRA sends real-time workflow updates and alerts to your Slack channels.', optional: true },
        sheets: { why: 'MOIRA writes workflow audit logs and outputs directly to your Google Sheets.', optional: true },
    };
    const info = stepInfo[connector] || { why: '', optional: true };

    return (
        <div>
            {/* Why section */}
            <div style={{ padding: '10px 14px', background: 'rgba(74,14,143,0.1)', border: '1px solid rgba(200,169,110,0.12)', borderRadius: 10, marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: 'rgba(240,235,248,0.65)', margin: 0, lineHeight: 1.6 }}>
                    <strong style={{ color: '#C8A96E' }}>Why?</strong> {info.why}
                    {info.optional && <span style={{ color: 'rgba(200,169,110,0.4)', fontSize: 11, marginLeft: 8 }}>(optional)</span>}
                </p>
            </div>

            {/* Fields */}
            {fields.map(f => (
                <FieldInput key={f.key} field={f} value={values[f.key] || ''} onChange={v => setValues(p => ({ ...p, [f.key]: v }))} error={errors[f.key]} />
            ))}

            {/* Test result */}
            <AnimatePresence>
                {testResult && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ padding: '10px 14px', background: testResult.success ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${testResult.success ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 9, marginBottom: 16 }}>
                        <p style={{ fontSize: 13, color: testResult.success ? '#34D399' : '#f87171', margin: 0 }}>
                            {testResult.success ? '✓' : '✗'} {testResult.message}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <motion.button onClick={onSkip} whileHover={{ opacity: 0.8 }} whileTap={{ scale: 0.97 }}
                    style={{ padding: '9px 18px', fontSize: 13, background: 'none', border: '1px solid rgba(200,169,110,0.12)', borderRadius: 9, color: 'rgba(200,169,110,0.45)', cursor: 'pointer' }}>
                    Skip for now
                </motion.button>
                <motion.button onClick={handleTest} disabled={testing} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, background: 'rgba(74,14,143,0.2)', border: '1px solid rgba(200,169,110,0.2)', borderRadius: 9, color: '#C8A96E', cursor: testing ? 'wait' : 'pointer' }}>
                    {testing ? 'Testing…' : 'Test Connection'}
                </motion.button>
                <motion.button onClick={handleSave} disabled={saving} whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(200,169,110,0.2)' }} whileTap={{ scale: 0.97 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 22px', fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, #4A0E8F, #8B35D6)', border: '1px solid rgba(200,169,110,0.25)', borderRadius: 9, color: '#F0EBF8', cursor: saving ? 'wait' : 'pointer' }}>
                    {saving ? 'Saving…' : 'Save & Continue'} {!saving && <ArrowRight size={15} />}
                </motion.button>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function OnboardingFlow() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

    const goNext = (saved?: boolean) => {
        if (saved) setCompletedSteps(prev => new Set(prev).add(currentStep));
        setCurrentStep(s => Math.min(s + 1, STEPS.length - 1));
    };

    const handleFinish = async () => {
        try {
            await authFetch(`${config.apiUrl}/auth/onboarding/save-step`, {
                method: 'POST', body: JSON.stringify({ step: 'complete', mark_complete: true }),
            });
        } catch { /* swallow */ }
        navigate('/app', { replace: true });
    };

    const step = STEPS[currentStep];

    return (
        <div style={{
            minHeight: '100vh', background: '#080610', display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 20, position: 'relative', overflow: 'hidden', fontFamily: 'Inter, sans-serif',
        }}>
            {/* Background */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '10%', left: '10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,14,143,0.15) 0%, transparent 70%)', filter: 'blur(60px)' }} />
                <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,169,110,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />
            </div>

            {/* Progress indicator */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 32, zIndex: 1 }}>
                {STEPS.map((s, i) => (
                    <div key={s.id} style={{
                        width: i === currentStep ? 28 : 8, height: 8, borderRadius: 4,
                        background: completedSteps.has(i) ? '#34D399' : i === currentStep ? '#C8A96E' : 'rgba(200,169,110,0.15)',
                        transition: 'all 0.3s',
                    }} />
                ))}
            </div>

            {/* Card */}
            <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{
                    width: 'min(560px, 95vw)', background: 'rgba(13,9,32,0.95)',
                    border: '1px solid rgba(200,169,110,0.18)', borderRadius: 20,
                    boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 60px rgba(74,14,143,0.2)',
                    overflow: 'hidden', zIndex: 1,
                }}
            >
                {/* Top stripe */}
                <div style={{ height: 2, background: 'linear-gradient(90deg, #4A0E8F, #C8A96E, #4A0E8F)' }} />

                {/* Header */}
                <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid rgba(200,169,110,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 28 }}>{step.icon}</div>
                        <div>
                            <p style={{ fontSize: 11, color: 'rgba(200,169,110,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px', fontFamily: 'Cinzel, serif' }}>
                                Step {currentStep + 1} of {STEPS.length}
                            </p>
                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#E8D5A3', fontFamily: 'Cinzel, serif', letterSpacing: '0.04em' }}>
                                {step.title}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 28px 24px' }}>
                    {currentStep === 0 && (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <motion.div
                                initial={{ scale: 0 }} animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                style={{ fontSize: 64, marginBottom: 20, display: 'block' }}
                            >
                                🔮
                            </motion.div>
                            <p style={{ fontSize: 15, color: 'rgba(240,235,248,0.7)', lineHeight: 1.7, marginBottom: 20 }}>
                                MOIRA is your AI-powered MCP orchestration engine. In the next few steps, we'll connect your tools so MOIRA can weave workflows across them automatically.
                            </p>
                            <p style={{ fontSize: 13, color: 'rgba(200,169,110,0.5)', marginBottom: 28 }}>
                                You can skip any step and configure later in Settings.
                            </p>
                            <motion.button
                                onClick={() => goNext()}
                                whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(200,169,110,0.2)' }}
                                whileTap={{ scale: 0.97 }}
                                style={{
                                    padding: '13px 32px', fontSize: 15, fontWeight: 700,
                                    background: 'linear-gradient(135deg, #4A0E8F, #8B35D6)',
                                    border: '1px solid rgba(200,169,110,0.3)', borderRadius: 12,
                                    color: '#F0EBF8', cursor: 'pointer', fontFamily: 'Cinzel, serif',
                                    display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto',
                                }}
                            >
                                Begin Setup <ArrowRight size={16} />
                            </motion.button>
                        </div>
                    )}

                    {currentStep > 0 && currentStep < STEPS.length - 1 && (
                        <ConnectorStep
                            connector={STEPS[currentStep].id}
                            stepIdx={currentStep}
                            onNext={goNext}
                            onSkip={() => goNext(false)}
                        />
                    )}

                    {currentStep === STEPS.length - 1 && (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                style={{ fontSize: 64, marginBottom: 20 }}
                            >
                                ✨
                            </motion.div>
                            <h3 style={{ fontSize: 22, fontFamily: 'Cinzel, serif', color: '#E8D5A3', marginBottom: 12 }}>
                                MOIRA is Ready
                            </h3>
                            <p style={{ fontSize: 14, color: 'rgba(240,235,248,0.6)', lineHeight: 1.7, marginBottom: 28 }}>
                                Your fate engine is configured. You can always add or update integrations in Settings. Time to weave your first workflow.
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
                                {STEPS.slice(1, -1).map((s, i) => (
                                    <span key={s.id} style={{
                                        padding: '4px 12px', fontSize: 12, borderRadius: 20,
                                        background: completedSteps.has(i + 1) ? 'rgba(52,211,153,0.1)' : 'rgba(200,169,110,0.05)',
                                        border: `1px solid ${completedSteps.has(i + 1) ? 'rgba(52,211,153,0.3)' : 'rgba(200,169,110,0.1)'}`,
                                        color: completedSteps.has(i + 1) ? '#34D399' : 'rgba(200,169,110,0.4)',
                                    }}>
                                        {completedSteps.has(i + 1) ? '✓ ' : ''}{s.title}
                                    </span>
                                ))}
                            </div>
                            <motion.button
                                onClick={handleFinish}
                                whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(200,169,110,0.25)' }}
                                whileTap={{ scale: 0.97 }}
                                style={{
                                    padding: '13px 36px', fontSize: 15, fontWeight: 700,
                                    background: 'linear-gradient(135deg, #4A0E8F, #8B35D6)',
                                    border: '1px solid rgba(200,169,110,0.3)', borderRadius: 12,
                                    color: '#F0EBF8', cursor: 'pointer', fontFamily: 'Cinzel, serif',
                                    display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto',
                                }}
                            >
                                Enter the Oracle <Zap size={16} />
                            </motion.button>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Footer */}
            <p style={{ marginTop: 24, color: 'rgba(200,169,110,0.2)', fontSize: 11, letterSpacing: '0.05em', fontFamily: 'Cinzel, serif', zIndex: 1 }}>
                Team InnoCrew · Shis Maheta & Dev Patel
            </p>
        </div>
    );
}
