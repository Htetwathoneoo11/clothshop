import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatMMK } from '../utils/money.js';
import { AdminAccessState, AdminErrorNotice } from './AdminRecovery.jsx';

const CATEGORY_OPTIONS = [
    'General',
    'Topwear',
    'Bottomwear',
    'Outerwear',
    'Dresses',
    'Footwear',
    'Accessories',
];

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '30', '32', '34', '36', '38', '40', '41', '42', '43', '44'];

function emptyVariantForm() {
    return {
        color: '',
        size: '',
        price_mmk: '',
        stock: '',
        sku: '',
    };
}

function stockBadge(stockValue) {
    const stock = Number(stockValue) || 0;
    if (stock <= 0) return { text: 'Out of stock', className: 'admin-products-stock-badge admin-products-stock-badge--out' };
    if (stock <= 5) return { text: 'Low stock', className: 'admin-products-stock-badge admin-products-stock-badge--low' };
    return { text: 'In stock', className: 'admin-products-stock-badge admin-products-stock-badge--ok' };
}

export default function AdminProductEdit() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [gate, setGate] = useState('loading');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [product, setProduct] = useState(null);
    const [form, setForm] = useState(null);
    const [editImage, setEditImage] = useState(null);
    const [editImagePreview, setEditImagePreview] = useState('');

    const [variantForm, setVariantForm] = useState(() => emptyVariantForm());
    const [variantBusy, setVariantBusy] = useState(false);
    const [editingVariantId, setEditingVariantId] = useState(null);
    const [editingVariantForm, setEditingVariantForm] = useState(null);

    const loadProduct = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/admin/products/${id}`);
            const p = res.data?.product;
            setProduct(p);
            const normalizedCategory = CATEGORY_OPTIONS.includes(p.category) ? p.category : 'General';
            setForm({
                name: p.name || '',
                category: normalizedCategory,
                brand: p.brand || '',
                description: p.description || '',
                image_url: p.image_url || null,
                is_active: Boolean(p.is_active),
                remove_image: false,
            });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load product.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const me = await axios.get('/api/me');
                const user = me.data?.user;
                if (cancelled) return;
                if (!user) return setGate('unauthenticated');
                if (!user.permissions?.manage_catalog) return setGate('forbidden');
                setGate('admin');
                await loadProduct();
            } catch {
                if (!cancelled) setGate('unauthenticated');
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        if (!editImage) {
            setEditImagePreview('');
            return undefined;
        }
        const url = URL.createObjectURL(editImage);
        setEditImagePreview(url);
        return () => URL.revokeObjectURL(url);
    }, [editImage]);

    const saveProduct = async (e) => {
        e.preventDefault();
        if (!form) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            const fd = new FormData();
            fd.append('name', form.name);
            fd.append('category', form.category || 'General');
            if (form.brand) fd.append('brand', form.brand);
            if (form.description) fd.append('description', form.description);
            fd.append('is_active', form.is_active ? '1' : '0');
            if (editImage) fd.append('image', editImage);
            if (form.remove_image) fd.append('remove_image', '1');
            await axios.post(`/api/admin/products/${id}?_method=PUT`, fd);
            setNotice('Product updated.');
            setEditImage(null);
            await loadProduct();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update product.');
        } finally {
            setBusy(false);
        }
    };

    const addVariant = async () => {
        setVariantBusy(true);
        setError('');
        setNotice('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            await axios.post(`/api/admin/products/${id}/variants`, {
                ...variantForm,
                price_mmk: parseInt(variantForm.price_mmk, 10) || 0,
                stock: parseInt(variantForm.stock, 10) || 0,
            });
            setVariantForm(emptyVariantForm());
            setNotice('Variant added.');
            await loadProduct();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to add variant.');
        } finally {
            setVariantBusy(false);
        }
    };

    const startVariantEdit = (variant) => {
        setEditingVariantId(variant.id);
        setEditingVariantForm({
            color: variant.color || '',
            size: variant.size || '',
            price_mmk: String(variant.price_mmk ?? ''),
            stock: String(variant.stock ?? ''),
            sku: variant.sku || '',
        });
    };

    const saveVariantEdit = async (variantId) => {
        if (!editingVariantForm) return;
        setVariantBusy(true);
        setError('');
        setNotice('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            await axios.put(`/api/admin/product-variants/${variantId}`, {
                ...editingVariantForm,
                price_mmk: parseInt(editingVariantForm.price_mmk, 10) || 0,
                stock: parseInt(editingVariantForm.stock, 10) || 0,
            });
            setEditingVariantId(null);
            setEditingVariantForm(null);
            setNotice('Variant updated.');
            await loadProduct();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update variant.');
        } finally {
            setVariantBusy(false);
        }
    };

    const deleteVariant = async (variantId) => {
        if (!window.confirm('Delete this variant?')) return;
        setVariantBusy(true);
        setError('');
        setNotice('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            await axios.delete(`/api/admin/product-variants/${variantId}`);
            setNotice('Variant deleted.');
            if (editingVariantId === variantId) {
                setEditingVariantId(null);
                setEditingVariantForm(null);
            }
            await loadProduct();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete variant.');
        } finally {
            setVariantBusy(false);
        }
    };

    const deleteProduct = async () => {
        if (!window.confirm('Delete this product and all its variants?')) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            await axios.delete(`/api/admin/products/${id}`);
            navigate('/admin/products');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete product.');
        } finally {
            setBusy(false);
        }
    };

    if (gate === 'loading') return <div className="page-container admin-products-page">Loading...</div>;
    if (gate === 'unauthenticated') {
        return <AdminAccessState type="unauthenticated">Sign in with an admin account to edit products and variants.</AdminAccessState>;
    }
    if (gate === 'forbidden') {
        return (
            <AdminAccessState>
                Your current role cannot edit products. Ask a Super Admin for Inventory Admin, Manager, or Super Admin access.
            </AdminAccessState>
        );
    }

    return (
        <div className="page-container admin-products-page">
            <div className="admin-products-header">
                <h1>Edit Product</h1>
                <div className="admin-products-header-actions">
                    <Link to="/admin/products" className="admin-products-btn">Back to products</Link>
                    <button type="button" className="admin-products-btn admin-products-btn--danger" onClick={deleteProduct} disabled={busy}>
                        Delete Product
                    </button>
                </div>
            </div>

            {error ? (
                <AdminErrorNotice onRetry={loading || !product ? loadProduct : null}>
                    {error}
                </AdminErrorNotice>
            ) : null}
            {notice ? <p className="admin-products-notice admin-products-notice--ok">{notice}</p> : null}
            {loading || !form || !product ? <p>Loading product...</p> : (
                <>
                <section className="admin-products-panel">
                        <form className="admin-products-form" onSubmit={saveProduct}>
                            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                                {CATEGORY_OPTIONS.map((category) => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                            <input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
                            {form.image_url ? <img src={form.image_url} alt={form.name} className="admin-products-thumb" /> : null}
                            <label>
                                Replace image
                                <input type="file" accept="image/*" onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    setEditImage(file);
                                    if (file) setForm((f) => ({ ...f, remove_image: false }));
                                }} />
                            </label>
                            {editImagePreview ? <img src={editImagePreview} alt="Replacement preview" className="admin-products-thumb" /> : null}
                            <label>
                                <input type="checkbox" checked={Boolean(form.remove_image)} onChange={(e) => {
                                    const checked = e.target.checked;
                                    if (checked) setEditImage(null);
                                    setForm((f) => ({ ...f, remove_image: checked }));
                                }} />
                                Remove current image
                            </label>
                            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
                            <label><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} /> Active</label>
                            <button type="submit" className="admin-products-btn" disabled={busy}>{busy ? 'Saving...' : 'Save Product'}</button>
                        </form>
                    </section>

                    <section className="admin-products-panel">
                        <h2>Variants ({(product.variants || []).length})</h2>
                        <div className="admin-products-variant-list">
                            {(product.variants || []).map((v) => {
                                const badge = stockBadge(v.stock);
                                const editing = editingVariantId === v.id;
                                return (
                                    <div key={v.id} className="admin-products-variant-item">
                                        {!editing ? (
                                            <>
                                                <p>#{v.id} {v.color} / {v.size} - {formatMMK(v.price_mmk)} - Stock {v.stock}</p>
                                                <span className={badge.className}>{badge.text}</span>
                                                <p>SKU: {v.sku}</p>
                                                <div className="admin-products-card-actions">
                                                    <button type="button" className="admin-products-btn" onClick={() => startVariantEdit(v)}>Edit Variant</button>
                                                    <button type="button" className="admin-products-btn admin-products-btn--danger" onClick={() => deleteVariant(v.id)} disabled={variantBusy}>
                                                        Delete Variant
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <input value={editingVariantForm.color} onChange={(e) => setEditingVariantForm((f) => ({ ...f, color: e.target.value }))} />
                                                <select value={editingVariantForm.size} onChange={(e) => setEditingVariantForm((f) => ({ ...f, size: e.target.value }))}>
                                                    <option value="">Select size</option>
                                                    {SIZE_OPTIONS.map((size) => (
                                                        <option key={size} value={size}>{size}</option>
                                                    ))}
                                                </select>
                                                <input value={editingVariantForm.price_mmk} type="number" min="0" onChange={(e) => setEditingVariantForm((f) => ({ ...f, price_mmk: e.target.value }))} />
                                                <input value={editingVariantForm.stock} type="number" min="0" onChange={(e) => setEditingVariantForm((f) => ({ ...f, stock: e.target.value }))} />
                                                <input value={editingVariantForm.sku} onChange={(e) => setEditingVariantForm((f) => ({ ...f, sku: e.target.value }))} />
                                                <div className="admin-products-card-actions">
                                                    <button type="button" className="admin-products-btn" onClick={() => saveVariantEdit(v.id)} disabled={variantBusy}>
                                                        {variantBusy ? 'Saving...' : 'Save Variant'}
                                                    </button>
                                                    <button type="button" className="admin-products-btn" onClick={() => { setEditingVariantId(null); setEditingVariantForm(null); }}>
                                                        Cancel
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="admin-products-variant-add">
                            <h5>Add Variant</h5>
                            <input value={variantForm.color} onChange={(e) => setVariantForm((f) => ({ ...f, color: e.target.value }))} placeholder="Color" />
                            <select value={variantForm.size} onChange={(e) => setVariantForm((f) => ({ ...f, size: e.target.value }))}>
                                <option value="">Select size</option>
                                {SIZE_OPTIONS.map((size) => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                            <input value={variantForm.price_mmk} onChange={(e) => setVariantForm((f) => ({ ...f, price_mmk: e.target.value }))} placeholder="Price (MMK)" type="number" min="0" />
                            <input value={variantForm.stock} onChange={(e) => setVariantForm((f) => ({ ...f, stock: e.target.value }))} placeholder="Stock" type="number" min="0" />
                            <input value={variantForm.sku} onChange={(e) => setVariantForm((f) => ({ ...f, sku: e.target.value }))} placeholder="SKU (optional)" />
                            <button type="button" className="admin-products-btn" onClick={addVariant} disabled={variantBusy}>
                                {variantBusy ? 'Adding...' : 'Add Variant'}
                            </button>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
