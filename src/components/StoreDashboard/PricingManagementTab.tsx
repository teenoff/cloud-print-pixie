/**
 * Pricing Management Tab Component
 */

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

interface PricingData {
  color: number;
  bw: number;
  micro: number;
}

export const PricingManagementTab = ({ storeId }: { storeId: string }) => {
  const [pricing, setPricing] = useState<PricingData>({
    color: 2.0,
    bw: 0.5,
    micro: 3.0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load pricing on mount
  useEffect(() => {
    loadPricing();
  }, [storeId]);

  const loadPricing = async () => {
    try {
      const { data, error } = await supabase
        .from("pricing")
        .select("printer_type, price_per_page")
        .eq("store_id", storeId);

      if (error) throw error;

      const priceMap: Partial<PricingData> = {
        color: 2.0,
        bw: 0.5,
        micro: 3.0,
      };

      data?.forEach((item) => {
        priceMap[item.printer_type as keyof PricingData] = item.price_per_page;
      });

      setPricing(priceMap as PricingData);
    } catch (error: any) {
      console.error("Error loading pricing:", error);
      toast.error("Failed to load pricing");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePricing = async () => {
    setSaving(true);
    try {
      // Upsert pricing for each type
      for (const [type, price] of Object.entries(pricing)) {
        const { error } = await supabase.from("pricing").upsert(
          {
            store_id: storeId,
            printer_type: type,
            price_per_page: price,
            currency: "INR",
          },
          { onConflict: "store_id,printer_type" }
        );

        if (error) throw error;
      }

      toast.success("Pricing updated successfully");
    } catch (error: any) {
      console.error("Error saving pricing:", error);
      toast.error("Failed to save pricing");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-6">
          {/* Color Pricing */}
          <div className="space-y-2">
            <Label htmlFor="color-price" className="text-base font-semibold">
              Color Printing
            </Label>
            <p className="text-xs text-muted-foreground">
              Price per page for color prints
            </p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">₹</span>
              <Input
                id="color-price"
                type="number"
                step="0.01"
                min="0"
                value={pricing.color}
                onChange={(e) =>
                  setPricing({
                    ...pricing,
                    color: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-10 text-lg"
                placeholder="0.00"
              />
              <span className="text-muted-foreground">/page</span>
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* B&W Pricing */}
          <div className="space-y-2">
            <Label htmlFor="bw-price" className="text-base font-semibold">
              Black & White Printing
            </Label>
            <p className="text-xs text-muted-foreground">
              Price per page for B&W prints
            </p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">₹</span>
              <Input
                id="bw-price"
                type="number"
                step="0.01"
                min="0"
                value={pricing.bw}
                onChange={(e) =>
                  setPricing({
                    ...pricing,
                    bw: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-10 text-lg"
                placeholder="0.00"
              />
              <span className="text-muted-foreground">/page</span>
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* Micro Pricing */}
          <div className="space-y-2">
            <Label htmlFor="micro-price" className="text-base font-semibold">
              Micro Printing
            </Label>
            <p className="text-xs text-muted-foreground">
              Price per page for micro prints
            </p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">₹</span>
              <Input
                id="micro-price"
                type="number"
                step="0.01"
                min="0"
                value={pricing.micro}
                onChange={(e) =>
                  setPricing({
                    ...pricing,
                    micro: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-10 text-lg"
                placeholder="0.00"
              />
              <span className="text-muted-foreground">/page</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Example Calculation */}
      <Card className="p-4 bg-secondary/50 border-secondary">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Example: 100-page document
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Color: 100 pages × ₹{pricing.color.toFixed(2)}</span>
            <span className="font-semibold">₹{(100 * pricing.color).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>B&W: 100 pages × ₹{pricing.bw.toFixed(2)}</span>
            <span className="font-semibold">₹{(100 * pricing.bw).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Micro: 100 pages × ₹{pricing.micro.toFixed(2)}</span>
            <span className="font-semibold">₹{(100 * pricing.micro).toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <Button onClick={handleSavePricing} disabled={saving} size="lg" className="w-full">
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin mr-2" />
            Saving…
          </>
        ) : (
          <>
            <Save className="size-4 mr-2" />
            Save Pricing
          </>
        )}
      </Button>
    </div>
  );
};
