## Add Print Options Step

After a user selects a PDF, insert a new "Options" step where they choose how the document should be printed. These choices are saved with the order and used to compute the price.

### New step in the flow

```text
Upload → Options → Store → Pay → Print
```

### Options to collect (single PDF, single set of options)

1. **Binding** (pick one):
  - One pin (single staple)
  - Tape binding
  - Spiral binding
2. **Number of copies**: numeric input, min 1, max 120, default 1
3. **Color mode** (pick one):
  - Black & white
  - Color

### Pricing (shown live on the Options + Pay screens)

Simple transparent formula (₹, can be tuned later):

- Per-page price: B&W ₹2 / page, Color ₹10 / page
- Page count: we don't parse the PDF in v1 — assume 1 page per copy unit and let user see "× copies" multiplier. (We can add real PDF page counting in a follow-up.)
- Binding add-on per copy: None ₹0, One pin ₹2, Tape ₹15, Spiral ₹30
- Total = (per-page price + binding add-on) × copies

(If you'd rather charge a flat ₹10 like today and just record the options, say so and I'll skip the pricing logic.)

### Database changes

Add columns to `orders` (all nullable with sensible defaults so existing rows are fine):

- `binding` text, default `'none'` — values: `none | one_pin | tape | spiral`
- `copies` integer, default `1`
- `color_mode` text, default `'bw'` — values: `bw | color`
- `amount_paise` integer, default `0` — total price in paise (₹ × 100)

A CHECK-equivalent validation will be enforced via a trigger (per project guidelines: triggers, not CHECK constraints) to keep `binding` and `color_mode` within the allowed enum strings and `copies` between 1 and 50.

### Frontend changes (`src/pages/Index.tsx`)

- Extend `Step` type with `"options"` and add it to the stepper between Upload and Store.
- New options panel using existing shadcn components:
  - `RadioGroup` for binding (4 cards) and color mode (2 cards)
  - `Input type="number"` with +/- buttons for copies
  - Live total displayed at the bottom
- Carry `binding`, `copies`, `colorMode`, `amountPaise` in state and include them in the `orders` insert in `handleSubmitOrder`.
- Pay screen shows the same total instead of the hardcoded ₹10.00 and lists the chosen options in a small summary.
- Done screen shows the chosen options in the receipt block.

### Razorpay impact

The existing `razorpay-webhook` keeps working unchanged — it only flips `status` to `paid`. When we wire up `create-razorpay-order` later, it will read `amount_paise` from the order row, so the price the user sees matches what they're charged.

### Out of scope (can do next)

- Real PDF page-count parsing (would make pricing exact)
- Per-store custom pricing
- Duplex / paper size / page range selection