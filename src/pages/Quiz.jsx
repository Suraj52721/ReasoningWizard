import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { FiClock, FiCheck, FiX, FiAlertCircle, FiArrowLeft, FiAward, FiTrendingUp, FiHome, FiMaximize, FiMinimize, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import './Quiz.css';

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function Quiz() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [phase, setPhase] = useState('loading'); // loading | ready | active | submitted | error
    const [result, setResult] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [existingAttempt, setExistingAttempt] = useState(null);
    const [error, setError] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const timerRef = useRef(null);

    // Focus mode: hide navbar/footer during active quiz
    // NOTE: Removed overflow: hidden to allow scrolling as requested
    useEffect(() => {
        if (phase === 'active') {
            document.body.classList.add('quiz-focus');
        } else {
            document.body.classList.remove('quiz-focus');
        }
        return () => {
            document.body.classList.remove('quiz-focus');
        };
    }, [phase]);

    // Fullscreen change listener
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error enabling full-screen mode: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    // Fetch quiz data
    async function fetchQuiz() {
        const { data: quizData, error: quizError } = await supabase.from('quizzes').select('*').eq('id', id).single();
        const { data: questionsData, error: questionsError } = await supabase.from('questions').select('*').eq('quiz_id', id).order('sort_order');
        const { data: attemptData, error: attemptError } = await supabase.from('quiz_attempts').select('*').eq('quiz_id', id).eq('user_id', user.id).maybeSingle();

        if (quizError || questionsError || attemptError) {
            setError(quizError?.message || questionsError?.message || attemptError?.message || 'Failed to load quiz data.');
            setPhase('error');
            return;
        }

        setQuiz(quizData);
        setQuestions(questionsData || []);

        if (attemptData) {
            setExistingAttempt(attemptData);
            setResult({
                score: attemptData.score,
                total: attemptData.total_questions,
                timeTaken: attemptData.time_taken_seconds,
                answers: attemptData.answers || [],
            });
            setPhase('submitted');
            fetchLeaderboard();
        } else {
            setTimeLeft(quizData?.duration_minutes * 60 || 600);
            setPhase('ready');
        }
    }

    useEffect(() => {
        fetchQuiz();
        return () => clearInterval(timerRef.current);
    }, [id, user.id]);

    async function fetchLeaderboard() {
        const { data: attempts } = await supabase
            .from('quiz_attempts')
            .select('score, total_questions, time_taken_seconds, user_id')
            .eq('quiz_id', id)
            .order('score', { ascending: false })
            .order('time_taken_seconds', { ascending: true })
            .limit(15);

        if (!attempts?.length) { setLeaderboard([]); return; }

        const userIds = [...new Set(attempts.map(a => a.user_id))];
        const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds);

        const profileMap = {};
        (profilesData || []).forEach(p => { profileMap[p.id] = p; });

        setLeaderboard(attempts.map(a => ({
            ...a,
            profiles: profileMap[a.user_id] || { display_name: 'Anonymous' }
        })));
    }

    const handleSubmit = useCallback(async () => {
        clearInterval(timerRef.current);
        const totalTime = (quiz?.duration_minutes * 60 || 600) - timeLeft;
        let correctCount = 0;
        let wrongCount = 0;

        const answerDetails = questions.map((q, i) => {
            const selected = answers[i] ?? -1;
            const correct = selected === q.correct_option;
            if (correct) correctCount++;
            else if (selected !== -1) wrongCount++;
            return { question_id: q.id, selected, correct_option: q.correct_option, correct };
        });

        // Calculate score with optional negative marking
        let score = correctCount;
        if (quiz?.negative_marking && quiz?.negative_marks > 0) {
            score = Math.max(0, Math.round((correctCount - wrongCount * quiz.negative_marks) * 100) / 100);
        }

        const attempt = {
            user_id: user.id,
            quiz_id: id,
            score: Math.round(score),
            total_questions: questions.length,
            time_taken_seconds: totalTime,
            answers: answerDetails,
        };

        const { error: submitError } = await supabase.from('quiz_attempts').insert(attempt);

        if (submitError) {
            console.error("Error submitting attempt:", submitError);
            // Ideally notify user, but sticking to flow for now
        }

        setResult({
            score: Math.round(score),
            total: questions.length,
            timeTaken: totalTime,
            answers: answerDetails,
        });
        setPhase('submitted');
        fetchLeaderboard();

        // Exit fullscreen on submit
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.error(err));
        }

    }, [answers, questions, quiz, timeLeft, user.id, id]);

    // Timer
    useEffect(() => {
        if (phase !== 'active') return;
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [phase, handleSubmit]);

    const handleStartQuiz = () => {
        setPhase('active');
        setTimeLeft(quiz.duration_minutes * 60); // Reset timer
        toggleFullscreen();
    };

    const selectAnswer = (qIndex, optionIndex) => {
        setAnswers(prev => ({ ...prev, [qIndex]: optionIndex }));
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const percentage = result ? Math.round((result.score / result.total) * 100) : 0;

    if (phase === 'loading') {
        return (
            <div className="quiz-page page-container">
                <div className="quiz-loading">
                    <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                    <p>Loading quiz...</p>
                </div>
            </div>
        );
    }

    if (phase === 'error') {
        return (
            <div className="quiz-page page-container">
                <div className="error-message">
                    <FiAlertCircle /> <p>{error}</p>
                    <Link to="/dashboard" className="btn-secondary">Back to Dashboard</Link>
                </div>
            </div>
        );
    }

    // Ready Screen
    if (phase === 'ready') {
        return (
            <div className="quiz-page page-container">
                <div className="quiz-inner">
                    <motion.div className="ready-card glass-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                        <div className="ready-icon">🧙‍♂️</div>
                        <h1 className="ready-title">{quiz?.title}</h1>
                        <div className="ready-meta">
                            <span className="ready-badge">{quiz?.subject}</span>
                            <span><FiClock /> {quiz?.duration_minutes} minutes</span>
                            <span>📝 {questions.length} questions</span>
                        </div>
                        <div className="ready-rules">
                            <h4>Instructions</h4>
                            <ul>
                                <li>Answer all questions within the time limit</li>
                                <li>You cannot pause or restart the quiz</li>
                                <li>Your score and time will be recorded</li>
                                {quiz?.negative_marking && (
                                    <li style={{ color: 'var(--warning)', fontWeight: 600 }}>
                                        ⚠️ Negative marking: −{quiz.negative_marks} marks per wrong answer
                                    </li>
                                )}
                                <li>Results and leaderboard shown after submission</li>
                            </ul>
                        </div>
                        <div className="ready-actions">
                            <motion.button className="btn-primary btn-lg" onClick={handleStartQuiz} whileHover={{ scale: 1.04, boxShadow: '0 0 30px rgba(245,197,24,0.4)' }} whileTap={{ scale: 0.96 }}>
                                Start Quiz 🚀
                            </motion.button>
                            <Link to="/dashboard">
                                <motion.button className="btn-secondary btn-lg" whileHover={{ scale: 1.02 }}>
                                    <FiArrowLeft /> Back
                                </motion.button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }

    // Results Screen
    if (phase === 'submitted') {
        return (
            <div className="quiz-page page-container">
                <div className="quiz-inner">
                    {/* Confetti */}
                    {percentage >= 70 && (
                        <div className="confetti-container">
                            {Array.from({ length: 30 }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="confetti-piece"
                                    initial={{ y: -20, x: Math.random() * 800 - 400, opacity: 1, rotate: 0 }}
                                    animate={{ y: 600, opacity: 0, rotate: Math.random() * 720 }}
                                    transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 0.5, ease: 'easeOut' }}
                                    style={{ background: ['#F5C518', '#FFD84D', '#D4A91A', '#00D68F', '#FF4D6A'][Math.floor(Math.random() * 5)] }}
                                />
                            ))}
                        </div>
                    )}

                    <motion.div className="result-card glass-card" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 100 }}>
                        <div className="result-header">
                            <motion.div
                                className="result-circle"
                                initial={{ strokeDashoffset: 283 }}
                                animate={{ strokeDashoffset: 283 - (283 * percentage) / 100 }}
                                transition={{ duration: 1.5, delay: 0.3 }}
                            >
                                <svg viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="45" className="circle-bg" />
                                    <motion.circle
                                        cx="50" cy="50" r="45"
                                        className="circle-fill"
                                        strokeDasharray="283"
                                        initial={{ strokeDashoffset: 283 }}
                                        animate={{ strokeDashoffset: 283 - (283 * percentage) / 100 }}
                                        transition={{ duration: 1.5, delay: 0.3 }}
                                    />
                                </svg>
                                <div className="circle-text">
                                    <span className="circle-pct">{percentage}%</span>
                                    <span className="circle-label">Score</span>
                                </div>
                            </motion.div>
                            <div className="result-info">
                                <h2>{percentage >= 70 ? '🎉 Excellent!' : percentage >= 40 ? '👍 Good Effort!' : '💪 Keep Trying!'}</h2>
                                <p className="result-score">{result.score} / {result.total} correct</p>
                                <p className="result-time"><FiClock /> {Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s</p>
                            </div>
                        </div>

                        {/* Answer Review */}
                        <div className="answer-review">
                            <h3>Question Review</h3>
                            {questions.map((q, i) => {
                                const ans = result.answers[i];
                                const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                                return (
                                    <motion.div
                                        key={i}
                                        className={`review-item ${ans?.correct ? 'correct' : 'wrong'}`}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 * i }}
                                    >
                                        <div className="review-q">
                                            <span className="review-num">Q{i + 1}</span>
                                            <span>{q.question_text}</span>
                                            <span className="review-badge">{ans?.correct ? '✓' : '✗'}</span>
                                        </div>
                                        <div className="review-answers">
                                            {opts.map((opt, j) => (
                                                <span
                                                    key={j}
                                                    className={`review-opt ${j === q.correct_option ? 'correct-opt' : ''} ${j === ans?.selected && !ans?.correct ? 'wrong-opt' : ''}`}
                                                >
                                                    {opt}
                                                </span>
                                            ))}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* Leaderboard */}
                    <motion.div className="quiz-leaderboard glass-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                        <div className="lb-header">
                            <FiTrendingUp /> <h3>Quiz Leaderboard</h3>
                        </div>
                        {leaderboard.length === 0 ? (
                            <p className="lb-empty">No attempts yet.</p>
                        ) : (
                            <div className="lb-list">
                                {leaderboard.map((entry, i) => (
                                    <motion.div
                                        key={i}
                                        className={`lb-row ${entry.user_id === user.id ? 'is-me' : ''}`}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.6 + i * 0.06 }}
                                    >
                                        <span className="lb-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                                        <span className="lb-name">{entry.profiles?.display_name || 'Anonymous'}</span>
                                        <span className="lb-score-val">{entry.score}/{entry.total_questions}</span>
                                        <span className="lb-time-val">{Math.floor(entry.time_taken_seconds / 60)}m {entry.time_taken_seconds % 60}s</span>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>

                    <div className="result-actions">
                        <Link to="/dashboard">
                            <motion.button className="btn-primary btn-lg" whileHover={{ scale: 1.03 }}>
                                <FiHome /> Back to Dashboard
                            </motion.button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Active Quiz
    const currentQuestion = questions[currentQ];
    const opts = typeof currentQuestion?.options === 'string' ? JSON.parse(currentQuestion.options) : (currentQuestion?.options || []);
    const answeredCount = Object.keys(answers).length;
    const isLowTime = timeLeft <= 60;

    return (
        <div className="quiz-page page-container">
            <div className="quiz-inner">
                {/* Timer Bar */}
                <motion.div className="quiz-topbar glass-card" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="topbar-left">
                        <h3>{quiz?.title}</h3>
                        <span className="topbar-progress">{answeredCount}/{questions.length} answered</span>
                    </div>

                    <div className="topbar-right">
                        <button className="icon-btn" onClick={toggleFullscreen} title="Toggle Fullscreen">
                            {isFullscreen ? <FiMinimize /> : <FiMaximize />}
                        </button>

                        <div className={`timer-display ${isLowTime ? 'low-time' : ''}`}>
                            <FiClock />
                            <motion.span
                                key={timeLeft}
                                initial={isLowTime ? { scale: 1.2 } : {}}
                                animate={{ scale: 1 }}
                                transition={{ duration: 0.2 }}
                            >
                                {formatTime(timeLeft)}
                            </motion.span>
                        </div>
                    </div>
                </motion.div>

                {/* Question Palette */}
                <div className="question-palette">
                    {questions.map((_, i) => (
                        <button
                            key={i}
                            className={`palette-btn ${i === currentQ ? 'current' : ''} ${answers[i] !== undefined ? 'answered' : ''}`}
                            onClick={() => setCurrentQ(i)}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>

                {/* Question Card */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentQ}
                        className="question-card glass-card"
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="question-header">
                            <span className="question-num">Question {currentQ + 1} <span className="q-total">/ {questions.length}</span></span>
                        </div>
                        <h2 className="question-text">{currentQuestion?.question_text}</h2>
                        {currentQuestion?.image_url && (
                            <div className="question-image">
                                <img src={currentQuestion.image_url} alt="Question illustration" />
                            </div>
                        )}
                        <div className="options-list">
                            {opts.map((opt, j) => (
                                <motion.button
                                    key={j}
                                    className={`option-btn ${answers[currentQ] === j ? 'selected' : ''}`}
                                    onClick={() => selectAnswer(currentQ, j)}
                                    whileHover={{ scale: 1.01, x: 4 }}
                                    whileTap={{ scale: 0.99 }}
                                >
                                    <span className="option-letter">{String.fromCharCode(65 + j)}</span>
                                    <span className="option-text">{opt}</span>
                                    {answers[currentQ] === j && (
                                        <motion.span className="option-check" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                            <FiCheck />
                                        </motion.span>
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="quiz-nav">
                    <motion.button
                        className="btn-secondary"
                        onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                        disabled={currentQ === 0}
                        whileHover={{ scale: 1.02 }}
                    >
                        <FiChevronLeft /> Previous
                    </motion.button>

                    {currentQ < questions.length - 1 ? (
                        <motion.button
                            className="btn-primary"
                            onClick={() => setCurrentQ(currentQ + 1)}
                            whileHover={{ scale: 1.02 }}
                        >
                            Next <FiChevronRight />
                        </motion.button>
                    ) : (
                        <motion.button
                            className="btn-primary submit-btn"
                            onClick={handleSubmit}
                            whileHover={{ scale: 1.04, boxShadow: '0 0 30px rgba(245,197,24,0.4)' }}
                            whileTap={{ scale: 0.96 }}
                        >
                            Submit Quiz <FiCheck />
                        </motion.button>
                    )}
                </div>
            </div>
        </div>
    );
}
