const ARABIC_TO_PERSIAN: Record<string, string> = {
  "ي": "ی", // ي → ی
  "ك": "ک", // ك → ک
  "ة": "ه", // ة → ه
  "ؤ": "و", // ؤ → و (optional normalization)
};

const TATWEEL = "ـ"; // ـ kashida

export function normalizePersian(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === TATWEEL) continue;
    const mapped = ARABIC_TO_PERSIAN[ch];
    out += mapped ?? ch;
  }

  out = out.replace(/\s+/g, " ").trim();

  out = out.toLowerCase();

  return out;
}
