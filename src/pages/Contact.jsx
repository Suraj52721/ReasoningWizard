import { motion } from 'framer-motion';
import { FiMail, FiPhone, FiMapPin, FiClock, FiFacebook } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import './Contact.css';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.5, delay: i * 0.12, ease: [0.4, 0, 0.2, 1] }
    })
};

import SEO from '../components/SEO';

export default function Contact() {

    const contactInfo = [
        { icon: <FiMail />, label: 'Email', value: 'support@reasoningwizard.com', href: 'mailto:support@reasoningwizard.com' },
        { icon: <FiPhone />, label: 'Phone', value: '+919560103627', href: 'tel:+919560103627' },
        { icon: <FiFacebook />, label: 'Facebook', value: 'Reasoning Wizard', href: 'https://www.facebook.com/share/1DWaXgeZ1c/' },
        { icon: <FiMapPin />, label: 'Address', value: 'London, United Kingdom', href: null },
        { icon: <FiClock />, label: 'Hours', value: 'Mon–Fri, 9am–6pm GMT', href: null },
    ];

    return (
        <div className="contact-page page-container">
            <SEO
                title="Contact Us - ReasoningWizard"
                description="Get in touch with our team for support, partnership inquiries, or feedback. We're here to help you succeed."
            />
            <div className="contact-inner">
                {/* Hero */}
                <motion.section className="contact-hero" variants={fadeUp} initial="hidden" animate="visible">
                    <motion.h1 className="contact-title" custom={0} variants={fadeUp}>
                        Get in <span className="text-gradient">Touch</span>
                    </motion.h1>
                    <motion.p className="contact-subtitle" custom={1} variants={fadeUp}>
                        Have a question, suggestion, or just want to say hello? We'd love to hear from you.
                    </motion.p>
                </motion.section>

                <div className="contact-grid">
                    {/* Contact Form */}
                    {/* WhatsApp Action */}
                    <motion.div
                        className="contact-form-card glass-card"
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        custom={2}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4rem 2rem' }}
                    >
                        <div className="success-icon-lg" style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                            <FaWhatsapp />
                        </div>
                        <h2 className="form-title" style={{ justifyContent: 'center', marginBottom: '1rem', color: '#25D366' }}>
                            Join our WhatsApp Community
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1.1rem', lineHeight: '1.6' }}>
                            Connect with other students and our support team. Join our WhatsApp community for instant updates, resources, and assistance.
                        </p>
                        <a
                            href="https://chat.whatsapp.com/KDNR17OSuAjGIQDpyy0oWp"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'none', width: '100%', maxWidth: '300px' }}
                        >
                            <motion.button
                                className="btn-primary contact-submit-btn"
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                style={{ background: '#25D366', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}
                            >
                                <FaWhatsapp size={20} /> Join Community
                            </motion.button>
                        </a>
                    </motion.div>

                    {/* Contact Info Sidebar */}
                    <motion.div
                        className="contact-info-side"
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        custom={3}
                    >
                        {contactInfo.map((c, i) => (
                            <motion.div
                                key={i}
                                className="info-card glass-card"
                                variants={fadeUp}
                                custom={3 + i}
                                whileHover={{ y: -4 }}
                            >
                                <div className="info-icon">{c.icon}</div>
                                <div>
                                    <div className="info-label">{c.label}</div>
                                    {c.href ? (
                                        <a href={c.href} className="info-value info-link">{c.value}</a>
                                    ) : (
                                        <div className="info-value">{c.value}</div>
                                    )}
                                </div>
                            </motion.div>
                        ))}

                        {/* FAQ hint */}
                        <div className="faq-hint glass-card">
                            <h4>Frequently Asked</h4>
                            <p>Is ReasoningWizard free?</p>
                            <span>Yes! Our core platform is completely free for all students.</span>
                            <p>How do I reset my password?</p>
                            <span>Go to the login page and click "Forgot Password" to receive a reset link.</span>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
