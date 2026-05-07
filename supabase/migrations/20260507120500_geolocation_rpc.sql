-- RPC function to get nearby stores
CREATE OR REPLACE FUNCTION get_nearby_stores(
  user_lat decimal,
  user_lng decimal,
  radius_km integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  store_uid text,
  name text,
  phone text,
  latitude decimal,
  longitude decimal,
  is_online boolean,
  distance_km numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.store_uid,
    s.name,
    s.phone,
    s.latitude,
    s.longitude,
    s.is_online,
    -- Haversine formula to calculate distance
    (
      6371 * acos(
        cos(radians($1::numeric)) * cos(radians(s.latitude::numeric)) *
        cos(radians(s.longitude::numeric) - radians($2::numeric)) +
        sin(radians($1::numeric)) * sin(radians(s.latitude::numeric))
      )
    )::numeric AS distance_km
  FROM public.stores s
  WHERE
    s.is_active = true AND
    (
      6371 * acos(
        cos(radians($1::numeric)) * cos(radians(s.latitude::numeric)) *
        cos(radians(s.longitude::numeric) - radians($2::numeric)) +
        sin(radians($1::numeric)) * sin(radians(s.latitude::numeric))
      )
    ) <= $3
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql STABLE;
