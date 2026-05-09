import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Settings, Wallet, History, MessageCircle, Printer, MapPin, Copy, LogOut, Store as StoreIcon, Loader2, ListOrdered,
} from "lucide-react";
import { LiveQueue } from "@/components/store/LiveQueue";
import { PrintersManager } from "@/components/store/PrintersManager";
import { PaymentSettings } from "@/components/store/PaymentSettings";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isValidStoreUid } from "@/lib/storeUid";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";

type Section = "queue" | "profile" | "payments" | "printing" | "whatsapp" | "printer";

const NAV: { key: Section; label: string; icon: any }[] = [
  { key: "queue", label: "Live queue", icon: ListOrdered },
  { key: "profile", label: "Profile settings", icon: Settings },
  { key: "payments", label: "Payment history", icon: Wallet },
  { key: "printing", label: "Printing history", icon: History },
  { key: "whatsapp", label: "Connect WhatsApp", icon: MessageCircle },
  { key: "printer", label: "Printer", icon: Printer },
];

const StoreDashboard = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [section, setSection] = useState<Section>("queue");
  const [store, setStore] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("stores").select("*").eq("owner_user_id", user.id).maybeSingle();
      if (!data) { navigate("/store/onboarding", { replace: true }); return; }
      setStore(data);
      refreshQr(data.qr_image_path);
      const { data: ord } = await supabase.from("orders").select("*")
        .eq("store_uid", data.store_uid).order("created_at", { ascending: false });
      setOrders(ord ?? []);
    })();
  }, [user, navigate]);

  const refreshQr = (path: string | null) => {
    if (!path) { setQrUrl(null); return; }
    const { data: pub } = supabase.storage.from("store-assets").getPublicUrl(path);
    setQrUrl(pub.publicUrl + `?t=${Date.now()}`);
  };

  // Heartbeat — keep last_seen_at fresh while dashboard is open & online
  useEffect(() => {
    if (!store?.id || !store.is_online) return;
    const ping = async () => {
      await supabase.from("stores").update({ last_seen_at: new Date().toISOString() }).eq("id", store.id);
    };
    ping();
    const t = setInterval(ping, 60_000);
    return () => clearInterval(t);
  }, [store?.id, store?.is_online]);

  const toggleOnline = async (next: boolean) => {
    const { data, error } = await supabase.from("stores")
      .update({ is_online: next, last_seen_at: next ? new Date().toISOString() : null })
      .eq("id", store.id).select().single();
    if (error) return toast.error(error.message);
    setStore(data); toast.success(next ? "Store is now online" : "Store is offline");
  };

  const signOut = async () => { await supabase.auth.signOut(); navigate("/auth", { replace: true }); };
  const copyUid = () => { if (store) { navigator.clipboard.writeText(store.store_uid); toast.success("UID copied"); } };

  if (!store) return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Store</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV.map((n) => (
                    <SidebarMenuItem key={n.key}>
                      <SidebarMenuButton onClick={() => setSection(n.key)} isActive={section === n.key}>
                        <n.icon className="size-4" /><span>{n.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border/60 flex items-center justify-between px-4 backdrop-blur-xl bg-background/60 sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <StoreIcon className="size-5 text-primary" />
              <span className="font-semibold tracking-tight">{store.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 bg-secondary/40">
                <span className={`size-2 rounded-full ${store.is_online ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
                <span className="text-xs">{store.is_online ? "Online" : "Offline"}</span>
                <Switch checked={!!store.is_online} onCheckedChange={toggleOnline} />
              </div>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5"><LogOut className="size-4" /> Sign out</Button>
            </div>
          </header>

          <main className="container max-w-3xl py-8 space-y-6">
            <Card className="p-5 bg-gradient-to-br from-primary/15 to-accent/10 border-primary/30 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Store UID</div>
                <div className="font-mono text-2xl font-bold mt-1">{store.store_uid}</div>
                <p className="text-xs text-muted-foreground mt-1">Share this code with customers.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={copyUid} className="gap-1.5"><Copy className="size-4" /> Copy</Button>
            </Card>

            {section === "queue" && <LiveQueue storeUid={store.store_uid} agentToken={store.agent_token} />}
            {section === "profile" && <ProfileSection store={store} onSaved={setStore} />}
            {section === "payments" && <PaymentSettings store={store} qrUrl={qrUrl} orders={orders} onQrChanged={(p) => { setStore({ ...store, qr_image_path: p }); refreshQr(p); }} />}
            {section === "printing" && <OrdersList orders={orders} title="Print jobs" />}
            {section === "whatsapp" && <WhatsAppSection store={store} onSaved={setStore} />}
            {section === "printer" && <PrinterSection store={store} />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

function ProfileSection({ store, onSaved }: { store: any; onSaved: (s: any) => void }) {
  const [s, setS] = useState(store);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!isValidStoreUid(s.store_uid)) return toast.error("UID must be 2-4 letters then 4-14 digits");
    setSaving(true);
    const { data, error } = await supabase.from("stores").update({
      store_uid: s.store_uid,
      name: s.name, phone: s.phone,
      address_line: s.address_line, road: s.road, area: s.area, city: s.city, pincode: s.pincode,
      bw_price: s.bw_price, color_price: s.color_price, micro_price: s.micro_price,
      one_pin_price: s.one_pin_price, tape_price: s.tape_price, spiral_price: s.spiral_price,
    }).eq("id", store.id).select().single();
    setSaving(false);
    if (error) toast.error(error.message); else { onSaved(data); toast.success("Saved"); }
  };
  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-semibold">Profile settings</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Store name" value={s.name} onChange={(v) => setS({ ...s, name: v })} />
        <Field label="Phone" value={s.phone} onChange={(v) => setS({ ...s, phone: v })} />
        <Field label="Store UID" value={s.store_uid} onChange={(v) => setS({ ...s, store_uid: v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 18) })} className="col-span-2" />
        <Field label="Address" value={s.address_line ?? ""} onChange={(v) => setS({ ...s, address_line: v })} className="col-span-2" />
        <Field label="Road" value={s.road ?? ""} onChange={(v) => setS({ ...s, road: v })} />
        <Field label="Area" value={s.area ?? ""} onChange={(v) => setS({ ...s, area: v })} />
        <Field label="City" value={s.city ?? ""} onChange={(v) => setS({ ...s, city: v })} />
        <Field label="Pincode" value={s.pincode ?? ""} onChange={(v) => setS({ ...s, pincode: v })} />
        <NumField label="B&W ₹/page" value={s.bw_price} onChange={(v) => setS({ ...s, bw_price: v })} />
        <NumField label="Color ₹/page" value={s.color_price} onChange={(v) => setS({ ...s, color_price: v })} />
        <NumField label="Micro ₹/page" value={s.micro_price ?? 5} onChange={(v) => setS({ ...s, micro_price: v })} />
        <NumField label="One pin ₹/copy" value={s.one_pin_price} onChange={(v) => setS({ ...s, one_pin_price: v })} />
        <NumField label="Tape ₹/copy" value={s.tape_price} onChange={(v) => setS({ ...s, tape_price: v })} />
        <NumField label="Spiral ₹/copy" value={s.spiral_price} onChange={(v) => setS({ ...s, spiral_price: v })} />
      </div>
      <Button onClick={save} disabled={saving} className="w-full h-11">
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
      </Button>
    </Card>
  );
}

function WhatsAppSection({ store, onSaved }: { store: any; onSaved: (s: any) => void }) {
  const [num, setNum] = useState(store.whatsapp_number ?? "");
  const save = async () => {
    const { data, error } = await supabase.from("stores").update({ whatsapp_number: num }).eq("id", store.id).select().single();
    if (error) toast.error(error.message); else { onSaved(data); toast.success("WhatsApp saved"); }
  };
  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-semibold flex items-center gap-2"><MessageCircle className="size-4 text-primary" /> Connect WhatsApp</h3>
      <div className="flex gap-2">
        <Input value={num} onChange={(e) => setNum(e.target.value)} placeholder="WhatsApp number with country code" />
        <Button onClick={save}>Save</Button>
      </div>
      {num && (
        <a className="inline-flex" href={`https://wa.me/${num.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
          <Button variant="secondary">Open chat</Button>
        </a>
      )}
    </Card>
  );
}

function PrinterSection({ store }: { store: any }) {
  const mapsUrl = useMemo(() => {
    if (store.latitude && store.longitude)
      return `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`;
    const q = [store.address_line, store.road, store.area, store.city, store.pincode].filter(Boolean).join(", ");
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  }, [store]);
  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Printer className="size-4 text-primary" /> Primary printer</h3>
        <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Connected printer</div>
          <div className="text-sm font-medium mt-1">{store.printer_name ?? "Not set"}</div>
        </div>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="block">
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 flex items-center gap-3 hover:bg-primary/15 transition-colors">
            <MapPin className="size-5 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Store location</div>
              <div className="text-sm font-medium truncate">
                {[store.address_line, store.road, store.city].filter(Boolean).join(", ") || "Tap for directions"}
              </div>
            </div>
            <span className="text-xs text-primary font-medium">Directions</span>
          </div>
        </a>
      </Card>
      <PrintersManager storeId={store.id} />
    </div>
  );
}

function OrdersList({ orders, title }: { orders: any[]; title: string }) {
  return (
    <Card className="p-6 space-y-3">
      <h3 className="font-semibold">{title}</h3>
      {orders.length === 0 && <p className="text-sm text-muted-foreground">No records yet.</p>}
      <div className="divide-y divide-border/60">
        {orders.map((o) => (
          <div key={o.id} className="py-3 flex items-center justify-between text-sm">
            <div className="min-w-0">
              <div className="font-medium truncate">{o.file_name}</div>
              <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()} · {o.copies}× {o.color_mode} · {o.binding}</div>
            </div>
            <div className="text-right">
              <div className="font-mono">₹{(o.amount_paise / 100).toFixed(0)}</div>
              <div className="text-[11px] text-muted-foreground capitalize">{o.status}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Field({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(Math.max(0, parseInt(e.target.value || "0", 10)))} className="font-mono" />
    </div>
  );
}

export default StoreDashboard;
