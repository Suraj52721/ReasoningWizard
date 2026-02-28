import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { FiCheck, FiBookOpen, FiArrowRight, FiChevronRight } from 'react-icons/fi';
import SEO from '../components/SEO';
import './QuestionDetail.css';

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function QuestionDetail() {
    const { questionId } = useParams();
    const [question, setQuestion] = useState(null);
    const [quiz, setQuiz] = useState(null);
    const [relatedQuestions, setRelatedQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchQuestion() {
            setLoading(true);
            setError(null);

            // Fetch the question
            const { data: qData, error: qError } = await supabase
                .from('questions')
                .select('*')
                .eq('id', questionId)
                .single();

            if (qError || !qData) {
                setError('Question not found.');
                setLoading(false);
                return;
            }

            setQuestion(qData);

            // Fetch the parent quiz for subject/title
            const { data: quizData } = await supabase
                .from('quizzes')
                .select('id, title, subject')
                .eq('id', qData.quiz_id)
                .neq('is_draft', true)
                .single();

            setQuiz(quizData);

            // Fetch related questions from the same quiz
            const { data: relatedData } = await supabase
                .from('questions')
                .select('id, question_text, sort_order')
                .eq('quiz_id', qData.quiz_id)
                .neq('id', questionId)
                .order('sort_order')
                .limit(5);

            setRelatedQuestions(relatedData || []);
            setLoading(false);
        }

        fetchQuestion();
    }, [questionId]);

    if (loading) {
        return (
            <div className="question-detail-page page-container">
                <div className="question-detail-inner qd-loading">
                    <div className="loading-spinner" />
                    <p>Loading question...</p>
                </div>
            </div>
        );
    }

    if (error || !question) {
        return (
            <div className="question-detail-page page-container">
                <div className="question-detail-inner qd-error">
                    <p>{error || 'Question not found.'}</p>
                    <Link to="/questions">
                        <motion.button className="btn-primary" style={{ marginTop: '1rem' }} whileHover={{ scale: 1.03 }}>
                            Browse All Questions
                        </motion.button>
                    </Link>
                </div>
            </div>
        );
    }

    const options = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
    const correctOptionText = options?.[question.correct_option] || '';

    // Build JSON-LD schema
    const schema = {
        "@context": "https://schema.org",
        "@type": "QAPage",
        "mainEntity": {
            "@type": "Question",
            "name": question.question_text,
            "text": question.question_text,
            "answerCount": 1,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": question.solution
                    ? `${correctOptionText}. ${question.solution}`
                    : `The correct answer is: ${correctOptionText}`,
                "author": {
                    "@type": "Organization",
                    "name": "Reasoning Wizard"
                }
            }
        }
    };

    return (
        <div className="question-detail-page page-container">
            <SEO
                title={`${question.question_text.substring(0, 60)} - ${quiz?.subject || '11+'} Solution`}
                description={`Step-by-step solution: ${question.question_text.substring(0, 120)}. Practice this and thousands of other reasoning questions at Reasoning Wizard.`}
                schema={schema}
            />
            <div className="question-detail-inner">

                {/* Breadcrumb */}
                <motion.nav className="qd-breadcrumb" variants={fadeUp} initial="hidden" animate="visible">
                    <Link to="/">Home</Link>
                    <span className="separator"><FiChevronRight /></span>
                    <Link to="/questions">Practice Questions</Link>
                    <span className="separator"><FiChevronRight /></span>
                    <span>{quiz?.subject || 'Question'}</span>
                </motion.nav>

                {/* Subject badge */}
                {quiz?.subject && (
                    <motion.div variants={fadeUp} initial="hidden" animate="visible">
                        <span className="qd-subject-badge">
                            <FiBookOpen /> {quiz.subject}
                        </span>
                    </motion.div>
                )}

                {/* Question */}
                <motion.div className="qd-question-card glass-card" variants={fadeUp} initial="hidden" animate="visible">
                    <div className="qd-question-label">Question</div>
                    <h1 className="qd-question-text">{question.question_text}</h1>
                    {question.image_url && (
                        <div className="qd-question-image" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                            <img src={question.image_url} alt="Question Diagram" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                        </div>
                    )}
                </motion.div>

                {/* Options */}
                <motion.div className="qd-options" variants={fadeUp} initial="hidden" animate="visible">
                    {options.map((opt, i) => (
                        <div key={i} className={`qd-option ${i === question.correct_option ? 'correct' : ''}`}>
                            <span className="qd-option-letter">{String.fromCharCode(65 + i)}</span>
                            <span className="qd-option-text">{opt}</span>
                            {i === question.correct_option && (
                                <span className="qd-correct-icon"><FiCheck /></span>
                            )}
                        </div>
                    ))}
                </motion.div>

                {/* Solution */}
                {(question.solution || question.solution_image) && (
                    <motion.div className="qd-solution-section glass-card" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                        <h2 className="qd-solution-heading">
                            <FiBookOpen /> Step-by-Step Solution
                        </h2>
                        {question.solution && (
                            <div className="qd-solution-content">
                                {question.solution}
                            </div>
                        )}
                        {question.solution_image && (
                            <div className="qd-solution-image" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                                <img src={question.solution_image} alt="Step-by-step solution visualization" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                            </div>
                        )}
                    </motion.div>
                )}

                {/* CTA Banner */}
                <motion.div className="qd-cta-banner glass-card" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    <h3>Want to practice more questions like this?</h3>
                    <p>Join thousands of students preparing for the 11+ exam with daily quizzes, practice sheets, and expert guidance.</p>
                    <Link to="/register" style={{ textDecoration: 'none' }}>
                        <motion.button className="btn-primary" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                            Sign Up for Free <FiArrowRight />
                        </motion.button>
                    </Link>
                </motion.div>

                {/* Related Questions */}
                {relatedQuestions.length > 0 && (
                    <motion.section className="qd-related-section" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                        <h3>More from this quiz</h3>
                        <div className="qd-related-list">
                            {relatedQuestions.map((rq, i) => (
                                <Link key={rq.id} to={`/question/${rq.id}`} className="qd-related-link">
                                    <span className="qd-related-num">Q{rq.sort_order + 1}</span>
                                    <span className="qd-related-text">{rq.question_text}</span>
                                    <FiChevronRight />
                                </Link>
                            ))}
                        </div>
                    </motion.section>
                )}
            </div>
        </div>
    );
}
