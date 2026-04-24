import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiX, FiArrowRight } from 'react-icons/fi';
import PaperThumbnail from './PaperThumbnail';
import './TestPaperPromoPopup.css';

const PROMO_PATHS = new Set(['/home', '/dashboard', '/questions', '/past-papers']);

export default function TestPaperPromoPopup() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const shouldShowPath = PROMO_PATHS.has(location.pathname);
    if (!shouldShowPath) {
      setOpen(false);
      return;
    }

    const dismissed = sessionStorage.getItem('rw_testpapers_promo_dismissed');
    if (dismissed) {
      setOpen(false);
      return;
    }

    const timer = setTimeout(() => setOpen(true), 2200);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const close = () => {
    setOpen(false);
    sessionStorage.setItem('rw_testpapers_promo_dismissed', '1');
  };

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
            <button className="tp-promo-close" onClick={close} aria-label="Close test papers promo">
              <FiX />
            </button>
            <div className="tp-promo-thumb-wrap" aria-hidden="true">
              <PaperThumbnail
                title="11+ Mixed Reasoning Test Paper 04"
                difficulty="Premium"
                badgeText="Premium"
              />
            </div>
            <span className="tp-promo-chip">Popular with 11+ students</span>
            <h3>Boost scores with Premium Test Papers</h3>
            <p>Get full-length timed papers, detailed solutions, and realistic exam practice in one place.</p>
            <div className="tp-promo-actions">
              <Link to="/test-papers" onClick={close}>
                <button className="btn-primary tp-promo-btn">
                  Explore Test Papers <FiArrowRight />
                </button>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
