/**
 * Store Info Tab Component
 */

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStoreOwner } from "@/hooks/useStoreOwner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface Store {
  id: string;
  name: string;
  phone: string;
  store_uid: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  is_online: boolean;
}

export const StoreInfoTab = ({ store }: { store: Store }) => {
  const { store: latestStore } = useStoreOwner();
  const [isOnline, setIsOnline] = useState(store?.is_online || false);
  const [toggling, setToggling] = useState(false);

  const handleToggleOnline = async () => {
    setToggling(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({ is_online: !isOnline })
        .eq("id", store.id);

      if (error) throw error;
      setIsOnline(!isOnline);
      toast.success(
        `Store is now ${!isOnline ? "online" : "offline"}`
      );
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to update status");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Store Name
            </p>
            <p className="text-lg font-semibold">{store.name}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Store ID
            </p>
            <p className="font-mono text-sm font-medium">{store.store_uid}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Phone Number
            </p>
            <p className="text-sm">{store.phone}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Location
            </p>
            <p className="text-sm font-mono">
              {store.latitude?.toFixed(6)}, {store.longitude?.toFixed(6)}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Status
            </p>
            <div className="flex items-center gap-3">
              <Badge
                variant={isOnline ? "default" : "outline"}
                className="gap-2"
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                {isOnline ? "Online" : "Offline"}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleToggleOnline}
                disabled={toggling}
              >
                {toggling ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Updating…
                  </>
                ) : (
                  `Set ${isOnline ? "Offline" : "Online"}`
                )}
              </Button>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-900">
              📍 Customers will see this as {isOnline ? "an available" : "an unavailable"} store
              when searching nearby.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
