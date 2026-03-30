import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
    FiPlus, FiTrash2, FiSave, FiCalendar, FiClock, FiList,
    FiEdit2, FiCheck, FiAlertTriangle, FiFileText, FiEye, FiX, FiImage, FiUpload,
    FiUsers, FiGlobe, FiMonitor, FiSearch, FiChevronLeft, FiChevronRight,
    FiFilter, FiBarChart2, FiArrowUp, FiArrowDown, FiLock, FiSmartphone,
    FiExternalLink
} from 'react-icons/fi';
import { compressImage } from '../utils/imageCompressor';
import './Admin.css';

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } })
};

const SUBJECTS = ['11+ Mathematics', 'Science', 'English', 'History', 'Geography', 'General Knowledge', 'Reasoning', 'Verbal Reasoning', 'Non-Verbal Reasoning'];

function parseBulkQuestions(text) {
    const blocks = text.trim().split(/\n\s*\n/);
    const parsed = [];
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
            } else if (/^[A-D][:.)]\s*/i.test(line)) {
                let optText = line.replace(/^[A-D][:.)]\s*/i, '').trim();
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
    const [ppTitle, setPpTitle] = useState('');
    const [ppYear, setPpYear] = useState('');
    const [ppSubject, setPpSubject] = useState('11+ Mathematics');
    const [ppDifficulty, setPpDifficulty] = useState('Medium');
    const [ppFile, setPpFile] = useState(null);
    const [ppSaving, setPpSaving] = useState(false);

    useEffect(() => {
        fetchQuizzes();
        fetchWorksheets();
    }, []);

    useEffect(() => {
        if (tab === 'visitors') fetchVisitors();
        if (tab === 'pastpapers') fetchPastPapers();
    }, [tab]);

    async function fetchQuizzes() {
        setLoadingQuizzes(true);
        const { data } = await supabase
            .from('quizzes')
            .select('*, questions(count)')
            .order('quiz_date', { ascending: false })
            .limit(50);
        setQuizzes(data || []);
        setLoadingQuizzes(false);
    }

    async function fetchWorksheets() {
        const { data } = await supabase
            .from('daily_worksheets')
            .select('id, quiz_id, title, subject, worksheet_date, file_url, file_name, file_path')
            .order('worksheet_date', { ascending: false })
            .limit(200);
        setWorksheets(data || []);
    }

    async function fetchPastPapers() {
        setLoadingPastPapers(true);
        const { data } = await supabase
            .from('past_papers')
            .select('*')
            .order('year', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });
        setPastPapers(data || []);
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
                    parsedOpts = ['', '', '', ''];
                }
            }
            if (!Array.isArray(parsedOpts)) {
                parsedOpts = ['', '', '', ''];
            }

            return {
                id: q.id,
                question_text: q.question_text || '',
                options: parsedOpts,
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
        const parsed = parseBulkQuestions(bulkText);
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
            options: ['', '', '', ''],
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
            setSubject('Mathematics');
            setDuration(10);
            setNegativeMarking(false);
            setBulkText('');
            setQuestions([]);
            setInputMode('bulk');
            setWorksheetPdfFile(null);
            setExistingWorksheet(null);
            setWorksheetRemoved(false);
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
            const { data, error } = await supabase
                .from('site_visitors')
                .select('*')
                .order('visited_at', { ascending: false })
                .limit(500);
            if (error) throw error;
            const v = data || [];
            setVisitors(v);

            // Calculate stats
            const today = new Date().toISOString().split('T')[0];
            const fingerprints = new Set(v.filter(r => r.visitor_fingerprint).map(r => r.visitor_fingerprint));
            setVisitorStats({
                total: v.length,
                unique: fingerprints.size,
                today: v.filter(r => r.visited_at && r.visited_at.startsWith(today)).length,
                loggedIn: v.filter(r => r.is_logged_in).length,
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

    const tabs = [
        ...(!isReadOnly ? [{ id: 'create', label: 'Create Quiz', icon: <FiPlus /> }] : [{ id: 'create', label: 'Edit Quiz', icon: <FiEdit2 /> }]),
        { id: 'manage', label: 'Manage Quizzes', icon: <FiList /> },
        { id: 'pastpapers', label: 'Past Papers', icon: <FiFileText /> },
        { id: 'visitors', label: 'Visitors', icon: <FiUsers /> },
    ];

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
                            : 'Create and manage daily quizzes for all students.'}
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

                {/* Tabs */}
                <motion.div className="admin-tabs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                    {tabs.map(t => (
                        <button key={t.id} className={`admin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                            {t.icon} {t.label}
                            {tab === t.id && <motion.div className="tab-indicator" layoutId="adminTab" />}
                        </button>
                    ))}
                </motion.div>

                <AnimatePresence mode="wait">
                    {tab === 'create' && (
                        <motion.div key="create" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            {/* Quiz Details */}
                            <div className="form-section glass-card">
                                <h2 className="form-section-title"><FiEdit2 /> Quiz Details</h2>
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
                                            Format: Question text on one line, then options A, B, C, D. Mark correct option with *.
                                            Add optional "Solution:" or "Exp:" line. Add optional "SolImage:" line with URL. Separate questions with a blank line.
                                        </p>
                                        <pre className="format-example">
                                            {`Q1. Which shape has 3 sides?
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
                                                    {q.options.map((opt, oi) => (
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
                                ) : quizzes.length === 0 ? (
                                    <div className="empty-state glass-card">
                                        <FiList />
                                        <h3>No quizzes yet</h3>
                                        <p>Create your first quiz in the "Create Quiz" tab.</p>
                                    </div>
                                ) : (
                                    <div className="quiz-manage-list">
                                        {quizzes.map((quiz, i) => (
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
                                                        {worksheets.some(w => w.quiz_id === quiz.id) && (
                                                            <span className="manage-badge" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.2)' }}>
                                                                <FiFileText /> Worksheet
                                                            </span>
                                                        )}
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

                            {/* Visitor Data Table */}
                            <motion.div
                                className="visitor-table-section glass-card"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                            >
                                <div className="visitor-table-header">
                                    <h3 className="form-section-title"><FiList /> Visitor Log</h3>
                                    <div className="visitor-search">
                                        <FiSearch />
                                        <input
                                            className="admin-input"
                                            placeholder="Search visitors..."
                                            value={visitorSearch}
                                            onChange={e => { setVisitorSearch(e.target.value); setVisitorPage(0); }}
                                        />
                                    </div>
                                </div>

                                {loadingVisitors ? (
                                    <div className="loading-state">
                                        <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                                        <p>Loading visitors...</p>
                                    </div>
                                ) : filteredVisitors.length === 0 ? (
                                    <div className="empty-state">
                                        <FiUsers />
                                        <h3>No visitor data</h3>
                                        <p>{visitorSearch ? 'No results match your search.' : 'Visitor data will appear here once tracking is active.'}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="visitor-table-wrapper">
                                            <table className="visitor-table">
                                                <thead>
                                                    <tr>
                                                        {[
                                                            { key: 'visited_at', label: 'Date' },
                                                            { key: 'page_url', label: 'Page' },
                                                            { key: 'browser', label: 'Browser' },
                                                            { key: 'os', label: 'OS' },
                                                            { key: 'device_type', label: 'Device' },
                                                            { key: 'country', label: 'Country' },
                                                            { key: 'referrer_url', label: 'Referrer' },
                                                            { key: 'utm_source', label: 'UTM' },
                                                            { key: 'is_logged_in', label: 'User' },
                                                        ].map(col => (
                                                            <th
                                                                key={col.key}
                                                                className={`sortable-th ${visitorSort.field === col.key ? 'sorted' : ''}`}
                                                                onClick={() => toggleVisitorSort(col.key)}
                                                            >
                                                                {col.label}
                                                                {visitorSort.field === col.key && (
                                                                    visitorSort.dir === 'desc' ? <FiArrowDown /> : <FiArrowUp />
                                                                )}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pagedVisitors.map((v, i) => (
                                                        <tr key={v.id || i}>
                                                            <td className="td-date">
                                                                {v.visited_at ? new Date(v.visited_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                            </td>
                                                            <td className="td-page" title={v.page_url}>{v.page_url || '—'}</td>
                                                            <td>{v.browser || '—'}</td>
                                                            <td>{v.os || '—'}</td>
                                                            <td>
                                                                <span className={`device-badge ${v.device_type}`}>
                                                                    {v.device_type === 'mobile' ? <FiSmartphone /> : v.device_type === 'tablet' ? <FiMonitor /> : <FiMonitor />}
                                                                    {v.device_type || '—'}
                                                                </span>
                                                            </td>
                                                            <td>{v.country || '—'}</td>
                                                            <td className="td-referrer" title={v.referrer_url}>{v.referrer_url ? (() => { try { return new URL(v.referrer_url).hostname; } catch { return v.referrer_url; } })() : '(direct)'}</td>
                                                            <td>{v.utm_source || '—'}</td>
                                                            <td>
                                                                {v.is_logged_in
                                                                    ? <span className="user-badge logged-in" title={v.user_email}><FiCheck /> {v.user_email ? v.user_email.split('@')[0] : 'User'}</span>
                                                                    : <span className="user-badge anonymous">Anonymous</span>
                                                                }
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Pagination */}
                                        {totalVisitorPages > 1 && (
                                            <div className="visitor-pagination">
                                                <button
                                                    className="pagination-btn"
                                                    disabled={visitorPage === 0}
                                                    onClick={() => setVisitorPage(p => p - 1)}
                                                >
                                                    <FiChevronLeft />
                                                </button>
                                                <span className="pagination-info">
                                                    Page {visitorPage + 1} of {totalVisitorPages} ({filteredVisitors.length} results)
                                                </span>
                                                <button
                                                    className="pagination-btn"
                                                    disabled={visitorPage >= totalVisitorPages - 1}
                                                    onClick={() => setVisitorPage(p => p + 1)}
                                                >
                                                    <FiChevronRight />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
