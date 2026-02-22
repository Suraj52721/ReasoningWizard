import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiArrowRight, FiAlertCircle } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import './Auth.css';

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } })
};

export default function Login() {
    const { signInWithEmail, signInWithGoogle, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const { error } = await signInWithEmail(email, password);
        setLoading(false);
        if (error) setError(error.message);
        else navigate('/dashboard');
    };

    const handleGoogleLogin = async () => {
        setError('');
        const { error } = await signInWithGoogle();
        if (error) setError(error.message);
    };


    return (
        <div className="auth-page page-container">
            <div className="auth-glow" />
            <motion.div className="auth-card glass-card" initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }}>
                <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
                    <h1 className="auth-title">Welcome Back</h1>
                    <p className="auth-subtitle">Sign in to continue your learning journey</p>
                </motion.div>



                <AnimatePresence>
                    {error && (
                        <motion.div className="auth-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                            <FiAlertCircle /> {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.form onSubmit={handleEmailLogin} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                    <div className="input-group">
                        <FiMail className="input-icon" />
                        <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required className="auth-input" />
                    </div>
                    <div className="input-group">
                        <FiLock className="input-icon" />
                        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="auth-input" />
                    </div>
                    <motion.button type="submit" className="btn-primary auth-submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        {loading ? 'Signing in...' : 'Sign In'} <FiArrowRight />
                    </motion.button>
                </motion.form>

                <div className="auth-divider">
                    <span>or</span>
                </div>

                <motion.button className="google-btn" onClick={handleGoogleLogin} whileHover={{ scale: 1.02, backgroundColor: 'rgba(245,197,24,0.08)' }} whileTap={{ scale: 0.98 }}>
                    <FcGoogle /> Continue with Google
                </motion.button>

                <p className="auth-footer-text">
                    Don't have an account? <Link to="/register" className="auth-link">Create one</Link>
                </p>
            </motion.div>
        </div>
    );
}
