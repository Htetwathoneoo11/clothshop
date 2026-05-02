import React, { useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';

export default function StaffInvitationAccept() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setMessage('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            const res = await axios.post('/api/staff-invitations/accept', {
                token,
                password,
                password_confirmation: passwordConfirmation,
            });
            setMessage(res.data?.message || 'Staff account created. You can now sign in.');
            setPassword('');
            setPasswordConfirmation('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to accept staff invitation.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1>Accept Staff Invitation</h1>
                <p className="auth-subtitle">Set your password to activate your staff account.</p>
                {!token ? <p className="auth-error">This invitation link is missing a token.</p> : null}
                {error ? <p className="auth-error">{error}</p> : null}
                {message ? (
                    <div className="reset-result reset-result--success" role="status">
                        <p>{message}</p>
                        <Link to="/login">Go to login</Link>
                    </div>
                ) : (
                    <form onSubmit={submit}>
                        <label>
                            Password
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                minLength={8}
                                required
                                disabled={!token || busy}
                            />
                        </label>
                        <label>
                            Confirm password
                            <input
                                type="password"
                                value={passwordConfirmation}
                                onChange={(event) => setPasswordConfirmation(event.target.value)}
                                minLength={8}
                                required
                                disabled={!token || busy}
                            />
                        </label>
                        <button type="submit" className="auth-button" disabled={!token || busy}>
                            {busy ? 'Creating Account...' : 'Accept Invitation'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
