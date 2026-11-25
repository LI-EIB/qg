/* ============ ÉTAT ============ */
/* Progrès gardés sur cet ordinateur + copie chiffrée envoyée au robot (pour le suivi parent et la sauvegarde). */
const KEY="qg-lehna-v1"; const ROLE=QG.role;
let state={done:{},checks:{},cards:{},devoirs:{},srs:{},quiz:{}};
try{const s=JSON.parse(QG.LS.get(KEY)||"null"); if(s&&s.done) state={...state,...s};}catch(e){}
let LATEST=null, pushTimer=null, lastPushed=QG.LS.get("qg-pushed")||"";
function save(){
  if(ROLE==="parent") return;
  QG.LS.set(KEY,JSON.stringify(state));
  clearTimeout(pushTimer); pushTimer=setTimeout(()=>pushProgress(false),12000);
}
async function pushProgress(keep,force){
  clearTimeout(pushTimer); if(ROLE==="parent"||!QG.keys) return;
  const p={done:state.done,checks:state.checks,cards:state.cards,devoirs:state.devoirs,srs:state.srs,quiz:state.quiz}; const j=JSON.stringify(p);
  if(j===lastPushed&&!force) return;
  try{await QG.post({t:"prog",p,at:Date.now()},keep); lastPushed=j; QG.LS.set("qg-pushed",j); QG.LS.set("qg-pushday",iso(new Date()));}catch(e){}
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden") pushProgress(true);});
function setSync(t,kind){const el=document.getElementById("sync"); if(!el) return; el.textContent=t; el.style.setProperty("--sc",kind==="ok"?"var(--good)":kind==="warn"?"var(--warn)":"var(--ink-2)");}
let toastT=null;
function toast(t){let el=document.getElementById("toast"); if(!el){el=document.createElement("div");el.id="toast";el.setAttribute("role","status");document.body.appendChild(el);} el.textContent=t; el.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove("on"),3500);}
const parentOnly=()=>{toast("Mode parent : seule "+(QG.base.NAME||"l'élève")+" peut cocher ou valider.");};

/* ============ OUTILS ============ */
const sc = s => `--sc:var(--c-${s})`;
const pad=n=>String(n).padStart(2,"0");
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const TODAY=iso(new Date());
const J=["dim","lun","mar","mer","jeu","ven","sam"], JL=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const MO=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
const dObj=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);};
const fmt=s=>{const d=dObj(s);return `${J[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;};
const fmtLong=s=>{const d=dObj(s);return `${JL[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()].replace(".","")}`;};
const diff=(a,b)=>Math.round((dObj(b)-dObj(a))/864e5);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const chip=s=>`<span class="chip" style="${sc(s)}">${SUBJ[s]?SUBJ[s].n:esc(s)}</span>`;
const bossById=id=>BOSSES.find(b=>b.id===id);
const xp=()=>MISSIONS.reduce((t,m)=>t+(state.done[m.date]?m.xp:0),0)+quizRubis();
const LEVELS=[150,300,450,600];

/* ============ LIENS ============ */
const KIND={pdf:"PDF",mp3:"AUDIO",m4a:"AUDIO",wav:"AUDIO",docx:"WORD",doc:"WORD",odt:"WORD",pptx:"PPT",xlsx:"EXCEL",png:"IMAGE",jpg:"IMAGE",jpeg:"IMAGE"};
function lk(spec){
  const [main,label]=String(spec).split("|"); const p=main.split(":"); const t=p[0];
  if(t==="doc"){const d=DOCS[p[1]]; if(!d) return ""; const ext=d.e||d.f.split(".").pop();
    return `<a class="lk doc" href="#" data-doc="${p[1]}" style="${sc(d.s)}" title="${esc(d.o)}"><span class="ic">${KIND[ext]||"DOC"}</span><span>${esc(label||d.n)}</span></a>`;}
  if(t==="fiche"&&SUBJ[p[1]]) return `<a class="lk int" href="#fiches/${p[1]}" style="${sc(p[1])}"><span class="ic">FICHE</span><span>${esc(label||"Fiche "+SUBJ[p[1]].n)}</span></a>`;
  if(t==="cdt"&&SUBJ[p[1]]) return `<a class="lk int" href="#fiches/${p[1]}/cdt" style="${sc(p[1])}"><span class="ic">COURS</span><span>${esc(label||"Cahier de textes "+SUBJ[p[1]].n)}</span></a>`;
  if(t==="ex"&&EX[p[1]]){const i=+p[2]||0, e=EX[p[1]][i]; if(!e) return "";
    return `<a class="lk int" href="#exercices/${p[1]}/${i}" style="${sc(p[1])}"><span class="ic">EXO</span><span>${esc(label||SUBJ[p[1]].n.split(" (")[0]+" · "+e.t)}</span></a>`;}
  if(t==="cartes"&&CARDS[p[1]]) return `<a class="lk int" href="#cartes/${p[1]}" style="${sc(p[1])}"><span class="ic">CARTES</span><span>${esc(label||"Cartes mémoire "+SUBJ[p[1]].n.split(" (")[0])}</span></a>`;
  if(t==="file"){const f=(LATEST&&LATEST.files||{})[p[1]]; const e=String((f&&f.e)||"doc"); return `<a class="lk doc" href="#" data-file="${esc(p[1])}"><span class="ic">${KIND[e]||e.toUpperCase().slice(0,5)}</span><span>${esc(label||(f&&f.n)||"Document")}</span></a>`;}
  if(t==="href"){const u=main.slice(5); if(!/^https?:\/\//i.test(u)) return ""; return `<a class="lk ext" href="${esc(u)}" target="_blank" rel="noopener"><span class="ic">WEB</span><span>${esc(label||u)}</span></a>`;}
  if(t==="quiz"&&CARDS[p[1]]) return `<a class="lk int" href="#quiz/${p[1]}" style="${sc(p[1])}"><span class="ic">QUIZ</span><span>${esc(label||"Quiz "+SUBJ[p[1]].n.split(" (")[0])}</span></a>`;
  if(t==="url"&&EXT[p[1]]) return `<a class="lk ext" href="${EXT[p[1]][0]}" target="_blank" rel="noopener"><span class="ic">WEB</span><span>${esc(label||EXT[p[1]][1])}</span></a>`;
  return "";
}
const links=arr=>(arr&&arr.length)?`<div class="links">${arr.map(lk).join("")}</div>`:"";
const linkify=s=>esc(s).replace(/(https?:\/\/[^\s<]*[^\s<.,;:)\]»])/g,u=>`<a href="${u}" target="_blank" rel="noopener">${u.length>60?u.slice(0,57)+"…":u}</a>`).replace(/\n/g,"<br>");

/* ============ RENDU ============ */
function streak(){
  let d=dObj(TODAY), n=0; if(!state.done[TODAY]) d.setDate(d.getDate()-1);
  while(state.done[iso(d)]){n++; d.setDate(d.getDate()-1);} return n;
}
function renderXP(){
  const st=streak(); document.getElementById("streaknum").textContent=st+(st>1?" jours":" jour");
  const v=xp(); document.getElementById("xpnum").innerHTML=RUBIS_SVG+v+" rubis";
  document.getElementById("xpfill").style.width=Math.min(100,v/600*100)+"%";
  document.getElementById("xpbar").setAttribute("aria-valuenow",v);
}
function currentMission(){
  if(TODAY<MISSIONS[0].date) return MISSIONS[0];
  return MISSIONS.find(m=>m.date===TODAY)||null;
}
function nextBoss(){
  return BOSSES.filter(b=>b.date&&b.date>=TODAY).sort((a,b)=>a.date.localeCompare(b.date))[0]
      || BOSSES.filter(b=>b.ready>=TODAY).sort((a,b)=>a.ready.localeCompare(b.ready))[0];
}
function missionCard(m,big){
  const done=!!state.done[m.date], b=m.boss&&bossById(m.boss), r=m.ready&&bossById(m.ready);
  return `<div class="card mission ${big?"":"detail"}" style="${sc(m.subj)}">
      <div class="row"><span class="eyebrow">${big?"Mission du soir · ":""}${fmtLong(m.date)}</span>${b?`<span class="pill boss">Évaluation ce jour : ${esc(b.title)}</span>`:""}${r?`<span class="pill good">Objectif : prête pour ${esc(r.title)}</span>`:""}</div>
      <div class="row">${chip(m.subj)}<span class="pill">${m.date.slice(5)>="12-14"?"20 min":(dObj(m.date).getDay()%6===0?"1h30":"30 à 45 min")}</span><span class="pill">+${m.xp} rubis</span></div>
      ${big?`<h2>${esc(m.title)}</h2>`:`<h3 style="font-size:20px">${esc(m.title)}</h3>`}
      ${devoirsBlock(m.date)}
      <div class="where"><b>Où travailler :</b> ${esc(m.where)}${links(m.go)}</div>
      <div class="row"><button class="btn ${done?"done":""}" data-done="${m.date}">${done?"✓ Mission accomplie":"J'ai fini ma mission"}</button>
      ${SUBJ[m.subj]&&FICHES[m.subj]?`<a class="btn ghost" href="#fiches/${m.subj}">Ouvrir la fiche</a>`:""}</div>
    </div>`;
}
function vAujourdhui(){
  const v=xp();
  const t=dObj(TODAY<MISSIONS[0].date?MISSIONS[0].date:TODAY); const mon=new Date(t); mon.setDate(t.getDate()-((t.getDay()+6)%7));
  let week=""; for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const s=iso(d);const mm=MISSIONS.find(x=>x.date===s); const ev=BOSSES.some(b=>b.date===s);
    week+=`<a href="#planning/${s}" class="wd ${s===TODAY?"today":""} ${state.done[s]?"ok":""}" style="${sc(mm?mm.subj:"autre")}">${J[d.getDay()]}<b>${d.getDate()}</b>${ev?"éval.":(mm&&SUBJ[mm.subj]?SUBJ[mm.subj].n.split(" ")[0]:"—")}<span class="dot"></span></a>`;}
  const dev=DEVOIRS.filter(d=>d.due>=TODAY).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,14)
    .map(d=>{const k=devKey(d); const ok=!!state.devoirs[k]||!!d.done;
      return `<li class="${ok?"ok":""}"><input type="checkbox" aria-label="Devoir fait" data-dev="${esc(k)}" ${ok?"checked":""}><span class="date">${fmt(d.due)}</span><div style="min-width:0">${chip(d.subj)}<div class="txt" style="margin-top:4px">${esc(d.text)}</div>${links(d.go)}</div></li>`;}).join("")||`<li>Aucun devoir à venir enregistré.</li>`;
  const rewards=LEVELS.map((l,i)=>`<div class="reward ${v>=l?"won":""}"><b>${COUPES[i]}</b>${l} rubis · ${v>=l?"débloquée !":"récompense "+(i+1)}</div>`).join("");
  return `<div class="grid2"><div style="display:grid;gap:18px;align-content:start;min-width:0">${statusCard()}${soirCard(TODAY,true)}${sacCard()}</div>
   <div style="display:grid;gap:18px;align-content:start;min-width:0">
    ${evalsCard()}
    <div class="card"><div class="eyebrow">Cette semaine</div><div class="week" style="margin-top:10px">${week}</div><p style="margin:10px 0 0;font-size:13.5px"><a href="#planning">Voir le programme de chaque soir</a></p></div>
    ${changesCard()}${newsCard()}${messagesCard()}${infosCard()}
    <div class="card"><div class="eyebrow">Tous les devoirs à venir</div><ul class="list dev" style="margin-top:10px">${dev}</ul><p style="margin:10px 0 0;font-size:13.5px"><a href="#fiches/maths/taf">Tout le travail donné depuis septembre, par matière</a></p></div>
    <div class="card"><div class="eyebrow">Récompenses</div><div class="rewards" style="margin-top:10px">${rewards}</div><p class="muted" style="margin:10px 0 0;font-size:13px">Choisies à l'avance avec maman. Révision du soir = 10 rubis, test blanc = 20, quiz réussi (8/10) = 5.</p></div>
   </div></div>`;
}
let selDay=null;
function vPlanning(){
  const start=(()=>{const t=dObj(TODAY); t.setDate(t.getDate()-((t.getDay()+6)%7)-7); const f=dObj(MISSIONS[0].date); f.setDate(f.getDate()-((f.getDay()+6)%7)); return t<f?f:t;})(); let html=`<div class="card"><h2 style="font-size:22px">Le planning sur 5 semaines</h2><p class="muted" style="margin:6px 0 0">Touche une case pour voir la mission et ses liens (fiche, PDF, exercices). Cadre rouge = jour d'évaluation · « prête ! » = objectif atteint 2 jours avant. Chaque case montre la mission et les devoirs Pronote à faire ce soir-là pour le lendemain. Les nouveaux contrôles annoncés sur Pronote ajoutent leurs révisions tout seuls.</p></div><div class="cal">`;
  ["LUN","MAR","MER","JEU","VEN","SAM","DIM"].forEach(h=>html+=`<div class="hd">${h}</div>`);
  for(let w=0;w<5;w++){
    html+=`<div class="weekhead">Semaine ${w+1}</div>`;
    for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+w*7+i);const s=iso(d);const m=MISSIONS.find(x=>x.date===s);
      if(!m){html+=`<div class="day empty" style="${sc("autre")}"><span class="d">${fmt(s)}</span><span class="s">${holidayOf(s)?"Vacances":"Libre"}</span></div>`;continue;}
      const b=m.boss&&bossById(m.boss), r=m.ready&&bossById(m.ready);
      html+=`<button class="day ${b?"isboss":""} ${s===TODAY?"today":""} ${state.done[s]?"done":""} ${s<TODAY?"past":""} ${s===(selDay||TODAY)?"sel":""}" style="${sc(m.subj)}" data-day="${s}" aria-label="${fmtLong(s)} : ${esc(m.title)}">
        <span class="d">${fmt(s)}</span>${b?`<span class="tag">ÉVAL. ${esc(SUBJ[b.subj].n.split(" ")[0])}</span>`:""}<span class="s">${SUBJ[m.subj]?SUBJ[m.subj].n.split(" (")[0]:""}</span>${r?`<span class="tag r">prête !</span>`:""}<span class="t">${esc(m.title)}</span>${(()=>{const n=devoirsSoir(s).list.length; return n?`<span class="dv">+ ${n} devoir${n>1?"s":""} pour ${fmt(nextClassDay(s)).split(" ")[0]}</span>`:"";})()}</button>`;}
  }
  html+=`</div>`;
  html+=soirCard(selDay||TODAY,false);
  return html;
}
function vBoss(){
  const isPast=b=>b.date&&b.date<TODAY; const sorted=[...BOSSES].filter(b=>!b.date||diff(b.date,TODAY)<=30).sort((a,b)=>(isPast(a)-isPast(b))||(isPast(a)?(b.date).localeCompare(a.date):(a.date||a.ready).localeCompare(b.date||b.ready)));
  const card=b=>{const n=b.date?diff(TODAY,b.date):null; const ready=diff(TODAY,b.ready);
    const pr=bossPrep(b); let st= b.date&&n<0?`<span class="pill">Passé</span>`: ready<=0?(pr.total&&pr.done<pr.total?`<span class="pill warn">Révisions à rattraper : ${pr.done}/${pr.total}</span>`:`<span class="pill good">Prête ✓${pr.total?" "+pr.done+"/"+pr.total+" révisions":""}</span>`): `<span class="pill warn">Objectif « prête » dans ${ready} j${pr.total?" · "+pr.done+"/"+pr.total+" révisions faites":""}</span>`;
    return `<div class="card bcard ${isPast(b)?"passe":""}" style="${sc(b.subj)}"><div class="row" style="justify-content:space-between">${chip(b.subj)}${b.hidden||!b.date?`<span class="pill">date à confirmer</span>`:""}</div><h3>${esc(b.title)}</h3>
    <div class="meta"><span><span class="muted">Évaluation</span><br><b>${b.date?fmt(b.date):"pas encore annoncé"}</b>${b.when?`<br><span class="muted">${esc(b.when)}</span>`:""}</span><span style="text-align:right"><span class="muted">Prête le</span><br><b>${fmt(b.ready)}</b></span></div>
    <p class="muted" style="margin:0;font-size:14px">${esc(b.know)}</p><div class="row">${st}</div>${links((b.go||[]).concat(CARDS[b.subj]&&!(b.go||[]).includes("cartes:"+b.subj)?["cartes:"+b.subj]:[]).concat(CARDS[b.subj]?["quiz:"+b.subj]:[]))}</div>`;};
  const past=PASSED.map(p=>`<li><span class="date">${fmt(p[0])}</span><div style="min-width:0">${chip(p[1])}<div style="margin-top:4px">${esc(p[2])}</div></div><b class="res">${esc(p[3])}</b></li>`).join("");
  return `<div class="card"><h2 style="font-size:22px">Les évaluations à venir</h2><p class="muted" style="margin:6px 0 0">Toutes les évaluations annoncées sur Pronote (ou prévues par les profs), avec ce qu'il faut savoir et les documents pour réviser. « Date à confirmer » : le prof l'a annoncée mais pas encore datée sur Pronote.</p></div><div class="bosses">${sorted.map(card).join("")}</div>
  <div class="card"><div class="eyebrow">Évaluations passées</div><ul class="list" style="margin-top:10px">${past}</ul><p class="muted" style="margin:10px 0 0;font-size:13px">Toutes les notes publiées sont dans <a href="#notes">Mes notes</a>.</p></div>`;
}
let selSubj="maths", selEx="maths";
function switcher(list,cur,view){return `<div class="switch" role="group">${list.map(s=>`<a role="button" style="${sc(s)}" aria-pressed="${s===cur}" href="#${view}/${s}">${SUBJ[s].n}</a>`).join("")}</div>`;}
const KL=[["cours","Cours"],["exos","Exercices et TP"],["corrigé","Corrigés"],["audio","Audios"],["doc","Autres documents"]];
function docsBlock(s,kinds){
  const ds=Object.entries(DOCS).filter(([,d])=>d.s===s&&(!kinds||kinds.includes(d.k)));
  return KL.map(([k,l])=>{const g=ds.filter(([,d])=>d.k===k); return g.length?`<div class="dgroup"><div class="eyebrow">${l}</div><ul class="pdfs">${g.map(([id,d])=>`<li>${lk("doc:"+id)}<span class="when">${esc(d.d)}</span></li>`).join("")}</ul></div>`:"";}).join("");
}
function pjLinks(e){
  const F=(e.f||[]).map(f=>f.k?`<a class="lk doc" href="#" data-file="${esc(f.k)}"><span class="ic">${KIND[f.e]||String(f.e||"doc").toUpperCase().slice(0,5)}</span><span>${esc(f.n)}</span></a>`
    :(f.u&&/^https?:\/\//i.test(f.u))?`<a class="lk ext" href="${esc(f.u)}" target="_blank" rel="noopener"><span class="ic">WEB</span><span>${esc(f.n)}</span></a>`
    :`<a class="lk ext" href="${PRONOTE}" target="_blank" rel="noopener" title="Document déposé sur Pronote"><span class="ic">PRONOTE</span><span>${esc(f.n)}</span></a>`);
  const P=(e.pj||[]).map(n=>`<a class="lk ext" href="${PRONOTE}" target="_blank" rel="noopener" title="Document déposé sur Pronote : ouvre Pronote, Cahier de textes, à la date de la séance"><span class="ic">PRONOTE</span><span>${esc(n)}</span></a>`);
  const all=F.concat(P); return all.length?`<div class="links">${all.join("")}</div>`:"";
}
function newsCard(){
  const lim=iso(new Date(dObj(TODAY).getTime()-6*864e5));
  const N=CDT.cdt.filter(e=>e.nv&&e.d>=lim).concat(CDT.taf.filter(w=>w.nv&&w.due>=TODAY).map(w=>({d:w.due,s:w.s,t:"Travail : "+w.x.split("\n")[0].slice(0,80),taf:1})));
  if(!N.length) return "";
  return `<div class="card"><div class="eyebrow">Nouveau sur Pronote</div><ul class="list" style="margin-top:10px">${N.sort((a,b)=>b.d.localeCompare(a.d)).slice(0,8).map(e=>`<li><span class="date">${fmt(e.d)}</span><div style="min-width:0">${chip(e.s)}<div class="txt" style="margin-top:4px"><a href="#fiches/${FICHES[e.s]?e.s:"maths"}/${e.taf?"taf":"cdt"}">${esc(e.t)}</a></div></div></li>`).join("")}</ul></div>`;
}
function cdtBlock(s){
  const E=CDT.cdt.filter(e=>e.s===s).sort((a,b)=>b.d.localeCompare(a.d));
  if(!E.length) return `<p class="muted">Rien dans le cahier de textes pour cette matière.</p>`;
  return `<div class="cdtlist">${E.map(e=>{const body=e.x?`<div class="cdtx">${linkify(e.x)}</div>`:""; const att=(e.a.length?links(e.a.map(a=>"doc:"+a)):"")+pjLinks(e);
    const head=`<span class="date">${fmt(e.d)}</span><span class="ttl">${esc(e.t)}</span>${e.c?`<span class="pill ${/Devoir|Évaluation/.test(e.c)?"boss":""}">${esc(e.c)}</span>`:""}${(e.a.length+(e.f||[]).length)?`<span class="pill">${e.a.length+(e.f||[]).length} doc</span>`:""}${e.nv?`<span class="pill good">nouveau</span>`:""}`;
    return (body||att.trim())?`<details class="cdt"><summary>${head}</summary>${body}${att}</details>`:`<div class="cdt flat">${head}</div>`;}).join("")}</div>`;
}
function tafBlock(s){
  const W=CDT.taf.filter(e=>e.s===s).sort((a,b)=>b.due.localeCompare(a.due));
  if(!W.length) return `<p class="muted">Aucun travail donné sur Pronote.</p>`;
  return `<div class="cdtlist">${W.map(w=>`<details class="cdt" ${w.due>=TODAY?"open":""}><summary><span class="date">pour ${fmt(w.due)}</span><span class="ttl">${esc(w.x.split("\n")[0].slice(0,90))}</span>${w.due>=TODAY?`<span class="pill warn">à venir</span>`:""}</summary><div class="cdtx">${linkify(w.x)}<div class="muted" style="margin-top:6px;font-size:12.5px">${w.g?"Donné le "+esc(w.g)+" · ":""}${esc(w.st)} sur Pronote</div></div>${links(w.a.map(a=>"doc:"+a))}${pjLinks(w)}</details>`).join("")}</div>`;
}
function vFiches(){
  const f=FICHES[selSubj], s=selSubj, X=FX[s]||{}; const ck=f.check.map((c,i)=>{const k=s+":"+i;return `<li><label><input type="checkbox" data-check="${k}" ${state.checks[k]?"checked":""}><span>${esc(c)}</span></label></li>`;}).join("");
  const n=f.check.filter((c,i)=>state.checks[s+":"+i]).length;
  const exl=(EX[s]||[]).map((e,i)=>"ex:"+s+":"+i).concat(CARDS[s]?["cartes:"+s]:[]);
  const paper=(X.paper||[]).map(p=>`<li><span class="ic">PAPIER</span><span>${esc(p)}</span></li>`).join("");
  return `${switcher(Object.keys(FICHES),s,"fiches")}
  <div class="grid2"><article class="card fiche" style="${sc(s)}"><div><div class="eyebrow">${SUBJ[s].prof}</div><h2>${SUBJ[s].n}</h2></div>${f.html}
   <p class="muted" style="margin:0;font-size:14px">Tout le détail des cours : <a href="#fiches/${s}/cdt">cahier de textes ${esc(SUBJ[s].n)}</a> · <a href="#fiches/${s}/taf">travail donné</a></p></article>
  <div style="display:grid;gap:18px;align-content:start;min-width:0">
   <div class="card" style="${sc(s)}"><div class="eyebrow">Je suis prête si je sais…</div><div class="meter" style="margin:10px 0"><i style="width:${n/f.check.length*100}%"></i></div><ul class="checks">${ck}</ul><p class="muted" style="margin:10px 0 0;font-size:13px">${n} sur ${f.check.length}</p></div>
   ${exl.length?`<div class="card" style="${sc(s)}"><div class="eyebrow">S'entraîner</div>${links(exl)}</div>`:""}
   <div class="card" style="${sc(s)}" id="fx-docs"><div class="eyebrow">Cours, PDF et audios de Pronote</div><p class="muted" style="margin:6px 0 10px;font-size:13.5px">Touche un document pour l'ouvrir.</p>${docsBlock(s)||`<p class="muted" style="margin:0">Pas de document déposé sur Pronote pour cette matière.</p>`}
   ${X.links&&X.links.length?`<div class="dgroup"><div class="eyebrow">Sites et vidéos</div>${links(X.links)}</div>`:""}
   ${paper?`<div class="dgroup"><div class="eyebrow">Sur papier ou ailleurs</div><ul class="pdfs">${paper}</ul></div>`:""}
   ${X.note?`<p class="muted" style="margin:10px 0 0;font-size:13.5px">${esc(X.note)}</p>`:""}<p style="margin:12px 0 0"><a class="btn ghost" href="${PRONOTE}" target="_blank" rel="noopener">Ouvrir Pronote</a></p></div>
  </div></div>
  <div class="card" id="fx-cdt" style="${sc(s)}"><div class="row" style="justify-content:space-between"><div><div class="eyebrow">Cahier de textes · ${esc(SUBJ[s].n)}</div><h3 style="font-size:20px;margin-top:4px">Tous les cours depuis le 1er septembre</h3></div><a class="lk ext" href="${PRONOTE}" target="_blank" rel="noopener"><span class="ic">WEB</span><span>Ouvrir Pronote</span></a></div><p class="muted" style="margin:6px 0 12px;font-size:13.5px">Le texte du professeur, recopié de Pronote, avec les corrections et les documents. Touche une séance pour l'ouvrir.</p>${cdtBlock(s)}</div>
  <div class="card" id="fx-taf" style="${sc(s)}"><div class="eyebrow">Travail à faire · ${esc(SUBJ[s].n)}</div><h3 style="font-size:20px;margin:4px 0 12px">Tout le travail donné depuis la rentrée</h3>${tafBlock(s)}</div>`;
}
function vExercices(){
  const s=selEx, list=EX[s];
  const prof=docsBlock(s,["exos","corrigé"]);
  return `${switcher(Object.keys(EX),s,"exercices")}<p class="muted" style="margin:0">Fais l'exercice sur une feuille, sans regarder la fiche, puis ouvre le corrigé. <a href="#fiches/${s}">Revoir la fiche ${esc(SUBJ[s].n)}</a></p>
  ${list.map((e,i)=>`<div class="card ex" id="ex-${s}-${i}" style="${sc(s)};border-left:6px solid var(--sc)"><div class="exhead"><h3 style="font-size:18px">${e.t}</h3>${e.w?`<span class="oeuvre">${esc(e.w)}</span>`:""}</div><div class="q">${e.q}</div>
  <details class="answer"><summary style="cursor:pointer;font-weight:800">Voir le corrigé</summary><div style="margin-top:8px">${e.a}</div></details></div>`).join("")}
  ${prof?`<div class="card" style="${sc(s)}"><div class="eyebrow">Les feuilles d'exercices du professeur</div><p class="muted" style="margin:6px 0 10px;font-size:13.5px">À faire aussi, avec les corrigés quand ils existent.</p>${prof}</div>`:""}`;
}

/* ============ LECTEUR DE DOCUMENTS (PDF et audio, dans la page) ============ */
let pdfLib=null, vToken=0, vBlobUrl=null;
function loadScript(src){return new Promise((ok,ko)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=ko;document.head.appendChild(s);});}
async function getPdfLib(){
  if(pdfLib) return pdfLib;
  if(!window.pdfjsWorker) await loadScript("lib/pdf.worker.min.js");
  if(!window.pdfjsLib) await loadScript("lib/pdf.min.js");
  pdfLib=window.pdfjsLib; pdfLib.GlobalWorkerOptions.workerSrc="lib/pdf.worker.min.js"; return pdfLib;
}
const MIME={pdf:"application/pdf",mp3:"audio/mpeg",m4a:"audio/mp4",wav:"audio/wav",ogg:"audio/ogg",aac:"audio/aac",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",txt:"text/plain"};
/* Ouvre un document : id de la bibliothèque (DOCS) ou clé de fichier Pronote */
function docMeta(id){const d=DOCS[id]; if(!d) return null; return {fk:d.fk,n:d.n,s:d.s,d:d.d,e:(d.e||(LATEST&&d.fk&&LATEST.files[d.fk]&&LATEST.files[d.fk].e)||d.f.split(".").pop()),o:d.o};}
function fileMeta(k){const f=LATEST&&LATEST.files&&LATEST.files[k]; if(!f) return {fk:k,n:"Document",s:"autre",d:"",e:"pdf"};
  let s="autre",d=""; for(const e of CDT.cdt.concat(CDT.taf)) if((e.f||[]).some(x=>x.k===k)){s=e.s;d=fmt(e.d||e.due);break;}
  return {fk:k,n:f.n.replace(/\.[a-z0-9]{2,4}$/i,""),s,d,e:f.e,o:f.n};}
const openDoc=id=>{const m=docMeta(id); if(m) openViewer(m);};
const openFile=k=>openViewer(fileMeta(k));
function safeName(m){return (m.n.replace(/[\\/:*?"<>|]+/g," ").replace(/\s+/g," ").trim().slice(0,80)||"document")+"."+m.e;}
async function openViewer(m){
  const tok=++vToken; if(vBlobUrl){URL.revokeObjectURL(vBlobUrl);vBlobUrl=null;}
  let v=document.getElementById("viewer");
  if(!v){v=document.createElement("div");v.id="viewer";v.setAttribute("role","dialog");v.setAttribute("aria-modal","true");document.body.appendChild(v);}
  v.setAttribute("style",sc(m.s)); v.setAttribute("aria-label",m.n);
  v.innerHTML=`<div class="vbar"><button class="btn ghost" data-vclose="1">← Retour</button><div class="vtitle">${chip(m.s)}<b>${esc(m.n)}</b><span class="muted">${esc(m.d||"")}</span></div><button class="btn ghost" data-vsave="1" hidden>Télécharger</button></div><div class="vbody"><p class="muted vmsg">Chargement du document…</p></div>`;
  v.hidden=false; document.body.classList.add("noscroll");
  const body=v.querySelector(".vbody"); v.querySelector("[data-vclose]").focus();
  if(!m.fk){body.innerHTML=`<div class="card"><p style="margin:0 0 10px">Ce document n'est pas encore arrivé dans le QG : il sera ajouté à la prochaine synchro Pronote.</p><a class="btn" href="${PRONOTE}" target="_blank" rel="noopener">L'ouvrir sur Pronote</a></div>`;return;}
  let bytes;
  try{bytes=await QG.file(m.fk);}catch(e){if(tok!==vToken) return; body.innerHTML=`<div class="card"><p style="margin:0 0 10px">Impossible de charger ce document (${navigator.onLine?"réessaie dans un instant":"pas de connexion internet"}).</p><a class="btn ghost" href="${PRONOTE}" target="_blank" rel="noopener">L'ouvrir sur Pronote</a></div>`;return;}
  if(tok!==vToken) return;
  const ext=String(m.e||"").toLowerCase(); const blob=new Blob([bytes],{type:MIME[ext]||"application/octet-stream"}); vBlobUrl=URL.createObjectURL(blob);
  const sv=v.querySelector("[data-vsave]"); sv.hidden=false; sv.dataset.vsave=vBlobUrl; sv.dataset.name=safeName(m);
  if(/^(mp3|m4a|wav|ogg|aac)$/.test(ext)){body.innerHTML=`<div class="card"><p style="margin:0 0 10px"><b>${esc(m.n)}</b></p><audio controls preload="metadata" src="${vBlobUrl}" style="width:100%"></audio><p class="muted" style="margin:10px 0 0;font-size:13.5px">Écoute en suivant le texte du même numéro.</p></div>`;return;}
  if(/^(png|jpe?g|gif|webp)$/.test(ext)){body.innerHTML=`<img src="${vBlobUrl}" alt="${esc(m.n)}" style="max-width:min(100%,920px);display:block;margin:0 auto;border-radius:8px">`;return;}
  if(ext!=="pdf"){body.innerHTML=`<div class="card"><p style="margin:0 0 10px">Ce document (${esc(ext.toUpperCase())}) s'ouvre avec ton ordinateur.</p><a class="btn" href="${vBlobUrl}" download="${esc(safeName(m))}">Télécharger « ${esc(safeName(m))} »</a></div>`;return;}
  try{
    const lib=await getPdfLib();
    const pdf=await lib.getDocument({data:bytes,isEvalSupported:false}).promise; if(tok!==vToken) return;
    body.innerHTML=`<p class="muted vmsg">${pdf.numPages} page${pdf.numPages>1?"s":""}</p>`;
    const W=Math.min(body.clientWidth-4,920), dpr=Math.min(window.devicePixelRatio||1,2);
    for(let i=1;i<=pdf.numPages;i++){
      if(tok!==vToken) return;
      const page=await pdf.getPage(i); const vp0=page.getViewport({scale:1}); const vp=page.getViewport({scale:W/vp0.width*dpr});
      const c=document.createElement("canvas"); c.width=Math.floor(vp.width); c.height=Math.floor(vp.height); c.className="vpage"; c.setAttribute("aria-label","Page "+i);
      const wrap=document.createElement("div"); wrap.className="vwrap"; wrap.style.width=Math.floor(vp.width/dpr)+"px"; wrap.appendChild(c); body.appendChild(wrap);
      await page.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
      try{ /* liens du PDF : zones cliquables posées sur la page */
        const an=await page.getAnnotations();
        an.filter(a=>a.subtype==="Link"&&a.url).forEach(a=>{const r=vp.convertToViewportRectangle(a.rect);
          const x=Math.min(r[0],r[2])/vp.width*100, y=Math.min(r[1],r[3])/vp.height*100, w=Math.abs(r[2]-r[0])/vp.width*100, h=Math.abs(r[3]-r[1])/vp.height*100;
          const l=document.createElement("a"); l.href=a.url; l.target="_blank"; l.rel="noopener"; l.className="vlink"; l.title=a.url; l.setAttribute("aria-label","Lien : "+a.url);
          l.style.cssText=`left:${x}%;top:${y}%;width:${w}%;height:${h}%`; wrap.appendChild(l);});
      }catch(e){}
    }
  }catch(e){
    if(tok!==vToken) return;
    body.innerHTML=`<iframe class="vframe" src="${vBlobUrl}" title="${esc(m.n)}"></iframe><p class="muted vmsg">Si le document reste blanc, touche « Télécharger ».</p>`;
  }
}
function closeDoc(){vToken++; const v=document.getElementById("viewer"); if(v){v.hidden=true; v.innerHTML="";} document.body.classList.remove("noscroll"); if(vBlobUrl){URL.revokeObjectURL(vBlobUrl);vBlobUrl=null;}}
function saveDoc(btn){const a=document.createElement("a"); a.href=btn.dataset.vsave; a.download=btn.dataset.name||"document"; document.body.appendChild(a); a.click(); a.remove();}
document.addEventListener("click",e=>{
  const a=e.target.closest("[data-doc]"); if(a){e.preventDefault(); openDoc(a.dataset.doc); return;}
  const f=e.target.closest("[data-file]"); if(f){e.preventDefault(); openFile(f.dataset.file); return;}
  if(e.target.closest("[data-vclose]")){closeDoc(); return;}
  const sv=e.target.closest("[data-vsave]"); if(sv&&sv.dataset.vsave&&sv.dataset.vsave!=="1"){saveDoc(sv);}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&document.getElementById("viewer")&&!document.getElementById("viewer").hidden) closeDoc();});

let selDeck="maths", cardIdx=0, flipped=false, onlyReview=true;
function deckList(s){const all=CARDS[s].map((c,i)=>({c,i})); return onlyReview?srsDue(s):all;}
function vCartes(){
  const decks=Object.keys(CARDS).map(s=>{const tot=CARDS[s].length, ok=CARDS[s].filter((c,i)=>state.cards[s+":"+i]===1).length;
    return `<button class="deck" style="${sc(s)}" aria-pressed="${s===selDeck}" data-deck="${s}">${chip(s)}<b>${tot} cartes</b><div class="meter"><i style="width:${ok/tot*100}%"></i></div><span class="muted" style="font-size:12.5px">${ok} sues · ${srsDue(s).length} à revoir</span></button>`;}).join("");
  const list=deckList(selDeck); const s=selDeck;
  let zone;
  if(!list.length){zone=`<div class="card" style="text-align:center"><h3>Rien à revoir aujourd'hui dans ce paquet !</h3><p class="muted">Les cartes sues reviendront dans quelques jours pour ne pas les oublier. Tu peux faire un <a href="#quiz/${s}">quiz</a> ou passer en « Toutes les cartes ».</p></div>`;}
  else{ if(cardIdx>=list.length) cardIdx=0; const it=list[cardIdx];
    zone=`<div class="flip ${flipped?"on":""}" style="${sc(s)}"><div class="inner" role="button" tabindex="0" data-flip="1" aria-label="Retourner la carte">
      <div class="face"><div class="big">${esc(it.c[0])}</div><div class="hint">Touche la carte pour voir la réponse</div></div>
      <div class="face back"><div class="big">${esc(it.c[1])}</div><div class="hint">Tu savais ?</div></div></div></div>
      <div class="cardbtns"><button class="btn ko" data-know="0">À revoir</button><button class="btn ok" data-know="1">Je savais</button></div>
      <p class="muted" style="text-align:center;margin:0">Carte ${cardIdx+1} sur ${list.length}</p>`;}
  return `<div class="card"><div class="deckbar"><div><h2 style="font-size:22px">Cartes mémoire</h2><p class="muted" style="margin:4px 0 0">Lis la question, réponds dans ta tête, retourne la carte. Mode « Cartes du jour » : les cartes ratées reviennent le jour même, les cartes sues dans 1, 3, 7, 14 puis 30 jours. C'est la méthode la plus efficace pour retenir.</p></div>
   <div class="switch"><button aria-pressed="${!onlyReview}" data-mode="all" style="${sc(s)}">Toutes les cartes</button><button aria-pressed="${onlyReview}" data-mode="review" style="${sc(s)}">Cartes du jour</button></div></div></div>
   <div class="decks">${decks}</div>${zone}<p style="text-align:center;margin:0"><a class="btn ghost" href="#quiz/${s}">Faire un quiz de ${esc(SUBJ[s].n.split(" (")[0])}</a></p>`;
}
function vNotes(){
  const A=(LATEST&&LATEST.averages)||{}, O=LATEST&&LATEST.overall;
  const by={}; NOTES.forEach(n=>{(by[n[1]]=by[n[1]]||[]).push(n);});
  const all=NOTES.map(n=>n[3]/n[4]*20), gen=O&&O.e!=null?O.e:all.reduce((a,b)=>a+b,0)/Math.max(1,all.length);
  const f1=x=>x.toFixed(1).replace(".",",");
  const cards=Object.keys(by).map(s=>{const L=by[s].sort((a,b)=>b[0].localeCompare(a[0])); const gl=L.filter(n=>n[5]!=null);
    const m=A[s]?A[s].e:L.reduce((t,n)=>t+n[3]/n[4]*20,0)/L.length, g=A[s]&&A[s].c!=null?A[s].c:(gl.length?gl.reduce((t,n)=>t+n[5]/n[4]*20,0)/gl.length:null);
    return {s,m,html:`<div class="card ncard" style="${sc(s)}"><div class="row" style="justify-content:space-between">${chip(s)}${g!=null?`<span class="muted" style="font-size:12.5px">groupe ${f1(g)}</span>`:""}</div>
    <div class="avg ${g==null||m>=g?"up":"down"}">${f1(m)}<span class="muted" style="font-size:15px"> /20</span></div>
    ${L.map(n=>`<div class="nline"><span>${fmt(n[0])} · ${esc(n[2])}</span><b class="${n[5]==null?"":n[3]>=n[5]?"up":"down"}">${String(n[3]).replace(".",",")}/${n[4]}</b></div>`).join("")}</div>`};}).sort((a,b)=>a.m-b.m);
  return `<div class="card"><div class="row" style="justify-content:space-between"><div><h2 style="font-size:22px">Mes notes${O&&O.p?" · "+esc(O.p):""}</h2><p class="muted" style="margin:4px 0 0">${A&&Object.keys(A).length?"Moyennes calculées par Pronote.":"Moyennes indicatives, sans les coefficients."} En vert : au-dessus de la moyenne du groupe. Les matières à renforcer sont en premier.</p></div><div style="text-align:right"><div class="eyebrow">Moyenne générale</div><div class="avg">${f1(gen)}</div></div></div></div>
  <div class="notes">${cards.map(c=>c.html).join("")}</div>`;
}

/* ============ DONNÉES PRONOTE EN DIRECT ============ */
const BASE_DEVOIRS=DEVOIRS.slice(), BASE_NOTES=NOTES.slice();
const normName=s=>String(s||"").normalize("NFC").replace(/\s*\(converti en PDF\)\s*$/,"").replace(/\s+/g," ").trim().toLowerCase();
function holidayOf(d){const H=(LATEST&&LATEST.holidays&&LATEST.holidays.length)?LATEST.holidays:(QG.base.HOLIDAYS||[]); return H.find(h=>d>=h.start&&d<=h.end)||null;}
function fileKind(n,e){if(/^(mp3|m4a|wav|ogg|aac)$/.test(e)) return "audio"; if(/corr/i.test(n)) return "corrigé"; if(/exerc|entra[iî]n|\bTD\b|\bTP\b|fiche|interro|test|évaluation/i.test(n)) return "exos"; if(/cours|chapitre|leçon|lesson|séance|seance/i.test(n)) return "cours"; return "doc";}
function applyContent(c,quiet){
  if(!c) return; LATEST=c;
  const files=c.files||{}, byName={}; for(const [n,k] of Object.entries(c.fileNames||{})) byName[normName(n)]=k;
  Object.values(DOCS).forEach(d=>{const k=byName[normName(d.o)]; if(k) d.fk=k;});
  if(c.cdtFull&&c.cdtFull.cdt&&c.cdtFull.cdt.length){CDT={cdt:c.cdtFull.cdt.map(e=>({a:[],pj:[],f:[],...e})),taf:(c.cdtFull.taf||[]).map(w=>({a:[],pj:[],f:[],...w}))};}
  /* documents déposés sur Pronote qui ne sont pas encore dans la bibliothèque du QG */
  const known=new Set(Object.values(DOCS).map(d=>d.fk).filter(Boolean)); const when={};
  CDT.cdt.forEach(e=>(e.f||[]).forEach(f=>{if(f.k&&!when[f.k]) when[f.k]={d:e.d,s:e.s};}));
  CDT.taf.forEach(w=>(w.f||[]).forEach(f=>{if(f.k&&!when[f.k]) when[f.k]={d:w.due,s:w.s};}));
  (c.messages||[]).forEach(m=>(m.f||[]).forEach(f=>{if(f.k&&!when[f.k]) when[f.k]={d:m.d,s:m.s};}));
  (c.news||[]).forEach(n=>(n.f||[]).forEach(f=>{if(f.k&&!when[f.k]) when[f.k]={d:n.d,s:"autre"};}));
  Object.entries(files).forEach(([k,f])=>{if(known.has(k)||!when[k]) return; const s=SUBJ[when[k].s]?when[k].s:"autre";
    DOCS["f-"+k]={n:f.n.replace(/\.[a-z0-9]{2,4}$/i,""),f:"x."+f.e,e:f.e,s,d:fmt(when[k].d),k:fileKind(f.n,f.e),o:f.n,fk:k,auto:1};});
  if(Array.isArray(c.devoirs)&&c.devoirs.length) DEVOIRS=c.devoirs.map(d=>({go:[],...d}));
  if(Array.isArray(c.notes)&&c.notes.length) NOTES=c.notes;
  if(Array.isArray(c.bosses)) c.bosses.forEach(nb=>{const i=BOSSES.findIndex(b=>b.id===nb.id); if(i>=0) BOSSES[i]={...BOSSES[i],...nb}; else BOSSES.push({go:[],know:"",...nb});});
  if(Array.isArray(c.missions)) c.missions.forEach(nm=>{if(!nm||!nm.date) return; const i=MISSIONS.findIndex(m=>m.date===nm.date); if(i>=0){if(MISSIONS[i].auto) MISSIONS[i]={xp:10,go:[],...nm};} else MISSIONS.push({xp:10,go:[],...nm});});
  MISSIONS.sort((a,b)=>a.date.localeCompare(b.date));
  if(c.updatedAt){const d=new Date(c.updatedAt); UPDATED="Données Pronote du "+fmtLong(iso(d))+" à "+pad(d.getHours())+"h"+pad(d.getMinutes());}
  if(ROLE==="parent"&&c.progress&&c.progress.p){const p=c.progress.p; state={done:{...(p.done||{})},checks:{...(p.checks||{})},cards:{...(p.cards||{})},devoirs:{...(p.devoirs||{})},srs:{...(p.srs||{})},quiz:JSON.parse(JSON.stringify(p.quiz||{}))};}
  else if(ROLE!=="parent"&&c.progress&&c.progress.p&&!Object.keys(state.done).length&&!Object.keys(state.checks).length&&!Object.keys(state.cards).length){
    const p=c.progress.p; state={done:{...(p.done||{})},checks:{...(p.checks||{})},cards:{...(p.cards||{})},devoirs:{...(p.devoirs||{})},srs:{...(p.srs||{})},quiz:JSON.parse(JSON.stringify(p.quiz||{}))}; QG.LS.set(KEY,JSON.stringify(state)); if(!quiet) toast("Progrès récupérés depuis la sauvegarde");}
  syncLabel();
}
function syncLabel(){
  const s=LATEST&&LATEST.sync; if(!s){setSync(ROLE==="parent"?"Mode parent (lecture seule)":"Progrès enregistrés sur cet ordinateur");return;}
  const ago=Math.round((Date.now()-s.at)/60000);
  if(s.needsQr||!s.connected) setSync("Pronote n'est pas relié : voir Réglages","warn");
  else if(!s.ok) setSync("Dernière lecture Pronote impossible, nouvel essai bientôt","warn");
  else setSync((ROLE==="parent"?"Mode parent · ":"")+"Pronote vérifié "+(ago<2?"à l'instant":ago<60?"il y a "+ago+" min":"à "+new Date(s.at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})),"ok");
}
let lastSig="";
async function refreshLatest(manual){
  if(iso(new Date())!==TODAY){location.reload();return;}
  try{const c=await QG.json("data/latest.enc",true); const sig=(c.updatedAt||"")+"|"+(c.sync&&c.sync.at);
    if(sig!==lastSig){const fresh=lastSig&&c.updatedAt&&(!LATEST||c.updatedAt!==LATEST.updatedAt); lastSig=sig; applyContent(c); rerender(); if(fresh) toast("Nouveautés Pronote chargées");}
    else if(manual) toast("Déjà à jour");}
  catch(e){if(manual) toast("Pas de connexion pour l'instant");}
}


/* Révisions prévues pour un boss : missions de la même matière dans les 7 jours avant, ou marquées « prête » pour lui */
function bossPrep(b){ if(!b.date) return {done:0,total:0};
  const from=iso(new Date(dObj(b.date).getTime()-7*864e5));
  const L=MISSIONS.filter(m=>m.date<b.date&&m.date>=from&&(m.subj===b.subj||m.ready===b.id)&&m.date<=TODAY);
  return {done:L.filter(m=>state.done[m.date]).length,total:L.length}; }
/* ============ DEVOIRS DU SOIR DANS LE PLANNING ============ */
/* Le soir, on fait d'abord les devoirs du prochain jour de classe, puis la mission.
   Vendredi : rien (les devoirs de lundi sont prévus le week-end). */
function nextClassDay(d){const x=dObj(d); do{x.setDate(x.getDate()+1);}while(x.getDay()===0||x.getDay()===6||holidayOf(iso(x))); return iso(x);}
function devoirsSoir(d){if(dObj(d).getDay()===5) return {next:null,list:[]}; const n=nextClassDay(d); return {next:n,list:DEVOIRS.filter(x=>x.due===n)};}
const devKey=d=>d.due+":"+d.subj+":"+d.text.slice(0,24);
function devoirsBlock(d){
  const {next,list}=devoirsSoir(d);
  if(!list.length){
    if(!next){const n=nextClassDay(d), k=DEVOIRS.filter(x=>x.due===n).length; return `<div class="tonight"><b>Devoirs : rien ce soir.</b> <span class="muted">${k?`Les ${k} devoir${k>1?"s":""} pour ${fmtLong(n)} sont prévus ce week-end.`:`Rien pour ${fmtLong(n)} sur Pronote.`}</span></div>`;}
    return `<div class="tonight"><b>Devoirs : aucun pour ${fmtLong(next)} sur Pronote.</b> <span class="muted">Place directement à la mission.</span></div>`;
  }
  const done=list.filter(x=>state.devoirs[devKey(x)]||x.done).length;
  return `<div class="tonight"><div class="row" style="justify-content:space-between"><b>1. D'abord, les devoirs pour ${fmtLong(next)}</b><span class="pill ${done===list.length?"good":"warn"}">${done}/${list.length} faits</span></div>
  <ul class="list dev" style="margin-top:8px">${list.map(x=>{const k=devKey(x), ok=!!state.devoirs[k]||!!x.done; return `<li class="${ok?"ok":""}"><input type="checkbox" aria-label="Devoir fait" data-dev="${esc(k)}" ${ok?"checked":""}><div style="min-width:0">${chip(x.subj)}<div class="txt" style="margin-top:4px">${esc(x.text)}</div>${links(x.go)}</div></li>`;}).join("")}</ul>
  <p class="muted" style="margin:8px 0 0;font-size:13px"><b>2. Ensuite, la mission ci-dessous.</b></p></div>`;
}

/* ============ CARTES SUPPLÉMENTAIRES (Aujourd'hui) ============ */
function statusCard(){
  const s=LATEST&&LATEST.sync;
  if(s&&s.connected&&!s.needsQr) return "";
  return `<div class="card alert"><div class="eyebrow">${s&&s.needsQr?"Reconnexion nécessaire":"Dernière étape"}</div><h3 style="font-size:19px;margin-top:4px">${s&&s.needsQr?"Pronote doit être reconnecté au QG":"Relier le QG à Pronote"}</h3><p class="muted" style="margin:6px 0 10px">Une minute avec le QR code de Pronote, à faire par un parent. Ensuite tout se met à jour seul.</p><a class="btn" href="#reglages">Connecter Pronote</a></div>`;
}
function revsCard(){
  const R=(LATEST&&LATEST.revs||[]).filter(r=>r.date===TODAY); if(!R.length) return "";
  return `<div class="card"><div class="eyebrow">Aussi à préparer aujourd'hui</div><ul class="checks" style="margin-top:8px">${R.map(r=>`<li><label><input type="checkbox" data-check="${esc(r.id)}" ${state.checks[r.id]?"checked":""}><span>${chip(r.subj)} ${esc(r.t)}</span></label>${links(r.go)}</li>`).join("")}</ul></div>`;
}
function changesCard(){
  const C=(LATEST&&LATEST.changes||[]).filter(c=>c.date>=TODAY).slice(0,8); if(!C.length) return "";
  return `<div class="card"><div class="eyebrow">Emploi du temps : changements</div><ul class="list" style="margin-top:10px">${C.map(c=>`<li><span class="date">${fmt(c.date)}</span><div style="min-width:0">${SUBJ[c.s]&&c.s!=="autre"?chip(c.s):`<span class="chip">${esc(c.sn||"Cours")}</span>`}<div class="txt" style="margin-top:4px"><b>${esc(c.label)}</b> · ${esc(c.h)}</div></div></li>`).join("")}</ul></div>`;
}
function infosCard(){
  const N=(LATEST&&LATEST.news||[]).slice(0,5); if(!N.length) return "";
  return `<div class="card"><div class="eyebrow">Infos du collège</div><div class="cdtlist" style="margin-top:10px">${N.map(n=>`<details class="cdt"><summary><span class="date">${fmt(n.d)}</span><span class="ttl">${esc(n.t)}</span></summary><div class="cdtx">${linkify(n.x||"")}${n.a?`<div class="muted" style="margin-top:6px;font-size:12.5px">${esc(n.a)}</div>`:""}</div>${pjLinks(n)}</details>`).join("")}</div></div>`;
}

function messagesCard(){
  const M=(LATEST&&LATEST.messages||[]).slice(0,6); if(!M.length) return "";
  return `<div class="card"><div class="eyebrow">Messages des profs</div><div class="cdtlist" style="margin-top:10px">${M.map(m=>`<details class="cdt"><summary><span class="date">${fmt(m.d)}</span><span class="ttl">${esc(m.t)}</span>${(m.f||[]).length?`<span class="pill">${m.f.length} doc</span>`:""}</summary><div class="cdtx">${linkify(m.x||"")}<div class="muted" style="margin-top:6px;font-size:12.5px">${esc(m.a)}</div></div>${pjLinks(m)}</details>`).join("")}</div></div>`;
}
/* ============ SUIVI ============ */
function vSuivi(){
  const name=QG.base.NAME||"l'élève"; const p=LATEST&&LATEST.progress;
  const last=ROLE==="parent"?(p&&p.at?new Date(p.at):null):new Date();
  const days=[]; for(let i=6;i>=0;i--){const d=new Date(dObj(TODAY)); d.setDate(d.getDate()-i); const s=iso(d); const m=MISSIONS.find(x=>x.date===s);
    days.push(`<div class="wd ${s===TODAY?"today":""} ${state.done[s]?"ok":""}" style="${sc(m?m.subj:"autre")}">${J[d.getDay()]}<b>${d.getDate()}</b>${m?(state.done[s]?"✓ faite":(s<TODAY?"ratée":"à faire")):"—"}<span class="dot"></span></div>`);}
  const past=MISSIONS.filter(m=>m.date<=TODAY), doneN=past.filter(m=>state.done[m.date]).length;
  const up=DEVOIRS.filter(d=>d.due>=TODAY&&d.due<=iso(new Date(dObj(TODAY).getTime()+7*864e5)));
  const upOk=up.filter(d=>state.devoirs[d.due+":"+d.subj+":"+d.text.slice(0,24)]||d.done).length;
  const bosses=BOSSES.filter(b=>b.date&&b.date>=TODAY).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6).map(b=>{
    const prep=MISSIONS.filter(m=>m.date<b.date&&m.date>=iso(new Date(dObj(b.date).getTime()-7*864e5))&&(m.subj===b.subj||m.ready===b.id));
    const ok=prep.filter(m=>state.done[m.date]).length;
    return `<li><span class="date">${fmt(b.date)}</span><div style="min-width:0">${chip(b.subj)}<div class="txt" style="margin-top:4px">${esc(b.title)}</div></div><b class="res">${prep.length?ok+"/"+prep.length+" révisions":"—"}</b></li>`;}).join("")||"<li>Aucun contrôle annoncé pour l'instant.</li>";
  const decks=Object.keys(CARDS).map(s=>{const t=CARDS[s].length, ok=CARDS[s].filter((c,i)=>state.cards[s+":"+i]===1).length; return `<div class="nline"><span>${chip(s)}</span><b>${ok}/${t}</b></div>`;}).join("");
  const av=LATEST&&LATEST.averages||{}; const weak=Object.entries(av).filter(([s,a])=>a.c!=null&&SUBJ[s]).sort((a,b)=>(a[1].e-a[1].c)-(b[1].e-b[1].c)).slice(0,3)
    .map(([s,a])=>`<div class="nline"><span>${chip(s)}</span><b class="${a.e>=a.c?"up":"down"}">${String(a.e.toFixed(1)).replace(".",",")} <span class="muted" style="font-weight:600">(groupe ${String(a.c.toFixed(1)).replace(".",",")})</span></b></div>`).join("");
  return `<div class="card"><div class="row" style="justify-content:space-between"><div><h2 style="font-size:22px">Suivi de ${esc(name)}</h2><p class="muted" style="margin:4px 0 0">${ROLE==="parent"?(last?"Dernière activité dans le QG : "+fmtLong(iso(last))+" à "+pad(last.getHours())+"h"+pad(last.getMinutes()):"Pas encore d'activité reçue depuis l'ordinateur de "+esc(name)+"."):"Ce que voient aussi tes parents."}</p></div>
   <div style="text-align:right"><div class="eyebrow">Rubis</div><div class="avg">${xp()}</div><div class="muted" style="font-size:13px">série : ${streak()} j</div></div></div></div>
  <div class="grid2"><div style="display:grid;gap:18px;align-content:start;min-width:0">
   <div class="card"><div class="eyebrow">Missions des 7 derniers jours</div><div class="week" style="margin-top:10px">${days.join("")}</div><p class="muted" style="margin:10px 0 0;font-size:13.5px">${doneN} missions réussies sur ${past.length} depuis le début.</p></div>
   <div class="card"><div class="eyebrow">Devoirs des 7 prochains jours</div><div class="avg" style="margin-top:6px">${upOk}/${up.length}</div><p class="muted" style="margin:4px 0 0;font-size:13.5px">cochés comme faits (dans le QG ou sur Pronote). <a href="#aujourdhui">Voir la liste</a></p></div>
   <div class="card"><div class="eyebrow">Prochains contrôles et révisions faites</div><ul class="list" style="margin-top:10px">${bosses}</ul></div>
  </div><div style="display:grid;gap:18px;align-content:start;min-width:0">
   ${weak?`<div class="card"><div class="eyebrow">Matières à surveiller (moyennes Pronote)</div><div style="margin-top:8px">${weak}</div><p style="margin:10px 0 0;font-size:13.5px"><a href="#notes">Toutes les notes</a></p></div>`:""}
   ${succesCard()}
   <div class="card"><div class="eyebrow">Cartes mémoire sues</div><div style="margin-top:8px">${decks}</div></div>
  </div></div>`;
}

/* ============ RÉGLAGES : notifications, connexion Pronote, installation ============ */
let installEvt=null, qrData=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault(); installEvt=e; if(location.hash.startsWith("#reglages")) rerender();});
const pushOK=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
function vReglages(){
  const s=LATEST&&LATEST.sync, rp=QG.repo(), name=QG.base.NAME||"l'élève";
  const perm=pushOK()?Notification.permission:"unsupported"; const on=!!QG.LS.get("qg-sub")&&perm==="granted";
  const subs=(s&&s.subs)||[];
  const runUrl=rp?`https://github.com/${rp.owner}/${rp.name}/actions/workflows/qg.yml`:"";
  const link=location.origin+location.pathname+"#k="+QG.LS.get("qg-key");
  const st=!s?"Le robot n'a pas encore publié de données."
    : s.needsQr?"<b>À reconnecter</b> : Pronote a refusé le jeton (cela arrive si le mot de passe a changé ou après une longue coupure)."
    : !s.connected?"<b>Pas encore relié</b> à Pronote."
    : s.ok?`<b>Relié</b>. Dernière lecture réussie : ${new Date(s.lastOk).toLocaleString("fr-FR",{weekday:"long",hour:"2-digit",minute:"2-digit"})}.`
    : `<b>Relié</b>, mais la dernière lecture a échoué. Dernière réussite : ${s.lastOk?new Date(s.lastOk).toLocaleString("fr-FR",{weekday:"long",hour:"2-digit",minute:"2-digit"}):"aucune"}.`;
  return `<div class="card"><h2 style="font-size:22px">Réglages</h2><p class="muted" style="margin:4px 0 0">Cet appareil est celui ${ROLE==="parent"?"<b>d'un parent</b> (lecture seule)":"<b>de "+esc(name)+"</b>"}. <button class="btn ghost sm" data-role="${ROLE==="parent"?"lehna":"parent"}">Changer : c'est ${ROLE==="parent"?"celui de "+esc(name):"celui d'un parent"}</button></p></div>
  <div class="grid2"><div style="display:grid;gap:18px;align-content:start;min-width:0">
   <div class="card"><div class="eyebrow">Notifications sur cet ordinateur</div>
    ${perm==="unsupported"?`<p class="muted">Ce navigateur ne gère pas les notifications. Utilise Chrome, Edge ou Firefox (ou Safari sur Mac).</p>`
     :perm==="denied"?`<p class="warnmsg">Les notifications sont bloquées pour ce site. Clique sur le cadenas à gauche de l'adresse, puis autorise « Notifications », et reviens ici.</p>`
     :on?`<p style="margin:8px 0">✓ Activées. ${ROLE==="parent"?"Tu reçois les nouveautés Pronote et le bilan du soir vers 20h30.":"Tu reçois les nouveautés Pronote et le rappel de ta mission vers 17h."}</p><div class="row"><button class="btn ghost" data-ntest="1">Tester</button><button class="btn ghost" data-noff="1">Désactiver</button></div>`
     :`<p class="muted" style="margin:8px 0">${ROLE==="parent"?"Nouveau devoir, contrôle annoncé, nouvelle note, cours annulé, et un bilan vers 20h30 : mission faite ou pas.":"Nouveau devoir, contrôle annoncé, nouvelle note, cours annulé, et le rappel de ta mission du soir vers 17h."}</p><button class="btn" data-non="1" ${LATEST&&LATEST.vapid?"":"disabled"}>Activer les notifications</button>${LATEST&&LATEST.vapid?"":`<p class="muted" style="font-size:13px">Disponible après la première synchro du robot.</p>`}`}
    <p class="muted" style="margin:10px 0 0;font-size:13px">Sur Mac, vérifie aussi Réglages Système > Notifications > ${/Edg\//.test(navigator.userAgent)?"Microsoft Edge":/Firefox/.test(navigator.userAgent)?"Firefox":/Chrome/.test(navigator.userAgent)?"Google Chrome":"Safari"} : autorisées. Le navigateur doit rester ouvert (même sans fenêtre) pour les recevoir.</p>
    ${subs.length?`<p class="muted" style="margin:8px 0 0;font-size:13px">Appareils abonnés : ${subs.map(x=>(x.role==="parent"?"parent":esc(name))).join(", ")}.</p>`:""}
   </div>
   <div class="card"><div class="eyebrow">Installer le QG comme une appli</div>
    ${matchMedia("(display-mode: standalone)").matches?`<p style="margin:8px 0 0">✓ Le QG est installé sur cet ordinateur.</p>`:installEvt?`<p class="muted" style="margin:8px 0">Il aura sa propre icône dans le Dock ou la barre des tâches, comme une vraie application.</p><button class="btn" data-install="1">Installer le QG</button>`:`<p class="muted" style="margin:8px 0 0">Dans Chrome ou Edge : menu ⋮ > « Caster, enregistrer et partager » > « Installer la page en tant qu'application » (ou l'icône ⊕ dans la barre d'adresse). Sur Safari (Mac) : Fichier > Ajouter au Dock.</p>`}
   </div>
   <div class="card"><div class="eyebrow">Ouvrir le QG sur un autre appareil</div><p class="muted" style="margin:8px 0">Ce lien contient le code secret : à n'envoyer qu'en famille.</p>
    <div class="row"><button class="btn ghost" data-copy="${esc(link)}">Copier le lien pour ${esc(name)}</button><button class="btn ghost" data-copy="${esc(link+"&role=parent")}">Copier le lien parent</button></div></div>
  </div><div style="display:grid;gap:18px;align-content:start;min-width:0">
   <div class="card" id="pronote-cx"><div class="eyebrow">Connexion à Pronote</div><p style="margin:8px 0">${st}</p>
    ${s&&s.error&&!s.ok?`<p class="muted" style="font-size:13px">Détail : ${esc(s.error).slice(0,300)}</p>`:""}
    <details ${!s||!s.connected||s.needsQr?"open":""}><summary style="cursor:pointer;font-weight:800">${s&&s.connected?"Refaire la connexion avec un QR code":"Connecter Pronote avec un QR code (1 minute)"}</summary>
     <ol class="steps-ol">
      <li><a class="lk ext" href="${PRONOTE}" target="_blank" rel="noopener"><span class="ic">WEB</span><span>Ouvre Pronote</span></a> et connecte-toi. En haut de la page, clique sur l'icône <b>QR code</b> (« Accéder à l'application mobile »). Choisis un <b>code à 4 chiffres</b>, valide : un QR code s'affiche.</li>
      <li>Fais une capture d'écran du QR code (Mac : <kbd>⌘</kbd>+<kbd>Ctrl</kbd>+<kbd>Maj</kbd>+<kbd>4</kbd> puis entoure-le ; Windows : <kbd>Win</kbd>+<kbd>Maj</kbd>+<kbd>S</kbd>), puis colle-la ici avec <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>V</kbd>, ou choisis l'image :
        <div class="qrdrop" tabindex="0" id="qrdrop">${qrData?`✓ QR code lu (${esc(qrData.url.replace(/^https?:\/\//,"").split("/")[0])})`:"Colle ou dépose la capture ici"}</div><input type="file" accept="image/*" id="qrfile" aria-label="Image du QR code"></li>
      <li>Tape le code à 4 chiffres choisi : <input id="qrpin" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" size="5" autocomplete="off" aria-label="Code à 4 chiffres"></li>
      <li><button class="btn" data-qrsend="1">Envoyer au robot du QG</button></li>
      <li>${runUrl?`<a class="btn ghost" href="${runUrl}" target="_blank" rel="noopener">Lancer la synchro maintenant</a> puis « Run workflow » et le bouton vert. Le QR code n'est valable que quelques minutes.`:"La synchro suivante utilisera le QR code."}</li>
     </ol><p class="muted" id="qrmsg" style="font-size:13.5px;margin:0"></p></details>
    <p class="muted" style="margin:10px 0 0;font-size:13px">Le QG ne lit Pronote qu'en lecture : il ne coche rien, n'envoie aucun message. Aucun mot de passe n'est enregistré, seulement un jeton de connexion chiffré.</p>
    <div class="row" style="margin-top:10px"><button class="btn ghost" data-refresh="1">Recharger les données</button>${runUrl?`<a class="btn ghost" href="${runUrl}" target="_blank" rel="noopener">Voir le robot sur GitHub</a>`:""}</div>
   </div>
  </div></div>`;
}
async function notifOn(btn){
  btn.disabled=true;
  try{
    const perm=await Notification.requestPermission(); if(perm!=="granted"){rerender();return;}
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:QG.b64d(LATEST.vapid)});
    const ua=navigator.userAgent; const dev=(/Mac/.test(ua)?"Mac":/Windows/.test(ua)?"PC":/Android/.test(ua)?"Android":/iPhone|iPad/.test(ua)?"iPhone":"ordinateur")+" · "+(/Edg\//.test(ua)?"Edge":/Firefox/.test(ua)?"Firefox":/Chrome/.test(ua)?"Chrome":"Safari");
    await QG.post({t:"sub",role:ROLE,sub:sub.toJSON(),dev});
    QG.LS.set("qg-sub",sub.endpoint);
    reg.showNotification("Le QG est prêt",{body:"Les notifications sont activées. Les nouveautés Pronote arriveront ici.",icon:"icon-192.png",tag:"bienvenue"});
    toast("Notifications activées");
  }catch(e){toast("Activation impossible : "+(e&&e.message||e));}
  rerender();
}
async function notifOff(){
  try{const reg=await navigator.serviceWorker.ready; const sub=await reg.pushManager.getSubscription(); if(sub){await QG.post({t:"unsub",endpoint:sub.endpoint}); await sub.unsubscribe();}}catch(e){}
  QG.LS.del("qg-sub"); toast("Notifications désactivées"); rerender();
}
async function readQr(blob){
  const msg=document.getElementById("qrmsg");
  try{
    if(!window.jsQR) await loadScript("lib/jsQR.js");
    const bmp=await createImageBitmap(blob); const c=document.createElement("canvas"); c.width=bmp.width; c.height=bmp.height; const x=c.getContext("2d"); x.drawImage(bmp,0,0);
    const img=x.getImageData(0,0,c.width,c.height); const r=window.jsQR(img.data,c.width,c.height,{inversionAttempts:"attemptBoth"});
    if(!r) throw new Error("Aucun QR code trouvé sur l'image. Refais la capture en entourant bien le QR code.");
    let d; try{d=JSON.parse(r.data);}catch(e){throw new Error("Ce QR code ne vient pas de Pronote.");}
    if(!d.jeton||!d.login||!d.url) throw new Error("Ce QR code ne vient pas de Pronote.");
    qrData=d; const z=document.getElementById("qrdrop"); if(z) z.textContent="✓ QR code lu ("+d.url.replace(/^https?:\/\//,"").split("/")[0]+")"; if(msg) msg.textContent="";
    const pin=document.getElementById("qrpin"); pin&&pin.focus();
  }catch(e){qrData=null; if(msg) msg.textContent=e.message;}
}
async function qrSend(btn){
  const msg=document.getElementById("qrmsg"); const pin=(document.getElementById("qrpin")||{}).value||"";
  if(!qrData){msg.textContent="Colle d'abord la capture du QR code (étape 2).";return;}
  if(!/^\d{4}$/.test(pin)){msg.textContent="Le code doit faire 4 chiffres (étape 3).";return;}
  btn.disabled=true;
  try{await QG.post({t:"qr",qr:qrData,pin,at:Date.now()}); msg.innerHTML="✓ Envoyé. Lance maintenant la synchro (étape 5) : dans 2 à 3 minutes, recharge le QG."; qrData=null;}
  catch(e){msg.textContent="Envoi impossible : "+(e&&e.message||e); btn.disabled=false;}
}
document.addEventListener("paste",e=>{if(!location.hash.startsWith("#reglages")) return; const it=[...(e.clipboardData&&e.clipboardData.items||[])].find(i=>i.type.startsWith("image/")); if(it){e.preventDefault(); readQr(it.getAsFile());}});
document.addEventListener("dragover",e=>{if(e.target.closest&&e.target.closest("#qrdrop")) e.preventDefault();});
document.addEventListener("drop",e=>{const z=e.target.closest&&e.target.closest("#qrdrop"); if(!z) return; e.preventDefault(); const f=[...e.dataTransfer.files].find(f=>f.type.startsWith("image/")); f&&readQr(f);});
document.addEventListener("change",e=>{if(e.target.id==="qrfile"&&e.target.files[0]) readQr(e.target.files[0]);});
document.addEventListener("click",async e=>{
  const t=e.target.closest("[data-non],[data-noff],[data-ntest],[data-install],[data-copy],[data-qrsend],[data-refresh],[data-role]"); if(!t) return;
  if(t.dataset.non) notifOn(t);
  else if(t.dataset.noff) notifOff();
  else if(t.dataset.ntest){const reg=await navigator.serviceWorker.ready; reg.showNotification("Test du QG",{body:"Les notifications marchent sur cet ordinateur.",icon:"icon-192.png",tag:"test"});}
  else if(t.dataset.install&&installEvt){installEvt.prompt(); const r=await installEvt.userChoice; installEvt=null; rerender(); if(r.outcome==="accepted") toast("QG installé");}
  else if(t.dataset.copy){try{await navigator.clipboard.writeText(t.dataset.copy); toast("Lien copié");}catch(err){prompt("Copie ce lien :",t.dataset.copy);}}
  else if(t.dataset.qrsend) qrSend(t);
  else if(t.dataset.refresh) refreshLatest(true);
  else if(t.dataset.role){if(confirm(t.dataset.role==="parent"?"Passer cet appareil en mode parent (lecture seule) ?":"Passer cet appareil en appareil de "+(QG.base.NAME||"l'élève")+" ?")){QG.LS.set("qg-role",t.dataset.role); location.reload();}}
});

/* ============ PROGRAMME DU SOIR : 1. devoirs  2. révisions des évaluations  3. cours du jour ============ */
const S_NUM=["①","②","③"];
function evalsDans(d,jours){return BOSSES.filter(b=>b.date&&b.date>=d&&diff(d,b.date)<=jours).sort((a,b)=>a.date.localeCompare(b.date));}
const quand=(d,x)=>{const n=diff(d,x); return n===0?"aujourd'hui":n===1?"demain":"dans "+n+" jours";};
function coursDuJour(d){return CDT.cdt.filter(e=>e.d===d&&(e.t||e.x));}
function secDevoirs(d){
  const {next,list}=devoirsSoir(d);
  let body;
  if(!next){const n=nextClassDay(d), k=DEVOIRS.filter(x=>x.due===n).length; body=`<p class="muted s-empty">Rien ce soir (vendredi). ${k?`Les ${k} devoir${k>1?"s":""} pour ${fmtLong(n)} sont à faire ce week-end.`:`Rien pour ${fmtLong(n)} sur Pronote.`}</p>`;}
  else if(!list.length) body=`<p class="muted s-empty">Aucun devoir pour ${fmtLong(next)} sur Pronote.</p>`;
  else body=`<ul class="list dev">${list.map(x=>{const k=devKey(x), ok=!!state.devoirs[k]||!!x.done; return `<li class="${ok?"ok":""}"><input type="checkbox" aria-label="Devoir fait" data-dev="${esc(k)}" ${ok?"checked":""}><div style="min-width:0">${chip(x.subj)}<div class="txt" style="margin-top:4px">${esc(x.text)}</div>${links(x.go)}</div></li>`;}).join("")}</ul>`;
  const done=list.filter(x=>state.devoirs[devKey(x)]||x.done).length;
  return `<section class="s-sec"><div class="s-head"><span class="s-num">${S_NUM[0]}</span><h3>Les devoirs${next?" pour "+fmtLong(next):""}</h3>${list.length?`<span class="pill ${done===list.length?"good":"warn"}">${done}/${list.length} faits</span>`:""}</div>${body}</section>`;
}
function secRevisions(d){
  const m=MISSIONS.find(x=>x.date===d), ev=evalsDans(d,10), R=(LATEST&&LATEST.revs||[]).filter(r=>r.date===d);
  const evl=ev.length?`<div class="s-evals">${ev.map(b=>`<a href="#boss" class="s-eval" style="${sc(b.subj)}"><b>${esc(SUBJ[b.subj]?SUBJ[b.subj].n.split(" (")[0]:b.subj)}</b> · ${esc(b.title)}<span>${fmt(b.date)} · ${quand(d,b.date)}</span></a>`).join("")}</div>`:`<p class="muted s-empty">Aucune évaluation annoncée dans les 10 prochains jours.</p>`;
  let mis="";
  if(m){const done=!!state.done[m.date], b=m.boss&&bossById(m.boss), r=m.ready&&bossById(m.ready);
    mis=`<div class="s-mission" style="${sc(m.subj)}"><div class="row">${chip(m.subj)}<span class="pill">+${m.xp} rubis</span>${b?`<span class="pill boss">Évaluation ce jour : ${esc(b.title)}</span>`:""}${r?`<span class="pill good">Objectif : être prête pour ${esc(r.title)}</span>`:""}</div>
      <p class="s-mtitle">${esc(m.title)}</p><div class="where"><b>Avec :</b> ${esc(m.where||"")}${links(m.go)}</div>
      <button class="btn ${done?"done":""}" data-done="${m.date}">${done?"✓ Révision faite":"J'ai fini ma révision"}</button></div>`;}
  else if(holidayOf(d)) mis=`<p class="muted s-empty">Vacances : pas de révision prévue.</p>`;
  else mis=`<p class="muted s-empty">Pas de révision prévue ce jour-là.</p>`;
  const rv=R.length?`<ul class="checks" style="margin-top:8px">${R.map(r=>`<li><label><input type="checkbox" data-check="${esc(r.id)}" ${state.checks[r.id]?"checked":""}><span>${chip(r.subj)} ${esc(r.t)}</span></label>${links(r.go)}</li>`).join("")}</ul>`:"";
  const nc=d===TODAY?cartesDuJour():0;
  const cj=nc?`<p style="margin:10px 0 0;font-size:14px"><b>Bonus 5 min :</b> <a href="#cartes">${nc} carte${nc>1?"s":""} mémoire à revoir aujourd'hui</a> · <a href="#quiz">faire un quiz</a></p>`:"";
  return `<section class="s-sec"><div class="s-head"><span class="s-num">${S_NUM[1]}</span><h3>Réviser pour les évaluations qui arrivent</h3></div>${evl}${mis}${rv}${cj}</section>`;
}
function secCours(d){
  const C=coursDuJour(d); let body;
  if(d>TODAY) body=`<p class="muted s-empty">Les cours de ce jour s'afficheront le soir même, dès que les profs les auront notés sur Pronote.</p>`;
  else if(!C.length) body=`<p class="muted s-empty">${dObj(d).getDay()%6===0||holidayOf(d)?"Pas de cours ce jour-là.":"Aucun cours noté sur Pronote pour ce jour (pour l'instant)."}</p>`;
  else{const n=C.filter((e,i)=>state.checks["cours:"+d+":"+i]).length;
    body=`<p class="muted" style="margin:0 0 8px;font-size:13.5px">5 minutes par matière : relis ce qui a été fait en classe aujourd'hui, pour rester à jour. ${n}/${C.length} relus.</p><ul class="checks">${C.map((e,i)=>{const k="cours:"+d+":"+i; return `<li><label><input type="checkbox" data-check="${k}" ${state.checks[k]?"checked":""}><span>${chip(e.s)} ${esc(e.t)}${e.c?` <span class="muted">(${esc(e.c)})</span>`:""}</span></label> <a class="s-link" href="#fiches/${FICHES[e.s]?e.s:"maths"}/cdt">voir le cours</a></li>`;}).join("")}</ul>`;}
  return `<section class="s-sec"><div class="s-head"><span class="s-num">${S_NUM[2]}</span><h3>Relire les cours du jour</h3></div>${body}</section>`;
}
function soirCard(d,big){
  const hol=holidayOf(d);
  if(hol&&!MISSIONS.find(x=>x.date===d)) return `<div class="card soir" style="${sc("autre")}"><div class="eyebrow">${fmtLong(d)}</div><h2>${esc(hol.n||"Vacances")}</h2><p class="muted">Retour en classe après le ${fmtLong(hol.end)}.${d>"2026-12-18"&&d<"2027-01-04"?" Une seule chose pendant ces vacances : commencer Brooklyn de Colm Tóibín (à lire pour le 1er février).":""}</p>${secDevoirs(d)}</div>`;
  return `<div class="card soir"><div class="eyebrow">${big?"Mon programme de ce soir":"Programme du soir"} · ${fmtLong(d)}</div>
   <p class="muted" style="margin:4px 0 0;font-size:13.5px">Dans l'ordre : ${S_NUM[0]} les devoirs, ${S_NUM[1]} les révisions, ${S_NUM[2]} la relecture des cours.</p>
   ${secDevoirs(d)}${secRevisions(d)}${secCours(d)}</div>`;
}
function evalsCard(){
  const E=BOSSES.filter(b=>b.date&&b.date>=TODAY).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8);
  const N=BOSSES.filter(b=>!b.date&&b.ready>=TODAY).sort((a,b)=>a.ready.localeCompare(b.ready));
  const li=E.map(b=>{const pr=bossPrep(b); return `<li><span class="date">${fmt(b.date)}</span><div style="min-width:0">${chip(b.subj)}<div class="txt" style="margin-top:4px"><b>${esc(b.title)}</b>${b.when?` · <span class="muted">${esc(b.when)}</span>`:""}</div><div class="muted" style="font-size:13px;margin-top:2px">${quand(TODAY,b.date)} · être prête le ${fmt(b.ready)}${pr.total?` · révisions faites ${pr.done}/${pr.total}`:""}</div></div></li>`;}).join("")||"<li>Aucune évaluation annoncée sur Pronote pour l'instant.</li>";
  return `<div class="card"><div class="eyebrow">Prochaines évaluations</div><ul class="list" style="margin-top:10px">${li}</ul>
   ${N.length?`<p class="muted" style="margin:10px 0 0;font-size:13.5px"><b>Prévues, date pas encore donnée :</b> ${N.map(b=>`${esc(SUBJ[b.subj]?SUBJ[b.subj].n.split(" (")[0]:b.subj)} (${esc(b.title)})`).join(", ")}. Les révisions sont déjà dans le planning.</p>`:""}
   <p style="margin:10px 0 0;font-size:13.5px"><a href="#boss">Le détail de chaque évaluation : quoi réviser, avec quels documents</a></p></div>`;
}

/* ============ RUBIS, COUPES ET SUCCÈS ============ */
const RUBIS_SVG=`<svg class="rubis" viewBox="0 0 12 20" aria-hidden="true"><path d="M6 0 12 5v10l-6 5-6-5V5z" fill="#22b14c"/><path d="M6 0v20L0 15V5z" fill="#1a8f3c"/><path d="M6 4 9 6.5v7L6 16 3 13.5v-7z" fill="#7be08f" opacity=".75"/></svg>`;
const COUPES=["Coupe Champignon","Coupe Fleur","Coupe Étoile","Coupe Spéciale"];
function quizRubis(){let n=0; const L=(state.quiz&&state.quiz.log)||{}; for(const k in L) if(L[k]>=8) n+=5; return n;}
function succes(){
  const S=state, ch=S.checks||{}, dv=Object.keys(S.devoirs||{}).length, cours=Object.keys(ch).filter(k=>k.startsWith("cours:")).length;
  const log=(S.quiz&&S.quiz.log)||{}, parfait=Object.values(log).some(v=>v>=10);
  const deckOk=Object.keys(CARDS).some(s=>CARDS[s].length&&CARDS[s].every((c,i)=>srsBox(s,i)>=3));
  const pret=BOSSES.some(b=>b.date&&b.date<=TODAY&&(()=>{const p=bossPrep(b); return p.total&&p.done===p.total;})());
  const nd=MISSIONS.filter(m=>S.done[m.date]).length, st=streak();
  return [
    ["Première quête","1 révision du soir terminée",nd>=1],["Série de 3","3 soirs de suite",st>=3],["Série de 7","7 soirs de suite",st>=7],
    ["Quiz parfait","10/10 à un quiz",parfait],["Maître des cartes","un paquet de cartes entièrement su",deckOk],
    ["Prête à temps","toutes les révisions faites avant une évaluation",pret],["Devoirs au carré","20 devoirs cochés",dv>=20],["Toujours à jour","20 cours du jour relus",cours>=20]];
}
function succesCard(){const L=succes(); return `<div class="card"><div class="eyebrow">Succès débloqués : ${L.filter(x=>x[2]).length}/${L.length}</div><div class="badges">${L.map(([t,d,ok])=>`<div class="badge ${ok?"on":""}" title="${esc(d)}"><b>${ok?"★":"☆"} ${esc(t)}</b><span>${esc(d)}</span></div>`).join("")}</div></div>`;}

/* ============ CARTES MÉMOIRE : RÉPÉTITION ESPACÉE ============ */
/* Chaque carte est dans une boîte de 1 à 5. Su : boîte suivante, revient dans 1, 3, 7, 14 puis 30 jours. Raté : boîte 1, revient aujourd'hui. */
const SRS_GAP=[0,1,3,7,14,30];
function srsGet(s,i){const v=(state.srs||{})[s+":"+i]; if(!v) return null; const [b,n]=String(v).split("|"); return {b:+b||1,n:n||TODAY};}
const srsBox=(s,i)=>{const g=srsGet(s,i); return g?g.b:(state.cards[s+":"+i]===1?2:0);};
/* cartes à revoir aujourd'hui + au plus 5 nouvelles cartes par paquet et par séance */
function srsDue(s){const all=CARDS[s].map((c,i)=>({c,i}));
  const rev=all.filter(x=>{const g=srsGet(s,x.i); return g&&g.n<=TODAY;}), neu=all.filter(x=>!srsGet(s,x.i)&&state.cards[s+":"+x.i]!==1).slice(0,5);
  return rev.concat(neu);}
function srsAnswer(s,i,know){
  state.srs=state.srs||{}; const g=srsGet(s,i)||{b:0};
  const b=know?Math.min(5,Math.max(1,g.b)+(g.b?1:0)):1; const n=know?iso(new Date(dObj(TODAY).getTime()+SRS_GAP[b]*864e5)):TODAY;
  state.srs[s+":"+i]=b+"|"+n;
}
function cartesDuJour(){return Object.keys(CARDS).reduce((t,s)=>t+srsDue(s).length,0);}

/* ============ QUIZ ============ */
let selQuiz=null, QZ=null;
function shuffle(a){a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a;}
function newQuiz(s){
  const deck=CARDS[s]||[]; if(deck.length<2) return null;
  const order=shuffle(deck.map((c,i)=>i)).sort((a,b)=>srsBox(s,a)-srsBox(s,b)).slice(0,Math.min(10,deck.length));
  const pool=deck.map(c=>c[1]); const other=Object.keys(CARDS).filter(x=>x!==s).flatMap(x=>CARDS[x].map(c=>c[1]));
  const qs=order.map(i=>{const ok=deck[i][1]; let wrong=shuffle([...new Set(pool.filter(a=>a!==ok))]).slice(0,3);
    if(wrong.length<3) wrong=wrong.concat(shuffle(other.filter(a=>a!==ok&&!wrong.includes(a))).slice(0,3-wrong.length));
    return {i,q:deck[i][0],opts:shuffle([ok,...wrong]),ok,pick:null};});
  return {s,qs,k:0,t0:Date.now(),end:null};
}
function vQuiz(){
  const subs=Object.keys(CARDS).filter(s=>CARDS[s].length>=2); if(!selQuiz||!CARDS[selQuiz]) selQuiz=subs[0];
  if(!QZ||QZ.s!==selQuiz) QZ=newQuiz(selQuiz);
  const s=selQuiz, best=((state.quiz||{}).best||{})[s];
  const head=`<div class="card"><div class="row" style="justify-content:space-between"><div><h2 style="font-size:22px">Quiz</h2><p class="muted" style="margin:4px 0 0">10 questions, 4 réponses possibles. 8/10 ou plus = +5 rubis (une fois par jour et par matière).</p></div>${best!=null?`<span class="pill good">Record : ${best}/10</span>`:""}</div></div>
   <div class="switch" role="group">${subs.map(x=>`<a role="button" style="${sc(x)}" aria-pressed="${x===s}" href="#quiz/${x}">${SUBJ[x].n}</a>`).join("")}</div>`;
  if(!QZ) return head+`<div class="card"><p>Pas assez de cartes pour un quiz dans cette matière.</p></div>`;
  if(QZ.end){const sc10=QZ.qs.filter(q=>q.pick===q.ok).length, sec=Math.round((QZ.end-QZ.t0)/1000);
    return head+`<div class="card quizend" style="${sc(s)}"><div class="eyebrow">Résultat</div><div class="avg">${sc10}/${QZ.qs.length}</div><p class="muted">en ${Math.floor(sec/60)} min ${sec%60} s${sc10>=8?" · +5 rubis gagnés":""}</p>
     <ul class="list">${QZ.qs.map(q=>`<li><span class="date">${q.pick===q.ok?"✓":"✗"}</span><div style="min-width:0"><b>${esc(q.q)}</b><div class="muted" style="margin-top:2px">${esc(q.ok)}</div></div></li>`).join("")}</ul>
     <div class="row" style="margin-top:12px"><button class="btn" data-qz="again">Nouveau quiz</button><a class="btn ghost" href="#cartes/${s}">Revoir les cartes</a></div></div>`;}
  const q=QZ.qs[QZ.k];
  return head+`<div class="card quiz" style="${sc(s)}"><div class="row" style="justify-content:space-between"><span class="eyebrow">Question ${QZ.k+1} sur ${QZ.qs.length}</span><span class="muted">${QZ.qs.filter(x=>x.pick&&x.pick===x.ok).length} bonne(s)</span></div>
   <div class="meter" style="margin:8px 0 14px"><i style="width:${QZ.k/QZ.qs.length*100}%"></i></div>
   <h3 class="qq">${esc(q.q)}</h3><div class="qopts">${q.opts.map((o,j)=>{const cls=q.pick==null?"":o===q.ok?"good":o===q.pick?"bad":"";
     return `<button class="qopt ${cls}" data-qz="${j}" ${q.pick!=null?"disabled":""}>${esc(o)}</button>`;}).join("")}</div>
   ${q.pick!=null?`<div class="row" style="margin-top:12px"><span class="pill ${q.pick===q.ok?"good":"warn"}">${q.pick===q.ok?"Bravo !":"Réponse : "+esc(q.ok)}</span><button class="btn" data-qz="next">${QZ.k+1<QZ.qs.length?"Question suivante":"Voir mon score"}</button></div>`:""}</div>`;
}
document.addEventListener("click",e=>{const t=e.target.closest("[data-qz]"); if(!t||!QZ) return; const v=t.dataset.qz;
  if(v==="again"){QZ=newQuiz(selQuiz); rerender(); return;}
  if(v==="next"){if(QZ.k+1<QZ.qs.length) QZ.k++; else {QZ.end=Date.now(); const n=QZ.qs.filter(q=>q.pick===q.ok).length;
      if(ROLE!=="parent"){state.quiz=state.quiz||{}; state.quiz.best=state.quiz.best||{}; state.quiz.log=state.quiz.log||{};
        state.quiz.best[QZ.s]=Math.max(n,state.quiz.best[QZ.s]||0); const k=TODAY+":"+QZ.s; state.quiz.log[k]=Math.max(n,state.quiz.log[k]||0);
        QZ.qs.forEach(q=>srsAnswer(QZ.s,q.i,q.pick===q.ok)); save();}}
    rerender(); return;}
  const q=QZ.qs[QZ.k]; if(q.pick!=null) return; q.pick=q.opts[+v]; rerender();});

/* ============ MON SAC POUR DEMAIN (emploi du temps Pronote) ============ */
function edtJour(d){return ((LATEST&&LATEST.edt)||[]).filter(l=>l.d===d);}
function sacCard(){
  const d=nextClassDay(TODAY), L=edtJour(d); if(!LATEST||!LATEST.edt) return "";
  if(!L.length) return `<div class="card"><div class="eyebrow">Mon sac pour ${fmtLong(d)}</div><p class="muted" style="margin:8px 0 0">L'emploi du temps de ce jour n'est pas encore sur Pronote.</p></div>`;
  const subs=[...new Set(L.filter(l=>!l.x).map(l=>l.s))];
  const dev=DEVOIRS.filter(x=>x.due===d), ev=BOSSES.filter(b=>b.date===d);
  const items=subs.map(s=>s==="eps"?"Tenue de sport et baskets (EPS)":(n=>`Cahier et livre ${/^[AEIOUHÉÈ]/i.test(n)?"d'":"de "}${n}`)(SUBJ[s]?SUBJ[s].n.split(" (")[0]:s))
    .concat(dev.filter(x=>/rendre|imprim|apporter|feuille|copie|dm\b|devoir maison/i.test(x.text)).map(x=>`À rendre en ${SUBJ[x.subj]?SUBJ[x.subj].n.split(" (")[0]:x.subj} : ${x.text.slice(0,70)}`))
    .concat(["Trousse complète, agenda, gourde"]);
  return `<div class="card"><div class="eyebrow">Mon emploi du temps et mon sac pour ${fmtLong(d)}</div>
   ${ev.length?`<p class="warnmsg" style="margin:8px 0 0">Évaluation ce jour-là : ${ev.map(b=>esc(b.title)).join(", ")}</p>`:""}
   <ul class="list edt" style="margin-top:10px">${L.map(l=>`<li class="${l.x?"ko":""}"><span class="date">${esc(l.h1)}–${esc(l.h2)}</span><div style="min-width:0">${SUBJ[l.s]&&l.s!=="autre"?chip(l.s):`<span class="chip">${esc(l.sn||"Cours")}</span>`}<div class="muted" style="margin-top:3px;font-size:13px">${[l.room&&"salle "+l.room,l.prof].filter(Boolean).map(esc).join(" · ")}${l.st?` · <b>${esc(l.st)}</b>`:""}${l.t?` · <b>évaluation</b>`:""}</div></div></li>`).join("")}</ul>
   <div class="eyebrow" style="margin-top:12px">Dans mon sac</div><ul class="checks" style="margin-top:6px">${items.map((t,i)=>{const k="sac:"+d+":"+i; return `<li><label><input type="checkbox" data-check="${k}" ${state.checks[k]?"checked":""}><span>${esc(t)}</span></label></li>`;}).join("")}</ul></div>`;
}

/* ============ RECHERCHE ============ */
let rq="";
const fold=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const strip=h=>String(h||"").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&[a-z]+;/g," ");
function snippet(txt,words){const t=String(txt||"").replace(/\s+/g," "); const f=fold(t); let i=f.indexOf(words[0]); if(i<0) i=0;
  const a=Math.max(0,i-50), part=t.slice(a,a+170); let out=esc(part);
  words.forEach(w=>{if(w.length<2) return; const re=new RegExp("("+w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").split("").map(ch=>{const m={a:"[aàâä]",e:"[eéèêë]",i:"[iîï]",o:"[oôö]",u:"[uùûü]",c:"[cç]"}; return m[ch]||ch;}).join("")+")","gi"); out=out.replace(re,"<mark>$1</mark>");});
  return (a>0?"…":"")+out+(a+170<t.length?"…":"");}
function vRecherche(){
  const words=fold(rq).split(/\s+/).filter(Boolean);
  if(!words.length) return `<div class="card"><h2 style="font-size:22px">Recherche</h2><p class="muted">Tape un mot dans la barre de recherche : un chapitre, une notion, un nom de document… Par exemple « Pythagore », « Lumières », « Raven ».</p></div>`;
  const hit=t=>{const f=fold(t); return words.every(w=>f.includes(w));};
  const G=[];
  const add=(title,list,render)=>{if(list.length) G.push(`<div class="card"><div class="eyebrow">${title} · ${list.length}</div><ul class="list sres" style="margin-top:8px">${list.slice(0,12).map(render).join("")}</ul>${list.length>12?`<p class="muted" style="margin:8px 0 0;font-size:13px">et ${list.length-12} autre(s) : précise ta recherche.</p>`:""}</div>`);};
  add("Évaluations",BOSSES.filter(b=>hit(b.title+" "+b.know+" "+(SUBJ[b.subj]||{}).n)),b=>`<li><span class="date">${b.date?fmt(b.date):"à dater"}</span><div style="min-width:0">${chip(b.subj)} <a href="#boss"><b>${esc(b.title)}</b></a><div class="muted">${snippet(b.know,words)}</div></div></li>`);
  add("Fiches de révision",Object.keys(FICHES).filter(s=>hit(SUBJ[s].n+" "+strip(FICHES[s].html)+" "+(FICHES[s].check||[]).join(" "))),s=>`<li><div style="min-width:0">${chip(s)} <a href="#fiches/${s}"><b>Fiche ${esc(SUBJ[s].n)}</b></a><div class="muted">${snippet(strip(FICHES[s].html)+" "+(FICHES[s].check||[]).join(" "),words)}</div></div></li>`);
  add("Documents des profs",Object.entries(DOCS).filter(([,d])=>hit(d.n+" "+d.o+" "+(SUBJ[d.s]||{}).n)),([id,d])=>`<li><span class="date">${esc(d.d||"")}</span><div style="min-width:0">${lk("doc:"+id)}</div></li>`);
  add("Cours (cahier de textes)",CDT.cdt.filter(e=>hit(e.t+" "+e.x+" "+e.c+" "+(SUBJ[e.s]||{}).n)).sort((a,b)=>b.d.localeCompare(a.d)),e=>`<li><span class="date">${fmt(e.d)}</span><div style="min-width:0">${chip(e.s)} <a href="#fiches/${FICHES[e.s]?e.s:"maths"}/cdt"><b>${esc(e.t)}</b></a><div class="muted">${snippet(e.x||e.t,words)}</div></div></li>`);
  add("Devoirs",CDT.taf.filter(w=>hit(w.x+" "+(SUBJ[w.s]||{}).n)).sort((a,b)=>b.due.localeCompare(a.due)),w=>`<li><span class="date">pour ${fmt(w.due)}</span><div style="min-width:0">${chip(w.s)} <a href="#fiches/${FICHES[w.s]?w.s:"maths"}/taf">voir</a><div class="muted">${snippet(w.x,words)}</div></div></li>`);
  add("Exercices",Object.keys(EX).flatMap(s=>EX[s].map((x,i)=>({s,i,x}))).filter(o=>hit(o.x.t+" "+strip(o.x.q))),o=>`<li><div style="min-width:0">${lk("ex:"+o.s+":"+o.i)}<div class="muted">${snippet(strip(o.x.q),words)}</div></div></li>`);
  add("Cartes mémoire",Object.keys(CARDS).flatMap(s=>CARDS[s].map((c,i)=>({s,c}))).filter(o=>hit(o.c[0]+" "+o.c[1])),o=>`<li><div style="min-width:0">${chip(o.s)} <a href="#cartes/${o.s}">${esc(o.c[0])}</a><div class="muted">${esc(o.c[1])}</div></div></li>`);
  add("Messages des profs",(LATEST&&LATEST.messages||[]).filter(m=>hit(m.t+" "+m.x+" "+m.a+" "+(m.f||[]).map(f=>f.n).join(" "))),m=>`<li><span class="date">${fmt(m.d)}</span><div style="min-width:0"><b>${esc(m.t)}</b> <span class="muted">${esc(m.a)}</span><div class="muted">${snippet(m.x,words)}</div>${pjLinks(m)}</div></li>`);
  add("Infos du collège",(LATEST&&LATEST.news||[]).filter(n=>hit(n.t+" "+n.x)),n=>`<li><span class="date">${fmt(n.d)}</span><div style="min-width:0"><b>${esc(n.t)}</b><div class="muted">${snippet(n.x,words)}</div></div></li>`);
  return `<div class="card"><h2 style="font-size:22px">Résultats pour « ${esc(rq)} »</h2></div>${G.join("")||`<div class="card"><p class="muted" style="margin:0">Rien trouvé. Essaie un autre mot, ou moins de mots.</p></div>`}`;
}
let rqT=null;
document.addEventListener("input",e=>{if(e.target.id!=="q") return; rq=e.target.value; clearTimeout(rqT); rqT=setTimeout(()=>{if(!rq.trim()) return; if(!location.hash.startsWith("#recherche")) location.hash="recherche"; else rerender();},250);});
document.addEventListener("keydown",e=>{if(e.key==="/"&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault(); const i=document.getElementById("q"); i&&i.focus();}});

/* ============ NAVIGATION ============ */
const VIEWS={aujourdhui:vAujourdhui,planning:vPlanning,boss:vBoss,fiches:vFiches,cartes:vCartes,exercices:vExercices,notes:vNotes,suivi:vSuivi,reglages:vReglages,quiz:vQuiz,recherche:vRecherche};
function route(scroll){
  const parts=(location.hash||"").slice(1).split("/").map(x=>{try{return decodeURIComponent(x)}catch(e){return x}});
  const v=VIEWS[parts[0]]?parts[0]:"aujourdhui";
  if(v==="fiches"&&FICHES[parts[1]]) selSubj=parts[1];
  if(v==="exercices"&&EX[parts[1]]) selEx=parts[1];
  if(v==="cartes"&&CARDS[parts[1]]&&selDeck!==parts[1]){selDeck=parts[1];cardIdx=0;flipped=false;}
  if(v==="quiz"&&CARDS[parts[1]]&&selQuiz!==parts[1]){selQuiz=parts[1];QZ=null;}
  if(v==="planning"&&/^\d{4}-\d{2}-\d{2}$/.test(parts[1]||"")) selDay=parts[1];
  Object.keys(VIEWS).forEach(k=>{document.getElementById("v-"+k).hidden=k!==v;});
  document.querySelectorAll("nav.tabs a").forEach(a=>a.setAttribute("aria-current",a.dataset.v===v?"page":"false"));
  document.getElementById("v-"+v).innerHTML=VIEWS[v]();
  document.getElementById("upd").textContent=UPDATED;
  renderXP();
  if(scroll){
    let el=null;
    if(v==="exercices"&&parts[2]!=null) el=document.getElementById("ex-"+selEx+"-"+parts[2]);
    if(v==="fiches"&&parts[2]) el=document.getElementById("fx-"+parts[2]);
    if(v==="planning"&&parts[1]) el=document.querySelector(".mission.detail");
    if(el){ if(el.tagName==="DETAILS") el.open=true; requestAnimationFrame(()=>{const top=document.querySelector(".top"); const hh=top&&getComputedStyle(top).position==="sticky"?top.getBoundingClientRect().height:0; const nav=document.querySelector(".top .wrap+.wrap"); const extra=nav&&getComputedStyle(nav).position==="fixed"?nav.getBoundingClientRect().height:0; window.scrollTo(0,Math.max(0,el.getBoundingClientRect().top+window.scrollY-(hh-extra)-12));}); }
    else window.scrollTo(0,0);
  }
}
function rerender(){route(false);}
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-done],[data-day],[data-deck],[data-flip],[data-know],[data-mode]"); if(!t) return;
  if(t.dataset.deck){selDeck=t.dataset.deck;cardIdx=0;flipped=false;rerender();return;}
  if(t.dataset.flip){flipped=!flipped; const f=t.closest(".flip"); f&&f.classList.toggle("on",flipped); return;}
  if(t.dataset.mode){onlyReview=t.dataset.mode==="review";cardIdx=0;flipped=false;rerender();return;}
  if(ROLE==="parent"&&(t.dataset.know||t.dataset.done)){parentOnly();return;}
  if(t.dataset.know){const list=deckList(selDeck); const it=list[cardIdx]; if(it){state.cards[selDeck+":"+it.i]=Number(t.dataset.know); srsAnswer(selDeck,it.i,t.dataset.know==="1"); save();}
    flipped=false; if(!(onlyReview&&t.dataset.know==="1")) cardIdx++; rerender(); return;}
  if(t.dataset.done){const d=t.dataset.done; if(state.done[d]) delete state.done[d]; else state.done[d]=true; save(); rerender();}
  else if(t.dataset.day){selDay=t.dataset.day; rerender(); const det=document.querySelector(".mission.detail"); det&&det.scrollIntoView({block:"nearest",behavior:"smooth"});}
});
document.addEventListener("change",e=>{const t=e.target;
  if(ROLE==="parent"&&t.dataset&&(t.dataset.dev||t.dataset.check)){t.checked=!t.checked;parentOnly();return;}
  if(t.dataset&&t.dataset.dev){const k=t.dataset.dev; if(t.checked) state.devoirs[k]=true; else delete state.devoirs[k]; save(); rerender(); return;}
  if(t.dataset&&t.dataset.check){if(t.checked) state.checks[t.dataset.check]=true; else delete state.checks[t.dataset.check]; save(); rerender();}});
document.addEventListener("keydown",e=>{const t=e.target; if(t.dataset&&t.dataset.flip&&(e.key==="Enter"||e.key===" ")){e.preventDefault();t.click();}});
window.addEventListener("hashchange",()=>route(true));
/* ============ DÉMARRAGE ============ */
(function(){const n=QG.base.NAME||""; if(n){document.getElementById("qgname").textContent="Le QG de "+n; document.getElementById("qglogo").textContent=n[0]; document.title="Le QG de "+n;}
  if(QG.base.CLASSE) document.getElementById("qgsub").textContent=QG.base.CLASSE+" · devoirs, contrôles et révisions";})();
applyContent(QG.latest,true); lastSig=QG.latest?((QG.latest.updatedAt||"")+"|"+(QG.latest.sync&&QG.latest.sync.at)):"";
route(true);
if(ROLE!=="parent"&&QG.LS.get("qg-pushday")!==TODAY) setTimeout(()=>pushProgress(false,true),3000);
setInterval(()=>{if(document.visibilityState==="visible") refreshLatest(false);},10*60e3);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible") refreshLatest(false);});
