import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  loadRazorpayScript,
  createRazorpayOrder,
  verifyRazorpayPayment,
  markRazorpayPaymentStatus,
  openRazorpayCheckout,
} from '../lib/razorpay';
import { FiRefreshCw, FiEye } from 'react-icons/fi';
import {
  FiLock, FiDownload, FiPlay, FiCheck,
  FiAlertTriangle, FiFileText, FiX, FiShoppingCart, FiTag,
  FiPlus, FiMinus, FiPercent, FiTrash2,
} from 'react-icons/fi';
// FiRefreshCw, FiEye imported above
import SEO from '../components/SEO';
import PaperThumbnail from '../components/PaperThumbnail';
import './TestPapers.css';

const SUBJECTS = ['11+ Maths', '11+ NVR', '11+ English'];
const CART_STORAGE_KEY = 'rw_test_papers_cart';

const DEFAULT_CURRENCY = 'GBP';

function formatPrice(pence) {
  return `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;
}

export default function TestPapers() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeSubject, setActiveSubject] = useState('11+ Maths');
  const [papers, setPapers] = useState({});
  const [bundles, setBundles] = useState({});
  // paperPurchases: Set of individual paper IDs bought
  const [paperPurchases, setPaperPurchases] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(''); // bundle subject or paper id
  const [paymentErrors, setPaymentErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [quizAttempts, setQuizAttempts] = useState({});  // quiz_id -> { score, total_questions }

  // Cart state
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed) : new Set();
    } catch {
      return new Set();
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discount_type, discount_value }
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [cartPaymentLoading, setCartPaymentLoading] = useState(false);
  const [cartPaymentError, setCartPaymentError] = useState('');

  // Bundle coupon state (separate from cart coupon)
  const [bundleCouponInput, setBundleCouponInput] = useState('');
  const [appliedBundleCoupon, setAppliedBundleCoupon] = useState(null);
  const [bundleCouponError, setBundleCouponError] = useState('');
  const [bundleCouponLoading, setBundleCouponLoading] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [user]);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(Array.from(cart)));
  }, [cart]);

  // Auto-dismiss payment errors after 8 seconds
  useEffect(() => {
    const keys = Object.keys(paymentErrors).filter(k => paymentErrors[k]);
    if (!keys.length) return;
    const t = setTimeout(() => setPaymentErrors({}), 8000);
    return () => clearTimeout(t);
  }, [paymentErrors]);

  // Re-fetch quiz attempts when papers load
  useEffect(() => {
    if (user) fetchQuizAttempts();
  }, [papers, user]);

  async function fetchAll() {
    setLoading(true);
    const [papersRes, bundlesRes] = await Promise.all([
      supabase
        .from('premium_test_papers')
        .select('id, title, subject, school_name, year, file_url, quiz_id, is_free, price_pence, sort_order, download_count')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('test_paper_bundles')
        .select('*')
        .eq('is_active', true),
    ]);

    const grouped = {};
    SUBJECTS.forEach((s) => { grouped[s] = []; });
    (papersRes.data || []).forEach((p) => {
      if (grouped[p.subject]) grouped[p.subject].push(p);
    });
    setPapers(grouped);

    const bundleMap = {};
    (bundlesRes.data || []).forEach((b) => { bundleMap[b.subject] = b; });
    setBundles(bundleMap);

    if (user) await checkPurchases(bundlesRes.data || [], papersRes.data || []);
    setLoading(false);
  }

  async function checkPurchases(bundleList, paperList) {
    if (!user) return;

    // Removed test_paper_purchases logic per dynamic pricing requirements

    // Check individual paper purchases
    if (paperList.length) {
      const paperIds = paperList.map((p) => p.id);
      const { data: paperData } = await supabase
        .from('paper_purchases')
        .select('paper_id')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .in('paper_id', paperIds);

      setPaperPurchases(new Set((paperData || []).map((p) => p.paper_id)));
    }
  }

  async function fetchQuizAttempts() {
    if (!user) return;
    // Collect all quiz_ids from all subjects
    const allQuizIds = Object.values(papers)
      .flat()
      .map(p => p.quiz_id)
      .filter(Boolean);
    if (!allQuizIds.length) return;
    const { data } = await supabase
      .from('quiz_attempts')
      .select('quiz_id, score, total_questions')
      .eq('user_id', user.id)
      .in('quiz_id', allQuizIds);
    const map = {};
    (data || []).forEach(a => { map[a.quiz_id] = a; });
    setQuizAttempts(map);
  }

  function canAccess(paper) {
    return paper.is_free || paperPurchases.has(paper.id);
  }

  function showToast(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Bundle Coupon Functions ────────────────────────────────
  function getBundleCouponDiscount(subtotal) {
    if (!appliedBundleCoupon) return 0;
    if (appliedBundleCoupon.discount_type === 'percentage') {
      return Math.round(subtotal * appliedBundleCoupon.discount_value / 100);
    }
    return Math.min(appliedBundleCoupon.discount_value, subtotal);
  }

  async function validateBundleCoupon() {
    if (!bundleCouponInput.trim()) return;
    setBundleCouponLoading(true);
    setBundleCouponError('');
    setAppliedBundleCoupon(null);
    try {
      const { data, error } = await supabase
        .from('coupon_codes')
        .select('*')
        .eq('code', bundleCouponInput.trim().toUpperCase())
        .eq('is_active', true)
        .single();
      if (error || !data) { setBundleCouponError('Invalid coupon code.'); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setBundleCouponError('This coupon has expired.'); return; }
      if (data.max_uses && data.current_uses >= data.max_uses) { setBundleCouponError('This coupon has reached its usage limit.'); return; }
      setAppliedBundleCoupon(data);
    } catch { setBundleCouponError('Failed to validate coupon.'); }
    finally { setBundleCouponLoading(false); }
  }

  async function handleBuyBundle(subject, unpurchasedPapers, amountPence) {
    if (!user) { navigate('/login'); return; }
    const bundle = bundles[subject];
    if (!bundle || unpurchasedPapers.length === 0) return;

    const key = `bundle_${subject}`;
    if (paymentLoading === key) return;
    setPaymentLoading(key);
    setPaymentErrors((prev) => ({ ...prev, [key]: '' }));

    const discount = getBundleCouponDiscount(amountPence);
    const finalAmount = Math.max(amountPence - discount, 0);

    // If coupon covers entire cost
    if (finalAmount <= 0) {
      if (appliedBundleCoupon) {
        await supabase.from('coupon_codes').update({ current_uses: (appliedBundleCoupon.current_uses || 0) + 1 }).eq('id', appliedBundleCoupon.id);
      }
      setPaperPurchases((prev) => {
        const next = new Set(prev);
        unpurchasedPapers.forEach((p) => next.add(p.id));
        return next;
      });
      showToast('Coupon applied! Bundle unlocked for free.', 'success');
      setAppliedBundleCoupon(null);
      setBundleCouponInput('');
      setPaymentLoading('');
      return;
    }

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setPaymentErrors((prev) => ({ ...prev, [key]: 'Failed to load payment gateway. Please disable ad-blockers and try again.' }));
        setPaymentLoading('');
        return;
      }

      const receipt = `bundle_${subject.replace(/\W/g, '_').toLowerCase().slice(0, 15)}_${user.id.slice(0, 6)}_${Date.now()}`;
      const paper_ids = unpurchasedPapers.map(p => p.id);

      const { order_id, amount, currency } = await createRazorpayOrder({
        amount: finalAmount,
        currency: DEFAULT_CURRENCY,
        receipt,
        type: 'bundle_purchase',
        paper_ids,
      });

      openRazorpayCheckout({
        orderId: order_id,
        amount,
        currency,
        description: `${bundle.name} — Bundle${appliedBundleCoupon ? ` (Coupon: ${appliedBundleCoupon.code})` : ''}`,
        prefill: { email: user.email },
        onSuccess: async (response) => {
          try {
            await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              type: 'bundle_purchase',
            });
            if (appliedBundleCoupon) {
              await supabase.from('coupon_codes').update({ current_uses: (appliedBundleCoupon.current_uses || 0) + 1 }).eq('id', appliedBundleCoupon.id);
            }
            setPaperPurchases((prev) => {
              const next = new Set(prev);
              unpurchasedPapers.forEach((p) => next.add(p.id));
              return next;
            });
            showToast(`${subject} bundle unlocked! All papers are now accessible.`, 'success');
            setAppliedBundleCoupon(null);
            setBundleCouponInput('');
          } catch (verifyErr) {
            setPaymentErrors((prev) => ({ ...prev, [key]: verifyErr.message || 'Payment verification failed. If money was deducted, contact support.' }));
          } finally {
            setPaymentLoading('');
          }
        },
        onFailure: (err) => {
          setPaymentLoading('');
          const failedStatus = err.message === 'Payment cancelled' ? 'cancelled' : 'failed';
          markRazorpayPaymentStatus({
            razorpay_order_id: order_id,
            type: 'bundle_purchase',
            status: failedStatus,
          }).catch(() => { });

          if (err.message !== 'Payment cancelled') {
            setPaymentErrors((prev) => ({ ...prev, [key]: err.message || 'Payment failed.' }));
          }
        },
      });
    } catch (err) {
      setPaymentErrors((prev) => ({ ...prev, [key]: err.message || 'Something went wrong.' }));
      setPaymentLoading('');
    }
  }

  async function handleBuyPaper(paper) {
    if (!user) { navigate('/login'); return; }
    if (!paper.price_pence || paper.price_pence <= 0) {
      showToast('This paper is not available for individual purchase. Please buy the bundle.', 'info');
      return;
    }

    if (paymentLoading === paper.id) return; // prevent double-clicks
    setPaymentLoading(paper.id);
    setPaymentErrors((prev) => ({ ...prev, [paper.id]: '' }));

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setPaymentErrors((prev) => ({ ...prev, [paper.id]: 'Failed to load payment gateway. Please disable ad-blockers and try again.' }));
        setPaymentLoading('');
        return;
      }

      const receipt = `paper_${paper.id.slice(0, 8)}_${user.id.slice(0, 6)}_${Date.now()}`;
      const { order_id, amount, currency } = await createRazorpayOrder({
        amount: paper.price_pence,
        currency: DEFAULT_CURRENCY,
        receipt,
        type: 'individual_paper_purchase',
        paper_id: paper.id,
      });

      openRazorpayCheckout({
        orderId: order_id,
        amount,
        currency,
        description: paper.title,
        prefill: { email: user.email },
        onSuccess: async (response) => {
          try {
            await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              type: 'individual_paper_purchase',
            });
            setPaperPurchases((prev) => new Set([...prev, paper.id]));
            showToast(`"${paper.title}" unlocked!`, 'success');
          } catch (verifyErr) {
            setPaymentErrors((prev) => ({ ...prev, [paper.id]: verifyErr.message || 'Payment verification failed. If money was deducted, contact support.' }));
          } finally {
            setPaymentLoading('');
          }
        },
        onFailure: (err) => {
          setPaymentLoading('');
          const failedStatus = err.message === 'Payment cancelled' ? 'cancelled' : 'failed';
          markRazorpayPaymentStatus({
            razorpay_order_id: order_id,
            type: 'individual_paper_purchase',
            status: failedStatus,
          }).catch(() => { });

          if (err.message !== 'Payment cancelled') {
            setPaymentErrors((prev) => ({ ...prev, [paper.id]: err.message || 'Payment failed.' }));
          }
        },
      });
    } catch (err) {
      setPaymentErrors((prev) => ({ ...prev, [paper.id]: err.message || 'Something went wrong.' }));
      setPaymentLoading('');
    }
  }

  async function handleDownload(paper) {
    if (!canAccess(paper)) { handleBuyPaper(paper); return; }
    if (!paper.file_url) { showToast('File not available yet.', 'info'); return; }
    // Increment download count directly on the table
    supabase
      .from('premium_test_papers')
      .update({ download_count: (paper.download_count || 0) + 1 })
      .eq('id', paper.id)
      .then(() => {});
    window.open(paper.file_url, '_blank');
    setPapers((prev) => {
      const updated = { ...prev };
      updated[paper.subject] = updated[paper.subject].map((p) =>
        p.id === paper.id ? { ...p, download_count: (p.download_count || 0) + 1 } : p
      );
      return updated;
    });
  }

  function handleQuiz(paper) {
    if (!canAccess(paper)) { handleBuyPaper(paper); return; }
    if (paper.quiz_id) navigate(`/premium-quiz/${paper.quiz_id}`);
    else showToast('Quiz coming soon for this paper.', 'info');
  }

  // ── Cart Functions ──────────────────────────────────────────
  function toggleCart(paperId) {
    setCart(prev => {
      const next = new Set(prev);
      if (next.has(paperId)) next.delete(paperId);
      else next.add(paperId);
      return next;
    });
  }

  function removeFromCart(paperId) {
    setCart(prev => {
      const next = new Set(prev);
      next.delete(paperId);
      return next;
    });
    // If cart empties, clear coupon
    if (cart.size <= 1) { setAppliedCoupon(null); setCouponInput(''); }
  }

  function getCartPapers() {
    const all = Object.values(papers).flat();
    return all.filter(p => cart.has(p.id) && !p.is_free && !paperPurchases.has(p.id));
  }

  function getCartSubtotal() {
    return getCartPapers().reduce((sum, p) => sum + (p.price_pence || 0), 0);
  }

  function getCartDiscount(subtotal) {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discount_type === 'percentage') {
      return Math.round(subtotal * appliedCoupon.discount_value / 100);
    }
    return Math.min(appliedCoupon.discount_value, subtotal);
  }

  async function validateCoupon() {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    setAppliedCoupon(null);
    try {
      const { data, error } = await supabase
        .from('coupon_codes')
        .select('*')
        .eq('code', couponInput.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) { setCouponError('Invalid coupon code.'); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setCouponError('This coupon has expired.'); return; }
      if (data.max_uses && data.current_uses >= data.max_uses) { setCouponError('This coupon has reached its usage limit.'); return; }
      const subtotal = getCartSubtotal();
      if (data.min_cart_pence && subtotal < data.min_cart_pence) {
        setCouponError(`Minimum cart value: ${formatPrice(data.min_cart_pence)}.`);
        return;
      }
      setAppliedCoupon(data);
    } catch (err) {
      setCouponError('Failed to validate coupon.');
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleCartCheckout() {
    if (!user) { navigate('/login'); return; }
    const cartPapers = getCartPapers();
    if (cartPapers.length === 0) return;

    setCartPaymentLoading(true);
    setCartPaymentError('');

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setCartPaymentError('Failed to load payment gateway. Please disable ad-blockers and try again.');
        setCartPaymentLoading(false);
        return;
      }

      const subtotal = getCartSubtotal();
      const discount = getCartDiscount(subtotal);
      const finalAmount = Math.max(subtotal - discount, 0);

      if (finalAmount <= 0) {
        // Free after coupon — skip payment
        // In a real system you'd still record this server-side
        showToast('Coupon applied! Papers unlocked.', 'success');
        setPaperPurchases(prev => {
          const next = new Set(prev);
          cartPapers.forEach(p => next.add(p.id));
          return next;
        });
        setCart(new Set());
        setCartOpen(false);
        setAppliedCoupon(null);
        setCouponInput('');
        setCartPaymentLoading(false);
        return;
      }

      const paper_ids = cartPapers.map(p => p.id);
      const receipt = `cart_${user.id.slice(0, 6)}_${Date.now()}`;

      const { order_id, amount, currency } = await createRazorpayOrder({
        amount: finalAmount,
        currency: DEFAULT_CURRENCY,
        receipt,
        type: 'bundle_purchase',
        paper_ids,
      });

      openRazorpayCheckout({
        orderId: order_id,
        amount,
        currency,
        description: `${cartPapers.length} Test Paper${cartPapers.length > 1 ? 's' : ''}${appliedCoupon ? ` (Coupon: ${appliedCoupon.code})` : ''}`,
        prefill: { email: user.email },
        onSuccess: async (response) => {
          try {
            await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              type: 'bundle_purchase',
            });
            // Increment coupon usage
            if (appliedCoupon) {
              await supabase.from('coupon_codes').update({ current_uses: (appliedCoupon.current_uses || 0) + 1 }).eq('id', appliedCoupon.id);
            }
            setPaperPurchases(prev => {
              const next = new Set(prev);
              cartPapers.forEach(p => next.add(p.id));
              return next;
            });
            setCart(new Set());
            setCartOpen(false);
            setAppliedCoupon(null);
            setCouponInput('');
            showToast(`${cartPapers.length} paper${cartPapers.length > 1 ? 's' : ''} unlocked!`, 'success');
          } catch (verifyErr) {
            setCartPaymentError(verifyErr.message || 'Payment verification failed.');
          } finally {
            setCartPaymentLoading(false);
          }
        },
        onFailure: (err) => {
          setCartPaymentLoading(false);
          const failedStatus = err.message === 'Payment cancelled' ? 'cancelled' : 'failed';
          markRazorpayPaymentStatus({ razorpay_order_id: order_id, type: 'bundle_purchase', status: failedStatus }).catch(() => { });
          if (err.message !== 'Payment cancelled') {
            setCartPaymentError(err.message || 'Payment failed.');
          }
        },
      });
    } catch (err) {
      setCartPaymentError(err.message || 'Something went wrong.');
      setCartPaymentLoading(false);
    }
  }

  const currentPapers = papers[activeSubject] || [];
  const currentBundle = bundles[activeSubject];
  const activePapers = papers[activeSubject] || [];
  const unpurchasedPapers = activePapers.filter(p => !p.is_free && !paperPurchases.has(p.id));
  const hasAnyPurchasedInSubject = activePapers.some(p => !p.is_free && paperPurchases.has(p.id));
  const hasBundlePurchase = unpurchasedPapers.length === 0 && activePapers.some(p => !p.is_free);
  const dynamicBundlePricePence = unpurchasedPapers.reduce((sum, p) => sum + p.price_pence, 0);
  const freePapers = currentPapers.filter((p) => p.is_free);
  const premiumPapers = currentPapers.filter((p) => !p.is_free);

  // Savings: individual prices total vs bundle price
  const individualTotal = unpurchasedPapers.reduce((sum, p) => sum + (p.price_pence || 0), 0);
  const bundleDiscount = 0; // Removing fake discount display since we charge exact sum now

  return (
    <>
      <SEO
        title="11+ Test Papers | ReasoningWizard"
        description="Premium 11+ exam papers for Maths, NVR and English with detailed solutions and quizzes. Buy individually or save with a bundle."
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            className={`tp-toast tp-toast-${toast.type}`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {toast.type === 'success' ? <FiCheck /> : toast.type === 'error' ? <FiAlertTriangle /> : null}
            {toast.msg}
            <button onClick={() => setToast(null)}><FiX /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="tp-page page-container">

        {/* Hero */}
        <motion.section className="tp-hero" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="tp-eyebrow">One-time Purchase</span>
          <h1 className="tp-title">11+ <span className="text-gradient">Test Papers</span></h1>
          <p className="tp-subtitle">
            Buy individual papers or save more with a full subject bundle. Pay once, keep forever.
          </p>
        </motion.section>

        {/* Subject Tabs */}
        <motion.div className="tp-tabs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          {SUBJECTS.map((s) => (
            <motion.button
              key={s}
              className={`tp-tab ${activeSubject === s ? 'active' : ''}`}
              onClick={() => setActiveSubject(s)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {s}
              {(!papers[s] || papers[s].filter(p => !p.is_free && !paperPurchases.has(p.id)).length === 0 && papers[s].some(p => !p.is_free)) && <span className="tab-owned"><FiCheck /></span>}
              {activeSubject === s && <motion.div className="tp-tab-indicator" layoutId="tpTabIndicator" />}
            </motion.button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSubject}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
          >
            {/* Bundle card */}
            {currentBundle && (
              hasBundlePurchase ? (
                <motion.div className="tp-purchased-banner glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="purchased-icon-wrap"><FiCheck /></div>
                  <div>
                    <h3>Bundle Owned — All papers unlocked!</h3>
                    <p>You have full access to all {activeSubject} papers and quizzes.</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div className="tp-bundle-card glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="bundle-info">
                    <div className="bundle-name-row">
                      <h3 className="bundle-name">{currentBundle.name}</h3>
                      {bundleDiscount > 0 && (
                        <span className="bundle-save-badge">Save {formatPrice(bundleDiscount)}</span>
                      )}
                    </div>
                    <p className="bundle-desc">{currentBundle.description}</p>
                    <ul className="bundle-perks">
                      <li><FiCheck /> All {premiumPapers.length + freePapers.length} papers in one purchase</li>
                      <li><FiCheck /> Step-by-step solutions &amp; quizzes</li>
                      <li><FiCheck /> Lifetime access</li>
                    </ul>
                  </div>
                  <div className="bundle-pricing">
                    <div className="bundle-price-row">
                      <span className="bundle-price-amount">{formatPrice(dynamicBundlePricePence)}</span>
                      {appliedBundleCoupon && (
                        <span className="bundle-price-discounted">{formatPrice(Math.max(dynamicBundlePricePence - getBundleCouponDiscount(dynamicBundlePricePence), 0))}</span>
                      )}
                    </div>
                    {paymentErrors[`bundle_${activeSubject}`] && (
                      <p className="payment-error-msg"><FiAlertTriangle /> {paymentErrors[`bundle_${activeSubject}`]}</p>
                    )}

                    {/* Bundle coupon */}
                    <div className="tp-coupon-row" style={{ marginBottom: '0.5rem' }}>
                      <div className="tp-coupon-input-wrap">
                        <FiTag className="tp-coupon-icon" />
                        <input
                          type="text"
                          placeholder="Coupon code"
                          value={bundleCouponInput}
                          onChange={e => { setBundleCouponInput(e.target.value); setBundleCouponError(''); setAppliedBundleCoupon(null); }}
                          onKeyDown={e => e.key === 'Enter' && validateBundleCoupon()}
                        />
                        <button className="tp-coupon-apply" onClick={validateBundleCoupon} disabled={bundleCouponLoading}>
                          {bundleCouponLoading ? '…' : 'Apply'}
                        </button>
                      </div>
                      {bundleCouponError && <p className="tp-coupon-error"><FiAlertTriangle /> {bundleCouponError}</p>}
                      {appliedBundleCoupon && (
                        <p className="tp-coupon-success">
                          <FiCheck /> {appliedBundleCoupon.code} — {appliedBundleCoupon.discount_type === 'percentage' ? `${appliedBundleCoupon.discount_value}% off` : `${formatPrice(appliedBundleCoupon.discount_value)} off`}
                        </p>
                      )}
                    </div>

                    <motion.button
                      className="btn-primary bundle-buy-btn"
                      onClick={() => handleBuyBundle(activeSubject, unpurchasedPapers, dynamicBundlePricePence)}
                      disabled={paymentLoading === `bundle_${activeSubject}`}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <FiShoppingCart />
                      {paymentLoading === `bundle_${activeSubject}`
                        ? 'Processing…'
                        : user
                          ? (appliedBundleCoupon
                            ? `Pay ${formatPrice(Math.max(dynamicBundlePricePence - getBundleCouponDiscount(dynamicBundlePricePence), 0))}`
                            : (hasAnyPurchasedInSubject ? 'Buy Remaining Papers' : 'Buy Bundle'))
                          : 'Sign In to Buy'}
                    </motion.button>
                    <p className="bundle-secure-note">Secure payment · Lifetime access</p>
                  </div>
                </motion.div>
              )
            )}

            {/* Papers table */}
            {loading ? (
              <div className="loading-state">
                <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                <p>Loading papers…</p>
              </div>
            ) : currentPapers.length === 0 ? (
              <div className="empty-state glass-card">
                <FiFileText />
                <h3>No papers yet for {activeSubject}</h3>
                <p>Papers will appear here once uploaded. Check back soon!</p>
              </div>
            ) : (
              <div className="tp-table-wrap glass-card">

                {freePapers.length > 0 && (
                  <>
                    <div className="table-section-header tp-free-header">
                      <span className="tp-free-label">FREE {activeSubject} Papers</span>
                    </div>
                    <div className="paper-grid">
                      {freePapers.map((p, i) => (
                        <TPCard key={p.id} paper={p} idx={i} accessible={true}
                          onDownload={handleDownload} onQuiz={handleQuiz}
                          quizAttempt={p.quiz_id ? quizAttempts[p.quiz_id] : null} />
                      ))}
                    </div>
                  </>
                )}

                {premiumPapers.length > 0 && (
                  <>
                    <div className={`table-section-header tp-premium-header ${!hasBundlePurchase ? 'tp-locked-header' : ''}`}>
                      <span className="tp-premium-label">
                        {hasBundlePurchase
                          ? <>✓ Premium Papers (Bundle Unlocked)</>
                          : <><FiLock /> Buy individually or get the bundle above</>}
                      </span>
                    </div>
                    <div className="paper-grid">
                      {premiumPapers.map((p, i) => (
                        <TPCard
                          key={p.id}
                          paper={p}
                          idx={freePapers.length + i}
                          accessible={canAccess(p)}
                          paymentLoading={paymentLoading === p.id}
                          paymentError={paymentErrors[p.id]}
                          onDownload={handleDownload}
                          onQuiz={handleQuiz}
                          onBuyPaper={handleBuyPaper}
                          quizAttempt={p.quiz_id ? quizAttempts[p.quiz_id] : null}
                          inCart={cart.has(p.id)}
                          onToggleCart={toggleCart}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Floating Cart Button ── */}
        {cart.size > 0 && (
          <motion.button
            className="tp-cart-fab"
            onClick={() => setCartOpen(true)}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiShoppingCart />
            <span className="tp-cart-fab-badge">{cart.size}</span>
          </motion.button>
        )}

        {/* ── Cart Drawer ── */}
        <AnimatePresence>
          {cartOpen && (
            <>
              <motion.div className="tp-cart-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)} />
              <motion.div className="tp-cart-drawer glass-card" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
                <div className="tp-cart-header">
                  <h3><FiShoppingCart /> Your Cart ({cart.size})</h3>
                  <button className="tp-cart-close" onClick={() => setCartOpen(false)}><FiX /></button>
                </div>

                <div className="tp-cart-items">
                  {getCartPapers().length === 0 ? (
                    <p className="tp-cart-empty">Your cart is empty.</p>
                  ) : (
                    getCartPapers().map(p => (
                      <div key={p.id} className="tp-cart-item">
                        <div className="tp-cart-item-info">
                          <span className="tp-cart-item-title">{p.title}</span>
                          <span className="tp-cart-item-meta">{p.subject}{p.school_name ? ` · ${p.school_name}` : ''}</span>
                        </div>
                        <span className="tp-cart-item-price">{formatPrice(p.price_pence)}</span>
                        <button className="tp-cart-item-remove" onClick={() => removeFromCart(p.id)}><FiTrash2 /></button>
                      </div>
                    ))
                  )}
                </div>

                {getCartPapers().length > 0 && (
                  <div className="tp-cart-footer">
                    {/* Coupon */}
                    <div className="tp-coupon-row">
                      <div className="tp-coupon-input-wrap">
                        <FiTag className="tp-coupon-icon" />
                        <input
                          type="text"
                          placeholder="Coupon code"
                          value={couponInput}
                          onChange={e => { setCouponInput(e.target.value); setCouponError(''); setAppliedCoupon(null); }}
                          onKeyDown={e => e.key === 'Enter' && validateCoupon()}
                        />
                        <button className="tp-coupon-apply" onClick={validateCoupon} disabled={couponLoading}>
                          {couponLoading ? '…' : 'Apply'}
                        </button>
                      </div>
                      {couponError && <p className="tp-coupon-error"><FiAlertTriangle /> {couponError}</p>}
                      {appliedCoupon && (
                        <p className="tp-coupon-success">
                          <FiCheck /> {appliedCoupon.code} — {appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount_value}% off` : `${formatPrice(appliedCoupon.discount_value)} off`}
                        </p>
                      )}
                    </div>

                    {/* Totals */}
                    <div className="tp-cart-totals">
                      <div className="tp-cart-total-row">
                        <span>Subtotal</span>
                        <span>{formatPrice(getCartSubtotal())}</span>
                      </div>
                      {appliedCoupon && (
                        <div className="tp-cart-total-row tp-cart-discount-row">
                          <span>Discount ({appliedCoupon.code})</span>
                          <span>-{formatPrice(getCartDiscount(getCartSubtotal()))}</span>
                        </div>
                      )}
                      <div className="tp-cart-total-row tp-cart-grand-total">
                        <strong>Total</strong>
                        <strong>{formatPrice(Math.max(getCartSubtotal() - getCartDiscount(getCartSubtotal()), 0))}</strong>
                      </div>
                    </div>

                    {cartPaymentError && <p className="tp-coupon-error" style={{ marginTop: '0.5rem' }}><FiAlertTriangle /> {cartPaymentError}</p>}

                    <motion.button
                      className="btn-primary tp-cart-checkout-btn"
                      onClick={handleCartCheckout}
                      disabled={cartPaymentLoading}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <FiShoppingCart />
                      {cartPaymentLoading ? 'Processing…' : user ? `Pay ${formatPrice(Math.max(getCartSubtotal() - getCartDiscount(getCartSubtotal()), 0))}` : 'Sign In to Buy'}
                    </motion.button>
                    <p className="tp-cart-secure">Secure payment · Lifetime access</p>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function TPCard({ paper, idx, accessible, paymentLoading, paymentError, onDownload, onQuiz, onBuyPaper, quizAttempt, inCart, onToggleCart }) {
  const navigate = useNavigate();
  return (
    <motion.div
      className="paper-card glass-card"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (idx % 10) * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <PaperThumbnail title={paper.title} difficulty={paper.is_free ? 'Free' : 'Premium'} badgeText={paper.is_free ? 'Free' : 'Premium'} />
      <div className="paper-card-info">
        <p className="paper-card-title">{paper.title}</p>
        <div className="paper-card-meta">
          {paper.is_free && <span className="paper-meta-badge" style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)' }}>FREE</span>}
          {paper.school_name && <span className="paper-meta-badge tag-school">{paper.school_name}</span>}
          {paper.year && <span className="paper-meta-badge paper-year-badge">{paper.year}</span>}
        </div>

        <div className="paper-card-actions">
          <div className="paper-card-action-row">
            {accessible ? (
              paper.file_url ? (
                <button className="row-btn btn-download flex-1" onClick={() => onDownload(paper)}>
                  <FiDownload /> Download
                </button>
              ) : <span className="row-coming-soon flex-1">Coming Soon</span>
            ) : (
              <button className="row-btn btn-locked flex-1" onClick={() => onBuyPaper(paper)}>
                <FiLock /> Download
              </button>
            )}

            {accessible ? (
              paper.quiz_id ? (
                quizAttempt ? (
                  <div className="quiz-attempt-group flex-1 w-full" style={{ display: 'flex', gap: '4px' }}>
                    <button className="row-btn btn-view-results" onClick={() => navigate(`/premium-quiz/${paper.quiz_id}`)} style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem' }}>
                      <FiEye className="mr-0.5" /> {quizAttempt.score}/{quizAttempt.total_questions}
                    </button>
                    <button className="row-btn btn-reattempt" onClick={() => navigate(`/premium-quiz/${paper.quiz_id}?reattempt=true`)} style={{ padding: '0.4rem', flexShrink: 0 }}>
                      <FiRefreshCw /> Reattempt
                    </button>
                  </div>
                ) : (
                  <button className="row-btn btn-answers flex-1" onClick={() => onQuiz(paper)}>
                    <FiPlay /> Take Quiz
                  </button>
                )
              ) : <span className="row-coming-soon flex-1">Coming Soon</span>
            ) : (
              <button className="row-btn btn-locked flex-1" onClick={() => onBuyPaper(paper)}>
                <FiLock /> Take Quiz
              </button>
            )}
          </div>

          <div className="paper-card-action-row buy-row">
            {!accessible && paper.price_pence > 0 ? (
              <>
                {inCart ? (
                  <motion.button className="row-btn btn-in-cart flex-1" onClick={() => onToggleCart(paper.id)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <FiCheck /> In Cart
                  </motion.button>
                ) : (
                  <motion.button className="row-btn btn-add-cart flex-1" onClick={() => onToggleCart(paper.id)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <FiPlus /> Cart
                  </motion.button>
                )}
                <motion.button className={`row-btn btn-buy-paper flex-1 ${paymentLoading ? 'loading' : ''}`} onClick={() => onBuyPaper(paper)} disabled={paymentLoading} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <FiTag /> {paymentLoading ? '…' : formatPrice(paper.price_pence)}
                </motion.button>
              </>
            ) : accessible ? (
              <span className="row-owned-badge"><FiCheck /> Owned Module</span>
            ) : null}
          </div>
          {paymentError && <div className="tp-error-cell error-popup"><FiAlertTriangle /> {paymentError}</div>}
        </div>
      </div>
    </motion.div>
  );
}
