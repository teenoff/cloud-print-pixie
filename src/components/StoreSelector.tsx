/**
 * Store Selector Component
 * Allows customers to select a store via GPS or manual UID entry
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  MapPin,
  Navigation,
  Loader2,
  MapPinOff,
  Check,
  Circle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useAuth } from "@/hooks/useAuth";
import {
  validateCustomerUID,
  formatCustomerUID,
  calculateDistance,
} from "@/lib/validation";

interface Store {
  id: string;
  store_uid: string;
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  is_online: boolean;
  distance?: number;
}

interface StoreSelectorProps {
  onSelectStore: (store: Store) => void;
  selectedStoreId?: string;
}

export const StoreSelector = ({
  onSelectStore,
  selectedStoreId,
}: StoreSelectorProps) => {
  const { user } = useAuth();
  const { latitude, longitude, loading: geoLoading, error: geoError, requestLocation } = useGeolocation();

  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [storeUid, setStoreUid] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<"list" | "search">("list");
  const [useGPS, setUseGPS] = useState(false);

  // Load all stores on component mount
  useEffect(() => {
    const loadStores = async () => {
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("*")
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        setStores(data || []);
        setFilteredStores(data || []);
      } catch (error: any) {
        console.error("Error loading stores:", error);
        toast.error("Failed to load stores");
      }
    };

    loadStores();
  }, []);

  // Update stores when GPS location is obtained
  useEffect(() => {
    if (!latitude || !longitude || !useGPS) return;

    // Calculate distances for all stores
    const storesWithDistance = stores
      .map((store) => ({
        ...store,
        distance: calculateDistance(latitude, longitude, store.latitude, store.longitude),
      }))
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, 10); // Show top 10 nearest stores

    setFilteredStores(storesWithDistance);
  }, [latitude, longitude, useGPS, stores]);

  const handleSearchByUID = async () => {
    if (!validateCustomerUID(storeUid)) {
      toast.error("Please enter a valid store ID (6-18 characters, letters and numbers)");
      return;
    }

    setLoading(true);
    try {
      const uid = formatCustomerUID(storeUid);
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("store_uid", uid)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("Store not found");
        return;
      }

      if (!data.is_active) {
        toast.error("This store is currently inactive");
        return;
      }

      onSelectStore(data);
      setStoreUid("");
    } catch (error: any) {
      console.error("Error searching store:", error);
      toast.error("Failed to search store");
    } finally {
      setLoading(false);
    }
  };

  const handleUseGPS = async () => {
    if (useGPS) {
      setUseGPS(false);
      setSearchMode("list");
      setFilteredStores(stores);
    } else {
      setUseGPS(true);
      await requestLocation();
    }
  };

  const handleSelectStore = (store: Store) => {
    if (!store.is_online) {
      toast.error("This store is currently offline. Please select an online store.");
      return;
    }
    onSelectStore(store);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Select a store</h2>
        <p className="text-sm text-muted-foreground">
          Find a store nearby or enter a store ID to print your document.
        </p>
      </div>

      {/* GPS Button & Search Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={useGPS ? "default" : "outline"}
          size="sm"
          onClick={handleUseGPS}
          disabled={geoLoading}
          className="gap-2"
        >
          {geoLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Locating…
            </>
          ) : useGPS ? (
            <>
              <Navigation className="size-4" />
              GPS Enabled
            </>
          ) : (
            <>
              <MapPin className="size-4" />
              Use GPS
            </>
          )}
        </Button>

        <Button
          variant={searchMode === "search" ? "default" : "outline"}
          size="sm"
          onClick={() => setSearchMode(searchMode === "search" ? "list" : "search")}
          className="gap-2"
        >
          Search by ID
        </Button>
      </div>

      {/* GPS Error */}
      {geoError && useGPS && (
        <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
          {geoError}
        </div>
      )}

      {/* Manual Search */}
      {searchMode === "search" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Store ID
            </label>
            <div className="relative">
              <Input
                value={storeUid}
                onChange={(e) => setStoreUid(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchByUID();
                }}
                placeholder="e.g. PB1024 or AB12345"
                className="pl-9 h-10 font-mono tracking-wider"
                maxLength={20}
              />
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            </div>
          </div>
          <Button
            className="w-full h-10"
            disabled={!storeUid || loading}
            onClick={handleSearchByUID}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Searching…
              </>
            ) : (
              "Search Store"
            )}
          </Button>
        </div>
      )}

      {/* Store List */}
      {filteredStores.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredStores.map((store) => (
            <Card
              key={store.id}
              onClick={() => handleSelectStore(store)}
              className={`p-4 cursor-pointer hover:border-primary transition-all ${
                selectedStoreId === store.id
                  ? "border-primary bg-primary/5"
                  : "hover:bg-secondary/50"
              } ${!store.is_online ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{store.name}</p>
                    <div
                      className={`flex-shrink-0 w-2 h-2 rounded-full ${
                        store.is_online ? "bg-green-500" : "bg-gray-400"
                      }`}
                      title={store.is_online ? "Online" : "Offline"}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {store.phone} • {store.store_uid}
                  </p>
                  {store.distance !== undefined && (
                    <p className="text-xs text-primary font-semibold">
                      {store.distance.toFixed(1)} km away
                    </p>
                  )}
                </div>

                {selectedStoreId === store.id && (
                  <Check className="size-5 text-primary flex-shrink-0 mt-1" />
                )}
              </div>

              {!store.is_online && (
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  <Circle className="size-2" />
                  Currently offline
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* No Stores Message */}
      {filteredStores.length === 0 && !geoLoading && (
        <div className="text-center py-8 text-muted-foreground">
          <MapPinOff className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {useGPS
              ? "No stores found within 5km of your location"
              : "Enter a store ID to search"}
          </p>
        </div>
      )}
    </div>
  );
};
