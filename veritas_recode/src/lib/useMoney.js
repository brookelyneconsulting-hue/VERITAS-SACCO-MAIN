import { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { formatCurrency, currencySymbol } from "@/lib/currency";

// Module-level cache so every page shares one resolved currency code.
const state = { code: "USD", loaded: false, promise: null };
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(state.code));
}

async function loadCurrency() {
  if (state.loaded) return state.code;
  if (state.promise) return state.promise;
  state.promise = (async () => {
    try {
      const [settings, institutions, me] = await Promise.all([
        backend.entities.InstitutionSetting.list().catch(() => []),
        backend.entities.Institution.list().catch(() => []),
        backend.auth.me().catch(() => null),
      ]);
      const inst =
        (me && institutions.find((i) => i.admin_user_id === me.id)) ||
        institutions.find((i) => i.status === "approved") ||
        null;
      const s =
        (inst && settings.find((x) => x.institution_id === inst.id)) ||
        settings.find((x) => x.created_by_id === me?.id) ||
        settings[0] ||
        null;
      state.code = s?.currency || "USD";
    } catch {
      state.code = "USD";
    }
    state.loaded = true;
    state.promise = null;
    notify();
    return state.code;
  })();
  return state.promise;
}

// Force a re-read of the institution currency (e.g. after the admin changes it
// in Account Settings). Updates the cache and notifies every mounted hook so
// amounts across the app re-render with the new symbol immediately.
export function refreshCurrency() {
  state.loaded = false;
  state.promise = null;
  return loadCurrency();
}

// Explicitly set the active currency (e.g. the Member Portal resolving the
// logged-in member's own institution setting, which the auth-based loader
// can't infer). Updates the cache and notifies every mounted hook immediately.
export function setCurrency(code) {
  if (!code) return;
  state.code = code;
  state.loaded = true;
  state.promise = null;
  notify();
}

// Reactive hook: re-renders the component once the currency resolves, and
// whenever it is refreshed.
export function useMoney() {
  const [code, setCode] = useState(state.loaded ? state.code : "USD");
  useEffect(() => {
    if (state.loaded) {
      setCode(state.code);
    }
    const fn = (c) => setCode(c);
    listeners.add(fn);
    if (!state.loaded) loadCurrency().then((c) => setCode(c));
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const money = (amount, decimals) => formatCurrency(amount, code, decimals);
  const symbol = currencySymbol(code);
  return { currency: code, symbol, money };
}

// Synchronous helpers using the already-resolved currency (fallback USD).
export function moneyNow(amount, decimals) {
  return formatCurrency(amount, state.loaded ? state.code : "USD", decimals);
}
export function symbolNow() {
  return currencySymbol(state.loaded ? state.code : "USD");
}

// Prime the cache early (e.g. at app start) so synchronous callers resolve fast.
export function primeCurrency() {
  loadCurrency();
}