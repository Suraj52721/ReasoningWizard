import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiShield, FiCheck, FiX } from 'react-icons/fi';
import './CookieConsent.css';

const CONSENT_KEY = 'rw_cookie_consent';

export function getCookieConsent() {
    return localStorage.getItem(CONSENT_KEY) || 'none';
}

export function setCookieConsent(value) {
    localStorage.setItem(CONSENT_KEY, value);
    window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: value }));
}

export default function CookieConsent() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const existing = localStorage.getItem(CONSENT_KEY);
        if (!existing) {
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    function handleAcceptAll() {
        setCookieConsent('all');
        setVisible(false);
    }

    function handleEssentialOnly() {
        setCookieConsent('essential');
        setVisible(false);
    }

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    className="cookie-consent-overlay"
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                >
                    <div className="cookie-consent-banner glass-card">
                        <div className="cookie-icon-wrapper">
                            <FiShield />
                        </div>
                        <div className="cookie-content">
                            <h3 className="cookie-title">🍪 We value your privacy</h3>
                            <p className="cookie-text">
                                We use cookies to enhance your experience, analyze site traffic, and for marketing purposes.
                                By clicking "Accept All", you consent to our use of cookies.{' '}
                                <Link to="/privacy-policy" className="cookie-link">Privacy Policy</Link>
                            </p>
                        </div>
                        <div className="cookie-actions">
                            <motion.button
                                className="cookie-btn cookie-btn-accept"
                                onClick={handleAcceptAll}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                <FiCheck /> Accept All
                            </motion.button>
                            <motion.button
                                className="cookie-btn cookie-btn-essential"
                                onClick={handleEssentialOnly}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                <FiX /> Essential Only
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
