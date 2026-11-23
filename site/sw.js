/* Le QG : fonctionne hors connexion et reçoit les notifications même quand le QG est fermé. */
const V="qg-3379487ef8";
const SHELL=["./","index.html","boot.js","app.js","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("qg-")&&k!==V&&k!=="qg-files").map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url); if(e.request.method!=="GET"||u.origin!==location.origin) return;
  const p=u.pathname;
  if(/\/data\/files\//.test(p)||/\/lib\//.test(p)){ // fichiers qui ne changent jamais : cache d'abord
    e.respondWith(caches.open("qg-files").then(async c=>{const hit=await c.match(e.request,{ignoreSearch:true}); if(hit) return hit; const r=await fetch(e.request); if(r.ok) c.put(e.request,r.clone()); return r;}));
    return;
  }
  e.respondWith(fetch(e.request.url,{cache:"no-cache",credentials:"same-origin"}).then(r=>{if(r.ok){const cl=r.clone(); caches.open(V).then(c=>c.put(e.request,cl));} return r;})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match("index.html"))));
});
self.addEventListener("push",e=>{
  let d={}; try{d=e.data?e.data.json():{};}catch(err){d={title:"Le QG",body:e.data?e.data.text():""};}
  e.waitUntil(self.registration.showNotification(d.title||"Le QG",{body:d.body||"",tag:d.tag||undefined,renotify:!!d.tag,icon:"icon-192.png",badge:"icon-192.png",data:{url:d.url||"#aujourdhui"}}));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close(); const hash=(e.notification.data&&e.notification.data.url)||"#aujourdhui";
  const target=new URL("index.html"+hash,self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{
    for(const c of cs){ if(c.url.startsWith(self.registration.scope)){ return c.focus().then(w=>w&&w.navigate?w.navigate(target):null).catch(()=>self.clients.openWindow(target)); } }
    return self.clients.openWindow(target);
  }));
});
