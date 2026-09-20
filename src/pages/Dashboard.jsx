import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { FiCalendar, FiClock, FiPlay, FiUser, FiEdit2, FiSave, FiTrendingUp, FiAward, FiCheckCircle, FiBook, FiRefreshCw, FiDownload, FiX, FiLogIn, FiArrowRight, FiLock } from 'react-icons/fi';
import logo from '../assets/logo.png';
import { createRazorpayOrder, verifyRazorpayPayment, openRazorpayCheckout, loadRazorpayScript, reconcileRazorpayPayments } from '../lib/razorpay';
import './Dashboard.css';
import './Home.css';

function LoginPopup({ onClose }) {
    return (
        <motion.div
            className="login-popup-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
        >
            <motion.div
                className="login-popup glass-card"
                initial={{ opacity: 0, scale: 0.85, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 30 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                onClick={e => e.stopPropagation()}
            >
                <button className="popup-close" onClick={onClose}>
                    <FiX />
                </button>
                <div className="popup-icon-wrap">
                    <motion.img
                        src={logo}
                        alt="ReasoningWizard"
                        className="popup-logo-img"
                        animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                </div>
                <h2 className="popup-title">Welcome to ReasoningWizard!</h2>
                <p className="popup-desc">
                   Sign in to access daily worksheets, weekly tests, mocks, and many more resources, track your progress on leaderboards, and start mastering your exams.
                </p>
                <div className="popup-actions">
                    <Link to="/login" onClick={onClose}>
                        <motion.button className="btn-primary popup-btn" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                            <FiLogIn /> Sign In
                        </motion.button>
                    </Link>
                    <Link to="/register" onClick={onClose}>
                        <motion.button className="btn-secondary popup-btn" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                            Create Account <FiArrowRight />
                        </motion.button>
                    </Link>
                </div>
                <p className="popup-footer">Free forever · No credit card required</p>
            </motion.div>
        </motion.div>
    );
}

function PurchasePopup({ onClose, onPurchase, price, purchasing }) {
    const [couponInput, setCouponInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [couponError, setCouponError] = useState('');
    const [couponLoading, setCouponLoading] = useState(false);

    const discount = !appliedCoupon
        ? 0
        : appliedCoupon.discount_type === 'percentage'
            ? Math.round(price * appliedCoupon.discount_value / 100)
            : Math.min(appliedCoupon.discount_value, price);
    const total = Math.max(price - discount, 0);

    async function applyCoupon() {
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
            // Daily-worksheet cart only accepts 'dashboard' or 'all' coupons.
            if ((data.applies_to || 'all') !== 'all' && data.applies_to !== 'dashboard') {
                setCouponError('This coupon is not valid for daily worksheet access.'); return;
            }
            if (data.expires_at && new Date(data.expires_at) < new Date()) { setCouponError('This coupon has expired.'); return; }
            if (data.max_uses && data.current_uses >= data.max_uses) { setCouponError('This coupon has reached its usage limit.'); return; }
            if (data.min_cart_pence && price < data.min_cart_pence) {
                setCouponError(`Minimum spend: £${(data.min_cart_pence / 100).toFixed(2)}.`); return;
            }
            setAppliedCoupon(data);
        } catch {
            setCouponError('Failed to validate coupon.');
        } finally {
            setCouponLoading(false);
        }
    }

    return (
        <motion.div
            className="login-popup-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
        >
            <motion.div
                className="login-popup glass-card"
                initial={{ opacity: 0, scale: 0.85, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 30 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                onClick={e => e.stopPropagation()}
            >
                <button className="popup-close" onClick={onClose}>
                    <FiX />
                </button>
                <div className="purchase-popup-badge">
                    <FiLock />
                </div>
                <h2 className="popup-title">Your Cart</h2>

                <div className="dash-cart-item">
                    <div className="dash-cart-item-info">
                        <strong>Old Worksheets Access</strong>
                        <span>1 year · all old quizzes &amp; worksheets</span>
                    </div>
                    <span className="dash-cart-item-price">£{(price / 100).toFixed(2)}</span>
                </div>

                <div className="dash-cart-coupon">
                    {appliedCoupon ? (
                        <div className="dash-coupon-applied">
                            <span>
                                <strong>{appliedCoupon.code}</strong> applied
                                {appliedCoupon.discount_type === 'percentage'
                                    ? ` (−${appliedCoupon.discount_value}%)`
                                    : ` (−£${(appliedCoupon.discount_value / 100).toFixed(2)})`}
                            </span>
                            <button
                                type="button"
                                className="dash-coupon-remove"
                                onClick={() => { setAppliedCoupon(null); setCouponInput(''); setCouponError(''); }}
                            >
                                Remove
                            </button>
                        </div>
                    ) : (
                        <div className="dash-coupon-row">
                            <input
                                className="admin-input"
                                type="text"
                                placeholder="Coupon code"
                                value={couponInput}
                                onChange={e => setCouponInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') applyCoupon(); }}
                            />
                            <button type="button" className="btn-secondary" onClick={applyCoupon} disabled={couponLoading}>
                                {couponLoading ? '…' : 'Apply'}
                            </button>
                        </div>
                    )}
                    {couponError && <p className="dash-coupon-error">{couponError}</p>}
                </div>

                <div className="dash-cart-totals">
                    <div className="dash-cart-line">
                        <span>Subtotal</span><span>£{(price / 100).toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                        <div className="dash-cart-line dash-cart-discount">
                            <span>Discount</span><span>−£{(discount / 100).toFixed(2)}</span>
                        </div>
                    )}
                    <div className="dash-cart-line dash-cart-total">
                        <span>Total</span><span>£{(total / 100).toFixed(2)}</span>
                    </div>
                </div>

                <div className="popup-actions">
                    <motion.button
                        className="btn-primary popup-btn"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onPurchase(appliedCoupon)}
                        disabled={purchasing}
                    >
                        <FiLock /> {purchasing ? 'Processing...' : `Proceed to Pay £${(total / 100).toFixed(2)}`}
                    </motion.button>
                </div>
                <p className="popup-footer">Secure checkout · 1 year access · Cancel anytime</p>
            </motion.div>
        </motion.div>
    );
}

const OLD_WORKSHEETS_BULLETS = [
    'Unlock instantly 150+ 11+ Maths worksheets based on past papers and real exam-style questions',
    'Practise with 1,000+ of the most important Maths questions designed for 11+ preparation',
    'Access detailed, step-by-step solutions explained by our expert tutors',
    'Download worksheets as PDFs or practise online with interactive quizzes',
    'Take online Maths quizzes to improve speed, accuracy and exam technique',
    'Track your performance and identify areas where you need more practice',
    'Boost your 11+ exam speed, accuracy and confidence with regular practice',
    'Suitable for GL, CSSE, Kent Test, SET, ISEB & Independent Schools',
    'Designed to help kids practise consistently and build 11+ confidence',
];

function OldWorksheetsPromo({ price, purchasing, onUnlock }) {
    return (
        <motion.div className="old-worksheets-promo glass-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="owp-header">
                <span className="owp-badge"><FiLock /> Old Worksheets Bundle</span>
                <h3 className="owp-title">11+ Maths Worksheets 2026 — Based on Past Papers</h3>
            </div>
            <ul className="owp-bullets">
                {OLD_WORKSHEETS_BULLETS.map((b, i) => (
                    <li key={i}><FiCheckCircle /> <span>{b}</span></li>
                ))}
            </ul>
            <div className="owp-footer">
                <div className="owp-price">
                    <strong>£{(price / 100).toFixed(2)}</strong>
                    <span>/ year</span>
                </div>
                <motion.button className="btn-primary owp-cta" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onUnlock} disabled={purchasing}>
                    <FiLock /> {purchasing ? 'Processing...' : 'Unlock Old Worksheets'}
                </motion.button>
            </div>
        </motion.div>
    );
}

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } })
};

const stagger = {
    visible: { transition: { staggerChildren: 0.08 } }
};

export default function Dashboard() {
    const { user, profile, updateProfile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState('new');
    const [quizzes, setQuizzes] = useState([]);
    const [attempts, setAttempts] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [worksheets, setWorksheets] = useState([]);
    const [activeSubject, setActiveSubject] = useState('All');
    const [loadingQuizzes, setLoadingQuizzes] = useState(true);
    const [editingProfile, setEditingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({ display_name: '', phone: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [showLoginPopup, setShowLoginPopup] = useState(false);
    const [showPurchasePopup, setShowPurchasePopup] = useState(false);
    const [hasDashboardAccess, setHasDashboardAccess] = useState(false);
    const [dashboardPrice, setDashboardPrice] = useState(999);
    const [purchasing, setPurchasing] = useState(false);

    useEffect(() => {
        fetchLeaderboard();
        loadRazorpayScript();
    }, []);

    // Refetch quizzes/access whenever auth resolves or the signed-in user (or
    // their admin status) changes. Without this, the lock state is computed from
    // a stale `user`/`profile` captured on first mount — which on a hard load
    // evaluates before the session resolves and renders everything unlocked.
    useEffect(() => {
        if (authLoading) return;
        fetchQuizzes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, user?.id]);

    // Self-heal any payment Razorpay charged but the client never confirmed
    // (tab closed / network drop / expired token). Only completes orders that
    // Razorpay reports as actually paid, then unlocks access if one was healed.
    useEffect(() => {
        if (authLoading || !user) return;
        (async () => {
            const res = await reconcileRazorpayPayments();
            if (res?.healed?.dashboard > 0) setHasDashboardAccess(true);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, user?.id]);

    useEffect(() => {
        if (profile) {
            setProfileForm({ display_name: profile.display_name || '', phone: profile.phone || '' });
        }
    }, [profile]);

    async function fetchQuizzes() {
        setLoadingQuizzes(true);
        const [
            { data: quizzesData },
            { data: premiumNvrLinks },
            { data: premiumPaperLinks },
        ] = await Promise.all([
            supabase
                .from('quizzes')
                .select('*')
                .neq('is_draft', true)
                .order('quiz_date', { ascending: false }),
            supabase.from('premium_nvr_worksheets').select('quiz_id').not('quiz_id', 'is', null),
            supabase.from('premium_test_papers').select('quiz_id').not('quiz_id', 'is', null),
        ]);

        const premiumQuizIds = new Set([
            ...(premiumNvrLinks || []).map(row => row.quiz_id),
            ...(premiumPaperLinks || []).map(row => row.quiz_id),
        ]);

        const dashboardOnlyQuizzes = (quizzesData || []).filter(
            q => q.quiz_mode !== 'premium' && !premiumQuizIds.has(q.id)
        );

        let attemptsData = [], sessionsData = [];
        let hasAccess = false;
        if (user) {
            const { data: aData } = await supabase
                .from('quiz_attempts')
                .select('*')
                .eq('user_id', user.id);
            const { data: sData } = await supabase
                .from('quiz_sessions')
                .select('*')
                .eq('user_id', user.id);
            // Dashboard access is a 1-year subscription: a completed purchase
            // counts only while it hasn't expired (NULL expires_at = legacy lifetime).
            const nowIso = new Date().toISOString();
            const { data: pData } = await supabase
                .from('dashboard_purchases')
                .select('id, expires_at')
                .eq('user_id', user.id)
                .eq('status', 'completed')
                .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
                .limit(1);
            attemptsData = aData || [];
            sessionsData = sData || [];
            // Access is granted only by an active (completed, non-expired) purchase.
            // Admins are NOT exempt — they see the locked state like normal users.
            if (pData && pData.length > 0) hasAccess = true;
        }

        const { data: wsData } = await supabase
            .from('public_daily_worksheets')
            .select('id, quiz_id, file_url, file_name');

        const { data: priceData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'dashboard_price_pence')
            .maybeSingle();

        setQuizzes(dashboardOnlyQuizzes);
        setAttempts(attemptsData);
        setSessions(sessionsData);
        setWorksheets(wsData || []);
        setHasDashboardAccess(hasAccess);
        if (priceData && priceData.value) setDashboardPrice(parseInt(priceData.value, 10));
        setLoadingQuizzes(false);
    }

    async function fetchLeaderboard() {
        const today = new Date().toISOString().split('T')[0];
        const { data: attempts } = await supabase
            .from('public_quiz_attempts')
            .select('score, total_questions, time_taken_seconds, completed_at, user_id')
            .gte('completed_at', today + 'T00:00:00')
            .order('score', { ascending: false })
            .order('time_taken_seconds', { ascending: true })
            .limit(10);

        if (!attempts?.length) { setLeaderboard([]); return; }

        const userIds = [...new Set(attempts.map(a => a.user_id))];
        const { data: profilesData } = await supabase
            .from('public_profiles')
            .select('id, display_name, avatar_url')
            .in('id', userIds);

        const profileMap = {};
        (profilesData || []).forEach(p => { profileMap[p.id] = p; });

        setLeaderboard(attempts.map(a => ({
            ...a,
            profiles: profileMap[a.user_id] || { display_name: 'Anonymous', avatar_url: '' }
        })));
    }

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        await updateProfile(profileForm);
        setSavingProfile(false);
        setEditingProfile(false);
    };

    const getAttempt = (quizId) => attempts.find(a => a.quiz_id === quizId);
    const getSession = (quizId) => sessions.find(s => s.quiz_id === quizId);
    const getWorksheet = (quiz) => worksheets.find(w => w.quiz_id === quiz.id);

    // Permanent split, not time-based: 'new' quizzes (uploaded from now on)
    // are free for everyone; 'old' quizzes (the pre-existing catalogue) sit
    // behind the 1-year bundle purchase. Mirrors quizzes.worksheet_group.
    const getWorksheetGroup = (quiz) => quiz.worksheet_group || 'new';
    const newQuizzes = useMemo(() => quizzes.filter(q => getWorksheetGroup(q) === 'new'), [quizzes]);
    const oldQuizzes = useMemo(() => quizzes.filter(q => getWorksheetGroup(q) === 'old'), [quizzes]);

    const isQuizLocked = (quiz) => {
        // Logged-out visitors never see the locked/purchase state. Their tiles
        // look normal and clicking prompts the sign-in / create-account popup.
        // The purchase lock only applies to signed-in users without access.
        if (!user) return false;
        if (getWorksheetGroup(quiz) === 'new') return false;
        return !hasDashboardAccess;
    };

    // Records a worksheet download. The DB trigger trg_sync_download_count then
    // increments daily_worksheets.download_count, which the admin Manage Quizzes
    // tab reads. Awaited + error-logged so a failed insert is visible in console
    // instead of silently dropped.
    const logWorksheetDownload = async (worksheetId) => {
        try {
            const { error } = await supabase
                .from('download_logs')
                .insert({ resource_type: 'worksheet', resource_id: worksheetId });
            if (error) console.error('[download_logs] insert failed:', error.message);
        } catch (e) {
            console.error('[download_logs] insert threw:', e);
        }
    };

    const handlePurchaseAccess = async (coupon) => {
        if (!user) {
            setShowLoginPopup(true);
            return;
        }
        setPurchasing(true);
        try {
            // The server validates the coupon and computes the real charged
            // amount from app_settings — the client amount here is only a hint.
            const { order_id, amount, currency } = await createRazorpayOrder({
                amount: dashboardPrice,
                currency: 'GBP',
                receipt: `receipt_dash_${Date.now()}`,
                type: 'dashboard_purchase',
                coupon_code: coupon?.code || null
            });

            openRazorpayCheckout({
                orderId: order_id,
                amount,
                currency,
                description: 'Dashboard Access (1 Year)',
                prefill: {
                    name: profile?.display_name || user.email,
                    email: user.email,
                    contact: profile?.phone || ''
                },
                onSuccess: async (response) => {
                    await verifyRazorpayPayment({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        type: 'dashboard_purchase'
                    });
                    // Count the coupon redemption (best-effort).
                    if (coupon?.id) {
                        await supabase.from('coupon_codes')
                            .update({ current_uses: (coupon.current_uses || 0) + 1 })
                            .eq('id', coupon.id);
                    }
                    setHasDashboardAccess(true);
                    setShowPurchasePopup(false);
                    alert("Dashboard Access Unlocked Successfully!");
                },
                onFailure: (err) => {
                    alert(err.message || 'Payment failed.');
                }
            });
        } catch (err) {
            alert(err.message || 'Error initiating payment');
        } finally {
            setPurchasing(false);
        }
    };

    // The active dashboard tab drives which quiz list subject filtering and
    // grouping operate over — 'new' (free) and 'old' (bundle) are separate lists.
    const activeTabQuizzes = useMemo(
        () => (tab === 'new' ? newQuizzes : tab === 'old' ? oldQuizzes : []),
        [tab, newQuizzes, oldQuizzes]
    );

    const subjects = useMemo(() => {
        const s = [...new Set(activeTabQuizzes.map(q => q.subject).filter(Boolean))].sort();
        return s.length > 0 ? ['All', ...s] : [];
    }, [activeTabQuizzes]);

    const filteredQuizzes = activeSubject === 'All'
        ? activeTabQuizzes
        : activeTabQuizzes.filter(q => q.subject === activeSubject);

    // Groups for 'All' view: [{subj, quizzes[]}] in sorted order
    const groupedBySubject = useMemo(() => {
        const map = {};
        activeTabQuizzes.forEach(q => {
            const s = q.subject || 'General';
            if (!map[s]) map[s] = [];
            map[s].push(q);
        });
        return subjects.slice(1).map(s => ({ subj: s, quizzes: map[s] || [] })).filter(g => g.quizzes.length > 0);
    }, [activeTabQuizzes, subjects]);

    // Reset the subject filter when switching between New/Old Worksheets so a
    // subject that doesn't exist in the other tab doesn't hide everything.
    useEffect(() => {
        setActiveSubject('All');
    }, [tab]);

    const renderCard = (quiz, i) => {
        const attempt = getAttempt(quiz.id);
        const session = getSession(quiz.id);
        const worksheet = getWorksheet(quiz);
        const locked = isQuizLocked(quiz);

        return (
            <motion.div key={quiz.id} className={`quiz-card glass-card rw-glow-border ${attempt ? 'completed' : ''} ${locked ? 'locked' : ''}`} variants={fadeUp} custom={i} whileHover={locked ? {} : { y: -4, borderColor: 'rgba(245,197,24,0.3)' }}>
                <div className="quiz-card-header">
                    <div className="quiz-subject-badge">{quiz.subject}</div>
                    {locked ? (
                        <div className="locked-badge"><FiLock /> Locked</div>
                    ) : (
                        attempt && <div className="completed-badge"><FiCheckCircle /> Done</div>
                    )}
                </div>
                <h4 className="quiz-card-title">{quiz.title}</h4>
                <div className="quiz-card-meta">
                    <span><FiClock /> {quiz.duration_minutes} min</span>
                    {attempt && <span><FiAward /> {attempt.score}/{attempt.total_questions}</span>}
                </div>
                {locked ? (
                    <div className="quiz-card-actions quiz-locked-cta">
                        <p className="quiz-locked-text">
                            Purchase the <strong>Old Worksheets bundle</strong> to unlock this quiz &amp; worksheet — get <strong>1 year access</strong>.
                        </p>
                        <motion.button className="btn-primary quiz-btn" whileHover={{ scale: 1.02 }} onClick={() => setShowPurchasePopup(true)} disabled={purchasing}>
                            <FiLock /> {`Unlock for £${(dashboardPrice / 100).toFixed(2)} / 1 year`}
                        </motion.button>
                    </div>
                ) : (
                    <>
                        {attempt ? (
                            <div className="quiz-card-actions">
                                <Link to={`/quiz/${quiz.id}`}>
                                    <motion.button className="btn-secondary quiz-btn" whileHover={{ scale: 1.02 }}>View Results</motion.button>
                                </Link>
                                <motion.button
                                    className="btn-primary quiz-btn reattempt-dashboard-btn"
                                    whileHover={{ scale: 1.02 }}
                                    onClick={async () => {
                                        await supabase.from('quiz_attempts').delete().eq('id', attempt.id);
                                        navigate(`/quiz/${quiz.id}?reattempt=true`);
                                    }}
                                >
                                    <FiRefreshCw /> Re-attempt
                                </motion.button>
                            </div>
                        ) : user ? (
                            <Link to={`/quiz/${quiz.id}`}>
                                <motion.button className="btn-primary quiz-btn" whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(245,197,24,0.3)' }}>
                                    <FiPlay /> {session ? 'Resume Quiz' : 'Attempt Online'}
                                </motion.button>
                            </Link>
                        ) : (
                            <motion.button className="btn-primary quiz-btn" whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(245,197,24,0.3)' }} onClick={() => setShowLoginPopup(true)}>
                                <FiPlay /> Attempt Online
                            </motion.button>
                        )}
                        {worksheet && (user ? worksheet.file_url : true) && (
                            user ? (
                                <a href={worksheet.file_url} download={worksheet.file_name} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '0.5rem' }} onClick={() => logWorksheetDownload(worksheet.id)}>
                                    <motion.button className="btn-secondary quiz-btn worksheet-dl-btn" whileHover={{ scale: 1.02 }}>
                                        <FiDownload /> Download Worksheet
                                    </motion.button>
                                </a>
                            ) : (
                                <motion.button className="btn-secondary quiz-btn worksheet-dl-btn" style={{ marginTop: '0.5rem', width: '100%' }} whileHover={{ scale: 1.02 }} onClick={() => setShowLoginPopup(true)}>
                                    <FiDownload /> Download Worksheet
                                </motion.button>
                            )
                        )}
                    </>
                )}
            </motion.div>
        );
    };

    const groupByDate = (arr) => {
        const map = {};
        arr.forEach(q => {
            const d = q.quiz_date || 'Unknown';
            if (!map[d]) map[d] = [];
            map[d].push(q);
        });
        return Object.keys(map)
            .sort((a, b) => b.localeCompare(a))
            .map(date => ({ date, quizzes: map[date] }));
    };

    const formatDate = (dateStr) => {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (dateStr === today) return 'Today';
        if (dateStr === yesterday) return 'Yesterday';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const tabs = [
        { id: 'new', label: 'New Worksheets', icon: <FiBook /> },
        { id: 'old', label: 'Old Worksheets', icon: <FiLock /> },
        { id: 'leaderboard', label: 'Leaderboard', icon: <FiTrendingUp /> },
        { id: 'profile', label: 'Profile', icon: <FiUser /> },
    ];

    return (
        <div className="dashboard-page page-container">
            <div className="dashboard-inner">
                {/* Header */}
                <motion.div className="dash-header" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <div>
                        <h1 className="dash-title">
                            {user
                                ? <>Welcome back, <span className="text-gradient">{profile?.display_name || 'Student'}</span> 👋</>
                                : <>Welcome to <span className="text-gradient">ReasoningWizard</span> ✦</>}
                        </h1>
                        <p className="dash-subtitle">
                            {user ? 'Ready to challenge yourself today?' : 'Sign in to track your progress and compete on leaderboards!'}
                        </p>
                    </div>
                </motion.div>

                {/* Tabs */}
                <motion.div className="dash-tabs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            className={`dash-tab ${tab === t.id ? 'active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.icon} {t.label}
                            {tab === t.id && <motion.div className="tab-indicator" layoutId="dashTab" />}
                        </button>
                    ))}
                </motion.div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {(tab === 'new' || tab === 'old') && (
                        <motion.div key={tab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>

                            {/* Subject Toggle */}
                            {!loadingQuizzes && subjects.length > 1 && (
                                <motion.div
                                    className="subject-filter"
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {subjects.map(subj => (
                                        <motion.button
                                            key={subj}
                                            className={`subject-filter-btn ${activeSubject === subj ? 'active' : ''}`}
                                            onClick={() => setActiveSubject(subj)}
                                            whileTap={{ scale: 0.93 }}
                                        >
                                            {activeSubject === subj && (
                                                <motion.div
                                                    className="subject-indicator"
                                                    layoutId="subjectIndicator"
                                                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                                />
                                            )}
                                            <span className="subject-btn-label">{subj}</span>
                                        </motion.button>
                                    ))}
                                </motion.div>
                            )}

                            {/* Old Worksheets bundle promo — only while the user hasn't unlocked it yet */}
                            {tab === 'old' && !loadingQuizzes && !authLoading && !hasDashboardAccess && (
                                <OldWorksheetsPromo
                                    price={dashboardPrice}
                                    purchasing={purchasing}
                                    onUnlock={() => (user ? setShowPurchasePopup(true) : setShowLoginPopup(true))}
                                />
                            )}

                            {(loadingQuizzes || authLoading) ? (
                                <div className="loading-state">
                                    <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                                    <p>Loading quizzes...</p>
                                </div>
                            ) : filteredQuizzes.length === 0 ? (
                                <motion.div className="empty-state glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <FiCalendar />
                                    <h3>{activeTabQuizzes.length === 0 ? (tab === 'new' ? 'No new worksheets yet' : 'No old worksheets available') : `No ${activeSubject} quizzes`}</h3>
                                    <p>{activeTabQuizzes.length === 0 ? 'Check back later for new daily quizzes!' : 'Try selecting a different subject.'}</p>
                                </motion.div>
                            ) : activeSubject === 'All' ? (
                                /* ── All: Subject → Cards ── */
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key="all-grouped"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                                    >
                                        {groupedBySubject.map(({ subj, quizzes: subjectQuizzes }, si) => (
                                            <motion.div
                                                key={subj}
                                                className="subject-section"
                                                initial={{ opacity: 0, y: 16 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: si * 0.07, duration: 0.35 }}
                                            >
                                                <div className="subject-section-header">
                                                    <span className="subject-section-title">{subj}</span>
                                                    <span className="subject-section-count">{subjectQuizzes.length}</span>
                                                </div>
                                                <motion.div className="quiz-cards" variants={stagger} initial="hidden" animate="visible">
                                                    {subjectQuizzes.map((quiz, i) => renderCard(quiz, i))}
                                                </motion.div>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                </AnimatePresence>
                            ) : (
                                /* ── Single subject: Cards ── */
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeSubject}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                                    >
                                        <motion.div className="quiz-cards" variants={stagger} initial="hidden" animate="visible" style={{ marginTop: '1rem' }}>
                                            {filteredQuizzes.map((quiz, i) => renderCard(quiz, i))}
                                        </motion.div>
                                    </motion.div>
                                </AnimatePresence>
                            )}
                        </motion.div>
                    )}

                    {tab === 'leaderboard' && (
                        <motion.div key="leaderboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                            <div className="leaderboard-card glass-card">
                                <div className="leaderboard-header">
                                    <FiTrendingUp /> <h3>Today's Leaderboard</h3>
                                </div>
                                {leaderboard.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No attempts today yet. Be the first!</p>
                                    </div>
                                ) : (
                                    <div className="leaderboard-list">
                                        {leaderboard.map((entry, i) => (
                                            <motion.div
                                                key={i}
                                                className={`leaderboard-row ${entry.user_id === user?.id ? 'is-me' : ''}`}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.08 }}
                                            >
                                                <div className="lb-rank">
                                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                                </div>
                                                <div className="lb-avatar">
                                                    {entry.profiles?.display_name?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div className="lb-info">
                                                    <span className="lb-name">{entry.profiles?.display_name || 'Anonymous'}</span>
                                                    <span className="lb-time">{Math.floor(entry.time_taken_seconds / 60)}m {entry.time_taken_seconds % 60}s</span>
                                                </div>
                                                <div className="lb-score">{entry.score}/{entry.total_questions}</div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {tab === 'profile' && (
                        <motion.div key="profile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                            {!user ? (
                                <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
                                    <FiUser style={{ fontSize: '2.5rem', opacity: 0.5, marginBottom: '1rem' }} />
                                    <h3 style={{ marginBottom: '0.5rem' }}>Sign in to view your profile</h3>
                                    <p style={{ opacity: 0.6, marginBottom: '1.5rem' }}>Track your quiz history, scores and personal stats.</p>
                                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        <Link to="/login"><motion.button className="btn-primary" whileHover={{ scale: 1.03 }}><FiLogIn /> Sign In</motion.button></Link>
                                        <Link to="/register"><motion.button className="btn-secondary" whileHover={{ scale: 1.03 }}>Create Account <FiArrowRight /></motion.button></Link>
                                    </div>
                                </div>
                            ) : (
                            <div className="profile-card glass-card">
                                <div className="profile-header-section">
                                    <div className="profile-big-avatar">
                                        {profile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                        <h3>{profile?.display_name || 'Student'}</h3>
                                        <p className="profile-email-text">{user?.email || user?.phone}</p>
                                    </div>
                                    <motion.button
                                        className={editingProfile ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                                        onClick={() => editingProfile ? handleSaveProfile() : setEditingProfile(true)}
                                        whileHover={{ scale: 1.02 }}
                                        disabled={savingProfile}
                                        style={{ marginLeft: 'auto' }}
                                    >
                                        {editingProfile ? (savingProfile ? 'Saving...' : <><FiSave /> Save</>) : <><FiEdit2 /> Edit</>}
                                    </motion.button>
                                </div>
                                {editingProfile && (
                                    <motion.div className="profile-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                        <div className="input-group">
                                            <FiUser className="input-icon" />
                                            <input
                                                type="text"
                                                placeholder="Display name"
                                                value={profileForm.display_name}
                                                onChange={e => setProfileForm(p => ({ ...p, display_name: e.target.value }))}
                                                className="auth-input"
                                            />
                                        </div>
                                        <div className="input-group">
                                            <FiCalendar className="input-icon" />
                                            <input
                                                type="tel"
                                                placeholder="Phone number"
                                                value={profileForm.phone}
                                                onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                                                className="auth-input"
                                            />
                                        </div>
                                        <button className="btn-secondary btn-sm" onClick={() => setEditingProfile(false)} style={{ marginTop: '0.5rem' }}>Cancel</button>
                                    </motion.div>
                                )}
                                <div className="profile-stats">
                                    <div className="profile-stat-item">
                                        <span className="profile-stat-value">{attempts.length}</span>
                                        <span className="profile-stat-label">Quizzes Taken</span>
                                    </div>
                                    <div className="profile-stat-item">
                                        <span className="profile-stat-value">
                                            {attempts.length > 0 ? Math.round(attempts.reduce((sum, a) => sum + (a.score / a.total_questions) * 100, 0) / attempts.length) : 0}%
                                        </span>
                                        <span className="profile-stat-label">Avg Score</span>
                                    </div>
                                    <div className="profile-stat-item">
                                        <span className="profile-stat-value">
                                            {attempts.length > 0 ? Math.max(...attempts.map(a => a.score)) : 0}
                                        </span>
                                        <span className="profile-stat-label">Best Score</span>
                                    </div>
                                </div>
                            </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {showLoginPopup && <LoginPopup onClose={() => setShowLoginPopup(false)} />}
            </AnimatePresence>

            <AnimatePresence>
                {showPurchasePopup && (
                    <PurchasePopup
                        onClose={() => setShowPurchasePopup(false)}
                        onPurchase={handlePurchaseAccess}
                        price={dashboardPrice}
                        purchasing={purchasing}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
