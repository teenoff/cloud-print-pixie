import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Upload, Store, QrCode, CheckCircle2, Printer, FileText,
  ArrowRight, ArrowLeft, Loader2, LogOut, Minus, Plus, Settings2, MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Step = "upload" | "options" | "store" | "pay" | "done";
type Binding = "one_pin" | "tape" | "spiral";
type ColorMode = "bw" | "color";

const DEFAULT_BINDING_PRICE: Record<Binding, number> = { one_pin: 2, tape: 15, spiral: 30 };
const DEFAULT_COLOR_PRICE: Record<ColorMode, number> = { bw: 2, color: 10 };
const BINDING_LABEL: Record<Binding, string> = {
  one_pin: "One pin",
  tape: "Tape binding",
  spiral: "Spiral binding",
};
const COLOR_LABEL: Record<ColorMode, string> = { bw: "Black & white", color: "Color" };

type StoreInfo = {
  id: string; store_uid: string; name: string;
  address_line: string | null; road: string | null; area: string | null; city: string | null; pincode: string | null;
  latitude: number | null; longitude: number | null;
  bw_price: number; color_price: number;
  one_pin_price: number; tape_price: number; spiral_price: number;
  qr_image_path: string | null;
};

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [storeUid, setStoreUid] = useState("");
  const [uploading, setUploading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [storeQrUrl, setStoreQrUrl] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Print options
  const [binding, setBinding] = useState<Binding>("one_pin");
  const [colorMode, setColorMode] = useState<ColorMode>("bw");
  const [copies, setCopies] = useState<number>(1);

  const BINDING_PRICE: Record<Binding, number> = storeInfo
    ? { one_pin: storeInfo.one_pin_price, tape: storeInfo.tape_price, spiral: storeInfo.spiral_price }
    : DEFAULT_BINDING_PRICE;
  const COLOR_PRICE: Record<ColorMode, number> = storeInfo
    ? { bw: storeInfo.bw_price, color: storeInfo.color_price }
    : DEFAULT_COLOR_PRICE;

  const totalRupees = useMemo(
    () => (COLOR_PRICE[colorMode] + BINDING_PRICE[binding]) * copies,
    [binding, colorMode, copies, storeInfo],
  );
  const amountPaise = totalRupees * 100;

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setStoreUid("");
    setOrderId(null);
    setFileUrl(null);
    setBinding("one_pin");
    setColorMode("bw");
    setCopies(1);
    setStoreInfo(null);
    setStoreQrUrl(null);
  };

  const lookupStore = async () => {
    const uid = storeUid.trim().toUpperCase();
    if (!uid) return;
    setLookingUp(true);
    try {
      const { data, error } = await supabase.rpc("get_store_by_uid", { _uid: uid });
      if (error) throw error;
      const row = (data as any[])?.[0];
      if (!row) { toast.error("Store not found"); setStoreInfo(null); setStoreQrUrl(null); return; }
      setStoreInfo(row as StoreInfo);
      if (row.qr_image_path) {
        const { data: pub } = supabase.storage.from("store-assets").getPublicUrl(row.qr_image_path);
        setStoreQrUrl(pub.publicUrl);
      }
      toast.success(`Store found: ${row.name}`);
    } catch (e: any) {
      toast.error(e.message ?? "Lookup failed");
    } finally {
      setLookingUp(false);
    }
  };

  const storeMapsUrl = useMemo(() => {
    if (!storeInfo) return null;
    if (storeInfo.latitude && storeInfo.longitude)
      return `https://www.google.com/maps/dir/?api=1&destination=${storeInfo.latitude},${storeInfo.longitude}`;
    const q = [storeInfo.address_line, storeInfo.road, storeInfo.area, storeInfo.city, storeInfo.pincode].filter(Boolean).join(", ");
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  }, [storeInfo]);

  const handleSubmitOrder = async () => {
    if (!file || !user) return;
    const uid = storeUid.trim().toUpperCase();
    if (uid.length < 3) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large (max 20MB)");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("print-files")
        .upload(path, file, { contentType: file.type || "application/pdf" });
      if (upErr) throw upErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from("print-files")
        .createSignedUrl(path, 60 * 60);
      if (signErr) throw signErr;

      const { data: order, error: insErr } = await supabase
        .from("orders")
        .insert({
          store_uid: uid,
          file_url: path,
          file_name: file.name,
          file_size: file.size,
          user_id: user.id,
          binding,
          color_mode: colorMode,
          copies,
          amount_paise: amountPaise,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      setOrderId(order.id);
      setFileUrl(signed.signedUrl);
      setStep("pay");
      toast.success("File uploaded");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "options", label: "Options" },
    { key: "store", label: "Store" },
    { key: "pay", label: "Pay" },
    { key: "done", label: "Print" },
  ];
  const stepIdx = steps.findIndex((s) => s.key === step);

  const setCopiesSafe = (n: number) => {
    if (Number.isNaN(n)) return;
    setCopies(Math.min(120, Math.max(1, Math.floor(n))));
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-xl sticky top-0 z-10 bg-background/60">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center glow">
              <Printer className="size-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight text-lg">PrintBeam</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[160px]">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
              <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-12 max-w-3xl">
        {/* Hero */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/50 bg-card/40 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            MVP Preview
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Print to <span className="text-gradient-primary">any store</span><br />in seconds.
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Upload your PDF, pick options, scan to pay. Your document prints automatically.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-8 px-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`size-9 rounded-full grid place-items-center text-xs font-semibold border transition-all ${
                    i <= stepIdx
                      ? "bg-primary text-primary-foreground border-primary glow"
                      : "bg-card text-muted-foreground border-border"
                  }`}
                >
                  {i < stepIdx ? <CheckCircle2 className="size-4" /> : i + 1}
                </div>
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-px mx-2 mb-5 ${i < stepIdx ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <Card className="p-8 bg-card/60 backdrop-blur-xl border-border/60 shadow-[var(--shadow-card)]">
          {step === "upload" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Upload your document</h2>
                <p className="text-sm text-muted-foreground">PDF files only, up to 20MB.</p>
              </div>
              <label className="block border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all">
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      toast.success("File ready");
                    }
                  }}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="size-10 text-primary" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · click to change</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-14 rounded-2xl bg-secondary grid place-items-center">
                      <Upload className="size-6 text-primary" />
                    </div>
                    <p className="font-medium">Drop your PDF here</p>
                    <p className="text-xs text-muted-foreground">or click to browse</p>
                  </div>
                )}
              </label>
              <Button
                className="w-full h-12"
                disabled={!file}
                onClick={() => setStep("options")}
              >
                Continue <ArrowRight className="size-4" />
              </Button>
            </div>
          )}

          {step === "options" && (
            <div className="space-y-7">
              <div>
                <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                  <Settings2 className="size-5 text-primary" /> Print options
                </h2>
                <p className="text-sm text-muted-foreground">Choose how you want it printed.</p>
              </div>

              {/* Binding */}
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Binding</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(BINDING_PRICE) as Binding[]).map((b) => {
                    const active = binding === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBinding(b)}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          active
                            ? "border-primary bg-primary/10 glow"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="text-sm font-medium">{BINDING_LABEL[b]}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">+ ₹{BINDING_PRICE[b]}/copy</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color */}
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Color</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(COLOR_PRICE) as ColorMode[]).map((c) => {
                    const active = colorMode === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColorMode(c)}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          active
                            ? "border-primary bg-primary/10 glow"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="text-sm font-medium">{COLOR_LABEL[c]}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">₹{COLOR_PRICE[c]}/copy</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Copies */}
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Number of copies</label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-12 w-12"
                    onClick={() => setCopiesSafe(copies - 1)}
                    disabled={copies <= 1}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={120}
                    value={copies}
                    onChange={(e) => setCopiesSafe(parseInt(e.target.value, 10))}
                    className="h-12 text-center font-mono text-lg"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-12 w-12"
                    onClick={() => setCopiesSafe(copies + 1)}
                    disabled={copies >= 120}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Min 1 · Max 120</p>
              </div>

              {/* Total */}
              <div className="rounded-xl border border-border/60 bg-secondary/40 p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Estimated total</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    (₹{COLOR_PRICE[colorMode]} + ₹{BINDING_PRICE[binding]}) × {copies}
                  </div>
                </div>
                <div className="text-2xl font-bold text-gradient-primary">₹{totalRupees}</div>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" className="h-12" onClick={() => setStep("upload")}>
                  <ArrowLeft className="size-4" />
                </Button>
                <Button className="flex-1 h-12" onClick={() => setStep("store")}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {step === "store" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Select a store</h2>
                <p className="text-sm text-muted-foreground">Enter the unique ID shown at the print counter.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Store UID</label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={storeUid}
                    onChange={(e) => setStoreUid(e.target.value.toUpperCase())}
                    placeholder="e.g. PB-1024"
                    className="pl-9 h-12 font-mono tracking-wider"
                    maxLength={20}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" className="h-12" onClick={() => setStep("options")}>
                  <ArrowLeft className="size-4" />
                </Button>
                <Button
                  className="flex-1 h-12"
                  disabled={storeUid.trim().length < 3 || uploading}
                  onClick={handleSubmitOrder}
                >
                  {uploading ? (
                    <><Loader2 className="size-4 animate-spin" /> Uploading…</>
                  ) : (
                    <>Upload & Generate QR <ArrowRight className="size-4" /></>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "pay" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Scan to pay</h2>
                <p className="text-sm text-muted-foreground">
                  Paying store <span className="font-mono text-foreground">{storeUid}</span>
                </p>
              </div>
              <div className="flex justify-center">
                <div className="p-6 bg-foreground rounded-2xl">
                  <div className="size-56 grid place-items-center bg-background rounded-lg relative overflow-hidden">
                    <QrCode className="size-48 text-foreground" strokeWidth={1} />
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="size-12 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center glow">
                        <Printer className="size-6 text-primary-foreground" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-secondary/40 p-4 text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Color</span><span>{COLOR_LABEL[colorMode]}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Binding</span><span>{BINDING_LABEL[binding]}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Copies</span><span>{copies}</span></div>
                <div className="flex justify-between border-t border-border/50 pt-2 mt-2">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">₹{totalRupees}.00</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" className="h-12" onClick={() => setStep("store")}>
                  <ArrowLeft className="size-4" />
                </Button>
                <Button
                  className="flex-1 h-12"
                  disabled={uploading}
                  onClick={async () => {
                    if (!orderId) return;
                    setUploading(true);
                    try {
                      const { data, error } = await supabase
                        .from("orders")
                        .select("status")
                        .eq("id", orderId)
                        .maybeSingle();
                      if (error) throw error;
                      if (data?.status === "paid") {
                        toast.success("Payment confirmed — sending to printer");
                        setStep("done");
                      } else {
                        toast.error("Payment not confirmed yet. Please complete payment.");
                      }
                    } catch (e: any) {
                      toast.error(e.message ?? "Could not verify payment");
                    } finally {
                      setUploading(false);
                    }
                  }}
                >
                  {uploading ? (
                    <><Loader2 className="size-4 animate-spin" /> Checking…</>
                  ) : (
                    <>I've paid <CheckCircle2 className="size-4" /></>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-6 text-center py-6">
              <div className="size-20 mx-auto rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center glow">
                <Printer className="size-10 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Printing now</h2>
                <p className="text-sm text-muted-foreground">
                  Your file was sent to <span className="font-mono text-foreground">{storeUid}</span>.<br />
                  Pick it up at the counter.
                </p>
              </div>
              <div className="rounded-xl bg-secondary/60 p-4 text-left text-sm space-y-2">
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">File</span><span className="font-medium truncate">{file?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Store</span><span className="font-mono">{storeUid}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Color</span><span>{COLOR_LABEL[colorMode]}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Binding</span><span>{BINDING_LABEL[binding]}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Copies</span><span>{copies}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="font-semibold">₹{totalRupees}.00</span></div>
                {orderId && (
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Order</span><span className="font-mono text-xs truncate">{orderId.slice(0, 8)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-primary font-medium">Printing</span></div>
                {fileUrl && (
                  <a href={fileUrl} target="_blank" rel="noreferrer" className="block text-xs text-primary hover:underline pt-2 break-all">
                    View uploaded file ↗
                  </a>
                )}
              </div>
              <Button className="w-full h-12" onClick={reset}>Print another</Button>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Files are stored in Lovable Cloud · Payment & auto-print coming next.
        </p>
      </main>
    </div>
  );
};

export default Index;
