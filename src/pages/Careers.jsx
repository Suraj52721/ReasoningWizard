import { motion } from 'framer-motion';
import SEO from '../components/SEO';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.5, delay: i * 0.12, ease: [0.4, 0, 0.2, 1] }
    })
};

export default function Careers() {
    return (
        <div className="page-container" style={{ paddingBottom: '4rem' }}>
            <SEO
                title="Careers - Reasoning Wizard"
                description="Join the Reasoning Wizard team and help us transform education."
            />
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1.5rem' }}>
                <motion.section
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    style={{ textAlign: 'center', padding: '4rem 0 3rem' }}
                >
                    <motion.h1 style={{ fontSize: '2.8rem', fontWeight: 900, marginBottom: '1.5rem' }} custom={0} variants={fadeUp}>
                        Join Our <span className="text-gradient">Team</span>
                    </motion.h1>
                    <motion.p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: 1.7 }} custom={1} variants={fadeUp}>
                        We are always looking for passionate educators, developers, and designers to join us on our mission to make high-quality 11+ preparation accessible to all.
                    </motion.p>
                </motion.section>

                <motion.div
                    className="glass-card"
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    style={{ padding: '3rem', textAlign: 'center' }}
                >
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>No Open Roles Right Now</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '2rem' }}>
                        While we don't have any specific openings at this moment, our team is constantly growing. If you believe your skills can help Reasoning Wizard reach new heights, we'd love to hear from you anyway!
                    </p>
                    <a href="mailto:support@reasoningwizard.com" style={{ textDecoration: 'none' }}>
                        <button className="btn-primary" style={{ padding: '0.8rem 2rem', fontSize: '1.05rem', fontWeight: 'bold' }}>
                            Email us your CV
                        </button>
                    </a>
                </motion.div>
            </div>
        </div>
    );
}
