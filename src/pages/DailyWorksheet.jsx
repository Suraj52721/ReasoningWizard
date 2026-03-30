import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiCalendar, FiDownload, FiExternalLink, FiFileText } from 'react-icons/fi';
import { supabase } from '../lib/supabaseClient';

function logWorksheetDownload(id) {
    supabase.from('download_logs').insert({ resource_type: 'worksheet', resource_id: id });
}
import './DailyWorksheet.css';

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.07, duration: 0.35 }
    })
};

function formatWorksheetDate(dateStr) {
    if (!dateStr) return 'Date not set';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

export default function DailyWorksheet() {
    const [worksheets, setWorksheets] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWorksheets();
    }, []);

    async function fetchWorksheets() {
        setLoading(true);
        const { data, error } = await supabase
            .from('daily_worksheets')
            .select('id, title, subject, worksheet_date, file_url, created_at')
            .order('worksheet_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Failed to load worksheets:', error);
            setWorksheets([]);
        } else {
            setWorksheets(data || []);
        }

        setLoading(false);
    }

    return (
        <div className="worksheet-page page-container">
            <div className="worksheet-inner">
                <motion.div
                    className="worksheet-header"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h1 className="worksheet-title">Daily <span className="text-gradient">Worksheets</span></h1>
                    <p className="worksheet-subtitle">Open or download every uploaded worksheet PDF from one place.</p>
                </motion.div>

                {loading ? (
                    <div className="loading-state">
                        <motion.div className="spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                        <p>Loading worksheets...</p>
                    </div>
                ) : worksheets.length === 0 ? (
                    <div className="empty-state glass-card">
                        <FiFileText />
                        <h3>No worksheets uploaded yet</h3>
                        <p>Please check back later.</p>
                    </div>
                ) : (
                    <div className="worksheet-grid">
                        {worksheets.map((worksheet, i) => (
                            <motion.article
                                key={worksheet.id}
                                className="worksheet-card glass-card"
                                variants={fadeUp}
                                initial="hidden"
                                animate="visible"
                                custom={i}
                            >
                                <div className="worksheet-card-header">
                                    <span className="worksheet-subject">{worksheet.subject || 'General'}</span>
                                    <span className="worksheet-date"><FiCalendar /> {formatWorksheetDate(worksheet.worksheet_date)}</span>
                                </div>
                                <h2 className="worksheet-card-title">{worksheet.title}</h2>

                                <div className="worksheet-actions">
                                    <a
                                        href={worksheet.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-secondary worksheet-btn"
                                    >
                                        <FiExternalLink /> Open
                                    </a>
                                    <a
                                        href={worksheet.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download
                                        className="btn-primary worksheet-btn"
                                        onClick={() => logWorksheetDownload(worksheet.id)}
                                    >
                                        <FiDownload /> Download
                                    </a>
                                </div>
                            </motion.article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
