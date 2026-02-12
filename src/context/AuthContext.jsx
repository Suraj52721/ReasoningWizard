import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user.id);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user.id);
            else setProfile(null);
        });

        return () => subscription.unsubscribe();
    }, []);

    async function fetchProfile(userId) {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        setProfile(data);
    }

    async function signUpWithEmail(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
        });
        return { data, error };
    }

    async function signInWithEmail(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        return { data, error };
    }

    async function signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/dashboard' }
        });
        return { data, error };
    }

    async function sendOtp(phone) {
        const { data, error } = await supabase.auth.signInWithOtp({ phone });
        return { data, error };
    }

    async function verifyOtp(phone, token) {
        const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
        return { data, error };
    }

    async function signOut() {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
    }

    async function updateProfile(updates) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id)
            .select()
            .single();
        if (data) setProfile(data);
        return { data, error };
    }

    const value = {
        user,
        session,
        profile,
        loading,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        sendOtp,
        verifyOtp,
        signOut,
        updateProfile,
        fetchProfile,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
