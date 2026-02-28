/**
 * Sitemap Generator for Reasoning Wizard
 * 
 * Run: node scripts/generate-sitemap.js
 * 
 * Requires environment variables:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 * 
 * You can use a .env file in the project root (parsed by dotenv).
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const SITE_URL = 'https://reasoningwizard.com';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Static pages
const staticPages = [
    '/',
    '/about',
    '/contact',
    '/careers',
    '/privacy-policy',
    '/terms-of-service',
    '/questions',
    '/login',
    '/register',
];

async function generate() {
    console.log('🗺️  Generating sitemap...');

    // Fetch all question IDs
    const { data: questions, error } = await supabase
        .from('questions')
        .select('id, quiz_id')
        .order('quiz_id')
        .order('sort_order');

    if (error) {
        console.error('Error fetching questions:', error.message);
        process.exit(1);
    }

    const today = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    // Static pages
    for (const page of staticPages) {
        xml += `  <url>
    <loc>${SITE_URL}${page}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page === '/' ? 'daily' : 'weekly'}</changefreq>
    <priority>${page === '/' ? '1.0' : '0.8'}</priority>
  </url>
`;
    }

    // Dynamic question pages
    for (const q of (questions || [])) {
        xml += `  <url>
    <loc>${SITE_URL}/question/${q.id}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;
    }

    xml += `</urlset>`;

    const outPath = resolve(__dirname, '..', 'public', 'sitemap.xml');
    writeFileSync(outPath, xml, 'utf-8');
    console.log(`✅ Sitemap written to ${outPath}`);
    console.log(`   ${staticPages.length} static pages + ${(questions || []).length} question pages`);
}

generate();
