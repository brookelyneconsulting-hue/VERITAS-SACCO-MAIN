// Auto-generate a unique member number: 3 letters (from the institution name) + 3 digits.
// e.g. institution "Sunrise SACCO" -> prefix "SUN", number "SUN001".

export function institutionPrefix(name) {
  if (!name) return "MEM";
  const letters = String(name).replace(/[^A-Za-z]/g, "").toUpperCase();
  const core = letters.slice(0, 3) || "MEM";
  return core.padEnd(3, "X");
}

export function nextMemberNumber(institutionName, existingNumbers) {
  const prefix = institutionPrefix(institutionName);
  const used = new Set(
    (existingNumbers || [])
      .map((n) => String(n || "").toUpperCase())
      .filter((n) => n.startsWith(prefix))
  );
  let n = 1;
  while (used.has(`${prefix}${String(n).padStart(3, "0")}`)) n++;
  return `${prefix}${String(n).padStart(3, "0")}`;
}