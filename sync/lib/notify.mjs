// Notifications : nouveautés Pronote + rappel du soir (élève) + bilan du soir (parent).
import webpush from "web-push";
import { parisParts, addDays, frDay, cut } from "./text.mjs";

const sname = (base, s, sn) => (base.SUBJ[s] ? base.SUBJ[s].n.split(" (")[0] : sn || "Autre");
const nb = (x) => String(+(+x).toFixed(2)).replace(".", ",");

/** Transforme les événements détectés en notifications (regroupées si trop nombreuses). */
export function buildMessages(events, base, name) {
  const out = [];
  const by = (t) => events.filter((e) => e.type === t);
  const group = (list, one, many) => { if (!list.length) return; if (list.length <= 3) list.forEach((e) => out.push(one(e))); else out.push(many(list)); };
  const both = ["lehna", "parent"];

  group(by("taf"), (e) => ({ to: both, tag: "taf", title: `Nouveau devoir en ${sname(base, e.s)} pour ${frDay(e.due)}`, body: cut(e.text, 140), url: "#aujourdhui" }),
    (l) => ({ to: both, tag: "taf", title: `${l.length} nouveaux devoirs sur Pronote`, body: [...new Set(l.map((e) => sname(base, e.s)))].join(", "), url: "#aujourdhui" }));
  group(by("boss"), (e) => ({ to: both, tag: "boss-" + e.date, title: `Contrôle annoncé : ${e.title}, ${frDay(e.date)}`, body: `Le plan de révision est prêt dans le QG (objectif : prête ${frDay(e.ready)}).`, url: "#boss" }),
    (l) => ({ to: both, tag: "boss", title: `${l.length} contrôles annoncés`, body: l.map((e) => `${sname(base, e.s)} ${frDay(e.date)}`).join(" · "), url: "#boss" }));
  group(by("grade"), (e) => ({ to: both, tag: "note", title: e.v != null ? `Nouvelle note en ${sname(base, e.s)} : ${nb(e.v)}/${e.o}` : `Nouvelle évaluation en ${sname(base, e.s)}`, body: [e.t, e.avg != null ? `moyenne du groupe ${nb(e.avg)}` : ""].filter(Boolean).join(" · "), url: "#notes" }),
    (l) => ({ to: both, tag: "note", title: `${l.length} nouvelles notes`, body: l.map((e) => `${sname(base, e.s)} ${e.v != null ? nb(e.v) + "/" + e.o : ""}`).join(" · "), url: "#notes" }));
  group(by("change"), (e) => ({ to: both, tag: "edt-" + e.id, title: `${e.label} : ${sname(base, e.s, e.sn)}, ${frDay(e.date)}`, body: e.h, url: "#aujourdhui" }),
    (l) => ({ to: both, tag: "edt", title: `${l.length} changements d'emploi du temps`, body: l.map((e) => `${sname(base, e.s, e.sn)} ${frDay(e.date)}`).join(" · "), url: "#aujourdhui" }));
  group(by("news"), (e) => ({ to: both, tag: "info", title: `Info du collège : ${e.t}`, body: e.a, url: "#aujourdhui" }),
    (l) => ({ to: both, tag: "info", title: `${l.length} informations du collège`, body: l.map((e) => e.t).join(" · "), url: "#aujourdhui" }));
  const c = by("cdt");
  if (c.length) out.push({ to: ["lehna"], tag: "cdt", title: "Nouveau dans le cahier de textes", body: cut([...new Set(c.map((e) => sname(base, e.s)))].join(", ") + " : " + c.map((e) => e.title).join(" · "), 160), url: `#fiches/${c[0].s}/cdt` });
  return out;
}

/** Rappels du soir, une seule fois par jour. */
export function dailyMessages({ now, state, content, base, name }) {
  const p = parisParts(now); const today = p.date; const out = [];
  const sent = (state.sent = state.sent || {});
  for (const k of Object.keys(sent)) if (k.slice(-10) < addDays(today, -10)) delete sent[k];
  const mission = (base.MISSIONS || []).find((m) => m.date === today) || (content.missions || []).find((m) => m.date === today);
  // Devoirs du soir = ceux du prochain jour de classe (rien le vendredi : ceux de lundi sont pour le week-end)
  const hol = (d) => (content.holidays || base.HOLIDAYS || []).some((h) => d >= h.start && d <= h.end);
  let tomorrow = addDays(today, 1);
  while ([0, 6].includes(new Date(tomorrow + "T12:00:00Z").getUTCDay()) || hol(tomorrow)) tomorrow = addDays(tomorrow, 1);
  const friday = new Date(today + "T12:00:00Z").getUTCDay() === 5;
  const dev = friday ? [] : (content.devoirs || []).filter((d) => d.due === tomorrow && !d.done);
  const pour = tomorrow === addDays(today, 1) ? "pour demain" : "pour " + frDay(tomorrow);
  const boss = [...(base.BOSSES || []), ...(content.bosses || []).filter((b) => b.auto)].filter((b) => b.date && b.date > today && b.date <= addDays(today, 2));
  const quiet = p.h >= 22 || p.h < 7;
  if (quiet) return out;

  if (p.h * 60 + p.m >= 17 * 60 && !sent["rem-" + today] && (mission || dev.length)) {
    sent["rem-" + today] = 1;
    const parts = [];
    if (dev.length) parts.push(`d'abord ${dev.length} devoir${dev.length > 1 ? "s" : ""} ${pour}`);
    if (boss.length) parts.push(`boss ${boss.map((b) => b.title).join(", ")} ${boss[0].date === tomorrow ? "demain" : "après-demain"}`);
    out.push({ to: ["lehna"], tag: "rappel", title: mission ? `Mission du soir : ${cut(mission.title, 70)}` : `Les devoirs ${pour}`, body: (parts.join(" · ") || "Ouvre le QG pour la voir") + (mission ? ` · +${mission.xp || 10} XP` : ""), url: "#aujourdhui" });
  }

  if (p.h * 60 + p.m >= 20 * 60 + 30 && !sent["par-" + today]) {
    sent["par-" + today] = 1;
    const prog = state.progress;
    const seenToday = prog && prog.at && parisParts(prog.at).date === today;
    let title, body;
    if (!seenToday) { title = `${name} n'a pas encore ouvert le QG aujourd'hui`; body = mission ? `Mission du soir : ${cut(mission.title, 90)}` : `${dev.length} devoir(s) ${pour}`; }
    else {
      const p2 = prog.p || {}; const done = mission && p2.done && p2.done[today];
      const keys = dev.map((d) => d.due + ":" + d.subj + ":" + d.text.slice(0, 24));
      const devDone = keys.filter((k) => p2.devoirs && p2.devoirs[k]).length;
      title = mission ? (done ? `${name} a fini sa mission du soir` : `${name} n'a pas encore validé sa mission du soir`) : `Bilan du soir de ${name}`;
      body = `${dev.length ? `Devoirs ${pour} cochés : ${devDone}/${dev.length}` : `Pas de devoir ${pour}`}${boss.length ? ` · boss proche : ${boss[0].title}` : ""}`;
    }
    out.push({ to: ["parent"], tag: "bilan", title, body, url: "#suivi" });
  }
  return out;
}

/** Envoi Web Push ; les abonnements expirés sont retirés. */
export async function send(messages, state, { log, dry }) {
  const subs = state.subs || [];
  if (!messages.length || !subs.length) return { sent: 0 };
  if (!state.vapid) return { sent: 0 };
  webpush.setVapidDetails(state.vapidSubject || "https://github.com", state.vapid.publicKey, state.vapid.privateKey);
  let n = 0; const dead = new Set();
  for (const m of messages) for (const s of subs) {
    if (!m.to.includes(s.role)) continue;
    const payload = JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.tag });
    if (dry) { dry.push({ role: s.role, ...m }); n++; continue; }
    try { await webpush.sendNotification(s.sub, payload, { TTL: 6 * 3600, urgency: "normal" }); n++; }
    catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.add(s.sub.endpoint); log(`⚠ notification non envoyée (${e && e.statusCode}) ${e && e.body || e}`); }
  }
  if (dead.size) state.subs = subs.filter((s) => !dead.has(s.sub.endpoint));
  return { sent: n };
}
