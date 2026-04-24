import { supabase } from './supabaseClient';

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// ── Startup validation ─────────────────────────────────────────────
if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID.includes('XXXX')) {
  console.warn('[Razorpay] VITE_RAZORPAY_KEY_ID is missing or still a placeholder — payments will not work.');
}
if (!SUPABASE_URL) {
  console.warn('[Razorpay] VITE_SUPABASE_URL is not set — edge function calls will fail.');
}
if (!SUPABASE_ANON_KEY) {
  console.warn('[Razorpay] Supabase anon key is not set — edge function calls will fail.');
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Translate raw network / fetch errors into user-friendly messages */
function friendlyError(err) {
  const msg = err?.message || String(err);

  if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('ERR_NETWORK')) {
    return 'Unable to connect to the payment server. Please check your internet connection and try again.';
  }
  if (msg.includes('AbortError') || msg.includes('timed out')) {
    return 'The payment server took too long to respond. Please try again in a moment.';
  }
  if (msg.includes('Unauthorized') || msg.includes('401')) {
    return 'Your session has expired. Please sign in again and retry.';
  }
  if (msg.includes('CORS') || msg.includes('cross-origin')) {
    return 'A security restriction prevented the payment request. Please try refreshing the page.';
  }
  if (msg.includes('Razorpay order creation failed')) {
    return 'The payment gateway could not create your order. Please try again or contact support.';
  }
  if (msg.includes('Edge function') && msg.includes('404')) {
    return 'Payment service is temporarily unavailable. Please try again later or contact support.';
  }
  // Return original if already descriptive enough
  return msg;
}

/** Fetch with a timeout (default 15 s) */
function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal })
    .then((res) => { clearTimeout(timer); return res; })
    .catch((err) => {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Please check your internet and try again.');
      }
      throw err;
    });
}

/**
 * Calls a Supabase Edge Function with:
 *  - Auth header from current session
 *  - A 15-second timeout
 *  - One automatic retry on network errors
 *  - User-friendly error translation
 */
async function callEdgeFunction(functionName, body, _retryCount = 0) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Payment service is not configured. Please contact support.');
  }

  // Get auth token
  let accessToken;
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session?.access_token) {
      throw new Error('Please sign in again before making a payment.');
    }
    accessToken = session.access_token;
  } catch (authErr) {
    throw new Error(friendlyError(authErr));
  }

  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  let response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    // Retry once on network-level errors (not HTTP errors)
    if (_retryCount < 1) {
      console.warn(`[Razorpay] Retrying ${functionName} after network error…`, networkErr.message);
      // Small delay before retry
      await new Promise((r) => setTimeout(r, 1500));
      return callEdgeFunction(functionName, body, _retryCount + 1);
    }
    throw new Error(friendlyError(networkErr));
  }

  // Parse response body
  const raw = await response.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw };
    }
  }

  if (!response.ok) {
    const serverMsg = data.error || data.message || `Payment service error (${response.status})`;
    // Retry once on 5xx server errors
    if (response.status >= 500 && _retryCount < 1) {
      console.warn(`[Razorpay] Retrying ${functionName} after server error ${response.status}…`);
      await new Promise((r) => setTimeout(r, 1500));
      return callEdgeFunction(functionName, body, _retryCount + 1);
    }
    throw new Error(friendlyError({ message: serverMsg }));
  }

  return data;
}

// ── Public API ──────────────────────────────────────────────────────

/** Dynamically loads the Razorpay checkout script */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-checkout-script')) {
      // Already appended — check if Razorpay global is available
      if (window.Razorpay) { resolve(true); return; }
      // Script was appended but hasn't loaded yet — wait a bit
      const check = setInterval(() => {
        if (window.Razorpay) { clearInterval(check); resolve(true); }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(!!window.Razorpay); }, 5000);
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => {
      // Remove failed script so a future attempt can retry
      script.remove();
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Calls the Supabase Edge Function to create a Razorpay order.
 */
export async function createRazorpayOrder({ amount, currency = 'INR', receipt, type, bundle_id, paper_id, paper_ids }) {
  if (!amount || amount <= 0) throw new Error('Invalid payment amount.');
  if (!receipt) throw new Error('Missing payment receipt identifier.');
  if (!type) throw new Error('Missing payment type.');

  return callEdgeFunction('create-razorpay-order', { amount, currency, receipt, type, bundle_id, paper_id, paper_ids });
}

/**
 * Calls the Supabase Edge Function to verify the Razorpay payment signature.
 */
export async function verifyRazorpayPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, type }) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new Error('Incomplete payment response. Please contact support.');
  }
  if (!type) {
    throw new Error('Missing payment type during verification.');
  }

  return callEdgeFunction('verify-razorpay-payment', {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    type,
  });
}

/**
 * Marks a payment attempt as failed/cancelled when checkout does not complete.
 */
export async function markRazorpayPaymentStatus({ razorpay_order_id, type, status }) {
  if (!razorpay_order_id || !type || !status) {
    throw new Error('Missing payment status fields.');
  }

  return callEdgeFunction('verify-razorpay-payment', {
    razorpay_order_id,
    type,
    status,
  });
}

/**
 * Opens the Razorpay checkout modal.
 * Requires the script to be loaded first via loadRazorpayScript().
 *
 * @param {Object} opts
 * @param {string} opts.orderId
 * @param {number} opts.amount - in smallest currency unit (paise for INR)
 * @param {string} opts.currency
 * @param {string} opts.description
 * @param {Object} [opts.prefill]
 * @param {(response: Object) => Promise<void>} opts.onSuccess
 * @param {(err: Error) => void} [opts.onFailure]
 */
export function openRazorpayCheckout({ orderId, amount, currency, description, prefill, onSuccess, onFailure }) {
  if (!window.Razorpay) {
    onFailure?.(new Error('Payment gateway failed to load. Please refresh and try again.'));
    return;
  }

  if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID.includes('XXXX')) {
    onFailure?.(new Error('Payment gateway is not configured. Please contact support.'));
    return;
  }

  const options = {
    key: RAZORPAY_KEY_ID,
    amount,
    currency,
    name: 'Reasoning Wizard',
    description,
    order_id: orderId,
    prefill: prefill || {},
    theme: { color: '#D4A91A' },
    handler: async (response) => {
      try {
        await onSuccess(response);
      } catch (err) {
        console.error('[Razorpay] Error in onSuccess handler:', err);
        onFailure?.(new Error(friendlyError(err)));
      }
    },
    modal: {
      ondismiss: () => onFailure?.(new Error('Payment cancelled')),
      escape: true,
      confirm_close: true,
    },
  };

  try {
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (resp) => {
      const desc = resp.error?.description || 'Payment failed';
      const reason = resp.error?.reason || '';
      console.error('[Razorpay] Payment failed:', desc, reason);
      onFailure?.(new Error(`${desc}${reason ? ` (${reason})` : ''}`));
    });
    rzp.open();
  } catch (err) {
    console.error('[Razorpay] Failed to open checkout:', err);
    onFailure?.(new Error('Failed to open payment window. Please try again.'));
  }
}
