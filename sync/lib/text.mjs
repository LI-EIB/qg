import { decode } from "html-entities";

const strip = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

// Matières Pronote -> clés du QG
const EXACT = {
  "ARTS PLASTIQUES": "arts", "CHINOIS LV2": "chinois", "EDUCATION MUSICALE": "musique",
  "FRANCAIS": "francais", "HISTOIRE - SI": "hsi", "HISTOIRE ET GEOGRAPHIE EN FRANCAIS": "hg",
  "LANGUE & LITTERATURE BRITANNIQUE": "anglais", "MATHEMATIQUES": "maths", "PHYSIQUE-CHIMIE": "pc",
  "SVT": "svt", "TECHNOLOGIE": "techno", "EDUCATION PHYSIQUE ET SPORTIVE": "eps",
};
const RULES = [
  [/\bEPS\b|SPORT|EDUCATION PHYSIQUE/, "eps"],
  [/HISTOIRE\s*-\s*SI|\bHSI\b|SECTION INTERNATIONALE/, "hsi"],
  [/MATH/, "maths"], [/FRANC/, "francais"], [/BRITANN|ANGLAIS|ENGLISH|\bLLB\b|LITT/, "anglais"],
  [/HIST|GEOG/, "hg"], [/\bSVT\b|SCIENCES DE LA VIE|VIE ET DE LA TERRE/, "svt"], [/PHYS|CHIMIE/, "pc"],
  [/TECHNO/, "techno"], [/CHINOIS|MANDARIN/, "chinois"], [/MUSI/, "musique"], [/ARTS? PLAST|\bARTS\b/, "arts"],
  [/\bEPS\b|SPORT|EDUCATION PHYSIQUE/, "eps"],
];
export function subjKey(name) {
  const n = strip(name).trim();
  if (EXACT[n]) return EXACT[n];
  for (const [re, k] of RULES) if (re.test(n)) return k;
  return "autre";
}

// HTML Pronote -> texte lisible (liens gardés en clair pour être cliquables dans le QG)
export function htmlToText(html) {
  let s = String(html || "");
  s = s.replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    const l = label.replace(/<[^>]+>/g, "").trim();
    const h = decode(href);
    return !l || l === h || decode(l) === h ? h : `${l} (${h})`;
  });
  s = s.replace(/<li\b[^>]*>/gi, "\n- ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|ul|ol|h\d|tr)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decode(s).replace(/ /g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ");
  return s.trim();
}

export const nfc = (s) => String(s || "").normalize("NFC").trim();

const pad = (n) => String(n).padStart(2, "0");
// Dates en heure de Paris (les runners GitHub sont en UTC)
export function parisParts(d) {
  const f = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
  const o = Object.fromEntries(f.formatToParts(new Date(d)).map((p) => [p.type, p.value]));
  return { date: `${o.year}-${o.month}-${o.day}`, h: +o.hour, m: +o.minute, hm: `${o.hour}h${o.minute}` };
}
export const parisDate = (d) => parisParts(d).date;
export const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const dayDiff = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5);
export const weekday = (iso) => new Date(iso + "T12:00:00Z").getUTCDay();
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const frShort = (iso) => `${JOURS[weekday(iso)]} ${pad(+iso.slice(8, 10))} ${MOIS[+iso.slice(5, 7) - 1]}`;
export const frDay = (iso) => `${["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][weekday(iso)]} ${+iso.slice(8, 10)}`;
export const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };
