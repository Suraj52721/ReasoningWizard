import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
    const { user, profile, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-dark)'
            }}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{
                        width: 48,
                        height: 48,
                        border: '3px solid var(--border)',
                        borderTop: '3px solid var(--primary)',
                        borderRadius: '50%'
                    }}
                />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!profile?.is_admin) {
        return <Navigate to="/" replace />;
    }

    return children;
}
