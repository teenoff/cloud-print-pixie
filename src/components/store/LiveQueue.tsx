import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  paid: "default",
  printing: "secondary",
  done: "secondary",
  failed: "destructive",
};

export function LiveQueue({ storeUid, agentToken }: { storeUid: string; agentToken: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("orders").select("*")
        .eq("store_uid", storeUid).order("created_at", { ascending: false }).limit(50);
      setOrders(data ?? []);
    };
    load();
    const ch = supabase.channel(`queue-${storeUid}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_uid=eq.${storeUid}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [storeUid]);

  const markPrinted = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.from("orders")
      .update({ status: "done", printed_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Marked as printed");
      // Fire notification (best effort)
      supabase.functions.invoke("notify-customer", { body: { order_id: id, event: "printed" } })
        .catch(() => {});
    }
    setBusy(null);
  };

  const copyToken = () => { navigator.clipboard.writeText(agentToken); toast.success("Agent token copied"); };

  const active = orders.filter((o) => ["pending", "paid", "printing"].includes(o.status));
  const recent = orders.filter((o) => ["done", "failed"].includes(o.status)).slice(0, 10);

  return (
    <div className="space-y-4">
      <Card className="p-5 bg-secondary/40 border-border/60">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Print Agent Token</div>
            <div className="font-mono text-xs break-all mt-1">{agentToken}</div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Use this in your print agent's <code>x-agent-token</code> header to fetch jobs.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={copyToken} className="gap-1.5 shrink-0">
            <Copy className="size-3.5" /> Copy
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Live queue</h3>
          <span className="text-xs text-muted-foreground">{active.length} active</span>
        </div>
        {active.length === 0 && <p className="text-sm text-muted-foreground">No active jobs.</p>}
        <div className="divide-y divide-border/60">
          {active.map((o) => (
            <div key={o.id} className="py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate text-sm">{o.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleTimeString()} · {o.copies}× {o.color_mode} · {o.binding} · ₹{(o.amount_paise/100).toFixed(0)}
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[o.status] ?? "outline"} className="capitalize">{o.status}</Badge>
              {(o.status === "paid" || o.status === "printing") && (
                <Button size="sm" onClick={() => markPrinted(o.id)} disabled={busy === o.id} className="gap-1.5">
                  {busy === o.id ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                  Mark printed
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {recent.length > 0 && (
        <Card className="p-6 space-y-3">
          <h3 className="font-semibold">Recent</h3>
          <div className="divide-y divide-border/60">
            {recent.map((o) => (
              <div key={o.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1 truncate">{o.file_name}</div>
                <Badge variant={STATUS_VARIANT[o.status] ?? "outline"} className="capitalize">{o.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
