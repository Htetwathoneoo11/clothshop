import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

axios.defaults.withCredentials = true;

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
    const initialEmail = useMemo(() => searchParams.get('email') || '', [searchParams]);
    const [form, setForm] = useState({
        email: initialEmail,
        password: '',
        password_confirmation: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [linkStatus, setLinkStatus] = useState('checking');

    const markLinkInvalid = useCallback((text) => {
        setLinkStatus('invalid');
        setError(text || 'This reset link has already been used or has expired. Please request a new one.');
        setMessage('');
    }, []);

    const checkResetLink = useCallback(async () => {
        if (!token || !form.email.trim()) {
            markLinkInvalid('This reset link is missing required information. Please request a new one.');
            return;
        }

        setLinkStatus((current) => (current === 'success' ? current : 'checking'));
        try {
            await axios.post('/api/auth/validate-reset-token', {
                token,
                email: form.email,
            });
            setLinkStatus('valid');
            setError('');
        } catch (err) {
            markLinkInvalid(err.response?.data?.message);
        }
    }, [form.email, markLinkInvalid, token]);

    useEffect(() => {
        checkResetLink();
    }, [checkResetLink]);

    useEffect(() => {
        const handleFocus = () => {
            if (linkStatus !== 'success') {
                checkResetLink();
            }
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && linkStatus !== 'success') {
                checkResetLink();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [checkResetLink, linkStatus]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (error) setError('');
        if (message) setMessage('');
    };

    const validate = () => {
        if (!token) return 'This reset link is missing a token.';
        if (!form.email.trim()) return 'Please enter your email address.';
        if (!form.password) return 'Please enter a new password.';
        if (form.password.length < 8) return 'Password must be at least 8 characters.';
        if (form.password_confirmation !== form.password) return 'Passwords do not match.';
        return '';
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        try {
            await axios.get('/sanctum/csrf-cookie');
            const response = await axios.post('/api/auth/reset-password', {
                token,
                ...form,
            });
            setLinkStatus('success');
            setForm((prev) => ({
                ...prev,
                password: '',
                password_confirmation: '',
            }));
            setMessage(response.data?.message || 'Your password has been reset. You can now sign in.');
        } catch (err) {
            const fieldErrors = err.response?.data?.errors;
            const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : '';
            const message = err.response?.data?.message;
            const fallback = 'We could not reset your password. Please request a new reset link.';
            const nextError = (typeof firstFieldError === 'string' && firstFieldError.trim() && firstFieldError) ||
                (typeof message === 'string' && message.trim() && message) ||
                fallback;
            if (err.response?.status === 422 && typeof message === 'string' && message.includes('reset link')) {
                markLinkInvalid(nextError);
            } else {
                setError(nextError);
            }
        } finally {
            setLoading(false);
        }
    };

    const hasError = Boolean(error);
    const isChecking = linkStatus === 'checking';
    const isLinkInvalid = linkStatus === 'invalid';
    const isSuccess = linkStatus === 'success';

    return (
        <div className="login-page login-page--spa">
            <div className="login-shell">
                <div className="login-box login-box--spa">
                    <div className="login-brand-row">
                        <img src="/images/logo.png" alt="" width={48} height={48} className="login-brand-logo" />
                    </div>
                    <p className="login-eyebrow">Almost there</p>
                    <h2>{isSuccess ? 'Password reset' : 'Choose a new password'}</h2>

                    {isChecking && (
                        <div className="auth-state-message" role="status" aria-live="polite">
                            <Loader2 size={18} className="login-submit-spinner" aria-hidden="true" />
                            Checking reset link...
                        </div>
                    )}

                    {isLinkInvalid && (
                        <div className="reset-result reset-result--error" role="alert" aria-live="polite">
                            <XCircle size={34} aria-hidden="true" />
                            <p className="reset-result-title">Reset link unavailable</p>
                            <p className="reset-result-text">{error}</p>
                        </div>
                    )}

                    {isSuccess && (
                        <div className="reset-result reset-result--success" role="status" aria-live="polite">
                            <CheckCircle2 size={34} aria-hidden="true" />
                            <p className="reset-result-title">Password reset successfully</p>
                            <p className="reset-result-text">{message}</p>
                        </div>
                    )}

                    {!isChecking && !isLinkInvalid && !isSuccess && (
                        <form onSubmit={handleSubmit} noValidate>
                            {hasError && (
                                <div
                                    id="reset-password-error-message"
                                    className="error-message error-message-visible"
                                    role="alert"
                                    aria-live="polite"
                                >
                                    <span className="error-message-icon" aria-hidden="true">!</span>
                                    <span className="error-message-text">{error}</span>
                                </div>
                            )}
                        <div className="form-group">
                            <label htmlFor="reset-password-email">Email</label>
                            <input
                                type="email"
                                id="reset-password-email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="you@example.com"
                                autoComplete="email"
                                autoFocus={!initialEmail}
                                disabled={loading}
                                aria-invalid={hasError}
                                aria-describedby={hasError ? 'reset-password-error-message' : undefined}
                                className={hasError ? 'input-error' : undefined}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="reset-password-new">New password</label>
                            <div className="password-wrap">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="reset-password-new"
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder="At least 8 characters"
                                    autoComplete="new-password"
                                    disabled={loading}
                                    aria-invalid={hasError}
                                    aria-describedby={hasError ? 'reset-password-error-message' : undefined}
                                    className={hasError ? 'input-error' : undefined}
                                />
                                <button
                                    type="button"
                                    className={`password-toggle${showPassword ? ' password-toggle-active' : ''}`}
                                    onClick={() => setShowPassword((state) => !state)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    aria-pressed={showPassword}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                    disabled={loading}
                                >
                                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="reset-password-confirmation">Confirm password</label>
                            <div className="password-wrap">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    id="reset-password-confirmation"
                                    name="password_confirmation"
                                    value={form.password_confirmation}
                                    onChange={handleChange}
                                    placeholder="Retype your password"
                                    autoComplete="new-password"
                                    disabled={loading}
                                    aria-invalid={hasError}
                                    aria-describedby={hasError ? 'reset-password-error-message' : undefined}
                                    className={hasError ? 'input-error' : undefined}
                                />
                                <button
                                    type="button"
                                    className={`password-toggle${showConfirmPassword ? ' password-toggle-active' : ''}`}
                                    onClick={() => setShowConfirmPassword((state) => !state)}
                                    aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                                    aria-pressed={showConfirmPassword}
                                    title={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                                    disabled={loading}
                                >
                                    {showConfirmPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="login-submit" disabled={loading}>
                            <span className="login-submit-inner">
                                {loading ? (
                                    <>
                                        <Loader2 size={18} className="login-submit-spinner" aria-hidden="true" />
                                        Resetting...
                                    </>
                                ) : (
                                    'Reset password'
                                )}
                            </span>
                        </button>
                        </form>
                    )}

                    <div className="login-footer login-footer--stack">
                        {isLinkInvalid && (
                            <p className="login-footer-line">
                                <Link to="/forgot-password">Request a new reset link</Link>
                            </p>
                        )}
                        {isSuccess && (
                            <p className="login-footer-line">
                                <Link to="/login">Sign in</Link>
                            </p>
                        )}
                        {!isSuccess && (
                            <p className="login-footer-line">
                                <Link to="/login">Back to sign in</Link>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
