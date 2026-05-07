/**
 * Print Options Component
 * Allows customers to select print type, view pricing, and set quantity
 */

import { usePricing } from "@/hooks/usePricing";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface PrintOptionsProps {
  storeId: string;
  pageCount: number;
  selectedType: "color" | "bw" | "micro";
  quantity: number;
  onTypeChange: (type: "color" | "bw" | "micro") => void;
  onQuantityChange: (quantity: number) => void;
  availableTypes?: ("color" | "bw" | "micro")[];
}

export const PrintOptions = ({
  storeId,
  pageCount,
  selectedType,
  quantity,
  onTypeChange,
  onQuantityChange,
  availableTypes = ["color", "bw", "micro"],
}: PrintOptionsProps) => {
  const { pricing, loading: pricingLoading, calculateTotal } = usePricing(storeId);

  const typeLabels: Record<string, string> = {
    color: "Color",
    bw: "Black & White",
    micro: "Micro",
  };

  const typeDescriptions: Record<string, string> = {
    color: "Full color printing",
    bw: "Standard black and white",
    micro: "Small format micro printing",
  };

  if (pricingLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Print Options</h2>
          <p className="text-sm text-muted-foreground">Loading printer options…</p>
        </div>
        <div className="h-32 bg-secondary/20 rounded-lg animate-pulse" />
      </div>
    );
  }

  const total = calculateTotal(pageCount, selectedType, quantity);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Customize your print</h2>
        <p className="text-sm text-muted-foreground">
          Choose your print type and quantity.
        </p>
      </div>

      {/* Page Count Info */}
      <Card className="p-4 bg-secondary/50 border-secondary">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground">Uploaded pages</div>
          <div className="text-2xl font-bold text-primary">{pageCount}</div>
        </div>
      </Card>

      {/* Print Type Selection */}
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Print Type
        </Label>
        <RadioGroup value={selectedType} onValueChange={(val) => onTypeChange(val as any)}>
          <div className="space-y-2">
            {availableTypes.map((type) => (
              <div key={type} className="flex items-center space-x-2 p-4 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-colors">
                <RadioGroupItem value={type} id={`type-${type}`} />
                <Label htmlFor={`type-${type}`} className="flex-1 cursor-pointer">
                  <div className="font-medium">{typeLabels[type]}</div>
                  <div className="text-xs text-muted-foreground">
                    {typeDescriptions[type]}
                  </div>
                </Label>
                {pricing && (
                  <div className="text-right">
                    <div className="font-semibold text-primary">
                      ₹{pricing[type as keyof typeof pricing]}/page
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Quantity */}
      <div className="space-y-3">
        <Label htmlFor="quantity" className="text-xs uppercase tracking-wider text-muted-foreground">
          Quantity (copies)
        </Label>
        <Input
          id="quantity"
          type="number"
          min="1"
          max="10"
          value={quantity}
          onChange={(e) => onQuantityChange(Math.max(1, parseInt(e.target.value) || 1))}
          className="h-10"
        />
      </div>

      {/* Price Summary */}
      <Card className="p-4 border-primary/20 bg-primary/5 space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Price per page</span>
          <span className="font-medium text-foreground">
            ₹{pricing?.[selectedType as keyof typeof pricing]?.toFixed(2) || "0.00"}
          </span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Pages</span>
          <span className="font-medium text-foreground">{pageCount}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Quantity</span>
          <span className="font-medium text-foreground">{quantity}</span>
        </div>
        <div className="border-t border-primary/10 pt-2 flex justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-lg font-bold text-primary">₹{total.toFixed(2)}</span>
        </div>
      </Card>

      {/* Info */}
      <div className="flex gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
        <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
        <p>Price will be locked at checkout. You can still change your print options.</p>
      </div>
    </div>
  );
};
