import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Activity, ArrowLeft, ChevronRight, FileClock, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import AdminTip from './AdminTip.jsx';
import { AdminAccessState, AdminEmptyState, AdminErrorNotice } from './AdminRecovery.jsx';

const AUDIT_SORTS = new Set(['newest', 'oldest']);

function normalizePage(raw) {
    const value = parseInt(String(raw || '1'), 10);
    if (Number.isNaN(value) || value < 1) return 1;
    return value;
}

function formatDateTime(iso) {
    if (!iso) return '-';
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
    } catch {
        return '-';
    }
}

function prettyJson(value) {
    if (value === null || value === undefined) return '-';
    return JSON.stringify(value, null, 2);
}

function actionLabel(action) {
    return String(action || 'activity').replaceAll('.', ' ');
}

export default function AdminAuditLogs() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const routeParams = useParams();
    const routeSelectedId = /^\d+$/.test(routeParams.id || '') ? routeParams.id : '';
    const initialQ = (searchParams.get('q') || '').trim();
    const initialAction = searchParams.get('action') || 'all';
    const initialTargetType = searchParams.get('target_type') || 'all';
    const initialActor = searchParams.get('actor_id') || 'all';
    const initialSort = AUDIT_SORTS.has(searchParams.get('sort') || '') ? searchParams.get('sort') : 'newest';
    const initialPage = normalizePage(searchParams.get('page'));
    const querySelectedId = /^\d+$/.test(searchParams.get('selected') || '') ? searchParams.get('selected') : '';
    const initialSelected = routeSelectedId || querySelectedId;

    const [gate, setGate] = useState('loading');
    const [logs, setLogs] = useState([]);
    const [selectedLog, setSelectedLog] = useState(null);
    const [selectedId, setSelectedId] = useState(initialSelected);
    const [options, setOptions] = useState({ actions: [], target_types: [], actors: [] });
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchInput, setSearchInput] = useState(initialQ);
    const [filters, setFilters] = useState({
        q: initialQ,
        action: initialAction,
        target_type: initialTargetType,
        actor_id: initialActor,
        sort: initialSort,
    });
    const [page, setPage] = useState(initialPage);
    const [meta, setMeta] = useState({
        current_page: 1,
        last_page: 1,
        per_page: 12,
        total: 0,
    });

    useEffect(() => {
        let cancelled = false;
        axios.get('/api/me')
            .then((res) => {
                if (cancelled) return;
                const user = res.data?.user;
                if (!user) return setGate('unauthenticated');
                if (!user.permissions?.view_audit) return setGate('forbidden');
                setGate('admin');
            })
            .catch(() => {
                if (!cancelled) setGate('unauthenticated');
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (gate !== 'admin') return;
        let cancelled = false;
        setLoading(true);
        setError('');
        axios.get('/api/admin/audit-logs', {
            params: {
                q: filters.q,
                action: filters.action,
                target_type: filters.target_type,
                actor_id: filters.actor_id,
                sort: filters.sort,
                page,
                per_page: 12,
            },
        })
            .then((res) => {
                if (cancelled) return;
                setLogs(res.data?.logs || []);
                setOptions(res.data?.options || { actions: [], target_types: [], actors: [] });
                setMeta(res.data?.meta || {
                    current_page: 1,
                    last_page: 1,
                    per_page: 12,
                    total: 0,
                });
            })
            .catch(() => {
                if (cancelled) return;
                setLogs([]);
                setError('Failed to load audit logs.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [gate, filters, page]);

    useEffect(() => {
        if (page > meta.last_page) {
            setPage(Math.max(1, meta.last_page));
        }
    }, [page, meta.last_page]);

    useEffect(() => {
        const next = new URLSearchParams();
        if (filters.q) next.set('q', filters.q);
        if (filters.action !== 'all') next.set('action', filters.action);
        if (filters.target_type !== 'all') next.set('target_type', filters.target_type);
        if (filters.actor_id !== 'all') next.set('actor_id', filters.actor_id);
        if (filters.sort !== 'newest') next.set('sort', filters.sort);
        if (selectedId && !routeSelectedId) next.set('selected', selectedId);
        if (page > 1) next.set('page', String(page));
        setSearchParams(next, { replace: true });
    }, [filters, page, selectedId, routeSelectedId, setSearchParams]);

    useEffect(() => {
        if (routeSelectedId && routeSelectedId !== selectedId) {
            setSelectedId(routeSelectedId);
        }
    }, [routeSelectedId, selectedId]);

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
            action: 'all',
            target_type: 'all',
            actor_id: 'all',
            sort: 'newest',
        });
    };

    const retryAuditLogs = () => setFilters((f) => ({ ...f }));

    const openLog = async (logId, options = {}) => {
        const nextId = String(logId);
        const { syncUrl = true } = options;
        setSelectedId(nextId);
        if (syncUrl && routeSelectedId !== nextId) {
            const next = new URLSearchParams();
            if (filters.q) next.set('q', filters.q);
            if (filters.action !== 'all') next.set('action', filters.action);
            if (filters.target_type !== 'all') next.set('target_type', filters.target_type);
            if (filters.actor_id !== 'all') next.set('actor_id', filters.actor_id);
            if (filters.sort !== 'newest') next.set('sort', filters.sort);
            if (page > 1) next.set('page', String(page));
            navigate({
                pathname: `/admin/audit-logs/${nextId}`,
                search: next.toString() ? `?${next.toString()}` : '',
            });
        }
        setDetailLoading(true);
        setError('');
        try {
            const res = await axios.get(`/api/admin/audit-logs/${nextId}`);
            setSelectedLog(res.data?.log || null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load audit log detail.');
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        if (gate !== 'admin' || !selectedId || String(selectedLog?.id || '') === selectedId) return;
        openLog(selectedId, { syncUrl: !routeSelectedId });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gate, selectedId, selectedLog?.id, routeSelectedId]);

    if (gate === 'loading') return <div className="page-container admin-products-page">Loading...</div>;
    if (gate === 'unauthenticated') {
        return <AdminAccessState type="unauthenticated">Sign in with an admin account to inspect audit history and sensitive changes.</AdminAccessState>;
    }
    if (gate === 'forbidden') {
        return (
            <AdminAccessState backTo="/admin/users" backLabel="Back to Users">
                Your current role cannot view audit logs. Ask a Super Admin for audit access if you need to review staff activity.
            </AdminAccessState>
        );
    }

    const hasActiveFilters = filters.q !== '' || filters.action !== 'all' || filters.target_type !== 'all' || filters.actor_id !== 'all' || filters.sort !== 'newest';

    return (
        <div className="page-container admin-audit-page">
            <div className="admin-products-header">
                <div>
                    <h1>Audit Logs</h1>
                    <p className="admin-products-subtext">{meta.total} admin activity records found.</p>
                </div>
                <div className="admin-products-header-actions">
                    <Link to="/admin/users" className="admin-products-btn admin-products-btn--ghost">
                        <ArrowLeft size={15} aria-hidden="true" />
                        Back to Users
                    </Link>
                    <button type="button" className="admin-products-btn" onClick={retryAuditLogs} disabled={loading}>
                        <RefreshCw size={15} aria-hidden="true" />
                        Refresh
                    </button>
                </div>
            </div>

            {error ? (
                <AdminErrorNotice onRetry={selectedId ? () => openLog(selectedId, { syncUrl: false }) : retryAuditLogs}>
                    {error}
                </AdminErrorNotice>
            ) : null}

            <AdminTip id="audit-logs">
                Use the detail URL when you need to hand off a specific audit record. Security notifications now open directly on the related audit entry.
            </AdminTip>

            <section className="admin-products-panel">
                <form className="admin-products-toolbar" onSubmit={submitSearch}>
                    <div className="admin-orders-search">
                        <Search size={16} aria-hidden="true" />
                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search action, actor, target..."
                        />
                    </div>
                    <select
                        value={filters.action}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, action: e.target.value }));
                        }}
                    >
                        <option value="all">All actions</option>
                        {(options.actions || []).map((action) => (
                            <option key={action} value={action}>{actionLabel(action)}</option>
                        ))}
                    </select>
                    <select
                        value={filters.target_type}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, target_type: e.target.value }));
                        }}
                    >
                        <option value="all">All targets</option>
                        {(options.target_types || []).map((targetType) => (
                            <option key={targetType} value={targetType}>{targetType}</option>
                        ))}
                    </select>
                    <select
                        value={filters.actor_id}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, actor_id: e.target.value }));
                        }}
                    >
                        <option value="all">All actors</option>
                        {(options.actors || []).map((actor) => (
                            <option key={actor.id} value={actor.id}>{actor.username}</option>
                        ))}
                    </select>
                    <select
                        value={filters.sort}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, sort: e.target.value }));
                        }}
                    >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                    </select>
                    <button type="submit" className="admin-products-btn">Search</button>
                    <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={resetFilters}>
                        Reset
                    </button>
                </form>
            </section>

            <div className="admin-orders-layout">
                <section className="admin-products-panel">
                    {loading ? <p className="admin-products-state">Loading audit logs...</p> : null}
                    {!loading && logs.length === 0 ? (
                        <AdminEmptyState
                            title="No audit logs found"
                            actions={hasActiveFilters ? (
                                <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={resetFilters}>
                                    Reset Filters
                                </button>
                            ) : (
                                <Link to="/admin/users" className="admin-products-btn admin-products-btn--ghost">Back to Users</Link>
                            )}
                        >
                            {hasActiveFilters ? 'Your current filters are hiding all audit records. Reset them or broaden the search.' : 'No admin activity has been recorded yet. User and inventory actions will appear here after changes happen.'}
                        </AdminEmptyState>
                    ) : (
                        <ul className="admin-audit-list">
                            {logs.map((log) => (
                                <li key={log.id}>
                                    <button
                                        type="button"
                                        className={`admin-audit-row ${selectedLog?.id === log.id ? 'admin-audit-row--selected' : ''}`}
                                        onClick={() => openLog(log.id)}
                                    >
                                        <span className="admin-audit-icon" aria-hidden="true">
                                            <Activity size={18} />
                                        </span>
                                        <span className="admin-audit-row-main">
                                            <strong>{actionLabel(log.action)}</strong>
                                            <span>{log.actor?.username || 'System'} - {formatDateTime(log.created_at)}</span>
                                        </span>
                                        <span className="admin-audit-target">{log.target_type} #{log.target_id || '-'}</span>
                                        <ChevronRight size={17} aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="admin-products-pagination">
                        <button
                            type="button"
                            className="admin-products-btn"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1 || loading}
                        >
                            Previous
                        </button>
                        <p>Page {meta.current_page} of {meta.last_page}</p>
                        <button
                            type="button"
                            className="admin-products-btn"
                            onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                            disabled={page >= meta.last_page || loading}
                        >
                            Next
                        </button>
                    </div>
                </section>

                <aside className="admin-products-panel admin-orders-detail-panel">
                    {detailLoading ? (
                        <div className="admin-orders-detail-empty">
                            <Loader2 className="checkout-spinner" size={24} aria-hidden="true" />
                            <p>Loading audit log...</p>
                        </div>
                    ) : selectedLog ? (
                        <AuditDetail log={selectedLog} />
                    ) : (
                        <div className="admin-orders-detail-empty">
                            <FileClock size={28} aria-hidden="true" />
                            <p>Select an activity record to inspect before and after state.</p>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

function AuditDetail({ log }) {
    return (
        <div className="admin-audit-detail">
            <div className="admin-audit-detail-head">
                <span className="admin-audit-icon admin-audit-icon--lg" aria-hidden="true">
                    <ShieldCheck size={22} />
                </span>
                <div>
                    <p className="admin-products-id">Audit #{log.id}</p>
                    <h2>{actionLabel(log.action)}</h2>
                    <p>{formatDateTime(log.created_at)}</p>
                </div>
            </div>

            <div className="admin-orders-detail-grid">
                <div>
                    <span>Actor</span>
                    <strong>{log.actor?.username || 'System'}</strong>
                </div>
                <div>
                    <span>Target</span>
                    <strong>{log.target_type} #{log.target_id || '-'}</strong>
                </div>
            </div>

            <section className="admin-orders-detail-section">
                <h3>Metadata</h3>
                <pre className="admin-audit-json">{prettyJson(log.meta)}</pre>
            </section>

            <section className="admin-orders-detail-section">
                <h3>Before</h3>
                <pre className="admin-audit-json">{prettyJson(log.before_state)}</pre>
            </section>

            <section className="admin-orders-detail-section">
                <h3>After</h3>
                <pre className="admin-audit-json">{prettyJson(log.after_state)}</pre>
            </section>
        </div>
    );
}
