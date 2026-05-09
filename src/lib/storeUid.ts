// Store UID format: 2–4 uppercase letters followed by 4–14 digits.
// Total length 6–18. Alphanumeric only. Owner can also customise.

export const STORE_UID_REGEX = /^[A-Z]{2,4}[0-9]{4,14}$/;

export function isValidStoreUid(uid: string): boolean {
  return STORE_UID_REGEX.test(uid) && uid.length >= 6 && uid.length <= 18;
}

function lettersFromName(name: string): string {
  const words = name.trim().toUpperCase().split(/\s+/).filter(Boolean);
  let letters = "";
  if (words.length >= 2) {
    letters = (words[0][0] || "") + (words[1][0] || "") + (words[2]?.[0] ?? "");
  } else {
    letters = (words[0] || "ST").replace(/[^A-Z]/g, "").slice(0, 4);
  }
  letters = letters.replace(/[^A-Z]/g, "");
  if (letters.length < 2) letters = (letters + "ST").slice(0, 2);
  return letters.slice(0, 4);
}

export function generateStoreUid(name: string, phone: string, salt = ""): string {
  const letters = lettersFromName(name);
  const digits = (phone.replace(/\D/g, "") + (salt || "")).slice(-10).padStart(8, "0");
  const candidate = (letters + digits).slice(0, 18);
  return candidate;
}
