import logo from '../assets/logo.png';
import './PaperThumbnail.css';

// Centralised config for difficulty colors used across app
export const DIFFICULTY_CONFIG = {
    Easy: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)', gradient: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' },
    Medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', gradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' },
    Hard: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', gradient: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' },
    Premium: { color: '#D4A91A', bg: 'rgba(212,169,26,0.12)', border: 'rgba(212,169,26,0.25)', gradient: 'linear-gradient(135deg, #fef9c3 0%, #fde047 100%)' },
    Free: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)', gradient: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' },
};

export default function PaperThumbnail({ title, difficulty, badgeText }) {
    const cfg = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.Premium;
    const badge = badgeText || difficulty;

    return (
        <div className="paper-thumb" style={{ '--diff-color': cfg.color, '--diff-bg': cfg.bg, '--diff-gradient': cfg.gradient }}>
            {/* Top bar with logo */}
            <div className="paper-thumb-topbar">
                <img src={logo} alt="ReasoningWizard" className="paper-thumb-logo" />
                <span className="paper-thumb-brand">ReasoningWizard</span>
            </div>
            {/* Decorative lines mimicking text */}
            <div className="paper-thumb-lines">
                <span className="thumb-line long" />
                <span className="thumb-line medium" />
            </div>
            {/* Paper title centred */}
            <div className="paper-thumb-center">
                <p className="paper-thumb-title">{title}</p>
            </div>
            {/* Bottom accent */}
            <div className="paper-thumb-footer">
                <span className="paper-thumb-diff-badge">{badge}</span>
            </div>
            {/* Subtle corner fold */}
            <span className="paper-thumb-fold" />
        </div>
    );
}
