# Plan: Accept/Reject flow, QR expiry, real-time tracking, auto refund

## 1. Database

Add to `orders`:
- `qr_expires_at timestamptz` (default `now() + 5 min` on insert)
- `accepted_at`, `rejected_at timestamptz`
- `rejection_reason text`
- `refund_id text`, `refund_status text` (`pending|processed|failed`)
- extend status check trigger to allow `rejected`, `refunded`

Add to `stores`:
- `auto_accept boolean default false`

Trigger: when `orders.status` flips to `paid`, set `qr_expires_at = null`. When flips to `rejected`, enqueue refund (handled in edge function — see §4).

Enable realtime on `orders` (already done) and confirm.

## 2. Customer flow (`src/pages/Index.tsx`)

Clean up the file — it currently has two `step === "store"` blocks and references to undefined symbols. Single store step before pay.

Gating to payment:
- Before calling `setStep("pay")` in `handleSubmitOrder`, re-run `lookupStore(uid, { silent:true })`. If it fails or store is offline, show inline error card with **Retry** and **Pick another store** buttons; do not advance.

Pay step additions:
- 5-minute countdown derived from `order.qr_expires_at`. Display `MM:SS`, color shifts amber <60s, red at 0.
- On reach 0: call new edge function `refresh-qr` → updates `qr_expires_at = now()+5min`, returns new value. UI re-subscribes.
- Subscribe via realtime to this order. If `status` becomes `paid` → auto-redirect to `/orders/:id`. If `rejected` → show rejection card with reason, refund status badge, and "Try another store" button (resets flow).

## 3. Order tracking timeline (`src/pages/OrderTracking.tsx`)

Already subscribes to UPDATE. Extend stages to include `rejected` branch:

```text
pending → paid → printing → done
                ↘ rejected → refunded
```

- Render `rejected`/`refunded` as a separate red branch when present.
- Show timestamps (`created_at`, `accepted_at`, `printed_at`) under each step.
- Show live "ETA" / "since X ago" using a 1-sec ticker.

## 4. Store dashboard (`src/components/store/LiveQueue.tsx` + new `IncomingRequests.tsx`)

New "Incoming requests" card listing orders with `status='paid'` and `accepted_at IS NULL`:
- **Accept** button → `update orders set status='printing', accepted_at=now()`
- **Reject** button → opens dialog for reason → `update orders set status='rejected', rejected_at=now(), rejection_reason=...` and invokes `refund-order` edge function.
- Auto-accept toggle in store settings (writes `stores.auto_accept`). When on, a DB trigger on `orders` (status → paid) auto-sets `status='printing', accepted_at=now()` if `stores.auto_accept = true`.

## 5. Edge functions

**`refund-order`** (new, `verify_jwt=false`, validates caller via service role + owner check on store):
- Input: `{ order_id }`
- Verifies order is `rejected` and has `razorpay_payment_id`.
- Calls Razorpay Refunds API (`POST /v1/payments/:id/refund`) with basic auth `RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET`.
- Updates `orders.refund_id`, `refund_status='processed'` (or `failed`), `status='refunded'`.
- Fires `notify-customer` with `event:'rejected_refunded'`.
- New secrets needed: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (will request via secrets tool).

**`refresh-qr`** (new, JWT-verified): validates `auth.uid() = orders.user_id`, only allowed when `status='pending'`, sets `qr_expires_at = now() + interval '5 minutes'`, returns the row.

**`razorpay-webhook`**: no change — already moves to `paid`. Auto-accept handled by DB trigger.

**`notify-customer`**: extend to handle `rejected_refunded` event template.

## 6. Out of scope

- Razorpay order/payment creation flow itself (kept as-is; current QR is a static store QR + manual "I've paid").
- Partial refunds.
- Push notifications.

## Tech details

- New files: `src/components/store/IncomingRequests.tsx`, `supabase/functions/refund-order/index.ts`, `supabase/functions/refresh-qr/index.ts`, one migration.
- Edited: `src/pages/Index.tsx` (cleanup + countdown + realtime + gating), `src/pages/OrderTracking.tsx` (rejected branch), `src/pages/StoreDashboard.tsx` (mount IncomingRequests + auto-accept toggle), `supabase/functions/notify-customer/index.ts`.
