const symbols = {
  USD: "$",
  KES: "KSh ",
  EUR: "€",
  GBP: "£",
  UGX: "USh ",
  TZS: "TSh ",
  RWF: "RF ",
  NGN: "₦",
  ZAR: "R ",
};

export function currencySymbol(code) {
  return symbols[code] || (code ? `${code} ` : "$");
}

export function formatCurrency(amount, code = "USD", decimals = 0) {
  const n = Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${currencySymbol(code)}${n}`;
}