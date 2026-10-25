import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { FiDownload, FiFileText, FiFilter, FiSearch, FiChevronDown, FiMessageCircle, FiLock, FiShoppingCart, FiPlus, FiCheck, FiTrash2, FiX } from 'react-icons/fi';
import {
    loadRazorpayScript,
    createRazorpayOrder,
    verifyRazorpayPayment,
    getPastPaperSolutionUrl,
    markRazorpayPaymentStatus,
    openRazorpayCheckout,
} from '../lib/razorpay';
import SEO from '../components/SEO';
import logo from '../assets/logo.png';
import PaperThumbnail, { DIFFICULTY_CONFIG } from '../components/PaperThumbnail';
import './PastYearPapers.css';

const SUBJECTS = ['All', '11+ Mathematics', 'English'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const DEFAULT_CURRENCY = 'GBP';

function formatPrice(pence) {
    return `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;
}

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } })
};


function LoginPopup({ onClose }) {
    return (
        <motion.div
            className="pyp-login-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="pyp-login-modal glass-card"
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                onClick={e => e.stopPropagation()}
            >
                <h3>Sign in to access papers</h3>
                <p>Please sign in or create an account to download past papers.</p>
                <div className="pyp-login-actions">
                    <Link to="/login" onClick={onClose}>
                        <button className="btn-primary">Sign In</button>
                    </Link>
                    <Link to="/register" onClick={onClose}>
                        <button className="btn-secondary">Create Account</button>
                    </Link>
                </div>
            </motion.div>
        </motion.div>
    );
}

export default function PastYearPapers() {
    const { user, profile } = useAuth();
    const [papers, setPapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('All');
    const [showLoginPopup, setShowLoginPopup] = useState(false);
    const [requestedPapers, setRequestedPapers] = useState(new Set());
    const [requestingId, setRequestingId] = useState(null);
    const [purchasedSolutions, setPurchasedSolutions] = useState(new Set());
    const [buyingId, setBuyingId] = useState(null);
    const [buyError, setBuyError] = useState('');
    const [cart, setCart] = useState(new Set());
    const [cartOpen, setCartOpen] = useState(false);
    const [cartLoading, setCartLoading] = useState(false);
    const [bundlePct, setBundlePct] = useState(0);
    const [couponInput, setCouponInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [couponError, setCouponError] = useState('');
    const [couponLoading, setCouponLoading] = useState(false);

    const easyRef = useRef(null);
    const mediumRef = useRef(null);
    const hardRef = useRef(null);
    const sectionRefs = { Easy: easyRef, Medium: mediumRef, Hard: hardRef };

    useEffect(() => {
        fetchPapers();
        supabase.from('app_settings').select('value').eq('key', 'past_paper_bundle_discount_pct').maybeSingle()
            .then(({ data }) => setBundlePct(Math.min(Math.max(parseInt(data?.value ?? '0', 10) || 0, 0), 100)));
    }, []);

    useEffect(() => {
        if (user) { fetchUserRequests(); fetchPurchasedSolutions(); }
        else setPurchasedSolutions(new Set());
    }, [user]);

    async function fetchPurchasedSolutions() {
        const { data } = await supabase
            .from('past_paper_purchases')
            .select('paper_id')
            .eq('user_id', user.id)
            .eq('status', 'completed');
        if (data) setPurchasedSolutions(new Set(data.map(r => r.paper_id)));
    }

    function toggleCart(paperId) {
        setCart(prev => {
            const next = new Set(prev);
            if (next.has(paperId)) next.delete(paperId); else next.add(paperId);
            return next;
        });
    }

    function getCartPapers() {
        return papers.filter(p => cart.has(p.id) && p.solution_file_path && !purchasedSolutions.has(p.id));
    }

    // Pricing mirrors create-razorpay-order (which is authoritative):
    // sum → bundle discount (2+ items) → coupon.
    function priceBreakdown(list, coupon = appliedCoupon) {
        const subtotal = list.reduce((s, p) => s + (p.solution_price_pence ?? 99), 0);
        const bundleDiscount = list.length >= 2 ? Math.round(subtotal * bundlePct / 100) : 0;
        const afterBundle = subtotal - bundleDiscount;
        let couponDiscount = 0;
        if (coupon) {
            couponDiscount = coupon.discount_type === 'percentage'
                ? Math.round(afterBundle * coupon.discount_value / 100)
                : Math.min(coupon.discount_value, afterBundle);
        }
        return { subtotal, bundleDiscount, couponDiscount, total: Math.max(afterBundle - couponDiscount, 0) };
    }

    async function applyCoupon() {
        const code = couponInput.trim().toUpperCase();
        if (!code) return;
        setCouponLoading(true); setCouponError(''); setAppliedCoupon(null);
        try {
            const { data } = await supabase.from('coupon_codes').select('*').eq('code', code).eq('is_active', true).maybeSingle();
            const afterBundle = (() => { const b = priceBreakdown(getCartPapers()); return b.subtotal - b.bundleDiscount; })();
            if (!data) setCouponError('Invalid coupon code.');
            else if ((data.applies_to || 'all') !== 'all' && data.applies_to !== 'past_papers') setCouponError('This coupon is not valid for past paper solutions.');
            else if (data.expires_at && new Date(data.expires_at) < new Date()) setCouponError('This coupon has expired.');
            else if (data.max_uses && data.current_uses >= data.max_uses) setCouponError('This coupon has reached its usage limit.');
            else if (data.min_cart_pence && afterBundle < data.min_cart_pence) setCouponError(`Minimum cart value: ${formatPrice(data.min_cart_pence)}.`);
            else setAppliedCoupon(data);
        } catch {
            setCouponError('Failed to validate coupon.');
        }
        setCouponLoading(false);
    }

    async function openSolution(paper) {
        // Open the tab synchronously so popup blockers allow it.
        const win = window.open('', '_blank');
        try {
            const url = await getPastPaperSolutionUrl(paper.id);
            if (win) win.location.href = url; else window.location.href = url;
        } catch (err) {
            win?.close();
            setBuyError(err.message || 'Could not open the solution.');
        }
    }

    // Buys one solution (Unlock button) or many (cart) in a single order.
    async function buySolutions(list, { fromCart = false } = {}) {
        if (!user) { setShowLoginPopup(true); return; }
        if (buyingId || cartLoading || list.length === 0) return;
        const key = list.length === 1 ? list[0].id : 'cart';
        if (fromCart) setCartLoading(true); else setBuyingId(key);
        const done = () => { setBuyingId(null); setCartLoading(false); };
        setBuyError('');
        try {
            const loaded = await loadRazorpayScript();
            if (!loaded) throw new Error('Failed to load payment gateway. Please disable ad-blockers and try again.');
            // Coupons apply to the cart checkout only.
            const coupon = fromCart ? appliedCoupon : null;
            const total = priceBreakdown(list, coupon).total;
            const receipt = `pps_${user.id.slice(0, 6)}_${Date.now()}`;
            const { order_id, amount, currency } = await createRazorpayOrder({
                amount: total,
                currency: DEFAULT_CURRENCY,
                receipt,
                type: 'past_paper_solution_purchase',
                paper_ids: list.map(p => p.id),
                coupon_code: coupon?.code,
            });
            openRazorpayCheckout({
                orderId: order_id,
                amount,
                currency,
                description: list.length === 1 ? `Solution: ${list[0].title}` : `${list.length} Past Paper Solutions`,
                prefill: { email: user.email },
                onSuccess: async (response) => {
                    try {
                        await verifyRazorpayPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            type: 'past_paper_solution_purchase',
                        });
                        setPurchasedSolutions(prev => new Set([...prev, ...list.map(p => p.id)]));
                        setCart(prev => { const next = new Set(prev); list.forEach(p => next.delete(p.id)); return next; });
                        if (fromCart) { setCartOpen(false); setAppliedCoupon(null); setCouponInput(''); }
                    } catch (err) {
                        setBuyError(err.message || 'Payment verification failed. If money was deducted, contact support.');
                    } finally {
                        done();
                    }
                },
                onFailure: (err) => {
                    done();
                    const status = err.message === 'Payment cancelled' ? 'cancelled' : 'failed';
                    markRazorpayPaymentStatus({ razorpay_order_id: order_id, type: 'past_paper_solution_purchase', status }).catch(() => { });
                    if (status === 'failed') setBuyError(err.message || 'Payment failed.');
                },
            });
        } catch (err) {
            setBuyError(err.message || 'Something went wrong.');
            done();
        }
    }

    async function fetchUserRequests() {
        const { data } = await supabase
            .from('answer_requests')
            .select('paper_id')
            .eq('user_id', user.id);
        if (data) setRequestedPapers(new Set(data.map(r => r.paper_id)));
    }

    async function handleRequestAnswer(paperId) {
        if (!user) { setShowLoginPopup(true); return; }
        if (requestedPapers.has(paperId)) return;
        setRequestingId(paperId);
        try {
            const userEmail = user.email || '';
            const userName = profile?.display_name || user.user_metadata?.full_name || '';
            const { error } = await supabase.from('answer_requests').insert({
                paper_id: paperId,
                user_id: user.id,
                user_name: userName,
                user_email: userEmail,
            });
            if (!error) {
                setRequestedPapers(prev => new Set([...prev, paperId]));
            }
        } catch (err) {
            console.error('Request answer error:', err);
        }
        setRequestingId(null);
    }

    async function fetchPapers() {
        setLoading(true);
        const { data } = await supabase
            .from('past_papers')
            .select('*')
            .order('year', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });
        setPapers(data || []);
        setLoading(false);
    }

    function scrollToSection(difficulty) {
        sectionRefs[difficulty]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function handlePaperAccess(e, paperId) {
        if (user) {
            // Log download
            supabase.from('download_logs').insert({ resource_type: 'past_paper', resource_id: paperId });
            return;
        }

        e.preventDefault();
        setShowLoginPopup(true);
    }

    const filtered = papers.filter(p => {
        const matchesSubject = selectedSubject === 'All' || p.subject === selectedSubject;
        const matchesSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || String(p.year || '').includes(search);
        return matchesSubject && matchesSearch;
    });

    const grouped = DIFFICULTIES.reduce((acc, d) => {
        acc[d] = filtered.filter(p => p.difficulty === d);
        return acc;
    }, {});

    const totalCount = filtered.length;

    // "Buy all" bundle: every not-yet-owned solution in the current filter.
    const bundleList = filtered.filter(p => p.solution_file_path && !purchasedSolutions.has(p.id));
    const bundleBreakdown = priceBreakdown(bundleList, null);

    return (
        <>
            <SEO
                title="11+ Past Year Papers | ReasoningWizard"
                description="Download free 11+ past year papers for exam preparation. Browse Easy, Medium, and Hard difficulty papers by subject."
            />
            <div className="pyp-page page-container">
                <AnimatePresence>
                    {showLoginPopup && <LoginPopup onClose={() => setShowLoginPopup(false)} />}
                </AnimatePresence>

                {buyError && (
                    <div className="glass-card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', color: 'var(--error)' }} onClick={() => setBuyError('')}>
                        {buyError}
                    </div>
                )}


                {cart.size > 0 && (
                    <button className="pyp-cart-fab" onClick={() => setCartOpen(true)}>
                        <FiShoppingCart /> <span className="pyp-cart-badge">{getCartPapers().length}</span>
                    </button>
                )}

                <AnimatePresence>
                    {cartOpen && (
                        <>
                            <motion.div className="pyp-cart-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)} />
                            <motion.div className="pyp-cart-drawer glass-card" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
                                <div className="pyp-cart-header">
                                    <h3><FiShoppingCart /> Solutions Cart ({getCartPapers().length})</h3>
                                    <button className="pyp-cart-close" onClick={() => setCartOpen(false)}><FiX /></button>
                                </div>
                                <div className="pyp-cart-items">
                                    {getCartPapers().length === 0 ? (
                                        <p className="pyp-cart-empty">Your cart is empty.</p>
                                    ) : getCartPapers().map(p => (
                                        <div key={p.id} className="pyp-cart-item">
                                            <div className="pyp-cart-item-info">
                                                <span className="pyp-cart-item-title">{p.title}</span>
                                                <span className="pyp-cart-item-meta">{p.subject}{p.year ? ` · ${p.year}` : ''}</span>
                                            </div>
                                            <span className="pyp-cart-item-price">{formatPrice(p.solution_price_pence ?? 99)}</span>
                                            <button className="pyp-cart-item-remove" onClick={() => toggleCart(p.id)}><FiTrash2 /></button>
                                        </div>
                                    ))}
                                </div>
                                {getCartPapers().length > 0 && (
                                    <div className="pyp-cart-footer">
                                        <div className="pyp-coupon-row">
                                            <input
                                                className="pyp-coupon-input"
                                                placeholder="Coupon code"
                                                value={couponInput}
                                                onChange={e => setCouponInput(e.target.value)}
                                                disabled={!!appliedCoupon}
                                            />
                                            {appliedCoupon ? (
                                                <button className="btn-secondary" onClick={() => { setAppliedCoupon(null); setCouponInput(''); }}>Remove</button>
                                            ) : (
                                                <button className="btn-secondary" onClick={applyCoupon} disabled={couponLoading || !couponInput.trim()}>
                                                    {couponLoading ? '…' : 'Apply'}
                                                </button>
                                            )}
                                        </div>
                                        {couponError && <p className="pyp-coupon-error">{couponError}</p>}
                                        {(() => {
                                            const b = priceBreakdown(getCartPapers());
                                            return (
                                                <div className="pyp-cart-totals">
                                                    <div className="pyp-cart-total-row"><span>Subtotal</span><span>{formatPrice(b.subtotal)}</span></div>
                                                    {b.bundleDiscount > 0 && (
                                                        <div className="pyp-cart-total-row pyp-discount"><span>Bundle discount ({bundlePct}%)</span><span>-{formatPrice(b.bundleDiscount)}</span></div>
                                                    )}
                                                    {b.couponDiscount > 0 && (
                                                        <div className="pyp-cart-total-row pyp-discount"><span>Coupon ({appliedCoupon.code})</span><span>-{formatPrice(b.couponDiscount)}</span></div>
                                                    )}
                                                    <div className="pyp-cart-total"><strong>Total</strong><strong>{formatPrice(b.total)}</strong></div>
                                                    {getCartPapers().length === 1 && bundlePct > 0 && (
                                                        <p className="pyp-bundle-hint">Add another solution to get {bundlePct}% off.</p>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                        <button className="btn-primary pyp-cart-checkout" onClick={() => buySolutions(getCartPapers(), { fromCart: true })} disabled={cartLoading}>
                                            <FiShoppingCart /> {cartLoading ? 'Processing…' : 'Pay Now'}
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* Hero */}
                <motion.div
                    className="pyp-hero"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="pyp-title">11+ Past Year <span className="text-gradient">Papers</span></h1>
                    <p className="pyp-subtitle">
                        Practise with real exam papers. Choose your difficulty and download instantly.
                    </p>

                    {/* Quick jump buttons */}
                    <div className="pyp-jump-btns">
                        {DIFFICULTIES.map(d => {
                            const cfg = DIFFICULTY_CONFIG[d];
                            return (
                                <motion.button
                                    key={d}
                                    className="pyp-jump-btn"
                                    style={{ '--diff-color': cfg.color, '--diff-bg': cfg.bg, '--diff-border': cfg.border }}
                                    onClick={() => scrollToSection(d)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {d}
                                    <span className="jump-count">{grouped[d]?.length ?? 0}</span>
                                    <FiChevronDown />
                                </motion.button>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Filters */}
                <motion.div
                    className="pyp-filters glass-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                >
                    <div className="pyp-search-wrap">
                        <FiSearch className="search-icon" />
                        <input
                            className="pyp-search"
                            placeholder="Search by title or year…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="pyp-subject-wrap">
                        <FiFilter className="filter-icon" />
                        <select
                            className="pyp-subject-select"
                            value={selectedSubject}
                            onChange={e => setSelectedSubject(e.target.value)}
                        >
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    {totalCount > 0 && (
                        <span className="pyp-count">{totalCount} paper{totalCount !== 1 ? 's' : ''}</span>
                    )}
                </motion.div>

                {!loading && bundleList.length >= 2 && (
                    <motion.div className="pyp-bundle-bar glass-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="pyp-bundle-copy">
                            <strong>Solutions Bundle</strong>
                            <span>
                                Unlock all {bundleList.length} solutions{selectedSubject !== 'All' ? ` for ${selectedSubject}` : ''}
                                {bundlePct > 0 && <> — <b>{bundlePct}% off</b></>}
                            </span>
                        </div>
                        <div className="pyp-bundle-price">
                            {bundleBreakdown.bundleDiscount > 0 && <s>{formatPrice(bundleBreakdown.subtotal)}</s>}
                            <strong>{formatPrice(bundleBreakdown.total)}</strong>
                        </div>
                        <button
                            className="btn-primary"
                            onClick={() => buySolutions(bundleList)}
                            disabled={buyingId === 'cart' || cartLoading}
                        >
                            <FiShoppingCart /> {buyingId === 'cart' ? 'Processing…' : 'Buy Bundle'}
                        </button>
                    </motion.div>
                )}

                {loading ? (
                    <div className="loading-state">
                        <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                        <p>Loading papers…</p>
                    </div>
                ) : totalCount === 0 ? (
                    <motion.div className="pyp-empty glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <FiFileText className="empty-icon" />
                        <h3>No papers found</h3>
                        <p>{search || selectedSubject !== 'All' ? 'Try adjusting your filters.' : 'Papers will appear here once uploaded.'}</p>
                    </motion.div>
                ) : (
                    <div className="pyp-sections">
                        {DIFFICULTIES.map((difficulty, si) => {
                            const list = grouped[difficulty];
                            if (list.length === 0) return null;
                            const cfg = DIFFICULTY_CONFIG[difficulty];
                            return (
                                <motion.section
                                    key={difficulty}
                                    ref={sectionRefs[difficulty]}
                                    className="pyp-section"
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: si * 0.12 }}
                                >
                                    {/* Section header */}
                                    <div
                                        className="pyp-section-header"
                                        style={{ '--diff-color': cfg.color, '--diff-bg': cfg.bg, '--diff-border': cfg.border }}
                                    >
                                        <span className="diff-dot" />
                                        <h2 className="pyp-section-title">{difficulty}</h2>
                                        <span className="section-badge">{list.length}</span>
                                    </div>

                                    {/* Cards grid */}
                                    <div className="paper-grid">
                                        <AnimatePresence>
                                            {list.map((paper, i) => (
                                                <motion.div
                                                    key={paper.id}
                                                    className="paper-card glass-card"
                                                    custom={i}
                                                    variants={fadeUp}
                                                    initial="hidden"
                                                    animate="visible"
                                                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                                                    onClick={() => { if (!user) setShowLoginPopup(true); }}
                                                >
                                                    {/* Thumbnail */}
                                                    <PaperThumbnail title={paper.title} difficulty={difficulty} />

                                                    {/* Info below thumbnail */}
                                                    <div className="paper-card-info">
                                                        <p className="paper-card-title">{paper.title}</p>
                                                        <div className="paper-card-meta">
                                                            <span className="paper-meta-badge subject-badge">{paper.subject}</span>
                                                            {paper.year && <span className="paper-meta-badge paper-year-badge">{paper.year}</span>}
                                                            <span
                                                                className="paper-meta-badge paper-diff-badge"
                                                                style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
                                                            >
                                                                {difficulty}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="pyp-card-actions">
                                                        <a
                                                            href={paper.file_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            download
                                                            className="pyp-download-btn"
                                                            style={{ '--diff-color': cfg.color }}
                                                            onClick={(e) => handlePaperAccess(e, paper.id)}
                                                        >
                                                            <FiDownload /> Download
                                                        </a>
                                                        {paper.solution_file_path && (
                                                            purchasedSolutions.has(paper.id) ? (
                                                                <button
                                                                    className="pyp-solution-btn"
                                                                    style={{ '--diff-color': cfg.color }}
                                                                    onClick={(e) => { e.stopPropagation(); openSolution(paper); }}
                                                                >
                                                                    <FiFileText /> Solution
                                                                </button>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        className="pyp-unlock-btn"
                                                                        onClick={(e) => { e.stopPropagation(); buySolutions([paper]); }}
                                                                        disabled={buyingId === paper.id}
                                                                    >
                                                                        <FiLock />
                                                                        {buyingId === paper.id ? 'Processing…' : <>Unlock Solution <span className="pyp-price-chip">{formatPrice(paper.solution_price_pence ?? 99)}</span></>}
                                                                    </button>
                                                                    <button
                                                                        className={`pyp-cart-toggle ${cart.has(paper.id) ? 'in-cart' : ''}`}
                                                                        onClick={(e) => { e.stopPropagation(); if (!user) { setShowLoginPopup(true); return; } toggleCart(paper.id); }}
                                                                    >
                                                                        {cart.has(paper.id) ? <><FiCheck /> In Cart</> : <><FiPlus /> Add to Cart</>}
                                                                    </button>
                                                                </>
                                                            )
                                                        )}
                                                        {!paper.solution_file_path && (
                                                            <button
                                                                className={`pyp-request-btn ${requestedPapers.has(paper.id) ? 'requested' : ''}`}
                                                                onClick={(e) => { e.stopPropagation(); handleRequestAnswer(paper.id); }}
                                                                disabled={requestedPapers.has(paper.id) || requestingId === paper.id}
                                                            >
                                                                <FiMessageCircle />
                                                                {requestingId === paper.id
                                                                    ? 'Requesting…'
                                                                    : requestedPapers.has(paper.id)
                                                                        ? 'Requested ✓'
                                                                        : 'Request Answer'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </motion.section>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
