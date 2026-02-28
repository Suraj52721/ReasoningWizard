import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { HiMenu, HiX } from 'react-icons/hi';
import { FiLogOut, FiUser, FiGrid, FiSun, FiMoon } from 'react-icons/fi';
import './Navbar.css';

import logo from '../assets/logo.png';

export default function Navbar() {
    const { user, profile, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    useEffect(() => {
        const handle = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handle);
        return () => window.removeEventListener('scroll', handle);
    }, []);

    useEffect(() => {
        setMobileOpen(false);
        setProfileOpen(false);
    }, [location]);

    const handleSignOut = async () => {
        await signOut();
        navigate('/');
    };

    const navLinks = [
        { to: '/', label: 'Home' },
        { to: '/about', label: 'About' },
        { to: '/contact', label: 'Contact' },
        ...(user ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
        ...(profile?.is_admin ? [{ to: '/admin', label: 'Admin' }] : []),
    ];

    return (
        <motion.nav
            className={`navbar ${scrolled ? 'scrolled' : ''}`}
            initial={{ y: -80 }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        >
            <div className="navbar-inner">
                <Link to="/" className="navbar-logo">
                    <motion.img
                        src={logo}
                        alt="ReasoningWizard"
                        className="logo-img"
                        whileHover={{ rotate: 5, scale: 1.1 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                    />
                    <span className="logo-text">Reasoning<span className="logo-highlight">Wizard</span></span>
                </Link>

                <div className="nav-links-desktop">
                    {navLinks.map(link => (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}
                        >
                            {link.label}
                            {location.pathname === link.to && (
                                <motion.div className="nav-underline" layoutId="navUnderline" />
                            )}
                        </Link>
                    ))}
                </div>

                <div className="nav-actions">
                    {/* Theme Toggle */}
                    <motion.button
                        className="theme-toggle-btn"
                        onClick={toggleTheme}
                        whileTap={{ scale: 0.85 }}
                        title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                    >
                        <AnimatePresence mode="wait">
                            {theme === 'light' ? (
                                <motion.span
                                    key="moon"
                                    className="theme-icon"
                                    initial={{ rotate: -90, scale: 0, opacity: 0 }}
                                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                                    exit={{ rotate: 90, scale: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <FiMoon />
                                </motion.span>
                            ) : (
                                <motion.span
                                    key="sun"
                                    className="theme-icon"
                                    initial={{ rotate: 90, scale: 0, opacity: 0 }}
                                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                                    exit={{ rotate: -90, scale: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <FiSun />
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>

                    {user ? (
                        <div className="profile-menu-wrap">
                            <motion.button
                                className="profile-btn"
                                onClick={() => setProfileOpen(!profileOpen)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <div className="profile-avatar">
                                    {user.email?.[0]?.toUpperCase() || 'U'}
                                </div>
                            </motion.button>
                            <AnimatePresence>
                                {profileOpen && (
                                    <motion.div
                                        className="profile-dropdown glass-card"
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <div className="profile-info">
                                            <span className="profile-email">{user.email || user.phone}</span>
                                        </div>
                                        <Link to="/dashboard" className="dropdown-item">
                                            <FiGrid /> Dashboard
                                        </Link>
                                        <button onClick={handleSignOut} className="dropdown-item logout">
                                            <FiLogOut /> Sign Out
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <div className="auth-btns">
                            <Link to="/login">
                                <motion.button className="btn-secondary btn-sm" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                                    Sign In
                                </motion.button>
                            </Link>
                            <Link to="/register">
                                <motion.button className="btn-primary btn-sm" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                                    Get Started
                                </motion.button>
                            </Link>
                        </div>
                    )}

                    <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
                        {mobileOpen ? <HiX /> : <HiMenu />}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        className="mobile-menu glass-card"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {navLinks.map(link => (
                            <Link key={link.to} to={link.to} className="mobile-link">
                                {link.label}
                            </Link>
                        ))}
                        {!user ? (
                            <>
                                <Link to="/login" className="mobile-link">Sign In</Link>
                                <Link to="/register" className="mobile-link highlight">Get Started</Link>
                            </>
                        ) : (
                            <button onClick={handleSignOut} className="mobile-link logout">Sign Out</button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.nav>
    );
}
