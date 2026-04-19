import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Quiz from './Quiz';
import { FiLock } from 'react-icons/fi';

/**
 * PremiumQuizGate wraps the Quiz component and checks premium access before allowing entry.
 * - If the quiz is linked to a premium_nvr_worksheet → requires active nvr_subscription
 * - If the quiz is linked to a premium_test_paper    → requires completed test_paper_purchase
 * - If the quiz is not linked to any premium content → renders Quiz normally
 */
export default function PremiumQuizGate() {
  const { id: quizId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // 'checking' | 'granted' | 'free' | 'locked_nvr' | 'locked_tp'
  const [status, setStatus] = useState('checking');
  const [lockSubject, setLockSubject] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        // Not logged in — determine lock type to show correct CTA
        checkLockType();
      } else {
        checkAccess();
      }
    }
  }, [quizId, user, authLoading]);

  /** Checks lock type without user (to show the right locked page) */
  async function checkLockType() {
    const { data: nvrWs } = await supabase
      .from('premium_nvr_worksheets')
      .select('id, is_free')
      .eq('quiz_id', quizId)
      .maybeSingle();

    if (nvrWs) {
      if (nvrWs.is_free) { setStatus('granted'); return; }
      setStatus('locked_nvr');
      return;
    }

    const { data: tp } = await supabase
      .from('premium_test_papers')
      .select('id, subject, is_free')
      .eq('quiz_id', quizId)
      .maybeSingle();

    if (tp) {
      if (tp.is_free) { setStatus('granted'); return; }
      setLockSubject(tp.subject);
      setStatus('locked_tp');
      return;
    }

    // Not premium — but user must log in to take free quizzes too
    navigate('/login');
  }

  /** Checks access for logged-in user */
  async function checkAccess() {
    // Check NVR worksheet link
    const { data: nvrWs } = await supabase
      .from('premium_nvr_worksheets')
      .select('id, is_free')
      .eq('quiz_id', quizId)
      .maybeSingle();

    if (nvrWs) {
      if (nvrWs.is_free) { setStatus('granted'); return; }

      const { data: sub } = await supabase
        .from('nvr_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      setStatus(sub ? 'granted' : 'locked_nvr');
      return;
    }

    // Check test paper link
    const { data: tp } = await supabase
      .from('premium_test_papers')
      .select('id, subject, is_free')
      .eq('quiz_id', quizId)
      .maybeSingle();

    if (tp) {
      if (tp.is_free) { setStatus('granted'); return; }
      const { data: purchase } = await supabase
        .from('paper_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('paper_id', tp.id)
        .eq('status', 'completed')
        .maybeSingle();

      setLockSubject(tp.subject);
      setStatus(purchase ? 'granted' : 'locked_tp');
      return;
    }

    // Not a premium quiz — grant access (user is already logged in)
    setStatus('free');
  }

  if (status === 'checking' || authLoading) {
    return (
      <div style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <motion.div
          className="spinner"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }}
        />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Checking access…</p>
      </div>
    );
  }

  if (status === 'granted' || status === 'free') {
    return <Quiz />;
  }

  // Locked overlay
  return (
    <div className="page-container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
      <motion.div
        className="glass-card"
        style={{ maxWidth: 460, margin: '0 auto', padding: '2.5rem' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={{
          width: 72, height: 72,
          background: 'rgba(232,54,78,0.1)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem',
          fontSize: '1.8rem', color: 'var(--error)',
        }}>
          <FiLock />
        </div>

        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.75rem' }}>
          Premium Access Required
        </h2>

        {status === 'locked_nvr' ? (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.93rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              This quiz is part of the <strong>11+ NVR Worksheets</strong> subscription.
              Subscribe to unlock all worksheets and quizzes.
            </p>
            <button
              className="btn-primary"
              style={{ width: '100%', padding: '0.8rem' }}
              onClick={() => navigate('/nvr-worksheets')}
            >
              View NVR Worksheets &amp; Subscribe
            </button>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.93rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              This quiz is part of the <strong>{lockSubject}</strong> test papers bundle.
              Purchase the bundle once for lifetime access to all papers and quizzes.
            </p>
            <button
              className="btn-primary"
              style={{ width: '100%', padding: '0.8rem' }}
              onClick={() => navigate('/test-papers')}
            >
              View Test Papers &amp; Buy Bundle
            </button>
          </>
        )}

        <button
          className="btn-secondary"
          style={{ width: '100%', padding: '0.7rem', marginTop: '0.75rem' }}
          onClick={() => navigate(-1)}
        >
          Go Back
        </button>
      </motion.div>
    </div>
  );
}
