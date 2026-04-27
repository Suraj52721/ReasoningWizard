import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import CookieConsent from './CookieConsent';
import ChatWidget from './ChatWidget';
import AbandonedCartPopup from './AbandonedCartPopup';
import { useAuth } from '../context/AuthContext';
import { trackVisit, resetTrackingFlag } from '../utils/visitorTracker';

export default function Layout({ children }) {
    const location = useLocation();
    const [quizFocus, setQuizFocus] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        const check = () => setQuizFocus(document.body.classList.contains('quiz-focus'));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // Track visitor on first load and on cookie consent change
    useEffect(() => {
        trackVisit(user);

        function handleConsentChange() {
            resetTrackingFlag();
            trackVisit(user);
        }

        window.addEventListener('cookieConsentChanged', handleConsentChange);
        return () => window.removeEventListener('cookieConsentChanged', handleConsentChange);
    }, [user]);

    return (
        <>
            {!quizFocus && <Navbar />}
            <AnimatePresence mode="wait">
                <motion.main
                    key={location.pathname}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                >
                    {children}
                </motion.main>
            </AnimatePresence>
            {!quizFocus && <Footer />}
            <CookieConsent />

            {/* Floating Chat Widget */}
            {!quizFocus && <ChatWidget />}
            {!quizFocus && <AbandonedCartPopup />}
        </>
    );
}
