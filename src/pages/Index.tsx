import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Upload,
  QrCode,
  CheckCircle2,
  Printer,
  FileText,
  ArrowRight,
  ArrowLeft,
  Loader2,
  LogOut,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePricing } from "@/hooks/usePricing";
import { StoreSelector } from "@/components/StoreSelector";
import { PrintOptions } from "@/components/PrintOptions";
import { OrderSummary } from "@/components/OrderSummary";
import { getPDFPageCount, validatePDFFile } from "@/lib/pdf-parser";

type Step = "upload" | "store" | "options" | "pay" | "print";

interface SelectedStore {
  id: string;
  store_uid: string;
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  is_online: boolean;
}

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Flow state
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedStore, setSelectedStore] = useState<SelectedStore | null>(null);
  const [printType, setPrintType] = useState<"color" | "bw" | "micro">("color");
  const [quantity, setQuantity] = useState(1);

  // UI state
  const [uploading, setUploading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pricePerPage, setPricePerPage] = useState(0);

  // Pricing
  const { calculateTotal } = usePricing(selectedStore?.id || null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPageCount(0);
    setSelectedStore(null);
    setPrintType("color");
    setQuantity(1);
    setOrderId(null);
    setFileUrl(null);
    setPricePerPage(0);
  };

  // Handle file upload to storage & create order
  const handleCreateOrder = async () => {
    if (!file || !user || !selectedStore) return;

    // Validate file
    const validation = validatePDFFile(file);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    setUploading(true);
    try {
      // Upload file to storage
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("print-files")
        .upload(path, file, { contentType: file.type || "application/pdf" });
      if (upErr) throw upErr;

      // Generate signed URL (valid 1 hour)
      const { data: signed, error: signErr } = await supabase.storage
        .from("print-files")
        .createSignedUrl(path, 60 * 60);
      if (signErr) throw signErr;
      setFileUrl(signed.signedUrl);

      // Get prices from store
      const { data: pricing, error: pricingErr } = await supabase
        .from("pricing")
        .select("price_per_page")
        .eq("store_id", selectedStore.id)
        .eq("printer_type", printType)
        .single();

      if (pricingErr && pricingErr.code !== "PGRST116") throw pricingErr;
      const price = pricing?.price_per_page || 2.0; // Default fallback
      setPricePerPage(price);

      // Create order record
      const totalPrice = pageCount * price * quantity;
      const { data: order, error: insErr } = await supabase
        .from("orders")
        .insert({
          store_id: selectedStore.id,
          file_url: path,
          file_name: file.name,
          file_size: file.size,
          user_id: user.id,
          print_type: printType,
          page_count: pageCount,
          price_per_page: price,
          total_price: totalPrice,
          status: "pending",
        })
        .select()
        .single();
      if (insErr) throw insErr;

      setOrderId(order.id);
      setStep("pay");
      toast.success("File uploaded and order created");
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
    { key: "store", label: "Store" },
    { key: "options", label: "Options" },
    { key: "pay", label: "Pay" },
    { key: "print", label: "Print" },
  ];
  const stepIdx = steps.findIndex((s) => s.key === step);

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
            <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[160px]">
              {user?.email}
            </span>
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
            Print to <span className="text-gradient-primary">any store</span>
            <br />
            in seconds.
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Upload your PDF, pick a store, customize options, scan to pay. Your document
            prints automatically.
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
                <div
                  className={`flex-1 h-px mx-2 mb-5 ${i < stepIdx ? "bg-primary" : "bg-border"}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <Card className="p-8 bg-card/60 backdrop-blur-xl border-border/60 shadow-[var(--shadow-card)]">
          {/* STEP 1: UPLOAD */}
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
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const validation = validatePDFFile(f);
                      if (!validation.isValid) {
                        toast.error(validation.error);
                        return;
                      }

                      try {
                        const count = await getPDFPageCount(f);
                        setFile(f);
                        setPageCount(count);
                        toast.success(`PDF loaded: ${count} page${count !== 1 ? "s" : ""}`);
                      } catch (error: any) {
                        toast.error(error.message);
                      }
                    }
                  }}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="size-10 text-primary" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB · {pageCount} page
                      {pageCount !== 1 ? "s" : ""} · click to change
                    </p>
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
                onClick={() => setStep("store")}
              >
                Continue <ArrowRight className="size-4" />
              </Button>
            </div>
          )}

          {/* STEP 2: STORE SELECTION */}
          {step === "store" && (
            <div className="space-y-6">
              <StoreSelector
                onSelectStore={(store) => {
                  setSelectedStore(store);
                  setStep("options");
                }}
                selectedStoreId={selectedStore?.id}
              />
              <div className="flex gap-3">
                <Button variant="secondary" className="h-12" onClick={() => setStep("upload")}>
                  <ArrowLeft className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: PRINT OPTIONS */}
          {step === "options" && selectedStore && (
            <div className="space-y-6">
              <PrintOptions
                storeId={selectedStore.id}
                pageCount={pageCount}
                selectedType={printType}
                quantity={quantity}
                onTypeChange={setPrintType}
                onQuantityChange={setQuantity}
              />
              <div className="flex gap-3">
                <Button variant="secondary" className="h-12" onClick={() => setStep("store")}>
                  <ArrowLeft className="size-4" />
                </Button>
                <Button
                  className="flex-1 h-12"
                  onClick={handleCreateOrder}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Processing…
                    </>
                  ) : (
                    <>
                      Proceed to Payment <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: PAYMENT */}
          {step === "pay" && selectedStore && orderId && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Scan to pay</h2>
                <p className="text-sm text-muted-foreground">
                  Complete the payment to proceed with your print order.
                </p>
              </div>

              <OrderSummary
                fileName={file?.name || ""}
                fileSize={file?.size || 0}
                pageCount={pageCount}
                printType={printType}
                quantity={quantity}
                storeName={selectedStore.name}
                storeUid={selectedStore.store_uid}
                pricePerPage={pricePerPage}
                totalPrice={calculateTotal(pageCount, printType, quantity)}
                orderId={orderId}
              />

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

              <div className="text-center text-sm text-muted-foreground">
                Amount:
                <span className="text-foreground font-semibold block mt-1">
                  ₹{calculateTotal(pageCount, printType, quantity).toFixed(2)}
                </span>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="h-12"
                  onClick={() => setStep("options")}
                >
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
                        setStep("print");
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
                    <>
                      <Loader2 className="size-4 animate-spin" /> Checking…
                    </>
                  ) : (
                    <>
                      I've paid <CheckCircle2 className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: PRINT CONFIRMATION */}
          {step === "print" && selectedStore && (
            <div className="space-y-6 text-center py-6">
              <div className="size-20 mx-auto rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center glow">
                <Printer className="size-10 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Printing now</h2>
                <p className="text-sm text-muted-foreground">
                  Your file was sent to <span className="font-mono text-foreground">{selectedStore.name}</span>
                  .<br />
                  Pick it up at the counter within 30 minutes.
                </p>
              </div>

              <OrderSummary
                fileName={file?.name || ""}
                fileSize={file?.size || 0}
                pageCount={pageCount}
                printType={printType}
                quantity={quantity}
                storeName={selectedStore.name}
                storeUid={selectedStore.store_uid}
                pricePerPage={pricePerPage}
                totalPrice={calculateTotal(pageCount, printType, quantity)}
                orderId={orderId || undefined}
                status="printing"
              />

              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs text-primary hover:underline"
                >
                  View uploaded file ↗
                </a>
              )}

              <Button className="w-full h-12" onClick={reset}>
                Print another
              </Button>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Files are stored securely · Real-time payment processing coming next.
        </p>
      </main>
    </div>
  );
};

export default Index;
