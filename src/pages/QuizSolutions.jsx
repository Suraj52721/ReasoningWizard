import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { FiArrowLeft, FiCheck, FiX, FiEye, FiChevronDown } from 'react-icons/fi';
import SEO from '../components/SEO';
import './Quiz.css';

export default function QuizSolutions() {
    const { id } = useParams();
    const { user } = useAuth();

    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [attempt, setAttempt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedSolutions, setExpandedSolutions] = useState({});

    useEffect(() => {
        async function fetchData() {
            setLoading(true);

            // Fetch quiz
            const { data: quizData } = await supabase
                .from('quizzes')
                .select('*')
                .eq('id', id)
                .neq('is_draft', true)
                .single();
            setQuiz(quizData);

            // Fetch questions
            const { data: qData } = await supabase
                .from('questions')
                .select('*')
                .eq('quiz_id', id)
                .order('sort_order');
            setQuestions(qData || []);

            // Fetch user's attempt
            if (user) {
                const { data: attemptData } = await supabase
                    .from('quiz_attempts')
                    .select('*')
                    .eq('quiz_id', id)
                    .eq('user_id', user.id)
                    .order('completed_at', { ascending: false })
                    .limit(1)
                    .single();
                setAttempt(attemptData);
            }

            setLoading(false);
        }
        fetchData();
    }, [id, user]);

    if (loading) {
        return (
            <div className="quiz-page page-container">
                <div className="quiz-inner" style={{ textAlign: 'center', paddingTop: '4rem' }}>
                    <div className="loading-spinner" />
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading solutions...</p>
                </div>
            </div>
        );
    }

    if (!quiz || !attempt) {
        return (
            <div className="quiz-page page-container">
                <div className="quiz-inner" style={{ textAlign: 'center', paddingTop: '4rem' }}>
                    <p style={{ color: 'var(--text-muted)' }}>No attempt found for this quiz.</p>
                    <Link to={`/quiz/${id}`}>
                        <motion.button className="btn-primary" style={{ marginTop: '1rem' }} whileHover={{ scale: 1.03 }}>
                            <FiArrowLeft /> Back to Quiz
                        </motion.button>
                    </Link>
                </div>
            </div>
        );
    }

    const answers = typeof attempt.answers === 'string' ? JSON.parse(attempt.answers) : (attempt.answers || []);
    const correctCount = answers.filter(a => a?.correct).length;
    const wrongCount = answers.filter(a => a && !a.correct && a.selected !== -1).length;
    const totalQ = questions.length;

    return (
        <div className="quiz-page page-container">
            <SEO title={`Solutions: ${quiz?.title}`} />
            <div className="quiz-inner solutions-page">

                {/* Header */}
                <motion.div
                    className="sol-page-header"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Link to={`/quiz/${id}`} className="sol-back-link">
                        <FiArrowLeft /> Back to Results
                    </Link>
                    <h2>{quiz?.title}</h2>
                    <div className="sol-page-stats">
                        <span className="sol-stat correct">✓ {correctCount} Correct</span>
                        <span className="sol-stat wrong">✗ {wrongCount} Wrong</span>
                        <span className="sol-stat total">{totalQ} Questions</span>
                    </div>
                </motion.div>

                {/* Questions List */}
                <div className="solutions-list">
                    {questions.map((q, i) => {
                        const ans = answers[i];
                        const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                        const isExpanded = expandedSolutions[i];
                        const wasUnattempted = !ans || ans?.selected === -1 || ans?.selected === undefined;

                        return (
                            <motion.div
                                key={i}
                                className="sol-question-card"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.03 * i }}
                            >
                                {/* Question Header */}
                                <div className="sol-q-header">
                                    <span className="sol-q-num">{i + 1}</span>
                                    <span className="sol-q-label">Question</span>
                                </div>

                                {/* Question Text */}
                                <p className="sol-q-text">{q.question_text}</p>

                                {/* Attempt Status */}
                                <p className={`sol-attempt-status ${wasUnattempted ? 'unattempted' : ans?.correct ? 'correct' : 'wrong'}`}>
                                    {wasUnattempted
                                        ? '*You have not attempted this question'
                                        : ans?.correct
                                            ? '✓ You answered correctly'
                                            : '✗ Your answer was incorrect'}
                                </p>

                                {/* Options */}
                                <div className="sol-options">
                                    {opts.map((opt, j) => {
                                        const isCorrect = j === q.correct_option;
                                        const isSelected = j === ans?.selected;
                                        const isWrongSelected = isSelected && !ans?.correct;
                                        let cls = 'sol-option';
                                        if (isCorrect) cls += ' sol-correct';
                                        if (isWrongSelected) cls += ' sol-wrong';
                                        if (isSelected && !isWrongSelected) cls += ' sol-selected';

                                        return (
                                            <div key={j} className={cls}>
                                                <span className="sol-opt-letter">{String.fromCharCode(65 + j)}</span>
                                                <span className="sol-opt-text">{opt}</span>
                                                {isCorrect && <span className="sol-opt-badge correct-badge"><FiCheck /></span>}
                                                {isWrongSelected && <span className="sol-opt-badge wrong-badge"><FiX /></span>}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* View Solution Expander */}
                                {(q.solution || q.solution_image) && (
                                    <>
                                        <button
                                            className="sol-expand-btn"
                                            onClick={() => setExpandedSolutions(prev => ({ ...prev, [i]: !prev[i] }))}
                                        >
                                            <FiEye /> {isExpanded ? 'Hide Solution' : 'View Solution'}
                                            <span className={`sol-chevron ${isExpanded ? 'open' : ''}`}>▾</span>
                                        </button>
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    className="sol-explanation"
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                >
                                                    {q.solution && (
                                                        <div className="sol-explanation-content">
                                                            {q.solution}
                                                        </div>
                                                    )}
                                                    {q.solution_image && (
                                                        <div className="sol-explanation-image">
                                                            <img src={q.solution_image} alt="Solution detailed diagram" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '1rem' }} />
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </>
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* Bottom */}
                <div className="result-bottom-actions">
                    <Link to={`/quiz/${id}`}>
                        <motion.button className="btn-secondary btn-lg" whileHover={{ scale: 1.03 }}>
                            <FiArrowLeft /> Back to Results
                        </motion.button>
                    </Link>
                </div>

            </div>
        </div>
    );
}
