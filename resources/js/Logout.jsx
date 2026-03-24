import React from 'react';
import { createRoot } from 'react-dom/client';

function LogoutBox({ actionUrl, profileUrl, csrfToken }) {
    return (
        <div className="logout-box">
            <h2>Logout</h2>
            <p>Are you sure you want to logout?</p>
            <form action={actionUrl} method="POST">
                <input type="hidden" name="_token" value={csrfToken} />
                <button type="submit" className="login-submit">Yes, Logout</button>
                <br />
                <a href={profileUrl}>No, Go back to Profile</a>
            </form>
        </div>
    );
}

const container = document.getElementById('logout-root');
if (container) {
    const root = createRoot(container);
    root.render(
        <LogoutBox
            actionUrl={container.dataset.action}
            profileUrl={container.dataset.profileUrl}
            csrfToken={container.dataset.csrf}
        />
    );
}
