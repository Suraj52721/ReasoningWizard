import { motion } from 'framer-motion';
import SEO from '../components/SEO';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } }
};

export default function PrivacyPolicy() {
    return (
        <div className="page-container" style={{ paddingBottom: '5rem' }}>
            <SEO
                title="Privacy Policy - Reasoning Wizard"
                description="Learn about how we handle and protect your data."
            />
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1.5rem' }}>
                <motion.section
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    style={{ padding: '4rem 0 2rem', textAlign: 'center' }}
                >
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1rem' }}>
                        Privacy <span className="text-gradient">Policy</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Last updated: October 2024</p>
                </motion.section>

                <motion.div
                    className="glass-card"
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    style={{ padding: '3rem 2.5rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}
                >
                    <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>1. Information We Collect</h2>
                    <p style={{ marginBottom: '2rem' }}>
                        We collect information you provide directly to us when you register for an account, update your profile, engage in quizzes, or communicate with our support team.
                    </p>

                    <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>2. How We Use Your Information</h2>
                    <p style={{ marginBottom: '2rem' }}>
                        We use the information we collect to operate, maintain, and provide you with the personalized features and functionality of the Reasoning Wizard platform, as well as to communicate directly with you.
                    </p>

                    <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>3. Data Security</h2>
                    <p style={{ marginBottom: '2rem' }}>
                        We implement rigorous security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. We do not sell your data to third parties.
                    </p>

                    <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>4. Contact Us</h2>
                    <p>
                        If you have any questions about this Privacy Policy, please contact us at <a href="mailto:support@reasoningwizard.com" style={{ color: 'var(--primary)' }}>privacy@reasoningwizard.com</a>.
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
