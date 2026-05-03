import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Store, QrCode, CheckCircle2, Printer, FileText, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Step = "upload" | "store" | "pay" | "done";

const Index = () => {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [storeUid, setStoreUid] = useState("");
  const [uploading, setUploading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setStoreUid("");
    setOrderId(null);
    setFileUrl(null);
  };

  const handleSubmitOrder = async () => {
    if (!file) return;
    const uid = storeUid.trim().toUpperCase();
    if (uid.length < 3) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large (max 20MB)");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("print-files")
        .upload(path, file, { contentType: file.type || "application/pdf" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("print-files").getPublicUrl(path);

      const { data: order, error: insErr } = await supabase
        .from("orders")
        .insert({
          store_uid: uid,
          file_url: pub.publicUrl,
          file_name: file.name,
          file_size: file.size,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      setOrderId(order.id);
      setFileUrl(pub.publicUrl);
      setStep("pay");
      toast.success("File uploaded");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "store", label: "Store" },
    { key: "pay", label: "Pay" },
    { key: "done", label: "Print" },
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
          <span className="text-xs text-muted-foreground hidden sm:block">Print anywhere, instantly.</span>
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
            Upload your PDF, pick a store, scan to pay. Your document prints automatically.
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
                onClick={() => setStep("store")}
              >
                Continue <ArrowRight className="size-4" />
              </Button>
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
                <Button variant="secondary" className="h-12" onClick={() => setStep("upload")}>
                  <ArrowLeft className="size-4" />
                </Button>
                <Button
                  className="flex-1 h-12"
                  disabled={storeUid.trim().length < 3}
                  onClick={() => setStep("pay")}
                >
                  Generate Payment QR <ArrowRight className="size-4" />
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
              <div className="text-center text-sm text-muted-foreground">
                Amount: <span className="text-foreground font-semibold">₹10.00</span>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" className="h-12" onClick={() => setStep("store")}>
                  <ArrowLeft className="size-4" />
                </Button>
                <Button
                  className="flex-1 h-12"
                  onClick={() => {
                    toast.success("Payment confirmed — sending to printer");
                    setStep("done");
                  }}
                >
                  I've paid <CheckCircle2 className="size-4" />
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
              <div className="rounded-xl bg-secondary/60 p-4 text-left text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-4">{file?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Store</span><span className="font-mono">{storeUid}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-primary font-medium">Printing</span></div>
              </div>
              <Button className="w-full h-12" onClick={reset}>Print another</Button>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Frontend MVP · Add Lovable Cloud later for real uploads, payments & print agent.
        </p>
      </main>
    </div>
  );
};

export default Index;
