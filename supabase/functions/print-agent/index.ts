import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function notify(order_id: string, event: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/notify-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({ order_id, event }),
    });
  } catch (e) { console.error("notify failed", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const token = req.headers.get("x-agent-token");

  if (!token) {
    return new Response(JSON.stringify({ error: "missing x-agent-token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: store, error: stErr } = await admin
    .from("stores").select("id,store_uid").eq("agent_token", token).maybeSingle();
  if (stErr || !store) {
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (action === "next" && req.method === "GET") {
      const { data: jobs } = await admin.from("orders")
        .select("*").eq("store_uid", store.store_uid).eq("status", "paid")
        .order("created_at", { ascending: true }).limit(1);
      const job = jobs?.[0];
      if (!job) {
        return new Response(JSON.stringify({ job: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: claimed, error: clErr } = await admin.from("orders")
        .update({ status: "printing" }).eq("id", job.id).eq("status", "paid")
        .select().maybeSingle();
      if (clErr || !claimed) {
        return new Response(JSON.stringify({ job: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Notify customer printing started (only on first attempt to avoid spam)
      if ((claimed.print_attempts ?? 0) === 0) {
        notify(claimed.id, "printing");
      }
      const { data: signed } = await admin.storage.from("print-files")
        .createSignedUrl(claimed.file_url, 60 * 60);
      return new Response(JSON.stringify({
        job: {
          id: claimed.id, file_name: claimed.file_name, file_url: signed?.signedUrl,
          copies: claimed.copies, color_mode: claimed.color_mode, binding: claimed.binding,
          attempt: (claimed.print_attempts ?? 0) + 1,
          max_attempts: claimed.print_max_attempts ?? 3,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "complete" && req.method === "POST") {
      const { order_id } = await req.json();
      if (!order_id) throw new Error("order_id required");
      const { data: updated, error } = await admin.from("orders")
        .update({
          status: "done",
          printed_at: new Date().toISOString(),
          print_failure_reason: null,
        })
        .eq("id", order_id).eq("store_uid", store.store_uid)
        .select().maybeSingle();
      if (error) throw error;
      notify(order_id, "printed");
      return new Response(JSON.stringify({ ok: true, order: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "fail" && req.method === "POST") {
      const { order_id, reason } = await req.json();
      if (!order_id) throw new Error("order_id required");

      const { data: cur } = await admin.from("orders")
        .select("print_attempts, print_max_attempts, status")
        .eq("id", order_id).eq("store_uid", store.store_uid).maybeSingle();
      if (!cur) throw new Error("order not found");

      const attempts = (cur.print_attempts ?? 0) + 1;
      const max = cur.print_max_attempts ?? 3;
      const shouldRetry = attempts < max;
      const nowIso = new Date().toISOString();

      const { data: updated, error } = await admin.from("orders").update({
        print_attempts: attempts,
        print_failure_reason: reason ?? "Print failure",
        print_failed_at: nowIso,
        // Re-queue (status=paid) so `action=next` picks it up again, else mark failed
        status: shouldRetry ? "paid" : "failed",
        ...(shouldRetry ? { accepted_at: null } : {}),
      }).eq("id", order_id).select().maybeSingle();
      if (error) throw error;

      if (!shouldRetry) notify(order_id, "print_failed");

      return new Response(JSON.stringify({
        ok: true,
        retrying: shouldRetry,
        attempts,
        max_attempts: max,
        order: updated,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
