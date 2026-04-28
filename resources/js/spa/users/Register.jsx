import React, { useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

axios.defaults.withCredentials = true;

export default function Register() {
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        password_confirmation: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (error) setError('');
    };

    const validate = () => {
        if (!form.username.trim()) return 'Please enter a username.';
        if (!form.email.trim()) return 'Please enter an email address.';
        if (!form.password) return 'Please enter a password.';
        if (form.password.length < 8) return 'Password must be at least 8 characters.';
        if (form.password_confirmation !== form.password) return 'Passwords do not match.';
        return '';
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        try {
            await axios.get('/sanctum/csrf-cookie');
            const res = await axios.post('/api/auth/register', form);
            navigate('/verify-email-code', {
                state: {
                    email: res.data?.email || form.email,
                },
            });
        } catch (err) {
            const message = err.response?.data?.message;
            const fieldErrors = err.response?.data?.errors;
            const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : '';
            setError(
                (typeof firstFieldError === 'string' && firstFieldError.trim() && firstFieldError) ||
                    (typeof message === 'string' && message.trim() && message) ||
                    'We could not create your account. Please check your details and try again.'
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
                    <p className="login-eyebrow">Create your account</p>
                    <h2>Sign up</h2>
                    <form onSubmit={handleSubmit} noValidate>
                        {hasError && (
                            <div
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
                                value={form.username}
                                onChange={handleChange}
                                placeholder="Choose a username"
                                autoComplete="username"
                                autoFocus
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
                                value={form.email}
                                onChange={handleChange}
                                placeholder="you@example.com"
                                autoComplete="email"
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
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder="At least 8 characters"
                                    autoComplete="new-password"
                                    disabled={loading}
                                    aria-invalid={hasError}
                                    aria-describedby={hasError ? 'register-error-message' : undefined}
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
                            <label htmlFor="register-password-confirmation">Confirm password</label>
                            <div className="password-wrap">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    id="register-password-confirmation"
                                    name="password_confirmation"
                                    value={form.password_confirmation}
                                    onChange={handleChange}
                                    placeholder="Retype your password"
                                    autoComplete="new-password"
                                    disabled={loading}
                                    aria-invalid={hasError}
                                    aria-describedby={hasError ? 'register-error-message' : undefined}
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
                                        Creating account...
                                    </>
                                ) : (
                                    'Create account'
                                )}
                            </span>
                        </button>
                    </form>
                    <div className="login-footer login-footer--stack">
                        <p className="login-footer-line">
                            <span className="login-footer-muted">Already have an account? </span>
                            <Link to="/login">Sign in</Link>
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
