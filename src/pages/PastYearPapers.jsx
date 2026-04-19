import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { FiDownload, FiFileText, FiFilter, FiSearch, FiChevronDown } from 'react-icons/fi';
import SEO from '../components/SEO';
import logo from '../assets/logo.png';
import PaperThumbnail, { DIFFICULTY_CONFIG } from '../components/PaperThumbnail';
import './PastYearPapers.css';

const SUBJECTS = ['All', '11+ Mathematics', 'English'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } })
};


function LoginPopup({ onClose }) {
    return (
        <motion.div
            className="pyp-login-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="pyp-login-modal glass-card"
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                onClick={e => e.stopPropagation()}
            >
                <h3>Sign in to access papers</h3>
                <p>Please sign in or create an account to download past papers.</p>
                <div className="pyp-login-actions">
                    <Link to="/login" onClick={onClose}>
                        <button className="btn-primary">Sign In</button>
                    </Link>
                    <Link to="/register" onClick={onClose}>
                        <button className="btn-secondary">Create Account</button>
                    </Link>
                </div>
            </motion.div>
        </motion.div>
    );
}

export default function PastYearPapers() {
    const { user } = useAuth();
    const [papers, setPapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('All');
    const [showLoginPopup, setShowLoginPopup] = useState(false);

    const easyRef = useRef(null);
    const mediumRef = useRef(null);
    const hardRef = useRef(null);
    const sectionRefs = { Easy: easyRef, Medium: mediumRef, Hard: hardRef };

    useEffect(() => {
        fetchPapers();
    }, []);

    async function fetchPapers() {
        setLoading(true);
        const { data } = await supabase
            .from('past_papers')
            .select('*')
            .order('year', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });
        setPapers(data || []);
        setLoading(false);
    }

    function scrollToSection(difficulty) {
        sectionRefs[difficulty]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function handlePaperAccess(e, paperId) {
        if (user) {
            supabase.from('download_logs').insert({ resource_type: 'past_paper', resource_id: paperId });
            return;
        }

        e.preventDefault();
        setShowLoginPopup(true);
    }

    const filtered = papers.filter(p => {
        const matchesSubject = selectedSubject === 'All' || p.subject === selectedSubject;
        const matchesSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || String(p.year || '').includes(search);
        return matchesSubject && matchesSearch;
    });

    const grouped = DIFFICULTIES.reduce((acc, d) => {
        acc[d] = filtered.filter(p => p.difficulty === d);
        return acc;
    }, {});

    const totalCount = filtered.length;

    return (
        <>
            <SEO
                title="11+ Past Year Papers | ReasoningWizard"
                description="Download free 11+ past year papers for exam preparation. Browse Easy, Medium, and Hard difficulty papers by subject."
            />
            <div className="pyp-page page-container">
                <AnimatePresence>
                    {showLoginPopup && <LoginPopup onClose={() => setShowLoginPopup(false)} />}
                </AnimatePresence>

                {/* Hero */}
                <motion.div
                    className="pyp-hero"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="pyp-title">11+ Past Year <span className="text-gradient">Papers</span></h1>
                    <p className="pyp-subtitle">
                        Practise with real exam papers. Choose your difficulty and download instantly.
                    </p>

                    {/* Quick jump buttons */}
                    <div className="pyp-jump-btns">
                        {DIFFICULTIES.map(d => {
                            const cfg = DIFFICULTY_CONFIG[d];
                            return (
                                <motion.button
                                    key={d}
                                    className="pyp-jump-btn"
                                    style={{ '--diff-color': cfg.color, '--diff-bg': cfg.bg, '--diff-border': cfg.border }}
                                    onClick={() => scrollToSection(d)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {d}
                                    <span className="jump-count">{grouped[d]?.length ?? 0}</span>
                                    <FiChevronDown />
                                </motion.button>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Filters */}
                <motion.div
                    className="pyp-filters glass-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                >
                    <div className="pyp-search-wrap">
                        <FiSearch className="search-icon" />
                        <input
                            className="pyp-search"
                            placeholder="Search by title or year…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="pyp-subject-wrap">
                        <FiFilter className="filter-icon" />
                        <select
                            className="pyp-subject-select"
                            value={selectedSubject}
                            onChange={e => setSelectedSubject(e.target.value)}
                        >
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    {totalCount > 0 && (
                        <span className="pyp-count">{totalCount} paper{totalCount !== 1 ? 's' : ''}</span>
                    )}
                </motion.div>

                {loading ? (
                    <div className="loading-state">
                        <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                        <p>Loading papers…</p>
                    </div>
                ) : totalCount === 0 ? (
                    <motion.div className="pyp-empty glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <FiFileText className="empty-icon" />
                        <h3>No papers found</h3>
                        <p>{search || selectedSubject !== 'All' ? 'Try adjusting your filters.' : 'Papers will appear here once uploaded.'}</p>
                    </motion.div>
                ) : (
                    <div className="pyp-sections">
                        {DIFFICULTIES.map((difficulty, si) => {
                            const list = grouped[difficulty];
                            if (list.length === 0) return null;
                            const cfg = DIFFICULTY_CONFIG[difficulty];
                            return (
                                <motion.section
                                    key={difficulty}
                                    ref={sectionRefs[difficulty]}
                                    className="pyp-section"
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: si * 0.12 }}
                                >
                                    {/* Section header */}
                                    <div
                                        className="pyp-section-header"
                                        style={{ '--diff-color': cfg.color, '--diff-bg': cfg.bg, '--diff-border': cfg.border }}
                                    >
                                        <span className="diff-dot" />
                                        <h2 className="pyp-section-title">{difficulty}</h2>
                                        <span className="section-badge">{list.length}</span>
                                    </div>

                                    {/* Cards grid */}
                                    <div className="paper-grid">
                                        <AnimatePresence>
                                            {list.map((paper, i) => (
                                                <motion.div
                                                    key={paper.id}
                                                    className="paper-card glass-card"
                                                    custom={i}
                                                    variants={fadeUp}
                                                    initial="hidden"
                                                    animate="visible"
                                                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                                                    onClick={() => { if (!user) setShowLoginPopup(true); }}
                                                >
                                                    {/* Thumbnail */}
                                                    <PaperThumbnail title={paper.title} difficulty={difficulty} />

                                                    {/* Info below thumbnail */}
                                                    <div className="paper-card-info">
                                                        <p className="paper-card-title">{paper.title}</p>
                                                        <div className="paper-card-meta">
                                                            <span className="paper-meta-badge subject-badge">{paper.subject}</span>
                                                            {paper.year && <span className="paper-meta-badge paper-year-badge">{paper.year}</span>}
                                                            <span
                                                                className="paper-meta-badge paper-diff-badge"
                                                                style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
                                                            >
                                                                {difficulty}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <a
                                                        href={paper.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        download
                                                        className="pyp-download-btn"
                                                        style={{ '--diff-color': cfg.color }}
                                                        onClick={(e) => handlePaperAccess(e, paper.id)}
                                                    >
                                                        <FiDownload /> Download
                                                    </a>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </motion.section>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
