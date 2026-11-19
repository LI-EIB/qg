// Données Pronote brutes -> contenu du QG (même format que l'appli existante)
// + détection automatique des contrôles et plan de révision.
import { subjKey, htmlToText, nfc, parisDate, parisParts, addDays, dayDiff, weekday, frDay, cut } from "./text.mjs";

const EVAL_RE = /\b(contr[oô]les?|[ée]valuations?|interros?|interrogations?|tests?|DS|DST|devoirs? (sur table|surveill[ée]s?)|quiz+|QCM|ECE|examens?|oraux|oral|expos[ée]s?|r[ée]citations?|dict[ée]es?|brevet blanc)\b/i;
const NOT_EVAL_RE = /(pas de (contr[oô]le|test|[ée]valuation)|corrig|correction|pendant \d|pendant (un|une|deux|trois)|fin du mois|à la fin|prochainement|bient[oô]t|dans (\d|deux|trois|quatre) semaines|le mois prochain)/i;
const STRONG_RE = /^[\s*\-–•:]*(contr[oô]le|interro(gation)?|[ée]valuation|DS|DST|devoir (sur table|surveill[ée])|test|quiz+|QCM|dict[ée]e|r[ée]citation|oral|expos[ée])\b/i;
const MOIS = { janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12 };
/** Date écrite dans le texte (« contrôle du 27 novembre », « interro le 3/12 ») près d'un mot d'évaluation. */
function evalDateIn(text, due, today) {
  const t = String(text || "");
  const re = new RegExp(EVAL_RE.source + "[^.\\n]{0,40}?(\\d{1,2})(?:er)?(?:\\s+(" + Object.keys(MOIS).join("|") + ")|\\s*/\\s*(\\d{1,2}))", "i");
  const m = re.exec(t); if (!m) return null;
  const g = m.slice(-3); const d = +g[0]; const mo = g[1] ? MOIS[g[1].toLowerCase()] : +g[2];
  if (!d || !mo || d > 31 || mo > 12) return null;
  const y0 = +due.slice(0, 4);
  for (const y of [y0, y0 + 1, y0 - 1]) { const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`; if (dayDiff(today, iso) >= -1 && dayDiff(today, iso) <= 90) return iso; }
  return null;
}
const EVAL_CATS = { 3: "Devoir sur table", 4: "Interrogation orale", 7: "Évaluation" };

function evalLabel(t) {
  const m = String(t || "").match(EVAL_RE); if (!m) return "Contrôle";
  const w = m[0].toLowerCase();
  if (/interro/.test(w)) return "Interro";
  if (/^ece$/i.test(w)) return "ECE";
  if (/oral|expos/.test(w)) return "Oral";
  if (/dict/.test(w)) return "Dictée";
  if (/r[ée]cit/.test(w)) return "Récitation";
  if (/quiz|qcm/.test(w)) return "Quiz";
  if (/^ds|^dst|table|surveill/.test(w)) return "Devoir sur table";
  if (/[ée]val/.test(w)) return "Évaluation";
  if (/brevet/.test(w)) return "Brevet blanc";
  if (/test/.test(w)) return "Test";
  return "Contrôle";
}

const hm = (isoDT) => parisParts(isoDT).hm.replace(/h00$/, "h");
const subjName = (base, s, raw) => (base.SUBJ[s] ? base.SUBJ[s].n.split(" (")[0] : raw || "Autre");

/**
 * @param {object} raw     sortie de pronote.fetchAll
 * @param {object} base    données du QG (base.json déchiffré)
 * @param {object} files   { attachmentKey: { k, n, ext, size, s } } pièces jointes déjà téléchargées
 * @param {object} seen    état « déjà vu » (modifié sur place)
 * @param {Date}   now
 */
export function transform(raw, base, files, seen, now) {
  const today = parisDate(now);
  const initial = !seen.ok;
  const ev = [];
  // Une catégorie vue pour la première fois (ex. onglet qui s'ouvre) est enregistrée sans notification.
  const fresh = {};
  const firstSeen = (kind, id, d) => {
    if (!(kind in fresh)) fresh[kind] = initial || !seen[kind] || !Object.keys(seen[kind]).length;
    const m = (seen[kind] = seen[kind] || {});
    if (!m[id]) { m[id] = fresh[kind] ? (d || today) : today; return !fresh[kind]; }
    return false;
  };
  const isNew = (kind, id) => (seen[kind] && seen[kind][id] ? seen[kind][id] >= addDays(today, -6) && seen[kind][id] !== "init" : false);

  const fref = (a, s, d) => {
    if (a.kind === "link") return { n: a.name || a.url, u: a.url };
    const f = files[attKey(a, s, d)];
    return f ? { n: f.n, k: f.k, e: f.ext } : { n: a.name, p: 1 };
  };

  // ---------- cahier de textes ----------
  const cdt = [];
  const resById = {};
  for (const r of raw.resources || []) {
    const s = subjKey(r.subject); const d = parisDate(r.start); resById[r.id] = r;
    const h = `${hm(r.start)} à ${hm(r.end)}`;
    const contents = r.contents.length ? r.contents : [{ id: r.id, title: "", description: "", categoryText: "", files: [] }];
    for (const c of contents) {
      const e = { id: c.id, d, s, sn: r.subject, h, t: c.title || c.categoryText || "Séance", c: c.categoryText || "", x: htmlToText(c.description), a: [], pj: [], f: c.files.map((a) => fref(a, r.subject, d)), cat: c.category, id: sid("c", d, s, h, c.title || c.categoryText || "", c.description) };
      if (firstSeen("cdt", e.id, d)) ev.push({ type: "cdt", s, title: e.t, d });
      e.nv = isNew("cdt", c.id);
      cdt.push(e);
    }
  }
  cdt.sort((a, b) => a.d.localeCompare(b.d) || a.h.localeCompare(b.h));

  // ---------- travail à faire ----------
  const taf = [];
  for (const a of raw.assignments || []) {
    const s = subjKey(a.subject); const due = parisDate(a.deadline);
    const r = a.resourceID && resById[a.resourceID];
    const w = { id: a.id, due, s, sn: a.subject, g: r ? frDay(parisDate(r.start)) : "", st: a.done ? "Fait" : "Non Fait", done: !!a.done, x: htmlToText(a.description), a: [], pj: [], f: a.attachments.map((x) => fref(x, a.subject, due)), id: sid("t", due, s, a.description) };
    if (firstSeen("taf", w.id, due) && due >= today) ev.push({ type: "taf", s, due, text: w.x });
    w.nv = isNew("taf", a.id);
    taf.push(w);
  }
  taf.sort((a, b) => a.due.localeCompare(b.due));

  // ---------- devoirs (liste « Aujourd'hui ») ----------
  const baseDev = base.DEVOIRS || [];
  const devoirs = taf.filter((w) => w.due >= addDays(today, -7)).map((w) => {
    const same = baseDev.filter((d) => d.due === w.due && d.subj === w.s);
    const twins = taf.filter((o) => o.due === w.due && o.s === w.s);
    const cur = same.length === 1 && twins.length === 1 ? same[0] : null;
    const go = [];
    for (const f of w.f) { if (f.k) go.push(`file:${f.k}|${f.n}`); else if (f.u) go.push(`href:${f.u}|${f.n}`); }
    if (cur) for (const g of cur.go || []) if (!go.includes(g)) go.push(g);
    if (base.FICHES && base.FICHES[w.s] && !go.includes("fiche:" + w.s)) go.push("fiche:" + w.s);
    return { id: w.id, due: w.due, subj: w.s, text: cur ? cur.text : cut(w.x, 260) || "(voir Pronote)", go, done: w.done };
  });

  // ---------- notes ----------
  const pts = (v) => (v && v.kind === 0 && typeof v.points === "number" ? v.points : null);
  const notes = [];
  for (const g of raw.grades || []) {
    const s = subjKey(g.subject); const v = pts(g.value), o = pts(g.outOf);
    if (firstSeen("grade", sid("g", parisDate(g.date), s, g.comment, JSON.stringify(g.value), JSON.stringify(g.outOf)), parisDate(g.date))) ev.push({ type: "grade", s, v, o, avg: pts(g.average), t: g.comment });
    if (v == null || !o) continue;
    notes.push([parisDate(g.date), s, g.comment || "Évaluation", v, o, pts(g.average)]);
  }
  notes.sort((a, b) => b[0].localeCompare(a[0]));
  const averages = {};
  for (const a of raw.averages || []) {
    const s = subjKey(a.subject); const o = pts(a.outOf) || 20; const st = pts(a.student), cl = pts(a.classAverage);
    if (st != null) averages[s] = { e: +(st / o * 20).toFixed(2), c: cl != null ? +(cl / o * 20).toFixed(2) : null };
  }
  const overall = raw.overall && pts(raw.overall.student) != null ? { e: pts(raw.overall.student), c: pts(raw.overall.classAverage), p: raw.overall.period } : null;

  // ---------- vacances ----------
  const holidays = (raw.holidays || []).map((h) => ({ n: h.name, start: parisDate(h.start), end: parisDate(h.end) }));
  const inHoliday = (d) => holidays.some((h) => d >= h.start && d <= h.end);

  // ---------- changements d'emploi du temps ----------
  const changes = [];
  for (const l of raw.lessons || []) {
    const d = parisDate(l.start);
    if (d < today || d > addDays(today, 14) || !(l.canceled || l.status)) continue;
    const s = subjKey(l.subject);
    const label = l.status || (l.canceled ? "Cours annulé" : "Changement");
    const id = sid("e", l.start, l.subject, label);
    const c = { id, date: d, s, sn: l.subject, h: `${hm(l.start)}–${hm(l.end)}`, label, canceled: !!l.canceled };
    if (firstSeen("change", id, d)) ev.push({ type: "change", ...c });
    changes.push(c);
  }
  changes.sort((a, b) => (a.date + a.h).localeCompare(b.date + b.h));

  // ---------- informations du collège ----------
  const news = (raw.news || []).filter((n) => n.date && parisDate(n.date) >= addDays(today, -45)).map((n) => {
    const x = { id: n.id, d: parisDate(n.date), t: n.title || "Information", a: n.author || "", cat: n.category || "", x: cut(htmlToText(n.content), 1500), f: (n.attachments || []).map((a) => fref(a, "", parisDate(n.date))) };
    x.id = sid("n", x.d, x.t, x.a);
    if (firstSeen("news", x.id, x.d)) ev.push({ type: "news", t: x.t, a: x.a });
    return x;
  }).sort((a, b) => b.d.localeCompare(a.d));

  // ---------- contrôles annoncés (boss automatiques) ----------
  const cand = {};
  const addCand = (s, date, o) => {
    if (date < addDays(today, -1)) return;
    const k = `${date}:${s}`; const c = (cand[k] = cand[k] || { s, date, srcs: [], know: "", title: "", when: "", files: [] });
    c.srcs.push(o.src); if (o.title && !c.title) c.title = o.title; if (o.know && o.know.length > c.know.length) c.know = o.know;
    if (o.when && !c.when) c.when = o.when; if (o.files) c.files.push(...o.files);
  };
  for (const l of raw.lessons || []) if (l.test && !l.canceled) addCand(subjKey(l.subject), parisDate(l.start), { src: "edt", when: `${hm(l.start)}–${hm(l.end)}`, title: "Contrôle" });
  for (const e of cdt) if (EVAL_CATS[e.cat]) addCand(e.s, e.d, { src: "cdt", title: e.c || EVAL_CATS[e.cat], know: cut([e.t, e.x].filter(Boolean).join(" : "), 260), files: e.f });
  for (const w of taf) {
    if (!EVAL_RE.test(w.x)) continue;
    const when = evalDateIn(w.x, w.due, today);
    if (when) addCand(w.s, when, { src: "taf", title: evalLabel(w.x), know: cut(w.x, 260), files: w.f });
    else if (STRONG_RE.test(w.x) && !NOT_EVAL_RE.test(w.x)) addCand(w.s, w.due, { src: "taf", title: evalLabel(w.x), know: cut(w.x, 260), files: w.f });
  }

  const curated = base.BOSSES || [];
  const bosses = [];
  for (const c of Object.values(cand)) {
    const near = curated.find((b) => b.subj === c.s && b.date && Math.abs(dayDiff(b.date, c.date)) <= (c.srcs.includes("edt") ? 2 : 7));
    if (near) continue; // déjà prévu à la main dans le QG
    const hidden = curated.find((b) => b.subj === c.s && !b.date && c.date >= today && dayDiff(today, c.date) <= 30);
    const ready = addDays(c.date, -2);
    if (hidden) { bosses.push({ id: hidden.id, date: c.date, ready, when: c.when || hidden.when || "", hidden: false }); continue; }
    const name = subjName(base, c.s);
    const go = [];
    if (base.FICHES && base.FICHES[c.s]) go.push("fiche:" + c.s);
    go.push("cdt:" + c.s);
    if (base.CARDS && base.CARDS[c.s]) go.push("cartes:" + c.s);
    if (base.EX && base.EX[c.s] && base.EX[c.s].length) go.push(`ex:${c.s}:0`);
    for (const f of c.files) if (f.k) go.push(`file:${f.k}|${f.n}`);
    const b = { id: `auto-${c.date}-${c.s}`, subj: c.s, title: `${c.title || "Contrôle"} de ${name}`, date: c.date, ready, when: c.when, know: c.know || `Revois le cahier de textes de ${name} depuis le dernier contrôle, puis la fiche et les cartes.`, go, auto: true, src: c.srcs };
    if (firstSeen("boss", b.id, c.date) && c.date >= today) ev.push({ type: "boss", s: c.s, title: b.title, date: c.date, ready });
    bosses.push(b);
  }

  // ---------- plan de révision automatique ----------
  const allBoss = [...curated.map((b) => ({ ...b, ...(bosses.find((x) => x.id === b.id) || {}) })), ...bosses.filter((b) => b.auto)].filter((b) => b.date);
  const curatedDays = new Set((base.MISSIONS || []).map((m) => m.date));
  const avgList = Object.entries(averages).filter(([s, a]) => base.SUBJ[s] && a.c != null).sort((a, b) => (a[1].e - a[1].c) - (b[1].e - b[1].c));
  const weak = (avgList[0] && avgList[0][0]) || "maths";
  const missions = [], revs = [];
  for (let i = 0; i <= 21; i++) {
    const d = addDays(today, i);
    if (inHoliday(d)) continue;
    const up = allBoss.filter((b) => b.date >= d && dayDiff(d, b.date) <= 7).sort((a, b) => a.date.localeCompare(b.date));
    const auto = !curatedDays.has(d) && weekday(d) !== 6;
    let chosen = null;
    if (auto) {
      const nb = up[0];
      if (nb) {
        chosen = nb; const k = dayDiff(d, nb.date); const n = subjName(base, nb.subj);
        const go = (nb.go || []).slice(0, 5);
        const m = { date: d, subj: nb.subj, xp: 10, go, auto: true, where: `Cahier de textes de ${n}, la fiche et les cartes mémoire` };
        if (k === 0) Object.assign(m, { title: `Jour J : ${nb.title}. Relis ta fiche 10 min, puis repose-toi`, boss: nb.id });
        else if (k === 1) Object.assign(m, { title: `Dernière révision (${nb.title}) : relis la fiche et refais 2 exercices` });
        else if (k === 2) Object.assign(m, { title: `Test blanc (${nb.title}) : sans le cours, en temps limité, puis corrige`, ready: nb.id, xp: 20 });
        else if (k <= 4) Object.assign(m, { title: `Je m'entraîne (${nb.title}) : exercices et cartes mémoire` });
        else Object.assign(m, { title: `Je découvre : relis le cours de ${n} et la fiche (${nb.title} dans ${k} jours)` });
        missions.push(m);
      } else {
        const tomorrow = taf.filter((w) => w.due === addDays(d, 1) && !w.done);
        const s = tomorrow[0] ? tomorrow[0].s : weak; const wn = subjName(base, weak);
        missions.push({ date: d, subj: s, xp: 10, auto: true, title: weekday(d) === 0 ? `Je prépare ma semaine : devoirs de lundi, puis 15 min de cartes en ${wn}` : `Devoirs pour demain, puis 15 min de cartes mémoire en ${wn}`, where: "La liste des devoirs (onglet Aujourd'hui), puis l'onglet Cartes", go: [base.CARDS && base.CARDS[weak] ? "cartes:" + weak : "fiche:" + weak] });
      }
    }
    for (const b of up) {
      if (b === chosen || !b.auto) continue;
      const k = dayDiff(d, b.date); if (k < 1 || k > 5) continue;
      const hint = k === 1 ? "relecture de la fiche" : k === 2 ? "test blanc rapide" : "exercices + cartes";
      revs.push({ date: d, id: `rev:${d}:${b.id}`, subj: b.subj, t: `Préparer : ${b.title} (J-${k}), ${hint}`, go: (b.go || []).slice(0, 4) });
    }
  }

  seen.ok = true;
  return {
    content: {
      v: 2, student: raw.student, holidays, yearStart: raw.yearStart && parisDate(raw.yearStart),
      devoirs, cdtFull: { cdt, taf }, notes, averages, overall, bosses, missions, revs, changes, news,
    },
    events: ev,
  };
}

// Les identifiants Pronote changent à chaque connexion : on fabrique des identifiants stables.
export const attKey = (a, subject, date) => `${nfc(a.name)}|${subj(subject)}|${date || ""}`;
const subj = (x) => String(x || "").normalize("NFC").trim().toUpperCase();
function sid(...parts) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57; const str = parts.map((x) => String(x ?? "")).join("\u0001");
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return parts[0] + (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}
