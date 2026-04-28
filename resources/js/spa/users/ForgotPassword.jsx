import React, { useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

axios.defaults.withCredentials = true;

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');

        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }

        setLoading(true);
        try {
            await axios.get('/sanctum/csrf-cookie');
            const response = await axios.post('/api/auth/forgot-password', {
                email,
            });
            setMessage(response.data?.message || 'Reset link has been sent.');
        } catch (err) {
            const fieldErrors = err.response?.data?.errors;
            const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : '';
            const message = err.response?.data?.message;
            setError(
                (typeof firstFieldError === 'string' && firstFieldError.trim() && firstFieldError) ||
                    (typeof message === 'string' && message.trim() && message) ||
                    'We could not send a reset link. Please check the email address and try again.'
            );
        } finally {
            setLoading(false);
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
                    <p className="login-eyebrow">Password help</p>
                    <h2>Reset your password</h2>
                    <p className="login-subtitle">
                        Enter your account email and we will send a reset link.
                    </p>
                    <form onSubmit={handleSubmit} noValidate>
                        {hasError && (
                            <div
                                id="forgot-password-error-message"
                                className="error-message error-message-visible"
                                role="alert"
                                aria-live="polite"
                            >
                                <span className="error-message-icon" aria-hidden="true">!</span>
                                <span className="error-message-text">{error}</span>
                            </div>
                        )}
                        {message && (
                            <div className="success-message" role="status" aria-live="polite">
                                {message}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="forgot-password-email">Email</label>
                            <input
                                type="email"
                                id="forgot-password-email"
                                name="email"
                                value={email}
                                onChange={(event) => {
                                    setEmail(event.target.value);
                                    if (error) setError('');
                                    if (message) setMessage('');
                                }}
                                placeholder="you@example.com"
                                autoComplete="email"
                                autoFocus
                                disabled={loading}
                                aria-invalid={hasError}
                                aria-describedby={hasError ? 'forgot-password-error-message' : undefined}
                                className={hasError ? 'input-error' : undefined}
                            />
                        </div>

                        <button type="submit" className="login-submit" disabled={loading}>
                            <span className="login-submit-inner">
                                {loading ? (
                                    <>
                                        <Loader2 size={18} className="login-submit-spinner" aria-hidden="true" />
                                        Sending link...
                                    </>
                                ) : (
                                    'Send reset link'
                                )}
                            </span>
                        </button>
                    </form>
                    <div className="login-footer login-footer--stack">
                        <p className="login-footer-line">
                            <Link to="/login">Back to sign in</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
