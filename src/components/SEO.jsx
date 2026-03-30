import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const routeSeo = {
    '/dashboard': {
        title: 'Student Dashboard',
        description: 'Access your quizzes, worksheets, attempts, rankings, and learning progress in the ReasoningWizard dashboard.'
    },
    '/home': {
        title: '11+ Practice Quizzes and Learning Resources',
        description: "ReasoningWizard helps UK students prepare for 11+, SATs, and GCSE with daily quizzes, solved questions, and progress tracking.",
        keywords: '11+ practice, SATs preparation, GCSE quizzes, UK tutoring, reasoning questions'
    },
    '/about': {
        title: 'About ReasoningWizard',
        description: 'Learn about ReasoningWizard, our mission, and how we support UK students with high-quality exam preparation resources.'
    },
    '/contact': {
        title: 'Contact ReasoningWizard',
        description: 'Get in touch with ReasoningWizard for support, enquiries, and partnership opportunities.'
    },
    '/careers': {
        title: 'Careers at ReasoningWizard',
        description: 'Explore open roles and career opportunities at ReasoningWizard.'
    },
    '/questions': {
        title: 'Practice Questions with Solutions',
        description: 'Browse reasoning questions and step-by-step solutions to strengthen exam performance.'
    },
    '/privacy-policy': {
        title: 'Privacy Policy',
        description: 'Read the Privacy Policy for ReasoningWizard.'
    },
    '/terms-of-service': {
        title: 'Terms of Service',
        description: 'Read the Terms of Service for ReasoningWizard.'
    },
    '/login': {
        title: 'Sign In',
        description: 'Sign in to your ReasoningWizard account to continue your learning journey.'
    },
    '/register': {
        title: 'Create Your Account',
        description: 'Create a free ReasoningWizard account and access quizzes, solutions, and progress tracking.'
    },
    '/past-papers': {
        title: '11+ MathsPast Papers',
        description: 'Download free 11+ Maths past year papers for 11+ exam preparation. Browse Easy, Medium, and Hard difficulty papers by subject including Maths, English, Reasoning and more.',
        keywords: '11+ past papers, past year papers, 11 plus exam papers, reasoning past papers, maths past papers, English past papers, free exam papers UK'
    }
};

const noIndexPrefixes = ['/admin', '/quiz'];

function normalizePath(pathname) {
    if (!pathname) return '/';
    const normalized = pathname.replace(/\/+$/, '');
    return normalized === '' ? '/' : normalized;
}

export default function SEO({ title, description, keywords, image, schema, noIndex }) {
    const location = useLocation();
    const siteTitle = "ReasoningWizard";
    const normalizedPath = normalizePath(location.pathname);
    const routeDefaults = routeSeo[normalizedPath] || {};
    const rawTitle = title || routeDefaults.title;
    const fullTitle = rawTitle
        ? (rawTitle.toLowerCase().includes(siteTitle.toLowerCase()) ? rawTitle : `${rawTitle} | ${siteTitle}`)
        : siteTitle;
    const defaultDesc = "UK's premier tutoring & practice sheets academy for 11+, SATs, and GCSEs. Daily quizzes, expert resources, and live leaderboards.";
    const metaDesc = description || routeDefaults.description || defaultDesc;
    const metaKeywords = keywords || routeDefaults.keywords || "ReasoningWizard, 11+, SATs, GCSE, UK education, quizzes, tutoring, practice sheets";
    const siteUrl = "https://reasoningwizard.com";
    const metaImage = image ? `${siteUrl}${image}` : `${siteUrl}/logo.png`;
    const url = `${siteUrl}${normalizedPath}`;
    const shouldNoIndex = typeof noIndex === 'boolean'
        ? noIndex
        : noIndexPrefixes.some(prefix => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));

    useEffect(() => {
        // Title
        document.title = fullTitle;

        // Helper to set or create a meta tag
        const setMeta = (attr, key, content) => {
            let el = document.querySelector(`meta[${attr}="${key}"]`);
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute(attr, key);
                document.head.appendChild(el);
            }
            el.setAttribute('content', content);
        };

        // Helper to set or create a link tag
        const setLink = (rel, href) => {
            let el = document.querySelector(`link[rel="${rel}"]`);
            if (!el) {
                el = document.createElement('link');
                el.setAttribute('rel', rel);
                document.head.appendChild(el);
            }
            el.setAttribute('href', href);
        };

        // Standard meta
        setMeta('name', 'description', metaDesc);
        setMeta('name', 'keywords', metaKeywords);
        setMeta('name', 'robots', shouldNoIndex
            ? 'noindex, nofollow, noarchive'
            : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
        setMeta('name', 'googlebot', shouldNoIndex
            ? 'noindex, nofollow, noarchive'
            : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
        setLink('canonical', url);

        // Open Graph
        setMeta('property', 'og:type', 'website');
        setMeta('property', 'og:url', url);
        setMeta('property', 'og:site_name', siteTitle);
        setMeta('property', 'og:locale', 'en_GB');
        setMeta('property', 'og:title', fullTitle);
        setMeta('property', 'og:description', metaDesc);
        setMeta('property', 'og:image', metaImage);
        setMeta('property', 'og:image:alt', fullTitle);

        // Twitter
        setMeta('name', 'twitter:card', 'summary_large_image');
        setMeta('name', 'twitter:url', url);
        setMeta('name', 'twitter:title', fullTitle);
        setMeta('name', 'twitter:description', metaDesc);
        setMeta('name', 'twitter:image', metaImage);

        // JSON-LD Structured Data
        const existingScript = document.querySelector('script[data-seo-jsonld]');
        if (schema) {
            if (existingScript) {
                existingScript.textContent = JSON.stringify(schema);
            } else {
                const script = document.createElement('script');
                script.type = 'application/ld+json';
                script.setAttribute('data-seo-jsonld', 'true');
                script.textContent = JSON.stringify(schema);
                document.head.appendChild(script);
            }
        } else if (existingScript) {
            existingScript.remove();
        }
    }, [fullTitle, metaDesc, metaKeywords, url, metaImage, schema, shouldNoIndex, siteTitle]);

    return null; // This component only manages <head>, renders nothing
}
