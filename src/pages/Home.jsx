import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { FiArrowRight, FiBookOpen, FiAward, FiTrendingUp, FiUsers, FiStar, FiCheckCircle, FiX, FiLogIn, FiClock } from 'react-icons/fi';
import { HiOutlineAcademicCap, HiOutlineLightningBolt, HiOutlineChartBar } from 'react-icons/hi';
import './Home.css';

import SEO from '../components/SEO';
import logo from '../assets/logo.png';

const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.6, delay: i * 0.15, ease: [0.4, 0, 0.2, 1] }
    })
};

const stagger = {
    visible: { transition: { staggerChildren: 0.12 } }
};

function FloatingParticles() {
    const particles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        size: Math.random() * 6 + 2,
        x: Math.random() * 100,
        y: Math.random() * 100,
        duration: Math.random() * 8 + 6,
        delay: Math.random() * 4,
    }));

    return (
        <div className="particles-container">
            {particles.map(p => (
                <motion.div
                    key={p.id}
                    className="particle"
                    style={{
                        width: p.size,
                        height: p.size,
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                    }}
                    animate={{
                        y: [-20, 20, -20],
                        opacity: [0.2, 0.6, 0.2],
                        scale: [1, 1.3, 1],
                    }}
                    transition={{
                        duration: p.duration,
                        repeat: Infinity,
                        delay: p.delay,
                        ease: 'easeInOut'
                    }}
                />
            ))}
        </div>
    );
}

function LoginPopup({ onClose, user }) {
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
                    Sign in to access daily quizzes, track your progress on leaderboards, and start mastering your exams.
                </p>
                <div className="popup-actions">
                    <Link to={user ? "/dashboard" : "/login"} onClick={onClose}>
                        <motion.button
                            className="btn-primary popup-btn"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            <FiLogIn /> {user ? 'Go to Dashboard' : 'Sign In'}
                        </motion.button>
                    </Link>
                    <Link to={user ? "/dashboard" : "/register"} onClick={onClose}>
                        <motion.button
                            className="btn-secondary popup-btn"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            {user ? 'Dashboard' : 'Create Account'} <FiArrowRight />
                        </motion.button>
                    </Link>
                </div>
                <p className="popup-footer">Free forever · No credit card required</p>
            </motion.div>
        </motion.div>
    );
}

export default function Home() {
    const { user } = useAuth();
    const [showPopup, setShowPopup] = useState(false);
    const [homeLeaderboard, setHomeLeaderboard] = useState([]);

    useEffect(() => {
        async function fetchHomeLeaderboard() {
            try {
                const { data: attempts, error: attErr } = await supabase
                    .from('quiz_attempts')
                    .select('score, total_questions, time_taken_seconds, user_id')
                    .order('score', { ascending: false })
                    .order('time_taken_seconds', { ascending: true })
                    .limit(5);

                console.log('Home LB attempts:', attempts, 'error:', attErr);
                if (attErr || !attempts?.length) { setHomeLeaderboard([]); return; }

                const userIds = [...new Set(attempts.map(a => a.user_id))];
                const { data: profilesData, error: profErr } = await supabase
                    .from('profiles')
                    .select('id, display_name')
                    .in('id', userIds);

                console.log('Home LB profiles:', profilesData, 'error:', profErr);

                const profileMap = {};
                (profilesData || []).forEach(p => { profileMap[p.id] = p; });

                setHomeLeaderboard(attempts.map(a => ({
                    ...a,
                    profiles: profileMap[a.user_id] || { display_name: 'Anonymous' }
                })));
            } catch (err) {
                console.error('Home leaderboard fetch failed:', err);
            }
        }
        fetchHomeLeaderboard();
    }, []);

    useEffect(() => {
        if (user) return;
        const dismissed = sessionStorage.getItem('rw_popup_dismissed');
        if (dismissed) return;
        const timer = setTimeout(() => setShowPopup(true), 1500);
        return () => clearTimeout(timer);
    }, [user]);

    const handleClosePopup = () => {
        setShowPopup(false);
        sessionStorage.setItem('rw_popup_dismissed', '1');
    };
    const { scrollYProgress } = useScroll();
    const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -80]);

    const features = [
        { icon: <FiBookOpen />, title: 'Daily Quizzes', desc: 'Fresh quizzes every day across Maths, VR, NVR and more. Stay sharp with timed challenges.' },
        { icon: <FiAward />, title: 'Practice Sheets', desc: 'Comprehensive worksheet packs aligned to UK curriculum. Download, print and conquer.' },
        { icon: <FiTrendingUp />, title: 'Live Leaderboards', desc: 'Compete with students across the UK. Track your rank and climb to the top daily.' },
        { icon: <FiUsers />, title: 'Expert Tutoring', desc: 'Learn from experienced educators with personalised guidance and feedback.' },
    ];

    const steps = [
        { num: '01', icon: <HiOutlineAcademicCap />, title: 'Sign Up Free', desc: 'Create your account in seconds with email, Google or phone.' },
        { num: '02', icon: <HiOutlineLightningBolt />, title: 'Take Quizzes', desc: 'Attempt daily quizzes with a timer. Test your knowledge.' },
        { num: '03', icon: <HiOutlineChartBar />, title: 'Track Progress', desc: 'See your scores, leaderboard rank and areas to improve.' },
    ];

    const testimonials = [
        { name: 'Emily R.', role: 'Year 10 Student', text: 'ReasoningWizard has completely transformed how I prepare for exams. The daily quizzes keep me consistent!', stars: 5 },
        { name: 'James T.', role: 'Year 8 Student', text: 'I love competing on the leaderboard. It motivates me to do better every single day.', stars: 5 },
        { name: 'Sarah K.', role: 'Parent', text: 'Finally a platform that makes learning fun for my children. The practice sheets are excellent quality.', stars: 5 },
    ];

    const stats = [
        { value: '50K+', label: 'Students' },
        { value: '1,200+', label: 'Quizzes' },
        { value: '98%', label: 'Satisfaction' },
        { value: '500+', label: 'Sheets' },
    ];

    return (
        <div className="home-page">
            <SEO
                title="Home - UK's #1 Learning Platform"
                description="Master 11+, SATs, and GCSEs with daily quizzes, practice sheets, and live leaderboards. Join 50,000+ UK students today."
            />
            {/* Hero */}
            <section className="hero-section">
                <FloatingParticles />
                <div className="hero-glow" />
                <motion.div className="hero-content" style={{ y: heroY }}>
                    <motion.div className="hero-badge" variants={fadeUp} initial="hidden" animate="visible" custom={0}>
                        <FiStar /> Trusted by 50,000+ UK Students
                    </motion.div>
                    <motion.h1 className="hero-title" variants={fadeUp} initial="hidden" animate="visible" custom={1}>
                        Learn Smarter,<br /> Faster and Better with <br /> <span className="text-gradient">Reasoning Wizard</span> ✦
                    </motion.h1>
                    <motion.p className="hero-subtitle" variants={fadeUp} initial="hidden" animate="visible" custom={2}>
                        UK's #1 tutoring & practice sheets academy. Daily quizzes, expert worksheets
                        and live leaderboards — everything you need to ace your exams.
                    </motion.p>
                    <motion.div className="hero-ctas" variants={fadeUp} initial="hidden" animate="visible" custom={3}>
                        <Link to={user ? "/dashboard" : "/register"}>
                            <motion.button className="btn-primary btn-lg" whileHover={{ scale: 1.04, boxShadow: '0 0 40px rgba(245,197,24,0.4)' }} whileTap={{ scale: 0.96 }}>
                                {user ? 'Go to Dashboard' : 'Start Free 11+ Practice'} <FiArrowRight />
                            </motion.button>
                        </Link>
                        <Link to={user ? "/dashboard" : "/login"}>
                            <motion.button className="btn-secondary btn-lg" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                                {user ? 'Dashboard' : 'Sign In'}
                            </motion.button>
                        </Link>
                    </motion.div>

                    {/* Stats Bar */}
                    <motion.div className="hero-stats" variants={stagger} initial="hidden" animate="visible">
                        {stats.map((s, i) => (
                            <motion.div key={i} className="stat-item" variants={fadeUp} custom={4 + i * 0.3}>
                                <span className="stat-value">{s.value}</span>
                                <span className="stat-label">{s.label}</span>
                            </motion.div>
                        ))}
                    </motion.div>
                </motion.div>
            </section>

            {/* Features */}
            <section className="features-section">
                <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
                    <h2 className="section-title">Everything You Need to Excel</h2>
                    <p className="section-subtitle">Comprehensive tools designed specifically for UK students preparing for 11+, SATs, GCSEs and more.</p>
                </motion.div>
                <motion.div className="features-grid" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}>
                    {features.map((f, i) => (
                        <motion.div key={i} className="feature-card glass-card" variants={fadeUp} custom={i} whileHover={{ y: -8, borderColor: 'rgba(245,197,24,0.3)' }}>
                            <div className="feature-icon">{f.icon}</div>
                            <h3>{f.title}</h3>
                            <p>{f.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* How It Works */}
            <section className="steps-section">
                <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
                    <h2 className="section-title">How It Works</h2>
                    <p className="section-subtitle">Get started in 3 simple steps and begin your journey to exam success.</p>
                </motion.div>
                <motion.div className="steps-grid" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}>
                    {steps.map((s, i) => (
                        <motion.div key={i} className="step-card" variants={fadeUp} custom={i}>
                            <div className="step-num">{s.num}</div>
                            <div className="step-icon">{s.icon}</div>
                            <h3>{s.title}</h3>
                            <p>{s.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* Testimonials */}
            <section className="testimonials-section">
                <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
                    <h2 className="section-title">Loved by Students & Parents</h2>
                    <p className="section-subtitle">See what our community has to say about ReasoningWizard.</p>
                </motion.div>
                <motion.div className="testimonials-grid" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}>
                    {testimonials.map((t, i) => (
                        <motion.div key={i} className="testimonial-card glass-card" variants={fadeUp} custom={i} whileHover={{ y: -6 }}>
                            <div className="testimonial-stars">
                                {Array.from({ length: t.stars }).map((_, j) => <FiStar key={j} />)}
                            </div>
                            <p className="testimonial-text">"{t.text}"</p>
                            <div className="testimonial-author">
                                <div className="testimonial-avatar">{t.name[0]}</div>
                                <div>
                                    <div className="testimonial-name">{t.name}</div>
                                    <div className="testimonial-role">{t.role}</div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* Today's Leaderboard */}
            <section className="home-leaderboard-section">
                <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
                    <h2 className="section-title">Top <span className="text-gradient">Scorers</span> 🏆</h2>
                    <p className="section-subtitle">See who's leading the quiz challenges.</p>
                </motion.div>
                {homeLeaderboard.length === 0 ? (
                    <motion.div className="home-lb-empty glass-card" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                        <FiTrendingUp />
                        <p>No attempts today yet. Be the first to make it on the board!</p>
                        <Link to={user ? '/dashboard' : '/login'}>
                            <motion.button className="btn-primary" whileHover={{ scale: 1.03 }}>
                                Take a Quiz <FiArrowRight />
                            </motion.button>
                        </Link>
                    </motion.div>
                ) : (
                    <div className="home-lb-list">
                        {homeLeaderboard.map((entry, i) => (
                            <motion.div
                                key={i}
                                className="home-lb-row glass-card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1, duration: 0.4 }}
                            >
                                <div className="home-lb-rank">
                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                </div>
                                <div className="home-lb-avatar">
                                    {entry.profiles?.display_name?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div className="home-lb-info">
                                    <span className="home-lb-name">{entry.profiles?.display_name || 'Anonymous'}</span>
                                    <span className="home-lb-time"><FiClock /> {Math.floor(entry.time_taken_seconds / 60)}m {entry.time_taken_seconds % 60}s</span>
                                </div>
                                <div className="home-lb-score">{entry.score}/{entry.total_questions}</div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </section>

            {/* CTA */}
            <section className="cta-section">
                <motion.div className="cta-card" initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                    <div className="cta-glow" />
                    <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                        <FiCheckCircle className="cta-icon" />
                        <h2>Ready to Become a Reasoning Wizard?</h2>
                        <p>Join thousands of UK students who are mastering their exams with daily quizzes and expert resources.</p>
                        <Link to={user ? "/dashboard" : "/register"}>
                            <motion.button className="btn-primary btn-lg" whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(245,197,24,0.4)' }} whileTap={{ scale: 0.95 }}>
                                {user ? 'Go to Dashboard' : "Get Started — It's Free"} <FiArrowRight />
                            </motion.button>
                        </Link>
                    </motion.div>
                </motion.div>
            </section>

            {/* Login Popup */}
            <AnimatePresence>
                {showPopup && <LoginPopup onClose={handleClosePopup} user={user} />}
            </AnimatePresence>
        </div>
    );
}
