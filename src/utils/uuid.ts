// Helper to generate and normalize UUID v4 strings for Supabase Postgres UUID columns
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Convert any string (like 'pat_1725200000000') into a deterministic valid UUID format if needed
export function toValidUUID(input?: string | null): string {
  if (!input) return generateUUID();

  // If already a standard UUID format: 8-4-4-4-12
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(input)) {
    return input;
  }

  // Create a 32-char hex string deterministically from input
  let hex = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i).toString(16);
    hex += code.padStart(2, '0');
  }
  while (hex.length < 32) {
    hex += '0123456789abcdef'[hex.length % 16];
  }
  hex = hex.slice(0, 32);

  // Format as 8-4-4-4-12 with valid version (4) and variant (a)
  const formatted = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  return formatted;
}
