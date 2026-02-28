import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function SEO({ title, description, keywords, image, schema }) {
    const location = useLocation();
    const siteTitle = "ReasoningWizard";
    const fullTitle = title ? `${title} | ${siteTitle}` : siteTitle;
    const defaultDesc = "UK's premier tutoring & practice sheets academy for 11+, SATs, and GCSEs. Daily quizzes, expert resources, and live leaderboards.";
    const metaDesc = description || defaultDesc;
    const metaKeywords = keywords || "ReasoningWizard, 11+, SATs, GCSE, UK education, quizzes, tutoring, practice sheets";
    const siteUrl = "https://reasoningwizard.com";
    const metaImage = image ? `${siteUrl}${image}` : `${siteUrl}/logo.png`;
    const url = `${siteUrl}${location.pathname}`;

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
        setLink('canonical', url);

        // Open Graph
        setMeta('property', 'og:type', 'website');
        setMeta('property', 'og:url', url);
        setMeta('property', 'og:title', fullTitle);
        setMeta('property', 'og:description', metaDesc);
        setMeta('property', 'og:image', metaImage);

        // Twitter
        setMeta('property', 'twitter:card', 'summary_large_image');
        setMeta('property', 'twitter:url', url);
        setMeta('property', 'twitter:title', fullTitle);
        setMeta('property', 'twitter:description', metaDesc);
        setMeta('property', 'twitter:image', metaImage);

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
    }, [fullTitle, metaDesc, metaKeywords, url, metaImage, schema]);

    return null; // This component only manages <head>, renders nothing
}
