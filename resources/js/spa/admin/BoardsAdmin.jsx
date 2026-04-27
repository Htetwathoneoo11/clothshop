import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    Calendar,
    CheckCircle2,
    Copy,
    Hash,
    Image as ImageIcon,
    Inbox,
    LayoutDashboard,
    Link2,
    Loader2,
    LogIn,
    Pencil,
    RefreshCw,
    ShieldAlert,
    Sparkles,
    ToggleLeft,
    Trash2,
    X,
} from 'lucide-react';

function toDatetimeLocalValue(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
        return '';
    }
}

function formatValidationErrors(errors) {
    if (!errors || typeof errors !== 'object') return [];
    return Object.entries(errors).flatMap(([key, msgs]) =>
        (Array.isArray(msgs) ? msgs : [String(msgs)]).map((m) => `${key}: ${m}`)
    );
}

function formatBannerDates(b) {
    const fmt = (iso) => {
        if (!iso) return '—';
        try {
            return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
        } catch {
            return '—';
        }
    };
    return { starts: fmt(b.starts_at), ends: fmt(b.ends_at) };
}

const emptyCreate = () => ({
    title: '',
    subtitle: '',
    cta_text: '',
    cta_link: '',
    is_active: true,
    starts_at: '',
    ends_at: '',
    priority: '0',
});

const MAX_BOARDS = 5;
const BOARD_SORTS = new Set(['newest', 'oldest', 'priority_desc', 'priority_asc', 'title_asc', 'title_desc', 'active_first']);
const BOARD_STATUS = new Set(['all', 'active', 'inactive']);

function extractBoards(payload) {
    if (Array.isArray(payload?.boards)) return payload.boards;
    if (Array.isArray(payload?.banners)) return payload.banners;
    return [];
}

function normalizePage(raw) {
    const value = parseInt(String(raw || '1'), 10);
    if (Number.isNaN(value) || value < 1) return 1;
    return value;
}

function FileUploadField({ id, inputRef, file, onFileChange }) {
    return (
        <div className="admin-hero-upload">
            <input
                ref={inputRef}
                id={id}
                type="file"
                accept="image/*"
                className="admin-hero-upload-input"
                onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            />
            <label htmlFor={id} className="admin-hero-upload-label">
                <span className="admin-hero-upload-icon" aria-hidden>
                    <ImageIcon size={20} strokeWidth={2} />
                </span>
                <span className="admin-hero-upload-text">
                    <span className="admin-hero-upload-title">Drop an image or browse</span>
                    <span className="admin-hero-upload-sub">{file ? file.name : 'PNG, JPG, WebP · max 5MB'}</span>
                </span>
            </label>
        </div>
    );
}

function ErrorNotice({ message }) {
    if (!message || !String(message).trim()) return null;
    const lines = message.includes('\n') ? message.split('\n').filter(Boolean) : [message];
    return (
        <div className="admin-hero-notice admin-hero-notice--err" role="alert">
            <AlertCircle className="admin-hero-notice-icon" size={20} aria-hidden />
            <div className="admin-hero-notice-body">
                {lines.length > 1 ? (
                    <ul className="admin-hero-error-list">
                        {lines.map((line, i) => (
                            <li key={i}>{line}</li>
                        ))}
                    </ul>
                ) : (
                    <p className="admin-hero-notice-text">{lines[0]}</p>
                )}
            </div>
        </div>
    );
}

export default function BoardsAdmin() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialQ = (searchParams.get('q') || '').trim();
    const initialStatus = BOARD_STATUS.has(searchParams.get('status') || '') ? searchParams.get('status') : 'all';
    const initialSort = BOARD_SORTS.has(searchParams.get('sort') || '') ? searchParams.get('sort') : 'newest';
    const initialPage = normalizePage(searchParams.get('page'));

    const [gate, setGate] = useState('loading');
    const [banners, setBanners] = useState([]);
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState('');
    const [searchInput, setSearchInput] = useState(initialQ);
    const [filters, setFilters] = useState({
        q: initialQ,
        status: initialStatus,
        sort: initialSort,
    });
    const [page, setPage] = useState(initialPage);
    const [meta, setMeta] = useState({
        current_page: 1,
        last_page: 1,
        per_page: 8,
        total: 0,
        global_total: 0,
    });
    const [notice, setNotice] = useState('');
    const [formError, setFormError] = useState('');
    const [createBusy, setCreateBusy] = useState(false);
    const [create, setCreate] = useState(() => emptyCreate());
    const [createFile, setCreateFile] = useState(null);
    const createFileRef = useRef(null);
    const createSectionRef = useRef(null);

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [editFile, setEditFile] = useState(null);
    const [editBusy, setEditBusy] = useState(false);
    const [deleteBusyId, setDeleteBusyId] = useState(null);
    const [confirmState, setConfirmState] = useState(null);
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [undoToast, setUndoToast] = useState(null);
    const undoTimerRef = useRef(null);
    const confirmDialogRef = useRef(null);
    const confirmCancelRef = useRef(null);
    const confirmPrevFocusRef = useRef(null);
    const editFileRef = useRef(null);
    const canCreateMore = meta.global_total < MAX_BOARDS;

    const showNotice = useCallback((msg) => {
        setNotice(msg);
        window.setTimeout(() => setNotice(''), 5200);
    }, []);

    const clearUndoToast = useCallback(() => {
        if (undoTimerRef.current) {
            window.clearTimeout(undoTimerRef.current);
            undoTimerRef.current = null;
        }
        setUndoToast(null);
    }, []);

    const showUndoToast = useCallback((message, onUndo) => {
        if (undoTimerRef.current) {
            window.clearTimeout(undoTimerRef.current);
        }
        setUndoToast({ message, onUndo });
        undoTimerRef.current = window.setTimeout(() => {
            setUndoToast(null);
            undoTimerRef.current = null;
        }, 8000);
    }, []);

    useEffect(() => {
        return () => {
            if (undoTimerRef.current) {
                window.clearTimeout(undoTimerRef.current);
            }
        };
    }, []);

    const loadBanners = useCallback(async () => {
        setListLoading(true);
        setListError('');
        try {
            const res = await axios.get('/api/admin/boards', {
                params: {
                    q: filters.q,
                    status: filters.status,
                    sort: filters.sort,
                    page,
                    per_page: 8,
                },
            });
            setBanners(extractBoards(res.data));
            setMeta(res.data?.meta || {
                current_page: 1,
                last_page: 1,
                per_page: 8,
                total: 0,
                global_total: 0,
            });
        } catch (err) {
            const st = err.response?.status;
            if (st === 401) {
                setListError('Your session expired. Please sign in again.');
            } else if (st === 403) {
                setListError('You do not have permission to load boards.');
            } else {
                setListError('Could not load boards. Try again.');
            }
            setBanners([]);
            setMeta({
                current_page: 1,
                last_page: 1,
                per_page: 8,
                total: 0,
                global_total: 0,
            });
        } finally {
            setListLoading(false);
        }
    }, [filters, page]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await axios.get('/api/me');
                const user = res.data?.user;
                if (cancelled) return;
                if (!user) {
                    setGate('unauthenticated');
                    return;
                }
                if (!user.is_admin) {
                    setGate('forbidden');
                    return;
                }
                setGate('admin');
            } catch {
                if (cancelled) return;
                setGate('unauthenticated');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (gate !== 'admin') return;
        let cancelled = false;
        (async () => {
            await loadBanners();
            if (cancelled) return;
        })();
        return () => {
            cancelled = true;
        };
    }, [gate, loadBanners]);

    useEffect(() => {
        if (page > meta.last_page) {
            setPage(Math.max(1, meta.last_page));
        }
    }, [page, meta.last_page]);

    useEffect(() => {
        const next = new URLSearchParams();
        if (filters.q) next.set('q', filters.q);
        if (filters.status !== 'all') next.set('status', filters.status);
        if (filters.sort !== 'newest') next.set('sort', filters.sort);
        if (page > 1) next.set('page', String(page));
        setSearchParams(next, { replace: true });
    }, [filters, page, setSearchParams]);

    const refreshList = useCallback(async () => {
        if (gate !== 'admin') return;
        await loadBanners();
    }, [gate, loadBanners]);

    const submitSearch = (e) => {
        e.preventDefault();
        setPage(1);
        setFilters((f) => ({ ...f, q: searchInput.trim() }));
    };

    const resetFilters = () => {
        setSearchInput('');
        setPage(1);
        setFilters({
            q: '',
            status: 'all',
            sort: 'newest',
        });
    };

    const closeConfirm = useCallback(() => {
        setConfirmState(null);
        const prev = confirmPrevFocusRef.current;
        if (prev && typeof prev.focus === 'function') {
            window.setTimeout(() => prev.focus(), 0);
        }
    }, []);

    const openConfirm = (options) => {
        const active = document.activeElement;
        confirmPrevFocusRef.current = active && typeof active.focus === 'function' ? active : null;
        setConfirmState(options);
    };

    const runConfirm = async () => {
        if (!confirmState?.onConfirm) return;
        setConfirmBusy(true);
        try {
            await confirmState.onConfirm();
            closeConfirm();
        } finally {
            setConfirmBusy(false);
        }
    };

    useEffect(() => {
        if (!confirmState) return;
        window.setTimeout(() => {
            confirmCancelRef.current?.focus();
        }, 0);
    }, [confirmState]);

    useEffect(() => {
        if (!confirmState) return;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                if (!confirmBusy) {
                    event.preventDefault();
                    closeConfirm();
                }
                return;
            }

            if (event.key !== 'Tab') {
                return;
            }

            const root = confirmDialogRef.current;
            if (!root) return;

            const focusable = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (!focusable.length) {
                event.preventDefault();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;

            if (event.shiftKey) {
                if (active === first || !root.contains(active)) {
                    event.preventDefault();
                    last.focus();
                }
            } else if (active === last || !root.contains(active)) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [confirmState, confirmBusy, closeConfirm]);

    const scrollToCreate = () => {
        createSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!canCreateMore) {
            setFormError(`You can create up to ${MAX_BOARDS} boards.`);
            return;
        }
        if (!create.title.trim()) {
            setFormError('Title is required.');
            return;
        }
        setCreateBusy(true);
        try {
            await axios.get('/sanctum/csrf-cookie');
            const fd = new FormData();
            fd.append('title', create.title.trim());
            if (create.subtitle.trim()) fd.append('subtitle', create.subtitle.trim());
            if (create.cta_text.trim()) fd.append('cta_text', create.cta_text.trim());
            if (create.cta_link.trim()) fd.append('cta_link', create.cta_link.trim());
            fd.append('is_active', create.is_active ? '1' : '0');
            if (create.starts_at) fd.append('starts_at', create.starts_at);
            if (create.ends_at) fd.append('ends_at', create.ends_at);
            fd.append('priority', String(parseInt(create.priority, 10) || 0));
            if (createFile) fd.append('image', createFile);

            await axios.post('/api/admin/boards', fd);
            setCreate(emptyCreate());
            setCreateFile(null);
            if (createFileRef.current) createFileRef.current.value = '';
            showNotice('Board created successfully.');
            await loadBanners();
        } catch (err) {
            if (err.response?.status === 422) {
                const lines = formatValidationErrors(err.response.data?.errors);
                setFormError(lines.length ? lines.join('\n') : 'Validation failed.');
            } else if (err.response?.status === 401) {
                setFormError('Please sign in again.');
            } else if (err.response?.status === 403) {
                setFormError('You do not have permission to create boards.');
            } else {
                setFormError('Could not create board.');
            }
        } finally {
            setCreateBusy(false);
        }
    };

    const startEdit = (b) => {
        setFormError('');
        setEditingId(b.id);
        setEditFile(null);
        if (editFileRef.current) editFileRef.current.value = '';
        setEditForm({
            title: b.title || '',
            subtitle: b.subtitle || '',
            cta_text: b.cta_text || '',
            cta_link: b.cta_link || '',
            is_active: Boolean(b.is_active),
            starts_at: toDatetimeLocalValue(b.starts_at),
            ends_at: toDatetimeLocalValue(b.ends_at),
            priority: String(b.priority ?? 0),
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm(null);
        setEditFile(null);
        if (editFileRef.current) editFileRef.current.value = '';
    };

    const saveEdit = async (id) => {
        setFormError('');
        if (!editForm) {
            return;
        }
        if (!editForm.title.trim()) {
            setFormError('Title is required.');
            return;
        }
        setEditBusy(true);
        try {
            await axios.get('/sanctum/csrf-cookie');
            if (editFile) {
                const fd = new FormData();
                fd.append('title', editForm.title.trim());
                fd.append('subtitle', editForm.subtitle.trim());
                if (editForm.cta_text.trim()) fd.append('cta_text', editForm.cta_text.trim());
                if (editForm.cta_link.trim()) fd.append('cta_link', editForm.cta_link.trim());
                fd.append('is_active', editForm.is_active ? '1' : '0');
                if (editForm.starts_at) fd.append('starts_at', editForm.starts_at);
                if (editForm.ends_at) fd.append('ends_at', editForm.ends_at);
                fd.append('priority', String(parseInt(editForm.priority, 10) || 0));
                fd.append('image', editFile);
                await axios.put(`/api/admin/boards/${id}`, fd);
            } else {
                await axios.put(`/api/admin/boards/${id}`, {
                    title: editForm.title.trim(),
                    subtitle: editForm.subtitle.trim() || null,
                    cta_text: editForm.cta_text.trim() || null,
                    cta_link: editForm.cta_link.trim() || null,
                    is_active: editForm.is_active,
                    starts_at: editForm.starts_at || null,
                    ends_at: editForm.ends_at || null,
                    priority: parseInt(editForm.priority, 10) || 0,
                });
            }
            cancelEdit();
            showNotice('Board updated.');
            await loadBanners();
        } catch (err) {
            if (err.response?.status === 422) {
                const lines = formatValidationErrors(err.response.data?.errors);
                setFormError(lines.length ? lines.join('\n') : 'Validation failed.');
            } else if (err.response?.status === 401) {
                setFormError('Please sign in again.');
            } else if (err.response?.status === 403) {
                setFormError('You do not have permission to update this board.');
            } else {
                setFormError('Could not update board.');
            }
        } finally {
            setEditBusy(false);
        }
    };

    const handleDelete = (id) => {
        openConfirm({
            title: 'Delete board?',
            message: 'This will permanently remove the board and its image.',
            confirmLabel: 'Delete',
            onConfirm: async () => {
                setDeleteBusyId(id);
                setFormError('');
                try {
                    await axios.get('/sanctum/csrf-cookie');
                    await axios.delete(`/api/admin/boards/${id}`);
                    if (editingId === id) cancelEdit();
                    showNotice('Board removed.');
                    clearUndoToast();
                    await loadBanners();
                } catch (err) {
                    if (err.response?.status === 401) {
                        setFormError('Please sign in again.');
                    } else if (err.response?.status === 403) {
                        setFormError('You do not have permission to delete this board.');
                    } else {
                        setFormError('Could not delete board.');
                    }
                } finally {
                    setDeleteBusyId(null);
                }
            },
        });
    };

    const duplicateBoard = (id) => {
        if (!canCreateMore) {
            setFormError(`You can create up to ${MAX_BOARDS} boards.`);
            return;
        }
        openConfirm({
            title: 'Duplicate board?',
            message: 'A copy will be created as inactive so you can edit it safely.',
            confirmLabel: 'Duplicate',
            onConfirm: async () => {
                setDeleteBusyId(id);
                setFormError('');
                try {
                    await axios.get('/sanctum/csrf-cookie');
                    const response = await axios.post(`/api/admin/boards/${id}/duplicate`);
                    const duplicateId = response.data?.board?.id;
                    showNotice('Board duplicated.');
                    await loadBanners();
                    if (duplicateId) {
                        showUndoToast('Board duplicated.', async () => {
                            setFormError('');
                            await axios.get('/sanctum/csrf-cookie');
                            await axios.delete(`/api/admin/boards/${duplicateId}`);
                            showNotice('Duplicate removed.');
                            await loadBanners();
                        });
                    }
                } catch (err) {
                    if (err.response?.status === 422) {
                        setFormError(err.response?.data?.message || 'Cannot duplicate board.');
                    } else if (err.response?.status === 401) {
                        setFormError('Please sign in again.');
                    } else if (err.response?.status === 403) {
                        setFormError('You do not have permission to duplicate this board.');
                    } else {
                        setFormError('Could not duplicate board.');
                    }
                } finally {
                    setDeleteBusyId(null);
                }
            },
        });
    };

    const toggleBoardActive = async (id, isActiveNow) => {
        if (isActiveNow) {
            openConfirm({
                title: 'Deactivate board?',
                message: 'This board will stop showing to customers until reactivated.',
                confirmLabel: 'Deactivate',
                onConfirm: async () => {
                    await toggleBoardActive(id, false);
                },
            });
            return;
        }

        setDeleteBusyId(id);
        setFormError('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            await axios.post(`/api/admin/boards/${id}/toggle-active`);
            showNotice('Board status updated.');
            await loadBanners();
            showUndoToast('Board status updated.', async () => {
                setFormError('');
                await axios.get('/sanctum/csrf-cookie');
                await axios.post(`/api/admin/boards/${id}/toggle-active`);
                showNotice('Status change undone.');
                await loadBanners();
            });
        } catch (err) {
            if (err.response?.status === 401) {
                setFormError('Please sign in again.');
            } else if (err.response?.status === 403) {
                setFormError('You do not have permission to update this board.');
            } else {
                setFormError('Could not update board status.');
            }
        } finally {
            setDeleteBusyId(null);
        }
    };

    const shiftBoardPriority = async (id, direction) => {
        setDeleteBusyId(id);
        setFormError('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            await axios.post(`/api/admin/boards/${id}/shift-priority`, { direction, step: 1 });
            showNotice('Board priority updated.');
            await loadBanners();
            const undoDirection = direction === 'up' ? 'down' : 'up';
            showUndoToast('Board priority updated.', async () => {
                setFormError('');
                await axios.get('/sanctum/csrf-cookie');
                await axios.post(`/api/admin/boards/${id}/shift-priority`, { direction: undoDirection, step: 1 });
                showNotice('Priority change undone.');
                await loadBanners();
            });
        } catch (err) {
            if (err.response?.status === 401) {
                setFormError('Please sign in again.');
            } else if (err.response?.status === 403) {
                setFormError('You do not have permission to update this board.');
            } else {
                setFormError('Could not update board priority.');
            }
        } finally {
            setDeleteBusyId(null);
        }
    };

    if (gate === 'loading') {
        return (
            <div className="page-container admin-hero-page admin-hero-page--centered">
                <div className="admin-hero-state-card" role="status" aria-live="polite">
                    <Loader2 className="admin-hero-spinner admin-hero-spinner--lg" size={32} aria-hidden />
                    <p className="admin-hero-state-title">Loading admin</p>
                    <p className="admin-hero-state-text">Checking your session…</p>
                </div>
            </div>
        );
    }

    if (gate === 'unauthenticated') {
        return (
            <div className="page-container admin-hero-page admin-hero-page--centered">
                <div className="admin-hero-panel admin-hero-panel--gate admin-hero-panel--warn" role="alert">
                    <span className="admin-hero-gate-icon" aria-hidden>
                        <LogIn size={28} strokeWidth={2} />
                    </span>
                    <h1 className="admin-hero-title">Sign in required</h1>
                    <p className="admin-hero-text">Sign in with an administrator account to manage dashboard boards.</p>
                    <div className="admin-hero-gate-actions">
                        <Link to="/login" className="admin-hero-btn admin-hero-btn--primary">
                            Sign in
                        </Link>
                        <Link to="/dashboard" className="admin-hero-btn admin-hero-btn--ghost">
                            <LayoutDashboard size={18} aria-hidden />
                            View as customer
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (gate === 'forbidden') {
        return (
            <div className="page-container admin-hero-page admin-hero-page--centered">
                <div className="admin-hero-panel admin-hero-panel--gate admin-hero-panel--denied" role="alert">
                    <span className="admin-hero-gate-icon admin-hero-gate-icon--denied" aria-hidden>
                        <ShieldAlert size={28} strokeWidth={2} />
                    </span>
                    <h1 className="admin-hero-title">Access restricted</h1>
                    <p className="admin-hero-text">This area is reserved for shop administrators.</p>
                    <Link to="/dashboard" className="admin-hero-btn admin-hero-btn--primary">
                        <LayoutDashboard size={18} aria-hidden />
                        View as customer
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container admin-hero-page">
            <div className="admin-hero-shell">
                <header className="admin-hero-header">
                    <div className="admin-hero-header-top">
                        <Link to="/dashboard" className="admin-hero-back">
                            <LayoutDashboard size={16} aria-hidden />
                            View as customer
                        </Link>
                        <button
                            type="button"
                            className="admin-hero-btn admin-hero-btn--ghost admin-hero-btn--compact"
                            onClick={() => refreshList()}
                            disabled={listLoading}
                            title="Reload list from server"
                        >
                            <RefreshCw size={16} className={listLoading ? 'admin-hero-icon-spin' : ''} aria-hidden />
                            Refresh
                        </button>
                    </div>
                    <p className="admin-hero-eyebrow">
                        <Sparkles size={14} strokeWidth={2.5} aria-hidden />
                        Admin
                    </p>
                    <h1 className="admin-hero-h1">Boards</h1>
                    <p className="admin-hero-lead">
                        Control what shoppers see at the top of the home page: copy, image, schedule, and call-to-action. Higher priority wins when
                        several boards are active at once.
                    </p>
                </header>

                {notice ? (
                    <div className="admin-hero-notice admin-hero-notice--ok admin-hero-notice--dismiss" role="status">
                        <CheckCircle2 className="admin-hero-notice-icon" size={20} aria-hidden />
                        <p className="admin-hero-notice-text">{notice}</p>
                        <button type="button" className="admin-hero-notice-dismiss" onClick={() => setNotice('')} aria-label="Dismiss notice">
                            <X size={18} />
                        </button>
                    </div>
                ) : null}

                {undoToast ? (
                    <div className="admin-hero-toast" role="status">
                        <p className="admin-hero-toast-text">{undoToast.message}</p>
                        <button
                            type="button"
                            className="admin-hero-btn admin-hero-btn--ghost admin-hero-btn--compact"
                            onClick={async () => {
                                try {
                                    await undoToast.onUndo?.();
                                } catch {
                                    setFormError('Could not undo the last action.');
                                } finally {
                                    clearUndoToast();
                                }
                            }}
                        >
                            Undo
                        </button>
                        <button
                            type="button"
                            className="admin-hero-notice-dismiss"
                            onClick={clearUndoToast}
                            aria-label="Dismiss undo"
                        >
                            <X size={18} />
                        </button>
                    </div>
                ) : null}

                {listError ? <ErrorNotice message={listError} /> : null}

                <ErrorNotice message={formError} />

                {!canCreateMore ? (
                    <div className="admin-hero-notice admin-hero-notice--err" role="status">
                        <AlertCircle className="admin-hero-notice-icon" size={20} aria-hidden />
                        <p className="admin-hero-notice-text">You can create up to {MAX_BOARDS} boards. Delete one to add another.</p>
                    </div>
                ) : null}

                <section ref={createSectionRef} className="admin-hero-panel admin-hero-panel--create" aria-labelledby="admin-hero-new">
                    <div className="admin-hero-panel-head">
                        <h2 id="admin-hero-new" className="admin-hero-h2">
                            Create board
                        </h2>
                        <p className="admin-hero-panel-desc">Required fields are marked. Leave schedule empty to show anytime (while active).</p>
                    </div>
                    <form className="admin-hero-form" onSubmit={handleCreateSubmit}>
                        <fieldset className="admin-hero-fieldset">
                            <legend className="admin-hero-legend">Content</legend>
                            <div className="admin-hero-form-grid">
                                <label className="admin-hero-field">
                                    <span className="admin-hero-label">Title *</span>
                                    <input
                                        className="admin-hero-input"
                                        value={create.title}
                                        onChange={(e) => setCreate((c) => ({ ...c, title: e.target.value }))}
                                        required
                                        maxLength={255}
                                        placeholder="e.g. Spring collection"
                                    />
                                </label>
                                <label className="admin-hero-field admin-hero-field--full">
                                    <span className="admin-hero-label">Subtitle</span>
                                    <textarea
                                        className="admin-hero-textarea"
                                        rows={2}
                                        value={create.subtitle}
                                        onChange={(e) => setCreate((c) => ({ ...c, subtitle: e.target.value }))}
                                        placeholder="Supporting line under the headline"
                                    />
                                </label>
                            </div>
                        </fieldset>

                        <fieldset className="admin-hero-fieldset">
                            <legend className="admin-hero-legend">Image &amp; CTA</legend>
                            <div className="admin-hero-form-grid">
                                <div className="admin-hero-field admin-hero-field--full">
                                    <span className="admin-hero-label">Hero image</span>
                                    <FileUploadField
                                        id="admin-hero-create-file"
                                        inputRef={createFileRef}
                                        file={createFile}
                                        onFileChange={setCreateFile}
                                    />
                                </div>
                                <label className="admin-hero-field">
                                    <span className="admin-hero-label">Button label</span>
                                    <input
                                        className="admin-hero-input"
                                        value={create.cta_text}
                                        onChange={(e) => setCreate((c) => ({ ...c, cta_text: e.target.value }))}
                                        maxLength={120}
                                        placeholder="Shop now"
                                    />
                                </label>
                                <label className="admin-hero-field">
                                    <span className="admin-hero-label">Button URL</span>
                                    <input
                                        className="admin-hero-input"
                                        type="url"
                                        value={create.cta_link}
                                        onChange={(e) => setCreate((c) => ({ ...c, cta_link: e.target.value }))}
                                        placeholder="https://…"
                                    />
                                </label>
                            </div>
                        </fieldset>

                        <fieldset className="admin-hero-fieldset">
                            <legend className="admin-hero-legend">Schedule &amp; visibility</legend>
                            <div className="admin-hero-form-grid">
                                <label className="admin-hero-field">
                                    <span className="admin-hero-label">Priority</span>
                                    <input
                                        className="admin-hero-input"
                                        type="number"
                                        min={0}
                                        value={create.priority}
                                        onChange={(e) => setCreate((c) => ({ ...c, priority: e.target.value }))}
                                    />
                                    <span className="admin-hero-hint">Higher number = shown first when multiple qualify.</span>
                                </label>
                                <label className="admin-hero-field">
                                    <span className="admin-hero-label">Starts</span>
                                    <input
                                        className="admin-hero-input"
                                        type="datetime-local"
                                        value={create.starts_at}
                                        onChange={(e) => setCreate((c) => ({ ...c, starts_at: e.target.value }))}
                                    />
                                </label>
                                <label className="admin-hero-field">
                                    <span className="admin-hero-label">Ends</span>
                                    <input
                                        className="admin-hero-input"
                                        type="datetime-local"
                                        value={create.ends_at}
                                        onChange={(e) => setCreate((c) => ({ ...c, ends_at: e.target.value }))}
                                    />
                                </label>
                                <label className="admin-hero-field admin-hero-field--switch">
                                    <span className="admin-hero-label">Active</span>
                                    <span className="admin-hero-switch">
                                        <input
                                            type="checkbox"
                                            checked={create.is_active}
                                            onChange={(e) => setCreate((c) => ({ ...c, is_active: e.target.checked }))}
                                        />
                                        <span className="admin-hero-switch-ui" aria-hidden />
                                    </span>
                                    <span className="admin-hero-hint admin-hero-hint--inline">Inactive boards never appear on the shop.</span>
                                </label>
                            </div>
                        </fieldset>

                        <div className="admin-hero-form-actions">
                            <button type="submit" className="admin-hero-btn admin-hero-btn--primary admin-hero-btn--lg" disabled={createBusy || !canCreateMore}>
                                {createBusy ? (
                                    <>
                                        <Loader2 className="admin-hero-spinner" size={18} aria-hidden />
                                        Creating…
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={18} aria-hidden />
                                        Publish board
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </section>

                <section className="admin-hero-list-wrap" aria-labelledby="admin-hero-list-h">
                    <div className="admin-hero-list-head">
                        <h2 id="admin-hero-list-h" className="admin-hero-h2">
                            Library
                        </h2>
                        <span className="admin-hero-count">{meta.total} total</span>
                    </div>
                    <form className="admin-hero-toolbar" onSubmit={submitSearch}>
                        <input
                            className="admin-hero-input"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search title, subtitle, CTA..."
                        />
                        <select
                            className="admin-hero-input"
                            value={filters.status}
                            onChange={(e) => {
                                setPage(1);
                                setFilters((f) => ({ ...f, status: e.target.value }));
                            }}
                        >
                            <option value="all">All statuses</option>
                            <option value="active">Active only</option>
                            <option value="inactive">Inactive only</option>
                        </select>
                        <select
                            className="admin-hero-input"
                            value={filters.sort}
                            onChange={(e) => {
                                setPage(1);
                                setFilters((f) => ({ ...f, sort: e.target.value }));
                            }}
                        >
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                            <option value="priority_desc">Priority high-low</option>
                            <option value="priority_asc">Priority low-high</option>
                            <option value="title_asc">Title A-Z</option>
                            <option value="title_desc">Title Z-A</option>
                            <option value="active_first">Active first</option>
                        </select>
                        <button type="submit" className="admin-hero-btn admin-hero-btn--primary admin-hero-btn--compact">
                            Search
                        </button>
                        <button type="button" className="admin-hero-btn admin-hero-btn--ghost admin-hero-btn--compact" onClick={resetFilters}>
                            Reset
                        </button>
                    </form>

                    {listLoading ? (
                        <div className="admin-hero-skeleton-list" aria-hidden>
                            <div className="admin-hero-skeleton-card" />
                            <div className="admin-hero-skeleton-card" />
                        </div>
                    ) : banners.length === 0 ? (
                        <div className="admin-hero-empty">
                            <span className="admin-hero-empty-icon" aria-hidden>
                                <Inbox size={40} strokeWidth={1.5} />
                            </span>
                            <p className="admin-hero-empty-title">No boards found</p>
                            <p className="admin-hero-empty-text">Try changing filters, or create a new board above.</p>
                            <button type="button" className="admin-hero-btn admin-hero-btn--ghost" onClick={scrollToCreate}>
                                Go to create form
                            </button>
                        </div>
                    ) : (
                        <ul className="admin-hero-card-list">
                            {banners.map((b) => {
                                const dates = formatBannerDates(b);
                                const isEditing = editingId === b.id;
                                return (
                                    <li key={b.id} className={`admin-hero-card${isEditing ? ' admin-hero-card--editing' : ''}`}>
                                        <div className="admin-hero-card-top">
                                            <div className="admin-hero-card-thumb-wrap">
                                                {b.image_url ? (
                                                    <img
                                                        src={b.image_url}
                                                        alt={b.title ? `Preview: ${b.title}` : 'Board thumbnail'}
                                                        className="admin-hero-card-thumb"
                                                    />
                                                ) : (
                                                    <div className="admin-hero-card-thumb admin-hero-card-thumb--empty" aria-hidden>
                                                        <ImageIcon size={28} strokeWidth={1.5} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="admin-hero-card-main">
                                                <div className="admin-hero-card-headline">
                                                    {!isEditing ? (
                                                        <>
                                                            <span className="admin-hero-card-id">#{b.id}</span>
                                                            <h3 className="admin-hero-card-title">{b.title}</h3>
                                                        </>
                                                    ) : null}
                                                </div>
                                                {!isEditing ? (
                                                    <>
                                                        <div className="admin-hero-chip-row">
                                                            <span className="admin-hero-chip">
                                                                <Hash size={14} aria-hidden />
                                                                Priority {b.priority}
                                                            </span>
                                                            {b.is_active ? (
                                                                <span className="admin-hero-chip admin-hero-chip--success">Active</span>
                                                            ) : (
                                                                <span className="admin-hero-chip admin-hero-chip--muted">Inactive</span>
                                                            )}
                                                        </div>
                                                        <p className="admin-hero-card-meta admin-hero-card-meta--icon">
                                                            <Calendar size={15} aria-hidden />
                                                            <span>
                                                                {dates.starts} → {dates.ends}
                                                            </span>
                                                        </p>
                                                        {b.subtitle ? <p className="admin-hero-card-desc">{b.subtitle}</p> : null}
                                                        {b.cta_text && b.cta_link ? (
                                                            <p className="admin-hero-card-meta admin-hero-card-meta--icon">
                                                                <Link2 size={15} aria-hidden />
                                                                <span>
                                                                    <span className="admin-hero-cta-preview">{b.cta_text}</span>
                                                                    <span className="admin-hero-cta-url"> · {b.cta_link}</span>
                                                                </span>
                                                            </p>
                                                        ) : null}
                                                    </>
                                                ) : editForm ? (
                                                    <div className="admin-hero-form admin-hero-form--compact">
                                                        <div className="admin-hero-form-grid">
                                                            <label className="admin-hero-field admin-hero-field--full">
                                                                <span className="admin-hero-label">Title *</span>
                                                                <input
                                                                    className="admin-hero-input"
                                                                    value={editForm.title}
                                                                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                                                                />
                                                            </label>
                                                            <label className="admin-hero-field admin-hero-field--full">
                                                                <span className="admin-hero-label">Subtitle</span>
                                                                <textarea
                                                                    className="admin-hero-textarea"
                                                                    rows={2}
                                                                    value={editForm.subtitle}
                                                                    onChange={(e) => setEditForm((f) => ({ ...f, subtitle: e.target.value }))}
                                                                />
                                                            </label>
                                                            <div className="admin-hero-field admin-hero-field--full">
                                                                <span className="admin-hero-label">Replace image</span>
                                                                <FileUploadField
                                                                    id={`admin-hero-edit-file-${b.id}`}
                                                                    inputRef={editFileRef}
                                                                    file={editFile}
                                                                    onFileChange={setEditFile}
                                                                />
                                                            </div>
                                                            <label className="admin-hero-field">
                                                                <span className="admin-hero-label">CTA text</span>
                                                                <input
                                                                    className="admin-hero-input"
                                                                    value={editForm.cta_text}
                                                                    onChange={(e) => setEditForm((f) => ({ ...f, cta_text: e.target.value }))}
                                                                />
                                                            </label>
                                                            <label className="admin-hero-field">
                                                                <span className="admin-hero-label">CTA link</span>
                                                                <input
                                                                    className="admin-hero-input"
                                                                    type="url"
                                                                    value={editForm.cta_link}
                                                                    onChange={(e) => setEditForm((f) => ({ ...f, cta_link: e.target.value }))}
                                                                />
                                                            </label>
                                                            <label className="admin-hero-field">
                                                                <span className="admin-hero-label">Priority</span>
                                                                <input
                                                                    className="admin-hero-input"
                                                                    type="number"
                                                                    min={0}
                                                                    value={editForm.priority}
                                                                    onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
                                                                />
                                                            </label>
                                                            <label className="admin-hero-field">
                                                                <span className="admin-hero-label">Starts</span>
                                                                <input
                                                                    className="admin-hero-input"
                                                                    type="datetime-local"
                                                                    value={editForm.starts_at}
                                                                    onChange={(e) => setEditForm((f) => ({ ...f, starts_at: e.target.value }))}
                                                                />
                                                            </label>
                                                            <label className="admin-hero-field">
                                                                <span className="admin-hero-label">Ends</span>
                                                                <input
                                                                    className="admin-hero-input"
                                                                    type="datetime-local"
                                                                    value={editForm.ends_at}
                                                                    onChange={(e) => setEditForm((f) => ({ ...f, ends_at: e.target.value }))}
                                                                />
                                                            </label>
                                                            <label className="admin-hero-field admin-hero-field--switch">
                                                                <span className="admin-hero-label">Active</span>
                                                                <span className="admin-hero-switch">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={editForm.is_active}
                                                                        onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                                                                    />
                                                                    <span className="admin-hero-switch-ui" aria-hidden />
                                                                </span>
                                                            </label>
                                                        </div>
                                                        <div className="admin-hero-card-actions">
                                                            <button
                                                                type="button"
                                                                className="admin-hero-btn admin-hero-btn--primary"
                                                                disabled={editBusy}
                                                                onClick={() => saveEdit(b.id)}
                                                            >
                                                                {editBusy ? (
                                                                    <>
                                                                        <Loader2 className="admin-hero-spinner" size={16} aria-hidden />
                                                                        Saving…
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <CheckCircle2 size={16} aria-hidden />
                                                                        Save changes
                                                                    </>
                                                                )}
                                                            </button>
                                                            <button type="button" className="admin-hero-btn admin-hero-btn--ghost" onClick={cancelEdit} disabled={editBusy}>
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                        {!isEditing ? (
                                            <div className="admin-hero-card-actions admin-hero-card-actions--row">
                                                <button type="button" className="admin-hero-btn admin-hero-btn--ghost" onClick={() => startEdit(b)}>
                                                    <Pencil size={16} aria-hidden />
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-hero-btn admin-hero-btn--ghost"
                                                    onClick={() => duplicateBoard(b.id)}
                                                    disabled={deleteBusyId === b.id || !canCreateMore}
                                                >
                                                    <Copy size={16} aria-hidden />
                                                    Duplicate
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-hero-btn admin-hero-btn--ghost"
                                                    onClick={() => toggleBoardActive(b.id, b.is_active)}
                                                    disabled={deleteBusyId === b.id}
                                                >
                                                    <ToggleLeft size={16} aria-hidden />
                                                    {b.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-hero-btn admin-hero-btn--ghost"
                                                    onClick={() => shiftBoardPriority(b.id, 'up')}
                                                    disabled={deleteBusyId === b.id}
                                                    title="Increase priority"
                                                >
                                                    <ArrowUp size={16} aria-hidden />
                                                    Up
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-hero-btn admin-hero-btn--ghost"
                                                    onClick={() => shiftBoardPriority(b.id, 'down')}
                                                    disabled={deleteBusyId === b.id || Number(b.priority) <= 0}
                                                    title="Decrease priority"
                                                >
                                                    <ArrowDown size={16} aria-hidden />
                                                    Down
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-hero-btn admin-hero-btn--danger"
                                                    onClick={() => handleDelete(b.id)}
                                                    disabled={deleteBusyId === b.id}
                                                >
                                                    {deleteBusyId === b.id ? (
                                                        <Loader2 className="admin-hero-spinner" size={16} aria-hidden />
                                                    ) : (
                                                        <Trash2 size={16} aria-hidden />
                                                    )}
                                                    <span>Delete</span>
                                                </button>
                                            </div>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <div className="admin-hero-pagination">
                        <button
                            type="button"
                            className="admin-hero-btn admin-hero-btn--ghost admin-hero-btn--compact"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={listLoading || page <= 1}
                        >
                            Previous
                        </button>
                        <span className="admin-hero-count">Page {meta.current_page} of {meta.last_page}</span>
                        <button
                            type="button"
                            className="admin-hero-btn admin-hero-btn--ghost admin-hero-btn--compact"
                            onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                            disabled={listLoading || page >= meta.last_page}
                        >
                            Next
                        </button>
                    </div>
                </section>
            </div>
            {confirmState ? (
                <div className="admin-hero-modal-backdrop" role="presentation">
                    <div
                        ref={confirmDialogRef}
                        className="admin-hero-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-hero-confirm-title"
                        aria-describedby="admin-hero-confirm-message"
                    >
                        <h3 id="admin-hero-confirm-title" className="admin-hero-h2">{confirmState.title}</h3>
                        <p id="admin-hero-confirm-message" className="admin-hero-text">{confirmState.message}</p>
                        <div className="admin-hero-form-actions">
                            <button
                                type="button"
                                className="admin-hero-btn admin-hero-btn--danger"
                                onClick={runConfirm}
                                disabled={confirmBusy}
                            >
                                {confirmBusy ? (
                                    <>
                                        <Loader2 className="admin-hero-spinner" size={16} aria-hidden />
                                        Working...
                                    </>
                                ) : (
                                    confirmState.confirmLabel || 'Confirm'
                                )}
                            </button>
                            <button
                                ref={confirmCancelRef}
                                type="button"
                                className="admin-hero-btn admin-hero-btn--ghost"
                                onClick={closeConfirm}
                                disabled={confirmBusy}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}









