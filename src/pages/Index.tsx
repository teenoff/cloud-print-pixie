import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Upload, Store, QrCode, CheckCircle2, Printer, FileText,
  ArrowRight, ArrowLeft, Loader2, LogOut, Minus, Plus, Settings2, MapPin,
  Search, AlertCircle, RotateCw, XCircle, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { countPdfPages } from "@/lib/pdfPages";
import { isValidStoreUid } from "@/lib/storeUid";
import { ModeToggle } from "@/components/ModeToggle";

type Step = "upload" | "store" | "options" | "pay" | "done";
type Binding = "one_pin" | "tape" | "spiral";
type ColorMode = "bw" | "color" | "micro";

const DEFAULT_BINDING_PRICE: Record<Binding, number> = { one_pin: 2, tape: 15, spiral: 30 };
const DEFAULT_COLOR_PRICE: Record<ColorMode, number> = { bw: 2, color: 10, micro: 5 };
const BINDING_LABEL: Record<Binding, string> = { one_pin: "One pin", tape: "Tape", spiral: "Spiral" };
const COLOR_LABEL: Record<ColorMode, string> = { bw: "B&W", color: "Color", micro: "Micro" };

type StoreInfo = {
  id: string; store_uid: string; name: string;
  address_line: string | null; road: string | null; area: string | null; city: string | null; pincode: string | null;
  latitude: number | null; longitude: number | null;
  bw_price: number; color_price: number; micro_price: number;
  one_pin_price: number; tape_price: number; spiral_price: number;
  qr_image_path: string | null;
  is_online: boolean;
};

type Nearby = {
  store_uid: string; name: string; address_line: string | null; city: string | null;
  latitude: number | null; longitude: number | null; distance_km: number | null;
  is_online: boolean; bw_price: number; color_price: number; micro_price: number;
};

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [storeUid, setStoreUid] = useState("");
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [storeQrUrl, setStoreQrUrl] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [uidError, setUidError] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Nearby[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  const [binding, setBinding] = useState<Binding>("one_pin");
  const [colorMode, setColorMode] = useState<ColorMode>("bw");
  const [copies, setCopies] = useState(1);
  const [phone, setPhone] = useState("");

  const [uploading, setUploading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const channelRef = useRef<any>(null);

  const BINDING_PRICE: Record<Binding, number> = storeInfo
    ? { one_pin: storeInfo.one_pin_price, tape: storeInfo.tape_price, spiral: storeInfo.spiral_price }
    : DEFAULT_BINDING_PRICE;
  const COLOR_PRICE: Record<ColorMode, number> = storeInfo
    ? { bw: storeInfo.bw_price, color: storeInfo.color_price, micro: storeInfo.micro_price }
    : DEFAULT_COLOR_PRICE;

  const totalRupees = useMemo(
    () => (COLOR_PRICE[colorMode] * Math.max(1, pageCount) + BINDING_PRICE[binding]) * copies,
    [binding, colorMode, copies, pageCount, storeInfo],
  );
  const amountPaise = totalRupees * 100;

  useEffect(() => { if (!authLoading && !user) navigate("/auth", { replace: true }); }, [authLoading, user, navigate]);

  // Count PDF pages on file selection
  useEffect(() => {
    if (!file) { setPageCount(0); return; }
    countPdfPages(file).then(setPageCount).catch(() => setPageCount(0));
  }, [file]);

  // 1s ticker for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const reset = () => {
    setStep("upload"); setFile(null); setStoreUid(""); setStoreInfo(null); setStoreQrUrl(null);
    setOrderId(null); setOrder(null); setBinding("one_pin"); setColorMode("bw"); setCopies(1);
    setPhone(""); setGateError(null);
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
  };

  const lookupStore = async (rawUid: string, opts: { silent?: boolean } = {}) => {
    const uid = rawUid.trim().toUpperCase();
    if (!uid) return null;
    if (!isValidStoreUid(uid)) {
      setUidError("Format: 2–4 letters then 4–14 digits (e.g. QP91852218)");
      return null;
    }
    setLookingUp(true); setUidError(null);
    try {
      const { data: resp, error } = await supabase.functions.invoke("stores-public", { body: { action: "get", uid } });
      const data = resp?.store ? [resp.store] : [];
      if (error) throw error;
      const row = (data as any[])?.[0];
      if (!row) { setUidError("No store found with this UID"); setStoreInfo(null); setStoreQrUrl(null); return null; }
      setStoreInfo(row as StoreInfo);
      if (row.qr_image_path) {
        const { data: pub } = supabase.storage.from("store-assets").getPublicUrl(row.qr_image_path);
        setStoreQrUrl(pub.publicUrl);
      } else setStoreQrUrl(null);
      if (!opts.silent) {
        if (!row.is_online) toast.error(`${row.name} is currently offline`);
        else toast.success(`Store found: ${row.name}`);
      }
      return row as StoreInfo;
    } catch (e: any) {
      if (!opts.silent) toast.error(e.message ?? "Lookup failed");
      return null;
    } finally { setLookingUp(false); }
  };

  // Auto-validate UID with debounce
  useEffect(() => {
    const v = storeUid.trim().toUpperCase();
    if (!v) { setUidError(null); return; }
    if (!isValidStoreUid(v)) { setUidError("Format: 2–4 letters then 4–14 digits"); return; }
    const t = setTimeout(() => { lookupStore(v, { silent: true }); }, 450);
    return () => clearTimeout(t);
  }, [storeUid]);

  const findNearby = async () => {
    setLoadingNearby(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        if (!navigator.geolocation) return rej(new Error("Geolocation unavailable"));
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 });
      }).catch(() => null);
      const lat = pos?.coords.latitude ?? 0, lng = pos?.coords.longitude ?? 0;
      const { data: resp, error } = await supabase.functions.invoke("stores-public", { body: { action: "nearby", lat, lng, limit: 20 } });
      const data = resp?.stores ?? [];
      if (error) throw error;
      setNearby((data as Nearby[]) ?? []);
    } catch (e: any) { toast.error(e.message ?? "Could not find nearby stores"); }
    finally { setLoadingNearby(false); }
  };

  const selectNearby = async (uid: string, isOnline: boolean) => {
    if (!isOnline) { toast.error("Store is offline"); return; }
    setStoreUid(uid);
    await lookupStore(uid, { silent: true });
  };

  const storeMapsUrl = useMemo(() => {
    if (!storeInfo) return null;
    if (storeInfo.latitude && storeInfo.longitude)
      return `https://www.google.com/maps/dir/?api=1&destination=${storeInfo.latitude},${storeInfo.longitude}`;
    const q = [storeInfo.address_line, storeInfo.city].filter(Boolean).join(", ");
    return q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : null;
  }, [storeInfo]);

  const goToPay = async () => {
    if (!file || !user || !storeInfo) return;
    if (!/^\d{10}$/.test(phone)) { toast.error("Enter a valid 10-digit mobile"); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("File too large (max 20MB)"); return; }
    setGateError(null);
    setUploading(true);
    try {
      // Server-side re-confirm store availability before payment
      const fresh = await lookupStore(storeInfo.store_uid, { silent: true });
      if (!fresh) { setGateError("Could not confirm store. Please retry or pick another store."); return; }
      if (!fresh.is_online) { setGateError(`${fresh.name} is offline. Pick another store and try again.`); return; }

      // Upload file
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("print-files").upload(path, file, { contentType: file.type || "application/pdf" });
      if (upErr) throw upErr;

      const { data: ord, error: insErr } = await supabase.from("orders").insert({
        store_uid: fresh.store_uid,
        file_url: path, file_name: file.name, file_size: file.size,
        user_id: user.id,
        binding, color_mode: colorMode, copies,
        amount_paise: amountPaise,
        customer_phone: phone.replace(/\D/g, "") || null,
      }).select().single();
      if (insErr) throw insErr;

      setOrderId(ord.id); setOrder(ord); setStep("pay");
      toast.success("Order created. Scan to pay within 5 minutes.");
    } catch (e: any) {
      setGateError(e.message ?? "Could not create order");
    } finally { setUploading(false); }
  };

  // Realtime subscribe to order updates while on pay step
  useEffect(() => {
    if (!orderId) return;
    const ch = supabase.channel(`order-pay-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (p) => {
          const nw: any = p.new;
          setOrder(nw);
          if (nw.status === "paid" || nw.status === "printing" || nw.status === "done") {
            toast.success("Payment confirmed");
            navigate(`/orders/${orderId}`);
          } else if (nw.status === "rejected" || nw.status === "refunded") {
            toast.error("Store rejected this order — refund initiated");
          }
        }).subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); channelRef.current = null; };
  }, [orderId, navigate]);

  const expiresAt = order?.qr_expires_at ? new Date(order.qr_expires_at).getTime() : 0;
  const secondsLeft = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const expired = expiresAt > 0 && secondsLeft === 0 && order?.status === "pending";

  const refreshQr = async () => {
    if (!orderId) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("refresh-qr", { body: { order_id: orderId } });
      if (error) throw error;
      setOrder({ ...(order ?? {}), qr_expires_at: data.qr_expires_at });
      toast.success("QR refreshed for 5 more minutes");
    } catch (e: any) { toast.error(e.message ?? "Could not refresh QR"); }
    finally { setRefreshing(false); }
  };

  const signOut = async () => { await supabase.auth.signOut(); navigate("/auth", { replace: true }); };

  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "store", label: "Store" },
    { key: "options", label: "Options" },
    { key: "pay", label: "Pay" },
    { key: "done", label: "Print" },
  ];
  const stepIdx = steps.findIndex((s) => s.key === step);

  const setCopiesSafe = (n: number) => { if (Number.isNaN(n)) return; setCopies(Math.min(120, Math.max(1, Math.floor(n)))); };

  const isRejected = order?.status === "rejected" || order?.status === "refunded";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 backdrop-blur-xl sticky top-0 z-10 bg-background/60">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center glow">
              <Printer className="size-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight text-lg">PrintBeam</span>
          </div>
          <div className="flex items-center gap-3">
            <ModeToggle />
            <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[160px]">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
              <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-12 max-w-3xl">
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Print to <span className="text-gradient-primary">any store</span><br />in seconds.
          </h1>
        </div>

        <div className="flex items-center justify-between mb-8 px-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div className={`size-9 rounded-full grid place-items-center text-xs font-semibold border transition-all ${
                  i <= stepIdx ? "bg-primary text-primary-foreground border-primary glow" : "bg-card text-muted-foreground border-border"}`}>
                  {i < stepIdx ? <CheckCircle2 className="size-4" /> : i + 1}
                </div>
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-px mx-2 mb-5 ${i < stepIdx ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <Card className="p-8 bg-card/60 backdrop-blur-xl border-border/60 shadow-[var(--shadow-card)]">
          {step === "upload" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Upload your document</h2>
                <p className="text-sm text-muted-foreground">PDF files only, up to 20MB.</p>
              </div>
              <label className="block border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all">
                <input type="file" accept="application/pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); toast.success("File ready"); } }} />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="size-10 text-primary" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · {pageCount || "…"} pages · click to change</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-14 rounded-2xl bg-secondary grid place-items-center"><Upload className="size-6 text-primary" /></div>
                    <p className="font-medium">Drop your PDF here</p>
                    <p className="text-xs text-muted-foreground">or click to browse</p>
                  </div>
                )}
              </label>
              <Button className="w-full h-12" disabled={!file} onClick={() => setStep("store")}>
                Continue <ArrowRight className="size-4" />
              </Button>
            </div>
          )}

          {step === "store" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Choose a store</h2>
                <p className="text-sm text-muted-foreground">Pick a nearby store or enter a Store UID.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Store UID</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input value={storeUid}
                      onChange={(e) => { setStoreUid(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setStoreInfo(null); }}
                      placeholder="e.g. QP91852218" className="pl-9 h-12 font-mono tracking-wider" maxLength={18} />
                    {lookingUp && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />}
                    {!lookingUp && storeInfo && storeInfo.store_uid === storeUid.trim().toUpperCase() && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                    )}
                  </div>
                  <Button variant="secondary" className="h-12" onClick={() => lookupStore(storeUid)} disabled={lookingUp}>
                    {lookingUp ? <Loader2 className="size-4 animate-spin" /> : "Find"}
                  </Button>
                </div>
                {uidError ? (
                  <p className="text-[11px] text-destructive flex items-center gap-1"><AlertCircle className="size-3" /> {uidError}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">2–4 letters then 4–14 digits. Auto-validates as you type.</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Nearby stores</label>
                  <Button variant="ghost" size="sm" onClick={findNearby} disabled={loadingNearby} className="gap-1.5">
                    {loadingNearby ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />} Find nearby
                  </Button>
                </div>
                <div className="rounded-xl border border-border/60 divide-y divide-border/60 max-h-72 overflow-auto">
                  {nearby.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Tap "Find nearby" to see stores near you.</p>}
                  {nearby.map((s) => (
                    <button key={s.store_uid} type="button" disabled={!s.is_online}
                      onClick={() => selectNearby(s.store_uid, s.is_online)}
                      className={`w-full text-left p-3 flex items-center gap-3 transition-colors ${
                        storeInfo?.store_uid === s.store_uid ? "bg-primary/10" : "hover:bg-secondary/50"
                      } ${!s.is_online ? "opacity-60 cursor-not-allowed" : ""}`}>
                      <span className={`size-2 rounded-full ${s.is_online ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{s.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {s.store_uid} · {[s.address_line, s.city].filter(Boolean).join(", ")}
                          {s.distance_km != null && ` · ${s.distance_km.toFixed(1)} km`}
                        </div>
                      </div>
                      <Badge variant={s.is_online ? "default" : "outline"}>{s.is_online ? "Active" : "Offline"}</Badge>
                    </button>
                  ))}
                </div>
              </div>

              {storeInfo && (
                <div className={`rounded-xl border p-4 space-y-2 transition-colors ${storeInfo.is_online ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${storeInfo.is_online ? "bg-emerald-500 animate-pulse" : "bg-destructive"}`} />
                    <span className="font-semibold">{storeInfo.name}</span>
                    <Badge variant={storeInfo.is_online ? "default" : "destructive"} className="ml-auto">{storeInfo.is_online ? "Online · Accepting orders" : "Offline · Not accepting orders"}</Badge>
                  </div>
                  {storeMapsUrl && (
                    <a href={storeMapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <MapPin className="size-4" /><span className="truncate">{[storeInfo.address_line, storeInfo.city].filter(Boolean).join(", ") || "Get directions"}</span>
                    </a>
                  )}
                  <div className="text-xs text-muted-foreground">
                    B&W ₹{storeInfo.bw_price}/pg · Color ₹{storeInfo.color_price}/pg · Micro ₹{storeInfo.micro_price}/pg
                  </div>
                  {!storeInfo.is_online && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> This store is offline. You cannot place orders until it comes back online.
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" className="h-12" aria-label="Back to upload" onClick={() => setStep("upload")}><ArrowLeft className="size-4" /></Button>
                <Button className="flex-1 h-12" disabled={!storeInfo || !storeInfo.is_online} onClick={() => setStep("options")}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {step === "options" && (
            <div className="space-y-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                    <Settings2 className="size-5 text-primary" /> Print options
                  </h2>
                  <p className="text-sm text-muted-foreground">Choose how you want it printed.</p>
                </div>
                <Badge variant="outline" className="font-mono text-xs">Uploaded pages {String(pageCount || 0).padStart(3, "0")}</Badge>
              </div>

              <div className="space-y-3">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Binding</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(BINDING_PRICE) as Binding[]).map((b) => (
                    <button key={b} type="button" onClick={() => setBinding(b)}
                      className={`rounded-xl border p-3 text-left transition-all ${binding === b ? "border-primary bg-primary/10 glow" : "border-border bg-card hover:border-primary/40"}`}>
                      <div className="text-sm font-medium">{BINDING_LABEL[b]}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">+ ₹{BINDING_PRICE[b]}/copy</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Color</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(COLOR_PRICE) as ColorMode[]).map((c) => (
                    <button key={c} type="button" onClick={() => setColorMode(c)}
                      className={`rounded-xl border p-3 text-left transition-all ${colorMode === c ? "border-primary bg-primary/10 glow" : "border-border bg-card hover:border-primary/40"}`}>
                      <div className="text-sm font-medium">{COLOR_LABEL[c]}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">₹{COLOR_PRICE[c]}/page</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Number of copies</label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" size="icon" className="h-12 w-12" aria-label="Decrease copies" onClick={() => setCopiesSafe(copies - 1)} disabled={copies <= 1}><Minus className="size-4" /></Button>
                  <Input type="number" inputMode="numeric" min={1} max={120} value={copies}
                    onChange={(e) => setCopiesSafe(parseInt(e.target.value, 10))} className="h-12 text-center font-mono text-lg" />
                  <Button type="button" variant="secondary" size="icon" className="h-12 w-12" aria-label="Increase copies" onClick={() => setCopiesSafe(copies + 1)} disabled={copies >= 120}><Plus className="size-4" /></Button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Mobile number for updates</label>
                <Input type="tel" inputMode="numeric" placeholder="10-digit mobile" maxLength={10}
                  value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className="h-12" />
              </div>

              <div className="rounded-xl border border-border/60 bg-secondary/40 p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Estimated total</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    (₹{COLOR_PRICE[colorMode]} × {Math.max(1, pageCount)}pg + ₹{BINDING_PRICE[binding]}) × {copies}
                  </div>
                </div>
                <div className="text-2xl font-bold text-gradient-primary">₹{totalRupees}</div>
              </div>

              {gateError && (
                <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive">{gateError}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={goToPay} disabled={uploading} className="gap-1.5">
                      <RotateCw className="size-3.5" /> Retry
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setGateError(null); setStep("store"); }}>
                      Pick another store
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" className="h-12" aria-label="Back to store" onClick={() => setStep("store")}><ArrowLeft className="size-4" /></Button>
                <Button className="flex-1 h-12" disabled={uploading} onClick={goToPay}>
                  {uploading ? <><Loader2 className="size-4 animate-spin" /> Preparing…</> : <>Continue to pay <ArrowRight className="size-4" /></>}
                </Button>
              </div>
            </div>
          )}

          {step === "pay" && order && storeInfo && (
            <div className="space-y-6">
              {isRejected ? (
                <div className="space-y-4 text-center py-4">
                  <div className="size-16 mx-auto rounded-full bg-destructive/15 grid place-items-center">
                    <XCircle className="size-8 text-destructive" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Order rejected</h2>
                    <p className="text-sm text-muted-foreground mt-1">{order.rejection_reason || "The store rejected this order."}</p>
                  </div>
                  <div className="rounded-xl bg-secondary/40 p-3 text-sm">
                    Refund status: <span className="font-medium capitalize">{order.refund_status ?? "pending"}</span>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button variant="secondary" onClick={() => navigate(`/orders/${orderId}`)}>View tracking</Button>
                    <Button onClick={reset}>Try another store</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold mb-1">Scan to pay</h2>
                      <p className="text-sm text-muted-foreground">
                        Paying <span className="font-mono text-foreground">{storeInfo.store_uid}</span> · {storeInfo.name}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 border font-mono text-sm ${
                      expired ? "bg-destructive/10 text-destructive border-destructive/40" :
                      secondsLeft < 60 ? "bg-amber-500/10 text-amber-500 border-amber-500/40" :
                      "bg-secondary/60 text-foreground border-border"}`}>
                      <Clock className="size-4" /> {expired ? "Expired" : `${mm}:${ss}`}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    {storeQrUrl ? (
                      <div className={`p-4 bg-foreground rounded-2xl transition-opacity ${expired ? "opacity-30" : ""}`}>
                        <img src={storeQrUrl} alt="Store payment QR" className="size-56 rounded-lg bg-background object-contain" />
                      </div>
                    ) : (
                      <div className="p-6 bg-foreground rounded-2xl">
                        <div className="size-56 grid place-items-center bg-background rounded-lg"><QrCode className="size-48 text-foreground" strokeWidth={1} /></div>
                      </div>
                    )}
                  </div>

                  {expired && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-center gap-3">
                      <AlertCircle className="size-5 text-destructive shrink-0" />
                      <div className="flex-1 text-sm">QR code expired. Refresh to generate a new 5-minute window.</div>
                      <Button size="sm" onClick={refreshQr} disabled={refreshing} className="gap-1.5">
                        {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />} Refresh
                      </Button>
                    </div>
                  )}

                  <div className="rounded-xl bg-secondary/40 p-4 text-sm space-y-1.5">
                    <div className="flex justify-between"><span className="text-muted-foreground">Pages</span><span>{pageCount}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Color</span><span>{COLOR_LABEL[colorMode]}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Binding</span><span>{BINDING_LABEL[binding]}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Copies</span><span>{copies}</span></div>
                    <div className="flex justify-between border-t border-border/50 pt-2 mt-2">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold">₹{totalRupees}.00</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center">
                    We'll detect payment automatically. You'll be redirected to live tracking the moment it's confirmed.
                  </p>

                  <div className="flex gap-3">
                    <Button variant="secondary" className="h-12" aria-label="Back to options" onClick={() => setStep("options")}><ArrowLeft className="size-4" /></Button>
                    <Button variant="outline" className="flex-1 h-12" onClick={() => orderId && navigate(`/orders/${orderId}`)}>
                      Open tracking <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Index;
