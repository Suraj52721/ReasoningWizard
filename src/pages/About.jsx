import { motion } from 'framer-motion';
import { FiTarget, FiHeart, FiShield, FiGlobe, FiBookOpen, FiUsers, FiAward } from 'react-icons/fi';
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

export default function About() {
    const values = [
        { icon: <FiTarget />, title: 'Mission-Driven', desc: 'Every quiz, worksheet and resource is designed to help UK students succeed in 11+, SATs, GCSEs and beyond.' },
        { icon: <FiHeart />, title: 'Student-First', desc: 'We put learners at the centre. Our platform adapts to different skill levels and learning styles.' },
        { icon: <FiShield />, title: 'Quality Assured', desc: 'All content is reviewed by experienced UK educators and aligned with the national curriculum.' },
        { icon: <FiGlobe />, title: 'Accessible to All', desc: 'Free to use, no hidden fees. We believe every student deserves access to quality resources.' },
    ];

    const stats = [
        { icon: <FiUsers />, value: '50,000+', label: 'Active Students' },
        { icon: <FiBookOpen />, value: '1,200+', label: 'Quizzes Created' },
        { icon: <FiAward />, value: '500+', label: 'Practice Sheets' },
        { icon: <FiGlobe />, value: '100+', label: 'Schools Reached' },
    ];

    const team = [
        { name: 'Dr. Sarah Mitchell', role: 'Founder & Lead Educator', initials: 'SM' },
        { name: 'James Okoro', role: 'Head of Content', initials: 'JO' },
        { name: 'Priya Sharma', role: 'Lead Developer', initials: 'PS' },
        { name: 'David Chen', role: 'UX Designer', initials: 'DC' },
    ];

    return (
        <div className="about-page page-container">
            <div className="about-inner">
                {/* Hero */}
                <motion.section className="about-hero" variants={fadeUp} initial="hidden" animate="visible">
                    <motion.h1 className="about-title" custom={0} variants={fadeUp}>
                        About <span className="text-gradient">ReasoningWizard</span>
                    </motion.h1>
                    <motion.p className="about-subtitle" custom={1} variants={fadeUp}>
                        We're on a mission to make exam preparation engaging, accessible and effective for every UK student.
                    </motion.p>
                </motion.section>

                {/* Story */}
                <motion.section className="about-story glass-card" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    <h2>Our Story</h2>
                    <p>
                        ReasoningWizard was born from a simple observation: too many UK students struggle with reasoning and exam preparation,
                        not because they lack ability, but because they lack the right resources and practice.
                    </p>
                    <p>
                        Founded in 2024 by a team of educators and technologists, we set out to create a platform that combines
                        daily quizzes, comprehensive practice sheets, and live leaderboards to make learning competitive, fun,
                        and most importantly — effective.
                    </p>
                    <p>
                        Today, over 50,000 students across the UK use ReasoningWizard to sharpen their skills and build confidence
                        for 11+, SATs, GCSEs and other key examinations.
                    </p>
                </motion.section>

                {/* Values */}
                <motion.section className="about-values-section" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}>
                    <motion.h2 className="section-title" variants={fadeUp}>Our Values</motion.h2>
                    <motion.p className="section-subtitle" variants={fadeUp}>The principles that guide everything we build.</motion.p>
                    <div className="values-grid">
                        {values.map((v, i) => (
                            <motion.div key={i} className="value-card glass-card" variants={fadeUp} custom={i} whileHover={{ y: -6 }}>
                                <div className="value-icon">{v.icon}</div>
                                <h3>{v.title}</h3>
                                <p>{v.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.section>

                {/* Stats */}
                <motion.section className="about-stats glass-card" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    {stats.map((s, i) => (
                        <motion.div key={i} className="about-stat" variants={fadeUp} custom={i}>
                            <div className="about-stat-icon">{s.icon}</div>
                            <span className="about-stat-value">{s.value}</span>
                            <span className="about-stat-label">{s.label}</span>
                        </motion.div>
                    ))}
                </motion.section>

                {/* Team */}
                <motion.section className="about-team-section" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}>
                    <motion.h2 className="section-title" variants={fadeUp}>Meet the Team</motion.h2>
                    <motion.p className="section-subtitle" variants={fadeUp}>Passionate educators and builders behind ReasoningWizard.</motion.p>
                    <div className="team-grid">
                        {team.map((t, i) => (
                            <motion.div key={i} className="team-card glass-card" variants={fadeUp} custom={i} whileHover={{ y: -6 }}>
                                <div className="team-avatar">{t.initials}</div>
                                <h3>{t.name}</h3>
                                <p>{t.role}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.section>
            </div>
        </div>
    );
}
