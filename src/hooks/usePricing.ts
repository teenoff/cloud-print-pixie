/**
 * Hook for managing pricing calculations
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PricingInfo {
  color: number;
  bw: number;
  micro: number;
}

export const usePricing = (storeId: string | null) => {
  const [pricing, setPricing] = useState<PricingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) {
      setPricing(null);
      return;
    }

    const fetchPricing = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: err } = await supabase
          .from("pricing")
          .select("printer_type, price_per_page")
          .eq("store_id", storeId);

        if (err) throw err;

        // Convert array to object keyed by printer_type
        const priceMap: Partial<PricingInfo> = {};
        data?.forEach((item) => {
          priceMap[item.printer_type as keyof PricingInfo] =
            item.price_per_page;
        });

        // Set defaults if missing
        setPricing({
          color: priceMap.color || 2.0,
          bw: priceMap.bw || 0.5,
          micro: priceMap.micro || 3.0,
        });
      } catch (e: any) {
        console.error("Error fetching pricing:", e);
        setError(e.message);
        // Set default pricing on error
        setPricing({ color: 2.0, bw: 0.5, micro: 3.0 });
      } finally {
        setLoading(false);
      }
    };

    fetchPricing();
  }, [storeId]);

  /**
   * Calculate total price based on page count and print type
   */
  const calculateTotal = (
    pageCount: number,
    printType: "color" | "bw" | "micro",
    quantity: number = 1
  ): number => {
    if (!pricing) return 0;
    return pageCount * pricing[printType] * quantity;
  };

  return {
    pricing,
    loading,
    error,
    calculateTotal,
  };
};
