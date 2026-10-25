// One-off: moves existing solution PDFs from the PUBLIC 'past_papers' bucket
// into the PRIVATE 'past_paper_solutions' bucket, then clears their public URL.
//
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/migrate-solutions-private.mjs
//
// Safe to re-run: rows already migrated (solution_file_url is null) are skipped.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(url, key);

const { data: rows, error } = await sb.from('past_papers')
  .select('id, title, solution_file_path, solution_file_url')
  .not('solution_file_path', 'is', null)
  .not('solution_file_url', 'is', null);
if (error) throw error;
console.log(`${rows.length} solution(s) to move`);

for (const r of rows) {
  const { data: blob, error: dErr } = await sb.storage.from('past_papers').download(r.solution_file_path);
  if (dErr) { console.error(`✗ ${r.title}: download failed — ${dErr.message}`); continue; }
  const { error: uErr } = await sb.storage.from('past_paper_solutions')
    .upload(r.solution_file_path, blob, { contentType: 'application/pdf', upsert: true });
  if (uErr) { console.error(`✗ ${r.title}: upload failed — ${uErr.message}`); continue; }
  const { error: pErr } = await sb.from('past_papers').update({ solution_file_url: null }).eq('id', r.id);
  if (pErr) { console.error(`✗ ${r.title}: db update failed — ${pErr.message}`); continue; }
  await sb.storage.from('past_papers').remove([r.solution_file_path]);
  console.log(`✓ ${r.title}`);
}
