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
  FiLock, FiDownload, FiPlay, FiCheck, FiStar,
  FiAlertTriangle, FiFileText, FiX, FiTag,
} from 'react-icons/fi';
// FiRefreshCw, FiEye imported above
import SEO from '../components/SEO';
import PaperThumbnail from '../components/PaperThumbnail';
import './NVRWorksheets.css';

const DEFAULT_SUBSCRIPTION_PRICE_PENCE = 7900; // £79 fallback
const SUBSCRIPTION_CURRENCY = 'GBP';

const FEATURES = [
  '100+ premium NVR worksheets',
  'Interactive quiz with every worksheet',
  'Step-by-step detailed solutions',
  'Topic-wise practice (Patterns, Sequences, Matrices & more)',
  'New worksheets added every month',
  'Boost speed, accuracy & confidence',
];

export default function NVRWorksheets() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [subscriptionExpiry, setSubscriptionExpiry] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [toast, setToast] = useState(null);
  const [quizAttempts, setQuizAttempts] = useState({});  // quiz_id -> { score, total_questions }

  const [subPricePence, setSubPricePence] = useState(DEFAULT_SUBSCRIPTION_PRICE_PENCE);
  const subPriceDisplay = `£${(subPricePence / 100).toFixed(2).replace(/\.00$/, '')}`;

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  useEffect(() => {
    fetchWorksheets();
    fetchPricing();
  }, []);

  async function fetchPricing() {
    try {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'nvr_sub_price_pence').single();
      if (data && data.value) setSubPricePence(parseInt(data.value, 10));
    } catch (err) {
      console.error("Failed to fetch custom subscription price:", err);
    }
  }

  useEffect(() => {
    if (user) {
      checkSubscription();
      fetchQuizAttempts();
    } else {
      setHasSubscription(false);
      setSubscriptionExpiry(null);
      setQuizAttempts({});
    }
  }, [user]);

  // Auto-dismiss payment errors after 8 seconds
  useEffect(() => {
    if (!paymentError) return;
    const t = setTimeout(() => setPaymentError(''), 8000);
    return () => clearTimeout(t);
  }, [paymentError]);

  async function fetchWorksheets() {
    setLoading(true);
    const { data } = await supabase
      .from('premium_nvr_worksheets')
      .select('id, title, topic, difficulty, worksheet_date, file_url, quiz_id, is_free, sort_order, download_count')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setWorksheets(data || []);
    setLoading(false);
  }

  async function checkSubscription() {
    const { data } = await supabase
      .from('nvr_subscriptions')
      .select('id, expires_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();
    setHasSubscription(!!data);
    setSubscriptionExpiry(data?.expires_at || null);
  }

  async function fetchQuizAttempts() {
    if (!user) return;
    // Get all quiz_ids from worksheets
    const quizIds = worksheets.map(w => w.quiz_id).filter(Boolean);
    if (!quizIds.length) return;
    const { data } = await supabase
      .from('quiz_attempts')
      .select('quiz_id, score, total_questions')
      .eq('user_id', user.id)
      .in('quiz_id', quizIds);
    const map = {};
    (data || []).forEach(a => { map[a.quiz_id] = a; });
    setQuizAttempts(map);
  }

  // Re-fetch attempts when worksheets change (they load async)
  useEffect(() => {
    if (user && worksheets.length > 0) fetchQuizAttempts();
  }, [worksheets, user]);

  function canAccess(worksheet) {
    return worksheet.is_free || hasSubscription;
  }

  function showToast(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function formatPrice(pence) {
    return `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;
  }

  function getCouponDiscount(subtotal) {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discount_type === 'percentage') {
      return Math.round(subtotal * appliedCoupon.discount_value / 100);
    }
    return Math.min(appliedCoupon.discount_value, subtotal);
  }

  async function validateNvrCoupon() {
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
      setAppliedCoupon(data);
    } catch { setCouponError('Failed to validate coupon.'); }
    finally { setCouponLoading(false); }
  }

  async function handleSubscribe() {
    if (!user) { navigate('/login'); return; }
    if (paymentLoading) return;
    setPaymentLoading(true);
    setPaymentError('');
    setPaymentSuccess(false);

    const discount = getCouponDiscount(subPricePence);
    const finalAmount = Math.max(subPricePence - discount, 0);

    // If coupon covers entire cost
    if (finalAmount <= 0) {
      // In production, record subscription server-side
      if (appliedCoupon) {
        await supabase.from('coupon_codes').update({ current_uses: (appliedCoupon.current_uses || 0) + 1 }).eq('id', appliedCoupon.id);
      }
      setPaymentSuccess(true);
      setHasSubscription(true);
      await checkSubscription();
      showToast('Coupon applied! Subscription activated for free.', 'success');
      setAppliedCoupon(null);
      setCouponInput('');
      setPaymentLoading(false);
      return;
    }

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setPaymentError('Failed to load payment gateway. Please disable ad-blockers and try again.');
        setPaymentLoading(false);
        return;
      }

      const receipt = `nvr_${user.id.slice(0, 8)}_${Date.now()}`;

      const { order_id, amount, currency } = await createRazorpayOrder({
        amount: finalAmount,
        currency: SUBSCRIPTION_CURRENCY,
        receipt,
        type: 'nvr_subscription',
      });

      openRazorpayCheckout({
        orderId: order_id,
        amount,
        currency,
        description: `11+ NVR Worksheets — Yearly Subscription${appliedCoupon ? ` (Coupon: ${appliedCoupon.code})` : ''}`,
        prefill: { email: user.email },
        onSuccess: async (response) => {
          try {
            await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              type: 'nvr_subscription',
            });
            if (appliedCoupon) {
              await supabase.from('coupon_codes').update({ current_uses: (appliedCoupon.current_uses || 0) + 1 }).eq('id', appliedCoupon.id);
            }
            setPaymentSuccess(true);
            setHasSubscription(true);
            await checkSubscription();
            showToast('Subscription activated! You now have full access.', 'success');
            setAppliedCoupon(null);
            setCouponInput('');
          } catch (verifyErr) {
            setPaymentError(verifyErr.message || 'Payment verification failed. If money was deducted, please contact support.');
          } finally {
            setPaymentLoading(false);
          }
        },
        onFailure: (err) => {
          setPaymentLoading(false);
          const failedStatus = err.message === 'Payment cancelled' ? 'cancelled' : 'failed';
          markRazorpayPaymentStatus({
            razorpay_order_id: order_id,
            type: 'nvr_subscription',
            status: failedStatus,
          }).catch(() => { });

          if (err.message !== 'Payment cancelled') {
            setPaymentError(err.message || 'Payment failed. Please try again.');
          }
        },
      });
    } catch (err) {
      setPaymentError(err.message || 'Something went wrong. Please try again.');
      setPaymentLoading(false);
    }
  }

  async function handleDownload(ws) {
    if (!canAccess(ws)) { handleSubscribe(); return; }
    if (!ws.file_url) { showToast('File not available yet.', 'info'); return; }
    // Increment download count directly on the table
    supabase
      .from('premium_nvr_worksheets')
      .update({ download_count: (ws.download_count || 0) + 1 })
      .eq('id', ws.id)
      .then(() => {});
    window.open(ws.file_url, '_blank');
    setWorksheets(prev => prev.map(w => w.id === ws.id ? { ...w, download_count: (w.download_count || 0) + 1 } : w));
  }

  function handleQuiz(ws) {
    if (!canAccess(ws)) { handleSubscribe(); return; }
    if (ws.quiz_id) navigate(`/premium-quiz/${ws.quiz_id}`);
    else showToast('Quiz coming soon for this worksheet.', 'info');
  }

  const freeCount = worksheets.filter(w => w.is_free).length;
  const premiumCount = worksheets.length - freeCount;

  return (
    <>
      <SEO
        title="11+ NVR Worksheets | ReasoningWizard"
        description="Access premium 11+ Non-Verbal Reasoning worksheets with interactive quizzes and step-by-step solutions."
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`nvr-toast nvr-toast-${toast.type}`}
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

      <div className="nvr-page page-container">

        {/* ── Hero ── */}
        <motion.section
          className="nvr-hero"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="nvr-hero-inner">
            {/* Left: text */}
            <div className="nvr-hero-text">
              <span className="nvr-eyebrow">Yearly Subscription</span>
              <h1 className="nvr-title">11+ NVR <span className="text-gradient">Worksheets</span></h1>
              <p className="nvr-subtitle">
                Master Non-Verbal Reasoning with curated worksheets, interactive quizzes, and detailed solutions — all in one place.
              </p>
              <ul className="nvr-features-list">
                {FEATURES.map((f, i) => (
                  <li key={i}><FiCheck className="feat-check" />{f}</li>
                ))}
              </ul>
            </div>

            {/* Right: price card */}
            <motion.div
              className="nvr-price-card glass-card"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
            >
              {hasSubscription ? (
                <div className="nvr-subscribed">
                  <div className="subscribed-badge-row">
                    <FiStar className="sub-star" />
                    <span>Active Subscription</span>
                  </div>
                  <p className="sub-expiry">
                    Valid until{' '}
                    <strong>
                      {new Date(subscriptionExpiry).toLocaleDateString('en-IN', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </strong>
                  </p>
                  <p className="sub-msg">You have full access to all worksheets and quizzes!</p>
                  <ul className="sub-perks">
                    <li><FiCheck /> {worksheets.length} worksheets unlocked</li>
                    <li><FiCheck /> {worksheets.filter(w => w.quiz_id).length} quizzes available</li>
                  </ul>
                </div>
              ) : (
                <>
                  <div className="price-card-tag">Yearly Plan</div>
                  <div className="price-main-row">
                    <span className="price-amount">{subPriceDisplay}</span>
                    <span className="price-period">/year</span>
                  </div>
                  <p className="price-desc">Unlock all worksheets, quizzes, and solutions instantly.</p>
                  <ul className="price-perks">
                    <li><FiCheck /> {worksheets.length > 0 ? `${worksheets.length}+` : '100+'} worksheets</li>
                    <li><FiCheck /> Full quiz &amp; solution access</li>
                    <li><FiCheck /> New content monthly</li>
                  </ul>
                  {paymentError && (
                    <p className="payment-error-msg"><FiAlertTriangle /> {paymentError}</p>
                  )}
                  {paymentSuccess && (
                    <p className="payment-success-msg"><FiCheck /> Payment successful! Full access granted.</p>
                  )}
                  <motion.button
                    className="btn-primary nvr-sub-btn"
                    onClick={handleSubscribe}
                    disabled={paymentLoading}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {paymentLoading ? 'Processing…' : user ? (appliedCoupon ? `Pay ${formatPrice(Math.max(subPricePence - getCouponDiscount(subPricePence), 0))}` : 'Subscribe Now') : 'Sign In to Subscribe'}
                  </motion.button>

                  {/* Coupon section */}
                  <div className="nvr-coupon-section">
                    <div className="nvr-coupon-row">
                      <FiTag className="nvr-coupon-icon" />
                      <input
                        type="text"
                        placeholder="Coupon code"
                        value={couponInput}
                        onChange={e => { setCouponInput(e.target.value); setCouponError(''); setAppliedCoupon(null); }}
                        onKeyDown={e => e.key === 'Enter' && validateNvrCoupon()}
                        className="nvr-coupon-input"
                      />
                      <button className="nvr-coupon-apply" onClick={validateNvrCoupon} disabled={couponLoading}>
                        {couponLoading ? '…' : 'Apply'}
                      </button>
                    </div>
                    {couponError && <p className="nvr-coupon-error"><FiAlertTriangle /> {couponError}</p>}
                    {appliedCoupon && (
                      <p className="nvr-coupon-success">
                        <FiCheck /> {appliedCoupon.code} — {appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount_value}% off` : `${formatPrice(appliedCoupon.discount_value)} off`}
                      </p>
                    )}
                  </div>
                  <p className="price-secure-note">Secure payment via Razorpay</p>
                </>
              )}
            </motion.div>
          </div>
        </motion.section>

        {/* ── Stats ── */}
        <motion.div
          className="nvr-stats-bar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {[
            { label: 'Worksheets', value: worksheets.length > 0 ? `${worksheets.length}+` : '100+' },
            { label: 'Quizzes', value: worksheets.filter(w => w.quiz_id).length > 0 ? `${worksheets.filter(w => w.quiz_id).length}+` : '100+' },
            { label: 'Topics', value: '15+' },
            { label: 'Success Rate', value: '95%' },
          ].map((s) => (
            <div key={s.label} className="nvr-stat glass-card">
              <span className="nvr-stat-val">{s.value}</span>
              <span className="nvr-stat-lbl">{s.label}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Worksheets Table ── */}
        <motion.section
          className="nvr-table-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h2 className="nvr-section-heading">11+ NVR Worksheets</h2>

          {loading ? (
            <div className="loading-state">
              <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
              <p>Loading worksheets…</p>
            </div>
          ) : worksheets.length === 0 ? (
            <div className="empty-state glass-card">
              <FiFileText />
              <h3>No worksheets yet</h3>
              <p>Worksheets will appear here once uploaded. Check back soon!</p>
            </div>
          ) : (
            <div className="nvr-table-wrap glass-card">
              {/* Free section */}
              {freeCount > 0 && (
                <>
                  <div className="table-section-header free-header">
                    <span className="section-header-label free-label-tag">FREE 11+ NVR Worksheets</span>
                  </div>
                  <div className="paper-grid">
                    {worksheets.filter(w => w.is_free).map((ws, idx) => (
                      <NVCard key={ws.id} ws={ws} idx={idx} accessible={true} onDownload={handleDownload} onQuiz={handleQuiz} quizAttempt={ws.quiz_id ? quizAttempts[ws.quiz_id] : null} />
                    ))}
                  </div>
                </>
              )}

              {/* Premium section */}
              {premiumCount > 0 && (
                <>
                  <div className={`table-section-header premium-header ${!hasSubscription ? 'locked-header' : ''}`}>
                    <span className="section-header-label">
                      {hasSubscription
                        ? '✓ Premium Worksheets (Unlocked)'
                        : <><FiLock /> Premium members can unlock the below worksheets</>
                      }
                    </span>
                  </div>
                  <div className="paper-grid">
                    {worksheets.filter(w => !w.is_free).map((ws, idx) => (
                      <NVCard
                        key={ws.id}
                        ws={ws}
                        idx={freeCount + idx}
                        accessible={hasSubscription}
                        onDownload={handleDownload}
                        onQuiz={handleQuiz}
                        onLocked={handleSubscribe}
                        quizAttempt={ws.quiz_id ? quizAttempts[ws.quiz_id] : null}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Bottom CTA for non-subscribers */}
          {!hasSubscription && premiumCount > 0 && !loading && (
            <motion.div
              className="nvr-bottom-cta glass-card"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="cta-icon-wrap"><FiLock /></div>
              <div className="cta-text">
                <h3>Unlock {premiumCount} More Worksheets &amp; Quizzes</h3>
                <p>Subscribe for {subPriceDisplay}/year to get full access to all content.</p>
              </div>
              <motion.button
                className="btn-primary"
                onClick={handleSubscribe}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Subscribe Now
              </motion.button>
            </motion.div>
          )}
        </motion.section >
      </div >
    </>
  );
}

function NVCard({ ws, idx, accessible, onDownload, onQuiz, onLocked, quizAttempt }) {
  const navigate = useNavigate();
  return (
    <motion.div
      className="paper-card glass-card"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (idx % 10) * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <PaperThumbnail title={ws.title} difficulty={ws.difficulty || (ws.is_free ? 'Free' : 'Premium')} badgeText={ws.difficulty || (ws.is_free ? 'Free' : 'Premium')} />
      <div className="paper-card-info">
        <p className="paper-card-title">{ws.title}</p>
        <div className="paper-card-meta">
          {ws.is_free && <span className="paper-meta-badge" style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)' }}>FREE</span>}
          {ws.topic && <span className="paper-meta-badge subject-badge">{ws.topic}</span>}
        </div>

        <div className="paper-card-actions">
          <div className="paper-card-action-row">
            {accessible ? (
              ws.file_url ? (
                <button className="row-btn btn-download flex-1" onClick={() => onDownload(ws)}>
                  <FiDownload /> Download
                </button>
              ) : <span className="row-coming-soon flex-1">Coming Soon</span>
            ) : (
              <button className="row-btn btn-locked flex-1" onClick={onLocked}>
                <FiLock /> Download
              </button>
            )}

            {accessible ? (
              ws.quiz_id ? (
                quizAttempt ? (
                  <div className="quiz-attempt-group flex-1 w-full" style={{ display: 'flex', gap: '4px' }}>
                    <button className="row-btn btn-view-results" onClick={() => navigate(`/premium-quiz/${ws.quiz_id}`)} style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem' }}>
                      <FiEye className="mr-0.5" /> {quizAttempt.score}/{quizAttempt.total_questions}
                    </button>
                    <button className="row-btn btn-reattempt" onClick={() => navigate(`/premium-quiz/${ws.quiz_id}?reattempt=true`)} style={{ padding: '0.4rem', flexShrink: 0 }}>
                      <FiRefreshCw /> Reattempt
                    </button>
                  </div>
                ) : (
                  <button className="row-btn btn-quiz flex-1" onClick={() => onQuiz(ws)}>
                    <FiPlay /> Take Quiz
                  </button>
                )
              ) : <span className="row-coming-soon flex-1">Coming Soon</span>
            ) : (
              <button className="row-btn btn-locked flex-1" onClick={onLocked}>
                <FiLock /> Take Quiz
              </button>
            )}
          </div>
          {!accessible && (
            <div className="paper-card-action-row">
              <button className="row-btn btn-locked flex-1" style={{ padding: '0.55rem', fontSize: '0.88rem' }} onClick={onLocked}>
                <FiLock /> Subscribe to Unlock
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
