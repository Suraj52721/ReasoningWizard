import { motion } from 'framer-motion';
import {
    FiTarget, FiHeart, FiShield, FiGlobe, FiBookOpen,
    FiUsers, FiAward, FiLayers, FiClock, FiFileText,
    FiTrendingUp, FiCheckCircle
} from 'react-icons/fi';
import './About.css';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.5, delay: i * 0.12, ease: [0.4, 0, 0.2, 1] }
    })
};

const stagger = {
    visible: { transition: { staggerChildren: 0.1 } }
};

import SEO from '../components/SEO';

export default function About() {
    const offers = [
        { icon: <FiBookOpen />, title: 'Daily practice questions' },
        { icon: <FiTarget />, title: 'Topic-wise worksheets' },
        { icon: <FiAward />, title: 'Maths, Verbal & Non-Verbal Reasoning' },
        { icon: <FiShield />, title: 'Practice tests and mock exams' },
        { icon: <FiHeart />, title: 'Step-by-step solutions' },
        { icon: <FiUsers />, title: 'Online guidance from experienced tutors' },
    ];

    const reasons = [
        { icon: <FiLayers />, title: 'Clear and structured practice' },
        { icon: <FiCheckCircle />, title: 'Regular learning materials' },
        { icon: <FiFileText />, title: 'Focus on real exam patterns' },
        { icon: <FiUsers />, title: 'Support from experienced tutors' },
        { icon: <FiTrendingUp />, title: 'A growing community of motivated students' },
    ];

    return (
        <div className="about-page page-container">
            <SEO
                title="About Us - Reasoning Wizard"
                description="Learn about our mission to help students build strong thinking skills and succeed in the 11+ exam."
            />
            <div className="about-inner">
                {/* Hero */}
                <motion.section className="about-hero" variants={fadeUp} initial="hidden" animate="visible">
                    <motion.h1 className="about-title" custom={0} variants={fadeUp}>
                        About <span className="text-gradient">Reasoning Wizard</span>
                    </motion.h1>
                    <motion.p className="about-subtitle" custom={1} variants={fadeUp}>
                        At Reasoning Wizard, we help students prepare for the 11+ exam with confidence through structured learning, daily practice, and expert guidance.
                    </motion.p>
                </motion.section>

                {/* Introduction */}
                <motion.section className="about-story glass-card" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    <p>
                        We believe that success in the 11+ is not only about intelligence but about consistent practice, clear concepts, and the right strategy. Our goal is to make high-quality preparation accessible to every student.
                    </p>
                </motion.section>

                {/* What We Offer */}
                <motion.section className="about-values-section" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}>
                    <motion.h2 className="section-title" variants={fadeUp}>What We Offer</motion.h2>
                    <motion.p className="section-subtitle" variants={fadeUp}>We provide a complete preparation environment for students, including:</motion.p>
                    <div className="values-grid">
                        {offers.map((v, i) => (
                            <motion.div key={i} className="value-card glass-card" variants={fadeUp} custom={i} whileHover={{ y: -6 }}>
                                <div className="value-icon">{v.icon}</div>
                                <h3>{v.title}</h3>
                            </motion.div>
                        ))}
                    </div>
                    <motion.p className="section-subtitle" variants={fadeUp} style={{ marginTop: '3rem' }}>
                        Our platform is designed to help students practice regularly, track their progress, and improve their problem-solving skills.
                    </motion.p>
                </motion.section>

                {/* Mission */}
                <motion.section className="about-story glass-card" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    <h2>Our Mission</h2>
                    <p>
                        Our mission is simple: to help students build strong thinking skills and succeed in the 11+ exam.
                    </p>
                </motion.section>

                {/* Why Students Choose Us */}
                <motion.section className="about-values-section why-choose-us" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}>
                    <motion.h2 className="section-title" variants={fadeUp}>Why Students Choose Us</motion.h2>
                    <div className="values-grid">
                        {reasons.map((r, i) => (
                            <motion.div key={i} className="value-card glass-card" variants={fadeUp} custom={i} whileHover={{ y: -6 }}>
                                <div className="value-icon">{r.icon}</div>
                                <h3>{r.title}</h3>
                            </motion.div>
                        ))}
                    </div>
                    <motion.p className="section-subtitle" variants={fadeUp} style={{ marginTop: '3rem' }}>
                        At Reasoning Wizard, we are committed to helping students become confident learners and strong problem solvers.
                    </motion.p>
                </motion.section>
            </div>
        </div>
    );
}
