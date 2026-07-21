function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validatePinFormat(pin: string) {
  if (!pin) return "PIN is required.";
  if (!/^\d+$/.test(pin)) return "PIN must contain digits only.";
  if (pin.length < 4) return "PIN must be at least 4 digits.";
  return "";
}

export function createPinSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytesToHex(bytes);
}

export async function hashAdminPin(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

export async function verifyAdminPin(pin: string, hash: string, salt: string) {
  if (!hash || !salt) return false;
  return (await hashAdminPin(pin, salt)) === hash;
}
