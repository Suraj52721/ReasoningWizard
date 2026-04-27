import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
    FiPlus, FiTrash2, FiSave, FiCalendar, FiClock, FiList,
    FiEdit2, FiCheck, FiAlertTriangle, FiFileText, FiEye, FiX, FiImage, FiUpload,
    FiUsers, FiGlobe, FiMonitor, FiSearch, FiChevronLeft, FiChevronRight,
    FiFilter, FiBarChart2, FiArrowUp, FiArrowDown, FiLock, FiSmartphone,
    FiExternalLink, FiDollarSign, FiTag, FiUserCheck, FiMessageCircle, FiSend
} from 'react-icons/fi';
import { compressImage } from '../utils/imageCompressor';
import './Admin.css';

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } })
};

const SUBJECTS = ['11+ Mathematics', 'Science', 'English', 'History', 'Geography', 'General Knowledge', 'Reasoning', 'Verbal Reasoning', 'Non-Verbal Reasoning'];

function parseBulkQuestions(text, includeOptionE = false) {
    const blocks = text.trim().split(/\n\s*\n/);
    const parsed = [];
    const optionPattern = includeOptionE ? /^[A-E][:.)]\s*/i : /^[A-D][:.)]\s*/i;
    for (const block of blocks) {
        const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 3) continue;

        let questionText = '';
        const options = [];
        let correctOption = 0;
        let solution = '';
        let capturingSolution = false;

        let solutionImage = null;

        for (const line of lines) {
            if (/^Q[:.)]\s*/i.test(line)) {
                questionText = line.replace(/^Q[:.)]\s*/i, '').trim();
                capturingSolution = false;
            } else if (optionPattern.test(line)) {
                let optText = line.replace(optionPattern, '').trim();
                const isCorrect = optText.endsWith('*');
                if (isCorrect) {
                    optText = optText.slice(0, -1).trim();
                    correctOption = options.length;
                }
                options.push(optText);
                capturingSolution = false;
            } else if (/^(Sol|Solution|Exp|Explanation)[:.)]\s*/i.test(line)) {
                const solText = line.replace(/^(Sol|Solution|Exp|Explanation)[:.)]\s*/i, '').trim();
                if (solText) {
                    solution = solText;
                }
                capturingSolution = true;
            } else if (/^Sol?Image:\s*/i.test(line) || /^SolutionImage:\s*/i.test(line)) {
                solutionImage = line.replace(/^Sol?Image:\s*/i, '').replace(/^SolutionImage:\s*/i, '').trim();
                capturingSolution = false;
            } else if (capturingSolution) {
                solution += (solution ? '\n' : '') + line;
            }
        }

        if (questionText && options.length >= 2) {
            parsed.push({
                question_text: questionText,
                options,
                correct_option: correctOption,
                solution: solution,
                solution_image: solutionImage,
                imageFile: null,
                imagePreview: null,
                solutionImageFile: null,
                solutionImagePreview: null
            });
        }
    }
    return parsed;
}

export default function Admin() {
    const { profile } = useAuth();
    const isReadOnly = profile?.admin_role === 'read_only_admin';
    const [tab, setTab] = useState(isReadOnly ? 'manage' : 'create');
    const [quizzes, setQuizzes] = useState([]);
    const [loadingQuizzes, setLoadingQuizzes] = useState(true);

    // Quiz form
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('11+ Mathematics');
    const [quizDate, setQuizDate] = useState(new Date().toISOString().split('T')[0]);
    const [duration, setDuration] = useState(10);
    const [negativeMarking, setNegativeMarking] = useState(false);
    const [negativeMarks, setNegativeMarks] = useState(0.25);
    const [quizScope, setQuizScope] = useState('dashboard');

    // Questions
    const [inputMode, setInputMode] = useState('bulk'); // bulk | manual
    const [bulkText, setBulkText] = useState('');
    const [questions, setQuestions] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [editingQuizId, setEditingQuizId] = useState(null);

    // State
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // Visitor analytics state
    const [visitors, setVisitors] = useState([]);
    const [visitorStats, setVisitorStats] = useState({ total: 0, unique: 0, today: 0, loggedIn: 0 });
    const [loadingVisitors, setLoadingVisitors] = useState(false);
    const [visitorSearch, setVisitorSearch] = useState('');
    const [visitorPage, setVisitorPage] = useState(0);
    const [visitorSort, setVisitorSort] = useState({ field: 'visited_at', dir: 'desc' });
    const VISITORS_PER_PAGE = 15;

    // Daily worksheets (for manage tab badges + inline quiz upload)
    const [worksheets, setWorksheets] = useState([]);
    const [worksheetPdfFile, setWorksheetPdfFile] = useState(null);
    const [existingWorksheet, setExistingWorksheet] = useState(null); // worksheet already linked to quiz being edited
    const [worksheetRemoved, setWorksheetRemoved] = useState(false);  // user clicked Remove on existing worksheet

    // Past papers tab
    const [pastPapers, setPastPapers] = useState([]);
    const [loadingPastPapers, setLoadingPastPapers] = useState(false);

    // ── Premium NVR Worksheets tab ──────────────────────────────
    const [premiumNVRWorksheets, setPremiumNVRWorksheets] = useState([]);
    const [loadingPremiumNVR, setLoadingPremiumNVR] = useState(false);
    const [nvrTitle, setNvrTitle] = useState('');
    const [nvrTopic, setNvrTopic] = useState('');
    const [nvrDifficulty, setNvrDifficulty] = useState('Medium');
    const [nvrDate, setNvrDate] = useState(new Date().toISOString().split('T')[0]);
    const [nvrIsFree, setNvrIsFree] = useState(false);
    const [nvrFile, setNvrFile] = useState(null);
    const [nvrQuizId, setNvrQuizId] = useState('');
    const [nvrSortOrder, setNvrSortOrder] = useState(0);
    const [nvrSaving, setNvrSaving] = useState(false);
    const [globalNvrPrice, setGlobalNvrPrice] = useState(7900);

    // ── Premium Test Papers tab ─────────────────────────────────
    const [premiumTestPapers, setPremiumTestPapers] = useState([]);
    const [loadingPremiumPapers, setLoadingPremiumPapers] = useState(false);
    const [testPaperBundles, setTestPaperBundles] = useState([]);
    const [tpTitle, setTpTitle] = useState('');
    const [tpSubject, setTpSubject] = useState('11+ Maths');
    const [tpSchool, setTpSchool] = useState('');

    // Purchases Data
    const [purchases, setPurchases] = useState([]);
    const [loadingPurchases, setLoadingPurchases] = useState(false);
    const [tpYear, setTpYear] = useState('');
    const [tpIsFree, setTpIsFree] = useState(false);
    const [tpFile, setTpFile] = useState(null);
    const [tpQuizId, setTpQuizId] = useState('');
    const [tpSortOrder, setTpSortOrder] = useState(0);
    const [tpSaving, setTpSaving] = useState(false);

    const [pendingQuizLink, setPendingQuizLink] = useState(null);
    const [adminMode, setAdminMode] = useState(null); // null (landing) | 'dashboard' | 'premium'

    // Compute which quiz IDs are linked to premium content
    const premiumQuizIds = useMemo(() => {
        const ids = new Set();
        premiumNVRWorksheets.forEach(ws => { if (ws.quiz_id) ids.add(ws.quiz_id); });
        premiumTestPapers.forEach(p => { if (p.quiz_id) ids.add(p.quiz_id); });
        return ids;
    }, [premiumNVRWorksheets, premiumTestPapers]);

    const resolveQuizScope = (quiz) => quiz.quiz_mode || (premiumQuizIds.has(quiz.id) ? 'premium' : 'dashboard');

    // Filtered quiz lists for each mode
    const dashboardQuizzes = useMemo(() => quizzes.filter(q => resolveQuizScope(q) === 'dashboard'), [quizzes, premiumQuizIds]);
    const premiumQuizzes = useMemo(() => quizzes.filter(q => resolveQuizScope(q) === 'premium'), [quizzes, premiumQuizIds]);
    const filteredQuizzes = adminMode === 'premium' ? premiumQuizzes : dashboardQuizzes;
    const isPremiumQuizScope = quizScope === 'premium';
    const optionCount = isPremiumQuizScope ? 5 : 4;

    // For NVR/TP selectors: only show premium quizzes
    const premiumQuizChoices = useMemo(() => (
        quizzes.filter(q => resolveQuizScope(q) === 'premium').map(quiz => ({
            value: quiz.id,
            label: `${quiz.title} · ${quiz.subject}${quiz.quiz_date ? ` · ${quiz.quiz_date}` : ''}${quiz.is_draft ? ' · Draft' : ''}`,
        }))
    ), [quizzes, premiumQuizIds]);

    const purchaseSummary = useMemo(() => {
        const successfulPurchases = purchases.filter(purchase => ['completed', 'active'].includes((purchase.status || '').toLowerCase()));
        const totalRevenue = successfulPurchases.reduce((sum, purchase) => sum + (Number(purchase.amount_pence) || 0), 0);
        const nvrSubscriptions = successfulPurchases.filter(purchase => purchase.type === 'nvr_subscription').length;
        const paperPurchases = successfulPurchases.filter(purchase => purchase.type === 'paper_purchase').length;
        const activePayments = successfulPurchases.length;

        return {
            totalPurchases: successfulPurchases.length,
            nvrSubscriptions,
            paperPurchases,
            activePayments,
            totalRevenue,
        };
    }, [purchases]);

    // Reports tab
    const [reports, setReports] = useState([]);
    const [loadingReports, setLoadingReports] = useState(false);
    const [ppTitle, setPpTitle] = useState('');
    const [ppYear, setPpYear] = useState('');
    const [ppSubject, setPpSubject] = useState('11+ Mathematics');
    const [ppDifficulty, setPpDifficulty] = useState('Medium');
    const [ppFile, setPpFile] = useState(null);
    const [ppSaving, setPpSaving] = useState(false);

    // Students tab
    const [students, setStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');

    // Coupons
    const [coupons, setCoupons] = useState([]);
    const [loadingCoupons, setLoadingCoupons] = useState(false);
    const [couponCode, setCouponCode] = useState('');
    const [couponType, setCouponType] = useState('percentage');
    const [couponValue, setCouponValue] = useState('');
    const [couponMaxUses, setCouponMaxUses] = useState('');
    const [couponMinCart, setCouponMinCart] = useState('');
    const [couponExpiry, setCouponExpiry] = useState('');
    const [couponSaving, setCouponSaving] = useState(false);

    // Chat management
    const [chatThreads, setChatThreads] = useState([]);
    const [loadingChats, setLoadingChats] = useState(false);
    const [selectedThread, setSelectedThread] = useState(null);
    const [threadMessages, setThreadMessages] = useState([]);
    const [adminReply, setAdminReply] = useState('');
    const [sendingReply, setSendingReply] = useState(false);

    // Student sorting
    const [studentSortField, setStudentSortField] = useState('name');
    const [studentSortDir, setStudentSortDir] = useState('asc');

    useEffect(() => {
        fetchQuizzes();
        fetchWorksheets();
        fetchPremiumNVR();
        fetchPremiumTestPapers();
    }, []);

    useEffect(() => {
        if (tab === 'visitors') fetchVisitors();
        if (tab === 'pastpapers') fetchPastPapers();
        if (tab === 'reports') fetchReports();
        if (tab === 'premium_nvr') fetchPremiumNVR();
        if (tab === 'premium_papers') { fetchPremiumTestPapers(); fetchTestPaperBundles(); }
        if (tab === 'premium_purchases') { fetchPurchases(); fetchCoupons(); }
        if (tab === 'students') fetchStudents();
        if (tab === 'chats') fetchChatThreads();
    }, [tab]);

    useEffect(() => {
        if (tab === 'chats' && chatThreads.length > 0 && !selectedThread) {
            fetchThreadMessages(chatThreads[0].userId);
        }
    }, [tab, chatThreads, selectedThread]);

    // ── Purchases ──────────────────────────────────────────────
    async function fetchPurchases() {
        setLoadingPurchases(true);
        try {
            // Fetch NVR and paper purchases
            const [nvrRes, paperRes] = await Promise.all([
                supabase.from('nvr_subscriptions').select('*').order('created_at', { ascending: false }),
                supabase.from('paper_purchases').select('*, papers:premium_test_papers(title)').order('created_at', { ascending: false })
            ]);

            const allPurchases = [
                ...(nvrRes.data || []).map(p => ({ ...p, type: 'nvr_subscription', itemName: 'NVR Subscription' })),
                ...(paperRes.data || []).map(p => ({ ...p, type: 'paper_purchase', itemName: p.papers?.title || 'Single Paper' }))
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // Fetch profiles for the users in these purchases
            const userIds = [...new Set(allPurchases.map(p => p.user_id).filter(Boolean))];
            let profilesMap = {};
            if (userIds.length > 0) {
                const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', userIds);
                if (profiles) {
                    profiles.forEach(pr => { profilesMap[pr.id] = pr.display_name });
                }
            }

            // Attach display names
            allPurchases.forEach(p => {
                p.display_name = profilesMap[p.user_id] || 'Anonymous User';
            });

            setPurchases(allPurchases);
        } catch (err) {
            console.error('Fetch purchases error:', err);
        } finally {
            setLoadingPurchases(false);
        }
    }

    async function fetchQuizzes() {
        setLoadingQuizzes(true);
        const { data } = await supabase
            .from('quizzes')
            .select('*, questions(count), quiz_mode')
            .order('quiz_date', { ascending: false })
            .limit(50);
        setQuizzes(data || []);
        setLoadingQuizzes(false);
    }

    async function fetchWorksheets() {
        const [{ data }, { data: logs, error: logsError }] = await Promise.all([
            supabase.from('daily_worksheets').select('id, quiz_id, title, subject, worksheet_date, file_url, file_name, file_path, download_count').order('worksheet_date', { ascending: false }).limit(200),
            supabase.from('download_logs').select('resource_id').eq('resource_type', 'worksheet'),
        ]);
        const countMap = (logs || []).reduce((acc, d) => { acc[d.resource_id] = (acc[d.resource_id] || 0) + 1; return acc; }, {});
        setWorksheets((data || []).map(w => ({
            ...w,
            download_count: logsError
                ? (w.download_count || 0)
                : ((countMap[w.id] || 0) + (w.download_count || 0)),
        })));
    }

    async function fetchPastPapers() {
        setLoadingPastPapers(true);
        const [{ data: papers }, { data: logs, error: logsError }] = await Promise.all([
            supabase.from('past_papers').select('*').order('year', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
            supabase.from('download_logs').select('resource_id').eq('resource_type', 'past_paper'),
        ]);
        const countMap = (logs || []).reduce((acc, d) => { acc[d.resource_id] = (acc[d.resource_id] || 0) + 1; return acc; }, {});
        setPastPapers((papers || []).map(p => ({
            ...p,
            download_count: logsError
                ? (p.download_count || 0)
                : ((countMap[p.id] || 0) + (p.download_count || 0)),
        })));
        setLoadingPastPapers(false);
    }

    async function savePastPaper() {
        if (!ppTitle.trim()) { setMessage({ type: 'error', text: 'Title is required.' }); return; }
        if (!ppFile) { setMessage({ type: 'error', text: 'Please select a PDF file.' }); return; }
        setPpSaving(true);
        try {
            const safeFileName = ppFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filePath = `${ppDifficulty.toLowerCase()}/${Date.now()}_${safeFileName}`;
            const { error: uploadError } = await supabase.storage
                .from('past_papers')
                .upload(filePath, ppFile, { contentType: 'application/pdf', upsert: false });
            if (uploadError) throw uploadError;
            const { data: publicData } = supabase.storage.from('past_papers').getPublicUrl(filePath);
            const { error: insertError } = await supabase.from('past_papers').insert({
                title: ppTitle.trim(),
                year: ppYear ? parseInt(ppYear) : null,
                subject: ppSubject,
                difficulty: ppDifficulty,
                file_name: ppFile.name,
                file_path: filePath,
                file_url: publicData.publicUrl,
                uploaded_by: (await supabase.auth.getUser()).data.user?.id,
            });
            if (insertError) throw insertError;
            setMessage({ type: 'success', text: 'Past paper uploaded successfully!' });
            setPpTitle(''); setPpYear(''); setPpFile(null); setPpDifficulty('Medium'); setPpSubject('11+ Mathematics');
            fetchPastPapers();
        } catch (err) {
            setMessage({ type: 'error', text: `Upload failed: ${err.message}` });
        }
        setPpSaving(false);
    }

    async function deletePastPaper(paper) {
        if (!window.confirm(`Delete "${paper.title}"? This cannot be undone.`)) return;
        await supabase.storage.from('past_papers').remove([paper.file_path]);
        await supabase.from('past_papers').delete().eq('id', paper.id);
        setPastPapers(prev => prev.filter(p => p.id !== paper.id));
        setMessage({ type: 'success', text: 'Paper deleted.' });
    }

    async function fetchReports() {
        setLoadingReports(true);
        const { data } = await supabase
            .from('question_reports')
            .select('*, questions(question_text, quiz_id), quizzes(title)')
            .order('created_at', { ascending: false })
            .limit(200);
        setReports(data || []);
        setLoadingReports(false);
    }

    async function updateReportStatus(reportId, status) {
        await supabase.from('question_reports').update({ status }).eq('id', reportId);
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
    }

    // ── Students ──────────────────────────────────────────────
    async function fetchStudents() {
        setLoadingStudents(true);
        try {
            // Get all profiles, including email when available in schema.
            let profiles = [];
            const profilesWithEmail = await supabase
                .from('profiles')
                .select('id, display_name, is_admin, email')
                .order('display_name');

            if (profilesWithEmail.error) {
                const profilesFallback = await supabase
                    .from('profiles')
                    .select('id, display_name, is_admin')
                    .order('display_name');
                profiles = profilesFallback.data || [];
            } else {
                profiles = profilesWithEmail.data || [];
            }

            // Get quiz attempts grouped by user
            const { data: attempts } = await supabase
                .from('quiz_attempts')
                .select('user_id, score, total_questions');

            // Fetch missing emails from a secure admin edge function backed by auth.admin API.
            const studentIdsWithoutEmail = profiles
                .filter(p => !p.is_admin && !(p.email || '').trim())
                .map(p => p.id);
            const emailByUser = {};

            if (studentIdsWithoutEmail.length > 0) {
                const { data: emailFnData, error: emailFnError } = await supabase.functions.invoke('admin-student-emails', {
                    body: { user_ids: studentIdsWithoutEmail },
                });

                if (!emailFnError && Array.isArray(emailFnData?.emails)) {
                    emailFnData.emails.forEach((row) => {
                        if (row?.id && row?.email) {
                            emailByUser[row.id] = row.email;
                        }
                    });
                }

                // Secondary fallback: latest email captured in visitor logs.
                const stillMissing = studentIdsWithoutEmail.filter((id) => !emailByUser[id]);
                if (stillMissing.length > 0) {
                    const { data: visitorRows } = await supabase
                        .from('site_visitors')
                        .select('user_id, user_email, visited_at')
                        .in('user_id', stillMissing)
                        .neq('user_email', '')
                        .order('visited_at', { ascending: false });

                    (visitorRows || []).forEach(v => {
                        if (!emailByUser[v.user_id] && v.user_email) {
                            emailByUser[v.user_id] = v.user_email;
                        }
                    });
                }
            }

            const attemptsByUser = {};
            (attempts || []).forEach(a => {
                if (!attemptsByUser[a.user_id]) attemptsByUser[a.user_id] = [];
                attemptsByUser[a.user_id].push(a);
            });

            const studentData = (profiles || [])
                .filter(p => !p.is_admin)
                .map(p => {
                    const userAttempts = attemptsByUser[p.id] || [];
                    const totalQuizzes = userAttempts.length;
                    let avgPercent = 0;
                    if (totalQuizzes > 0) {
                        const percentages = userAttempts.map(a =>
                            a.total_questions > 0 ? (a.score / a.total_questions) * 100 : 0
                        );
                        avgPercent = percentages.reduce((sum, val) => sum + val, 0) / totalQuizzes;
                    }
                    return {
                        id: p.id,
                        name: p.display_name || 'Anonymous',
                        email: (p.email || emailByUser[p.id] || '').trim(),
                        totalQuizzes,
                        avgPercent: Math.round(avgPercent * 10) / 10,
                    };
                });

            setStudents(studentData);
        } catch (err) {
            console.error('Failed to fetch students:', err);
        } finally {
            setLoadingStudents(false);
        }
    }

    // ── Coupons ──────────────────────────────────────────────
    async function fetchCoupons() {
        setLoadingCoupons(true);
        try {
            const { data } = await supabase
                .from('coupon_codes')
                .select('*')
                .order('created_at', { ascending: false });
            setCoupons(data || []);
        } catch (err) {
            console.error('Failed to fetch coupons:', err);
        } finally {
            setLoadingCoupons(false);
        }
    }

    async function saveCoupon() {
        if (!couponCode.trim()) { setMessage({ type: 'error', text: 'Coupon code is required.' }); return; }
        if (!couponValue || Number(couponValue) <= 0) { setMessage({ type: 'error', text: 'Discount value must be > 0.' }); return; }
        if (couponType === 'percentage' && Number(couponValue) > 100) { setMessage({ type: 'error', text: 'Percentage cannot exceed 100.' }); return; }

        setCouponSaving(true);
        try {
            const { error } = await supabase.from('coupon_codes').insert({
                code: couponCode.trim().toUpperCase(),
                discount_type: couponType,
                discount_value: parseInt(couponValue),
                max_uses: couponMaxUses ? parseInt(couponMaxUses) : null,
                min_cart_pence: couponMinCart ? parseInt(couponMinCart) : 0,
                expires_at: couponExpiry || null,
                is_active: true,
            });
            if (error) throw error;
            setMessage({ type: 'success', text: `Coupon "${couponCode.trim().toUpperCase()}" created!` });
            setCouponCode(''); setCouponValue(''); setCouponMaxUses(''); setCouponMinCart(''); setCouponExpiry('');
            fetchCoupons();
        } catch (err) {
            setMessage({ type: 'error', text: `Failed: ${err.message}` });
        } finally {
            setCouponSaving(false);
        }
    }

    async function deleteCoupon(coupon) {
        if (!window.confirm(`Delete coupon "${coupon.code}"?`)) return;
        await supabase.from('coupon_codes').delete().eq('id', coupon.id);
        setCoupons(prev => prev.filter(c => c.id !== coupon.id));
        setMessage({ type: 'success', text: 'Coupon deleted.' });
    }

    async function toggleCouponActive(coupon) {
        await supabase.from('coupon_codes').update({ is_active: !coupon.is_active }).eq('id', coupon.id);
        setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c));
    }

    // ── Chat Management ──────────────────────────────────────
    async function fetchChatThreads() {
        setLoadingChats(true);
        try {
            // Get all chat messages
            const { data: allMsgs } = await supabase
                .from('chat_messages')
                .select('*')
                .order('created_at', { ascending: false });

            if (!allMsgs || allMsgs.length === 0) { setChatThreads([]); setLoadingChats(false); return; }

            // Group by user_id
            const users = {};
            allMsgs.forEach(m => {
                if (!users[m.user_id]) users[m.user_id] = { messages: [], unreadCount: 0 };
                users[m.user_id].messages.push(m);
                if (m.sender === 'user' && !m.is_read) users[m.user_id].unreadCount++;
            });

            // Get profiles for these users
            const userIds = Object.keys(users);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, display_name')
                .in('id', userIds);
            const profileMap = {};
            (profiles || []).forEach(p => { profileMap[p.id] = p.display_name || 'Anonymous'; });

            const threads = userIds.map(uid => ({
                userId: uid,
                userName: profileMap[uid] || 'Unknown',
                unreadCount: users[uid].unreadCount,
                lastMessage: users[uid].messages[0],
                messageCount: users[uid].messages.length,
            }));

            // Sort: unread first, then by latest message
            threads.sort((a, b) => {
                if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
                if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
                return new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at);
            });

            setChatThreads(threads);
        } catch (err) {
            console.error('Failed to fetch chat threads:', err);
        } finally {
            setLoadingChats(false);
        }
    }

    async function fetchThreadMessages(userId) {
        setSelectedThread(userId);
        const { data } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });
        setThreadMessages(data || []);

        // Mark user messages as read
        await supabase
            .from('chat_messages')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('sender', 'user')
            .eq('is_read', false);

        // Update thread unread count locally
        setChatThreads(prev => prev.map(t =>
            t.userId === userId ? { ...t, unreadCount: 0 } : t
        ));
    }

    async function sendAdminReply() {
        if (!adminReply.trim() || !selectedThread) return;
        setSendingReply(true);
        try {
            const { data, error } = await supabase.from('chat_messages').insert({
                user_id: selectedThread,
                sender: 'admin',
                message: adminReply.trim(),
            }).select().single();
            if (!error && data) {
                setThreadMessages(prev => [...prev, data]);
                setAdminReply('');
            }
        } catch { /* ignore */ }
        setSendingReply(false);
    }

    // ── Premium NVR Worksheets ───────────────────────────────────
    async function fetchPremiumNVR() {
        setLoadingPremiumNVR(true);
        const { data } = await supabase
            .from('premium_nvr_worksheets')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        setPremiumNVRWorksheets(data || []);

        try {
            const { data: priceData } = await supabase.from('app_settings').select('value').eq('key', 'nvr_sub_price_pence').single();
            if (priceData && priceData.value) setGlobalNvrPrice(parseInt(priceData.value, 10));
        } catch (e) {
            console.error('Failed to fetch global NVR price:', e);
        }

        setLoadingPremiumNVR(false);
    }

    async function updateGlobalNvrPrice() {
        const p = prompt("Enter new global NVR Subscription price in pence (£1 = 100):", globalNvrPrice);
        if (!p || isNaN(p) || parseInt(p) < 0) return;

        const { error } = await supabase.from('app_settings').upsert({ key: 'nvr_sub_price_pence', value: parseInt(p).toString() });
        if (error) setMessage({ type: 'error', text: 'Error updating subscription price.' });
        else {
            setMessage({ type: 'success', text: 'NVR Subscription price updated globally!' });
            setGlobalNvrPrice(parseInt(p));
        }
    }

    async function savePremiumNVR() {
        if (!nvrTitle.trim()) { setMessage({ type: 'error', text: 'Worksheet title is required.' }); return; }
        if (!nvrFile && !nvrTitle) { setMessage({ type: 'error', text: 'Please provide a title.' }); return; }
        setNvrSaving(true);
        try {
            let fileUrl = null;
            let filePath = null;
            let fileName = null;
            if (nvrFile) {
                const safeFileName = nvrFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                filePath = `${Date.now()}_${safeFileName}`;
                fileName = nvrFile.name;
                const { error: uploadError } = await supabase.storage
                    .from('premium_nvr_worksheets')
                    .upload(filePath, nvrFile, { contentType: 'application/pdf', upsert: false });
                if (uploadError) throw uploadError;
                const { data: publicData } = supabase.storage.from('premium_nvr_worksheets').getPublicUrl(filePath);
                fileUrl = publicData.publicUrl;
            }
            const { error: insertError } = await supabase.from('premium_nvr_worksheets').insert({
                title: nvrTitle.trim(),
                topic: nvrTopic.trim() || null,
                difficulty: nvrDifficulty,
                worksheet_date: nvrDate || null,
                file_name: fileName,
                file_path: filePath,
                file_url: fileUrl,
                quiz_id: nvrQuizId.trim() || null,
                is_free: nvrIsFree,
                sort_order: parseInt(nvrSortOrder) || 0,
                uploaded_by: (await supabase.auth.getUser()).data.user?.id,
            });
            if (insertError) throw insertError;

            if (nvrQuizId.trim()) {
                await supabase
                    .from('quizzes')
                    .update({ quiz_mode: 'premium' })
                    .eq('id', nvrQuizId.trim());
            }

            setMessage({ type: 'success', text: 'Premium NVR worksheet added successfully!' });
            setNvrTitle(''); setNvrTopic(''); setNvrFile(null); setNvrQuizId(''); setNvrIsFree(false); setNvrSortOrder(0);
            fetchPremiumNVR();
            fetchQuizzes();
        } catch (err) {
            setMessage({ type: 'error', text: `Failed: ${err.message}` });
        }
        setNvrSaving(false);
    }

    async function deletePremiumNVR(ws) {
        if (!window.confirm(`Delete "${ws.title}"? This cannot be undone.`)) return;
        if (ws.file_path) await supabase.storage.from('premium_nvr_worksheets').remove([ws.file_path]);
        await supabase.from('premium_nvr_worksheets').delete().eq('id', ws.id);
        setPremiumNVRWorksheets(prev => prev.filter(w => w.id !== ws.id));
        setMessage({ type: 'success', text: 'Worksheet deleted.' });
    }

    async function toggleNVRFree(ws) {
        await supabase.from('premium_nvr_worksheets').update({ is_free: !ws.is_free }).eq('id', ws.id);
        setPremiumNVRWorksheets(prev => prev.map(w => w.id === ws.id ? { ...w, is_free: !w.is_free } : w));
    }

    async function editTestPaperPrice(paper) {
        const p = prompt(`Enter new price in pence for "${paper.title}":`, paper.price_pence || 0);
        if (!p || isNaN(p) || parseInt(p) < 0) return;

        const { error } = await supabase.from('premium_test_papers').update({ price_pence: parseInt(p) }).eq('id', paper.id);
        if (error) setMessage({ type: 'error', text: 'Error updating price' });
        else {
            setMessage({ type: 'success', text: 'Test paper price updated successfully!' });
            fetchPremiumTestPapers();
        }
    }

    // ── Premium Test Papers ──────────────────────────────────────
    async function fetchPremiumTestPapers() {
        setLoadingPremiumPapers(true);
        const { data } = await supabase
            .from('premium_test_papers')
            .select('*')
            .order('subject', { ascending: true })
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        setPremiumTestPapers(data || []);
        setLoadingPremiumPapers(false);
    }

    async function fetchTestPaperBundles() {
        const { data } = await supabase.from('test_paper_bundles').select('*').order('subject');
        setTestPaperBundles(data || []);
    }

    async function savePremiumTestPaper() {
        if (!tpTitle.trim()) { setMessage({ type: 'error', text: 'Paper title is required.' }); return; }
        setTpSaving(true);
        try {
            let fileUrl = null;
            let filePath = null;
            let fileName = null;
            if (tpFile) {
                const safeFileName = tpFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                filePath = `${tpSubject.replace(/\W/g, '_').toLowerCase()}/${Date.now()}_${safeFileName}`;
                fileName = tpFile.name;
                const { error: uploadError } = await supabase.storage
                    .from('premium_test_papers')
                    .upload(filePath, tpFile, { contentType: 'application/pdf', upsert: false });
                if (uploadError) throw uploadError;
                const { data: publicData } = supabase.storage.from('premium_test_papers').getPublicUrl(filePath);
                fileUrl = publicData.publicUrl;
            }
            const { error: insertError } = await supabase.from('premium_test_papers').insert({
                title: tpTitle.trim(),
                subject: tpSubject,
                school_name: tpSchool.trim() || null,
                year: tpYear ? parseInt(tpYear) : null,
                file_name: fileName,
                file_path: filePath,
                file_url: fileUrl,
                quiz_id: tpQuizId.trim() || null,
                is_free: tpIsFree,
                sort_order: parseInt(tpSortOrder) || 0,
                uploaded_by: (await supabase.auth.getUser()).data.user?.id,
            });
            if (insertError) throw insertError;

            if (tpQuizId.trim()) {
                await supabase
                    .from('quizzes')
                    .update({ quiz_mode: 'premium' })
                    .eq('id', tpQuizId.trim());
            }

            setMessage({ type: 'success', text: 'Premium test paper added successfully!' });
            setTpTitle(''); setTpSchool(''); setTpYear(''); setTpFile(null); setTpQuizId(''); setTpIsFree(false); setTpSortOrder(0);
            fetchPremiumTestPapers();
            fetchQuizzes();
        } catch (err) {
            setMessage({ type: 'error', text: `Failed: ${err.message}` });
        }
        setTpSaving(false);
    }

    async function deletePremiumTestPaper(paper) {
        if (!window.confirm(`Delete "${paper.title}"? This cannot be undone.`)) return;
        try {
            // Remove dependent purchases first to avoid FK block on premium_test_papers delete.
            const { error: purchasesDeleteError } = await supabase
                .from('paper_purchases')
                .delete()
                .eq('paper_id', paper.id);

            if (purchasesDeleteError) throw purchasesDeleteError;

            const { error: paperDeleteError } = await supabase
                .from('premium_test_papers')
                .delete()
                .eq('id', paper.id);

            if (paperDeleteError) throw paperDeleteError;

            // Best-effort storage cleanup after DB row is removed.
            if (paper.file_path) {
                const { error: storageDeleteError } = await supabase.storage
                    .from('premium_test_papers')
                    .remove([paper.file_path]);
                if (storageDeleteError) {
                    console.warn('Deleted DB row but failed to remove file from storage:', storageDeleteError.message);
                }
            }

            setPremiumTestPapers(prev => prev.filter(p => p.id !== paper.id));
            setMessage({ type: 'success', text: 'Paper deleted.' });
        } catch (err) {
            setMessage({ type: 'error', text: `Failed to delete paper: ${err.message}` });
        }
    }

    async function toggleTestPaperFree(paper) {
        await supabase.from('premium_test_papers').update({ is_free: !paper.is_free }).eq('id', paper.id);
        setPremiumTestPapers(prev => prev.map(p => p.id === paper.id ? { ...p, is_free: !p.is_free } : p));
    }

    async function updateBundlePrice(bundleId, pricePaise) {
        await supabase.from('test_paper_bundles').update({ price_pence: pricePaise }).eq('id', bundleId);
        setTestPaperBundles(prev => prev.map(b => b.id === bundleId ? { ...b, price_pence: pricePaise } : b));
        setMessage({ type: 'success', text: 'Bundle price updated.' });
    }

    function startLinkedQuizDraft({ target, title, subject, returnTab }) {
        setPendingQuizLink({ target, returnTab });
        setEditingQuizId(null);
        setQuizScope('premium');
        setTitle(title || '');
        setSubject(subject);
        setQuizDate(new Date().toISOString().split('T')[0]);
        setDuration(10);
        setNegativeMarking(false);
        setNegativeMarks(0.25);
        setInputMode('bulk');
        setBulkText('');
        setQuestions([]);
        setShowPreview(false);
        setAdminMode('premium');
        setTab('create');
        setMessage({ type: 'success', text: 'Create the quiz here, then it will link back to the premium content tab.' });
    }

    async function loadQuizForEditing(quiz) {
        setLoadingQuizzes(true);
        // Fetch full questions
        const { data: qData, error } = await supabase.from('questions').select('*').eq('quiz_id', quiz.id).order('sort_order');
        if (error) {
            setMessage({ type: 'error', text: 'Failed to load quiz details.' });
            setLoadingQuizzes(false);
            return;
        }

        setTitle(quiz.title);
        setSubject(quiz.subject);
        setQuizDate(quiz.quiz_date);
        setDuration(quiz.duration_minutes);
        setNegativeMarking(quiz.negative_marking);
        setNegativeMarks(quiz.negative_marks || 0.25);
        const resolvedScope = resolveQuizScope(quiz);
        const emptyOptions = resolvedScope === 'premium'
            ? ['', '', '', '', '']
            : ['', '', '', ''];
        setQuizScope(resolvedScope);

        // Fetch linked worksheet
        const { data: wsData } = await supabase
            .from('daily_worksheets')
            .select('id, quiz_id, title, file_url, file_name, file_path')
            .eq('quiz_id', quiz.id)
            .maybeSingle();
        setExistingWorksheet(wsData || null);
        setWorksheetRemoved(false);
        setWorksheetPdfFile(null);

        const loadedQuestions = (qData || []).map(q => {
            let parsedOpts = q.options;
            if (typeof parsedOpts === 'string') {
                try {
                    parsedOpts = JSON.parse(parsedOpts);
                } catch (e) {
                    parsedOpts = [...emptyOptions];
                }
            }
            if (!Array.isArray(parsedOpts)) {
                parsedOpts = [...emptyOptions];
            }

            const normalizedOpts = resolvedScope === 'premium'
                ? [...parsedOpts.slice(0, 5), ...Array(Math.max(0, 5 - parsedOpts.length)).fill('')]
                : parsedOpts.slice(0, 4);

            return {
                id: q.id,
                question_text: q.question_text || '',
                options: normalizedOpts,
                correct_option: q.correct_option || 0,
                solution: q.solution || '',
                solution_image: q.solution_image || null,
                image_url: q.image_url || null,
                imageFile: null,
                imagePreview: q.image_url || null,
                solutionImageFile: null,
                solutionImagePreview: q.solution_image || null
            };
        });

        setQuestions(loadedQuestions);
        setEditingQuizId(quiz.id);
        setInputMode('manual');
        setTab('create');
        setLoadingQuizzes(false);
    }

    function handleParseBulk() {
        const parsed = parseBulkQuestions(bulkText, isPremiumQuizScope).map((q) => ({
            ...q,
            options: isPremiumQuizScope
                ? [...q.options.slice(0, 5), ...Array(Math.max(0, 5 - q.options.length)).fill('')]
                : q.options.slice(0, 4),
        }));
        if (parsed.length === 0) {
            setMessage({ type: 'error', text: 'No valid questions found. Check the format.' });
            return;
        }
        setQuestions(parsed);
        setInputMode('manual');
        setMessage({ type: 'success', text: `Parsed ${parsed.length} questions! You can now upload images for them.` });
    }

    function addManualQuestion() {
        setQuestions([...questions, {
            id: null,
            question_text: '',
            options: isPremiumQuizScope ? ['', '', '', '', ''] : ['', '', '', ''],
            correct_option: 0,
            solution: '',
            solution_image: null,
            image_url: null,
            imageFile: null,
            imagePreview: null,
            solutionImageFile: null,
            solutionImagePreview: null
        }]);
    }

    function updateQuestion(index, field, value) {
        const updated = [...questions];
        updated[index] = { ...updated[index], [field]: value };
        setQuestions(updated);
    }

    function handleImageSelect(index, e, isSolution = false) {
        const file = e.target.files[0];
        if (file) {
            const updated = [...questions];
            if (isSolution) {
                updated[index].solutionImageFile = file;
                updated[index].solutionImagePreview = URL.createObjectURL(file);
            } else {
                updated[index].imageFile = file;
                updated[index].imagePreview = URL.createObjectURL(file);
            }
            setQuestions(updated);
        }
    }

    function removeImage(index, isSolution = false) {
        const updated = [...questions];
        if (isSolution) {
            updated[index].solutionImageFile = null;
            updated[index].solutionImagePreview = null;
            updated[index].solution_image = null; // Clear if it was from bulk paste
        } else {
            updated[index].imageFile = null;
            updated[index].imagePreview = null;
            updated[index].image_url = null;
        }
        setQuestions(updated);
    }

    function updateOption(qIndex, oIndex, value) {
        const updated = [...questions];
        const prevOpts = updated[qIndex].options;
        const newOpts = [...prevOpts];
        newOpts[oIndex] = value;
        updated[qIndex].options = newOpts;
        setQuestions(updated);
    }

    function removeQuestion(index) {
        setQuestions(questions.filter((_, i) => i !== index));
    }

    async function handlePublish(isDraft = false) {
        console.log('handlePublish started, isDraft:', isDraft);

        if (!title.trim()) {
            setMessage({ type: 'error', text: 'Please enter a quiz title.' });
            return;
        }
        if (questions.length === 0) {
            setMessage({ type: 'error', text: 'Add at least one question.' });
            return;
        }
        // Validate all questions have text and at least 2 options
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.question_text.trim()) {
                setMessage({ type: 'error', text: `Question ${i + 1} has no text.` });
                return;
            }
            const filledOpts = q.options.filter(o => o.trim());
            if (filledOpts.length < 2) {
                setMessage({ type: 'error', text: `Question ${i + 1} needs at least 2 options.` });
                return;
            }
        }

        setSaving(true);
        setMessage(null);

        try {
            // 1. Create or Update quiz
            let quizData;
            if (editingQuizId) {
                console.log('Updating quiz...');
                const { data, error: quizError } = await supabase
                    .from('quizzes')
                    .update({
                        title: title.trim(),
                        subject,
                        quiz_date: quizDate,
                        duration_minutes: duration,
                        negative_marking: negativeMarking,
                        negative_marks: negativeMarking ? negativeMarks : 0,
                        is_draft: isDraft,
                        quiz_mode: quizScope,
                    })
                    .eq('id', editingQuizId)
                    .select()
                    .single();

                if (quizError) {
                    console.error('Quiz update error:', quizError);
                    throw new Error(`Failed to update quiz: ${quizError.message}`);
                }
                quizData = data;
                console.log('Quiz updated:', quizData);
            } else {
                console.log('Creating quiz...');
                const { data, error: quizError } = await supabase
                    .from('quizzes')
                    .insert({
                        title: title.trim(),
                        subject,
                        quiz_date: quizDate,
                        duration_minutes: duration,
                        negative_marking: negativeMarking,
                        negative_marks: negativeMarking ? negativeMarks : 0,
                        is_draft: isDraft,
                        quiz_mode: quizScope,
                    })
                    .select()
                    .single();

                if (quizError) {
                    console.error('Quiz creation error:', quizError);
                    throw new Error(`Failed to create quiz: ${quizError.message}`);
                }
                quizData = data;
                console.log('Quiz created:', quizData);
            }

            // 1. Upload images first
            let uploadedQuestions = [];
            console.log('Processing images...');
            try {
                uploadedQuestions = await Promise.all(questions.map(async (q) => {
                    let finalImageUrl = q.image_url || '';
                    let finalSolutionImageUrl = q.solution_image || ''; // Use linked URL if provided

                    if (q.imageFile) {
                        const compressedFile = await compressImage(q.imageFile, 1200, 1200, 0.7);
                        const fileExt = compressedFile.name.split('.').pop();
                        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                        const { error: uploadError } = await supabase.storage
                            .from('quiz_images')
                            .upload(fileName, compressedFile);

                        if (uploadError) throw new Error(`Question image upload failed: ${uploadError.message}`);

                        const { data } = supabase.storage
                            .from('quiz_images')
                            .getPublicUrl(fileName);

                        finalImageUrl = data.publicUrl;
                    }

                    if (q.solutionImageFile) {
                        const compressedFile = await compressImage(q.solutionImageFile, 1200, 1200, 0.7);
                        const fileExt = compressedFile.name.split('.').pop();
                        const fileName = `sol-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                        const { error: uploadError } = await supabase.storage
                            .from('quiz_images')
                            .upload(fileName, compressedFile);

                        if (uploadError) throw new Error(`Solution image upload failed: ${uploadError.message}`);

                        const { data } = supabase.storage
                            .from('quiz_images')
                            .getPublicUrl(fileName);

                        finalSolutionImageUrl = data.publicUrl;
                    }

                    return {
                        id: q.id,
                        quiz_id: quizData.id,
                        question_text: q.question_text.trim(),
                        options: q.options.filter(o => o.trim()),
                        correct_option: q.correct_option,
                        solution: q.solution?.trim() || '',
                        image_url: finalImageUrl,
                        solution_image: finalSolutionImageUrl,
                    };
                }));
            } catch (err) {
                console.error('Image upload error:', err);
                // Delete created quiz to cleanup
                await supabase.from('quizzes').delete().eq('id', quizData.id);
                throw err;
            }

            // 2. Insert/Update questions with sorting
            const questionsPayload = uploadedQuestions.map((q, i) => {
                const payload = {
                    ...q,
                    sort_order: i + 1,
                };
                if (!payload.id) {
                    delete payload.id;
                }
                return payload;
            });

            // Delete questions that were removed in edit mode
            if (editingQuizId) {
                const keepIds = questionsPayload.map(q => q.id).filter(Boolean);
                if (keepIds.length > 0) {
                    await supabase.from('questions')
                        .delete()
                        .eq('quiz_id', editingQuizId)
                        .not('id', 'in', `(${keepIds.join(',')})`);
                } else {
                    await supabase.from('questions')
                        .delete()
                        .eq('quiz_id', editingQuizId);
                }
            }

            console.log('Upserting questions:', questionsPayload);
            const { error: qError } = await supabase.from('questions').upsert(questionsPayload);

            if (qError) {
                console.error('Question insertion error:', qError);
                throw new Error(`Quiz saved but failed to update questions: ${qError.message}`);
            }

            setMessage({ type: 'success', text: `Quiz "${title}" ${isDraft ? 'saved as draft' : (editingQuizId ? 'updated' : 'published')} with ${questions.length} questions!` });

            if (pendingQuizLink?.target === 'nvr') {
                setNvrQuizId(quizData.id);
                setTab(pendingQuizLink.returnTab || 'premium_nvr');
                setMessage({ type: 'success', text: `Quiz "${title}" saved and linked to the NVR worksheet draft.` });
                setPendingQuizLink(null);
            } else if (pendingQuizLink?.target === 'paper') {
                setTpQuizId(quizData.id);
                setTab(pendingQuizLink.returnTab || 'premium_papers');
                setMessage({ type: 'success', text: `Quiz "${title}" saved and linked to the test paper draft.` });
                setPendingQuizLink(null);
            }

            // Handle worksheet for this quiz
            try {
                if (worksheetPdfFile) {
                    // Delete existing worksheet if any (replace it)
                    if (existingWorksheet) {
                        await supabase.storage.from('daily_worksheets').remove([existingWorksheet.file_path]);
                        await supabase.from('daily_worksheets').delete().eq('id', existingWorksheet.id);
                    }
                    // Upload new worksheet linked to this quiz
                    const safeFileName = worksheetPdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeFileName}`;
                    const { error: uploadError } = await supabase.storage
                        .from('daily_worksheets')
                        .upload(filePath, worksheetPdfFile, { contentType: 'application/pdf', upsert: false });
                    if (!uploadError) {
                        const { data: publicData } = supabase.storage.from('daily_worksheets').getPublicUrl(filePath);
                        await supabase.from('daily_worksheets').insert({
                            title: title.trim(),
                            subject,
                            worksheet_date: quizDate,
                            quiz_id: quizData.id,
                            file_name: worksheetPdfFile.name,
                            file_path: filePath,
                            file_url: publicData.publicUrl,
                            uploaded_by: profile?.id || null,
                        });
                    }
                } else if (worksheetRemoved && existingWorksheet) {
                    // User explicitly removed the worksheet
                    await supabase.storage.from('daily_worksheets').remove([existingWorksheet.file_path]);
                    await supabase.from('daily_worksheets').delete().eq('id', existingWorksheet.id);
                }
                fetchWorksheets();
            } catch (_) { /* worksheet errors don't block quiz save */ }

            // Reset form
            setEditingQuizId(null);
            setTitle('');
            setSubject('11+ Mathematics');
            setDuration(10);
            setNegativeMarking(false);
            setBulkText('');
            setQuestions([]);
            setInputMode('bulk');
            setWorksheetPdfFile(null);
            setExistingWorksheet(null);
            setWorksheetRemoved(false);
            setQuizScope(adminMode === 'premium' ? 'premium' : 'dashboard');
            fetchQuizzes();
        } catch (err) {
            console.error('Publish error:', err);
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    }



    async function deleteQuiz(quizId) {
        if (!window.confirm('Are you sure you want to delete this quiz?')) return;
        const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
        if (error) {
            setMessage({ type: 'error', text: 'Failed to delete.' });
        } else {
            setMessage({ type: 'success', text: 'Quiz deleted.' });
            fetchQuizzes();
        }
    }

    // ── Visitor Analytics Functions ──
    async function fetchVisitors() {
        setLoadingVisitors(true);
        try {
            const today = new Date().toISOString().split('T')[0];

            // Accurate counts via separate count queries
            const [{ count: total }, { count: todayCount }, { count: loggedIn }] = await Promise.all([
                supabase.from('site_visitors').select('*', { count: 'exact', head: true }),
                supabase.from('site_visitors').select('*', { count: 'exact', head: true }).gte('visited_at', `${today}T00:00:00`),
                supabase.from('site_visitors').select('*', { count: 'exact', head: true }).eq('is_logged_in', true),
            ]);

            // Fetch all records in 1 000-row batches (no hard cap)
            let allVisitors = [];
            let from = 0;
            const BATCH = 1000;
            while (true) {
                const { data, error } = await supabase
                    .from('site_visitors')
                    .select('*')
                    .order('visited_at', { ascending: false })
                    .range(from, from + BATCH - 1);
                if (error) throw error;
                allVisitors = allVisitors.concat(data || []);
                if (!data || data.length < BATCH) break;
                from += BATCH;
            }

            setVisitors(allVisitors);
            const fingerprints = new Set(allVisitors.filter(r => r.visitor_fingerprint).map(r => r.visitor_fingerprint));
            setVisitorStats({
                total: total ?? allVisitors.length,
                unique: fingerprints.size,
                today: todayCount ?? 0,
                loggedIn: loggedIn ?? 0,
            });
        } catch (err) {
            console.error('Failed to fetch visitors:', err);
        } finally {
            setLoadingVisitors(false);
        }
    }

    // Filtered & sorted visitors
    const filteredVisitors = useMemo(() => {
        let result = [...visitors];
        if (visitorSearch.trim()) {
            const q = visitorSearch.toLowerCase();
            result = result.filter(v =>
                (v.page_url || '').toLowerCase().includes(q) ||
                (v.browser || '').toLowerCase().includes(q) ||
                (v.os || '').toLowerCase().includes(q) ||
                (v.country || '').toLowerCase().includes(q) ||
                (v.referrer_url || '').toLowerCase().includes(q) ||
                (v.utm_source || '').toLowerCase().includes(q) ||
                (v.user_email || '').toLowerCase().includes(q) ||
                (v.device_type || '').toLowerCase().includes(q)
            );
        }
        result.sort((a, b) => {
            const aVal = a[visitorSort.field] || '';
            const bVal = b[visitorSort.field] || '';
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return visitorSort.dir === 'asc' ? cmp : -cmp;
        });
        return result;
    }, [visitors, visitorSearch, visitorSort]);

    const pagedVisitors = filteredVisitors.slice(visitorPage * VISITORS_PER_PAGE, (visitorPage + 1) * VISITORS_PER_PAGE);
    const totalVisitorPages = Math.ceil(filteredVisitors.length / VISITORS_PER_PAGE);

    const filteredStudents = useMemo(() => {
        const q = studentSearch.trim().toLowerCase();
        const list = students.filter(s => {
            if (!q) return true;
            return (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
        });

        list.sort((a, b) => {
            let cmp = 0;
            if (studentSortField === 'name') cmp = (a.name || '').localeCompare(b.name || '');
            else if (studentSortField === 'email') cmp = (a.email || '').localeCompare(b.email || '');
            else if (studentSortField === 'totalQuizzes') cmp = (a.totalQuizzes || 0) - (b.totalQuizzes || 0);
            else if (studentSortField === 'avgPercent') cmp = (a.avgPercent || 0) - (b.avgPercent || 0);
            return studentSortDir === 'asc' ? cmp : -cmp;
        });

        return list;
    }, [students, studentSearch, studentSortField, studentSortDir]);

    function toggleVisitorSort(field) {
        setVisitorSort(prev => ({
            field,
            dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc',
        }));
        setVisitorPage(0);
    }

    // Get top N items from a field
    function getTopItems(field, n = 5) {
        const counts = {};
        visitors.forEach(v => {
            const val = v[field];
            if (val) counts[val] = (counts[val] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n);
    }

    const dashboardTabs = [
        ...(!isReadOnly ? [{ id: 'create', label: 'Create Quiz', icon: <FiPlus /> }] : [{ id: 'create', label: 'Edit Quiz', icon: <FiEdit2 /> }]),
        { id: 'manage', label: 'Manage Quizzes', icon: <FiList /> },
        { id: 'pastpapers', label: 'Past Papers', icon: <FiFileText /> },
        { id: 'reports', label: `Reports${reports.filter(r => r.status === 'pending').length ? ` (${reports.filter(r => r.status === 'pending').length})` : ''}`, icon: <FiAlertTriangle /> },
        { id: 'visitors', label: 'Visitors', icon: <FiUsers /> },
        { id: 'students', label: 'Students', icon: <FiUserCheck /> },
        { id: 'chats', label: `Chats${chatThreads.filter(t => t.unreadCount > 0).length ? ` (${chatThreads.filter(t => t.unreadCount > 0).length})` : ''}`, icon: <FiMessageCircle /> },
    ];

    const premiumTabs = [
        { id: 'premium_nvr', label: 'NVR Worksheets', icon: <FiLock /> },
        { id: 'premium_papers', label: 'Premium Papers', icon: <FiUpload /> },
        { id: 'premium_purchases', label: 'Purchases', icon: <FiDollarSign /> },
        ...(!isReadOnly ? [{ id: 'create', label: 'Create Quiz', icon: <FiPlus /> }] : [{ id: 'create', label: 'Edit Quiz', icon: <FiEdit2 /> }]),
        { id: 'manage', label: 'Manage Quizzes', icon: <FiList /> },
    ];

    const activeTabs = adminMode === 'premium' ? premiumTabs : dashboardTabs;

    return (
        <div className="admin-page page-container">
            <div className="admin-inner">
                <motion.div className="admin-header" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <h1 className="admin-title">
                        Admin <span className="text-gradient">Panel</span> 🛠️
                        {isReadOnly && <span className="readonly-badge"><FiLock /> Read-Only</span>}
                    </h1>
                    <p className="admin-subtitle">
                        {isReadOnly
                            ? 'You have read-only access to the admin panel.'
                            : adminMode ? `${adminMode === 'premium' ? 'Premium' : 'Dashboard'} Management` : 'Select a mode to get started.'}
                    </p>
                </motion.div>

                {/* Message */}
                <AnimatePresence>
                    {message && (
                        <motion.div
                            className={`admin-message ${message.type}`}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            {message.type === 'error' ? <FiAlertTriangle /> : <FiCheck />}
                            {message.text}
                            <button className="msg-close" onClick={() => setMessage(null)}><FiX /></button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ═══ LANDING SCREEN ═══ */}
                {!adminMode && (
                    <motion.div className="admin-mode-landing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="admin-mode-cards">
                            <motion.button
                                className="admin-mode-card admin-mode-dashboard"
                                onClick={() => { setAdminMode('dashboard'); setQuizScope('dashboard'); setTab('create'); }}
                                whileHover={{ scale: 1.03, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="mode-card-icon"><FiList /></div>
                                <h2>Dashboard</h2>
                                <p>Daily quizzes, past papers, reports & visitors</p>
                                <span className="mode-card-count">{dashboardQuizzes.length} quizzes</span>
                            </motion.button>
                            <motion.button
                                className="admin-mode-card admin-mode-premium"
                                onClick={() => { setAdminMode('premium'); setQuizScope('premium'); setTab('premium_nvr'); }}
                                whileHover={{ scale: 1.03, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="mode-card-icon"><FiLock /></div>
                                <h2>Premium</h2>
                                <p>NVR worksheets, test papers & premium quizzes</p>
                                <span className="mode-card-count">{premiumQuizzes.length} quizzes</span>
                            </motion.button>
                        </div>
                    </motion.div>
                )}

                {/* ═══ ACTIVE MODE ═══ */}
                {adminMode && (
                    <>
                        {/* Back + Mode indicator */}
                        <div className="admin-mode-bar">
                            <motion.button
                                className="btn-secondary admin-back-btn"
                                onClick={() => { setAdminMode(null); setTab('create'); }}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                ← Back
                            </motion.button>
                            <span className={`admin-mode-label ${adminMode === 'premium' ? 'premium' : ''}`}>
                                {adminMode === 'premium' ? <><FiLock /> Premium Mode</> : <><FiList /> Dashboard Mode</>}
                            </span>
                        </div>

                        {/* Tabs */}
                        <motion.div className="admin-tabs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                            {activeTabs.map(t => (
                                <button
                                    key={t.id}
                                    type="button"
                                    className={`admin-tab ${tab === t.id ? 'active' : ''}`}
                                    onClick={() => setTab(t.id)}
                                    aria-pressed={tab === t.id}
                                >
                                    <span className="admin-tab-icon">{t.icon}</span>
                                    <span className="admin-tab-label">{t.label}</span>
                                    {tab === t.id && <motion.div className="tab-indicator" layoutId="adminTab" />}
                                </button>
                            ))}
                        </motion.div>

                        <AnimatePresence mode="wait">
                            {tab === 'create' && (
                                <motion.div key="create" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                    {pendingQuizLink && (
                                        <div className="admin-message success" style={{ marginBottom: '1rem' }}>
                                            <FiAlertTriangle /> Creating premium quiz — will link back to {pendingQuizLink.target === 'nvr' ? 'NVR Worksheets' : 'Test Papers'} tab after saving.
                                        </div>
                                    )}
                                    {/* Quiz Details */}
                                    <div className="form-section glass-card">
                                        <h2 className="form-section-title"><FiEdit2 /> {adminMode === 'premium' ? 'Premium' : 'Dashboard'} Quiz Details</h2>
                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label>Quiz Title</label>
                                                <input className="admin-input" placeholder="e.g. Maths Challenge" value={title} onChange={e => setTitle(e.target.value)} />
                                            </div>
                                            <div className="form-group">
                                                <label>Subject</label>
                                                <select className="admin-input" value={subject} onChange={e => setSubject(e.target.value)}>
                                                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label><FiCalendar /> Quiz Date</label>
                                                <input className="admin-input" type="date" value={quizDate} onChange={e => setQuizDate(e.target.value)} />
                                            </div>
                                            <div className="form-group">
                                                <label><FiClock /> Duration (minutes)</label>
                                                <input className="admin-input" type="number" min={1} max={120} value={duration} onChange={e => setDuration(parseInt(e.target.value) || 10)} />
                                            </div>
                                            <div className="form-group">
                                                <label><FiUpload /> Worksheet PDF <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>(optional)</span></label>

                                                {/* Show existing worksheet when editing */}
                                                {existingWorksheet && !worksheetRemoved && !worksheetPdfFile ? (
                                                    <div className="existing-worksheet-row">
                                                        <FiFileText style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                                        <span className="existing-worksheet-name" title={existingWorksheet.file_name}>{existingWorksheet.file_name}</span>
                                                        <a href={existingWorksheet.file_url} target="_blank" rel="noopener noreferrer">
                                                            <button type="button" className="btn-secondary btn-sm"><FiExternalLink /></button>
                                                        </a>
                                                        {!isReadOnly && (
                                                            <button type="button" className="btn-delete btn-sm" onClick={() => setWorksheetRemoved(true)} title="Remove worksheet">
                                                                <FiTrash2 />
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <label className="file-upload-label worksheet-upload-label">
                                                            <FiUpload /> {worksheetPdfFile ? worksheetPdfFile.name : (worksheetRemoved ? 'Upload replacement PDF' : 'Select PDF')}
                                                            <input
                                                                type="file"
                                                                accept="application/pdf"
                                                                disabled={isReadOnly}
                                                                onChange={e => {
                                                                    const f = e.target.files?.[0];
                                                                    if (f && f.type === 'application/pdf') setWorksheetPdfFile(f);
                                                                    e.target.value = '';
                                                                }}
                                                            />
                                                        </label>
                                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                                                            {worksheetPdfFile && (
                                                                <button type="button" className="btn-secondary btn-sm" onClick={() => setWorksheetPdfFile(null)}>
                                                                    <FiX /> Clear
                                                                </button>
                                                            )}
                                                            {worksheetRemoved && (
                                                                <button type="button" className="btn-secondary btn-sm" onClick={() => setWorksheetRemoved(false)}>
                                                                    Undo Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Negative marking */}
                                        <div className="neg-marking-row">
                                            <label className="toggle-label">
                                                <input type="checkbox" checked={negativeMarking} onChange={e => setNegativeMarking(e.target.checked)} />
                                                <span className="toggle-switch" />
                                                <span>Negative Marking</span>
                                            </label>
                                            {negativeMarking && (
                                                <motion.div className="neg-amount" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}>
                                                    <label>Penalty per wrong answer:</label>
                                                    <input className="admin-input small" type="number" step="0.25" min={0} max={2} value={negativeMarks} onChange={e => setNegativeMarks(parseFloat(e.target.value) || 0.25)} />
                                                </motion.div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Questions */}
                                    <div className="form-section glass-card">
                                        <div className="questions-header">
                                            <h2 className="form-section-title"><FiFileText /> Questions</h2>
                                            <div className="mode-toggle">
                                                <button className={`mode-btn ${inputMode === 'bulk' ? 'active' : ''}`} onClick={() => setInputMode('bulk')}>
                                                    Bulk Paste
                                                </button>
                                                <button className={`mode-btn ${inputMode === 'manual' ? 'active' : ''}`} onClick={() => setInputMode('manual')}>
                                                    Manual Add
                                                </button>
                                            </div>
                                        </div>

                                        {inputMode === 'bulk' ? (
                                            <div className="bulk-section">
                                                <p className="helper-text">
                                                    Format: Question text on one line, then options {isPremiumQuizScope ? 'A, B, C, D, E' : 'A, B, C, D'}. Mark correct option with *.
                                                    Add optional "Solution:" or "Exp:" line. Add optional "SolImage:" line with URL. Separate questions with a blank line.
                                                </p>
                                                <pre className="format-example">
                                                    {isPremiumQuizScope ? `Q1. Which shape has 3 sides?
A: Circle
B: Square
C: Triangle*
D: Rectangle
E: Pentagon
Solution:
A triangle is a polygon with three edges and three vertices.
SolImage: https://example.com/triangle.png

Q2. What is 5 x 5?
A: 20
B: 25*
C: 30
D: 35
E: 40
Exp: 5 times 5 equals 25.` : `Q1. Which shape has 3 sides?
A: Circle
B: Square
C: Triangle*
D: Rectangle
Solution:
A triangle is a polygon with three edges and three vertices.
SolImage: https://example.com/triangle.png

Q2. What is 5 x 5?
A: 20
B: 25*
C: 30
D: 35
Exp: 5 times 5 equals 25.`}
                                                </pre>
                                                <textarea
                                                    className="admin-input bulk-textarea"
                                                    placeholder="Paste your questions here..."
                                                    rows={12}
                                                    value={bulkText}
                                                    onChange={e => setBulkText(e.target.value)}
                                                />
                                                <motion.button className="btn-primary" onClick={handleParseBulk} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                                    <FiEye /> Parse & Preview
                                                </motion.button>
                                            </div>
                                        ) : (
                                            <div className="manual-section">
                                                {questions.map((q, qi) => (
                                                    <motion.div key={qi} className="manual-question" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                                        <div className="mq-header">
                                                            <span className="mq-num">Q{qi + 1}</span>
                                                            {!isReadOnly && <button className="mq-delete" onClick={() => removeQuestion(qi)}><FiTrash2 /></button>}
                                                        </div>
                                                        <input
                                                            className="admin-input"
                                                            placeholder="Question text"
                                                            value={q.question_text}
                                                            onChange={e => updateQuestion(qi, 'question_text', e.target.value)}
                                                        />
                                                        <div className="mq-image-row">
                                                            <label className="file-upload-label">
                                                                <FiUpload /> Upload Image
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    onChange={e => handleImageSelect(qi, e)}
                                                                />
                                                            </label>
                                                            {(q.imagePreview || q.image_url) && (
                                                                <span className="file-name">{q.imageFile?.name || 'Linked Image'}</span>
                                                            )}
                                                        </div>
                                                        {q.imagePreview && (
                                                            <div className="mq-image-preview">
                                                                <img src={q.imagePreview} alt="Preview" />
                                                                <button className="remove-img-btn" onClick={() => removeImage(qi)}>
                                                                    <FiTrash2 />
                                                                </button>
                                                            </div>
                                                        )}
                                                        <div className="mq-options">
                                                            {Array.from({ length: optionCount }, (_, oi) => q.options[oi] || '').map((opt, oi) => (
                                                                <div key={oi} className="mq-option-row">
                                                                    <label className={`mq-radio ${q.correct_option === oi ? 'correct' : ''}`}>
                                                                        <input
                                                                            type="radio"
                                                                            name={`correct-${qi}`}
                                                                            checked={q.correct_option === oi}
                                                                            onChange={() => updateQuestion(qi, 'correct_option', oi)}
                                                                        />
                                                                        <span className="mq-letter">{String.fromCharCode(65 + oi)}</span>
                                                                    </label>
                                                                    <input
                                                                        className="admin-input"
                                                                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                                                        value={opt}
                                                                        onChange={e => updateOption(qi, oi, e.target.value)}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mq-solution-row">
                                                            <label className="mq-solution-label"><FiFileText /> Solution / Explanation</label>
                                                            <textarea
                                                                className="admin-input solution-textarea"
                                                                placeholder="Enter detailed solution or explanation for this question (optional)..."
                                                                rows={3}
                                                                value={q.solution || ''}
                                                                onChange={e => updateQuestion(qi, 'solution', e.target.value)}
                                                            />

                                                            <div className="mq-image-row" style={{ marginTop: '0.8rem' }}>
                                                                <label className="file-upload-label">
                                                                    <FiUpload /> Upload Solution Image
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        onChange={e => handleImageSelect(qi, e, true)}
                                                                    />
                                                                </label>
                                                                {(q.solutionImagePreview || q.solution_image) && (
                                                                    <span className="file-name">{q.solutionImageFile?.name || 'Linked Image'}</span>
                                                                )}
                                                            </div>
                                                            {(q.solutionImagePreview || q.solution_image) && (
                                                                <div className="mq-image-preview">
                                                                    <img src={q.solutionImagePreview || q.solution_image} alt="Solution Preview" />
                                                                    <button className="remove-img-btn" onClick={() => removeImage(qi, true)}>
                                                                        <FiTrash2 />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ))}
                                                <motion.button className="btn-secondary add-q-btn" onClick={addManualQuestion} whileHover={{ scale: 1.02 }}>
                                                    <FiPlus /> Add Question
                                                </motion.button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Preview */}
                                    <AnimatePresence>
                                        {showPreview && questions.length > 0 && (
                                            <motion.div className="form-section glass-card preview-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                                <h2 className="form-section-title"><FiEye /> Preview ({questions.length} Questions)</h2>
                                                <div className="preview-list">
                                                    {questions.map((q, i) => (
                                                        <div key={i} className="preview-item">
                                                            <div className="preview-q">
                                                                <strong>Q{i + 1}.</strong> {q.question_text}
                                                            </div>
                                                            {q.imagePreview && (
                                                                <div className="preview-img">
                                                                    <img src={q.imagePreview} alt={`Q${i + 1}`} />
                                                                </div>
                                                            )}
                                                            <div className="preview-opts">
                                                                {q.options.map((opt, j) => (
                                                                    <span key={j} className={`preview-opt ${j === q.correct_option ? 'correct' : ''}`}>
                                                                        {String.fromCharCode(65 + j)}: {opt}
                                                                        {j === q.correct_option && ' ✓'}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Publish Summary */}
                                    {questions.length > 0 && (
                                        <motion.div className="publish-bar glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                            <div className="publish-info">
                                                <span><strong>{title || 'Untitled Quiz'}</strong></span>
                                                <span>{subject} · {duration} min · {questions.length} questions</span>
                                                {negativeMarking && <span className="neg-badge"><FiAlertTriangle /> −{negativeMarks} per wrong answer</span>}
                                            </div>
                                            <div className="publish-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                {editingQuizId && (
                                                    <motion.button className="btn-secondary" onClick={() => {
                                                        setEditingQuizId(null);
                                                        setTitle('');
                                                        setQuestions([]);
                                                        setBulkText('');
                                                        setInputMode('bulk');
                                                    }} whileHover={{ scale: 1.02 }}>
                                                        Cancel Edit
                                                    </motion.button>
                                                )}
                                                <motion.button
                                                    className="btn-secondary draft-btn"
                                                    onClick={() => handlePublish(true)}
                                                    disabled={saving}
                                                    whileHover={{ scale: 1.03 }}
                                                    whileTap={{ scale: 0.97 }}
                                                    style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}
                                                >
                                                    {saving ? 'Saving...' : <><FiSave /> Save Draft</>}
                                                </motion.button>
                                                <motion.button
                                                    className="btn-primary publish-btn"
                                                    onClick={() => handlePublish(false)}
                                                    disabled={saving}
                                                    whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(245,197,24,0.4)' }}
                                                    whileTap={{ scale: 0.97 }}
                                                >
                                                    {saving ? 'Publishing...' : <><FiCheck /> {editingQuizId ? 'Update Public' : 'Publish Quiz'}</>}
                                                </motion.button>
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}

                            {tab === 'manage' && (
                                <motion.div key="manage" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                    <div className="manage-section">
                                        {loadingQuizzes ? (
                                            <div className="loading-state">
                                                <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                                                <p>Loading quizzes...</p>
                                            </div>
                                        ) : filteredQuizzes.length === 0 ? (
                                            <div className="empty-state glass-card">
                                                <FiList />
                                                <h3>No {adminMode} quizzes yet</h3>
                                                <p>Create your first {adminMode} quiz in the "Create Quiz" tab.</p>
                                            </div>
                                        ) : (
                                            <div className="quiz-manage-list">
                                                {filteredQuizzes.map((quiz, i) => (
                                                    <motion.div
                                                        key={quiz.id}
                                                        className="manage-card glass-card"
                                                        initial={{ opacity: 0, y: 15 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: i * 0.05 }}
                                                    >
                                                        <div className="manage-card-info">
                                                            <h3>{quiz.title}</h3>
                                                            <div className="manage-meta">
                                                                <span className="manage-badge">{quiz.subject}</span>
                                                                {quiz.is_draft && <span className="manage-badge" style={{ background: 'rgba(255,165,0,0.1)', color: 'orange', borderColor: 'rgba(255,165,0,0.2)' }}>Draft</span>}
                                                                {(() => {
                                                                    const ws = worksheets.find(w => w.quiz_id === quiz.id); return ws ? (
                                                                        <>
                                                                            <span className="manage-badge" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.2)' }}>
                                                                                <FiFileText /> Worksheet
                                                                            </span>
                                                                            <span className="manage-badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.25)' }} title="Worksheet downloads">
                                                                                ↓ {ws.download_count ?? 0}
                                                                            </span>
                                                                        </>
                                                                    ) : null;
                                                                })()}
                                                                <span><FiCalendar /> {quiz.quiz_date}</span>
                                                                <span><FiClock /> {quiz.duration_minutes} min</span>
                                                                <span><FiFileText /> {quiz.questions?.[0]?.count || 0} questions</span>
                                                                {quiz.negative_marking && <span className="neg-badge"><FiAlertTriangle /> −{quiz.negative_marks}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="manage-card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <motion.button
                                                                className="btn-secondary"
                                                                onClick={() => loadQuizForEditing(quiz)}
                                                                whileHover={{ scale: 1.05 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                title="Edit Quiz"
                                                            >
                                                                <FiEdit2 />
                                                            </motion.button>
                                                            {!isReadOnly && (
                                                                <motion.button
                                                                    className="btn-delete"
                                                                    onClick={() => deleteQuiz(quiz.id)}
                                                                    whileHover={{ scale: 1.05 }}
                                                                    whileTap={{ scale: 0.95 }}
                                                                    title="Delete Quiz"
                                                                >
                                                                    <FiTrash2 />
                                                                </motion.button>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {tab === 'pastpapers' && (
                                <motion.div key="pastpapers" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                    {/* Upload form */}
                                    {!isReadOnly && (
                                        <div className="form-section glass-card" style={{ marginBottom: '1.5rem' }}>
                                            <h2 className="form-section-title"><FiUpload /> Upload Past Paper</h2>
                                            <div className="form-grid">
                                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                    <label>Title *</label>
                                                    <input className="admin-input" placeholder="e.g. 2023 Maths Paper 1" value={ppTitle} onChange={e => setPpTitle(e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label>Subject</label>
                                                    <select className="admin-input" value={ppSubject} onChange={e => setPpSubject(e.target.value)}>
                                                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label>Year (optional)</label>
                                                    <input className="admin-input" type="number" placeholder="e.g. 2023" min={2000} max={2099} value={ppYear} onChange={e => setPpYear(e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label>Difficulty</label>
                                                    <select className="admin-input" value={ppDifficulty} onChange={e => setPpDifficulty(e.target.value)}>
                                                        <option value="Easy">Easy</option>
                                                        <option value="Medium">Medium</option>
                                                        <option value="Hard">Hard</option>
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label>PDF File *</label>
                                                    <label className="file-upload-label worksheet-upload-label">
                                                        <FiUpload /> {ppFile ? ppFile.name : 'Select PDF'}
                                                        <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => setPpFile(e.target.files[0] || null)} />
                                                    </label>
                                                </div>
                                            </div>
                                            <motion.button
                                                className="btn-primary"
                                                onClick={savePastPaper}
                                                disabled={ppSaving}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                style={{ marginTop: '0.5rem' }}
                                            >
                                                {ppSaving ? 'Uploading…' : <><FiUpload /> Upload Paper</>}
                                            </motion.button>
                                        </div>
                                    )}

                                    {/* Difficulty sections */}
                                    {loadingPastPapers ? (
                                        <div className="loading-state">
                                            <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                                            <p>Loading past papers…</p>
                                        </div>
                                    ) : pastPapers.length === 0 ? (
                                        <div className="empty-state glass-card">
                                            <FiFileText />
                                            <h3>No past papers yet</h3>
                                            <p>Upload your first paper using the form above.</p>
                                        </div>
                                    ) : (
                                        ['Easy', 'Medium', 'Hard'].map(diff => {
                                            const list = pastPapers.filter(p => p.difficulty === diff);
                                            if (list.length === 0) return null;
                                            const diffColors = { Easy: '#22c55e', Medium: '#f59e0b', Hard: '#ef4444' };
                                            const color = diffColors[diff];
                                            return (
                                                <div key={diff} style={{ marginBottom: '1.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${color}30` }}>
                                                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                                                        <h3 style={{ margin: 0, color, fontSize: '1.1rem', fontWeight: 800 }}>{diff}</h3>
                                                        <span className="manage-badge" style={{ background: `${color}15`, color, borderColor: `${color}30`, marginLeft: 'auto' }}>{list.length}</span>
                                                    </div>
                                                    <div className="quiz-manage-list">
                                                        {list.map((paper, i) => (
                                                            <motion.div
                                                                key={paper.id}
                                                                className="manage-card glass-card"
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: i * 0.04 }}
                                                            >
                                                                <div className="manage-card-info">
                                                                    <h3>{paper.title}</h3>
                                                                    <div className="manage-meta">
                                                                        <span className="manage-badge">{paper.subject}</span>
                                                                        {paper.year && <span className="manage-badge">{paper.year}</span>}
                                                                        <span className="manage-badge" style={{ background: `${color}15`, color, borderColor: `${color}30` }}>{diff}</span>
                                                                        <span className="manage-badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.25)' }} title="Total downloads">
                                                                            ↓ {paper.download_count ?? 0}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="manage-card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                                                                    <a href={paper.file_url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', padding: '0.4rem 0.7rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }} title="View PDF">
                                                                        <FiExternalLink />
                                                                    </a>
                                                                    {!isReadOnly && (
                                                                        <motion.button
                                                                            className="btn-delete"
                                                                            onClick={() => deletePastPaper(paper)}
                                                                            whileHover={{ scale: 1.05 }}
                                                                            whileTap={{ scale: 0.95 }}
                                                                            title="Delete"
                                                                        >
                                                                            <FiTrash2 />
                                                                        </motion.button>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </motion.div>
                            )}

                            {tab === 'reports' && (
                                <motion.div key="reports" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                    <div className="manage-section">
                                        {loadingReports ? (
                                            <div className="loading-state">
                                                <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                                                <p>Loading reports…</p>
                                            </div>
                                        ) : reports.length === 0 ? (
                                            <div className="empty-state glass-card">
                                                <FiAlertTriangle />
                                                <h3>No reports yet</h3>
                                                <p>Reported questions will appear here.</p>
                                            </div>
                                        ) : (
                                            <div className="quiz-manage-list">
                                                {reports.map((report, i) => {
                                                    const statusColors = { pending: '#f59e0b', reviewed: '#3b82f6', resolved: '#22c55e', dismissed: '#6b7280' };
                                                    const color = statusColors[report.status] || '#6b7280';
                                                    return (
                                                        <motion.div
                                                            key={report.id}
                                                            className="manage-card glass-card"
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: i * 0.04 }}
                                                        >
                                                            <div className="manage-card-info">
                                                                <h3 style={{ fontSize: '0.9rem' }}>{report.questions?.question_text?.slice(0, 120) || 'Unknown question'}{report.questions?.question_text?.length > 120 ? '…' : ''}</h3>
                                                                <div className="manage-meta">
                                                                    <span className="manage-badge">{report.quizzes?.title || 'Unknown quiz'}</span>
                                                                    <span className="manage-badge" style={{ background: `${color}15`, color, borderColor: `${color}30`, fontWeight: 700 }}>{report.status}</span>
                                                                    <span className="manage-badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)' }}>{report.reason}</span>
                                                                    <span><FiCalendar /> {new Date(report.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                                </div>
                                                                {report.details && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.3rem', marginBottom: 0 }}>{report.details}</p>}
                                                            </div>
                                                            <div className="manage-card-actions" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                {['pending', 'reviewed', 'resolved', 'dismissed'].filter(s => s !== report.status).map(s => (
                                                                    <motion.button
                                                                        key={s}
                                                                        className="btn-secondary"
                                                                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                                                        onClick={() => updateReportStatus(report.id, s)}
                                                                        whileHover={{ scale: 1.05 }}
                                                                        whileTap={{ scale: 0.95 }}
                                                                        title={`Mark as ${s}`}
                                                                    >
                                                                        {s}
                                                                    </motion.button>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {tab === 'visitors' && (
                                <motion.div key="visitors" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                    {/* Stats Cards */}
                                    <div className="visitor-stats-grid">
                                        {[
                                            { label: 'Total Visits', value: visitorStats.total, icon: <FiBarChart2 />, color: 'var(--primary)' },
                                            { label: 'Unique Visitors', value: visitorStats.unique, icon: <FiUsers />, color: 'var(--success)' },
                                            { label: "Today's Visits", value: visitorStats.today, icon: <FiCalendar />, color: 'var(--warning)' },
                                            { label: 'Logged-In Users', value: visitorStats.loggedIn, icon: <FiLock />, color: '#8B5CF6' },
                                        ].map((card, i) => (
                                            <motion.div
                                                key={card.label}
                                                className="visitor-stat-card glass-card"
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.08 }}
                                            >
                                                <div className="stat-icon" style={{ color: card.color, background: `${card.color}15` }}>
                                                    {card.icon}
                                                </div>
                                                <div className="stat-info">
                                                    <span className="stat-value">{card.value}</span>
                                                    <span className="stat-label">{card.label}</span>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Top Items */}
                                    <div className="visitor-top-grid">
                                        {[
                                            { title: 'Top Browsers', field: 'browser', icon: <FiGlobe /> },
                                            { title: 'Top Devices', field: 'device_type', icon: <FiSmartphone /> },
                                            { title: 'Top Pages', field: 'page_url', icon: <FiFileText /> },
                                            { title: 'Top Referrers', field: 'referrer_url', icon: <FiArrowUp /> },
                                        ].map((section, i) => (
                                            <motion.div
                                                key={section.title}
                                                className="top-items-card glass-card"
                                                initial={{ opacity: 0, y: 15 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.3 + i * 0.08 }}
                                            >
                                                <h3 className="top-items-title">{section.icon} {section.title}</h3>
                                                <div className="top-items-list">
                                                    {getTopItems(section.field).length === 0 ? (
                                                        <span className="top-item-empty">No data yet</span>
                                                    ) : (
                                                        getTopItems(section.field).map(([name, count], j) => (
                                                            <div key={j} className="top-item-row">
                                                                <span className="top-item-name" title={name}>{name || '(direct)'}</span>
                                                                <span className="top-item-count">{count}</span>
                                                                <div className="top-item-bar">
                                                                    <div
                                                                        className="top-item-bar-fill"
                                                                        style={{ width: `${Math.min(100, (count / (getTopItems(section.field)[0]?.[1] || 1)) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {loadingVisitors && (
                                        <div className="loading-state">
                                            <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                                            <p>Loading visitor data…</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* ═══════════════════════════════════════════
                        STUDENTS TAB
                    ════════════════════════════════════════════ */}
                            {tab === 'students' && (
                                <motion.div key="students" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                    <div className="admin-section glass-card student-section">
                                        <div className="section-header">
                                            <div>
                                                <h2><FiUserCheck /> Student Details</h2>
                                                <p className="subtitle">View student quiz performance — name, email, quizzes attempted, and average score.</p>
                                            </div>
                                            <div className="section-header-pill">{students.length} students</div>
                                        </div>

                                        {/* Summary stats */}
                                        <div className="student-stats-grid">
                                            <div className="stat-card glass-card student-stat-card">
                                                <FiUsers className="stat-icon" />
                                                <div className="stat-value">{students.length}</div>
                                                <div className="stat-label">Total Students</div>
                                            </div>
                                            <div className="stat-card glass-card student-stat-card">
                                                <FiBarChart2 className="stat-icon" />
                                                <div className="stat-value">{students.length > 0 ? Math.round(students.reduce((s, st) => s + st.totalQuizzes, 0) / students.length * 10) / 10 : 0}</div>
                                                <div className="stat-label">Avg Quizzes / Student</div>
                                            </div>
                                            <div className="stat-card glass-card student-stat-card">
                                                <FiCheck className="stat-icon" />
                                                <div className="stat-value">{students.length > 0 ? Math.round(students.filter(s => s.totalQuizzes > 0).reduce((s, st) => s + st.avgPercent, 0) / Math.max(students.filter(s => s.totalQuizzes > 0).length, 1) * 10) / 10 : 0}%</div>
                                                <div className="stat-label">Overall Avg Score</div>
                                            </div>
                                        </div>

                                        {/* Search */}
                                        <div className="visitor-search student-search">
                                            <FiSearch />
                                            <input
                                                type="text"
                                                placeholder="Search by name or email…"
                                                value={studentSearch}
                                                onChange={e => setStudentSearch(e.target.value)}
                                            />
                                        </div>

                                        {loadingStudents ? (
                                            <div className="loading-spinner"></div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="admin-table">
                                                    <thead>
                                                        <tr>
                                                            <th>#</th>
                                                            <th className="admin-sortable-th" onClick={() => { setStudentSortField('name'); setStudentSortDir(prev => studentSortField === 'name' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }}>
                                                                Name {studentSortField === 'name' && (studentSortDir === 'asc' ? <FiArrowUp className="sort-arrow" /> : <FiArrowDown className="sort-arrow" />)}
                                                            </th>
                                                            <th className="admin-sortable-th" onClick={() => { setStudentSortField('email'); setStudentSortDir(prev => studentSortField === 'email' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }}>
                                                                Email {studentSortField === 'email' && (studentSortDir === 'asc' ? <FiArrowUp className="sort-arrow" /> : <FiArrowDown className="sort-arrow" />)}
                                                            </th>
                                                            <th className="admin-sortable-th" onClick={() => { setStudentSortField('totalQuizzes'); setStudentSortDir(prev => studentSortField === 'totalQuizzes' ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'); }}>
                                                                Total Quizzes {studentSortField === 'totalQuizzes' && (studentSortDir === 'asc' ? <FiArrowUp className="sort-arrow" /> : <FiArrowDown className="sort-arrow" />)}
                                                            </th>
                                                            <th className="admin-sortable-th" onClick={() => { setStudentSortField('avgPercent'); setStudentSortDir(prev => studentSortField === 'avgPercent' ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'); }}>
                                                                Avg % Score {studentSortField === 'avgPercent' && (studentSortDir === 'asc' ? <FiArrowUp className="sort-arrow" /> : <FiArrowDown className="sort-arrow" />)}
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredStudents
                                                            .map((s, i) => (
                                                                <tr key={s.id}>
                                                                    <td>{i + 1}</td>
                                                                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                                                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{s.email || '—'}</td>
                                                                    <td><span className="admin-quiz-count">{s.totalQuizzes}</span></td>
                                                                    <td>
                                                                        <span className={`status-badge ${s.avgPercent >= 70 ? 'status-active' : s.avgPercent >= 40 ? 'status-pending' : 'status-expired'}`}>
                                                                            {s.totalQuizzes > 0 ? `${s.avgPercent}%` : '—'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        {filteredStudents.length === 0 && (
                                                            <tr>
                                                                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No students found.</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* ═══════════════════════════════════════════
                        CHATS TAB
                    ════════════════════════════════════════════ */}
                            {tab === 'chats' && (
                                <motion.div key="chats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                    <div className="admin-section glass-card">
                                        <div className="section-header">
                                            <div>
                                                <h2><FiMessageCircle /> User Chats</h2>
                                                <p className="subtitle">Respond to user messages. Click a thread to view and reply.</p>
                                            </div>
                                            <div className="section-header-pill">{chatThreads.length} threads</div>
                                        </div>

                                        {loadingChats ? (
                                            <div className="loading-spinner"></div>
                                        ) : chatThreads.length === 0 ? (
                                            <div className="admin-chat-empty">
                                                <FiMessageCircle className="admin-chat-empty-icon" />
                                                <p>No chat messages yet.</p>
                                            </div>
                                        ) : (
                                            <div className="admin-chat-layout admin-chat-has-thread">
                                                {/* Thread List */}
                                                <div className="admin-chat-threads">
                                                    {chatThreads.map(t => (
                                                        <div
                                                            key={t.userId}
                                                            className={`admin-chat-thread-item ${selectedThread === t.userId ? 'active' : ''}`}
                                                            onClick={() => fetchThreadMessages(t.userId)}
                                                        >
                                                            <div className="admin-chat-thread-top">
                                                                <strong>{t.userName}</strong>
                                                                {t.unreadCount > 0 && (
                                                                    <span className="admin-chat-unread-badge">{t.unreadCount}</span>
                                                                )}
                                                            </div>
                                                            <p className="admin-chat-thread-preview">
                                                                {t.lastMessage.sender === 'admin' ? 'You: ' : ''}{t.lastMessage.message}
                                                            </p>
                                                            <span className="admin-chat-thread-meta">
                                                                {new Date(t.lastMessage.created_at).toLocaleDateString()} · {t.messageCount} msgs
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Message View */}
                                                {selectedThread ? (
                                                    <div className="admin-chat-conversation">
                                                        <div className="admin-chat-messages">
                                                            {threadMessages.map(m => (
                                                                <div key={m.id} className={`admin-chat-msg ${m.sender === 'admin' ? 'admin-chat-msg-admin' : 'admin-chat-msg-user'}`}>
                                                                    <div className="admin-chat-bubble">
                                                                        {m.message}
                                                                    </div>
                                                                    <span className="admin-chat-time">
                                                                        {m.sender === 'admin' ? 'Admin · ' : ''}{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {/* Reply input */}
                                                        <div className="admin-chat-reply">
                                                            <input
                                                                type="text"
                                                                placeholder="Type a reply…"
                                                                value={adminReply}
                                                                onChange={e => setAdminReply(e.target.value)}
                                                                onKeyDown={e => e.key === 'Enter' && sendAdminReply()}
                                                                className="admin-chat-reply-input"
                                                            />
                                                            <button className="btn-primary admin-chat-reply-btn" onClick={sendAdminReply} disabled={sendingReply || !adminReply.trim()}>
                                                                <FiSend /> {sendingReply ? '…' : 'Send'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="admin-chat-placeholder glass-card">
                                                        <FiMessageCircle className="admin-chat-placeholder-icon" />
                                                        <h3>Select a conversation</h3>
                                                        <p>Choose a thread from the left to view messages and reply.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* ═══════════════════════════════════════════
                        PREMIUM NVR WORKSHEETS TAB
                    ════════════════════════════════════════════ */}
                            {tab === 'premium_nvr' && (
                                <motion.div key="premium_nvr" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                        Manage premium 11+ NVR worksheets. These are available only to users with an active yearly subscription. Use the quiz selector below, or click "Create linked quiz" to build the quiz first and come back to attach the PDF.
                                    </p>

                                    <div className="nvr-price-bar glass-card" style={{ marginBottom: '1.5rem' }}>
                                        <div className="nvr-price-copy">
                                            <span className="nvr-price-label">NVR subscription pricing</span>
                                            <strong>£{(globalNvrPrice / 100).toFixed(2)}</strong>
                                            <small>This is the global yearly subscription price stored in <span>app_settings</span>.</small>
                                        </div>
                                        {!isReadOnly && (
                                            <motion.button
                                                type="button"
                                                className="btn-secondary btn-sm"
                                                onClick={updateGlobalNvrPrice}
                                                whileHover={{ scale: 1.03 }}
                                                whileTap={{ scale: 0.97 }}
                                            >
                                                Change price
                                            </motion.button>
                                        )}
                                    </div>

                                    {/* Upload Form */}
                                    {!isReadOnly && (
                                        <div className="form-section glass-card" style={{ marginBottom: '1.5rem' }}>
                                            <h2 className="form-section-title"><FiUpload /> Add NVR Worksheet</h2>
                                            <div className="form-grid">
                                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                    <label>Title *</label>
                                                    <input className="admin-input" placeholder="e.g. Patterns & Sequences — Week 1" value={nvrTitle} onChange={e => setNvrTitle(e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label>Topic</label>
                                                    <input className="admin-input" placeholder="e.g. Spatial Reasoning" value={nvrTopic} onChange={e => setNvrTopic(e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label>Difficulty</label>
                                                    <select className="admin-input" value={nvrDifficulty} onChange={e => setNvrDifficulty(e.target.value)}>
                                                        <option>Easy</option>
                                                        <option>Medium</option>
                                                        <option>Hard</option>
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label><FiCalendar /> Date</label>
                                                    <input className="admin-input" type="date" value={nvrDate} onChange={e => setNvrDate(e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label>Sort Order</label>
                                                    <input className="admin-input" type="number" min={0} value={nvrSortOrder} onChange={e => setNvrSortOrder(e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label>Linked Quiz ID <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                                    <select className="admin-input" value={nvrQuizId} onChange={e => setNvrQuizId(e.target.value)}>
                                                        <option value="">Select a quiz</option>
                                                        {premiumQuizChoices.map(quiz => (
                                                            <option key={quiz.value} value={quiz.value}>{quiz.label}</option>
                                                        ))}
                                                    </select>
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                                                        <motion.button
                                                            type="button"
                                                            className="btn-secondary btn-sm"
                                                            onClick={() => startLinkedQuizDraft({ target: 'nvr', title: nvrTitle, subject: 'Non-Verbal Reasoning', returnTab: 'premium_nvr' })}
                                                            whileHover={{ scale: 1.02 }}
                                                            whileTap={{ scale: 0.98 }}
                                                        >
                                                            Create linked quiz
                                                        </motion.button>
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label>Worksheet PDF <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                                    <label className="file-upload-label worksheet-upload-label">
                                                        <FiUpload /> {nvrFile ? nvrFile.name : 'Select PDF'}
                                                        <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => setNvrFile(e.target.files[0] || null)} />
                                                    </label>
                                                </div>
                                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '1.5rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        id="nvr-is-free"
                                                        checked={nvrIsFree}
                                                        onChange={e => setNvrIsFree(e.target.checked)}
                                                        style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                                                    />
                                                    <label htmlFor="nvr-is-free" style={{ cursor: 'pointer', fontWeight: 500 }}>Mark as FREE (visible to all)</label>
                                                </div>
                                            </div>
                                            <motion.button
                                                className="btn-primary"
                                                onClick={savePremiumNVR}
                                                disabled={nvrSaving}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                style={{ marginTop: '0.75rem' }}
                                            >
                                                {nvrSaving ? 'Saving…' : <><FiPlus /> Add Worksheet</>}
                                            </motion.button>
                                        </div>
                                    )}

                                    {/* Worksheets List */}
                                    {loadingPremiumNVR ? (
                                        <div className="loading-state">
                                            <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                                            <p>Loading worksheets…</p>
                                        </div>
                                    ) : premiumNVRWorksheets.length === 0 ? (
                                        <div className="empty-state glass-card">
                                            <FiFileText />
                                            <h3>No premium NVR worksheets yet</h3>
                                            <p>Add worksheets using the form above.</p>
                                        </div>
                                    ) : (
                                        <div className="quiz-manage-list">
                                            {premiumNVRWorksheets.map((ws, i) => (
                                                <motion.div
                                                    key={ws.id}
                                                    className="manage-card glass-card"
                                                    initial={{ opacity: 0, y: 15 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.04 }}
                                                >
                                                    <div className="manage-card-info">
                                                        <h3>{ws.title}</h3>
                                                        <div className="manage-meta">
                                                            {ws.topic && <span className="manage-badge">{ws.topic}</span>}
                                                            <span className="manage-badge">{ws.difficulty}</span>
                                                            {ws.is_free
                                                                ? <span className="manage-badge" style={{ background: 'rgba(0,184,122,0.1)', color: 'var(--success)', borderColor: 'rgba(0,184,122,0.2)' }}>FREE</span>
                                                                : <span className="manage-badge" style={{ background: 'rgba(212,169,26,0.1)', color: 'var(--primary)', borderColor: 'rgba(212,169,26,0.2)' }}><FiLock style={{ fontSize: '0.7rem' }} /> Premium</span>
                                                            }
                                                            {ws.quiz_id && <span className="manage-badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.2)' }}>Quiz linked</span>}
                                                            {ws.file_url && <span className="manage-badge" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.2)' }}><FiFileText /> PDF</span>}
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Order: {ws.sort_order}</span>
                                                        </div>
                                                    </div>
                                                    <div className="manage-card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                                                        {ws.file_url && (
                                                            <a href={ws.file_url} target="_blank" rel="noopener noreferrer">
                                                                <motion.button className="btn-secondary" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="View PDF">
                                                                    <FiExternalLink />
                                                                </motion.button>
                                                            </a>
                                                        )}
                                                        {ws.quiz_id && !isReadOnly && (
                                                            <motion.button
                                                                className="btn-secondary"
                                                                onClick={() => {
                                                                    const quiz = quizzes.find(q => q.id === ws.quiz_id);
                                                                    if (quiz) loadQuizForEditing(quiz);
                                                                    else setMessage({ type: 'error', text: 'Linked quiz not found. It may have been deleted.' });
                                                                }}
                                                                whileHover={{ scale: 1.05 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                title="Edit linked quiz"
                                                                style={{ fontSize: '0.78rem', padding: '0.4rem 0.7rem' }}
                                                            >
                                                                <FiEdit2 /> Edit Quiz
                                                            </motion.button>
                                                        )}
                                                        {!isReadOnly && (
                                                            <>
                                                                <motion.button
                                                                    className="btn-secondary"
                                                                    onClick={() => toggleNVRFree(ws)}
                                                                    whileHover={{ scale: 1.05 }}
                                                                    whileTap={{ scale: 0.95 }}
                                                                    title={ws.is_free ? 'Make Premium' : 'Make Free'}
                                                                    style={{ fontSize: '0.78rem', padding: '0.4rem 0.7rem' }}
                                                                >
                                                                    {ws.is_free ? 'Make Premium' : 'Make Free'}
                                                                </motion.button>
                                                                <motion.button
                                                                    className="btn-delete"
                                                                    onClick={() => deletePremiumNVR(ws)}
                                                                    whileHover={{ scale: 1.05 }}
                                                                    whileTap={{ scale: 0.95 }}
                                                                    title="Delete"
                                                                >
                                                                    <FiTrash2 />
                                                                </motion.button>
                                                            </>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* ═══════════════════════════════════════════
                        PREMIUM TEST PAPERS TAB
                    ════════════════════════════════════════════ */}
                            {tab === 'premium_papers' && (
                                <motion.div key="premium_papers" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                        Manage premium 11+ test papers (Maths, NVR, English). These are sold as one-time subject bundles. Use the quiz selector below, or click "Create linked quiz" to build the answers quiz first and return to attach the PDF.
                                    </p>

                                    {/* Upload Form */}
                                    {!isReadOnly && (
                                        <div className="form-section glass-card" style={{ marginBottom: '1.5rem' }}>
                                            <h2 className="form-section-title"><FiUpload /> Add Premium Test Paper</h2>
                                            <div className="form-grid">
                                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                    <label>Title *</label>
                                                    <input className="admin-input" placeholder="e.g. St Paul's Girls School — 11+ Maths Sample Paper 1 — 2025" value={tpTitle} onChange={e => setTpTitle(e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label>Subject *</label>
                                                    <select className="admin-input" value={tpSubject} onChange={e => setTpSubject(e.target.value)}>
                                                        <option value="11+ Maths">11+ Maths</option>
                                                        <option value="11+ NVR">11+ NVR</option>
                                                        <option value="11+ English">11+ English</option>
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label>School Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                                    <input className="admin-input" placeholder="e.g. King's College School" value={tpSchool} onChange={e => setTpSchool(e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label>Year <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                                    <input className="admin-input" type="number" placeholder="e.g. 2025" min={2000} max={2099} value={tpYear} onChange={e => setTpYear(e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label>Sort Order</label>
                                                    <input className="admin-input" type="number" min={0} value={tpSortOrder} onChange={e => setTpSortOrder(e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label>Linked Quiz ID <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                                    <select className="admin-input" value={tpQuizId} onChange={e => setTpQuizId(e.target.value)}>
                                                        <option value="">Select a quiz</option>
                                                        {premiumQuizChoices.map(quiz => (
                                                            <option key={quiz.value} value={quiz.value}>{quiz.label}</option>
                                                        ))}
                                                    </select>
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                                                        <motion.button
                                                            type="button"
                                                            className="btn-secondary btn-sm"
                                                            onClick={() => startLinkedQuizDraft({ target: 'paper', title: tpTitle, subject: tpSubject, returnTab: 'premium_papers' })}
                                                            whileHover={{ scale: 1.02 }}
                                                            whileTap={{ scale: 0.98 }}
                                                        >
                                                            Create linked quiz
                                                        </motion.button>
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label>PDF File <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                                    <label className="file-upload-label worksheet-upload-label">
                                                        <FiUpload /> {tpFile ? tpFile.name : 'Select PDF'}
                                                        <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => setTpFile(e.target.files[0] || null)} />
                                                    </label>
                                                </div>
                                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '1.5rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        id="tp-is-free"
                                                        checked={tpIsFree}
                                                        onChange={e => setTpIsFree(e.target.checked)}
                                                        style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                                                    />
                                                    <label htmlFor="tp-is-free" style={{ cursor: 'pointer', fontWeight: 500 }}>Mark as FREE (visible to all)</label>
                                                </div>
                                            </div>
                                            <motion.button
                                                className="btn-primary"
                                                onClick={savePremiumTestPaper}
                                                disabled={tpSaving}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                style={{ marginTop: '0.75rem' }}
                                            >
                                                {tpSaving ? 'Saving…' : <><FiPlus /> Add Test Paper</>}
                                            </motion.button>
                                        </div>
                                    )}

                                    {/* Papers List grouped by subject */}
                                    {loadingPremiumPapers ? (
                                        <div className="loading-state">
                                            <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                                            <p>Loading papers…</p>
                                        </div>
                                    ) : premiumTestPapers.length === 0 ? (
                                        <div className="empty-state glass-card">
                                            <FiFileText />
                                            <h3>No premium test papers yet</h3>
                                            <p>Add papers using the form above.</p>
                                        </div>
                                    ) : (
                                        ['11+ Maths', '11+ NVR', '11+ English'].map(subj => {
                                            const subjPapers = premiumTestPapers.filter(p => p.subject === subj);
                                            if (!subjPapers.length) return null;
                                            return (
                                                <div key={subj} style={{ marginBottom: '2rem' }}>
                                                    <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--primary)' }}>{subj}</h3>
                                                    <div className="quiz-manage-list">
                                                        {subjPapers.map((paper, i) => (
                                                            <motion.div
                                                                key={paper.id}
                                                                className="manage-card glass-card"
                                                                initial={{ opacity: 0, y: 15 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: i * 0.04 }}
                                                            >
                                                                <div className="manage-card-info">
                                                                    <h3>{paper.title}</h3>
                                                                    <div className="manage-meta">
                                                                        <span className="manage-badge">{paper.subject}</span>
                                                                        {paper.school_name && <span className="manage-badge">{paper.school_name}</span>}
                                                                        {paper.year && <span className="manage-badge">{paper.year}</span>}
                                                                        {paper.is_free
                                                                            ? <span className="manage-badge" style={{ background: 'rgba(0,184,122,0.1)', color: 'var(--success)', borderColor: 'rgba(0,184,122,0.2)' }}>FREE</span>
                                                                            : <span className="manage-badge" style={{ background: 'rgba(212,169,26,0.1)', color: 'var(--primary)', borderColor: 'rgba(212,169,26,0.2)' }}><FiLock style={{ fontSize: '0.7rem' }} /> Premium</span>
                                                                        }
                                                                        {paper.quiz_id && <span className="manage-badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.2)' }}>Quiz linked</span>}
                                                                        {paper.file_url && <span className="manage-badge" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.2)' }}><FiFileText /> PDF</span>}
                                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Order: {paper.sort_order}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="manage-card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                                                                    {paper.file_url && (
                                                                        <a href={paper.file_url} target="_blank" rel="noopener noreferrer">
                                                                            <motion.button className="btn-secondary" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="View PDF">
                                                                                <FiExternalLink />
                                                                            </motion.button>
                                                                        </a>
                                                                    )}
                                                                    {paper.quiz_id && !isReadOnly && (
                                                                        <motion.button
                                                                            className="btn-secondary"
                                                                            onClick={() => {
                                                                                const quiz = quizzes.find(q => q.id === paper.quiz_id);
                                                                                if (quiz) loadQuizForEditing(quiz);
                                                                                else setMessage({ type: 'error', text: 'Linked quiz not found. It may have been deleted.' });
                                                                            }}
                                                                            whileHover={{ scale: 1.05 }}
                                                                            whileTap={{ scale: 0.95 }}
                                                                            title="Edit linked quiz"
                                                                            style={{ fontSize: '0.78rem', padding: '0.4rem 0.7rem' }}
                                                                        >
                                                                            <FiEdit2 /> Edit Quiz
                                                                        </motion.button>
                                                                    )}
                                                                    {!isReadOnly && (
                                                                        <>
                                                                            <motion.button
                                                                                className="btn-secondary"
                                                                                onClick={() => toggleTestPaperFree(paper)}
                                                                                whileHover={{ scale: 1.05 }}
                                                                                whileTap={{ scale: 0.95 }}
                                                                                title={paper.is_free ? 'Make Premium' : 'Make Free'}
                                                                                style={{ fontSize: '0.78rem', padding: '0.4rem 0.7rem' }}
                                                                            >
                                                                                {paper.is_free ? 'Make Premium' : 'Make Free'}
                                                                            </motion.button>
                                                                            {!paper.is_free && (
                                                                                <motion.button
                                                                                    className="btn-secondary"
                                                                                    onClick={() => editTestPaperPrice(paper)}
                                                                                    whileHover={{ scale: 1.05 }}
                                                                                    whileTap={{ scale: 0.95 }}
                                                                                    title="Edit Price"
                                                                                    style={{ fontSize: '0.78rem', padding: '0.4rem 0.7rem' }}
                                                                                >
                                                                                    <FiDollarSign /> Edit Price
                                                                                </motion.button>
                                                                            )}
                                                                            <motion.button
                                                                                className="btn-delete"
                                                                                onClick={() => deletePremiumTestPaper(paper)}
                                                                                whileHover={{ scale: 1.05 }}
                                                                                whileTap={{ scale: 0.95 }}
                                                                                title="Delete"
                                                                            >
                                                                                <FiTrash2 />
                                                                            </motion.button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </motion.div>
                            )}

                            {tab === 'premium_purchases' && (
                                <motion.div key="premium_purchases" initial="hidden" animate="visible" exit="hidden" variants={fadeUp}>
                                    <div className="admin-section glass-card">
                                        <div className="section-header purchases-header">
                                            <div>
                                                <h2><FiDollarSign /> Purchases & Subscriptions</h2>
                                                <p className="subtitle">View all premium NVR subscriptions, bundle purchases, and individual paper transactions.</p>
                                            </div>
                                            <div className="section-header-pill">{purchases.length} records</div>
                                        </div>

                                        <div className="purchase-summary-grid">
                                            <div className="purchase-summary-card glass-card">
                                                <span className="purchase-summary-label">Total purchases</span>
                                                <strong>{purchaseSummary.totalPurchases}</strong>
                                                <small>Across premium NVR and paper sales</small>
                                            </div>
                                            <div className="purchase-summary-card glass-card">
                                                <span className="purchase-summary-label">NVR subscriptions</span>
                                                <strong>{purchaseSummary.nvrSubscriptions}</strong>
                                                <small>Active and completed subscriptions</small>
                                            </div>
                                            <div className="purchase-summary-card glass-card">
                                                <span className="purchase-summary-label">Paper purchases</span>
                                                <strong>{purchaseSummary.paperPurchases}</strong>
                                                <small>Single paper transactions</small>
                                            </div>
                                            <div className="purchase-summary-card glass-card">
                                                <span className="purchase-summary-label">Revenue</span>
                                                <strong>£{(purchaseSummary.totalRevenue / 100).toFixed(2)}</strong>
                                                <small>{purchaseSummary.activePayments} completed payments</small>
                                            </div>
                                        </div>

                                        {loadingPurchases ? (
                                            <div className="loading-spinner"></div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="admin-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Date</th>
                                                            <th>User</th>
                                                            <th>Item Type</th>
                                                            <th>Item Name</th>
                                                            <th>Amount</th>
                                                            <th>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {purchases.map(p => (
                                                            <tr key={p.id}>
                                                                <td>{new Date(p.created_at).toLocaleDateString()} {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                                                <td>{p.display_name}</td>
                                                                <td>
                                                                    <span className={`difficulty-badge ${p.type === 'nvr_subscription' ? 'easy' : 'hard'}`}>
                                                                        {p.type.replace('_', ' ').toUpperCase()}
                                                                    </span>
                                                                </td>
                                                                <td>{p.itemName}</td>
                                                                <td>£{((p.amount_pence || 0) / 100).toFixed(2)}</td>
                                                                <td>
                                                                    <span className={`status-badge ${(p.status === 'completed' || p.status === 'active') ? 'status-approved' :
                                                                        p.status === 'pending' ? 'status-pending' : 'status-rejected'
                                                                        }`}>
                                                                        {p.status.toUpperCase()}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {purchases.length === 0 && (
                                                            <tr>
                                                                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No purchases found.</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Coupon Management ────────────────── */}
                                    <div className="admin-section glass-card coupon-section" style={{ marginTop: '2rem' }}>
                                        <div className="section-header">
                                            <div>
                                                <h2><FiTag /> Coupon Codes</h2>
                                                <p className="subtitle">Create and manage coupon codes for test paper purchases.</p>
                                            </div>
                                            <div className="section-header-pill">{coupons.length} coupons</div>
                                        </div>

                                        {/* Create Coupon Form */}
                                        {!isReadOnly && (
                                            <div className="coupon-form-grid">
                                                <div className="form-field coupon-field">
                                                    <label>Code</label>
                                                    <input className="admin-input" type="text" placeholder="e.g. SAVE20" value={couponCode} onChange={e => setCouponCode(e.target.value)} />
                                                </div>
                                                <div className="form-field coupon-field">
                                                    <label>Type</label>
                                                    <select className="admin-input" value={couponType} onChange={e => setCouponType(e.target.value)}>
                                                        <option value="percentage">Percentage (%)</option>
                                                        <option value="fixed">Fixed (pence)</option>
                                                    </select>
                                                </div>
                                                <div className="form-field coupon-field">
                                                    <label>Value</label>
                                                    <input className="admin-input" type="number" placeholder={couponType === 'percentage' ? '0-100' : 'Pence'} value={couponValue} onChange={e => setCouponValue(e.target.value)} />
                                                </div>
                                                <div className="form-field coupon-field">
                                                    <label>Max Uses</label>
                                                    <input className="admin-input" type="number" placeholder="Unlimited" value={couponMaxUses} onChange={e => setCouponMaxUses(e.target.value)} />
                                                </div>
                                                <div className="form-field coupon-field">
                                                    <label>Min Cart (pence)</label>
                                                    <input className="admin-input" type="number" placeholder="0" value={couponMinCart} onChange={e => setCouponMinCart(e.target.value)} />
                                                </div>
                                                <div className="form-field coupon-field">
                                                    <label>Expires</label>
                                                    <input className="admin-input" type="date" value={couponExpiry} onChange={e => setCouponExpiry(e.target.value)} />
                                                </div>
                                                <div className="form-field coupon-submit-field">
                                                    <button className="btn-primary coupon-submit-btn" onClick={saveCoupon} disabled={couponSaving} type="button">
                                                        <FiPlus /> {couponSaving ? 'Saving…' : 'Add Coupon'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {loadingCoupons ? (
                                            <div className="loading-spinner"></div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="admin-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Code</th>
                                                            <th>Discount</th>
                                                            <th>Uses</th>
                                                            <th>Min Cart</th>
                                                            <th>Expires</th>
                                                            <th>Status</th>
                                                            <th>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {coupons.map(c => (
                                                            <tr key={c.id}>
                                                                <td><strong>{c.code}</strong></td>
                                                                <td>{c.discount_type === 'percentage' ? `${c.discount_value}%` : `£${(c.discount_value / 100).toFixed(2)}`}</td>
                                                                <td>{c.current_uses}{c.max_uses ? ` / ${c.max_uses}` : ' / ∞'}</td>
                                                                <td>{c.min_cart_pence > 0 ? `£${(c.min_cart_pence / 100).toFixed(2)}` : '—'}</td>
                                                                <td>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}</td>
                                                                <td>
                                                                    <span className={`status-badge ${c.is_active ? 'status-approved' : 'status-rejected'}`}>
                                                                        {c.is_active ? 'ACTIVE' : 'INACTIVE'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ display: 'flex', gap: '0.4rem' }}>
                                                                    {!isReadOnly && (
                                                                        <>
                                                                            <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => toggleCouponActive(c)}>
                                                                                {c.is_active ? 'Disable' : 'Enable'}
                                                                            </button>
                                                                            <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem', color: 'var(--error)' }} onClick={() => deleteCoupon(c)}>
                                                                                <FiTrash2 />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {coupons.length === 0 && (
                                                            <tr>
                                                                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No coupons created yet.</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </div>
        </div>
    );
}
