// @ts-nocheck  — Deno edge function; VS Code TS errors here are false positives
//
// Razorpay server-to-server webhook.
//
// Razorpay calls this URL directly when a payment succeeds, independent of the
// customer's browser. It completes the matching order row immediately — even if
// the user closed the tab and never triggered the client-side verification.
// This is the authoritative safety net for "charged in Razorpay but pending in
// the database".
//
// Configure in the Razorpay Dashboard → Settings → Webhooks:
//   URL:    https://<project-ref>.supabase.co/functions/v1/razorpay-webhook
//   Secret: (any string) — must match the RAZORPAY_WEBHOOK_SECRET edge secret
//   Events: payment.captured, order.paid
//
// Deployed with --no-verify-jwt so Razorpay (which sends no Supabase auth
// header) can reach it. Authenticity is enforced via the X-Razorpay-Signature
// HMAC below, so it is not open to the public.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function hmacSHA256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }

  try {
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
    if (!secret) {
      console.error("[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not set.");
      return new Response(JSON.stringify({ error: "Webhook not configured." }), { status: 500 });
    }

    // The signature is computed over the RAW request body — read it as text.
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    const expected = await hmacSHA256Hex(secret, rawBody);
    if (!signature || expected !== signature) {
      return new Response(JSON.stringify({ error: "Invalid signature." }), { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const event = body.event;

    // Only successful-payment events complete an order. Everything else is
    // acknowledged with 200 so Razorpay does not retry.
    if (event !== "payment.captured" && event !== "order.paid") {
      return new Response(JSON.stringify({ ignored: event }), { status: 200 });
    }

    const payment = body.payload?.payment?.entity;
    const order = body.payload?.order?.entity;
    const orderId = payment?.order_id || order?.id;
    const paymentId = payment?.id || null;
    if (!orderId) {
      return new Response(JSON.stringify({ ok: true, note: "no order id" }), { status: 200 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Completes the pending row(s) for this order. Idempotent (filters on
    // status='pending', so webhook re-delivery is a no-op). If the payment id
    // is already stored on another row (unique constraint), access is still
    // granted without the duplicate id.
    const applyUpdate = async (table: string, fields: any) => {
      let { data, error } = await admin.from(table).update(fields)
        .eq("razorpay_order_id", orderId).eq("status", "pending").select("id");
      if (error && (error.code === "23505" || /duplicate key/i.test(error.message || ""))) {
        const { razorpay_payment_id, ...rest } = fields;
        ({ data, error } = await admin.from(table).update(rest)
          .eq("razorpay_order_id", orderId).eq("status", "pending").select("id"));
      }
      return !error && (data?.length || 0) > 0;
    };

    const now = new Date();
    const expires = new Date(now); expires.setFullYear(expires.getFullYear() + 1);
    const nowIso = now.toISOString();
    const expiresIso = expires.toISOString();

    // A given order id lives in exactly one table — try each.
    let updated = false;
    if (await applyUpdate("dashboard_purchases", {
      razorpay_payment_id: paymentId, status: "completed", purchased_at: nowIso, expires_at: expiresIso,
    })) updated = true;
    else if (await applyUpdate("nvr_subscriptions", {
      razorpay_payment_id: paymentId, status: "active", started_at: nowIso, expires_at: expiresIso,
    })) updated = true;
    else if (await applyUpdate("paper_purchases", {
      razorpay_payment_id: paymentId, status: "completed", purchased_at: nowIso,
    })) updated = true;

    return new Response(JSON.stringify({ success: true, updated }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[razorpay-webhook] error:", err?.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
