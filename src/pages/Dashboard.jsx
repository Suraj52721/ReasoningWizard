import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { FiCalendar, FiClock, FiPlay, FiUser, FiEdit2, FiSave, FiTrendingUp, FiAward, FiCheckCircle, FiBook, FiRefreshCw } from 'react-icons/fi';
import './Dashboard.css';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } })
};

const stagger = {
    visible: { transition: { staggerChildren: 0.08 } }
};

export default function Dashboard() {
    const { user, profile, updateProfile } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState('quizzes');
    const [quizzes, setQuizzes] = useState([]);
    const [attempts, setAttempts] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loadingQuizzes, setLoadingQuizzes] = useState(true);
    const [editingProfile, setEditingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({ display_name: '', phone: '' });
    const [savingProfile, setSavingProfile] = useState(false);

    useEffect(() => {
        fetchQuizzes();
        fetchLeaderboard();
    }, []);

    useEffect(() => {
        if (profile) {
            setProfileForm({ display_name: profile.display_name || '', phone: profile.phone || '' });
        }
    }, [profile]);

    async function fetchQuizzes() {
        setLoadingQuizzes(true);
        const { data: quizzesData } = await supabase
            .from('quizzes')
            .select('*')
            .neq('is_draft', true)
            .order('quiz_date', { ascending: false });

        const { data: attemptsData } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', user.id);

        const { data: sessionsData } = await supabase
            .from('quiz_sessions')
            .select('*')
            .eq('user_id', user.id);

        setQuizzes(quizzesData || []);
        setAttempts(attemptsData || []);
        setSessions(sessionsData || []);
        setLoadingQuizzes(false);
    }

    async function fetchLeaderboard() {
        const today = new Date().toISOString().split('T')[0];
        const { data: attempts } = await supabase
            .from('quiz_attempts')
            .select('score, total_questions, time_taken_seconds, completed_at, user_id')
            .gte('completed_at', today + 'T00:00:00')
            .order('score', { ascending: false })
            .order('time_taken_seconds', { ascending: true })
            .limit(10);

        if (!attempts?.length) { setLeaderboard([]); return; }

        const userIds = [...new Set(attempts.map(a => a.user_id))];
        const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', userIds);

        const profileMap = {};
        (profilesData || []).forEach(p => { profileMap[p.id] = p; });

        setLeaderboard(attempts.map(a => ({
            ...a,
            profiles: profileMap[a.user_id] || { display_name: 'Anonymous', avatar_url: '' }
        })));
    }

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        await updateProfile(profileForm);
        setSavingProfile(false);
        setEditingProfile(false);
    };

    const groupedQuizzes = quizzes.reduce((acc, quiz) => {
        const date = quiz.quiz_date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(quiz);
        return acc;
    }, {});

    const getAttempt = (quizId) => attempts.find(a => a.quiz_id === quizId);
    const getSession = (quizId) => sessions.find(s => s.quiz_id === quizId);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (dateStr === today.toISOString().split('T')[0]) return '📅 Today';
        if (dateStr === tomorrow.toISOString().split('T')[0]) return '📅 Tomorrow';
        return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    const tabs = [
        { id: 'quizzes', label: 'Daily Quizzes', icon: <FiBook /> },
        { id: 'leaderboard', label: 'Leaderboard', icon: <FiTrendingUp /> },
        { id: 'profile', label: 'Profile', icon: <FiUser /> },
    ];

    return (
        <div className="dashboard-page page-container">
            <div className="dashboard-inner">
                {/* Header */}
                <motion.div className="dash-header" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <div>
                        <h1 className="dash-title">Welcome back, <span className="text-gradient">{profile?.display_name || 'Student'}</span> 👋</h1>
                        <p className="dash-subtitle">Ready to challenge yourself today?</p>
                    </div>
                </motion.div>

                {/* Tabs */}
                <motion.div className="dash-tabs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            className={`dash-tab ${tab === t.id ? 'active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.icon} {t.label}
                            {tab === t.id && <motion.div className="tab-indicator" layoutId="dashTab" />}
                        </button>
                    ))}
                </motion.div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {tab === 'quizzes' && (
                        <motion.div key="quizzes" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                            {loadingQuizzes ? (
                                <div className="loading-state">
                                    <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                                    <p>Loading quizzes...</p>
                                </div>
                            ) : Object.keys(groupedQuizzes).length === 0 ? (
                                <div className="empty-state glass-card">
                                    <FiCalendar />
                                    <h3>No quizzes available</h3>
                                    <p>Check back later for new daily quizzes!</p>
                                </div>
                            ) : (
                                Object.entries(groupedQuizzes).map(([date, dateQuizzes]) => (
                                    <div key={date} className="quiz-date-group">
                                        <h3 className="date-heading">{formatDate(date)}</h3>
                                        <motion.div className="quiz-cards" variants={stagger} initial="hidden" animate="visible">
                                            {dateQuizzes.map((quiz, i) => {
                                                const attempt = getAttempt(quiz.id);
                                                const session = getSession(quiz.id);
                                                return (
                                                    <motion.div key={quiz.id} className={`quiz-card glass-card ${attempt ? 'completed' : ''}`} variants={fadeUp} custom={i} whileHover={{ y: -4, borderColor: 'rgba(245,197,24,0.3)' }}>
                                                        <div className="quiz-card-header">
                                                            <div className="quiz-subject-badge">{quiz.subject}</div>
                                                            {attempt && <div className="completed-badge"><FiCheckCircle /> Done</div>}
                                                        </div>
                                                        <h4 className="quiz-card-title">{quiz.title}</h4>
                                                        <div className="quiz-card-meta">
                                                            <span><FiClock /> {quiz.duration_minutes} min</span>
                                                            {attempt && <span><FiAward /> {attempt.score}/{attempt.total_questions}</span>}
                                                        </div>
                                                        {attempt ? (
                                                            <div className="quiz-card-actions">
                                                                <Link to={`/quiz/${quiz.id}`}>
                                                                    <motion.button className="btn-secondary quiz-btn" whileHover={{ scale: 1.02 }}>
                                                                        View Results
                                                                    </motion.button>
                                                                </Link>
                                                                <motion.button
                                                                    className="btn-primary quiz-btn reattempt-dashboard-btn"
                                                                    whileHover={{ scale: 1.02 }}
                                                                    onClick={async () => {
                                                                        await supabase.from('quiz_attempts').delete().eq('id', attempt.id);
                                                                        navigate(`/quiz/${quiz.id}?reattempt=true`);
                                                                    }}
                                                                >
                                                                    <FiRefreshCw /> Re-attempt
                                                                </motion.button>
                                                            </div>
                                                        ) : (
                                                            <Link to={`/quiz/${quiz.id}`}>
                                                                <motion.button className="btn-primary quiz-btn" whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(245,197,24,0.3)' }}>
                                                                    <FiPlay /> {session ? 'Resume Quiz' : 'Start Quiz'}
                                                                </motion.button>
                                                            </Link>
                                                        )}
                                                    </motion.div>
                                                );
                                            })}
                                        </motion.div>
                                    </div>
                                ))
                            )}
                        </motion.div>
                    )}

                    {tab === 'leaderboard' && (
                        <motion.div key="leaderboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                            <div className="leaderboard-card glass-card">
                                <div className="leaderboard-header">
                                    <FiTrendingUp /> <h3>Today's Leaderboard</h3>
                                </div>
                                {leaderboard.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No attempts today yet. Be the first!</p>
                                    </div>
                                ) : (
                                    <div className="leaderboard-list">
                                        {leaderboard.map((entry, i) => (
                                            <motion.div
                                                key={i}
                                                className={`leaderboard-row ${entry.user_id === user.id ? 'is-me' : ''}`}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.08 }}
                                            >
                                                <div className="lb-rank">
                                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                                </div>
                                                <div className="lb-avatar">
                                                    {entry.profiles?.display_name?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div className="lb-info">
                                                    <span className="lb-name">{entry.profiles?.display_name || 'Anonymous'}</span>
                                                    <span className="lb-time">{Math.floor(entry.time_taken_seconds / 60)}m {entry.time_taken_seconds % 60}s</span>
                                                </div>
                                                <div className="lb-score">{entry.score}/{entry.total_questions}</div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {tab === 'profile' && (
                        <motion.div key="profile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                            <div className="profile-card glass-card">
                                <div className="profile-header-section">
                                    <div className="profile-big-avatar">
                                        {profile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                        <h3>{profile?.display_name || 'Student'}</h3>
                                        <p className="profile-email-text">{user?.email || user?.phone}</p>
                                    </div>
                                    <motion.button
                                        className={editingProfile ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                                        onClick={() => editingProfile ? handleSaveProfile() : setEditingProfile(true)}
                                        whileHover={{ scale: 1.02 }}
                                        disabled={savingProfile}
                                        style={{ marginLeft: 'auto' }}
                                    >
                                        {editingProfile ? (savingProfile ? 'Saving...' : <><FiSave /> Save</>) : <><FiEdit2 /> Edit</>}
                                    </motion.button>
                                </div>
                                {editingProfile && (
                                    <motion.div className="profile-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                        <div className="input-group">
                                            <FiUser className="input-icon" />
                                            <input
                                                type="text"
                                                placeholder="Display name"
                                                value={profileForm.display_name}
                                                onChange={e => setProfileForm(p => ({ ...p, display_name: e.target.value }))}
                                                className="auth-input"
                                            />
                                        </div>
                                        <div className="input-group">
                                            <FiCalendar className="input-icon" />
                                            <input
                                                type="tel"
                                                placeholder="Phone number"
                                                value={profileForm.phone}
                                                onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                                                className="auth-input"
                                            />
                                        </div>
                                        <button className="btn-secondary btn-sm" onClick={() => setEditingProfile(false)} style={{ marginTop: '0.5rem' }}>Cancel</button>
                                    </motion.div>
                                )}
                                <div className="profile-stats">
                                    <div className="profile-stat-item">
                                        <span className="profile-stat-value">{attempts.length}</span>
                                        <span className="profile-stat-label">Quizzes Taken</span>
                                    </div>
                                    <div className="profile-stat-item">
                                        <span className="profile-stat-value">
                                            {attempts.length > 0 ? Math.round(attempts.reduce((sum, a) => sum + (a.score / a.total_questions) * 100, 0) / attempts.length) : 0}%
                                        </span>
                                        <span className="profile-stat-label">Avg Score</span>
                                    </div>
                                    <div className="profile-stat-item">
                                        <span className="profile-stat-value">
                                            {attempts.length > 0 ? Math.max(...attempts.map(a => a.score)) : 0}
                                        </span>
                                        <span className="profile-stat-label">Best Score</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
