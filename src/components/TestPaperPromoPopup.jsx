import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiX, FiArrowRight } from 'react-icons/fi';
import PaperThumbnail from './PaperThumbnail';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import './TestPaperPromoPopup.css';

// Auto (periodic) mode config — used when the popup is mounted globally with no
// `open` prop. The popup keeps coming back across the app to promote the NVR
// test papers, but is throttled so it never feels spammy.
const LAST_SHOWN_KEY = 'rw_nvr_promo_last_shown';
const FIRST_DELAY_MS = 9000;            // wait 9s after landing on a page
const REPEAT_INTERVAL_MS = 7 * 60 * 1000; // then at most once every 7 minutes
const RECHECK_MS = 60 * 1000;           // re-evaluate the throttle every minute

// Never auto-show on these (the test papers page itself, or inside a quiz —
// the post-quiz variant is triggered explicitly there instead).
const SUPPRESS_PREFIXES = ['/test-papers', '/quiz'];

const isSuppressed = (path) =>
  SUPPRESS_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));

export default function TestPaperPromoPopup({ open: controlledOpen, onClose, variant = 'default' }) {
  const isControlled = controlledOpen !== undefined;
  const location = useLocation();
  const { user } = useAuth();
  const [autoOpen, setAutoOpen] = useState(false);
  // Only promote to users who haven't bought a test paper yet. Logged-out
  // visitors count as "not purchased" (the CTA nudges them to sign up & buy).
  const [hasPurchased, setHasPurchased] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) {
      setHasPurchased(false);
      return;
    }
    supabase
      .from('paper_purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .limit(1)
      .then(({ data }) => {
        if (active) setHasPurchased((data || []).length > 0);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const open = (isControlled ? controlledOpen : autoOpen) && !hasPurchased;

  // Periodic auto-show (only when uncontrolled).
  useEffect(() => {
    if (isControlled || hasPurchased) return;
    if (isSuppressed(location.pathname)) {
      setAutoOpen(false);
      return;
    }

    const maybeShow = () => {
      const last = parseInt(localStorage.getItem(LAST_SHOWN_KEY) || '0', 10);
      if (Date.now() - last >= REPEAT_INTERVAL_MS) setAutoOpen(true);
    };

    const timer = setTimeout(maybeShow, FIRST_DELAY_MS);
    const interval = setInterval(maybeShow, RECHECK_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [location.pathname, isControlled, hasPurchased]);

  const close = () => {
    if (isControlled) {
      onClose?.();
      return;
    }
    // Stamp the dismissal so the throttle window restarts.
    localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
    setAutoOpen(false);
  };

  const isPostQuiz = variant === 'post-quiz';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="tp-promo-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            className="tp-promo-card glass-card"
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="tp-promo-close" onClick={close} aria-label="Close NVR test papers promo">
              <FiX />
            </button>
            <div className="tp-promo-thumb-wrap" aria-hidden="true">
              <PaperThumbnail
                title="11+ Non-Verbal Reasoning Test Paper"
                difficulty="Premium"
                badgeText="Premium"
              />
            </div>
            <span className="tp-promo-chip">
              {isPostQuiz ? 'Keep up the momentum' : 'Popular with 11+ students'}
            </span>
            <h3>
              {isPostQuiz
                ? 'Great effort! Ready for the real thing?'
                : 'Ace 11+ Non-Verbal Reasoning'}
            </h3>
            <p>
              {isPostQuiz
                ? 'Sharpen your skills with full-length, timed 11+ NVR test papers and detailed solutions.'
                : 'Get exam-style 11+ NVR test papers with timed practice and step-by-step solutions.'}
            </p>
            <div className="tp-promo-actions">
              <Link to="/test-papers" onClick={close}>
                <button className="btn-primary tp-promo-btn">
                  Explore NVR Test Papers <FiArrowRight />
                </button>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
