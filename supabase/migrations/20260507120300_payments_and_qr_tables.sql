-- Create payments table
CREATE TABLE public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  razorpay_order_id text,
  razorpay_payment_id text,
  amount decimal(8,2) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'captured', 'failed')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(order_id)
);

CREATE INDEX idx_payments_order ON public.payments (order_id);
CREATE INDEX idx_payments_razorpay_order ON public.payments (razorpay_order_id);

-- Create payment_qr_codes table
CREATE TABLE public.payment_qr_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  qr_code_data text NOT NULL,
  generated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  expires_at timestamp with time zone NOT NULL,
  UNIQUE(order_id)
);

CREATE INDEX idx_payment_qr_order ON public.payment_qr_codes (order_id);

-- Enable RLS for payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
CREATE POLICY "Users can view their own order payments" ON public.payments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payments.order_id AND orders.user_id = auth.uid())
  );

CREATE POLICY "Service can insert payments" ON public.payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update payments" ON public.payments
  FOR UPDATE USING (true);

-- Enable RLS for payment_qr_codes table
ALTER TABLE public.payment_qr_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_qr_codes
CREATE POLICY "Users can view their own QR codes" ON public.payment_qr_codes
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payment_qr_codes.order_id AND orders.user_id = auth.uid())
  );

CREATE POLICY "Service can insert QR codes" ON public.payment_qr_codes
  FOR INSERT WITH CHECK (true);

-- Trigger to update payments timestamp
CREATE OR REPLACE FUNCTION update_payments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payments_timestamp
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION update_payments_timestamp();
