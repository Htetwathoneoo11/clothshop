import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

function LoginForm({ actionUrl, registerUrl, csrfToken, initialError }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(initialError || '');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
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
        const form = e.target;
        form.submit();
    };

    return (
        <div className="login-box">
            <h2>Sign in</h2>
            <form action={actionUrl} method="POST" onSubmit={handleSubmit}>
                <input type="hidden" name="_token" value={csrfToken} />
                {error && (
                    <div className="error-message" role="alert">
                        {error}
                    </div>
                )}
                <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input
                        type="text"
                        id="username"
                        name="username"
                        placeholder="Enter username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        required
                        disabled={loading}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <div className="password-wrap">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="password"
                            name="password"
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                            disabled={loading}
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            tabIndex={-1}
                        >
                            {showPassword ? 'Hide' : 'Show'}
                        </button>
                    </div>
                </div>
                <button type="submit" className="login-submit" disabled={loading}>
                    {loading ? 'Signing in…' : 'Login'}
                </button>
                <div className="login-footer">
                    <a href={registerUrl}>Don&apos;t have an account? Register here</a>
                </div>
            </form>
        </div>
    );
}

const container = document.getElementById('login-root');
if (container) {
    const root = createRoot(container);
    root.render(
        <LoginForm
            actionUrl={container.dataset.action}
            registerUrl={container.dataset.registerUrl}
            csrfToken={container.dataset.csrf}
            initialError={container.dataset.error || ''}
        />
    );
}
