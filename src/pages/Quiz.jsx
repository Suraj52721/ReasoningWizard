import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { FiClock, FiCheckCircle, FiTarget, FiPlay, FiPause, FiMaximize, FiMinimize, FiArrowLeft, FiAlertCircle, FiCheck, FiX, FiTrendingUp, FiAward, FiBarChart2, FiPercent, FiShare2, FiRefreshCw, FiHome, FiEye, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import SEO from '../components/SEO';
import './Quiz.css';

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function Quiz() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, profile } = useAuth();

    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [phase, setPhase] = useState('loading'); // loading | ready | active | submitted | error
    const [result, setResult] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [totalParticipants, setTotalParticipants] = useState(0);
    const [existingAttempt, setExistingAttempt] = useState(null);
    const [error, setError] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [myRank, setMyRank] = useState(null);
    const [averageScore, setAverageScore] = useState(0);
    const [topperScore, setTopperScore] = useState(0);
    const [showSolutions, setShowSolutions] = useState(false);
    const [expandedSolutions, setExpandedSolutions] = useState({});
    const timerRef = useRef(null);
    const [sessionId, setSessionId] = useState(null);
    const [isResuming, setIsResuming] = useState(false);

    const latestState = useRef({ answers, timeLeft, currentQ });
    useEffect(() => {
        latestState.current = { answers, timeLeft, currentQ };
    }, [answers, timeLeft, currentQ]);

    const saveSession = useCallback(async () => {
        if (!user || !id) return;
        const state = latestState.current;
        const session = {
            user_id: user.id,
            quiz_id: id,
            answers: state.answers,
            time_left_seconds: state.timeLeft,
            current_question: state.currentQ,
            updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase
            .from('quiz_sessions')
            .upsert(session, { onConflict: 'user_id, quiz_id' })
            .select()
            .single();

        if (!error && data) {
            setSessionId(data.id);
        }
    }, [user, id]);

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
                console.error(`Error enabling full - screen mode: ${err.message} `);
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
        const { data: sessionData, error: sessionError } = await supabase.from('quiz_sessions').select('*').eq('quiz_id', id).eq('user_id', user.id).maybeSingle();

        if (quizError || questionsError || attemptError || sessionError) {
            setError(quizError?.message || questionsError?.message || attemptError?.message || sessionError?.message || 'Failed to load quiz data.');
            setPhase('error');
            return;
        }

        setQuiz(quizData);
        setQuestions(questionsData || []);

        if (attemptData) {
            // If reattempt flag is set, skip showing results and go to ready
            const isReattempt = searchParams.get('reattempt') === 'true';
            if (isReattempt) {
                // Delete old attempt and go straight to ready
                await supabase.from('quiz_attempts').delete().eq('id', attemptData.id);
                await supabase.from('quiz_sessions').delete().eq('user_id', user.id).eq('quiz_id', id);
                setTimeLeft(quizData?.duration_minutes * 60 || 600);
                setPhase('active');
                // Auto-enter fullscreen
                document.documentElement.requestFullscreen().catch(() => { });
                return;
            }
            setExistingAttempt(attemptData);
            setResult({
                score: attemptData.score,
                total: attemptData.total_questions,
                timeTaken: attemptData.time_taken_seconds,
                answers: attemptData.answers || [],
            });
            setPhase('submitted');
            fetchLeaderboard({ score: attemptData.score, timeTaken: attemptData.time_taken_seconds });
        } else {
            const isReattempt = searchParams.get('reattempt') === 'true';
            if (sessionData && !isReattempt) {
                setSessionId(sessionData.id);
                setAnswers(sessionData.answers || {});
                setTimeLeft(sessionData.time_left_seconds);
                setCurrentQ(sessionData.current_question || 0);
                setIsResuming(true);
                setPhase('ready');
            } else {
                setTimeLeft(quizData?.duration_minutes * 60 || 600);
                if (isReattempt) {
                    setPhase('active');
                    document.documentElement.requestFullscreen().catch(() => { });
                } else {
                    setPhase('ready');
                }
            }
        }
    }

    useEffect(() => {
        fetchQuiz();
        return () => clearInterval(timerRef.current);
    }, [id, user.id]);

    async function fetchLeaderboard(currentStats = result) {
        const { data: attempts } = await supabase
            .from('quiz_attempts')
            .select('score, total_questions, time_taken_seconds, user_id')
            .eq('quiz_id', id)
            .order('score', { ascending: false })
            .order('time_taken_seconds', { ascending: true })
            .limit(10);

        if (!attempts?.length) { setLeaderboard([]); setMyRank(null); return; }

        const userIds = [...new Set(attempts.map(a => a.user_id))];
        const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds);

        const profileMap = {};
        (profilesData || []).forEach(p => { profileMap[p.id] = p; });

        const lbData = attempts.map(a => ({
            ...a,
            profiles: profileMap[a.user_id] || { display_name: 'Anonymous' }
        }));
        setLeaderboard(lbData);

        // Stats: Topper & Average
        if (lbData.length > 0) {
            setTopperScore(lbData[0].score);
        }

        // Fetch all scores for average calculation (optimization: could be an RPC or separate query)
        const { data: allScores } = await supabase
            .from('quiz_attempts')
            .select('score')
            .eq('quiz_id', id);

        if (allScores?.length) {
            setTotalParticipants(allScores.length);
            const totalScore = allScores.reduce((sum, item) => sum + item.score, 0);
            setAverageScore(Math.round((totalScore / allScores.length) * 10) / 10);
        }

        // Calculate accurate rank
        if (!currentStats) return;

        // 1. Check if user is in top 10
        const rankIndex = lbData.findIndex(e => e.user_id === user.id);
        if (rankIndex >= 0) {
            setMyRank(rankIndex + 1);
            return;
        }

        // 2. If not, query database for exact rank
        // Count users with better score
        const { count: betterScoreCount } = await supabase
            .from('quiz_attempts')
            .select('id', { count: 'exact', head: true })
            .eq('quiz_id', id)
            .gt('score', currentStats.score);

        // Count users with same score but better time
        const { count: sameScoreBetterTime } = await supabase
            .from('quiz_attempts')
            .select('id', { count: 'exact', head: true })
            .eq('quiz_id', id)
            .eq('score', currentStats.score)
            .lt('time_taken_seconds', currentStats.timeTaken);

        setMyRank((betterScoreCount || 0) + (sameScoreBetterTime || 0) + 1);
    }

    // Re-attempt: delete old attempt, reset state
    const handleReAttempt = async () => {
        if (existingAttempt) {
            await supabase.from('quiz_attempts').delete().eq('id', existingAttempt.id);
        }
        await supabase.from('quiz_sessions').delete().eq('user_id', user.id).eq('quiz_id', id);
        setExistingAttempt(null);
        setResult(null);
        setAnswers({});
        setCurrentQ(0);
        setMyRank(null);
        setLeaderboard([]);
        setIsPaused(false);
        setIsResuming(false);
        setSessionId(null);
        setTimeLeft(quiz?.duration_minutes * 60 || 600);
        setPhase('ready');
    };

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
            completed_at: new Date().toISOString(),
        };

        const { error: submitError } = await supabase
            .from('quiz_attempts')
            .upsert(attempt, { onConflict: 'user_id, quiz_id' });

        await supabase.from('quiz_sessions').delete().eq('user_id', user.id).eq('quiz_id', id);

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
        fetchLeaderboard({ score: Math.round(score), timeTaken: totalTime });

        // Exit fullscreen on submit
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.error(err));
        }

    }, [answers, questions, quiz, timeLeft, user.id, id]);

    // Timer (respects pause)
    useEffect(() => {
        if (phase !== 'active' || isPaused) {
            clearInterval(timerRef.current);
            return;
        }
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
    }, [phase, isPaused, handleSubmit]);

    // Auto-save periodically
    useEffect(() => {
        if (phase !== 'active' || isPaused) return;
        const interval = setInterval(() => {
            saveSession();
        }, 15000);
        return () => clearInterval(interval);
    }, [phase, isPaused, saveSession]);

    const togglePause = () => {
        setIsPaused(p => {
            const newPaused = !p;
            if (newPaused) {
                saveSession();
            }
            return newPaused;
        });
    };

    const handleStartQuiz = () => {
        setPhase('active');
        if (!isResuming) {
            setTimeLeft(quiz.duration_minutes * 60); // Reset timer
        }
        toggleFullscreen();
    };

    const selectAnswer = (qIndex, optionIndex) => {
        setAnswers(prev => {
            const newAnswers = { ...prev, [qIndex]: optionIndex };
            latestState.current.answers = newAnswers; // sync ref immediately
            saveSession();
            return newAnswers;
        });
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} `;
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
                <SEO
                    title={quiz?.title}
                    description={`Take the ${quiz?.title} quiz.${questions.length} questions, ${quiz?.duration_minutes} minutes.Test your skills now!`}
                />
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
                                <li>You can pause and save your progress at any time</li>
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
                                {isResuming ? 'Resume Quiz 🚀' : 'Start Quiz 🚀'}
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

    // Results Screen — computed stats
    const correctCount = result ? result.answers.filter(a => a?.correct).length : 0;
    const wrongCount = result ? result.answers.filter(a => a && !a.correct && a.selected !== -1).length : 0;
    const unattemptedCount = result ? result.answers.filter(a => a.selected === -1).length : 0;
    const accuracy = result && (correctCount + wrongCount) > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0;
    const percentile = myRank && totalParticipants > 1 ? Math.round(((totalParticipants - myRank) / (totalParticipants - 1)) * 100) : 100;
    const totalTimeSecs = quiz?.duration_minutes * 60 || 600;
    const timeUsedPct = result ? Math.min(100, Math.round((result.timeTaken / totalTimeSecs) * 100)) : 0;

    // Donut chart helper
    const DonutSegment = ({ startAngle, endAngle, color, radius = 45, cx = 50, cy = 50 }) => {
        const start = (startAngle - 90) * (Math.PI / 180);
        const end = (endAngle - 90) * (Math.PI / 180);
        const x1 = cx + radius * Math.cos(start);
        const y1 = cy + radius * Math.sin(start);
        const x2 = cx + radius * Math.cos(end);
        const y2 = cy + radius * Math.sin(end);
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        if (endAngle - startAngle <= 0) return null;
        return <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={color} />;
    };

    // Mini circle component for performance summary
    const MiniCircle = ({ value, max, label, icon, color, suffix = '' }) => {
        const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
        const circumference = 2 * Math.PI * 36;
        return (
            <motion.div className="perf-circle-item" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <div className="perf-circle-ring">
                    <svg viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="36" fill="none" stroke="var(--border)" strokeWidth="5" />
                        <motion.circle
                            cx="40" cy="40" r="36"
                            fill="none"
                            stroke={color}
                            strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            initial={{ strokeDashoffset: circumference }}
                            animate={{ strokeDashoffset: circumference - (circumference * pct) / 100 }}
                            transition={{ duration: 1.2, delay: 0.3 }}
                            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                        />
                    </svg>
                    <div className="perf-circle-value">
                        <span className="perf-val">{value}{suffix}</span>
                        {max > 0 && <span className="perf-max">/{max}</span>}
                    </div>
                </div>
                <div className="perf-circle-label">{icon} {label}</div>
            </motion.div>
        );
    };

    if (phase === 'submitted') {
        // Donut chart angles
        const totalQ = result?.total || 1;
        const correctAngle = (correctCount / totalQ) * 360;
        const wrongAngle = (wrongCount / totalQ) * 360;
        const unattemptedAngle = (unattemptedCount / totalQ) * 360;
        let angle1 = 0;
        let angle2 = correctAngle;
        let angle3 = correctAngle + wrongAngle;

        return (
            <div className="quiz-page page-container">
                <SEO title={`Results: ${quiz?.title} `} />
                <div className="quiz-inner result-page">
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

                    {/* Quiz Title Header */}
                    <motion.div className="result-quiz-header" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                        <h2>📝 {quiz?.title}</h2>
                        <p className="result-quiz-meta">Attempted on {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} • {profile?.display_name || 'Student'}</p>
                    </motion.div>

                    {/* Overall Performance Summary */}
                    <motion.div className="perf-summary glass-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
                        <h3 className="section-title">Overall Performance Summary</h3>
                        <div className="perf-circles-grid">
                            <MiniCircle value={result.score} max={result.total} label="Your Score" icon={<FiTarget />} color="#33d00fff" />
                            <MiniCircle value={`${Math.floor(result.timeTaken / 60)}:${(result.timeTaken % 60).toString().padStart(2, '0')} `} max="" label="Time Spent" icon={<FiClock />} color="#3B82F6" suffix="" />
                            <MiniCircle value={myRank || '-'} max={leaderboard.length || '-'} label="Your Rank" icon={<FiAward />} color="#F59E0B" />
                            <MiniCircle value={percentile} max={100} label="Percentile" icon={<FiBarChart2 />} color="#10B981" suffix="%" />
                            <MiniCircle value={accuracy} max={100} label="Accuracy" icon={<FiPercent />} color="#8B5CF6" suffix="%" />
                        </div>

                        {/* Action Buttons */}
                        <div className="result-action-row">
                            <motion.button className="btn-secondary result-action-btn" onClick={() => {
                                const text = `I scored ${result.score}/${result.total} (${percentage}%) on ${quiz?.title} at ReasoningWizard! 🎯`;
                                if (navigator.share) {
                                    navigator.share({ title: 'My Quiz Result', text, url: window.location.href });
                                } else {
                                    navigator.clipboard.writeText(text);
                                    alert('Result copied to clipboard!');
                                }
                            }} whileHover={{ scale: 1.03 }}>
                                <FiShare2 /> Share
                            </motion.button >
                            <motion.button className="btn-primary result-action-btn" onClick={handleReAttempt} whileHover={{ scale: 1.03 }}>
                                <FiRefreshCw /> Re Attempt
                            </motion.button>
                        </div >
                    </motion.div >

                    {/* Question Distribution */}
                    < motion.div className="question-dist glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <h3 className="section-title">Question Distribution</h3>
                        <div className="dist-content">
                            <div className="dist-donut">
                                <svg viewBox="0 0 100 100">
                                    {correctCount > 0 && <DonutSegment startAngle={angle1} endAngle={angle2} color="#10B981" />}
                                    {wrongCount > 0 && <DonutSegment startAngle={angle2} endAngle={angle3} color="#EF4444" />}
                                    {unattemptedCount > 0 && <DonutSegment startAngle={angle3} endAngle={360} color="#6B7280" />}
                                    <circle cx="50" cy="50" r="28" fill="var(--bg-card)" />
                                    <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" className="donut-center-text" fill="var(--text-primary)" fontSize="12" fontWeight="700">{totalQ}Q</text>
                                </svg>
                            </div>
                            <div className="dist-legend">
                                <div className="legend-item">
                                    <span className="legend-dot" style={{ background: '#10B981' }} />
                                    <span>Correct</span>
                                    <strong>{correctCount}</strong>
                                </div>
                                <div className="legend-item">
                                    <span className="legend-dot" style={{ background: '#EF4444' }} />
                                    <span>Wrong</span>
                                    <strong>{wrongCount}</strong>
                                </div>
                                <div className="legend-item">
                                    <span className="legend-dot" style={{ background: '#6B7280' }} />
                                    <span>Unattempted</span>
                                    <strong>{unattemptedCount}</strong>
                                </div>
                            </div>
                        </div>
                    </motion.div >

                    {/* Comparison Chart */}
                    <motion.div className="comparison-chart glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                        <h3 className="section-title">Performance Comparison</h3>
                        <div className="chart-container" style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[
                                        { name: 'You', score: result.score, color: '#8B5CF6' },
                                        { name: 'Average', score: averageScore, color: '#3B82F6' },
                                        { name: 'Topper', score: topperScore, color: '#F59E0B' }
                                    ]}
                                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                >
                                    <XAxis
                                        dataKey="name"
                                        stroke="#9CA3AF"
                                        tick={{ fill: '#D1D5DB', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        hide
                                        domain={[0, result.total || 'auto']}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '8px', color: '#F3F4F6' }}
                                        itemStyle={{ color: '#F3F4F6' }}
                                    />
                                    <Bar dataKey="score" radius={[8, 8, 0, 0]} animationDuration={1500}>
                                        <Cell fill="#8B5CF6" />
                                        <Cell fill="#3B82F6" />
                                        <Cell fill="#F59E0B" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Leaderboard */}
                    < motion.div className="quiz-leaderboard glass-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                        <div className="lb-header">
                            <FiTrendingUp /> <h3>Leaderboard</h3>
                        </div>
                        {
                            leaderboard.length === 0 ? (
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
                                            <span className="lb-rank-num">{i + 1}</span>
                                            <span className="lb-avatar-circle">{entry.profiles?.display_name?.[0]?.toUpperCase() || '?'}</span>
                                            <span className="lb-name">{entry.profiles?.display_name || 'Anonymous'}</span>
                                            <span className="lb-score-val">{entry.score}/{entry.total_questions}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            )
                        }
                    </motion.div >

                    {/* View Solutions — navigates to dedicated page */}
                    < motion.div className="solutions-section glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                        <Link to={`/quiz/${id}/solutions`}>
                            <motion.button
                                className="btn-primary btn-lg solutions-toggle-btn"
                                whileHover={{ scale: 1.02 }}
                            >
                                <FiEye /> View Solutions
                            </motion.button>
                        </Link>
                    </motion.div >

                    {/* Bottom Actions */}
                    < div className="result-bottom-actions" >
                        <Link to="/dashboard">
                            <motion.button className="btn-secondary btn-lg" whileHover={{ scale: 1.03 }}>
                                <FiHome /> Back to Dashboard
                            </motion.button>
                        </Link>
                    </div >
                </div >
            </div >
        );
    }

    // Active Quiz
    const currentQuestion = questions[currentQ];
    const opts = typeof currentQuestion?.options === 'string' ? JSON.parse(currentQuestion.options) : (currentQuestion?.options || []);
    const answeredCount = Object.keys(answers).length;
    const isLowTime = timeLeft <= 60;

    return (
        <div className="quiz-page page-container">
            <SEO title={`Playing: ${quiz?.title}`} />
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

                        <button className="icon-btn pause-btn" onClick={togglePause} title={isPaused ? 'Resume Quiz' : 'Pause Quiz'}>
                            {isPaused ? <FiPlay /> : <FiPause />}
                        </button>

                        <div className={`timer-display ${isLowTime ? 'low-time' : ''} ${isPaused ? 'paused' : ''}`}>
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

                {/* Pause Overlay */}
                <AnimatePresence>
                    {isPaused && (
                        <motion.div
                            className="pause-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <motion.div
                                className="pause-card glass-card"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 200 }}
                            >
                                <div className="pause-icon-wrap">
                                    <FiPause />
                                </div>
                                <h2>Quiz Paused</h2>
                                <p>Take a breather! Your progress is saved.</p>
                                <p className="pause-time">Time remaining: {formatTime(timeLeft)}</p>
                                <motion.button
                                    className="btn-primary btn-lg"
                                    onClick={togglePause}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <FiPlay /> Resume Quiz
                                </motion.button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
