import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Loader2, Printer, FileText, ArrowLeft, XCircle, Wallet, AlertTriangle, RotateCw, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ModeToggle } from "@/components/ModeToggle";
import { toast } from "sonner";

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
  const isFailedFinal = order.status === "failed";
  const currentIdx = STAGES.findIndex((s) => s.key === order.status);
  const idx = isRejected || isFailedFinal ? 1 : (currentIdx === -1 ? (order.status === "printing" ? 2 : 0) : currentIdx);

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

  const attempts: number = order.print_attempts ?? 0;
  const maxAttempts: number = order.print_max_attempts ?? 3;
  const hasFailure = !!order.print_failure_reason && (order.status === "paid" || order.status === "printing" || isFailedFinal);
  const isRetrying = hasFailure && (order.status === "paid" || order.status === "printing") && attempts < maxAttempts;

  const copyRefund = () => {
    if (!order.refund_id) return;
    navigator.clipboard.writeText(order.refund_id);
    toast.success("Refund ID copied");
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 backdrop-blur-xl sticky top-0 z-10 bg-background/60">
        <div className="container max-w-2xl flex items-center justify-between h-14">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <ArrowLeft className="size-4" /> Back
          </Link>
          <ModeToggle />
        </div>
      </header>

      <div className="container max-w-2xl py-10 space-y-6">
        <h1 className="sr-only">Print order tracking</h1>
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
              const reached = !isRejected && !isFailedFinal && i <= idx;
              const active = !isRejected && !isFailedFinal && i === idx && order.status !== "done";
              const t = stageTime(s.key);
              const showRetryHere = s.key === "printing" && hasFailure && !isFailedFinal;
              return (
                <div key={s.key} className="flex items-start gap-3">
                  <div className={`size-9 rounded-full grid place-items-center border transition-all shrink-0 ${
                    reached ? "bg-primary text-primary-foreground border-primary glow" :
                    (isRejected || isFailedFinal) && i <= 1 ? "bg-muted text-muted-foreground border-border" :
                    "bg-card border-border text-muted-foreground"
                  }`}>
                    {showRetryHere
                      ? <RotateCw className="size-4 animate-spin text-amber-500" />
                      : !isRejected && !isFailedFinal && (i < idx || order.status === "done")
                        ? <CheckCircle2 className="size-4" />
                        : active ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
                  </div>
                  <div className="flex-1 pt-1.5">
                    <div className={`text-sm font-medium ${reached ? "" : "text-muted-foreground"}`}>{s.label}</div>
                    {t && reached && <div className="text-[11px] text-muted-foreground">{new Date(t).toLocaleTimeString()} · {sinceLabel(t)}</div>}
                    {active && !showRetryHere && <div className="text-[11px] text-muted-foreground">In progress…</div>}
                    {showRetryHere && (
                      <div className="mt-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-600 dark:text-amber-400 inline-flex items-center gap-1.5">
                        <AlertTriangle className="size-3" />
                        Print attempt {attempts}/{maxAttempts} failed — retrying automatically
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isFailedFinal && (
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-full grid place-items-center border bg-destructive text-destructive-foreground border-destructive shrink-0">
                  <XCircle className="size-4" />
                </div>
                <div className="flex-1 pt-1.5">
                  <div className="text-sm font-medium text-destructive">Printing failed</div>
                  <div className="text-[11px] text-muted-foreground">
                    {attempts}/{maxAttempts} attempts exhausted{order.print_failure_reason ? ` — ${order.print_failure_reason}` : ""}
                  </div>
                </div>
              </div>
            )}

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
                    order.refund_status === "processed" ? "bg-primary text-primary-foreground border-primary glow" :
                    order.refund_status === "failed" ? "bg-destructive text-destructive-foreground border-destructive" :
                    "bg-card border-border text-muted-foreground"}`}>
                    <Wallet className="size-4" />
                  </div>
                  <div className="flex-1 pt-1.5 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">Refund</span>
                      <Badge
                        variant={order.refund_status === "processed" ? "default" : order.refund_status === "failed" ? "destructive" : "outline"}
                        className="capitalize"
                      >
                        {order.refund_status ?? "pending"}
                      </Badge>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-secondary/40 p-3 text-xs space-y-1.5">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-mono font-medium">₹{(order.amount_paise / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Method</span>
                        <span>Razorpay (UPI)</span>
                      </div>
                      {order.razorpay_payment_id && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Payment ID</span>
                          <span className="font-mono truncate max-w-[180px]" title={order.razorpay_payment_id}>{order.razorpay_payment_id}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-3 items-center">
                        <span className="text-muted-foreground">Refund ID</span>
                        {order.refund_id ? (
                          <button onClick={copyRefund} className="font-mono inline-flex items-center gap-1 hover:text-primary transition-colors">
                            <span className="truncate max-w-[160px]" title={order.refund_id}>{order.refund_id}</span>
                            <Copy className="size-3" />
                          </button>
                        ) : <span className="text-muted-foreground italic">awaiting</span>}
                      </div>
                      {order.refund_status === "processed" && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 pt-1">
                          ✓ Refund processed. It typically reflects in 3–5 business days.
                        </p>
                      )}
                      {order.refund_status === "failed" && (
                        <p className="text-[11px] text-destructive pt-1">
                          Refund attempt failed. Our team will retry shortly — you'll be notified.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Badge variant={isRejected || isFailedFinal ? "destructive" : "outline"} className="capitalize">{order.status}</Badge>
            {order.status === "done" && (
              <div className="flex items-center gap-2 text-sm text-primary"><Printer className="size-4" /> Ready to collect</div>
            )}
          </div>

          <Button className="w-full h-11" onClick={() => navigate("/")}>Place another order</Button>
        </Card>
      </div>
    </div>
  );
};

export default OrderTracking;
