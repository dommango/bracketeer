// Join-code generation for new pools. Codes are 6 uppercase letters (A–Z),
// matching the existing seeded codes (FIXTUR, FEATCK) and the home-page join box
// which uppercases and slices input to 6 characters. Pure + RNG-injectable so the
// generator is unit-testable; collision handling against the DB lives in manage.ts.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(rand: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  }
  return code;
}

export function isValidJoinCode(code: string): boolean {
  return /^[A-Z]{6}$/.test(code);
}

// Normalize free-form input (lowercase, whitespace, over-length) to the canonical
// form used for lookups, or null when it can't be a valid code.
export function normalizeJoinCode(input: string): string | null {
  const code = input.trim().toUpperCase().slice(0, JOIN_CODE_LENGTH);
  return isValidJoinCode(code) ? code : null;
}
