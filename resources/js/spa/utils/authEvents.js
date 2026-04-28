const AUTH_EVENT_KEY = 'clothshop:auth-event';
const AUTH_EVENT_NAME = 'clothshop-auth-event';

export function emitAuthChange(type) {
    const detail = {
        type,
        at: Date.now(),
    };

    try {
        window.localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify(detail));
    } catch {
        // Storage can be unavailable in strict privacy modes; same-tab listeners still work.
    }

    window.dispatchEvent(new CustomEvent(AUTH_EVENT_NAME, { detail }));
}

export function listenForAuthChange(callback) {
    const handleLocalEvent = (event) => {
        callback(event.detail || { type: 'changed', at: Date.now() });
    };

    const handleStorageEvent = (event) => {
        if (event.key !== AUTH_EVENT_KEY || !event.newValue) return;

        try {
            callback(JSON.parse(event.newValue));
        } catch {
            callback({ type: 'changed', at: Date.now() });
        }
    };

    window.addEventListener(AUTH_EVENT_NAME, handleLocalEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
        window.removeEventListener(AUTH_EVENT_NAME, handleLocalEvent);
        window.removeEventListener('storage', handleStorageEvent);
    };
}
