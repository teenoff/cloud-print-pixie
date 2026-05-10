import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Printer, Trash2, Settings } from "lucide-react";

type Kind = "color" | "bw" | "micro";
const LIMITS: Record<Kind, number> = { color: 6, bw: 7, micro: 5 };
const LABEL: Record<Kind, string> = { color: "Colour", bw: "Black & White", micro: "Micro" };

export function PrintersManager({ storeId }: { storeId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("bw");
  const [connection, setConnection] = useState("manual");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("store_printers" as any).select("*").eq("store_id", storeId).order("created_at");
    setItems((data as any[]) ?? []);
  };
  useEffect(() => { load(); }, [storeId]);

  const counts: Record<Kind, number> = {
    color: items.filter((i) => i.kind === "color").length,
    bw: items.filter((i) => i.kind === "bw").length,
    micro: items.filter((i) => i.kind === "micro").length,
  };

  const add = async () => {
    if (!name.trim()) return toast.error("Printer name required");
    if (counts[kind] >= LIMITS[kind]) return toast.error(`Max ${LIMITS[kind]} ${LABEL[kind]} printers`);
    setBusy(true);
    const { error } = await supabase.from("store_printers" as any).insert({ store_id: storeId, kind, name: name.trim(), connection });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName(""); load(); toast.success("Printer added");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("store_printers" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Printer className="size-4 text-primary" /> Printers</h3>
        <div className="flex gap-2 text-[11px]">
          {(Object.keys(LIMITS) as Kind[]).map((k) => (
            <Badge key={k} variant="outline">{LABEL[k]}: {counts[k]}/{LIMITS[k]}</Badge>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 p-4 space-y-3 bg-secondary/30">
        <div className="text-xs font-medium flex items-center gap-1.5"><Settings className="size-3.5" /> Add another printer</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HP LaserJet 1020" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {(Object.keys(LIMITS) as Kind[]).map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Connection</Label>
            <Input value={connection} onChange={(e) => setConnection(e.target.value)} placeholder="usb / network / manual" />
          </div>
        </div>
        <Button onClick={add} disabled={busy} className="w-full gap-1.5"><Plus className="size-4" /> Add printer</Button>
      </div>

      <div className="divide-y divide-border/60">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No printers yet.</p>}
        {items.map((p) => (
          <div key={p.id} className="py-3 flex items-center gap-3">
            <Badge variant="secondary" className="capitalize">{LABEL[p.kind as Kind]}</Badge>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-[11px] text-muted-foreground">{p.connection}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove(p.id)}><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
