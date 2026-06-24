import { supabase } from '../lib/supabaseClient';
import { getCookieConsent } from '../components/CookieConsent';

// ── User-Agent Parsing ──────────────────────────────────────
function parseBrowser(ua) {
    if (!ua) return { browser: 'Unknown', version: '' };
    const browsers = [
        { name: 'Edge', regex: /Edg[e/]?\/([\d.]+)/ },
        { name: 'Chrome', regex: /Chrome\/([\d.]+)/ },
        { name: 'Firefox', regex: /Firefox\/([\d.]+)/ },
        { name: 'Safari', regex: /Version\/([\d.]+).*Safari/ },
        { name: 'Opera', regex: /OPR\/([\d.]+)/ },
        { name: 'Samsung Internet', regex: /SamsungBrowser\/([\d.]+)/ },
        { name: 'UC Browser', regex: /UCBrowser\/([\d.]+)/ },
    ];
    for (const b of browsers) {
        const match = ua.match(b.regex);
        if (match) return { browser: b.name, version: match[1] || '' };
    }
    return { browser: 'Other', version: '' };
}

function parseOS(ua) {
    if (!ua) return 'Unknown';
    if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
    if (/Windows NT/.test(ua)) return 'Windows';
    if (/Mac OS X/.test(ua)) return 'macOS';
    if (/Android/.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Linux/.test(ua)) return 'Linux';
    if (/CrOS/.test(ua)) return 'ChromeOS';
    return 'Other';
}

function parseDeviceType(ua) {
    if (!ua) return 'desktop';
    if (/Tablet|iPad/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
}

// ── UTM Params ──────────────────────────────────────────────
function getUTMParams() {
    try {
        const params = new URLSearchParams(window.location.search);
        return {
            utm_source: params.get('utm_source') || '',
            utm_medium: params.get('utm_medium') || '',
            utm_campaign: params.get('utm_campaign') || '',
            utm_term: params.get('utm_term') || '',
            utm_content: params.get('utm_content') || '',
        };
    } catch {
        return { utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '' };
    }
}

// ── Session ID ──────────────────────────────────────────────
function getSessionId() {
    let sid = sessionStorage.getItem('rw_session_id');
    if (!sid) {
        sid = `s_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        sessionStorage.setItem('rw_session_id', sid);
    }
    return sid;
}

// ── Simple Visitor Fingerprint ──────────────────────────────
function generateFingerprint() {
    try {
        const components = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            screen.colorDepth,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || 'unknown',
            navigator.platform || 'unknown',
        ];
        const str = components.join('|');
        // Simple hash
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return 'fp_' + Math.abs(hash).toString(36);
    } catch {
        return 'fp_unknown';
    }
}

// ── Geo Data (free API) ─────────────────────────────────────
async function fetchGeoData() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('http://ip-api.com/json/?fields=status,country,regionName,city,query', {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return {};
        const data = await res.json();
        if (data.status === 'success') {
            return {
                country: data.country || '',
                region: data.regionName || '',
                city: data.city || '',
                ip_address: data.query || '',
            };
        }
        return {};
    } catch {
        return {};
    }
}

// ── Track Visit ─────────────────────────────────────────────
let hasTracked = false;

export async function trackVisit(user = null) {
    // Prevent duplicate tracking per page load
    if (hasTracked) return;
    hasTracked = true;

    const consent = getCookieConsent();

    // Only track if user has given some form of consent
    // Essential consent = minimal tracking (page URL + session only)
    // Full consent = full tracking
    if (consent === 'none') return;

    try {
        const ua = navigator.userAgent || '';
        const { browser, version: browserVersion } = parseBrowser(ua);
        const os = parseOS(ua);
        const deviceType = parseDeviceType(ua);
        const utm = getUTMParams();
        const sessionId = getSessionId();
        const fingerprint = consent === 'all' ? generateFingerprint() : '';

        // Fetch geo data (non-blocking, with timeout)
        const geo = consent === 'all' ? await fetchGeoData() : {};

        const record = {
            session_id: sessionId,
            visitor_fingerprint: fingerprint,
            page_url: window.location.pathname + window.location.search,
            referrer_url: consent === 'all' ? (document.referrer || '') : '',
            browser: consent === 'all' ? browser : '',
            browser_version: consent === 'all' ? browserVersion : '',
            os: consent === 'all' ? os : '',
            device_type: consent === 'all' ? deviceType : '',
            screen_resolution: consent === 'all' ? `${screen.width}x${screen.height}` : '',
            language: consent === 'all' ? (navigator.language || '') : '',
            user_agent: consent === 'all' ? ua.substring(0, 500) : '',
            is_logged_in: !!user,
            user_id: user?.id || null,
            user_email: consent === 'all' ? (user?.email || '') : '',
            cookie_consent: consent,
            country: geo.country || '',
            city: geo.city || '',
            region: geo.region || '',
            ip_address: geo.ip_address || '',
            ...utm,
        };

        await supabase.from('site_visitors').insert(record);
    } catch (err) {
        console.warn('Visitor tracking failed:', err.message);
    }
}

// Reset tracking for SPA navigation (optional — call on route change)
export function resetTrackingFlag() {
    hasTracked = false;
}
