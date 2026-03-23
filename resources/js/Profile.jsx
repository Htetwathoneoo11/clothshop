import React from 'react';
import { createRoot } from 'react-dom/client';

function ProfileCard({ username, email, logoutUrl }) {
    return (
        <div className="profile-box">
            <h2>Profile</h2>
            <p className="profile-line">
                <strong>Username:</strong> {username}
            </p>
            <p className="profile-line">
                <strong>Email:</strong> {email}
            </p>
            <a href={logoutUrl} className="profile-logout-link">
                Logout
            </a>
        </div>
    );
}

const container = document.getElementById('profile-root');
if (container) {
    const root = createRoot(container);
    root.render(
        <ProfileCard
            username={container.dataset.username || ''}
            email={container.dataset.email || ''}
            logoutUrl={container.dataset.logoutUrl || '#'}
        />
    );
}
