const PERSIAN_ZERO = 0x06f0;
const ARABIC_ZERO = 0x0660;

export function toLatinDigits(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= PERSIAN_ZERO && code <= PERSIAN_ZERO + 9) {
      out += (code - PERSIAN_ZERO).toString();
    } else if (code >= ARABIC_ZERO && code <= ARABIC_ZERO + 9) {
      out += (code - ARABIC_ZERO).toString();
    } else {
      out += s[i];
    }
  }
  return out;
}
