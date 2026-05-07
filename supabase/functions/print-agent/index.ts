import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  // Authenticate token → store
  const { data: store, error: stErr } = await admin
    .from("stores").select("id,store_uid").eq("agent_token", token).maybeSingle();
  if (stErr || !store) {
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (action === "next" && req.method === "GET") {
      // Find oldest paid order
      const { data: jobs } = await admin.from("orders")
        .select("*").eq("store_uid", store.store_uid).eq("status", "paid")
        .order("created_at", { ascending: true }).limit(1);
      const job = jobs?.[0];
      if (!job) {
        return new Response(JSON.stringify({ job: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Atomically claim it
      const { data: claimed, error: clErr } = await admin.from("orders")
        .update({ status: "printing" }).eq("id", job.id).eq("status", "paid")
        .select().maybeSingle();
      if (clErr || !claimed) {
        return new Response(JSON.stringify({ job: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: signed } = await admin.storage.from("print-files")
        .createSignedUrl(claimed.file_url, 60 * 60);
      return new Response(JSON.stringify({
        job: {
          id: claimed.id, file_name: claimed.file_name, file_url: signed?.signedUrl,
          copies: claimed.copies, color_mode: claimed.color_mode, binding: claimed.binding,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "complete" && req.method === "POST") {
      const { order_id } = await req.json();
      if (!order_id) throw new Error("order_id required");
      const { data: updated, error } = await admin.from("orders")
        .update({ status: "done", printed_at: new Date().toISOString() })
        .eq("id", order_id).eq("store_uid", store.store_uid)
        .select().maybeSingle();
      if (error) throw error;
      // Fire notification
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/notify-customer`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE}` },
          body: JSON.stringify({ order_id, event: "printed" }),
        });
      } catch (e) { console.error("notify failed", e); }
      return new Response(JSON.stringify({ ok: true, order: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
