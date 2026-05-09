import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Loader2, MapPin, Printer, QrCode, Store as StoreIcon, Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateStoreUid, isValidStoreUid } from "@/lib/storeUid";

type WizardStep = 1 | 2 | 3;

const StoreOnboarding = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [step, setStep] = useState<WizardStep>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [road, setRoad] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  // Custom UID
  const [customUid, setCustomUid] = useState("");

  // Step 2 — pricing
  const [bwPrice, setBwPrice] = useState(2);
  const [colorPrice, setColorPrice] = useState(10);
  const [microPrice, setMicroPrice] = useState(5);
  const [onePin, setOnePin] = useState(2);
  const [tape, setTape] = useState(15);
  const [spiral, setSpiral] = useState(30);

  // Step 3 — printer (QR moved to dashboard payment section)
  const [printerName, setPrinterName] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  // Redirect if store already exists
  useEffect(() => {
    if (!user) return;
    supabase.from("stores").select("id").eq("owner_user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) navigate("/store/dashboard", { replace: true }); });
  }, [user, navigate]);

  const captureLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude); setLng(pos.coords.longitude);
        setLocating(false);
        toast.success("Location captured");
      },
      (err) => { setLocating(false); toast.error(err.message); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const scanPrinters = async () => {
    setScanning(true);
    try {
      // Best-effort: WebUSB enumeration. Not all printers expose USB descriptors,
      // so we fall back to manual entry.
      // @ts-ignore
      if (navigator.usb?.requestDevice) {
        // @ts-ignore
        const device = await navigator.usb.requestDevice({ filters: [{ classCode: 7 }] });
        if (device) {
          setPrinterName(device.productName || `USB Printer ${device.vendorId}`);
          toast.success("Printer connected");
        }
      } else {
        toast.message("Auto-scan unavailable — enter printer name manually.");
      }
    } catch (e: any) {
      toast.message("No printer selected — you can enter it manually.");
    } finally {
      setScanning(false);
    }
  };

  const validateStep1 = () => {
    if (!name.trim()) return "Store name required";
    if (!/^\d{10}$/.test(phone.replace(/\D/g, ""))) return "Enter a valid 10-digit phone";
    if (!addressLine.trim() || !city.trim()) return "Address and city required";
    return null;
  };

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      let uid = (customUid || generateStoreUid(name, phone)).toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!isValidStoreUid(uid)) { toast.error("UID must be 2-4 letters then 4-14 digits"); setSubmitting(false); return; }
      // Collision retry only when auto-generated
      if (!customUid) {
        for (let i = 0; i < 5; i++) {
          const { data: exists } = await supabase.from("stores").select("id").eq("store_uid", uid).maybeSingle();
          if (!exists) break;
          uid = generateStoreUid(name, phone, String(i + 1));
        }
      }

      const { error: insErr } = await supabase.from("stores").insert({
        owner_user_id: user.id,
        store_uid: uid,
        name: name.trim(),
        phone: phone.replace(/\D/g, ""),
        address_line: addressLine, road, area, city, pincode,
        latitude: lat, longitude: lng,
        bw_price: bwPrice, color_price: colorPrice, micro_price: microPrice,
        one_pin_price: onePin, tape_price: tape, spiral_price: spiral,
        printer_name: printerName || null,
      });
      if (insErr) throw insErr;
      toast.success(`Store created — ${uid}`);
      navigate("/store/dashboard", { replace: true });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Setup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen container max-w-2xl py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center glow">
          <StoreIcon className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Set up your store</h1>
          <p className="text-sm text-muted-foreground">Step {step} of 3</p>
        </div>
      </div>

      <Card className="p-6 sm:p-8 bg-card/60 backdrop-blur-xl border-border/60 space-y-6">
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold">Store details</h2>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label>Store name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quick Print Center" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone number</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" inputMode="numeric" maxLength={10} />
              </div>
              <div className="space-y-1.5">
                <Label>Door / Street address</Label>
                <Textarea value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="Door no, building, street" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Road name</Label>
                  <Input value={road} onChange={(e) => setRoad(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Area / landmark</Label>
                  <Input value={area} onChange={(e) => setArea(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Pincode</Label>
                  <Input value={pincode} onChange={(e) => setPincode(e.target.value)} maxLength={6} inputMode="numeric" />
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2"><MapPin className="size-4 text-primary" /> Current location</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {lat !== null ? `${lat.toFixed(5)}, ${lng?.toFixed(5)}` : "Not set"}
                    </div>
                  </div>
                  <Button type="button" variant="secondary" onClick={captureLocation} disabled={locating}>
                    {locating ? <Loader2 className="size-4 animate-spin" /> : "Use current"}
                  </Button>
                </div>
              </div>
            </div>
            <Button className="w-full h-12" onClick={() => {
              const err = validateStep1();
              if (err) return toast.error(err);
              setStep(2);
            }}>Continue <ArrowRight className="size-4" /></Button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold">Customer pricing</h2>
            <p className="text-sm text-muted-foreground -mt-3">Color modes are priced per page. Binding is per copy.</p>
            <div className="grid grid-cols-2 gap-4">
              <PriceField label="Black & white (₹/page)" value={bwPrice} onChange={setBwPrice} />
              <PriceField label="Color (₹/page)" value={colorPrice} onChange={setColorPrice} />
              <PriceField label="Micro (₹/page)" value={microPrice} onChange={setMicroPrice} />
              <PriceField label="One pin (₹/copy)" value={onePin} onChange={setOnePin} />
              <PriceField label="Tape binding (₹/copy)" value={tape} onChange={setTape} />
              <PriceField label="Spiral binding (₹/copy)" value={spiral} onChange={setSpiral} />
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)} className="h-12"><ArrowLeft className="size-4" /></Button>
              <Button className="flex-1 h-12" onClick={() => setStep(3)}>Continue <ArrowRight className="size-4" /></Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-semibold">Store UID & printer</h2>
            <div className="space-y-3">
              <Label>Store UID</Label>
              <Input value={customUid}
                onChange={(e) => setCustomUid(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 18))}
                placeholder={generateStoreUid(name || "Store", phone || "0000000000")}
                className="font-mono tracking-wider" maxLength={18} />
              <p className="text-[11px] text-muted-foreground">2–4 letters then 4–14 digits. Leave blank to use the auto-generated UID.</p>
            </div>
            <div className="space-y-3">
              <Label className="flex items-center gap-2"><Printer className="size-4 text-primary" /> Primary printer</Label>
              <div className="flex gap-2">
                <Input value={printerName} onChange={(e) => setPrinterName(e.target.value)} placeholder="Printer name or IP" />
                <Button variant="secondary" type="button" onClick={scanPrinters} disabled={scanning}>
                  {scanning ? <Loader2 className="size-4 animate-spin" /> : "Scan"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">You can add up to 6 colour, 7 B&W and 5 micro printers from the dashboard. Upload your payment QR from the Payment History section.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(2)} className="h-12"><ArrowLeft className="size-4" /></Button>
              <Button className="flex-1 h-12" onClick={submit} disabled={submitting}>
                {submitting ? <><Loader2 className="size-4 animate-spin" /> Creating…</> : <>Create store <ArrowRight className="size-4" /></>}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

function PriceField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value || "0", 10)))}
        className="h-11 font-mono" />
    </div>
  );
}

export default StoreOnboarding;
