// Correctif pawnote pour PRONOTE 2026 : la page de démarrage s'écrit maintenant
// « Start ({...}) ; } catch » au lieu de « Start ({...})} catch ».
import fs from "node:fs";
const files = ["node_modules/pawnote/dist/index.mjs", "node_modules/pawnote/dist/index.js"];
const OLD = '")}catch"', NEW = '")"+(e.includes(");}catch")?";":"")+"}catch"';
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, "utf8");
  if (s.includes(NEW)) { console.log("pawnote déjà corrigé :", f); continue; }
  if (s.split(OLD).length !== 2) throw new Error("Correctif pawnote impossible (version inattendue) : " + f);
  fs.writeFileSync(f, s.replace(OLD, NEW)); console.log("pawnote corrigé :", f);
}
