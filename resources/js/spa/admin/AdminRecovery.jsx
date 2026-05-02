import React from 'react';
import { Link } from 'react-router-dom';

export function AdminErrorNotice({ children, onRetry, retryLabel = 'Retry' }) {
    return (
        <div className="admin-products-notice admin-products-notice--err admin-products-notice--action" role="alert">
            <span>{children}</span>
            {onRetry ? (
                <button type="button" className="admin-products-btn admin-products-btn--compact" onClick={onRetry}>
                    {retryLabel}
                </button>
            ) : null}
        </div>
    );
}

export function AdminEmptyState({ title, children, actions = null }) {
    return (
        <div className="admin-products-empty">
            <h3>{title}</h3>
            <p>{children}</p>
            {actions ? <div className="admin-state-actions">{actions}</div> : null}
        </div>
    );
}

export function AdminAccessState({ type = 'forbidden', children, backTo = '/admin', backLabel = 'Back to admin dashboard' }) {
    const isUnauthenticated = type === 'unauthenticated';

    return (
        <div className="page-container admin-products-page">
            <section className="admin-products-panel admin-access-state">
                <h1>{isUnauthenticated ? 'Admin sign-in required' : 'Admin permission needed'}</h1>
                <p>{children}</p>
                <div className="admin-state-actions">
                    {isUnauthenticated ? (
                        <Link to="/login" className="admin-products-btn">Go to login</Link>
                    ) : (
                        <Link to={backTo} className="admin-products-btn admin-products-btn--ghost">{backLabel}</Link>
                    )}
                </div>
            </section>
        </div>
    );
}
