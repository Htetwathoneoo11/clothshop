import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const STORAGE_PREFIX = 'clothshop.adminTip.dismissed.';

export default function AdminTip({ id, children }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            setVisible(window.localStorage.getItem(`${STORAGE_PREFIX}${id}`) !== '1');
        } catch {
            setVisible(true);
        }
    }, [id]);

    const dismiss = () => {
        try {
            window.localStorage.setItem(`${STORAGE_PREFIX}${id}`, '1');
        } catch {
            // If storage is unavailable, still remove the tip for this session.
        }
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <section className="admin-help-card" aria-label="Admin onboarding tip">
            <div className="admin-help-card__content">
                <strong>Admin tip</strong>
                <span>{children}</span>
            </div>
            <button type="button" className="admin-help-card__dismiss" onClick={dismiss} aria-label="Dismiss admin tip">
                <X size={15} aria-hidden="true" />
            </button>
        </section>
    );
}
