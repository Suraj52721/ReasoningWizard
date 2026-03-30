import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { FiDownload, FiFileText, FiFilter, FiSearch, FiChevronDown } from 'react-icons/fi';
import SEO from '../components/SEO';
import './PastYearPapers.css';

const SUBJECTS = ['All', '11+ Mathematics', 'Science', 'English', 'History', 'Geography', 'General Knowledge', 'Reasoning', 'Verbal Reasoning', 'Non-Verbal Reasoning'];

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const DIFFICULTY_CONFIG = {
    Easy:   { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.25)'   },
    Medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)'  },
    Hard:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)'   },
};

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } })
};

export default function PastYearPapers() {
    const [papers, setPapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('All');

    const easyRef   = useRef(null);
    const mediumRef = useRef(null);
    const hardRef   = useRef(null);
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

    const filtered = papers.filter(p => {
        const matchesSubject = selectedSubject === 'All' || p.subject === selectedSubject;
        const matchesSearch  = !search || p.title.toLowerCase().includes(search.toLowerCase()) || String(p.year || '').includes(search);
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
                title="Past Year Papers | ReasoningWizard"
                description="Download past year papers for 11+ exam preparation. Browse Easy, Medium, and Hard difficulty papers by subject."
            />
            <div className="pyp-page page-container">
                {/* Hero */}
                <motion.div
                    className="pyp-hero"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="pyp-title">Past Year <span className="text-gradient">Papers</span></h1>
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
                                    <div className="pyp-grid">
                                        <AnimatePresence>
                                            {list.map((paper, i) => (
                                                <motion.div
                                                    key={paper.id}
                                                    className="pyp-card glass-card"
                                                    custom={i}
                                                    variants={fadeUp}
                                                    initial="hidden"
                                                    animate="visible"
                                                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                                >
                                                    <div className="pyp-card-icon" style={{ background: cfg.bg, color: cfg.color }}>
                                                        <FiFileText />
                                                    </div>
                                                    <div className="pyp-card-body">
                                                        <h3 className="pyp-card-title">{paper.title}</h3>
                                                        <div className="pyp-card-meta">
                                                            <span className="meta-badge subject-badge">{paper.subject}</span>
                                                            {paper.year && <span className="meta-badge year-badge">{paper.year}</span>}
                                                            <span
                                                                className="meta-badge diff-badge"
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
