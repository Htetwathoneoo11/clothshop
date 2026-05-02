import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Activity, BadgePercent, ChevronRight, Loader2, RefreshCw, Search, Shield, UserPlus, UserRound, Users } from 'lucide-react';
import { formatMMK } from '../utils/money.js';
import AdminTip from './AdminTip.jsx';
import { AdminAccessState, AdminEmptyState, AdminErrorNotice } from './AdminRecovery.jsx';

const USER_ROLES = new Set(['all', 'user', 'admin', 'super_admin', 'manager', 'support', 'inventory_admin']);
const ROLE_OPTIONS = [
    { value: 1, label: 'User' },
    { value: 2, label: 'Super Admin' },
    { value: 3, label: 'Manager' },
    { value: 4, label: 'Support' },
    { value: 5, label: 'Inventory Admin' },
];
const USER_STATUS = new Set(['all', 'active', 'restricted']);
const USER_SORTS = new Set(['newest', 'oldest', 'username_asc', 'credit_desc', 'spend_desc', 'orders_desc']);

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

function statusLabel(status) {
    return Number(status) === 1 ? 'Active' : 'Restricted';
}

function roleLabel(role) {
    return ROLE_OPTIONS.find((option) => Number(option.value) === Number(role))?.label || 'User';
}

function orderStatusLabel(status) {
    switch (status) {
        case 'pending':
            return 'Pending';
        case 'paid':
            return 'Paid';
        case 'failed':
            return 'Failed';
        case 'cancelled':
            return 'Cancelled';
        default:
            return status || 'Unknown';
    }
}

function initials(username) {
    if (!username) return '?';
    const parts = String(username).trim().split(/\s+/);
    if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return String(username).slice(0, 2).toUpperCase();
}

export default function AdminUsers() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const routeParams = useParams();
    const routeSelectedId = /^\d+$/.test(routeParams.id || '') ? routeParams.id : '';
    const initialQ = (searchParams.get('q') || '').trim();
    const initialRole = USER_ROLES.has(searchParams.get('role') || '') ? searchParams.get('role') : 'all';
    const initialStatus = USER_STATUS.has(searchParams.get('status') || '') ? searchParams.get('status') : 'all';
    const initialSort = USER_SORTS.has(searchParams.get('sort') || '') ? searchParams.get('sort') : 'newest';
    const initialPage = normalizePage(searchParams.get('page'));
    const querySelectedId = /^\d+$/.test(searchParams.get('selected') || '') ? searchParams.get('selected') : '';
    const initialSelected = routeSelectedId || querySelectedId;

    const [gate, setGate] = useState('loading');
    const [currentUser, setCurrentUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedId, setSelectedId] = useState(initialSelected);
    const [invitations, setInvitations] = useState([]);
    const [inviteRoles, setInviteRoles] = useState(ROLE_OPTIONS.filter((option) => option.value > 2));
    const [roleMatrix, setRoleMatrix] = useState({ roles: [], permissions: [] });
    const [inviteForm, setInviteForm] = useState({ username: '', email: '', role: 3, expires_in_days: 7 });
    const [inviteBusy, setInviteBusy] = useState(false);
    const [latestInviteUrl, setLatestInviteUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionBusy, setActionBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);
    const [searchInput, setSearchInput] = useState(initialQ);
    const [filters, setFilters] = useState({
        q: initialQ,
        role: initialRole,
        status: initialStatus,
        sort: initialSort,
    });
    const [page, setPage] = useState(initialPage);
    const [meta, setMeta] = useState({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
    });

    useEffect(() => {
        let cancelled = false;
        axios.get('/api/me')
            .then((res) => {
                if (cancelled) return;
                const user = res.data?.user;
                setCurrentUser(user || null);
                if (!user) return setGate('unauthenticated');
                if (!user.permissions?.manage_users) return setGate('forbidden');
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
        axios.get('/api/admin/users', {
            params: {
                q: filters.q,
                role: filters.role,
                status: filters.status,
                sort: filters.sort,
                page,
                per_page: 10,
            },
        })
            .then((res) => {
                if (cancelled) return;
                setUsers(res.data?.users || []);
                setRoleMatrix(res.data?.role_matrix || { roles: [], permissions: [] });
                setMeta(res.data?.meta || {
                    current_page: 1,
                    last_page: 1,
                    per_page: 10,
                    total: 0,
                });
            })
            .catch(() => {
                if (cancelled) return;
                setUsers([]);
                setError('Failed to load users.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [gate, filters, page]);

    useEffect(() => {
        if (gate !== 'admin') return;
        let cancelled = false;
        axios.get('/api/admin/staff-invitations')
            .then((res) => {
                if (cancelled) return;
                setInvitations(res.data?.invitations || []);
                setInviteRoles(res.data?.roles || inviteRoles);
                setInviteForm((form) => ({
                    ...form,
                    role: Number(form.role || res.data?.roles?.[0]?.value || 3),
                }));
            })
            .catch(() => {
                if (!cancelled) setError('Failed to load staff invitations.');
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gate]);

    useEffect(() => {
        if (page > meta.last_page) {
            setPage(Math.max(1, meta.last_page));
        }
    }, [page, meta.last_page]);

    useEffect(() => {
        const next = new URLSearchParams();
        if (filters.q) next.set('q', filters.q);
        if (filters.role !== 'all') next.set('role', filters.role);
        if (filters.status !== 'all') next.set('status', filters.status);
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
            role: 'all',
            status: 'all',
            sort: 'newest',
        });
    };

    const retryUsers = () => setFilters((f) => ({ ...f }));

    const openUser = async (userId, options = {}) => {
        const nextId = String(userId);
        const { syncUrl = true } = options;
        setSelectedId(nextId);
        if (syncUrl && routeSelectedId !== nextId) {
            const next = new URLSearchParams();
            if (filters.q) next.set('q', filters.q);
            if (filters.role !== 'all') next.set('role', filters.role);
            if (filters.status !== 'all') next.set('status', filters.status);
            if (filters.sort !== 'newest') next.set('sort', filters.sort);
            if (page > 1) next.set('page', String(page));
            navigate({
                pathname: `/admin/users/${nextId}`,
                search: next.toString() ? `?${next.toString()}` : '',
            });
        }
        setDetailLoading(true);
        setError('');
        setNotice('');
        try {
            const res = await axios.get(`/api/admin/users/${nextId}`);
            setSelectedUser(res.data?.user || null);
            setRoleMatrix(res.data?.role_matrix || roleMatrix);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load user details.');
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        if (gate !== 'admin' || !selectedId || String(selectedUser?.id || '') === selectedId) return;
        openUser(selectedId, { syncUrl: !routeSelectedId });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gate, selectedId, selectedUser?.id, routeSelectedId]);

    const mergeUpdatedUser = (updated) => {
        setSelectedUser(updated);
        setUsers((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
    };

    const updateRole = async (role) => {
        if (!selectedUser || Number(selectedUser.role) === Number(role)) return;
        setConfirmAction({
            type: 'role',
            value: Number(role),
            title: 'Change user role?',
            body: `${selectedUser.username} will become ${roleLabel(role)}. This can change what admin tools they can access.`,
            confirmLabel: 'Change Role',
        });
    };

    const updateStatus = async (status) => {
        if (!selectedUser || Number(selectedUser.status) === Number(status)) return;
        setConfirmAction({
            type: 'status',
            value: Number(status),
            title: `${Number(status) === 1 ? 'Activate' : 'Restrict'} user?`,
            body: `${selectedUser.username} will be ${statusLabel(status).toLowerCase()}.`,
            confirmLabel: Number(status) === 1 ? 'Activate User' : 'Restrict User',
        });
    };

    const createInvite = async (event) => {
        event.preventDefault();
        setInviteBusy(true);
        setError('');
        setNotice('');
        setLatestInviteUrl('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            const res = await axios.post('/api/admin/staff-invitations', {
                username: inviteForm.username.trim(),
                email: inviteForm.email.trim(),
                role: Number(inviteForm.role),
                expires_in_days: Number(inviteForm.expires_in_days || 7),
            });
            const invitation = res.data?.invitation;
            setInvitations((items) => [invitation, ...items]);
            setLatestInviteUrl(invitation.accept_url || '');
            setInviteForm((form) => ({ ...form, username: '', email: '' }));
            setNotice(`Invitation email sent to ${invitation.email}.`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create staff invitation.');
        } finally {
            setInviteBusy(false);
        }
    };

    const requestCancelInvite = (invitation) => {
        setConfirmAction({
            type: 'cancel_invite',
            invitationId: invitation.id,
            title: 'Cancel staff invitation?',
            body: `${invitation.email} will no longer be able to accept this staff invite.`,
            confirmLabel: 'Cancel Invite',
        });
    };

    const runConfirmedAction = async () => {
        if (!confirmAction) return;
        setActionBusy(true);
        setError('');
        setNotice('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            if (confirmAction.type === 'role') {
                const res = await axios.patch(`/api/admin/users/${selectedUser.id}/role`, { role: Number(confirmAction.value) });
                mergeUpdatedUser(res.data?.user);
                setNotice(`${selectedUser.username} is now ${roleLabel(confirmAction.value).toLowerCase()}.`);
            }

            if (confirmAction.type === 'status') {
                const res = await axios.patch(`/api/admin/users/${selectedUser.id}/status`, { status: Number(confirmAction.value) });
                mergeUpdatedUser(res.data?.user);
                setNotice(`${selectedUser.username} is now ${statusLabel(confirmAction.value).toLowerCase()}.`);
            }

            if (confirmAction.type === 'cancel_invite') {
                const res = await axios.patch(`/api/admin/staff-invitations/${confirmAction.invitationId}/cancel`);
                const updated = res.data?.invitation;
                setInvitations((items) => items.map((item) => item.id === updated.id ? updated : item));
                setNotice(`Invitation for ${updated.email} cancelled.`);
            }
            setConfirmAction(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to complete action.');
        } finally {
            setActionBusy(false);
        }
    };

    if (gate === 'loading') return <div className="page-container admin-products-page">Loading...</div>;
    if (gate === 'unauthenticated') {
        return <AdminAccessState type="unauthenticated">Sign in with an admin account to manage customers, staff roles, and invitations.</AdminAccessState>;
    }
    if (gate === 'forbidden') {
        return (
            <AdminAccessState>
                Your current role cannot manage users. Ask a Super Admin for the Super Admin role if you need staff and account controls.
            </AdminAccessState>
        );
    }

    const hasActiveFilters = filters.q !== '' || filters.role !== 'all' || filters.status !== 'all' || filters.sort !== 'newest';

    return (
        <div className="page-container admin-users-page">
            <div className="admin-products-header">
                <div>
                    <h1>Users</h1>
                    <p className="admin-products-subtext">{meta.total} accounts found.</p>
                </div>
                <div className="admin-products-header-actions">
                    <Link to="/admin" className="admin-products-btn admin-products-btn--ghost">Dashboard</Link>
                    <button type="button" className="admin-products-btn" onClick={retryUsers} disabled={loading}>
                        <RefreshCw size={15} aria-hidden="true" />
                        Refresh
                    </button>
                </div>
            </div>

            {notice ? <p className="admin-products-notice admin-products-notice--ok">{notice}</p> : null}
            {error ? (
                <AdminErrorNotice onRetry={selectedId ? () => openUser(selectedId, { syncUrl: false }) : retryUsers}>
                    {error}
                </AdminErrorNotice>
            ) : null}

            <AdminTip id="users">
                User detail links are now shareable. Use them when you need another admin to review a role, status, order history, or activity timeline for one account.
            </AdminTip>

            <section className="admin-related-tools" aria-label="User related admin tools">
                <div>
                    <strong>Related user tools</strong>
                    <span>Review sensitive account changes and staff actions.</span>
                </div>
                <Link to="/admin/audit-logs" className="admin-products-btn admin-products-btn--ghost">
                    <Activity size={15} aria-hidden="true" />
                    Audit Logs
                </Link>
            </section>

            <section className="admin-products-panel">
                <form className="admin-staff-invite-form" onSubmit={createInvite}>
                    <div>
                        <h2><UserPlus size={18} aria-hidden="true" /> Invite staff</h2>
                        <p>Create a one-time invite link for Manager, Support, or Inventory Admin.</p>
                    </div>
                    <input
                        value={inviteForm.username}
                        onChange={(e) => setInviteForm((form) => ({ ...form, username: e.target.value }))}
                        placeholder="Username"
                        required
                    />
                    <input
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm((form) => ({ ...form, email: e.target.value }))}
                        placeholder="Email"
                        type="email"
                        required
                    />
                    <select
                        value={inviteForm.role}
                        onChange={(e) => setInviteForm((form) => ({ ...form, role: Number(e.target.value) }))}
                    >
                        {inviteRoles.map((role) => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                    </select>
                    <label className="admin-staff-invite-expiry">
                        <span>Expires in days</span>
                        <input
                            value={inviteForm.expires_in_days}
                            onChange={(e) => setInviteForm((form) => ({ ...form, expires_in_days: e.target.value }))}
                            type="number"
                            min="1"
                            max="30"
                        />
                    </label>
                    <button type="submit" className="admin-products-btn" disabled={inviteBusy}>
                        {inviteBusy ? 'Inviting...' : 'Create Invite'}
                    </button>
                </form>
                {latestInviteUrl ? (
                    <div className="admin-staff-invite-link">
                        <strong>Invite link</strong>
                        <input value={latestInviteUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
                    </div>
                ) : null}
                {invitations.length > 0 ? (
                    <ul className="admin-staff-invite-list">
                        {invitations.slice(0, 6).map((invitation) => (
                            <li key={invitation.id}>
                                <div>
                                    <strong>{invitation.email}</strong>
                                    <span>{invitation.role_label} - {invitation.status} - expires {formatDateTime(invitation.expires_at)}</span>
                                </div>
                                {invitation.status === 'pending' ? (
                                    <button type="button" className="admin-dashboard-text-link admin-notification-action" onClick={() => requestCancelInvite(invitation)}>
                                        Cancel
                                    </button>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                ) : null}
            </section>

            {roleMatrix.permissions.length > 0 ? (
                <RoleMatrix matrix={roleMatrix} />
            ) : null}

            <section className="admin-products-panel">
                <form className="admin-products-toolbar" onSubmit={submitSearch}>
                    <div className="admin-orders-search">
                        <Search size={16} aria-hidden="true" />
                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search users, email, IP..."
                        />
                    </div>
                    <select
                        value={filters.role}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, role: e.target.value }));
                        }}
                    >
                        <option value="all">All roles</option>
                        <option value="user">Users</option>
                        <option value="admin">All admin roles</option>
                        <option value="super_admin">Super Admins</option>
                        <option value="manager">Managers</option>
                        <option value="support">Support</option>
                        <option value="inventory_admin">Inventory Admins</option>
                    </select>
                    <select
                        value={filters.status}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, status: e.target.value }));
                        }}
                    >
                        <option value="all">All statuses</option>
                        <option value="active">Active</option>
                        <option value="restricted">Restricted</option>
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
                        <option value="username_asc">Username A-Z</option>
                        <option value="credit_desc">Credit high-low</option>
                        <option value="spend_desc">Spend high-low</option>
                        <option value="orders_desc">Orders high-low</option>
                    </select>
                    <button type="submit" className="admin-products-btn">Search</button>
                    <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={resetFilters}>
                        Reset
                    </button>
                </form>
            </section>

            <div className="admin-orders-layout">
                <section className="admin-products-panel">
                    {loading ? <p className="admin-products-state">Loading users...</p> : null}
                    {!loading && users.length === 0 ? (
                        <AdminEmptyState
                            title="No users found"
                            actions={hasActiveFilters ? (
                                <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={resetFilters}>
                                    Reset Filters
                                </button>
                            ) : (
                                <Link to="/admin/audit-logs" className="admin-products-btn admin-products-btn--ghost">Open Audit Logs</Link>
                            )}
                        >
                            {hasActiveFilters ? 'Your current filters are hiding all accounts. Reset them or broaden the search.' : 'No accounts are available to manage yet. Audit logs can still show recent staff activity.'}
                        </AdminEmptyState>
                    ) : (
                        <ul className="admin-users-list">
                            {users.map((user) => (
                                <li key={user.id}>
                                    <button
                                        type="button"
                                        className={`admin-users-row ${selectedUser?.id === user.id ? 'admin-users-row--selected' : ''}`}
                                        onClick={() => openUser(user.id)}
                                    >
                                        <span className="admin-users-avatar" aria-hidden="true">
                                            {user.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user.username)}
                                        </span>
                                        <span className="admin-users-row-main">
                                            <strong>{user.username}</strong>
                                            <span>{user.email}</span>
                                        </span>
                                        <span className="admin-users-row-side">
                                            <span className={`admin-user-chip ${user.is_admin ? 'admin-user-chip--admin' : 'admin-user-chip--user'}`}>
                                                {user.role_label}
                                            </span>
                                            <span className={`admin-user-chip ${Number(user.status) === 1 ? 'admin-user-chip--active' : 'admin-user-chip--restricted'}`}>
                                                {user.status_label}
                                            </span>
                                        </span>
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
                            <p>Loading user...</p>
                        </div>
                    ) : selectedUser ? (
                        <UserDetail
                            user={selectedUser}
                            currentUser={currentUser}
                            actionBusy={actionBusy}
                            onRoleChange={updateRole}
                            onStatusChange={updateStatus}
                        />
                    ) : (
                        <div className="admin-orders-detail-empty">
                            <Users size={28} aria-hidden="true" />
                            <p>Select a user to review orders, rewards, and account controls.</p>
                        </div>
                    )}
                </aside>
            </div>
            {confirmAction ? (
                <ConfirmDialog
                    title={confirmAction.title}
                    body={confirmAction.body}
                    confirmLabel={confirmAction.confirmLabel}
                    busy={actionBusy}
                    onCancel={() => setConfirmAction(null)}
                    onConfirm={runConfirmedAction}
                />
            ) : null}
        </div>
    );
}

function RoleMatrix({ matrix }) {
    return (
        <section className="admin-products-panel admin-role-matrix-panel">
            <div className="admin-role-matrix-head">
                <div>
                    <h2>
                        <Shield size={18} aria-hidden="true" />
                        Admin role permissions
                    </h2>
                    <p>Locked reference for what each staff role can access.</p>
                </div>
            </div>
            <div className="admin-role-matrix">
                <div className="admin-role-matrix-row admin-role-matrix-row--head">
                    <span>Permission</span>
                    {matrix.roles.map((role) => (
                        <strong key={role.role}>{role.label}</strong>
                    ))}
                </div>
                {matrix.permissions.map((permission) => (
                    <div className="admin-role-matrix-row" key={permission.key}>
                        <span>{permission.label}</span>
                        {matrix.roles.map((role) => (
                            <span
                                key={`${role.role}-${permission.key}`}
                                className={`admin-role-permission-dot ${role.permissions?.[permission.key] ? 'admin-role-permission-dot--yes' : 'admin-role-permission-dot--no'}`}
                                aria-label={`${role.label} ${role.permissions?.[permission.key] ? 'can' : 'cannot'} ${permission.label}`}
                            >
                                {role.permissions?.[permission.key] ? 'Yes' : 'No'}
                            </span>
                        ))}
                    </div>
                ))}
            </div>
        </section>
    );
}

function UserDetail({ user, currentUser, actionBusy, onRoleChange, onStatusChange }) {
    const isSelf = Number(currentUser?.id) === Number(user.id);

    return (
        <div className="admin-users-detail">
            <div className="admin-users-detail-head">
                <span className="admin-users-avatar admin-users-avatar--lg" aria-hidden="true">
                    {user.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user.username)}
                </span>
                <div>
                    <p className="admin-products-id">User #{user.id}</p>
                    <h2>{user.username}</h2>
                    <p>{user.email}</p>
                </div>
            </div>

            <div className="admin-orders-detail-grid">
                <div>
                    <span>Credit</span>
                    <strong>{formatMMK(user.credit_score || 0)}</strong>
                </div>
                <div>
                    <span>Paid spend</span>
                    <strong>{formatMMK(user.paid_spend_mmk || 0)}</strong>
                </div>
                <div>
                    <span>Orders</span>
                    <strong>{user.orders_count || 0}</strong>
                </div>
                <div>
                    <span>Coupons</span>
                    <strong>{user.coupons_count || 0}</strong>
                </div>
            </div>

            <section className="admin-users-controls">
                <label className="admin-orders-status-field">
                    <span>Role</span>
                    <select value={user.role} onChange={(e) => onRoleChange(e.target.value)} disabled={actionBusy || isSelf}>
                        {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>
                <label className="admin-orders-status-field">
                    <span>Status</span>
                    <select value={user.status} onChange={(e) => onStatusChange(e.target.value)} disabled={actionBusy || isSelf}>
                        <option value={1}>Active</option>
                        <option value={0}>Restricted</option>
                    </select>
                </label>
                {isSelf ? <p className="admin-users-self-note">Self role and status changes are blocked here.</p> : null}
            </section>

            <section className="admin-orders-detail-section">
                <h3>
                    <Shield size={16} aria-hidden="true" />
                    Account
                </h3>
                <p>{user.has_verified_email ? 'Email verified' : 'Email not verified'}</p>
                <p>Joined {formatDateTime(user.created_at)}</p>
                <p>Last login {formatDateTime(user.last_login_at)}</p>
                <p>IP {user.last_login_ip || '-'}</p>
            </section>

            <section className="admin-orders-detail-section">
                <h3>
                    <Activity size={16} aria-hidden="true" />
                    Admin activity timeline
                </h3>
                {(user.timeline || []).length === 0 ? (
                    <p>No admin activity recorded for this user yet.</p>
                ) : (
                    <ul className="admin-users-timeline">
                        {user.timeline.map((item) => (
                            <li key={item.id}>
                                <span className={`admin-users-timeline-dot admin-users-timeline-dot--${item.source}`} aria-hidden="true" />
                                <div>
                                    <strong>{item.title}</strong>
                                    <span>{item.description}</span>
                                    <small>
                                        {formatDateTime(item.created_at)}
                                        {item.actor?.username ? ` by ${item.actor.username}` : ''}
                                        {item.action_url ? (
                                            <>
                                                {' - '}
                                                <Link to={item.action_url}>Open context</Link>
                                            </>
                                        ) : null}
                                    </small>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="admin-orders-detail-section">
                <h3>
                    <UserRound size={16} aria-hidden="true" />
                    Recent orders
                </h3>
                {(user.orders || []).length === 0 ? (
                    <p>No orders yet.</p>
                ) : (
                    <ul className="admin-users-mini-list">
                        {user.orders.map((order) => (
                            <li key={order.id}>
                                <div>
                                    <strong>Order #{order.id}</strong>
                                    <span>{orderStatusLabel(order.status)} - {formatDateTime(order.created_at)}</span>
                                </div>
                                <strong>{formatMMK(order.total_amount_mmk)}</strong>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="admin-orders-detail-section">
                <h3>
                    <BadgePercent size={16} aria-hidden="true" />
                    Coupons
                </h3>
                {(user.coupons || []).length === 0 ? (
                    <p>No coupons yet.</p>
                ) : (
                    <ul className="admin-users-mini-list">
                        {user.coupons.map((coupon) => (
                            <li key={coupon.id}>
                                <div>
                                    <strong>{coupon.code}</strong>
                                    <span>{coupon.discount_percent}% after {formatMMK(coupon.threshold_mmk)}</span>
                                </div>
                                <span className={`admin-user-chip admin-user-chip--${coupon.status}`}>{coupon.status}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function ConfirmDialog({ title, body, confirmLabel, busy, onCancel, onConfirm }) {
    return (
        <div className="admin-confirm-backdrop" role="presentation">
            <div className="admin-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
                <h2 id="admin-confirm-title">{title}</h2>
                <p>{body}</p>
                <div className="admin-confirm-actions">
                    <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={onCancel} disabled={busy}>
                        Keep Current
                    </button>
                    <button type="button" className="admin-products-btn admin-products-btn--danger" onClick={onConfirm} disabled={busy}>
                        {busy ? 'Working...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
