import React, { useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import { emitAuthChange } from '../utils/authEvents.js';
import { confirmAuthenticatedSession } from '../utils/sessionAuth.js';

axios.defaults.withCredentials = true;

export default function VerifyEmailCode() {
    const location = useLocation();
    const navigate = useNavigate();
    const [email, setEmail] = useState(location.state?.email || '');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [verified, setVerified] = useState(false);

    const normalizeCode = (value) => value.replace(/\D/g, '').slice(0, 6);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');

        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }

        if (code.length !== 6) {
            setError('Please enter the 6-digit code from your email.');
            return;
        }

        setLoading(true);
        try {
            await axios.get('/sanctum/csrf-cookie');
            const res = await axios.post('/api/auth/verify-email-code', {
                email,
                code,
            });
            await confirmAuthenticatedSession();
            setVerified(true);
            setMessage(res.data?.message || 'Your email has been verified.');
            emitAuthChange('login');
            window.setTimeout(() => navigate('/dashboard'), 900);
        } catch (err) {
            setError(err.response?.data?.message || 'This verification code is invalid or has expired.');
        } finally {
            setLoading(false);
        }
    };

    const resend = async () => {
        setError('');
        setMessage('');

        if (!email.trim()) {
            setError('Please enter your email address before requesting a new code.');
            return;
        }

        setResending(true);
        try {
            await axios.get('/sanctum/csrf-cookie');
            const res = await axios.post('/api/auth/resend-email-code', { email });
            setMessage(res.data?.message || 'Verification code sent.');
        } catch (err) {
            setError(err.response?.data?.message || 'We could not send a new code. Try again in a moment.');
        } finally {
            setResending(false);
        }
    };

    const hasError = Boolean(error);

    return (
        <div className="login-page login-page--spa">
            <div className="login-shell">
                <div className="login-box login-box--spa">
                    <div className="login-brand-row">
                        <img src="/images/logo.png" alt="" width={48} height={48} className="login-brand-logo" />
                    </div>
                    <p className="login-eyebrow">Check your inbox</p>
                    <h2>{verified ? 'Email verified' : 'Enter verification code'}</h2>

                    {verified ? (
                        <div className="reset-result reset-result--success" role="status" aria-live="polite">
                            <CheckCircle2 size={34} aria-hidden="true" />
                            <p className="reset-result-title">You are verified</p>
                            <p className="reset-result-text">{message}</p>
                        </div>
                    ) : (
                        <>
                            <div className="reset-result reset-result--success" role="status">
                                <MailCheck size={34} aria-hidden="true" />
                                <p className="reset-result-title">Verification code sent</p>
                                <p className="reset-result-text">
                                    Enter the 6-digit code we sent to your email. Codes expire after 10 minutes.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} noValidate>
                                {hasError ? (
                                    <div
                                        id="verify-code-error-message"
                                        className="error-message error-message-visible"
                                        role="alert"
                                        aria-live="polite"
                                    >
                                        <span className="error-message-icon" aria-hidden="true">!</span>
                                        <span className="error-message-text">{error}</span>
                                    </div>
                                ) : null}
                                {message ? <div className="success-message" role="status">{message}</div> : null}

                                <div className="form-group">
                                    <label htmlFor="verify-email-code-email">Email</label>
                                    <input
                                        type="email"
                                        id="verify-email-code-email"
                                        name="email"
                                        value={email}
                                        onChange={(event) => {
                                            setEmail(event.target.value);
                                            if (error) setError('');
                                        }}
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                        disabled={loading || resending}
                                        aria-invalid={hasError}
                                        aria-describedby={hasError ? 'verify-code-error-message' : undefined}
                                        className={hasError ? 'input-error' : undefined}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="verify-email-code">Verification code</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        id="verify-email-code"
                                        name="code"
                                        value={code}
                                        onChange={(event) => {
                                            setCode(normalizeCode(event.target.value));
                                            if (error) setError('');
                                        }}
                                        placeholder="123456"
                                        autoComplete="one-time-code"
                                        autoFocus
                                        disabled={loading || resending}
                                        maxLength={6}
                                        aria-invalid={hasError}
                                        aria-describedby={hasError ? 'verify-code-error-message' : undefined}
                                        className={`verification-code-input${hasError ? ' input-error' : ''}`}
                                    />
                                </div>

                                <button type="submit" className="login-submit" disabled={loading || resending}>
                                    <span className="login-submit-inner">
                                        {loading ? (
                                            <>
                                                <Loader2 size={18} className="login-submit-spinner" aria-hidden="true" />
                                                Verifying...
                                            </>
                                        ) : (
                                            'Verify and sign in'
                                        )}
                                    </span>
                                </button>
                            </form>

                            <div className="login-footer login-footer--stack">
                                <p className="login-footer-line">
                                    <button type="button" className="login-text-button" onClick={resend} disabled={loading || resending}>
                                        {resending ? 'Sending...' : 'Resend code'}
                                    </button>
                                </p>
                                <p className="login-footer-line">
                                    <Link to="/login">Back to sign in</Link>
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
