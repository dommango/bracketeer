// Encode a nested params object into Stripe's bracketed form syntax, e.g.
// { line_items: [{ price: "x" }] } → "line_items[0][price]=x". Stripe's REST API
// takes application/x-www-form-urlencoded, not JSON. Pure + dependency-free so it
// can be unit-tested without the env-bound Stripe client.

export function encodeStripeForm(
  obj: Record<string, unknown>,
  prefix = "",
): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        const elemName = `${name}[${i}]`;
        if (item && typeof item === "object") {
          pairs.push(encodeStripeForm(item as Record<string, unknown>, elemName));
        } else {
          pairs.push(`${encodeURIComponent(elemName)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof value === "object") {
      pairs.push(encodeStripeForm(value as Record<string, unknown>, name));
    } else {
      pairs.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return pairs.filter(Boolean).join("&");
}
