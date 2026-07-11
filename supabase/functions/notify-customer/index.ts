import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");

async function sendSms(to: string, body: string) {
  if (!TWILIO_API_KEY || !TWILIO_FROM) {
    console.log("[notify] Twilio not configured, would send to", to, ":", body);
    return { skipped: true };
  }
  const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Twilio error", res.status, data);
    throw new Error(`Twilio ${res.status}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!bearer) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id, event } = await req.json();
    const allowed = ["paid", "printing", "printed", "rejected_refunded", "print_failed"];
    if (!order_id || !allowed.includes(event)) {
      return new Response(JSON.stringify({ error: "bad input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: order, error } = await admin.from("orders")
      .select("id,customer_phone,store_uid,file_name,amount_paise,user_id")
      .eq("id", order_id).maybeSingle();
    if (error || !order) throw new Error(error?.message ?? "order not found");

    // Authorization: allow service-role callers (webhook / print-agent / refund),
    // or a signed-in user who owns the order or the order's store.
    let authorized = false;
    if (bearer === SERVICE_ROLE) {
      authorized = true;
    } else {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        if (user.id === order.user_id) {
          authorized = true;
        } else {
          const { data: store } = await admin.from("stores")
            .select("owner_user_id")
            .eq("store_uid", order.store_uid)
            .maybeSingle();
          if (store?.owner_user_id === user.id) authorized = true;
        }
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order.customer_phone) {
      return new Response(JSON.stringify({ ok: true, skipped: "no phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const phone = order.customer_phone.startsWith("+") ? order.customer_phone : `+91${order.customer_phone}`;
    const amount = (order.amount_paise / 100).toFixed(0);
    const messages: Record<string, string> = {
      paid: `PrintBeam: Payment of ₹${amount} received for "${order.file_name}" at ${order.store_uid}. We'll notify you when it's printed.`,
      printing: `PrintBeam: Your order "${order.file_name}" at ${order.store_uid} is now being printed.`,
      printed: `PrintBeam: Your print "${order.file_name}" is ready at ${order.store_uid}. Please collect it.`,
      rejected_refunded: `PrintBeam: Your order "${order.file_name}" at ${order.store_uid} was rejected. Refund of ₹${amount} has been initiated.`,
      print_failed: `PrintBeam: Sorry — your print "${order.file_name}" at ${order.store_uid} failed after several attempts. Please contact the store.`,
    };
    const result = await sendSms(phone, messages[event]);
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error("notify error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
