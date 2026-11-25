// Rend la lecture des « Informations » Pronote tolérante (champs absents dans PRONOTE 2026),
// sans rien changer d'autre dans la bibliothèque. Idempotent.
import fs from "node:fs";
const MARK = "/*qg-news-patch-2*/";
for (const f of ["node_modules/@blockshub/pawnote-lts/dist/index.mjs", "node_modules/@blockshub/pawnote-lts/dist/index.js"]) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, "utf8");
  if (s.includes(MARK)) { console.log("déjà corrigé :", f); continue; }
  const a = s.indexOf("category:s.find(s=>s.id===e.categorie.V.N)"), p = s.indexOf('"PageActualites"');
  if (a < 0 || p < 0) { console.log("⚠ correctif Informations non appliqué (version inattendue) :", f); continue; }
  const start = s.lastIndexOf("=>({id:e.N,title:e.L,", a) - 10, end = p + 900;
  let w = s.slice(start, end);
  w = w.replace("e.listeModesAff[0].listeActualites.V.map(", "(e.listeModesAff?.[0]?.listeActualites?.V??[]).map(")
       .replace("e.listeQuestions.V[0]", "((e.listeQuestions?.V??[])[0]??{})")
       .replace(/content:e\.texte\.V/g, 'content:(e.texte?.V??(typeof e.texte==="string"?e.texte:""))')
       .replace(/e\.categorie\.V\.N/g, "e.categorie?.V?.N")
       .replace(/le\(e\.(\w+)\.V\)/g, "(e.$1?.V?le(e.$1.V):void 0)")
       .replace(/e\.public\.V/g, "e.public?.V")
       .replace(/e\.reponse\.V\./g, "e.reponse?.V?.")
       .replace(/(e(?:\.\w+)+)\.V\.map\(/g, "($1?.V??[]).map(")
       .replace(/if\(!e\.estSondage\)throw new \w+\("decodeNews"\);/, "if(!e.estSondage)return null;")
       .replace(/return (\w)\(e,s,t\)\}\)\}\}\)\(/, (m, fn) => `{const r_=${fn}(e,s,t);if(r_)try{Object.defineProperty(r_,"_raw",{value:e,enumerable:false})}catch(x_){};return r_}})}})(`);
  s = s.slice(0, start) + w + s.slice(end) + "\n" + MARK;
  fs.writeFileSync(f, s); console.log("Informations Pronote : lecture tolérante activée :", f);
}
