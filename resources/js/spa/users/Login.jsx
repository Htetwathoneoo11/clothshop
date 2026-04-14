import React, { useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
            navigate('/dashboard');
        } catch (err) {
            setError('Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const hasError = Boolean(error);

    return (
        <div className="login-box">
            <h2>Sign in</h2>
            <form onSubmit={handleSubmit} noValidate>
                {hasError && (
                    <div
                        id="login-error-message"
                        className="error-message error-message-visible"
                        role="alert"
                        aria-live="polite"
                    >
                        <span className="error-message-icon" aria-hidden="true">!</span>
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
                        onChange={(e) => setUsername(e.target.value)}
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
                            onChange={(e) => setPassword(e.target.value)}
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
                    {loading ? 'Signing in...' : 'Login'}
                </button>
            </form>
        </div>
    );
}
