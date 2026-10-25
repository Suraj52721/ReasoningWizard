// @ts-nocheck  — Deno edge function; VS Code TS errors here are false positives
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Returns a short-lived signed URL for a past paper's solution PDF, but only
// to a user who has a completed purchase for it (or to an admin).
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { paper_id } = await req.json();
    if (!paper_id) return json({ error: "Missing paper_id" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: paper } = await admin
      .from("past_papers").select("solution_file_path").eq("id", paper_id).maybeSingle();
    if (!paper?.solution_file_path) return json({ error: "No solution available." }, 404);

    const [{ data: purchase }, { data: profile }] = await Promise.all([
      admin.from("past_paper_purchases").select("id")
        .eq("user_id", user.id).eq("paper_id", paper_id).eq("status", "completed").limit(1).maybeSingle(),
      admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    ]);
    if (!purchase && !profile?.is_admin) return json({ error: "Purchase required." }, 403);

    const { data, error } = await admin.storage
      .from("past_paper_solutions")
      .createSignedUrl(paper.solution_file_path, 120);
    if (error) throw error;

    return json({ url: data.signedUrl });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
