// @ts-nocheck  — Deno edge function; VS Code TS errors here are false positives
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { amount, currency = "GBP", receipt, type, bundle_id, paper_id, paper_ids } = await req.json();

    if (!amount || !receipt || !type) {
      return new Response(JSON.stringify({ error: "Missing required fields: amount, receipt, type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Razorpay order via REST API
    const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

    if (!keyId || !keySecret) {
      console.error("[create-razorpay-order] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set in Edge Function secrets.");
      return new Response(
        JSON.stringify({ error: "Payment service is not configured. Please contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = btoa(`${keyId}:${keySecret}`);

    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt,
        notes: { type, user_id: user.id },
      }),
    });

    if (!orderRes.ok) {
      const errData = await orderRes.json();
      return new Response(
        JSON.stringify({ error: errData.error?.description || "Razorpay order creation failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const order = await orderRes.json();

    // Insert pending record using service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (type === "nvr_subscription") {
      const { error } = await supabaseAdmin.from("nvr_subscriptions").insert({
        user_id: user.id,
        razorpay_order_id: order.id,
        plan: "yearly",
        amount_pence: amount,
        currency,
        status: "pending",
      });
      if (error) throw new Error(`DB Insert Error (nvr_subscriptions): ${error.message}`);
    } else if (type === "bundle_purchase" && paper_ids && Array.isArray(paper_ids)) {
      const { data: papers, error: fetchErr } = await supabaseAdmin.from("premium_test_papers").select("id, price_pence").in("id", paper_ids);
      if (fetchErr) throw new Error(`Fetch Error: ${fetchErr.message}`);

      const rows = papers.map((p: any) => ({
        user_id: user.id,
        paper_id: p.id,
        razorpay_order_id: order.id,
        amount_pence: p.price_pence,
        currency,
        status: "pending",
      }));

      const { error } = await supabaseAdmin.from("paper_purchases").insert(rows);
      if (error) throw new Error(`DB Insert Error (paper_purchases batch): ${error.message}`);
    } else if (type === "individual_paper_purchase" && paper_id) {
      const { error } = await supabaseAdmin.from("paper_purchases").insert({
        user_id: user.id,
        paper_id,
        razorpay_order_id: order.id,
        amount_pence: amount,
        currency,
        status: "pending",
      });
      if (error) throw new Error(`DB Insert Error (paper_purchases): ${error.message}`);
    }

    return new Response(
      JSON.stringify({ order_id: order.id, amount: order.amount, currency: order.currency }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
