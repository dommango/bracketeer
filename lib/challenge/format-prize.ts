// Currency-aware prize formatting, shared by the admin view, teaser copy and
// winner notifications so a prize amount renders the same everywhere. Pure.

const SYMBOLS: Record<string, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
};

// Format a whole-currency-unit amount (e.g. 50) for display: "$50" / "£50".
// Falls back to "<amount> <CODE>" for currencies without a known symbol.
export function formatPrize(amount: number, currency: string): string {
  const symbol = SYMBOLS[currency.toUpperCase()];
  return symbol ? `${symbol}${amount}` : `${amount} ${currency.toUpperCase()}`;
}
