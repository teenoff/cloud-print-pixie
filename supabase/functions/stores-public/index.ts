import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PUBLIC_COLS =
  "id, store_uid, name, address_line, road, area, city, pincode, latitude, longitude, bw_price, color_price, micro_price, one_pin_price, tape_price, spiral_price, qr_image_path, is_online, last_seen_at";

function computeOnline(row: any) {
  const lastSeen = row?.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  const fresh = lastSeen && Date.now() - lastSeen < 2 * 60 * 1000;
  return { ...row, is_online: !!row?.is_online && !!fresh };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (action === "get") {
      const uid = String(body?.uid ?? "").trim().toUpperCase();
      if (!uid || !/^[A-Z]{2,4}[0-9]{4,14}$/.test(uid) || uid.length < 6 || uid.length > 18) {
        return new Response(JSON.stringify({ error: "invalid uid" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await admin.from("stores").select(PUBLIC_COLS).eq("store_uid", uid).maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ store: data ? computeOnline(data) : null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "nearby") {
      const lat = Number(body?.lat);
      const lng = Number(body?.lng);
      const limit = Math.min(50, Math.max(1, Number(body?.limit ?? 20)));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return new Response(JSON.stringify({ error: "invalid coords" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await admin
        .from("stores")
        .select("store_uid, name, address_line, city, latitude, longitude, is_online, last_seen_at, bw_price, color_price, micro_price")
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []).map((r: any) => {
        const s = computeOnline(r);
        let distance_km: number | null = null;
        if (r.latitude != null && r.longitude != null) {
          const toRad = (d: number) => (d * Math.PI) / 180;
          const dLat = toRad(Number(r.latitude) - lat);
          const dLng = toRad(Number(r.longitude) - lng);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(Number(r.latitude))) * Math.sin(dLng / 2) ** 2;
          distance_km = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
        }
        const { last_seen_at, ...rest } = s;
        return { ...rest, distance_km };
      }).sort((a: any, b: any) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9)).slice(0, limit);
      return new Response(JSON.stringify({ stores: rows }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error("stores-public error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
