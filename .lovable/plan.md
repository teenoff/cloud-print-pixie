## Add Store Owner Mode (Onboarding + Dashboard)

Right now the app only has a customer flow. We'll add a parallel "Store Owner" flow on top of the existing Google sign-in, an onboarding wizard, a generated Store UID, printer/QR setup, and an owner dashboard.

### 1. Auth page — add "Continue as Store" button

`src/pages/Auth.tsx` will get a second button under "Continue with Google":

```text
[ Continue with Google ]   ← customer (existing)
[ Continue as Store    ]   ← shop owner (new)
```

Both buttons sign in with Google. The Store button sets a flag so that after sign-in, if the user has no store yet, they're sent to `/store/onboarding` instead of the customer home.

### 2. Store onboarding wizard — `/store/onboarding`

Three steps in one page, with Back/Continue:

**Step A — Store details**
- Store name (text)
- Store phone number (10-digit, used for UID)
- Address: door/street, road name, area/landmark, city, pincode
- "Use my current location" button → uses the browser's `navigator.geolocation` to fill latitude/longitude. Map preview optional (skip for v1, just show captured coords with an "Update location" button).

**Step B — Pricing for customers**
Owner sets the rates customers will see:
- Color: B&W price/page, Color price/page
- Binding: One pin, Tape, Spiral (each in ₹)
- These override the current hardcoded `COLOR_PRICE` / `BINDING_PRICE` for customers who pick this store.

**Step C — Printer & payment**
- "Scan for printers" button (best-effort: lists available printers via WebUSB if supported; otherwise shows "Manual setup" with a text field for printer name / IP). For v1 we just record the printer name string — actual driver integration is out of scope.
- Upload payment QR code (image) — saved to a new `store-assets` storage bucket.

On Submit:
- Generate **Store UID** = `CR-` + 8 to 16 alphanumeric chars derived from phone + store name (uppercase, hash-based, collision-checked against DB).
- Create row in `stores` table.
- Redirect to `/store/dashboard`.

### 3. Store UID — visible to both sides

- Owner dashboard shows the UID prominently in a copy-able box: `CR-91852218`.
- Customer "Select store" step (existing `step === "store"`) gets the same UID input style and validates against the `stores` table; when matched, the customer's pricing screen uses that store's rates.

### 4. Store Owner Dashboard — `/store/dashboard`

Sidebar layout (shadcn sidebar) with these sections:

- **Profile settings** — edit store details, address, pricing, re-upload QR
- **Payment history** — list of paid orders for this store (from `orders` joined to `stores` by `store_uid`)
- **Printing history** — list of orders + status (pending / paid / printed)
- **Connect WhatsApp** — input for WhatsApp business number; "Open WhatsApp" deep-link `https://wa.me/<number>`. (Real WhatsApp Business API requires Meta approval — flagged as v2.)
- **Printer section** — shows the configured printer + a **location bar** with the store address. Tapping it opens Google Maps directions: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>` (this is what customers also see, so they can navigate to the store).

### 5. Database changes (migrations)

New table `stores`:

```text
stores
  id              uuid pk
  owner_user_id   uuid (auth user)
  store_uid       text unique  -- e.g. CR-91852218
  name            text
  phone           text
  address_line    text
  road            text
  area            text
  city            text
  pincode         text
  latitude        numeric
  longitude       numeric
  bw_price        int   default 2
  color_price     int   default 10
  one_pin_price   int   default 2
  tape_price      int   default 15
  spiral_price    int   default 30
  printer_name    text
  qr_image_path   text  -- in store-assets bucket
  whatsapp_number text
  created_at      timestamptz default now()
```

RLS:
- Owner can `SELECT/INSERT/UPDATE` rows where `owner_user_id = auth.uid()`.
- Anyone authenticated can `SELECT` non-sensitive columns (name, address, lat/lng, prices, store_uid, qr) — used by customers to look up a store. Sensitive columns (`whatsapp_number`, `phone`) restricted to owner. We'll do this by exposing a public view `public_stores` for the customer side.

New storage bucket `store-assets` (public read, owner-only write) for QR images.

Validation trigger ensures `store_uid` matches `^CR-[A-Z0-9]{8,16}$`.

### 6. Customer flow updates

- Existing `Store` step: when the user types a UID, look it up; if found, show store name + address and continue.
- Pay step: render the store's uploaded QR image (instead of the placeholder) and show owner's pricing in the totals.
- Done step: show address with a "Get directions" link → Google Maps.

### Out of scope (call out to user)

- Real printer driver integration (we record the name only)
- WhatsApp Business API messaging (deep-link only)
- Map picker UI (we capture geolocation coords; visual map can come next)
- Razorpay charge wiring (existing webhook stays as-is)

If this looks right, approve and I'll implement. If you'd like the printer scan or WhatsApp piece done differently, say so first.