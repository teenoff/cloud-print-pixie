# Plan: Order Queue, Notifications, Print Agent API & Customer Tracking

## 1. Database changes (migration)

**Update `orders` table:**

- Add `customer_phone text` (collected at upload step)
- Add `printed_at timestamptz`
- Extend allowed `status` values: `pending | paid | printing | done | failed`
- Update `validate_order_options` trigger to validate status enum

**RLS additions:**

- Allow store owners to `SELECT` and `UPDATE` orders where `store_uid` matches a store they own (via `EXISTS` subquery on `stores`)
- Keep customer policies unchanged (own orders only)

**Realtime:**

- `ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;`
- Set `REPLICA IDENTITY FULL` on orders

**Helper function** `is_store_owner(_store_uid)` (security definer) for cleaner policies.

## 2. Razorpay webhook (already exists)

- Verify it sets status to `paid` correctly — already implemented in `supabase/functions/razorpay-webhook/index.ts`
- Add: after marking paid, trigger WhatsApp/SMS payment confirmation to `customer_phone`

## 3. WhatsApp/SMS notifications (Twilio connector)

- Ask customer phone number (where customer login with their google)
- New edge function `notify-customer` (callable internally + by webhook)
  - Inputs: `order_id`, `event` (`paid` | `printed`)
  - Looks up order + store, sends Twilio SMS to `customer_phone`
- Webhook calls it on payment captured
- "Mark as printed" action calls it with `event=printed`
- User must connect Twilio via connector (we'll prompt)
  &nbsp;

## 4. Print Agent API (edge function `print-agent`)

Two routes by query param `action`:

- `GET ?action=next&store_uid=CR-XXXX` → returns next `paid` order (oldest first), atomically flips it to `printing`, returns signed URL to PDF
- `POST ?action=complete` body `{order_id}` → flips to `done`, sets `printed_at`, fires `notify-customer` with `printed`

**Auth:** Print agent uses a per-store `agent_token` (added to `stores` table, generated on store creation). Header `x-agent-token` validated against `stores.agent_token`. No JWT needed (`verify_jwt = false` in config.toml).

## 5. Store dashboard — Live order queue

Add a "Live Queue" section to `StoreDashboard.tsx`:

- Subscribes to realtime `orders` filtered by `store_uid`
- Columns: time, file, copies, color, binding, amount, status badge, action
- Status badges color-coded
- "Mark as printed" button visible when status is `paid` or `printing`
- Shows `agent_token` in a copy-able box for the print agent setup

## 6. Customer order tracking page `/orders/:id`

- Realtime-subscribed view of one order
- Stepper: Uploaded → Paid → Printing → Done
- Show store info, total, ETA-style updates
- After payment in customer flow, redirect to this page instead of in-place "Done" step

## 7. Customer flow (`Index.tsx`) tweaks

- Collect `customer_phone` on the Options step (required, validated 10-digit)
- Persist `customer_phone` on order insert
- After Razorpay success/redirect → navigate to `/orders/:id`

## Technical details

**Files created:**

- `supabase/migrations/<ts>_queue_notifications.sql`
- `supabase/functions/notify-customer/index.ts`
- `supabase/functions/print-agent/index.ts`
- `src/pages/OrderTracking.tsx`
- `src/components/store/LiveQueue.tsx`

**Files edited:**

- `supabase/functions/razorpay-webhook/index.ts` — call `notify-customer` after paid
- `supabase/config.toml` — add `[functions.print-agent] verify_jwt = false` and `[functions.notify-customer] verify_jwt = false`
- `src/pages/StoreDashboard.tsx` — add LiveQueue section + agent_token display
- `src/pages/Index.tsx` — phone field + redirect to tracking
- `src/pages/StoreOnboarding.tsx` — generate `agent_token` on store create
- `src/App.tsx` — add `/orders/:id` route

**Secrets needed:**

- Twilio connector (TWILIO_API_KEY) — will prompt to connect via `standard_connectors--connect`
- A `TWILIO_FROM_NUMBER` secret for the sender number

## Out of scope

- Real printer driver integration (the print agent is a separate program the store runs; we provide the API + token)
- WhatsApp Business API approval (we use Twilio SMS; if Twilio WhatsApp sandbox is enabled we'll send via WhatsApp channel automatically)
- Push notifications

Approve and I'll implement in one pass. If you'd rather use WhatsApp Business directly (not Twilio), say so before I start.