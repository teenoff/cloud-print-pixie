## Goal
Use the richer `PaymentSettings` component in the **Payment history** sidebar section, so the store owner can manage their payment QR and view payments from one place.

## Changes
- `src/pages/StoreDashboard.tsx`
  - Import `PaymentSettings` from `@/components/store/PaymentSettings`.
  - Replace the current `payments` branch (which renders a bare `OrdersList`) with:
    ```tsx
    <PaymentSettings
      store={store}
      qrUrl={qrUrl}
      orders={orders}
      onQrChanged={(path) => {
        setStore({ ...store, qr_image_path: path });
        const { data: pub } = supabase.storage.from("store-assets").getPublicUrl(path);
        setQrUrl(pub.publicUrl);
      }}
    />
    ```
  - Leave `printing`, `printer`, and all other sections untouched.

## Out of scope
- No changes to the Printer section's QR display.
- No backend/schema changes.
- No visual redesign of `PaymentSettings` itself.

Confirm and I'll implement.