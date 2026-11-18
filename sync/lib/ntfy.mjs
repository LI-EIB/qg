// Boîte aux lettres chiffrée entre l'appli (navigateur) et le robot GitHub, via ntfy.sh.
// L'appli y dépose : abonnement aux notifications, sauvegarde des progrès, demande de connexion QR.
// Tout est chiffré avec la clé du QG : ntfy ne voit que du charabia.
import { unsealText } from "./crypto.mjs";

export async function pull({ server, topic, since, key, log }) {
  const url = `${server.replace(/\/$/, "")}/${topic}/json?poll=1&since=${encodeURIComponent(since || "all")}`;
  let text = "";
  try {
    const r = await fetch(url, { headers: { Accept: "application/x-ndjson" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    text = await r.text();
  } catch (e) { log(`⚠ boîte aux lettres ntfy injoignable : ${e.message}`); return { msgs: [], last: since }; }
  const msgs = []; let last = since;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }
    if (m.event !== "message" || !m.message) continue;
    last = m.id;
    try { const body = await unsealText(key, m.message); msgs.push({ id: m.id, time: m.time * 1000, ...body }); }
    catch { /* message étranger ou abîmé : ignoré */ }
  }
  return { msgs, last };
}

/** Applique les messages reçus à l'état du robot. Renvoie une éventuelle demande de connexion QR. */
export function apply(msgs, state, now) {
  let qr = null;
  state.subs = state.subs || [];
  for (const m of msgs) {
    if (m.t === "sub" && m.sub && m.sub.endpoint) {
      state.subs = state.subs.filter((s) => s.sub.endpoint !== m.sub.endpoint);
      state.subs.push({ role: m.role === "parent" ? "parent" : "lehna", sub: m.sub, dev: String(m.dev || "").slice(0, 80), at: m.time });
    } else if (m.t === "unsub" && m.endpoint) {
      state.subs = state.subs.filter((s) => s.sub.endpoint !== m.endpoint);
    } else if (m.t === "prog" && m.p) {
      if (!state.progress || (m.at || m.time) >= state.progress.at) state.progress = { p: m.p, at: m.at || m.time };
    } else if (m.t === "qr" && m.qr && m.pin) {
      if (now - m.time < 20 * 60e3 && m.id !== state.lastQr) qr = m;
    }
  }
  if (state.subs.length > 12) state.subs = state.subs.slice(-12);
  return qr;
}
