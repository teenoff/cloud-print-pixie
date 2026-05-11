import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const RZP_KEY = Deno.env.get("RAZORPAY_KEY_ID");
const RZP_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: order, error: oErr } = await admin.from("orders").select("*").eq("id", order_id).maybeSingle();
    if (oErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Confirm caller owns the store
    const { data: store } = await admin.from("stores").select("id, owner_user_id").eq("store_uid", order.store_uid).maybeSingle();
    if (!store || store.owner_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (order.status !== "rejected") {
      return new Response(JSON.stringify({ error: "Order is not rejected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let refundId: string | null = null;
    let refundStatus: "processed" | "failed" | "skipped" = "skipped";

    if (order.razorpay_payment_id && RZP_KEY && RZP_SECRET) {
      const basic = btoa(`${RZP_KEY}:${RZP_SECRET}`);
      const r = await fetch(`https://api.razorpay.com/v1/payments/${order.razorpay_payment_id}/refund`, {
        method: "POST",
        headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: order.amount_paise, speed: "normal" }),
      });
      const body = await r.json();
      if (r.ok) { refundId = body.id; refundStatus = "processed"; }
      else { console.error("Razorpay refund failed:", body); refundStatus = "failed"; }
    }

    await admin.from("orders").update({
      status: "refunded",
      refund_id: refundId,
      refund_status: refundStatus,
    }).eq("id", order.id);

    // Best-effort notify
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/notify-customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE}` },
        body: JSON.stringify({ order_id: order.id, event: "rejected_refunded" }),
      });
    } catch (_) {}

    return new Response(JSON.stringify({ ok: true, refund_id: refundId, refund_status: refundStatus }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("refund-order error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
