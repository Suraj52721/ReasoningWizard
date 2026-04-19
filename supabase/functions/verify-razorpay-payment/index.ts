// @ts-nocheck  — Deno edge function; VS Code TS errors here are false positives
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSHA256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      type,
      status,
    } = await req.json();

    if (!razorpay_order_id || !type) {
      return new Response(JSON.stringify({ error: "Missing payment fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist checkout failure/cancel without signature verification.
    if (status === "failed" || status === "cancelled") {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      if (type === "nvr_subscription") {
        const { error } = await supabaseAdmin
          .from("nvr_subscriptions")
          .update({ status: "cancelled" })
          .eq("razorpay_order_id", razorpay_order_id)
          .eq("user_id", user.id)
          .eq("status", "pending");

        if (error) throw error;
      } else if (type === "bundle_purchase" || type === "individual_paper_purchase") {
        const { error } = await supabaseAdmin
          .from("paper_purchases")
          .update({ status: "failed" })
          .eq("razorpay_order_id", razorpay_order_id)
          .eq("user_id", user.id)
          .eq("status", "pending");

        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: "Missing payment verification fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify Razorpay signature
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

    if (!keySecret) {
      console.error("[verify-razorpay-payment] RAZORPAY_KEY_SECRET is not set in Edge Function secrets.");
      return new Response(
        JSON.stringify({ error: "Payment verification service is not configured. Please contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const expectedSignature = await hmacSHA256(
      keySecret,
      `${razorpay_order_id}|${razorpay_payment_id}`
    );

    if (expectedSignature !== razorpay_signature) {
      return new Response(JSON.stringify({ error: "Invalid payment signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update DB using service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (type === "nvr_subscription") {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const { error } = await supabaseAdmin
        .from("nvr_subscriptions")
        .update({
          razorpay_payment_id,
          razorpay_signature,
          status: "active",
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq("razorpay_order_id", razorpay_order_id)
        .eq("user_id", user.id)
        .eq("status", "pending");

      if (error) throw error;

    } else if (type === "bundle_purchase" || type === "individual_paper_purchase") {
      const { error } = await supabaseAdmin
        .from("paper_purchases")
        .update({
          razorpay_payment_id,
          razorpay_signature,
          status: "completed",
          purchased_at: new Date().toISOString(),
        })
        .eq("razorpay_order_id", razorpay_order_id)
        .eq("user_id", user.id)
        .eq("status", "pending");

      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
