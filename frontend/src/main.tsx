import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './app/app';
import { LandingPage } from './app/pages/LandingPage';
import { LoginPage } from './app/pages/LoginPage';
import { AuthCallback } from './app/pages/AuthCallback';
import { OnboardingFlow } from './app/pages/OnboardingFlow';
import { PrivacyPolicyPage } from './app/pages/PrivacyPolicyPage';
import { TermsOfServicePage } from './app/pages/TermsOfServicePage';
import { AuthGuard } from './app/components/AuthGuard';
import './styles/index.css';
import { Toaster } from 'sonner';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                {/* Public routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />

                {/* Protected routes */}
                <Route path="/onboarding" element={
                    <AuthGuard><OnboardingFlow /></AuthGuard>
                } />
                <Route path="/app" element={
                    <AuthGuard><App /></AuthGuard>
                } />

                {/* Catch-all → landing */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>

        <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
                style: {
                    background: 'rgba(10,6,22,0.97)',
                    border: '1px solid rgba(200,169,110,0.25)',
                    color: 'rgba(255,255,255,0.9)',
                },
            }}
        />
    </React.StrictMode>,
);
