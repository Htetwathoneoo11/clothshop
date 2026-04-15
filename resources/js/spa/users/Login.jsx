import React, { useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

axios.defaults.withCredentials = true;

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!username.trim()) {
            setError('Please enter your username.');
            return;
        }
        if (!password) {
            setError('Please enter your password.');
            return;
        }

        setLoading(true);

        try {
            await axios.get('/sanctum/csrf-cookie');
            await axios.post('/api/auth/login', { username, password });
            await axios.get('/api/me');
            navigate('/dashboard');
        } catch (err) {
            const msg = err.response?.data?.message;
            setError(
                typeof msg === 'string' && msg.trim()
                    ? msg
                    : 'We could not sign you in. Check your username and password, then try again.'
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
                    <p className="login-eyebrow">Welcome back</p>
                    <h2>Sign in</h2>
                    <form onSubmit={handleSubmit} noValidate>
                        {hasError && (
                            <div
                                id="login-error-message"
                                className="error-message error-message-visible"
                                role="alert"
                                aria-live="polite"
                            >
                                <span className="error-message-icon" aria-hidden="true">
                                    !
                                </span>
                                <span className="error-message-text">{error}</span>
                            </div>
                        )}
                        <div className="form-group">
                            <label htmlFor="login-username">Username</label>
                            <input
                                type="text"
                                id="login-username"
                                name="username"
                                placeholder="Your username"
                                value={username}
                                onChange={(e) => {
                                    setUsername(e.target.value);
                                    if (error) setError('');
                                }}
                                autoComplete="username"
                                autoFocus
                                disabled={loading}
                                aria-invalid={hasError}
                                aria-describedby={hasError ? 'login-error-message' : undefined}
                                className={hasError ? 'input-error' : undefined}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="login-password">Password</label>
                            <div className="password-wrap">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="login-password"
                                    name="password"
                                    placeholder="Your password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (error) setError('');
                                    }}
                                    autoComplete="current-password"
                                    disabled={loading}
                                    aria-invalid={hasError}
                                    aria-describedby={hasError ? 'login-error-message' : undefined}
                                    className={hasError ? 'input-error' : undefined}
                                />
                                <button
                                    type="button"
                                    className={`password-toggle${showPassword ? ' password-toggle-active' : ''}`}
                                    onClick={() => setShowPassword((s) => !s)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    aria-pressed={showPassword}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                    disabled={loading}
                                >
                                    {showPassword ? (
                                        <EyeOff size={18} aria-hidden="true" />
                                    ) : (
                                        <Eye size={18} aria-hidden="true" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <button type="submit" className="login-submit" disabled={loading}>
                            <span className="login-submit-inner">
                                {loading ? (
                                    <>
                                        <Loader2 size={18} className="login-submit-spinner" aria-hidden="true" />
                                        Signing in…
                                    </>
                                ) : (
                                    'Sign in'
                                )}
                            </span>
                        </button>
                    </form>
                    <div className="login-footer login-footer--stack">
                        <p className="login-footer-line">
                            <span className="login-footer-muted">New here? </span>
                            <a href="/register">Create an account</a>
                        </p>
                        <p className="login-back-link">
                            <Link to="/dashboard">← Continue shopping</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
