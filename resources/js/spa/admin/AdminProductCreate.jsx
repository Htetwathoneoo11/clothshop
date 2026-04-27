import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

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

function emptyCreate() {
    return {
        name: '',
        category: 'General',
        brand: '',
        description: '',
        is_active: true,
        variant: {
            color: '',
            size: '',
            price_mmk: '',
            stock: '',
            sku: '',
        },
    };
}

export default function AdminProductCreate() {
    const navigate = useNavigate();
    const [gate, setGate] = useState('loading');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [create, setCreate] = useState(() => emptyCreate());
    const [createImage, setCreateImage] = useState(null);
    const [createImagePreview, setCreateImagePreview] = useState('');

    useEffect(() => {
        let cancelled = false;
        axios.get('/api/me')
            .then((res) => {
                const user = res.data?.user;
                if (cancelled) return;
                if (!user) return setGate('unauthenticated');
                if (!user.is_admin) return setGate('forbidden');
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
        if (!createImage) {
            setCreateImagePreview('');
            return undefined;
        }
        const url = URL.createObjectURL(createImage);
        setCreateImagePreview(url);
        return () => URL.revokeObjectURL(url);
    }, [createImage]);

    const onCreateField = (key, value) => setCreate((c) => ({ ...c, [key]: value }));
    const onVariantField = (key, value) => setCreate((c) => ({ ...c, variant: { ...c.variant, [key]: value } }));

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            await axios.get('/sanctum/csrf-cookie');
            const fd = new FormData();
            fd.append('name', create.name);
            fd.append('category', create.category || 'General');
            if (create.brand) fd.append('brand', create.brand);
            if (create.description) fd.append('description', create.description);
            fd.append('is_active', create.is_active ? '1' : '0');
            fd.append('variant[color]', create.variant.color);
            fd.append('variant[size]', create.variant.size);
            fd.append('variant[price_mmk]', String(parseInt(create.variant.price_mmk, 10) || 0));
            fd.append('variant[stock]', String(parseInt(create.variant.stock, 10) || 0));
            if (create.variant.sku) fd.append('variant[sku]', create.variant.sku);
            if (createImage) fd.append('image', createImage);

            await axios.post('/api/admin/products', fd);
            navigate('/admin/products');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create product.');
        } finally {
            setBusy(false);
        }
    };

    if (gate === 'loading') return <div className="page-container admin-products-page">Loading...</div>;
    if (gate === 'unauthenticated') return <NavigateLogin />;
    if (gate === 'forbidden') return <NavigateForbidden />;

    return (
        <div className="page-container admin-products-page">
            <div className="admin-products-header">
                <h1>Create Product</h1>
                <div className="admin-products-header-actions">
                    <Link to="/admin/products" className="admin-products-btn">Back to products</Link>
                </div>
            </div>

            {error ? <p className="admin-products-notice admin-products-notice--err">{error}</p> : null}

            <section className="admin-products-panel">
                <form className="admin-products-form" onSubmit={submit}>
                    <input value={create.name} onChange={(e) => onCreateField('name', e.target.value)} placeholder="Product name" required />
                    <select value={create.category} onChange={(e) => onCreateField('category', e.target.value)}>
                        {CATEGORY_OPTIONS.map((category) => (
                            <option key={category} value={category}>{category}</option>
                        ))}
                    </select>
                    <input value={create.brand} onChange={(e) => onCreateField('brand', e.target.value)} placeholder="Brand" />
                    <label>
                        Product image
                        <input type="file" accept="image/*" onChange={(e) => setCreateImage(e.target.files?.[0] || null)} />
                    </label>
                    {createImagePreview ? <img src={createImagePreview} alt="Preview" className="admin-products-thumb" /> : null}
                    <textarea value={create.description} onChange={(e) => onCreateField('description', e.target.value)} rows={2} placeholder="Description" />
                    <label><input type="checkbox" checked={create.is_active} onChange={(e) => onCreateField('is_active', e.target.checked)} /> Active</label>

                    <h3>Initial Variant</h3>
                    <input value={create.variant.color} onChange={(e) => onVariantField('color', e.target.value)} placeholder="Color" required />
                    <select value={create.variant.size} onChange={(e) => onVariantField('size', e.target.value)} required>
                        <option value="">Select size</option>
                        {SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                    <input value={create.variant.price_mmk} onChange={(e) => onVariantField('price_mmk', e.target.value)} placeholder="Price (MMK)" type="number" min="0" required />
                    <input value={create.variant.stock} onChange={(e) => onVariantField('stock', e.target.value)} placeholder="Stock" type="number" min="0" required />
                    <input value={create.variant.sku} onChange={(e) => onVariantField('sku', e.target.value)} placeholder="SKU (optional)" />

                    <button type="submit" className="admin-products-btn" disabled={busy}>
                        {busy ? 'Creating...' : 'Create Product'}
                    </button>
                </form>
            </section>
        </div>
    );
}

function NavigateLogin() {
    return (
        <div className="page-container admin-products-page">
            <p>Sign in as admin to manage products.</p>
            <Link to="/login">Go to login</Link>
        </div>
    );
}

function NavigateForbidden() {
    return (
        <div className="page-container admin-products-page">
            <p>Access denied.</p>
            <Link to="/dashboard">View as customer</Link>
        </div>
    );
}
