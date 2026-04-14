import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
axios.defaults.withCredentials = true;
import { useCart } from '../cart/CartContext.jsx';

export default function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { refreshCartCount } = useCart();

    const [product, setProduct] = useState(null);
    const [error, setError] = useState('');
    const [selectedColor, setSelectedColor] = useState('');
    const [selectedVariantId, setSelectedVariantId] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetch(`/api/products/${id}`)
            .then((res) => {
                if (!res.ok) throw new Error('Not found');
                return res.json();
            })
            .then((data) => {
                setProduct(data.product);
                const variants = data.product?.variants || [];
                const firstInStock = variants.find(v => v.stock > 0);
                if (firstInStock) {
                    setSelectedColor(firstInStock.color);
                    setSelectedVariantId(firstInStock.id);
                }
            })
            .catch(() => setError('Product not found.'));
    }, [id]);

    const variants = product?.variants || [];
    const inStockVariants = variants.filter(v => v.stock > 0);

    const colors = useMemo(() => {
        return [...new Set(inStockVariants.map(v => v.color))];
    }, [inStockVariants]);

    const sizeOptions = useMemo(() => {
        return inStockVariants.filter(v => v.color === selectedColor);
    }, [inStockVariants, selectedColor]);

    useEffect(() => {
        if (sizeOptions.length > 0) {
            setSelectedVariantId(sizeOptions[0].id);
        }
    }, [selectedColor, sizeOptions]);

    const handleAddToCart = async () => {
        if (!selectedVariantId) {
            setMessage('Please select a size.');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            await axios.get('/sanctum/csrf-cookie');
            await axios.post('/api/cart', { variant_id: selectedVariantId, quantity: 1 });
            setMessage('Added to cart.');
            refreshCartCount();
        } catch (err) {
            if (err.response?.status === 401) {
                navigate('/login');
                return;
            }
            setMessage(err.response?.data?.message || 'Failed to add to cart.');
        } finally {
            setLoading(false);
        }
    };

    if (error) return <p>{error}</p>;
    if (!product) return <p>Loading...</p>;

    return (
        <div className="page-container product-detail">
            <div className="product-detail-back">
                <Link to="/dashboard" className="btn-back">← Back to products</Link>
            </div>

            <div className="product-detail-grid">
                <div className="product-detail-media">
                    {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="product-detail-image" />
                    ) : (
                        <div className="product-detail-placeholder">No image</div>
                    )}
                </div>

                <div className="product-detail-info">
                    <p className="product-detail-meta">{product.brand || 'Unbranded'} - {product.category}</p>
                    <h1 className="page-title product-detail-title">{product.name}</h1>
                    <p className="product-detail-description">{product.description}</p>

                    {inStockVariants.length > 0 ? (
                        <>
                            <div className="product-detail-variants-heading">Choose color & size</div>

                            <div className="product-detail-selects">
                                <label className="product-detail-label">Color</label>
                                <select
                                    value={selectedColor}
                                    onChange={(e) => setSelectedColor(e.target.value)}
                                    className="variant-color-select"
                                >
                                    {colors.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>

                                <label className="product-detail-label">Size</label>
                                <select
                                    value={selectedVariantId}
                                    onChange={(e) => setSelectedVariantId(e.target.value)}
                                    className="variant-size-select"
                                >
                                    {sizeOptions.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.size} - ${Number(v.price).toFixed(2)} ({v.stock} in stock)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="product-detail-actions">
                                <button
                                    type="button"
                                    className="btn-primary product-detail-add"
                                    onClick={handleAddToCart}
                                    disabled={loading}
                                >
                                    {loading ? 'Adding...' : 'Add to cart'}
                                </button>
                                <Link to="/checkout" className="btn-primary product-detail-buy-now">
                                    Buy now
                                </Link>
                            </div>

                            {message && <p>{message}</p>}
                        </>
                    ) : (
                        <p className="product-detail-oos">All variants are currently out of stock.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
