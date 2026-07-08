// @ts-nocheck  — Deno edge function; VS Code TS errors here are false positives
//
// Self-healing payment reconciliation.
//
// The normal flow verifies a payment client-side right after Razorpay's
// onSuccess callback. If the browser is closed, the network drops, or the
// user's auth token expired between paying and that callback, the DB row is
// left "pending" even though Razorpay charged the customer.
//
// This function is called on page load for a signed-in user. It looks at that
// user's own pending orders, asks Razorpay whether each order was actually
// PAID, and only then marks the matching row completed. Genuinely abandoned
// (unpaid) orders are left untouched.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
    if (!keyId || !keySecret) {
      return new Response(JSON.stringify({ error: "Payment service not configured." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rzpAuth = "Basic " + btoa(`${keyId}:${keySecret}`);

    // Returns a captured payment id if the order was actually paid, else null.
    async function paidPaymentId(orderId: string): Promise<string | null> {
      const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
        headers: { Authorization: rzpAuth },
      });
      if (!res.ok) return null;
      const order = await res.json();
      if (order.status !== "paid") return null;
      // Fetch the captured payment to record its id.
      const pRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
        headers: { Authorization: rzpAuth },
      });
      if (!pRes.ok) return orderId; // paid but couldn't list payments; still complete it
      const payments = await pRes.json();
      const captured = (payments.items || []).find((p: any) => p.status === "captured")
        || (payments.items || [])[0];
      return captured?.id || orderId;
    }

    const healed = { dashboard: 0, nvr: 0, papers: 0 };

    // Collect this user's unique pending order ids per table.
    const gather = async (table: string) => {
      const { data } = await supabaseAdmin
        .from(table)
        .select("razorpay_order_id")
        .eq("user_id", user.id)
        .eq("status", "pending");
      return [...new Set((data || []).map((r: any) => r.razorpay_order_id).filter(Boolean))];
    };

    // Applies a completion update for a paid order. If razorpay_payment_id is
    // already recorded on another row (unique constraint), access is still
    // granted — we just skip storing the duplicate payment id.
    const applyUpdate = async (table: string, orderId: string, fields: any) => {
      let { error } = await supabaseAdmin.from(table).update(fields)
        .eq("razorpay_order_id", orderId).eq("user_id", user.id).eq("status", "pending");
      if (error && (error.code === "23505" || /duplicate key/i.test(error.message || ""))) {
        const { razorpay_payment_id, ...rest } = fields;
        ({ error } = await supabaseAdmin.from(table).update(rest)
          .eq("razorpay_order_id", orderId).eq("user_id", user.id).eq("status", "pending"));
      }
      return !error;
    };

    const oneYear = () => {
      const now = new Date();
      const expires = new Date(now); expires.setFullYear(expires.getFullYear() + 1);
      return [now.toISOString(), expires.toISOString()];
    };

    // Dashboard access — 1-year subscription.
    for (const orderId of await gather("dashboard_purchases")) {
      const paymentId = await paidPaymentId(orderId);
      if (!paymentId) continue;
      const [purchased_at, expires_at] = oneYear();
      if (await applyUpdate("dashboard_purchases", orderId, {
        razorpay_payment_id: paymentId, status: "completed", purchased_at, expires_at,
      })) healed.dashboard++;
    }

    // NVR subscription — 1-year subscription.
    for (const orderId of await gather("nvr_subscriptions")) {
      const paymentId = await paidPaymentId(orderId);
      if (!paymentId) continue;
      const [started_at, expires_at] = oneYear();
      if (await applyUpdate("nvr_subscriptions", orderId, {
        razorpay_payment_id: paymentId, status: "active", started_at, expires_at,
      })) healed.nvr++;
    }

    // Paper / bundle purchases — one order id can span several rows.
    for (const orderId of await gather("paper_purchases")) {
      const paymentId = await paidPaymentId(orderId);
      if (!paymentId) continue;
      if (await applyUpdate("paper_purchases", orderId, {
        razorpay_payment_id: paymentId, status: "completed", purchased_at: new Date().toISOString(),
      })) healed.papers++;
    }

    return new Response(JSON.stringify({ success: true, healed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
