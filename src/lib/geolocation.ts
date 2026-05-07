/**
 * Geolocation utilities for finding nearby stores
 */

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Get user's current location using browser Geolocation API
 * @returns Promise resolving to coordinates or error
 */
export const getUserLocation = (): Promise<GeolocationCoordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(
              new Error("Location permission denied. Please enable location access.")
            );
            break;
          case error.POSITION_UNAVAILABLE:
            reject(
              new Error(
                "Location information is unavailable. Please try again."
              )
            );
            break;
          case error.TIMEOUT:
            reject(
              new Error(
                "Location request timed out. Please check your connection."
              )
            );
            break;
          default:
            reject(new Error("Failed to retrieve location"));
        }
      }
    );
  });
};

/**
 * Check if geolocation is available in the browser
 */
export const isGeolocationAvailable = (): boolean => {
  return typeof navigator !== "undefined" && !!navigator.geolocation;
};

/**
 * Cache for coordinates with TTL (default 5 minutes)
 */
const coordsCache = new Map<
  string,
  { coords: GeolocationCoordinates; timestamp: number }
>();
const COORDS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get user location with caching to reduce API calls
 */
export const getCachedUserLocation = async (): Promise<GeolocationCoordinates> => {
  const cacheKey = "user_location";
  const cached = coordsCache.get(cacheKey);

  // Return cached coordinates if still valid
  if (cached && Date.now() - cached.timestamp < COORDS_CACHE_TTL) {
    return cached.coords;
  }

  // Fetch new coordinates
  const coords = await getUserLocation();

  // Cache the result
  coordsCache.set(cacheKey, {
    coords,
    timestamp: Date.now(),
  });

  return coords;
};

/**
 * Clear location cache
 */
export const clearLocationCache = (): void => {
  coordsCache.clear();
};
