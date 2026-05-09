# Plan: Flow reorder, Micro option, multi-printer, store presence

## 1. Customer flow reorder
New order: **Upload → Store → Options → Pay → Print**
- After upload, jump to a new **Store** step.
- Store step shows:
  - "Nearest stores" list (distance-sorted using browser geolocation + store lat/lng)
  - Active/Inactive badge (green dot if online, grey if offline)
  - Manual UID entry input ("Enter store code")
  - Selecting an inactive store is disabled (toast: "Store offline")
- Customer can change store any time before Pay.
- Options step shows the **uploaded page count** to the right of the Print/Options header, e.g. `Uploaded pages: 012`.

## 2. Store UID format (6–18 chars, 2–4 letters + 4–14 digits)
- New regex: `^[A-Z]{2,4}[0-9]{4,14}$` (total length 6–18). Drop the `CR-` prefix.
- Default UID auto-generated from store name initials (2–4 letters) + last 4–14 digits of phone.
- Owner can customise UID during onboarding and from Profile settings, validated by the same regex.
- Update DB trigger `validate_store` regex.
- Update `generateStoreUid()` + `lookupStore()` callers — accept raw UID, no `CR-` prefix.

## 3. Color section adds "Micro" + per-page pricing
- Color modes become: `bw | color | micro` (DB enum-like check + `validate_order_options` update).
- **All color modes priced per page** for the entire order: `amount = pages × copies × price_per_page`.
  - Add `micro_price` column to `stores` (default 5).
  - Customer Options UI: 3 segmented buttons (B&W / Color / Micro) each showing `₹x/page`.
- Update price calc in `Index.tsx` and store dashboard pricing form.

## 4. Store presence (online/offline)
- Add `is_online boolean default false` + `last_seen_at timestamptz` to `stores`.
- Owner dashboard has an **Online toggle** in header — flips `is_online` and pings `last_seen_at` every 60 s while open.
- A store is considered active if `is_online = true AND last_seen_at > now()-2 min`.
- Expose `is_online` via `get_store_by_uid` + a new `list_nearby_stores(lat, lng, radius_km)` SECURITY DEFINER function used by the Store step.

## 5. Permission-denied fix on `is_store_owner`
- Current `is_store_owner(text)` is SECURITY DEFINER but RLS on `stores` blocks it indirectly. Grant `EXECUTE` to `authenticated, anon` and ensure search_path is set (already is). Re-test with a fresh migration.

## 6. Store dashboard reshuffle
- **Printer section** → remove the QR display. Add:
  - Settings panel
  - "Add printer" UI (lists printers in a sub-table `store_printers` with `kind ∈ {color, bw, micro}`).
  - Limits enforced client-side and via trigger: max 6 color, 7 b&w, 5 micro.
- **Payment history section** → show QR image, plus:
  - Settings panel
  - "Change QR" upload
  - "Download statement" (CSV of paid orders).

### New table `store_printers`
| col | type |
|---|---|
| id | uuid pk |
| store_id | uuid fk → stores |
| kind | text check (color/bw/micro) |
| name | text |
| connection | text (usb/network/manual) |
| created_at | timestamptz |

Trigger enforces per-kind limits.

## 7. Files touched

**DB migration** (single file):
- alter `stores`: add `is_online`, `last_seen_at`, `micro_price`; update `validate_store` regex.
- alter `orders`: extend `color_mode` validation to include `micro`.
- create `store_printers` table + RLS + per-kind-limit trigger.
- update `get_store_by_uid` return cols (`is_online`, `micro_price`).
- create `list_nearby_stores(lat, lng)` function.
- `GRANT EXECUTE` on `is_store_owner` to authenticated.

**Frontend**
- `src/lib/storeUid.ts` — new generator/validator.
- `src/pages/Index.tsx` — reorder steps, add Store step with nearby list + UID input, page counter, Micro option, per-page pricing.
- `src/pages/StoreOnboarding.tsx` — customisable UID field, Micro price, drop QR upload from printer step (move to payment-history settings).
- `src/pages/StoreDashboard.tsx` — Online toggle + heartbeat, restructure Printer & Payments sections, statement CSV download, printers manager.
- `src/components/store/PrintersManager.tsx` (new).
- `src/components/store/PaymentSettings.tsx` (new — QR change + statement).

## Out of scope
- Real printer driver routing per kind (still manual; agent picks the queue).
- Push notifications for offline → online transitions.

Confirm and I'll implement.