// Accès Pronote en LECTURE SEULE via la bibliothèque pawnote.
// Rien n'est jamais envoyé ni modifié sur Pronote (pas de « fait », pas de message).
// @ts-check
import * as pronote from "@blockshub/pawnote-lts"; // pawnote maintenu pour PRONOTE 2026
import forge from "node-forge";

/** Vérifie le code PIN avant de contacter Pronote (même déchiffrement que l'appli Pronote). */
export function checkQrPin(qr, pin) {
  const dec = (hex) => {
    const key = forge.md.md5.create().update(forge.util.createBuffer(String(pin)).bytes()).digest();
    const iv = forge.util.createBuffer().fillWithByte(0, 16);
    const d = forge.cipher.createDecipher("AES-CBC", key); d.start({ iv }); d.update(forge.util.createBuffer(forge.util.binary.hex.decode(String(hex))));
    return d.finish() ? d.output.bytes() : null;
  };
  const u = dec(qr.login), t = dec(qr.jeton);
  return !!(u && t && /^[\x20-\x7e]{2,}$/.test(u) && t.length >= 8);
}

const iso = (d) => (d instanceof Date && !isNaN(+d) ? d.toISOString() : null);

/** Erreurs qui veulent dire « il faut refaire la connexion par QR code ». */
export function isAuthError(e) {
  const n = (e && (e.name || e.constructor?.name)) || "";
  return /BadCredentials|Authenticate|AccountDisabled|AccessDenied|Security/.test(n) || /identifiant|mot de passe|jeton|token/i.test(String(e && e.message));
}

/**
 * @param {{ deviceUUID: string, refresh?: any, qr?: any, pin?: string, preferName?: string, log: (s:string)=>void }} o
 */
export async function connect(o) {
  const session = pronote.createSessionHandle();
  /** @type {import("@blockshub/pawnote-lts").RefreshInformation} */
  let refresh;
  if (o.qr && o.pin) {
    o.log("Connexion à Pronote avec le QR code…");
    if (!checkQrPin(o.qr, o.pin)) throw Object.assign(new Error("Le code à 4 chiffres ne correspond pas à ce QR code"), { name: "BadCredentialsError", pin: true });
    o.log("Code PIN vérifié : il correspond bien au QR code.");
    refresh = await pronote.loginQrCode(session, { deviceUUID: o.deviceUUID, pin: String(o.pin), qr: o.qr });
  } else if (o.refresh) {
    o.log("Connexion à Pronote avec le jeton enregistré…");
    refresh = await pronote.loginToken(session, {
      url: o.refresh.url, kind: o.refresh.kind, username: o.refresh.username, token: o.refresh.token,
      deviceUUID: o.deviceUUID, navigatorIdentifier: o.refresh.navigatorIdentifier,
    });
  } else throw new Error("Pas encore de connexion Pronote");
  // Compte parent avec plusieurs enfants : on prend l'enfant dont le prénom correspond
  if (o.preferName && session.user.resources.length > 1) {
    const i = session.user.resources.findIndex((r) => r.name.toLowerCase().includes(o.preferName.toLowerCase()));
    if (i >= 0) pronote.use(session, i);
  }
  return { session, refresh: { url: refresh.url, kind: refresh.kind, username: refresh.username, token: refresh.token, navigatorIdentifier: refresh.navigatorIdentifier } };
}

const att = (a) => ({ id: a.id, kind: a.kind === pronote.AttachmentKind.Link ? "link" : "file", name: a.name, url: a.url });

/**
 * Tout ce qui est utile au QG, en données simples (JSON).
 * @param {import("@blockshub/pawnote-lts").SessionHandle} session
 * @param {{ from: Date, to: Date, ttFrom: Date, ttTo: Date, log: (s:string)=>void }} r
 */
export async function fetchAll(session, r) {
  const res = session.userResource;
  const has = (t) => res.tabs.has(t);
  // Pronote refuse les dates hors de l'année scolaire
  const lo = session.instance.firstDate, hi = session.instance.lastDate;
  const clamp = (d) => new Date(Math.min(Math.max(+d, +lo), +hi));
  r = { ...r, from: clamp(r.from), to: clamp(r.to), ttFrom: clamp(r.ttFrom), ttTo: clamp(r.ttTo) };
  const errors = [];
  const step = async (name, fn) => { try { return await fn(); } catch (e) { errors.push(`${name} : ${e && e.message || e}`); r.log(`⚠ ${name} : ${e && e.stack || e}`); return null; } };

  const out = {
    student: { name: res.name, className: res.className || "", establishment: res.establishmentName || "", kind: session.information.accountKind },
    holidays: (session.instance.holidays || []).map((h) => ({ name: h.name, start: iso(h.startDate), end: iso(h.endDate) })),
    yearStart: iso(session.instance.firstDate), yearEnd: iso(session.instance.lastDate),
    assignments: [], resources: [], grades: [], averages: [], overall: null, lessons: [], news: [], messages: [], errors,
  };

  await step("travail à faire", async () => {
    const list = await pronote.assignmentsFromIntervals(session, r.from, r.to);
    out.assignments = list.map((a) => ({
      id: a.id, subject: a.subject.name, description: a.description, deadline: iso(a.deadline), done: !!a.done,
      attachments: a.attachments.map(att), resourceID: a.resourceID || null, length: a.length || null,
    }));
  });

  await step("cahier de textes", async () => {
    const list = await pronote.resourcesFromIntervals(session, r.from, r.to);
    out.resources = list.map((x) => ({
      id: x.id, start: iso(x.startDate), end: iso(x.endDate), subject: x.subject.name, teachers: x.teachers || [],
      assignmentDeadline: iso(x.assignmentDeadline),
      contents: x.contents.map((c) => ({ id: c.id, title: c.title || "", description: c.description || "", category: c.category, categoryText: c.categoryText || "", files: c.files.map(att) })),
    }));
  });

  if (has(pronote.TabLocation.Grades)) await step("notes", async () => {
    const tab = res.tabs.get(pronote.TabLocation.Grades);
    const now = Date.now();
    const periods = (tab?.periods || []).filter((p) => +p.startDate <= now);
    const pick = periods.filter((p) => +p.endDate >= now);
    for (const p of (pick.length ? pick : periods.slice(-1))) {
      const g = await pronote.gradesOverview(session, p);
      for (const x of g.grades) out.grades.push({
        id: x.id, period: p.name, date: iso(x.date), subject: x.subject.name, comment: x.comment || "",
        value: x.value, outOf: x.outOf, average: x.average || null, coefficient: x.coefficient,
        correction: x.correctionFile ? att(x.correctionFile) : null, subjectFile: x.subjectFile ? att(x.subjectFile) : null,
      });
      out.averages = g.subjectsAverages.map((a) => ({ subject: a.subject.name, student: a.student || null, classAverage: a.class_average || null, outOf: a.outOf || null }));
      out.overall = { student: g.overallAverage || null, classAverage: g.classAverage || null, period: p.name };
    }
  });

  await step("emploi du temps", async () => {
    const tt = await pronote.timetableFromIntervals(session, r.ttFrom, r.ttTo);
    pronote.parseTimetable(session, tt, { withCanceledClasses: true, withPlannedClasses: true, withSuperposedCanceledClasses: false });
    out.lessons = tt.classes.filter((c) => c.is === "lesson").map((c) => {
      const l = /** @type {import("@blockshub/pawnote-lts").TimetableClassLesson} */ (c);
      return { id: l.id, start: iso(l.startDate), end: iso(l.endDate), subject: l.subject ? l.subject.name : "", canceled: !!l.canceled, status: l.status || "", test: !!l.test, exempted: !!l.exempted, teachers: l.teacherNames || [], rooms: l.classrooms || [] };
    });
  });

  await step("informations", async () => {
    const n = await pronote.news(session);
    // Schéma (noms de champs et types seulement, aucune donnée) pour adapter la lecture si Pronote change
    const shape = (v, d = 0) => v == null ? null : Array.isArray(v) ? (d > 4 ? "[…]" : [v.length, v[0] === undefined ? null : shape(v[0], d + 1)]) : typeof v === "object" ? (d > 4 ? "{…}" : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x, d + 1)]))) : typeof v === "string" ? "str" + v.length : typeof v;
    const sample = n.items.filter(Boolean).find((x) => x.is === "information" && !String(x.content || "").trim());
    const raw_ = sample && /** @type {any} */ (sample)._raw;
    if (raw_) r.log("Schéma d'une information sans texte : " + JSON.stringify(shape(raw_)).slice(0, 3500));
    out.news = n.items.filter(Boolean).map((x) => ({
      id: x.id, is: x.is, title: x.title || "", author: x.author || "", date: iso(x.startDate || x.creationDate), category: x.category ? x.category.name : "",
      content: x.is === "information" ? x.content : x.questions.map((q) => q.content).join("\n"),
      attachments: x.is === "information" ? x.attachments.map(att) : [],
    }));
  });

  // Messages des profs (Discussions) : lus sans les marquer comme lus, pour leurs documents joints
  await step("messages", async () => {
    const ds = await pronote.discussions(session);
    const since = Date.now() - 150 * 864e5;
    const list = ds.items.filter((d) => +d.date >= since && d.numberOfMessages > 0).sort((a, b) => +b.date - +a.date).slice(0, 40);
    for (const d of list) {
      const m = await pronote.discussionMessages(session, d, false);
      for (const msg of m.sents) {
        if (!msg.author) continue; // message envoyé par l'élève elle-même
        out.messages.push({ id: msg.id, subject: d.subject || "", date: iso(msg.creationDate), author: msg.author.name || "", content: msg.content || "", attachments: (msg.files || []).map(att) });
      }
    }
  });

  return out;
}

/** Téléchargement d'une pièce jointe pendant que la session est ouverte. */
export async function download(session, a, maxBytes = 40e6) {
  const res = await fetch(a.url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error("fichier trop gros");
  return buf;
}
