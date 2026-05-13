import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Download, QrCode, Settings } from "lucide-react";

export function PaymentSettings({
  store, qrUrl, orders, onQrChanged,
}: { store: any; qrUrl: string | null; orders: any[]; onQrChanged: (path: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const changeQr = async (file: File) => {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${store.owner_user_id}/qr-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("store-assets").upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { error } = await supabase.from("stores").update({ qr_image_path: path }).eq("id", store.id);
      if (error) throw error;
      onQrChanged(path);
      toast.success("QR updated");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const downloadStatement = () => {
    const rows = [["Date", "Order", "File", "Copies", "Color", "Binding", "Status", "Amount (₹)"]];
    orders.forEach((o) => rows.push([
      new Date(o.created_at).toISOString(), o.id.slice(0, 8), o.file_name, o.copies,
      o.color_mode, o.binding, o.status, (o.amount_paise / 100).toFixed(2),
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `statement-${store.store_uid}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const paid = orders.filter((o) => o.status === "paid" || o.status === "done" || o.razorpay_payment_id);

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><QrCode className="size-4 text-primary" /> Payment QR</h3>
        {qrUrl ? <img src={qrUrl} alt="Store payment QR code" className="size-48 rounded-lg border border-border" /> : <p className="text-sm text-muted-foreground">No QR uploaded.</p>}
        <input ref={fileRef} type="file" accept="image/*" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) changeQr(f); }} />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy} className="gap-1.5">
            <Settings className="size-4" /> Change QR
          </Button>
          <Button variant="secondary" onClick={downloadStatement} className="gap-1.5">
            <Download className="size-4" /> Download statement
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <h3 className="font-semibold">Payment history</h3>
        {paid.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
        <div className="divide-y divide-border/60">
          {paid.map((o) => (
            <div key={o.id} className="py-3 flex items-center justify-between text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{o.file_name}</div>
                <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()} · {o.copies}× {o.color_mode}</div>
              </div>
              <div className="text-right">
                <div className="font-mono">₹{(o.amount_paise / 100).toFixed(0)}</div>
                <div className="text-[11px] text-muted-foreground capitalize">{o.status}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
