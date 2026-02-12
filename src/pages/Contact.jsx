import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiMail, FiPhone, FiMapPin, FiSend, FiMessageCircle, FiClock } from 'react-icons/fi';
import './Contact.css';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.5, delay: i * 0.12, ease: [0.4, 0, 0.2, 1] }
    })
};

export default function Contact() {
    const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
    const [submitted, setSubmitted] = useState(false);
    const [sending, setSending] = useState(false);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setSending(true);
        // Simulate sending
        setTimeout(() => {
            setSending(false);
            setSubmitted(true);
        }, 1200);
    };

    const contactInfo = [
        { icon: <FiMail />, label: 'Email', value: 'hello@reasoningwizard.co.uk', href: 'mailto:hello@reasoningwizard.co.uk' },
        { icon: <FiPhone />, label: 'Phone', value: '+44 20 1234 5678', href: 'tel:+442012345678' },
        { icon: <FiMapPin />, label: 'Address', value: 'London, United Kingdom', href: null },
        { icon: <FiClock />, label: 'Hours', value: 'Mon–Fri, 9am–6pm GMT', href: null },
    ];

    return (
        <div className="contact-page page-container">
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
                    <motion.div
                        className="contact-form-card glass-card"
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        custom={2}
                    >
                        {submitted ? (
                            <motion.div
                                className="contact-success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200 }}
                            >
                                <div className="success-icon-lg">
                                    <FiMessageCircle />
                                </div>
                                <h3>Message Sent!</h3>
                                <p>Thank you for reaching out. We'll get back to you within 24 hours.</p>
                                <motion.button
                                    className="btn-secondary"
                                    onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    Send Another Message
                                </motion.button>
                            </motion.div>
                        ) : (
                            <>
                                <h2 className="form-title">
                                    <FiSend /> Send a Message
                                </h2>
                                <form onSubmit={handleSubmit} className="contact-form">
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label htmlFor="name">Full Name</label>
                                            <input
                                                id="name"
                                                name="name"
                                                type="text"
                                                placeholder="Your name"
                                                value={form.name}
                                                onChange={handleChange}
                                                required
                                                className="contact-input"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="email">Email</label>
                                            <input
                                                id="email"
                                                name="email"
                                                type="email"
                                                placeholder="you@example.com"
                                                value={form.email}
                                                onChange={handleChange}
                                                required
                                                className="contact-input"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="subject">Subject</label>
                                        <input
                                            id="subject"
                                            name="subject"
                                            type="text"
                                            placeholder="What's this about?"
                                            value={form.subject}
                                            onChange={handleChange}
                                            required
                                            className="contact-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="message">Message</label>
                                        <textarea
                                            id="message"
                                            name="message"
                                            placeholder="Tell us more..."
                                            rows={5}
                                            value={form.message}
                                            onChange={handleChange}
                                            required
                                            className="contact-input contact-textarea"
                                        />
                                    </div>
                                    <motion.button
                                        type="submit"
                                        className="btn-primary contact-submit-btn"
                                        disabled={sending}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                    >
                                        {sending ? 'Sending...' : <><FiSend /> Send Message</>}
                                    </motion.button>
                                </form>
                            </>
                        )}
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
