import { motion } from 'framer-motion';
import SEO from '../components/SEO';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } }
};

export default function TermsOfService() {
    return (
        <div className="page-container" style={{ paddingBottom: '5rem' }}>
            <SEO
                title="Terms of Service - Reasoning Wizard"
                description="Read our terms and conditions for using the Reasoning Wizard platform."
            />
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1.5rem' }}>
                <motion.section
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    style={{ padding: '4rem 0 2rem', textAlign: 'center' }}
                >
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1rem' }}>
                        Terms of <span className="text-gradient">Service</span>
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
                    <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>1. Acceptance of Terms</h2>
                    <p style={{ marginBottom: '2rem' }}>
                        By accessing and using Reasoning Wizard, you agree to comply with and be bound by these Terms of Service. If you do not agree, please do not use our services.
                    </p>

                    <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>2. Use of License</h2>
                    <p style={{ marginBottom: '2rem' }}>
                        Permission is granted to temporarily use the materials on reasoning Wizard's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.
                    </p>

                    <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>3. User Accounts</h2>
                    <p style={{ marginBottom: '2rem' }}>
                        You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account.
                    </p>

                    <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>4. Disclaimer</h2>
                    <p>
                        The materials on Reasoning Wizard's website are provided on an 'as is' basis. Reasoning Wizard makes no warranties, expressed or implied, and hereby disclaims all other warranties including, limitation, implied warranties or conditions of merchantability.
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
