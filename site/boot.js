/* Le QG : démarrage. Déverrouille les données chiffrées avec le code familial, puis lance l'appli.
   Format identique à sync/lib/crypto.mjs (AES-256-GCM, clé dérivée HKDF, contenu gzip). */
(function(){
"use strict";
const LS={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const te=new TextEncoder();
const b64d=s=>{s=String(s).trim().replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;};
const b64e=u=>{let s="";for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");};
const pipe=async(u,t)=>new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(t)).arrayBuffer());
async function derive(code){
  const raw=b64d(code); if(raw.length!==32) throw new Error("bad");
  const ikm=await crypto.subtle.importKey("raw",raw,"HKDF",false,["deriveKey","deriveBits"]);
  const p=info=>({name:"HKDF",hash:"SHA-256",salt:te.encode("qg-v1"),info:te.encode(info)});
  const data=await crypto.subtle.deriveKey(p("data"),ikm,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  const tb=new Uint8Array(await crypto.subtle.deriveBits(p("topic"),ikm,128));
  return {data,topic:"qg"+Array.from(tb,b=>b.toString(16).padStart(2,"0")).join("")};
}
async function unseal(key,buf){const b=new Uint8Array(buf); if(b[0]!==0x51||b[1]!==0x47||b[2]!==0x31) throw new Error("format");
  return new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv:b.slice(3,15)},key,b.slice(15)));}
async function seal(key,bytes){const iv=crypto.getRandomValues(new Uint8Array(12)); const ct=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,bytes));
  const o=new Uint8Array(15+ct.length); o.set([0x51,0x47,0x31]); o.set(iv,3); o.set(ct,15); return o;}
const fromJSON=async u=>JSON.parse(new TextDecoder().decode(await pipe(u,new DecompressionStream("gzip"))));

const QG=window.QG={LS,b64d,b64e,role:LS.get("qg-role")==="parent"?"parent":"lehna",ntfy:"https://ntfy.sh"};
QG.fetchEnc=async(path,fresh)=>{const r=await fetch(path,{cache:fresh?"no-cache":"default"}); if(!r.ok) throw Object.assign(new Error("HTTP "+r.status),{status:r.status}); return unseal(QG.keys.data,await r.arrayBuffer());};
QG.json=async(path,fresh)=>fromJSON(await QG.fetchEnc(path,fresh));
QG.file=k=>QG.fetchEnc("data/files/"+encodeURIComponent(k)+".enc");
/* Boîte aux lettres chiffrée vers le robot (abonnements, progrès, connexion QR) */
QG.post=async(obj,keepalive)=>{
  const gz=await pipe(te.encode(JSON.stringify(obj)),new CompressionStream("gzip"));
  const body=b64e(await seal(QG.keys.data,gz));
  const r=await fetch(QG.ntfy+"/"+QG.keys.topic,{method:"POST",body,keepalive:!!keepalive&&body.length<60000});
  if(!r.ok) throw new Error("HTTP "+r.status); return true;
};
QG.repo=()=>{const h=location.hostname, seg=location.pathname.split("/").filter(Boolean)[0]||"";
  return /\.github\.io$/.test(h)?{owner:h.replace(/\.github\.io$/,""),name:seg}:null;};

function shell(html){const m=document.getElementById("boot"); if(m) m.innerHTML=html;}
function askCode(err){
  shell(`<div class="card unlock"><div class="eyebrow">Le QG</div><h2>Entre le code secret du QG</h2>
   <p class="muted">Il est dans le lien d'installation (la partie après <b>#k=</b>). Il ne se tape qu'une fois sur chaque appareil.</p>
   <form id="unlockf" class="row"><input id="code" autocomplete="off" spellcheck="false" placeholder="Code à 43 caractères" aria-label="Code secret du QG" style="flex:1;min-width:0"><button class="btn" type="submit">Ouvrir</button></form>
   ${err?`<p class="warnmsg">${err}</p>`:""}</div>`);
  document.getElementById("unlockf").addEventListener("submit",e=>{e.preventDefault(); const v=document.getElementById("code").value.replace(/^.*#k=/,"").replace(/[&\s].*$/,""); start(v,true);});
}
async function start(code,typed){
  let keys; try{keys=await derive(code);}catch(e){return askCode(typed?"Ce code n'a pas le bon format.":"");}
  QG.keys=keys;
  shell(`<p class="muted" style="text-align:center;margin:40px 0">Ouverture du QG…</p>`);
  let base;
  try{base=await QG.json("data/base.enc",true);}
  catch(e){ if(e&&e.status) return shell(`<div class="card"><h2>Le QG n'est pas encore en ligne</h2><p class="muted">Le robot GitHub n'a pas encore publié les données (erreur ${e.status}). Réessaie dans quelques minutes.</p></div>`);
    LS.del("qg-key"); QG.keys=null; return askCode(typed?"Code incorrect.":"Le code enregistré ne marche plus. Entre le nouveau code."); }
  LS.set("qg-key",code);
  let latest=null; try{latest=await QG.json("data/latest.enc",true);}catch(e){}
  QG.base=base; QG.latest=latest;
  const G=["SUBJ","NOTES","CARDS","PRONOTE","MISSIONS","BOSSES","PASSED","DEVOIRS","UPDATED","EXT","FX","DOCS","CDT","FICHES","EX"];
  G.forEach(k=>{window[k]=base[k];});
  document.getElementById("boot").remove();
  document.getElementById("app").hidden=false;
  const s=document.createElement("script"); s.src="app.js?v="+(document.documentElement.dataset.v||"1"); document.body.appendChild(s);
}

/* Code et rôle passés dans le lien : #k=CODE&role=parent */
const h=location.hash.slice(1); const hp=new URLSearchParams(h.includes("k=")?h:"");
if(hp.get("role")){QG.role=hp.get("role")==="parent"?"parent":"lehna"; LS.set("qg-role",QG.role);}
const fromLink=hp.get("k");
if(fromLink) history.replaceState(null,"",location.pathname+"#aujourdhui");
const code=fromLink||LS.get("qg-key");
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
if(!window.crypto||!crypto.subtle||!window.DecompressionStream) shell(`<div class="card"><h2>Navigateur trop ancien</h2><p class="muted">Ouvre le QG avec Chrome, Edge, Firefox ou Safari à jour.</p></div>`);
else if(code) start(code,false); else askCode("");
/* lien collé dans la même page pendant l'écran de code */
window.addEventListener("hashchange",()=>{if(QG.keys) return; const q=new URLSearchParams(location.hash.slice(1)); const k=q.get("k"); if(!k) return; if(q.get("role")){QG.role=q.get("role")==="parent"?"parent":"lehna"; LS.set("qg-role",QG.role);} history.replaceState(null,"",location.pathname+"#aujourdhui"); start(k,true);});
})();
