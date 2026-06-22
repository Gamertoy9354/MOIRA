import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, Key, Eye, EyeOff, ExternalLink, CheckCircle2,
    AlertCircle, Loader2, BookOpen, ShieldCheck,
} from 'lucide-react';

// ──────────────────── Types ─────────────────────────────────────────────────

export interface CredentialField {
    key: string;
    label: string;
    placeholder?: string;
    hint?: string;
    isSecret?: boolean;
    required?: boolean;
}

export interface CredentialInputModalProps {
    open: boolean;
    serviceName: string;
    serviceDescription?: string;
    fields: CredentialField[];
    guideUrl?: string;
    onSubmit: (values: Record<string, string>) => void;
    onViewGuide?: () => void;
    onClose: () => void;
}

// ──────────────────── Field Input ───────────────────────────────────────────

function CredentialFieldInput({
    field, value, onChange, error,
}: {
    field: CredentialField;
    value: string;
    onChange: (v: string) => void;
    error?: string;
}) {
    const [visible, setVisible] = useState(false);

    return (
        <div style={{ marginBottom: 18 }}>
            <label style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 600,
                color: 'rgba(200,169,110,0.65)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 7,
            }}>
                {field.label}
                {field.required && <span style={{ color: '#f87171', fontSize: 10 }}>*</span>}
            </label>

            <div style={{ position: 'relative' }}>
                <input
                    type={field.isSecret && !visible ? 'password' : 'text'}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={field.placeholder ?? `Enter ${field.label}`}
                    style={{
                        width: '100%',
                        background: error ? 'rgba(239,68,68,0.07)' : 'rgba(74,14,143,0.08)',
                        border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(200,169,110,0.15)'}`,
                        borderRadius: 8,
                        color: '#F0EBF8',
                        padding: field.isSecret ? '9px 40px 9px 12px' : '9px 12px',
                        fontSize: 13,
                        fontFamily: 'JetBrains Mono, monospace',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={e => {
                        if (!error) {
                            e.target.style.borderColor = 'rgba(200,169,110,0.45)';
                            e.target.style.boxShadow = '0 0 10px rgba(200,169,110,0.12)';
                        }
                    }}
                    onBlur={e => {
                        if (!error) {
                            e.target.style.borderColor = 'rgba(200,169,110,0.15)';
                            e.target.style.boxShadow = 'none';
                        }
                    }}
                />
                {field.isSecret && (
                    <button
                        type="button"
                        onClick={() => setVisible(v => !v)}
                        style={{
                            position: 'absolute', right: 10, top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'rgba(200,169,110,0.4)', padding: 0,
                        }}
                    >
                        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                )}
            </div>

            {field.hint && !error && (
                <p style={{ fontSize: 11, color: 'rgba(200,169,110,0.3)', marginTop: 5 }}>{field.hint}</p>
            )}
            {error && (
                <p style={{ fontSize: 11, color: '#f87171', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle className="w-3 h-3" /> {error}
                </p>
            )}
        </div>
    );
}

// ──────────────────── Main Component ────────────────────────────────────────

export function CredentialInputModal({
    open, serviceName, serviceDescription, fields,
    onSubmit, onViewGuide, onClose,
}: CredentialInputModalProps) {
    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(fields.map(f => [f.key, '']))
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        fields.forEach(f => {
            if (f.required && !values[f.key]?.trim()) {
                newErrors[f.key] = 'This field is required';
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSubmitting(true);
        await new Promise(r => setTimeout(r, 800));
        setSubmitting(false);
        setSubmitted(true);
        await new Promise(r => setTimeout(r, 900));
        onSubmit(values);
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'rgba(0,0,0,0.72)',
                            backdropFilter: 'blur(10px)',
                            zIndex: 60,
                        }}
                    />

                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 61,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 20, pointerEvents: 'none',
                    }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.93, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.93, y: 20 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                            style={{
                                width: 'min(520px, 100%)',
                                borderRadius: 18,
                                background: 'rgba(8,6,16,0.99)',
                                border: '1px solid rgba(200,169,110,0.2)',
                                boxShadow: '0 40px 120px rgba(0,0,0,0.92), 0 0 80px rgba(74,14,143,0.25)',
                                overflow: 'hidden',
                                pointerEvents: 'all',
                            }}
                        >
                            {/* Top accent line */}
                            <div style={{ height: 2, background: 'linear-gradient(90deg, #4A0E8F, #C8A96E, #4A0E8F)' }} />

                            {/* Header */}
                            <div style={{
                                padding: '20px 24px 16px',
                                borderBottom: '1px solid rgba(200,169,110,0.08)',
                                background: 'linear-gradient(135deg, rgba(74,14,143,0.15), rgba(200,169,110,0.04))',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <motion.div
                                            animate={{ rotate: [0, -5, 5, 0] }}
                                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                                            style={{
                                                width: 44, height: 44, borderRadius: 12,
                                                background: 'linear-gradient(135deg, #4A0E8F, #8B35D6)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0,
                                                boxShadow: '0 0 24px rgba(139,53,214,0.4)',
                                                border: '1px solid rgba(200,169,110,0.2)',
                                            }}
                                        >
                                            <Key className="w-5 h-5 text-white" />
                                        </motion.div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                                                <span style={{
                                                    fontSize: 10, fontWeight: 700, color: '#C8A96E',
                                                    textTransform: 'uppercase', letterSpacing: '0.1em',
                                                    fontFamily: 'Cinzel, serif',
                                                }}>
                                                    New Thread Woven
                                                </span>
                                            </div>
                                            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#F0EBF8', margin: 0, fontFamily: 'Cinzel, serif' }}>
                                                {serviceName} — Keys Required
                                            </h2>
                                            {serviceDescription && (
                                                <p style={{ fontSize: 12, color: 'rgba(200,169,110,0.45)', marginTop: 2 }}>
                                                    {serviceDescription}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(200,169,110,0.4)', padding: 4, flexShrink: 0 }}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Info strip */}
                                <div style={{
                                    marginTop: 14, padding: '9px 12px',
                                    background: 'rgba(74,14,143,0.12)',
                                    border: '1px solid rgba(200,169,110,0.15)',
                                    borderRadius: 8,
                                    display: 'flex', alignItems: 'center', gap: 8,
                                }}>
                                    <ShieldCheck className="w-4 h-4" style={{ color: '#C8A96E', flexShrink: 0 }} />
                                    <p style={{ fontSize: 12, color: 'rgba(240,235,248,0.5)', margin: 0 }}>
                                        MOIRA wove a <strong style={{ color: 'rgba(240,235,248,0.75)' }}>{serviceName}</strong> connector.
                                        Provide your access keys to continue the workflow.
                                    </p>
                                </div>
                            </div>

                            {/* Body */}
                            <div style={{ padding: '22px 24px' }}>
                                {fields.map(field => (
                                    <CredentialFieldInput
                                        key={field.key}
                                        field={field}
                                        value={values[field.key] ?? ''}
                                        onChange={v => {
                                            setValues(prev => ({ ...prev, [field.key]: v }));
                                            if (errors[field.key]) setErrors(prev => ({ ...prev, [field.key]: '' }));
                                        }}
                                        error={errors[field.key]}
                                    />
                                ))}
                            </div>

                            {/* Footer */}
                            <div style={{
                                padding: '14px 24px',
                                borderTop: '1px solid rgba(200,169,110,0.08)',
                                background: 'rgba(0,0,0,0.3)',
                                display: 'flex', alignItems: 'center', gap: 10,
                            }}>
                                {onViewGuide && (
                                    <motion.button
                                        onClick={onViewGuide}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '7px 14px', fontSize: 12.5, fontWeight: 600,
                                            background: 'rgba(200,169,110,0.05)',
                                            border: '1px solid rgba(200,169,110,0.12)',
                                            borderRadius: 8, color: 'rgba(200,169,110,0.55)', cursor: 'pointer',
                                        }}
                                        whileHover={{ background: 'rgba(200,169,110,0.1)', color: '#C8A96E' }}
                                        whileTap={{ scale: 0.97 }}
                                    >
                                        <BookOpen className="w-3.5 h-3.5" />
                                        Oracle Guide
                                        <ExternalLink className="w-3 h-3 opacity-60" />
                                    </motion.button>
                                )}

                                <div style={{ flex: 1 }} />

                                <motion.button
                                    onClick={onClose}
                                    style={{
                                        padding: '7px 16px', fontSize: 12.5, fontWeight: 600,
                                        background: 'rgba(200,169,110,0.04)',
                                        border: '1px solid rgba(200,169,110,0.1)',
                                        borderRadius: 8, color: 'rgba(200,169,110,0.45)', cursor: 'pointer',
                                    }}
                                    whileHover={{ background: 'rgba(200,169,110,0.08)', color: 'rgba(200,169,110,0.7)' }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    Skip for now
                                </motion.button>

                                <motion.button
                                    onClick={handleSubmit}
                                    disabled={submitting || submitted}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 7,
                                        padding: '7px 22px', fontSize: 12.5, fontWeight: 700,
                                        background: submitted
                                            ? 'linear-gradient(135deg, #16a34a, #15803d)'
                                            : 'linear-gradient(135deg, #4A0E8F, #8B35D6)',
                                        border: `1px solid ${submitted ? 'rgba(52,211,153,0.3)' : 'rgba(200,169,110,0.3)'}`,
                                        borderRadius: 8, color: '#F0EBF8', cursor: submitting ? 'wait' : 'pointer',
                                        boxShadow: submitted
                                            ? '0 0 20px rgba(22,163,74,0.35)'
                                            : '0 0 20px rgba(74,14,143,0.45)',
                                        transition: 'background 0.3s, box-shadow 0.3s',
                                        opacity: (submitting || submitted) ? 0.9 : 1,
                                    }}
                                    whileHover={!submitting && !submitted ? { scale: 1.02, boxShadow: '0 0 28px rgba(200,169,110,0.25)' } : {}}
                                    whileTap={!submitting && !submitted ? { scale: 0.97 } : {}}
                                >
                                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {submitted && <CheckCircle2 className="w-4 h-4" />}
                                    {!submitting && !submitted && <Key className="w-4 h-4" />}
                                    {submitting ? 'Sealing…' : submitted ? 'Sealed! Continuing…' : 'Seal & Continue'}
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
