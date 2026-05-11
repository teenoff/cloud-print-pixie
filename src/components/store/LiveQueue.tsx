import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2, Copy, XCircle, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", paid: "default", printing: "secondary", done: "secondary",
  failed: "destructive", rejected: "destructive", refunded: "outline",
};

export function LiveQueue({
  storeUid, agentToken, autoAccept, storeId, onAutoAcceptChange,
}: {
  storeUid: string;
  agentToken: string;
  autoAccept: boolean;
  storeId: string;
  onAutoAcceptChange: (v: boolean) => void;
}) {
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

  const toggleAutoAccept = async (v: boolean) => {
    const { error } = await supabase.from("stores").update({ auto_accept: v }).eq("id", storeId);
    if (error) { toast.error(error.message); return; }
    onAutoAcceptChange(v);
    toast.success(v ? "Auto-accept enabled" : "Auto-accept disabled");
  };

  const accept = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.from("orders")
      .update({ status: "printing", accepted_at: new Date().toISOString() }).eq("id", id);
    setBusy(null);
    if (error) toast.error(error.message); else toast.success("Order accepted");
  };

  const reject = async (id: string, reason: string) => {
    setBusy(id);
    const { error } = await supabase.from("orders").update({
      status: "rejected", rejected_at: new Date().toISOString(), rejection_reason: reason || "Rejected by store",
    }).eq("id", id);
    if (error) { setBusy(null); toast.error(error.message); return; }
    // Trigger refund
    const { error: fnErr } = await supabase.functions.invoke("refund-order", { body: { order_id: id } });
    setBusy(null);
    if (fnErr) toast.error(`Order rejected, but refund failed: ${fnErr.message}`);
    else toast.success("Order rejected & refund initiated");
  };

  const markPrinted = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.from("orders")
      .update({ status: "done", printed_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Marked as printed");
      supabase.functions.invoke("notify-customer", { body: { order_id: id, event: "printed" } }).catch(() => {});
    }
    setBusy(null);
  };

  const copyToken = () => { navigator.clipboard.writeText(agentToken); toast.success("Agent token copied"); };

  const incoming = orders.filter((o) => o.status === "paid" && !o.accepted_at);
  const active = orders.filter((o) => ["printing"].includes(o.status));
  const recent = orders.filter((o) => ["done", "failed", "rejected", "refunded"].includes(o.status)).slice(0, 10);

  return (
    <div className="space-y-4">
      <Card className="p-5 flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold flex items-center gap-2"><Inbox className="size-4 text-primary" /> Auto-accept incoming requests</div>
          <p className="text-xs text-muted-foreground mt-1">When ON, paid orders move to "printing" instantly. When OFF, you accept or reject each one.</p>
        </div>
        <Switch checked={autoAccept} onCheckedChange={toggleAutoAccept} />
      </Card>

      <Card className="p-5 bg-secondary/40 border-border/60">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Print Agent Token</div>
            <div className="font-mono text-xs break-all mt-1">{agentToken}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={copyToken} className="gap-1.5 shrink-0">
            <Copy className="size-3.5" /> Copy
          </Button>
        </div>
      </Card>

      {/* Incoming requests (require accept/reject) */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Incoming requests</h3>
          <span className="text-xs text-muted-foreground">{incoming.length} waiting</span>
        </div>
        {incoming.length === 0 && <p className="text-sm text-muted-foreground">No incoming requests.</p>}
        <div className="divide-y divide-border/60">
          {incoming.map((o) => (
            <div key={o.id} className="py-3 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate text-sm">{o.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleTimeString()} · {o.copies}× {o.color_mode} · {o.binding} · ₹{(o.amount_paise/100).toFixed(0)}
                </div>
              </div>
              <Button size="sm" onClick={() => accept(o.id)} disabled={busy === o.id} className="gap-1.5">
                {busy === o.id ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} Accept
              </Button>
              <RejectButton orderId={o.id} disabled={busy === o.id} onReject={(r) => reject(o.id, r)} />
            </div>
          ))}
        </div>
      </Card>

      {/* Currently printing */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Printing now</h3>
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
              <Button size="sm" onClick={() => markPrinted(o.id)} disabled={busy === o.id} className="gap-1.5">
                {busy === o.id ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} Mark printed
              </Button>
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

function RejectButton({ orderId, disabled, onReject }: { orderId: string; disabled: boolean; onReject: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive" disabled={disabled} className="gap-1.5">
          <XCircle className="size-3.5" /> Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reject order & refund customer</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Reason (shown to customer)</Label>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Out of toner, store closing soon, file unreadable, etc." />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { onReject(reason); setOpen(false); setReason(""); }}>
            Reject & refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
