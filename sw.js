const C='listenup-v12';
const AUDIO='lu-audio';
const SHELL=['./','index.html','app.js','styles.css','content.json','manifest.webmanifest','icons/icon-192.png'];

self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(
  caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&x!==AUDIO).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});

/* A media element requests audio with `Range: bytes=...` and REFUSES a plain 200
   in reply (Safari/iOS hard-fails; seeking breaks elsewhere). The Cache API can
   only ever store a full 200, so when we serve a downloaded episode offline we
   must slice it ourselves and synthesise a real 206 Partial Content. */
async function sliceRange(res,rangeHeader){
  const buf=await res.arrayBuffer(), size=buf.byteLength;
  const m=/bytes=(\d*)-(\d*)/.exec(rangeHeader||'');
  if(!m) return new Response(buf,{status:200,headers:{'Content-Type':'audio/mpeg','Content-Length':String(size),'Accept-Ranges':'bytes'}});
  let start=m[1]?parseInt(m[1],10):0;
  let end=m[2]?parseInt(m[2],10):size-1;
  if(isNaN(start))start=0; if(isNaN(end)||end>=size)end=size-1;
  if(start>=size||start>end)
    return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
  const body=buf.slice(start,end+1);
  return new Response(body,{status:206,statusText:'Partial Content',headers:{
    'Content-Type':res.headers.get('Content-Type')||'audio/mpeg',
    'Content-Length':String(body.byteLength),
    'Content-Range':'bytes '+start+'-'+end+'/'+size,
    'Accept-Ranges':'bytes'}});
}

async function serveAudio(req){
  const cache=await caches.open(AUDIO);
  // match on the bare URL: the incoming Request carries a Range header we must ignore
  const hit=await cache.match(req.url,{ignoreVary:true});
  const range=req.headers.get('range');
  if(hit) return range?sliceRange(hit,range):hit;
  // not downloaded: stream from the network, never auto-cache (downloads stay explicit)
  try{ return await fetch(req); }
  catch(e){ return new Response('Offline and this episode is not downloaded.',{status:504,statusText:'Offline'}); }
}

// stale-while-revalidate: instant offline, refreshes in the background
async function swr(req){
  const cache=await caches.open(C);
  const cached=await cache.match(req);
  const net=fetch(req).then(res=>{
    if(res&&res.status===200&&res.type==='basic') cache.put(req,res.clone()).catch(()=>{});
    return res;
  }).catch(()=>null);
  if(cached){ net.catch(()=>{}); return cached; }
  const res=await net;
  if(res) return res;
  if(req.mode==='navigate'){ const idx=await cache.match('index.html'); if(idx) return idx; }
  return new Response('Offline',{status:503});
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  let url; try{ url=new URL(req.url); }catch(_){ return; }
  if(url.origin!==location.origin) return;            // let Supabase & co. pass straight through
  if(url.pathname.endsWith('.mp3')){ e.respondWith(serveAudio(req)); return; }
  e.respondWith(swr(req));
});

// let the page ask what is genuinely on disk
self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='LIST_AUDIO'){
    e.waitUntil(caches.open(AUDIO).then(c=>c.keys()).then(keys=>{
      e.source.postMessage({type:'AUDIO_LIST',urls:keys.map(k=>k.url)});
    }));
  }
});
