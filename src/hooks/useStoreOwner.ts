/**
 * Hook to check if current user is a store owner
 */

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export const useStoreOwner = () => {
  const { user, loading: authLoading } = useAuth();
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    const fetchStore = async () => {
      try {
        const { data, error: err } = await supabase
          .from("stores")
          .select("*")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (err) throw err;
        setStore(data);
      } catch (e: any) {
        console.error("Error fetching store:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStore();
  }, [user, authLoading]);

  return {
    store,
    isStoreOwner: !!store,
    loading,
    error,
  };
};
