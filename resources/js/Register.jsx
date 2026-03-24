import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Eye, EyeOff } from 'lucide-react';

function RegisterForm({ actionUrl, loginUrl, csrfToken, initialError, initialUsername, initialEmail }) {
    const [username, setUsername] = useState(initialUsername || '');
    const [email, setEmail] = useState(initialEmail || '');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(initialError || '');
    const [loading, setLoading] = useState(false);
    const errorRef = useRef(null);

    useEffect(() => {
        if (error && errorRef.current) {
            errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [error]);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!username.trim()) {
            setError('Please enter username.');
            return;
        }
        if (!email.trim()) {
            setError('Please enter email.');
            return;
        }
        if (!password) {
            setError('Please enter password.');
            return;
        }

        setLoading(true);
        e.target.submit();
    };

    const hasError = Boolean(error);

    return (
        <div className="login-box">
            <h2>Register</h2>
            <form action={actionUrl} method="POST" onSubmit={handleSubmit} noValidate>
                <input type="hidden" name="_token" value={csrfToken} />
                {hasError && (
                    <div
                        ref={errorRef}
                        id="register-error-message"
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
                    <label htmlFor="register-username">Username</label>
                    <input
                        type="text"
                        id="register-username"
                        name="username"
                        placeholder="Enter Username"
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            if (error) setError('');
                        }}
                        disabled={loading}
                        aria-invalid={hasError}
                        aria-describedby={hasError ? 'register-error-message' : undefined}
                        className={hasError ? 'input-error' : undefined}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="register-email">Email</label>
                    <input
                        type="email"
                        id="register-email"
                        name="email"
                        placeholder="Enter Email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            if (error) setError('');
                        }}
                        disabled={loading}
                        aria-invalid={hasError}
                        aria-describedby={hasError ? 'register-error-message' : undefined}
                        className={hasError ? 'input-error' : undefined}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="register-password">Password</label>
                    <div className="password-wrap">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="register-password"
                            name="password"
                            placeholder="Enter Password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (error) setError('');
                            }}
                            disabled={loading}
                            aria-invalid={hasError}
                            aria-describedby={hasError ? 'register-error-message' : undefined}
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
                            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                        </button>
                    </div>
                </div>
                <button type="submit" className="login-submit" disabled={loading}>
                    {loading ? 'Registering...' : 'Register'}
                </button>
                <div className="login-footer">
                    <a href={loginUrl}>Already have an account? Login here</a>
                </div>
            </form>
        </div>
    );
}

const container = document.getElementById('register-root');
if (container) {
    const root = createRoot(container);
    root.render(
        <RegisterForm
            actionUrl={container.dataset.action}
            loginUrl={container.dataset.loginUrl}
            csrfToken={container.dataset.csrf}
            initialError={container.dataset.error || ''}
            initialUsername={container.dataset.username || ''}
            initialEmail={container.dataset.email || ''}
        />
    );
}
