-- Create enums for printer types
CREATE TYPE printer_type AS ENUM ('color', 'bw', 'micro');

-- Create stores table
CREATE TABLE public.stores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_uid text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  latitude decimal(10,8),
  longitude decimal(11,8),
  is_active boolean DEFAULT true,
  is_online boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Create index for geolocation queries
CREATE INDEX idx_stores_geo ON public.stores (latitude, longitude) WHERE is_active = true;
CREATE INDEX idx_stores_owner ON public.stores (owner_id);

-- Enable RLS for stores table
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stores
CREATE POLICY "Everyone can view active stores" ON public.stores
  FOR SELECT USING (is_active = true);

CREATE POLICY "Store owners can view their own store" ON public.stores
  FOR SELECT TO authenticated USING (auth.uid() = owner_id OR is_active = true);

CREATE POLICY "Users can insert their own store" ON public.stores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Store owners can update their own store" ON public.stores
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Store owners can delete their own store" ON public.stores
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);
