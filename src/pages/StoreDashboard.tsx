import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Settings, Wallet, History, MessageCircle, Printer, MapPin, Copy, LogOut, Store as StoreIcon, Loader2, ListOrdered,
} from "lucide-react";
import { LiveQueue } from "@/components/store/LiveQueue";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
      if (data.qr_image_path) {
        const { data: pub } = supabase.storage.from("store-assets").getPublicUrl(data.qr_image_path);
        setQrUrl(pub.publicUrl);
      }
      const { data: ord } = await supabase.from("orders").select("*")
        .eq("store_uid", data.store_uid).order("created_at", { ascending: false });
      setOrders(ord ?? []);
    })();
  }, [user, navigate]);

  const signOut = async () => { await supabase.auth.signOut(); navigate("/auth", { replace: true }); };
  const copyUid = () => { if (store) { navigator.clipboard.writeText(store.store_uid); toast.success("UID copied"); } };

  if (!store) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

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
                        <n.icon className="size-4" />
                        <span>{n.label}</span>
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
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5"><LogOut className="size-4" /> Sign out</Button>
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
            {section === "payments" && <OrdersList orders={orders.filter((o) => o.status === "paid" || o.razorpay_payment_id)} title="Payments" />}
            {section === "printing" && <OrdersList orders={orders} title="Print jobs" />}
            {section === "whatsapp" && <WhatsAppSection store={store} onSaved={setStore} />}
            {section === "printer" && <PrinterSection store={store} qrUrl={qrUrl} />}
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
    setSaving(true);
    const { data, error } = await supabase.from("stores").update({
      name: s.name, phone: s.phone,
      address_line: s.address_line, road: s.road, area: s.area, city: s.city, pincode: s.pincode,
      bw_price: s.bw_price, color_price: s.color_price,
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
        <Field label="Address" value={s.address_line ?? ""} onChange={(v) => setS({ ...s, address_line: v })} className="col-span-2" />
        <Field label="Road" value={s.road ?? ""} onChange={(v) => setS({ ...s, road: v })} />
        <Field label="Area" value={s.area ?? ""} onChange={(v) => setS({ ...s, area: v })} />
        <Field label="City" value={s.city ?? ""} onChange={(v) => setS({ ...s, city: v })} />
        <Field label="Pincode" value={s.pincode ?? ""} onChange={(v) => setS({ ...s, pincode: v })} />
        <NumField label="B&W ₹" value={s.bw_price} onChange={(v) => setS({ ...s, bw_price: v })} />
        <NumField label="Color ₹" value={s.color_price} onChange={(v) => setS({ ...s, color_price: v })} />
        <NumField label="One pin ₹" value={s.one_pin_price} onChange={(v) => setS({ ...s, one_pin_price: v })} />
        <NumField label="Tape ₹" value={s.tape_price} onChange={(v) => setS({ ...s, tape_price: v })} />
        <NumField label="Spiral ₹" value={s.spiral_price} onChange={(v) => setS({ ...s, spiral_price: v })} />
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
      <p className="text-sm text-muted-foreground">Customers can message your store directly.</p>
      <div className="flex gap-2">
        <Input value={num} onChange={(e) => setNum(e.target.value)} placeholder="WhatsApp number with country code, e.g. 919876543210" />
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

function PrinterSection({ store, qrUrl }: { store: any; qrUrl: string | null }) {
  const mapsUrl = useMemo(() => {
    if (store.latitude && store.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`;
    }
    const q = [store.address_line, store.road, store.area, store.city, store.pincode].filter(Boolean).join(", ");
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  }, [store]);
  return (
    <Card className="p-6 space-y-5">
      <h3 className="font-semibold flex items-center gap-2"><Printer className="size-4 text-primary" /> Printer</h3>
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
      {qrUrl && (
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Payment QR</div>
          <img src={qrUrl} alt="Payment QR" className="size-48 rounded-lg border border-border" />
        </div>
      )}
    </Card>
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
