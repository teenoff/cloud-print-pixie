/**
 * UID validation utilities
 */

// Customer format: 6-18 alphanumeric characters
const CUSTOMER_UID_PATTERN = /^[A-Za-z0-9]{6,18}$/;

// Store owner format: 2-4 letters + 4-14 numbers (e.g., PB1234, AB12345)
const STORE_UID_PATTERN = /^[A-Za-z]{2,4}[0-9]{4,14}$/i;

// Phone validation: basic format check
const PHONE_PATTERN = /^[0-9+\-.\s()]{7,15}$/;

export const validateCustomerUID = (uid: string): boolean => {
  return CUSTOMER_UID_PATTERN.test(uid.trim().toUpperCase());
};

export const validateStoreUID = (uid: string): boolean => {
  return STORE_UID_PATTERN.test(uid.trim());
};

export const validatePhoneNumber = (phone: string): boolean => {
  return PHONE_PATTERN.test(phone.trim());
};

export const formatStoreUID = (uid: string): string => {
  return uid.trim().toUpperCase();
};

export const formatCustomerUID = (uid: string): string => {
  return uid.trim().toUpperCase();
};

/**
 * Haversine formula to calculate distance between two coordinates
 * @param lat1 Latitude of first point (decimal degrees)
 * @param lng1 Longitude of first point (decimal degrees)
 * @param lat2 Latitude of second point (decimal degrees)
 * @param lng2 Longitude of second point (decimal degrees)
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
