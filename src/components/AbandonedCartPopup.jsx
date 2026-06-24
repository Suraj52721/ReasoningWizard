import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiShoppingCart, FiArrowRight, FiX } from 'react-icons/fi';
import './AbandonedCartPopup.css';

const CART_STORAGE_KEY = 'rw_test_papers_cart';
const CHECK_INTERVAL_MS = 45000;

function getCartCount() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export default function AbandonedCartPopup() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const shouldSuppress = useMemo(() => {
    return location.pathname === '/test-papers' || location.pathname.startsWith('/quiz/');
  }, [location.pathname]);

  useEffect(() => {
    function refreshState() {
      const count = getCartCount();
      setCartCount(count);

      if (shouldSuppress || count === 0) {
        setVisible(false);
        return;
      }

      setVisible(true);
    }

    refreshState();

    const interval = setInterval(refreshState, CHECK_INTERVAL_MS);
    const onStorage = (e) => {
      if (e.key === CART_STORAGE_KEY) refreshState();
    };

    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }, [shouldSuppress]);

  if (cartCount === 0) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="cart-reminder-shell"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
        >
          <div className="cart-reminder-card glass-card">
            <button className="cart-reminder-close" onClick={() => setVisible(false)} aria-label="Dismiss cart reminder">
              <FiX />
            </button>
            <div className="cart-reminder-icon">
              <FiShoppingCart />
            </div>
            <div className="cart-reminder-copy">
              <h4>Complete your purchase</h4>
              <p>
                You still have {cartCount} item{cartCount > 1 ? 's' : ''} waiting in your Test Papers cart.
              </p>
            </div>
            <Link to="/test-papers" className="cart-reminder-link" onClick={() => setVisible(false)}>
              <button className="btn-primary cart-reminder-btn">
                Proceed to Payment <FiArrowRight />
              </button>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
