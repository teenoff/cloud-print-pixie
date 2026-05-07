import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Loader2, Printer, FileText, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STAGES = [
  { key: "pending", label: "Uploaded" },
  { key: "paid", label: "Paid" },
  { key: "printing", label: "Printing" },
  { key: "done", label: "Done" },
] as const;

const OrderTracking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [order, setOrder] = useState<any>(null);

  useEffect(() => { if (!loading && !user) navigate("/auth", { replace: true }); }, [loading, user, navigate]);

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

  const currentIdx = STAGES.findIndex((s) => s.key === order.status);
  const idx = currentIdx === -1 ? 0 : currentIdx;

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
              {order.copies}× · {order.color_mode === "bw" ? "B&W" : "Color"} · {order.binding}
            </div>
          </div>
          <div className="font-mono font-semibold">₹{(order.amount_paise / 100).toFixed(0)}</div>
        </div>

        {/* Stepper */}
        <div className="space-y-3">
          {STAGES.map((s, i) => {
            const reached = i <= idx;
            const active = i === idx && order.status !== "done";
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div className={`size-9 rounded-full grid place-items-center border transition-all ${
                  reached ? "bg-primary text-primary-foreground border-primary glow" : "bg-card border-border text-muted-foreground"
                }`}>
                  {i < idx || order.status === "done" ? <CheckCircle2 className="size-4" /> :
                    active ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${reached ? "" : "text-muted-foreground"}`}>{s.label}</div>
                  {active && <div className="text-xs text-muted-foreground">In progress…</div>}
                </div>
              </div>
            );
          })}
        </div>

        {order.status === "done" && (
          <div className="rounded-xl bg-primary/10 border border-primary/30 p-4 flex items-center gap-3">
            <Printer className="size-5 text-primary" />
            <div className="text-sm">Your print is ready. Please collect it from <span className="font-mono">{order.store_uid}</span>.</div>
          </div>
        )}

        <Button className="w-full h-11" onClick={() => navigate("/")}>Place another order</Button>
      </Card>
    </div>
  );
};

export default OrderTracking;
