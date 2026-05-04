// Generate a deterministic Store UID like "CR-91852218" (8-16 alphanumeric uppercase)
// derived from store name + phone. Customers and owners both see this code.

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function generateStoreUid(name: string, phone: string, salt = ""): string {
  const seed = `${name.trim().toLowerCase()}|${phone.replace(/\D/g, "")}|${salt}`;
  let h = fnv1a(seed);
  // First 8 chars: digits derived from phone tail + hash
  const phoneDigits = phone.replace(/\D/g, "").slice(-6).padStart(6, "0");
  let core = phoneDigits + (h % 100).toString().padStart(2, "0");
  // Mix in two more alphanumerics for uniqueness
  for (let i = 0; i < 2; i++) {
    core += ALPHA[h % ALPHA.length];
    h = Math.floor(h / ALPHA.length) ^ fnv1a(core);
  }
  return `CR-${core.toUpperCase().slice(0, 10)}`;
}
