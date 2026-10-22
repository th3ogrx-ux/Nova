// Règles de mot de passe : 12 caractères minimum, pas un mot de passe
// courant, et pas un mot de passe déjà volé dans une fuite de données
// (service gratuit Have I Been Pwned : seuls les 5 premiers caractères
// d'une empreinte SHA-1 sont envoyés, jamais le mot de passe lui-même).
export const MIN_PASSWORD_LENGTH = 12;

const COMMON = new Set([
  "password", "motdepasse", "azertyuiop", "azertyuiopqsdfghjklm", "qwertyuiop", "123456789012",
  "123456789", "1234567890", "azerty123456", "azerty1234567", "password1234", "password123456",
  "motdepasse123", "iloveyou1234", "administrateur", "zenoaradar", "zenoa123456", "welcome12345",
  "changeme1234", "letmein12345", "000000000000", "111111111111", "azertyazerty", "qwertyqwerty"
]);

export function localPasswordError(pw) {
  if (pw.length < MIN_PASSWORD_LENGTH) return `${MIN_PASSWORD_LENGTH} caractères minimum.`;
  if (new Set(pw).size < 5) return "Ce mot de passe est trop répétitif.";
  if (COMMON.has(pw.toLowerCase().replace(/[^a-z0-9]/g, ""))) return "Ce mot de passe est trop courant : choisis-en un autre.";
  return null;
}

async function sha1Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// true si le mot de passe apparaît dans une fuite connue. En cas de panne du
// service, on laisse passer (la règle locale s'applique quand même).
export async function isLeakedPassword(pw) {
  try {
    const hash = await sha1Hex(pw);
    const res = await fetch("https://api.pwnedpasswords.com/range/" + hash.slice(0, 5), {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return false;
    const suffix = hash.slice(5);
    return (await res.text()).split("\n").some((line) => {
      const [h, count] = line.trim().split(":");
      return h === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

// Message d'erreur à afficher, ou null si le mot de passe est accepté.
export async function passwordError(pw) {
  const local = localPasswordError(pw);
  if (local) return local;
  if (await isLeakedPassword(pw)) return "Ce mot de passe est apparu dans une fuite de données : choisis-en un autre.";
  return null;
}
