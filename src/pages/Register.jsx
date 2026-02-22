import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiUser, FiArrowRight, FiAlertCircle } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import './Auth.css';

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } })
};

export default function Register() {
    const { signUpWithEmail, signInWithGoogle, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        setLoading(true);
        const { error } = await signUpWithEmail(email, password, name);
        setLoading(false);
        if (error) {
            setError(error.message);
        } else {
            setSuccess(true);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        const { error } = await signInWithGoogle();
        if (error) setError(error.message);
    };

    if (success) {
        return (
            <div className="auth-page page-container">
                <div className="auth-glow" />
                <motion.div className="auth-card glass-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                    <div className="success-check">✓</div>
                    <h2 className="auth-title">Account Created!</h2>
                    <p className="auth-subtitle">Check your email to verify your account, then sign in.</p>
                    <Link to="/login">
                        <motion.button className="btn-primary auth-submit" whileHover={{ scale: 1.02 }}>
                            Go to Sign In <FiArrowRight />
                        </motion.button>
                    </Link>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="auth-page page-container">
            <div className="auth-glow" />
            <motion.div className="auth-card glass-card" initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }}>
                <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
                    <h1 className="auth-title">Create Account</h1>
                    <p className="auth-subtitle">Join thousands of UK students on ReasoningWizard</p>
                </motion.div>

                <AnimatePresence>
                    {error && (
                        <motion.div className="auth-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                            <FiAlertCircle /> {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleRegister}>
                    <div className="input-group">
                        <FiUser className="input-icon" />
                        <input type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required className="auth-input" />
                    </div>
                    <div className="input-group">
                        <FiMail className="input-icon" />
                        <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required className="auth-input" />
                    </div>
                    <div className="input-group">
                        <FiLock className="input-icon" />
                        <input type="password" placeholder="Password (min 6 characters)" value={password} onChange={e => setPassword(e.target.value)} required className="auth-input" />
                    </div>
                    <div className="input-group">
                        <FiLock className="input-icon" />
                        <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="auth-input" />
                    </div>
                    <motion.button type="submit" className="btn-primary auth-submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        {loading ? 'Creating Account...' : 'Create Account'} <FiArrowRight />
                    </motion.button>
                </form>

                <div className="auth-divider">
                    <span>or</span>
                </div>

                <motion.button className="google-btn" onClick={handleGoogleLogin} whileHover={{ scale: 1.02, backgroundColor: 'rgba(245,197,24,0.08)' }} whileTap={{ scale: 0.98 }}>
                    <FcGoogle /> Continue with Google
                </motion.button>

                <p className="auth-footer-text">
                    Already have an account? <Link to="/login" className="auth-link">Sign In</Link>
                </p>
            </motion.div>
        </div>
    );
}
