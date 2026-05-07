/**
 * Order Summary Component
 * Displays complete order information for payment and confirmation steps
 */

import { Card } from "@/components/ui/card";

interface OrderSummaryProps {
  fileName: string;
  fileSize: number;
  pageCount: number;
  printType: "color" | "bw" | "micro";
  quantity: number;
  storeName: string;
  storeUid: string;
  pricePerPage: number;
  totalPrice: number;
  orderId?: string;
  status?: "pending" | "paid" | "failed" | "printing";
}

const printTypeLabels: Record<string, string> = {
  color: "Color",
  bw: "Black & White",
  micro: "Micro",
};

export const OrderSummary = ({
  fileName,
  fileSize,
  pageCount,
  printType,
  quantity,
  storeName,
  storeUid,
  pricePerPage,
  totalPrice,
  orderId,
  status,
}: OrderSummaryProps) => {
  return (
    <Card className="p-6 bg-secondary/60 space-y-4 text-sm">
      {/* File Info */}
      <div>
        <div className="flex justify-between gap-4 mb-2">
          <span className="text-muted-foreground">File</span>
          <span className="font-medium truncate text-right">{fileName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">File size</span>
          <span className="font-medium">{(fileSize / 1024 / 1024).toFixed(1)} MB</span>
        </div>
      </div>

      <div className="border-t border-border/50 pt-4">
        {/* Store Info */}
        <div className="flex justify-between gap-4 mb-2">
          <span className="text-muted-foreground">Store</span>
          <div className="text-right">
            <div className="font-medium">{storeName}</div>
            <div className="text-xs text-muted-foreground font-mono">{storeUid}</div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/50 pt-4">
        {/* Print Settings */}
        <div className="flex justify-between mb-2">
          <span className="text-muted-foreground">Type</span>
          <span className="font-medium">{printTypeLabels[printType]}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-muted-foreground">Pages</span>
          <span className="font-medium">{pageCount}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-muted-foreground">Quantity</span>
          <span className="font-medium">{quantity}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rate</span>
          <span className="font-medium">₹{pricePerPage.toFixed(2)}/page</span>
        </div>
      </div>

      <div className="border-t border-border/50 pt-4">
        {/* Total */}
        <div className="flex justify-between">
          <span className="font-semibold">Total Amount</span>
          <span className="text-lg font-bold text-primary">₹{totalPrice.toFixed(2)}</span>
        </div>
      </div>

      {/* Order ID if available */}
      {orderId && (
        <div className="border-t border-border/50 pt-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order ID</span>
            <span className="font-mono text-xs truncate">{orderId.slice(0, 8)}</span>
          </div>
        </div>
      )}

      {/* Status Badge if available */}
      {status && (
        <div className="border-t border-border/50 pt-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span
              className={`font-semibold text-xs px-2 py-1 rounded-full ${
                status === "paid"
                  ? "bg-green-100 text-green-800"
                  : status === "printing"
                  ? "bg-blue-100 text-blue-800"
                  : status === "failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};
