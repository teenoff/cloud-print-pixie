import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Loader2, Printer, FileText, ArrowLeft, XCircle, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STAGES = [
  { key: "pending", label: "Order placed" },
  { key: "paid", label: "Payment confirmed" },
  { key: "printing", label: "Printing" },
  { key: "done", label: "Ready to collect" },
] as const;

const OrderTracking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { if (!loading && !user) navigate("/auth", { replace: true }); }, [loading, user, navigate]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
      setOrder(data);
    };
    load();
    const ch = supabase.channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => setOrder(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  if (!order) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  const isRejected = order.status === "rejected" || order.status === "refunded";
  const currentIdx = STAGES.findIndex((s) => s.key === order.status);
  // For "printing" map to index 2; "done" -> 3; otherwise use found index
  const idx = isRejected ? 1 : (currentIdx === -1 ? (order.status === "printing" ? 2 : 0) : currentIdx);

  const stageTime = (key: string) => {
    if (key === "pending") return order.created_at;
    if (key === "paid") return order.accepted_at ?? null;
    if (key === "printing") return order.accepted_at;
    if (key === "done") return order.printed_at;
    return null;
  };

  const sinceLabel = (iso: string | null) => {
    if (!iso) return "";
    const diff = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    return `${Math.floor(diff/3600)}h ago`;
  };

  return (
    <div className="min-h-screen container max-w-2xl py-10 space-y-6">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Order</div>
            <div className="font-mono text-sm truncate">{order.id}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Store</div>
            <div className="font-mono">{order.store_uid}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/40 p-4 flex items-center gap-3">
          <FileText className="size-5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{order.file_name}</div>
            <div className="text-xs text-muted-foreground">
              {order.copies}× · {order.color_mode} · {order.binding}
            </div>
          </div>
          <div className="font-mono font-semibold">₹{(order.amount_paise / 100).toFixed(0)}</div>
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          {STAGES.map((s, i) => {
            const reached = !isRejected && i <= idx;
            const active = !isRejected && i === idx && order.status !== "done";
            const t = stageTime(s.key);
            return (
              <div key={s.key} className="flex items-start gap-3">
                <div className={`size-9 rounded-full grid place-items-center border transition-all shrink-0 ${
                  reached ? "bg-primary text-primary-foreground border-primary glow" :
                  isRejected && i <= 1 ? "bg-muted text-muted-foreground border-border" :
                  "bg-card border-border text-muted-foreground"
                }`}>
                  {!isRejected && (i < idx || order.status === "done")
                    ? <CheckCircle2 className="size-4" />
                    : active ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
                </div>
                <div className="flex-1 pt-1.5">
                  <div className={`text-sm font-medium ${reached ? "" : "text-muted-foreground"}`}>{s.label}</div>
                  {t && reached && <div className="text-[11px] text-muted-foreground">{new Date(t).toLocaleTimeString()} · {sinceLabel(t)}</div>}
                  {active && <div className="text-[11px] text-muted-foreground">In progress…</div>}
                </div>
              </div>
            );
          })}

          {isRejected && (
            <>
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-full grid place-items-center border bg-destructive text-destructive-foreground border-destructive shrink-0">
                  <XCircle className="size-4" />
                </div>
                <div className="flex-1 pt-1.5">
                  <div className="text-sm font-medium text-destructive">Rejected by store</div>
                  {order.rejection_reason && <div className="text-[11px] text-muted-foreground">"{order.rejection_reason}"</div>}
                  {order.rejected_at && <div className="text-[11px] text-muted-foreground">{sinceLabel(order.rejected_at)}</div>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`size-9 rounded-full grid place-items-center border shrink-0 ${
                  order.refund_status === "processed" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}>
                  <Wallet className="size-4" />
                </div>
                <div className="flex-1 pt-1.5">
                  <div className="text-sm font-medium">Refund {order.refund_status ?? "pending"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    ₹{(order.amount_paise / 100).toFixed(0)} {order.refund_id ? `· ref ${order.refund_id}` : ""}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Badge variant={isRejected ? "destructive" : "outline"} className="capitalize">{order.status}</Badge>
          {order.status === "done" && (
            <div className="flex items-center gap-2 text-sm text-primary"><Printer className="size-4" /> Ready to collect</div>
          )}
        </div>

        <Button className="w-full h-11" onClick={() => navigate("/")}>Place another order</Button>
      </Card>
    </div>
  );
};

export default OrderTracking;
