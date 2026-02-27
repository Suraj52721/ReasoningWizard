import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { FiBookOpen, FiChevronRight, FiSearch } from 'react-icons/fi';
import SEO from '../components/SEO';

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.4, delay: i * 0.05 }
    })
};

const stagger = {
    visible: { transition: { staggerChildren: 0.05 } }
};

export default function Questions() {
    const [questions, setQuestions] = useState([]);
    const [quizzes, setQuizzes] = useState({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeSubject, setActiveSubject] = useState('All');

    useEffect(() => {
        async function fetchAll() {
            setLoading(true);

            // Fetch all quizzes for subject mapping
            const { data: quizData } = await supabase
                .from('quizzes')
                .select('id, title, subject')
                .neq('is_draft', true)
                .order('quiz_date', { ascending: false });

            const quizMap = {};
            (quizData || []).forEach(q => { quizMap[q.id] = q; });
            setQuizzes(quizMap);

            // Fetch all questions
            const { data: qData } = await supabase
                .from('questions')
                .select('id, question_text, quiz_id, sort_order')
                .order('quiz_id')
                .order('sort_order');

            setQuestions(qData || []);
            setLoading(false);
        }
        fetchAll();
    }, []);

    // Derive unique subjects
    const subjects = ['All', ...new Set(Object.values(quizzes).map(q => q.subject).filter(Boolean))];

    // Filter
    const filtered = questions.filter(q => {
        const quiz = quizzes[q.quiz_id];
        const matchesSubject = activeSubject === 'All' || quiz?.subject === activeSubject;
        const matchesSearch = !search || q.question_text.toLowerCase().includes(search.toLowerCase());
        return matchesSubject && matchesSearch;
    });

    // Group by quiz
    const grouped = filtered.reduce((acc, q) => {
        const quiz = quizzes[q.quiz_id];
        const key = q.quiz_id;
        if (!acc[key]) acc[key] = { quiz, questions: [] };
        acc[key].questions.push(q);
        return acc;
    }, {});

    return (
        <div className="page-container" style={{ paddingBottom: '4rem' }}>
            <SEO
                title="Practice Questions - Reasoning Wizard"
                description="Browse and practice hundreds of 11+ exam questions with step-by-step solutions. Maths, Verbal Reasoning, and Non-Verbal Reasoning."
            />
            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1.5rem' }}>

                {/* Hero */}
                <motion.section style={{ textAlign: 'center', padding: '3rem 0 2rem' }} variants={fadeUp} initial="hidden" animate="visible">
                    <motion.h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1rem' }} custom={0} variants={fadeUp}>
                        Practice <span className="text-gradient">Questions</span>
                    </motion.h1>
                    <motion.p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.7, maxWidth: '600px', margin: '0 auto' }} custom={1} variants={fadeUp}>
                        Browse hundreds of 11+ questions with detailed solutions. Click any question to see the full step-by-step answer.
                    </motion.p>
                </motion.section>

                {/* Search and Filter */}
                <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} style={{ marginBottom: '2rem' }}>
                    <div style={{
                        display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem'
                    }}>
                        <div style={{
                            flex: 1, minWidth: '250px', display: 'flex', alignItems: 'center', gap: '0.8rem',
                            padding: '0.8rem 1.2rem', borderRadius: '12px',
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
                        }}>
                            <FiSearch style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <input
                                type="text"
                                placeholder="Search questions..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{
                                    background: 'transparent', border: 'none', outline: 'none',
                                    color: 'var(--text-primary)', fontSize: '1rem', width: '100%'
                                }}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {subjects.map(s => (
                            <button
                                key={s}
                                onClick={() => setActiveSubject(s)}
                                style={{
                                    padding: '0.4rem 1rem', borderRadius: '20px', border: 'none',
                                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                                    background: activeSubject === s ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                    color: activeSubject === s ? '#000' : 'var(--text-secondary)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Content */}
                {loading ? (
                    <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
                        <div className="loading-spinner" />
                        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading questions...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
                        <p style={{ color: 'var(--text-muted)' }}>No questions found matching your criteria.</p>
                    </div>
                ) : (
                    <motion.div variants={stagger} initial="hidden" animate="visible">
                        {Object.entries(grouped).map(([quizId, group]) => (
                            <motion.div key={quizId} className="glass-card" variants={fadeUp} style={{ marginBottom: '1.5rem', padding: '1.5rem 2rem' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '0.8rem',
                                    marginBottom: '1rem', paddingBottom: '1rem',
                                    borderBottom: '1px solid rgba(255,255,255,0.06)'
                                }}>
                                    <FiBookOpen style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                                        {group.quiz?.title || 'Quiz'}
                                    </h3>
                                    {group.quiz?.subject && (
                                        <span style={{
                                            marginLeft: 'auto', padding: '0.2rem 0.75rem', borderRadius: '12px',
                                            background: 'rgba(212,169,26,0.1)', color: 'var(--primary)',
                                            fontSize: '0.78rem', fontWeight: 600
                                        }}>
                                            {group.quiz.subject}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {group.questions.map(q => (
                                        <Link
                                            key={q.id}
                                            to={`/question/${q.id}`}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '1rem',
                                                padding: '0.8rem 1rem', borderRadius: '10px',
                                                textDecoration: 'none', color: 'var(--text-primary)',
                                                transition: 'all 0.2s',
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid transparent'
                                            }}
                                            className="qd-related-link"
                                        >
                                            <span style={{
                                                width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', borderRadius: '8px',
                                                background: 'rgba(212,169,26,0.1)', color: 'var(--primary)',
                                                fontWeight: 700, fontSize: '0.8rem', flexShrink: 0
                                            }}>
                                                {q.sort_order + 1}
                                            </span>
                                            <span style={{
                                                flex: 1, fontSize: '0.95rem', overflow: 'hidden',
                                                textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                            }}>
                                                {q.question_text}
                                            </span>
                                            <FiChevronRight style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                        </Link>
                                    ))}
                                </div>
                            </motion.div>
                        ))}

                        <p style={{
                            textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem',
                            marginTop: '1rem'
                        }}>
                            Showing {filtered.length} question{filtered.length !== 1 ? 's' : ''}
                        </p>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
