// Robot du QG : lit Pronote, prépare les données chiffrées du site et envoie les notifications.
// Lancé par GitHub Actions (voir .github/workflows/qg.yml). Lecture seule sur Pronote.
import fs from "node:fs";
import path from "node:path";
import { execSync, execFileSync } from "node:child_process";
import webpush from "web-push";
import { deriveKeys, sealJSON, unsealJSON, seal, shortHash } from "./lib/crypto.mjs";
import { transform, attKey } from "./lib/transform.mjs";
import { buildMessages, dailyMessages, send } from "./lib/notify.mjs";
import { pull, apply } from "./lib/ntfy.mjs";
import { nfc, parisDate, addDays } from "./lib/text.mjs";

const env = process.env;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const STATE_DIR = path.resolve(env.QG_STATE_DIR || path.join(ROOT, "state"));
const SITE_SRC = path.resolve(env.QG_SITE_SRC || path.join(ROOT, "site"));
const OUT = path.resolve(env.QG_OUT || path.join(ROOT, "_site"));
const NTFY = env.QG_NTFY || "https://ntfy.sh";
const NOW = env.QG_NOW ? new Date(env.QG_NOW) : new Date();
const log = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);
const P = await import(env.QG_PRONOTE_MOCK ? path.resolve(env.QG_PRONOTE_MOCK) : "./lib/pronote.mjs");

const keys = await deriveKeys(env.QG_KEY);
fs.mkdirSync(path.join(STATE_DIR, "files"), { recursive: true });

// ---------- état du robot (chiffré, branche « state ») ----------
const stateFile = path.join(STATE_DIR, "state.enc");
let state = fs.existsSync(stateFile) ? await unsealJSON(keys.data, fs.readFileSync(stateFile)) : {};
state.deviceUUID ||= globalThis.crypto.randomUUID();
state.files ||= {}; state.seen ||= {}; state.sent ||= {};
if (!state.vapid) { state.vapid = webpush.generateVAPIDKeys(); log("Clés de notification créées"); }
const repo = env.GITHUB_REPOSITORY || "";
state.vapidSubject = repo ? `https://${repo.split("/")[0].toLowerCase()}.github.io` : "https://github.com";

async function saveState() {
  fs.writeFileSync(stateFile, await sealJSON(keys.data, state));
  if (env.QG_SAVE_CMD) { try { execSync(env.QG_SAVE_CMD, { stdio: "inherit" }); } catch (e) { log("⚠ sauvegarde de l'état impossible : " + e.message); } }
}

// ---------- base du QG (fiches, missions, boss préparés à la main) ----------
const base = await unsealJSON(keys.data, fs.readFileSync(path.join(SITE_SRC, "data", "base.enc")));
const NAME = base.NAME || "L'élève";

// ---------- boîte aux lettres (abonnements, progrès, demande QR) ----------
const box = await pull({ server: NTFY, topic: keys.topic, since: state.ntfySince || "all", key: keys.data, log });
const qrReq = apply(box.msgs, state, Date.now());
state.ntfySince = box.last || state.ntfySince;
log(`Boîte aux lettres : ${box.msgs.length} message(s), ${state.subs.length} appareil(s) abonné(s)`);

// ---------- diagnostic d'accès à Pronote (sans identifiant, rien de personnel dans le journal) ----------
async function diagPronote(base, label) {
  try {
    const b = String(base || "").replace(/\/[^/]*$/, "");
    for (const kind of ["eleve", "parent"]) {
      const u = new URL(`${b}/mobile.${kind}.html`); u.searchParams.set("fd", "1"); u.searchParams.set("login", "true");
      const r = await fetch(u, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 PRONOTE Mobile APP Version/2.0.11", Cookie: "appliMobile=1" } });
      const t = r.status >= 300 && r.status < 400 ? "" : await r.text();
      const loc = r.headers.get("location"); let lh = ""; try { lh = loc ? new URL(loc, u).host + new URL(loc, u).pathname : ""; } catch {}
      log(`Diagnostic ${label} ${kind} : HTTP ${r.status}${lh ? " -> " + lh : ""}, ${t.length} car., version ${/>PRONOTE \d+\.\d+\.\d+/.test(t) ? "ok" : "absente"}, Start ${t.includes("Start (") ? "ok" : "absent"}${/IP/.test(t) && /suspendue|bloqu|refus/i.test(t) ? ", IP refusée" : ""}${/n'est pas disponible|indisponible/i.test(t) ? ", site indisponible" : ""} ; titre « ${(t.match(/<title>([^<]{0,90})/) || [])[1] || ""} »`);
    }
  } catch (e) { log(`Diagnostic ${label} : ${e.message}`); }
}
// ---------- Pronote ----------
let session = null, raw = null, syncErr = "", needsQr = false;
try {
  if (!qrReq && !state.refresh) throw Object.assign(new Error("Pronote n'est pas encore connecté : fais l'étape « Connecter Pronote » dans les Réglages du QG."), { setup: true });
  const c = await P.connect({ deviceUUID: state.deviceUUID, refresh: qrReq ? null : state.refresh, qr: qrReq && qrReq.qr, pin: qrReq && qrReq.pin, preferName: NAME, log });
  session = c.session; state.refresh = c.refresh; state.needsQr = false; state.authFails = 0;
  if (qrReq) { state.lastQr = qrReq.id; log("Connexion par QR code réussie : le jeton est enregistré."); }
  await saveState(); // le jeton change à chaque connexion : on l'enregistre tout de suite
} catch (e) {
  syncErr = e.message || String(e);
  if (e.setup) { log(syncErr); await diagPronote(base.PRONOTE, "adresse du QG"); }
  else {
    log("⚠ Connexion Pronote : " + (e.stack || e));
    await diagPronote(base.PRONOTE, "adresse du QG");
    if (qrReq && qrReq.qr && qrReq.qr.url) { const q = String(qrReq.qr.url); log(`QR code : adresse ${q.replace(/^https?:\/\//, "").replace(/\?.*$/, "")}`); await diagPronote(q, "adresse du QR code"); }
    if (qrReq) { state.lastQr = qrReq.id; needsQr = !state.refresh; syncErr = "La connexion par QR code a échoué (code PIN faux ou QR code expiré). Recommence l'étape « Connecter Pronote ». Détail : " + syncErr; }
    else if (P.isAuthError(e)) { state.authFails = (state.authFails || 0) + 1; if (state.authFails >= 2) { needsQr = true; state.needsQr = true; } }
  }
}
if (session) {
  try {
    const y = NOW.getMonth() >= 7 ? NOW.getFullYear() : NOW.getFullYear() - 1;
    raw = await P.fetchAll(session, { from: new Date(Date.UTC(y, 7, 20)), to: new Date(+NOW + 42 * 864e5), ttFrom: new Date(+NOW - 864e5), ttTo: new Date(+NOW + 15 * 864e5), log });
    log(`Pronote : ${raw.assignments.length} devoirs, ${raw.resources.length} séances, ${raw.grades.length} notes, ${raw.lessons.length} cours, ${raw.news.length} infos`);
    if (raw.errors.length) syncErr = "Partiel : " + raw.errors.join(" ; ");
  } catch (e) { raw = null; syncErr = "Lecture de Pronote impossible : " + (e.message || e); log("⚠ " + (e.stack || e)); }
}

// ---------- pièces jointes ----------
const OFFICE = /\.(docx?|odt|rtf|pptx?|odp|xlsx?|ods)$/i;
let sofficeReady = null;
function soffice() {
  if (sofficeReady !== null) return sofficeReady;
  const find = () => { try { return execSync("command -v soffice || command -v libreoffice", { encoding: "utf8" }).trim().split("\n")[0]; } catch { return ""; } };
  let bin = find();
  if (!bin && env.CI) { try { log("Installation de LibreOffice pour convertir les .docx en PDF…"); execSync("sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends libreoffice-writer libreoffice-impress libreoffice-calc >/dev/null", { stdio: "inherit", timeout: 600e3 }); bin = find(); } catch (e) { log("⚠ LibreOffice indisponible"); } }
  return (sofficeReady = bin);
}
function toPdf(buf, name) {
  const bin = soffice(); if (!bin) return null;
  const dir = fs.mkdtempSync("/tmp/qgconv-"); const src = path.join(dir, "doc" + path.extname(name).toLowerCase());
  fs.writeFileSync(src, buf);
  try { execFileSync(bin, ["--headless", "--convert-to", "pdf", "--outdir", dir, src], { stdio: "ignore", timeout: 120e3 }); return fs.readFileSync(path.join(dir, "doc.pdf")); }
  catch { return null; } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
if (raw && session) {
  const all = [];
  for (const a of raw.assignments) for (const x of a.attachments) all.push([x, a.subject]);
  for (const r of raw.resources) for (const c of r.contents) for (const x of c.files) all.push([x, r.subject]);
  for (const n of raw.news) for (const x of n.attachments || []) all.push([x, ""]);
  for (const g of raw.grades) for (const x of [g.correction, g.subjectFile]) if (x) all.push([x, g.subject]);
  let got = 0, bytes = 0, failed = 0;
  for (const [a, subj] of all) {
    if (a.kind !== "file") continue;
    const ak = attKey(a); if (state.files[ak]) continue;
    if (got >= 120 || bytes > 250e6) break; // le reste au prochain passage
    try {
      let buf = await P.download(session, a); let n = nfc(a.name), ext = (path.extname(n).slice(1) || "bin").toLowerCase(), conv = false;
      if (OFFICE.test(n)) { const pdf = toPdf(buf, n); if (pdf) { buf = pdf; ext = "pdf"; conv = true; } }
      const k = await shortHash(ak, 20);
      fs.writeFileSync(path.join(STATE_DIR, "files", k + ".enc"), await seal(keys.data, buf));
      state.files[ak] = { k, n, ext, size: buf.length, conv, s: subj, at: +NOW };
      got++; bytes += buf.length;
    } catch (e) { failed++; log(`⚠ une pièce jointe n'a pas pu être téléchargée : ${e.message}`); }
  }
  log(`Pièces jointes : ${got} nouvelle(s), ${failed} en échec, ${Object.keys(state.files).length} au total`);
}

// ---------- contenu du QG ----------
let content, events = [];
if (raw) {
  const r = transform(raw, base, state.files, state.seen, NOW);
  content = { ...r.content, updatedAt: NOW.toISOString() }; events = r.events;
  state.lastContent = content;
} else content = state.lastContent || { v: 2 };
const fileNames = {};
for (const f of Object.values(state.files)) fileNames[f.n] = f.k;
content = {
  ...content,
  files: Object.fromEntries(Object.values(state.files).map((f) => [f.k, { n: f.n, e: f.ext, z: f.size, c: f.conv ? 1 : 0 }])),
  fileNames,
  vapid: state.vapid.publicKey,
  progress: state.progress || null,
  sync: { at: +NOW, ok: !!raw, error: syncErr, needsQr: needsQr || !!state.needsQr, connected: !!state.refresh, lastOk: raw ? +NOW : (state.lastOk || null), subs: state.subs.map((s) => ({ role: s.role, dev: s.dev, at: s.at })) },
};
if (raw) state.lastOk = +NOW;

// ---------- notifications ----------
const dry = env.QG_PUSH_DRY ? [] : null;
const msgs = [...buildMessages(events, base, NAME), ...dailyMessages({ now: NOW, state, content, base, name: NAME })];
if (needsQr && !state.sent["qr-" + parisDate(NOW)]) {
  state.sent["qr-" + parisDate(NOW)] = 1;
  msgs.push({ to: ["parent"], tag: "pronote", title: "Le QG doit être reconnecté à Pronote", body: "Ouvre le QG > Réglages > Connecter Pronote (1 minute avec le QR code).", url: "#reglages" });
}
const r = await send(msgs, state, { log, dry });
log(`Notifications : ${msgs.length} préparée(s), ${r.sent} envoyée(s)`);
if (dry) fs.writeFileSync(path.join(OUT + "-push.json"), JSON.stringify(dry, null, 1));

// ---------- site publié ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(SITE_SRC, OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, "data", "files"), { recursive: true });
const live = new Set(Object.values(state.files).map((f) => f.k));
for (const f of fs.readdirSync(path.join(STATE_DIR, "files"))) {
  if (!live.has(f.replace(/\.enc$/, ""))) continue;
  fs.copyFileSync(path.join(STATE_DIR, "files", f), path.join(OUT, "data", "files", f));
}
fs.writeFileSync(path.join(OUT, "data", "latest.enc"), await sealJSON(keys.data, content));
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
await saveState();
log(raw ? "Synchro terminée." : "Site publié sans nouvelles données Pronote : " + syncErr);
