import { motion } from 'framer-motion';
import { FiGithub, FiTwitter, FiMail } from 'react-icons/fi';
import './Footer.css';

export default function Footer() {
    return (
        <motion.footer
            className="footer"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
        >
            <div className="footer-inner">
                <div className="footer-brand">
                    <span className="footer-logo">✦ Reasoning<span className="logo-highlight">Wizard</span></span>
                    <p className="footer-tagline">UK's premier tutoring & practice sheets academy. Empowering students with daily quizzes and personalised learning.</p>
                </div>
                <div className="footer-links">
                    <div className="footer-col">
                        <h4>Platform</h4>
                        <a href="/dashboard">Daily Quizzes</a>
                        <a href="/dashboard">Practice Sheets</a>
                        <a href="/dashboard">Leaderboards</a>
                    </div>
                    <div className="footer-col">
                        <h4>Company</h4>
                        <a href="#">About Us</a>
                        <a href="#">Contact</a>
                        <a href="#">Careers</a>
                    </div>
                    <div className="footer-col">
                        <h4>Legal</h4>
                        <a href="#">Privacy Policy</a>
                        <a href="#">Terms of Service</a>
                    </div>
                </div>
            </div>
            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} ReasoningWizard. All rights reserved.</p>
                <div className="footer-socials">
                    <a href="#"><FiTwitter /></a>
                    <a href="#"><FiGithub /></a>
                    <a href="#"><FiMail /></a>
                </div>
            </div>
        </motion.footer>
    );
}
