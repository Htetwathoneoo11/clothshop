import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginForm() {
    const [username, setUsername] = useState(initialUsername || '');
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
            
            await window.axios.get('/sanctum/csrf-cookie');
    
            const response = await window.axios.post('/api/auth/login', {
                username,
                password,
            });
    
            if (response.status === 200) {
                window.location.href = '/dashboard';
            } else {
                setError(response.data.message || 'Login failed.');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };
    
    const hasError = Boolean(error);

    return (
        <div className="login-box">
            <h2>Sign in</h2>
            <form onSubmit={handleSubmit} noValidate>
                <input type="hidden" name="_token" value={csrfToken} />
                {hasError && (
                    <div
                        ref={errorRef}
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
                    <label htmlFor="username">Username</label>
                    <input
                        type="text"
                        id="username"
                        name="username"
                        placeholder="Enter username"
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            if (error) setError('');
                        }}
                        autoComplete="username"
                        disabled={loading}
                        aria-invalid={hasError}
                        aria-describedby={hasError ? 'login-error-message' : undefined}
                        className={hasError ? 'input-error' : undefined}
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
                            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
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

