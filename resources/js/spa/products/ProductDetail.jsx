import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, Loader2, Package, ShoppingCart, ArrowRight } from 'lucide-react';
import { useCart } from '../cart/CartContext.jsx';
import { formatMMK } from '../utils/money.js';

axios.defaults.withCredentials = true;

export default function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { refreshCartCount } = useCart();

    const [product, setProduct] = useState(null);
    const [error, setError] = useState('');
    const [selectedColor, setSelectedColor] = useState('');
    const [selectedVariantId, setSelectedVariantId] = useState('');
    const [loadingAction, setLoadingAction] = useState('');
    const [message, setMessage] = useState('');
    const [isAdminViewer, setIsAdminViewer] = useState(false);

    useEffect(() => {
        fetch(`/api/products/${id}`)
            .then((res) => {
                if (!res.ok) throw new Error('Not found');
                return res.json();
            })
            .then((data) => {
                setProduct(data.product);
                const variants = data.product?.variants || [];
                const firstInStock = variants.find((v) => v.stock > 0);
                if (firstInStock) {
                    setSelectedColor(firstInStock.color);
                    setSelectedVariantId(firstInStock.id);
                }
            })
            .catch(() => setError('Product not found.'));
    }, [id]);

    useEffect(() => {
        let cancelled = false;
        axios.get('/api/me')
            .then((res) => {
                if (!cancelled) setIsAdminViewer(Boolean(res.data?.user?.is_admin));
            })
            .catch(() => {
                if (!cancelled) setIsAdminViewer(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const variants = product?.variants || [];
    const inStockVariants = variants.filter((v) => v.stock > 0);

    const selectedVariant = useMemo(() => {
        if (!selectedVariantId) return null;
        return variants.find((v) => String(v.id) === String(selectedVariantId)) ?? null;
    }, [variants, selectedVariantId]);

    const colors = useMemo(() => {
        return [...new Set(inStockVariants.map((v) => v.color))];
    }, [inStockVariants]);

    const sizeOptions = useMemo(() => {
        return inStockVariants.filter((v) => v.color === selectedColor);
    }, [inStockVariants, selectedColor]);

    useEffect(() => {
        if (sizeOptions.length > 0) {
            setSelectedVariantId(sizeOptions[0].id);
        }
    }, [selectedColor, sizeOptions]);

    const addSelectedVariantToCart = async () => {
        if (!selectedVariantId) {
            setMessage('Please select a size.');
            return false;
        }

        await axios.get('/sanctum/csrf-cookie');
        await axios.post('/api/cart', { variant_id: selectedVariantId, quantity: 1 });
        refreshCartCount();
        return true;
    };

    const handleAddToCart = async () => {
        setLoadingAction('add');
        setMessage('');
        try {
            const added = await addSelectedVariantToCart();
            if (added) setMessage('Added to cart.');
        } catch (err) {
            if (err.response?.status === 401) {
                navigate('/login');
                return;
            }
            if (err.response?.status === 403) {
                setMessage('Admin accounts are preview-only and cannot buy products.');
                return;
            }
            setMessage(err.response?.data?.message || 'Failed to add to cart.');
        } finally {
            setLoadingAction('');
        }
    };

    const handleBuyNow = async () => {
        setLoadingAction('buy');
        setMessage('');
        try {
            const added = await addSelectedVariantToCart();
            if (added) navigate('/checkout');
        } catch (err) {
            if (err.response?.status === 401) {
                navigate('/login');
                return;
            }
            if (err.response?.status === 403) {
                setMessage('Admin accounts are preview-only and cannot buy products.');
                return;
            }
            setMessage(err.response?.data?.message || 'Failed to continue to checkout.');
        } finally {
            setLoadingAction('');
        }
    };

    if (error) {
        return (
            <div className="page-container product-detail">
                <div className="product-detail-state product-detail-state--error">
                    <Package size={40} strokeWidth={1.25} className="product-detail-state-icon" aria-hidden="true" />
                    <h1 className="product-detail-state-title">{error}</h1>
                    <p className="product-detail-state-lede">This product may have been removed or the link is incorrect.</p>
                    <Link to="/dashboard" className="product-detail-back-link product-detail-back-link--cta">
                        <ChevronLeft size={18} aria-hidden="true" />
                        Back to shop
                    </Link>
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="page-container product-detail">
                <div className="product-detail-state product-detail-state--loading">
                    <Loader2 size={36} className="product-detail-state-spinner" aria-hidden="true" />
                    <p className="product-detail-state-loading-text">Loading product...</p>
                </div>
            </div>
        );
    }

    const messageIsError =
        message &&
        (message.includes('Failed') || message.includes('Please select') || message.includes('Could not'));

    return (
        <div className="page-container product-detail">
            {isAdminViewer ? (
                <section className="customer-preview-banner" aria-label="Admin customer preview">
                    <div>
                        <strong>Viewing product as admin</strong>
                        <p>This is the customer product page in preview mode. Cart and checkout actions stay disabled for admin accounts.</p>
                    </div>
                    <Link to="/admin/products" className="customer-preview-banner__action">Manage products</Link>
                </section>
            ) : null}

            <nav className="product-detail-back" aria-label="Breadcrumb">
                <Link to="/dashboard" className="product-detail-back-link">
                    <ChevronLeft size={18} aria-hidden="true" />
                    Back to shop
                </Link>
            </nav>

            <div className="product-detail-grid">
                <div className="product-detail-media">
                    <div className="product-detail-media-card">
                        {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="product-detail-image" />
                        ) : (
                            <div className="product-detail-placeholder">
                                <Package size={40} strokeWidth={1.25} aria-hidden="true" />
                                <span>No image</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="product-detail-info">
                    <div className="product-detail-badges">
                        <span className="product-detail-badge">{product.brand || 'Unbranded'}</span>
                        <span className="product-detail-badge product-detail-badge--muted">{product.category}</span>
                    </div>

                    <h1 className="page-title product-detail-title">{product.name}</h1>

                    {inStockVariants.length > 0 && selectedVariant ? (
                        <div className="product-detail-price-row">
                            <span className="product-detail-price">{formatMMK(selectedVariant.price_mmk)}</span>
                            <span className="product-detail-stock-pill">{selectedVariant.stock} in stock</span>
                        </div>
                    ) : null}

                    <p className="product-detail-description">{product.description}</p>

                    {inStockVariants.length > 0 ? (
                        <>
                            <div className="product-detail-variants-heading">Choose options</div>

                            <div className="product-detail-selects">
                                <div className="product-detail-field">
                                    <label className="product-detail-label" htmlFor="product-detail-color">
                                        Color
                                    </label>
                                    <select
                                        id="product-detail-color"
                                        value={selectedColor}
                                        onChange={(e) => setSelectedColor(e.target.value)}
                                        className="product-detail-select variant-color-select"
                                    >
                                        {colors.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="product-detail-field">
                                    <label className="product-detail-label" htmlFor="product-detail-size">
                                        Size and price
                                    </label>
                                    <select
                                        id="product-detail-size"
                                        value={selectedVariantId}
                                        onChange={(e) => setSelectedVariantId(e.target.value)}
                                        className="product-detail-select variant-size-select"
                                    >
                                        {sizeOptions.map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.size} - {formatMMK(v.price_mmk)} ({v.stock} left)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {isAdminViewer ? (
                                <p className="product-detail-message product-detail-message--success" role="status">
                                    Preview mode: admin accounts can view products but cannot add to cart or checkout.
                                </p>
                            ) : (
                                <div className="product-detail-actions">
                                    <button
                                        type="button"
                                        className="btn-primary product-detail-add"
                                        onClick={handleAddToCart}
                                        disabled={loadingAction !== ''}
                                    >
                                        {loadingAction === 'add' ? (
                                            <>
                                                <Loader2 size={18} className="product-detail-btn-icon product-detail-btn-spinner" aria-hidden="true" />
                                                Adding...
                                            </>
                                        ) : (
                                            <>
                                                <ShoppingCart size={18} className="product-detail-btn-icon" aria-hidden="true" />
                                                Add to cart
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-primary product-detail-buy-now"
                                        onClick={handleBuyNow}
                                        disabled={loadingAction !== ''}
                                    >
                                        {loadingAction === 'buy' ? (
                                            <>
                                                <Loader2 size={18} className="product-detail-btn-icon product-detail-btn-spinner" aria-hidden="true" />
                                                Checkout...
                                            </>
                                        ) : (
                                            <>
                                                Buy now
                                                <ArrowRight size={18} className="product-detail-btn-icon" aria-hidden="true" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {message ? (
                                <p
                                    className={
                                        messageIsError
                                            ? 'product-detail-message product-detail-message--error'
                                            : 'product-detail-message product-detail-message--success'
                                    }
                                    role="status"
                                >
                                    {message}
                                </p>
                            ) : null}
                        </>
                    ) : (
                        <div className="product-detail-oos-card">
                            <p className="product-detail-oos">All variants are currently out of stock.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
