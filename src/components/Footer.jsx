import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiGithub, FiTwitter, FiMail, FiFacebook } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import logo from '../assets/logo.png';
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
                    <span className="footer-logo">
                        <img src={logo} alt="ReasoningWizard" className="footer-logo-img" />
                        Reasoning<span className="logo-highlight">Wizard</span>
                    </span>
                    <p className="footer-tagline">UK's premier tutoring & practice sheets academy. Empowering students with daily quizzes and personalised learning.</p>
                </div>
                <div className="footer-links">
                    <div className="footer-col">
                        <h4>Platform</h4>
                        <Link to="/questions">Practice Questions</Link>
                        <Link to="/dashboard">Daily Quizzes</Link>
                        <Link to="/dashboard">Practice Sheets</Link>
                        <Link to="/dashboard">Leaderboards</Link>
                    </div>
                    <div className="footer-col">
                        <h4>Company</h4>
                        <Link to="/about">About Us</Link>
                        <Link to="/contact">Contact</Link>
                        <Link to="/careers">Careers</Link>
                    </div>
                    <div className="footer-col">
                        <h4>Legal</h4>
                        <Link to="/privacy-policy">Privacy Policy</Link>
                        <Link to="/terms-of-service">Terms of Service</Link>
                    </div>
                </div>
            </div>
            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} ReasoningWizard. All rights reserved.</p>
                <div className="footer-socials">
                    <a href="https://www.facebook.com/share/1DWaXgeZ1c/" target="_blank" rel="noopener noreferrer"><FiFacebook /></a>
                    <a href="https://chat.whatsapp.com/KDNR17OSuAjGIQDpyy0oWp" target="_blank" rel="noopener noreferrer"><FaWhatsapp /></a>
                    <a href="mailto:support@reasoningwizard.com"><FiMail /></a>
                </div>
            </div>
        </motion.footer>
    );
}
