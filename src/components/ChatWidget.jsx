import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMessageCircle, FiX, FiSend } from 'react-icons/fi';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './ChatWidget.css';

export default function ChatWidget() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [unread, setUnread] = useState(0);
    const bottomRef = useRef(null);

    // Fetch messages when chat opens
    useEffect(() => {
        if (!open || !user) return;
        fetchMessages();

        // Subscribe to realtime updates
        const channel = supabase
            .channel('chat-' + user.id)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `user_id=eq.${user.id}`,
            }, (payload) => {
                setMessages(prev => [...prev, payload.new]);
                // Mark as read if from admin
                if (payload.new.sender === 'admin') {
                    supabase.from('chat_messages').update({ is_read: true }).eq('id', payload.new.id).then(() => { });
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [open, user]);

    // Check for unread messages periodically
    useEffect(() => {
        if (!user) return;
        checkUnread();
        const interval = setInterval(checkUnread, 30000);
        return () => clearInterval(interval);
    }, [user]);

    // Scroll to bottom when messages change
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function checkUnread() {
        if (!user) return;
        try {
            const { count } = await supabase
                .from('chat_messages')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('sender', 'admin')
                .eq('is_read', false);
            setUnread(count || 0);
        } catch { /* ignore */ }
    }

    async function fetchMessages() {
        if (!user) return;
        const { data } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })
            .limit(100);
        setMessages(data || []);

        // Mark admin messages as read
        await supabase
            .from('chat_messages')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('sender', 'admin')
            .eq('is_read', false);
        setUnread(0);
    }

    async function sendMessage(e) {
        e.preventDefault();
        if (!input.trim() || sending || !user) return;
        setSending(true);
        try {
            const { error } = await supabase.from('chat_messages').insert({
                user_id: user.id,
                sender: 'user',
                message: input.trim(),
            });
            if (!error) setInput('');
        } catch { /* ignore */ }
        setSending(false);
    }

    function handleOpen() {
        setOpen(true);
        setUnread(0);
    }

    if (!user) {
        // Show a static button that hints login is needed
        return (
            <button className="chat-float" onClick={() => setOpen(!open)} aria-label="Chat with us">
                <FiMessageCircle />
                <AnimatePresence>
                    {open && (
                        <motion.div className="chat-login-hint glass-card" initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }}>
                            <p>Please <strong>sign in</strong> to chat with us!</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </button>
        );
    }

    return (
        <>
            {/* Floating Button */}
            <button className="chat-float" onClick={handleOpen} aria-label="Chat with us">
                <FiMessageCircle />
                {unread > 0 && <span className="chat-float-badge">{unread}</span>}
            </button>

            {/* Chat Panel */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        className="chat-panel glass-card"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                    >
                        {/* Header */}
                        <div className="chat-header">
                            <div className="chat-header-info">
                                <div className="chat-avatar">RW</div>
                                <div>
                                    <h4>Reasoning Wizard</h4>
                                    <span className="chat-status">We typically reply within a few hours</span>
                                </div>
                            </div>
                            <button className="chat-close" onClick={() => setOpen(false)}><FiX /></button>
                        </div>

                        {/* Messages */}
                        <div className="chat-messages">
                            {messages.length === 0 && (
                                <div className="chat-welcome">
                                    <p>👋 Hi there! How can we help you?</p>
                                    <small>Send us a message and we'll get back to you soon.</small>
                                </div>
                            )}
                            {messages.map(m => (
                                <div key={m.id} className={`chat-msg ${m.sender === 'user' ? 'chat-msg-user' : 'chat-msg-admin'}`}>
                                    <div className="chat-bubble">{m.message}</div>
                                    <span className="chat-time">
                                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                            <div ref={bottomRef} />
                        </div>

                        {/* Input */}
                        <form className="chat-input-area" onSubmit={sendMessage}>
                            <input
                                type="text"
                                placeholder="Type a message…"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                maxLength={500}
                            />
                            <button type="submit" disabled={!input.trim() || sending} className="chat-send">
                                <FiSend />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
