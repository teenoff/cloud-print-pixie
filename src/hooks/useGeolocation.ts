/**
 * Hook for managing geolocation state
 */

import { useEffect, useState } from "react";
import { getCachedUserLocation } from "@/lib/geolocation";

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
}

export const useGeolocation = () => {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: false,
    error: null,
  });

  const requestLocation = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const coords = await getCachedUserLocation();
      setState({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy || null,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || "Failed to get location",
      }));
    }
  };

  return {
    ...state,
    requestLocation,
  };
};
