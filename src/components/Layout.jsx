import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function Layout({ children }) {
    const location = useLocation();
    const [quizFocus, setQuizFocus] = useState(false);

    useEffect(() => {
        const check = () => setQuizFocus(document.body.classList.contains('quiz-focus'));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

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
        </>
    );
}
