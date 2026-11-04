"use strict";
const cardW=224,cardH=104;
const graphViews=new Map();
function graphMark(){return `<svg class="graph-mark" aria-hidden="true" viewBox="0 0 32 32" fill="none"><path d="M8 24V8m0 15c0-9 16-3 16-15" stroke="currentColor" stroke-width="2.5"/><g fill="currentColor"><circle cx="8" cy="7" r="3.5"/><circle cx="24" cy="7" r="3.5"/><circle cx="8" cy="25" r="3.5"/></g></svg>`}
function hasAncestor(revs,child,ancestor){
 const index=new Map(revs.map(v=>[v.id,v])),visited=new Set();
 while(child&&!visited.has(child)){if(child===ancestor)return true;visited.add(child);child=index.get(child)?.parent}
 return false
}
function graphData(revs,r){
 const branches=branchKeys(r,revs),lanes=[...new Set(revs.slice().sort((a,b)=>branches.indexOf(branchKey(a))-branches.indexOf(branchKey(b))||fileExt(fileName(a)).localeCompare(fileExt(fileName(b)))).map(formatLane))];
 const byId=new Map(),columns=new Map(),edges=[],seen=new Map(),previous=new Map();
 const occupied=new Set();
 const nodes=orderedRevisions(revs).map((v,i)=>{
   const k=formatLane(v),col=Math.max(columns.get(k)||0,(byId.get(v.parent)?.col??-1)+1),pos=v.canvas;
   const n={i,files:[v],v,col,x:pos?.x??30+col*(cardW+54),y:pos?.y??36+lanes.indexOf(k)*(cardH+52)};
   // Older workspaces could save a source and export at the same coordinates.
   while(occupied.has(Math.round(n.x)+"/"+Math.round(n.y)))n.y+=cardH+52;
   occupied.add(Math.round(n.x)+"/"+Math.round(n.y));columns.set(k,col+1);byId.set(v.id,n);return n
 });
 for(const n of nodes){
   const k=formatLane(n.v),prev=previous.get(k);
   if(prev&&!n.files.some(f=>f.parent))edges.push({a:prev,b:n,sequence:true,targets:n.files.map(v=>v.id)});
   previous.set(k,n);
   for(const f of n.files){const a=byId.get(f.parent);if(!a||a===n)continue;
     const key=a.i+"/"+n.i;let edge=seen.get(key);
     if(!edge){edge={a,b:n,source:f.parent,targets:[]};seen.set(key,edge);edges.push(edge)}edge.targets.push(f.id)
   }
 }
 return {nodes,edges,byId,lanes}
}
async function reorderVersion(r,v,step){
 const revs=project().revisions.filter(f=>f.record===r.id),lane=orderedRevisions(revs).filter(f=>formatLane(f)===formatLane(v));
 const from=lane.findIndex(f=>f.id===v.id),to=from+step,neighbor=lane[to];
 if(!neighbor){toast(step<0?"Already first in this branch and format.":"Already last in this branch and format.");return}
 const earlier=lane[Math.min(from,to)],later=lane[Math.max(from,to)];
 [lane[from],lane[to]]=[neighbor,v];
 async function save(reverse){
   await change(p=>{
     if(reverse){find(p.revisions,later.id).parent=earlier.parent;find(p.revisions,earlier.id).parent=later.id}
     lane.forEach((f,i)=>{const x=find(p.revisions,f.id);x.sequence=i;delete x.canvas})
   });render();if(visualTour?.kind==="branches"&&visualTour.stage==="arrange")tourStage("branches","done")
 }
 if(later.parent===earlier.id){
   modal("Reverse the source arrow?",`<p><b>${esc(fileName(later)||later.label)}</b> will come before <b>${esc(fileName(earlier)||earlier.label)}</b>. Their source arrow will be reversed. Other versions keep their sources.</p>`,()=>save(true),"Reverse order");return
 }
 if(hasAncestor(revs,later.id,earlier.id)){toast("An intermediate version links these two. Change its source in the inspector first.");return}
 await save(false)
}
function forkRevision(revs,source,canvas){
 let name=source.branch+" fork",num=2;
 while(revs.some(v=>v.tool===source.tool&&v.branch===name))name=source.branch+" fork "+num++;
 revisionForm(null,{record:source.record,parent:source.id,tool:source.tool,branch:name,discipline:source.discipline,label:"v001",fork:true,canvas})
}
function historyView(out,revs){
 const r=record(),p=project(),prefs=r.graphPrefs||{},format=locationState.showAll?"":prefs.format,shown=format?revs.filter(v=>fileExt(fileName(v))===format):revs;
 const g=graphData(shown,r),sel=find(shown,locationState.revision)||g.nodes[0]?.v,selected=g.byId.get(sel?.id);
 const key=p.id+"/"+r.id;
 if(!graphViews.has(key))graphViews.set(key,{zoom:1,left:0,top:0});
 const view=graphViews.get(key);
 const add=()=>pickGraphFiles(r);
 out.innerHTML=`<section class="workbench">${productionPath(r,revs)}<header class="graph-toolbar"><div class="graph-title">${graphMark()}<h2>Revision graph</h2><small>${g.nodes.length} ${g.nodes.length===1?"version":"versions"}${format?" · "+esc(format):locationState.showAll?" · all formats":""}</small></div><div class="canvas-actions">${btn(traceLabel,()=>traceScreenshot(r,revs),"vision-launch")}${btn("Blender capture setup",captureGuide)}${btn("Graph settings",()=>graphSettings(r,revs))}${btn("Edit class path",()=>identityForm(r))}${p.revisions.some(v=>v.path&&v.record!==r.id)?btn("Bring tracked file",()=>chooseTracked(r)):""}${sel?btn("Manage branches",()=>go("branches",{record:r.id}))+btn("⑂ New branch",()=>forkRevision(revs,sel)):""}${btn("+ Add files",add,"primary")}</div></header><div class="bench-columns"><div class="graph-surface"><div class="graph-scroll" tabindex="0" aria-label="Revision canvas"><div class="graph-space"><div class="graph-world"><svg class="wires" aria-label="Version connections"><defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8" fill="#383632"/></marker></defs><g class="edge-list"></g><path class="pending-wire"/></svg>${g.nodes.map(n=>`<article class="rev-card ${n===selected?"selected":""}" data-node="${n.i}" data-revision="${esc(n.v.id)}" style="--node-ink:${nodeColor(n.v)}"><button type="button" class="socket inlet" aria-label="Connect source to ${esc(n.v.label)}" title="Connect source"></button><button type="button" class="rev-face" aria-label="${esc((nodeTitle(n.v))+" · "+n.v.label)}" title="${esc(n.v.path||fileName(n.v)||n.v.label)}">${prefs.previews!==false&&n.v.preview?image(n.v.preview,"rev-thumb",""):""}<span class="rev-meta">${toolIcon(toolName(n.v.tool))}${esc(toolName(n.v.tool))}</span><strong>${esc(n.v.nodeName||((!prefs.titles||prefs.titles==="file")&&fileName(n.v)?fileName(n.v):n.v.label))}</strong><span class="rev-branch">${esc([prefs.titles==="version"?fileName(n.v):prefs.titles==="short"?"":fileName(n.v)?n.v.label:"",n.v.branch].filter(Boolean).join(" · "))}</span>${n.v.engineReady?'<span class="ready-tag">✓ Engine ready</span>':""}</button><button type="button" class="socket outlet" aria-label="Connect from ${esc(n.v.label)}" title="Drag to connect a version"></button></article>`).join("")}</div></div></div>${!sel?`<div class="empty-graph">${graphMark()}<h3>${format?"No versions match this file type":"Start this asset’s history"}</h3><p>Drop a working file here, or choose files from disk.</p>${btn("Choose files…",add)}</div>`:""}<div class="zoom-tools"><button type="button" aria-label="Zoom out" data-zoom="-">−</button><output id="graphZoom"></output><button type="button" aria-label="Zoom in" data-zoom="+">+</button><button type="button" data-zoom="fit">Fit</button></div></div><aside class="revision-inspector">${sel?inspector():'<div class="eyebrow">Inspector</div><p>Select a revision to see its files and notes.</p>'}</aside></div><footer class="canvas-footer"><span id="graphHint" aria-live="polite">Drag empty space to box-select · Shift adds · Ctrl-click toggles · Middle or Alt-drag pans · F to frame</span><span>━━ Source &nbsp; ┄ Version order</span></footer></section>`;
 function inspector(){
   return `<div class="inspector-head"><small class="eyebrow">Node filename</small><div>${toolIcon(toolName(sel.tool))}<h2>${esc(nodeTitle(sel))}</h2></div><span class="chip">Version · ${esc(sel.label)}</span> <span class="chip">Branch · ${esc(sel.branch)}</span> ${sel.discipline&&sel.discipline!==sel.branch?`<small>${esc(sel.discipline)}</small>`:""}<div class="revision-picks"><i aria-hidden="true" style="background:${nodeColor(sel)}"></i>${btn("Edit node filename",()=>renameNode(sel),"small-btn")+btn("Node color",()=>colorDialog(sel),"small-btn")}${btn(sel.engineReady?"Clear engine-ready mark":"Mark engine ready",()=>setReady(r,sel),"small-btn")}</div></div>
   <div class="node-picture" tabindex="0" data-paste-node="${esc(sel.id)}">${sel.preview?image(sel.preview,"inspector-preview",sel.label):""}<div class="image-actions"><button type="button" data-paste-image>Paste screenshot</button><kbd>Ctrl+V</kbd></div><small class="paste-status" aria-live="polite"></small></div><div class="inspector-body"><div class="inspector-section"><h3>Linked files on disk <small>${selected.files.filter(f=>fileName(f)).length}</small></h3>${selected.files.map(v=>v.path?`<div class="graph-file">${btn(v.path.split(/[\\/]/).at(-1),()=>openFile(v,false),"file-link")}<small title="${esc(v.path)}">${esc(v.path)}</small><div>${btn("Reveal",()=>openFile(v,true),"text-btn")}${selected.files.length>1&&v.id!==sel.id?btn("Select file",()=>openRecord(r.id,"History",{revision:v.id}),"text-btn"):""}</div></div>`:v.exampleFilename?`<div class="graph-file"><b>${esc(fileName(v))}</b><small>Example file · preview only</small></div>`:"").join("")||"<small>Preview-only revision</small>"}</div>
   <div class="inspector-section"><label for="inlineNote">Quick note</label>${selected.files.length>1?`<small>${esc(sel.path.split(/[\\/]/).at(-1))}</small>`:""}<textarea id="inlineNote" placeholder="What changed in this version?">${esc(sel.note)}</textarea>${btn("Save note",async()=>{const note=$("#inlineNote").value.trim();await change(p=>{find(p.revisions,sel.id).note=note});render();if(visualTour?.kind==="branches"&&visualTour.stage==="note")tourStage("branches","fork");toast("Revision note saved.")},"small-btn")}${r.seriesNotes?.[sel.discipline]?`<p class="series-note">${esc(r.seriesNotes[sel.discipline])}</p>`:""}</div>
   <div class="inspector-section"><h3>Source</h3>${sel.parent?btn(revisionLabel(find(revs,sel.parent)),()=>revealRevision(r,find(revs,sel.parent)),"file-link"):"<small>Independent / unknown</small>"}${sel.parent?btn("Disconnect source",async()=>{await change(p=>{find(p.revisions,sel.id).parent=""});render()},"text-btn"):""}</div>
   <div class="inspector-section"><h3>Node order</h3>${btn("Earlier",()=>reorderVersion(r,sel,-1),"small-btn")} ${btn("Later",()=>reorderVersion(r,sel,1),"small-btn")}</div><div class="inspector-menu">${btn("Edit revision",()=>revisionForm(sel))}${btn("Fork from here",()=>forkRevision(revs,sel),"fork-from-here")}${btn("Add files from here",()=>pickGraphFiles(r,sel))}${revs.length>1?btn("Compare revisions",()=>openGraphCompare(r.id,sel.id)):""}${btn("Delete version…",()=>removeHistoryItems(r,revs,selected.files,sel.label),"danger")}${btn("Delete branch…",()=>removeHistoryItems(r,revs,revs.filter(v=>branchKey(v)===branchKey(sel)),sel.branch),"danger")}</div></div>`
 }
 if(sel)showCapture(out.querySelector(".inspector-head"),sel);
 wireGraph(out,g,r,revs,view,sel)
}
function wireGraph(out,g,r,revs,view,sel){
 const stage=out.querySelector(".graph-world"),space=stage.parentElement,scroll=space.parentElement,surface=scroll.parentElement,svg=stage.querySelector(".wires");
 const cards=[...stage.querySelectorAll(".rev-card")],edges=svg.querySelector(".edge-list"),pending=svg.querySelector(".pending-wire");
 const picks=locationState.compareSelection=(locationState.compareSelection||[]).filter(id=>g.byId.has(id));
 let gesture=null,source=null,hoverTimer,extent,edgeFrame=0,edgePointer=null;
 const marquee=document.createElement("div");marquee.className="graph-marquee";marquee.hidden=true;surface.append(marquee);
 function geometry(a,b,t=.5){
   const x=a.x+cardW,y=a.y+cardH/2,tx=b.x,ty=b.y+cardH/2,dx=Math.max(34,Math.min(200,Math.abs(tx-x)*.46));
   return {d:`M${x} ${y} C${x+dx} ${y},${tx-dx} ${ty},${tx} ${ty}`,x:(1-t)**3*x+3*(1-t)**2*t*(x+dx)+3*(1-t)*t*t*(tx-dx)+t**3*tx,y:(1-t)**2*(1+2*t)*y+t*t*(3-2*t)*ty}
 }
 function layout(){
   extent={w:Math.max(300,...g.nodes.map(n=>n.x+cardW+50)),h:Math.max(240,...g.nodes.map(n=>n.y+cardH+55))};
   stage.style.width=extent.w+"px";stage.style.height=extent.h+"px";stage.style.transform=`scale(${view.zoom})`;
   space.style.width=extent.w*view.zoom+"px";space.style.height=extent.h*view.zoom+"px";
   g.nodes.forEach(n=>{cards[n.i].style.left=n.x+"px";cards[n.i].style.top=n.y+"px"});
   const handles=[];
   edges.innerHTML=g.edges.map((e,i)=>{let q;for(const t of [.5,.34,.66,.2,.8]){q=geometry(e.a,e.b,t);if(!handles.some(h=>Math.hypot(h.x-q.x,h.y-q.y)<18)&&!g.nodes.some(n=>q.x>n.x-3&&q.x<n.x+cardW+3&&q.y>n.y-3&&q.y<n.y+cardH+3))break}handles.push(q);return `<g class="edge ${e.sequence?"sequence":""}" data-edge="${i}" role="button" tabindex="0" aria-label="Insert revision between ${esc(e.a.v.label)} and ${esc(e.b.v.label)}"><title>Insert revision between ${esc(e.a.v.label)} and ${esc(e.b.v.label)}</title><path class="edge-stroke" d="${q.d}" ${e.sequence?"":'marker-end="url(#arrow)"'}/><path class="edge-hit" d="${q.d}"/><g class="edge-plus" transform="translate(${q.x},${q.y})"><circle r="7"/><path d="M-3 0H3M0 -3V3"/></g></g>`}).join("");
   $("#graphZoom").textContent=Math.round(view.zoom*100)+"%"
 }
 const comparePicked=document.createElement("button");
 comparePicked.type="button";comparePicked.className="compare-picked";comparePicked.textContent="Compare selected revisions →";
 comparePicked.onclick=()=>openGraphCompare(r.id,sel?.id);
 const tools=out.querySelector(".canvas-actions");tools.prepend(comparePicked);
 const initialHint=$("#graphHint").textContent;
 function updateHint(){
   comparePicked.hidden=picks.length!==2;
   const messages=[initialHint,"Before selected · Ctrl-click the After revision · Esc to clear","Two selected · Right-click to compare · F to frame · Esc to clear"];
   $("#graphHint").textContent=source?"Choose a destination version, or drag into empty space to fork · Esc to cancel":messages[picks.length]||`${picks.length} selected · Drag a selected card to move the group · F to frame · Esc to clear`
 }
 function paintPicks(){
   const positions=new Map(picks.map((id,i)=>[id,i]));
   for(const n of g.nodes){
     const card=cards[n.i],side=positions.get(n.v.id)??-1;
     const badge=side<0||picks.length>2?undefined:side===0?"Before":"After";
     if(card.classList.contains("picked")===(side>=0)&&card.dataset.compareSide===badge&&card.querySelector(".rev-face").hasAttribute("aria-pressed"))continue;
     card.classList.toggle("picked",side>=0);
     if(!badge)delete card.dataset.compareSide;else card.dataset.compareSide=badge;
     card.querySelector(".rev-face").setAttribute("aria-pressed",String(side>=0))
   }
   updateHint()
 }
 function togglePick(n){
   const i=picks.indexOf(n.v.id);
   if(i>=0)picks.splice(i,1);else picks.push(n.v.id);
   paintPicks()
 }
 function arm(n){source=n;cards.forEach((c,i)=>c.classList.toggle("link-source",i===n?.i));updateHint();if(!n)pending.removeAttribute("d")}
 paintPicks();
 function point(e){const box=stage.getBoundingClientRect();return {x:(e.clientX-box.left)/view.zoom,y:(e.clientY-box.top)/view.zoom}}
 function nodeAt(target){const el=target?.closest?.("[data-node]");return el?g.nodes[Number(el.dataset.node)]:null}
 function connect(n){
   const a=source;if(!a||!n)return;arm(null);if(a===n)return;
   const parent=a.files.find(f=>f.id===sel?.id)||a.v;
   if(n.files.some(v=>hasAncestor(revs,parent.id,v.id))){toast("A version cannot descend from itself.");return}
   lastCommand="connect revisions";change(p=>{for(const f of n.files)find(p.revisions,f.id).parent=parent.id}).then(()=>{openRecord(r.id,"History",{revision:n.v.id});if(visualTour?.kind==="branches"&&visualTour.stage==="connect")tourStage("branches","arrange")}).catch(e=>toast(e.message))
 }
 function selectNode(n){openRecord(r.id,"History",{revision:n.files.find(v=>v.id===sel?.id)?.id||n.v.id});if(visualTour?.kind==="branches"&&visualTour.stage==="select")tourStage("branches","note")}
 function insert(i){const e=g.edges[i];revisionForm(null,{record:r.id,parent:e.source||e.a.v.id,tool:e.b.v.tool,discipline:e.b.v.discipline,branch:e.b.v.branch,label:"",insertTargets:e.targets})}
 layout();
 if(view.fresh!==false){view.zoom=Math.max(.9,Math.min(1,(scroll.clientWidth-8)/extent.w,(scroll.clientHeight-8)/extent.h));view.fresh=false;layout()}
 scroll.scrollLeft=view.left;scroll.scrollTop=view.top;
 const focus=g.byId.get(sel?.id);if(focus&&view.focusedId!==sel.id){view.focusedId=sel.id;const x=focus.x*view.zoom,y=focus.y*view.zoom,w=cardW*view.zoom,h=cardH*view.zoom;
   if(x<scroll.scrollLeft||x+w>scroll.scrollLeft+scroll.clientWidth)scroll.scrollLeft=Math.max(0,x-(scroll.clientWidth-w)/2);
   if(y<scroll.scrollTop||y+h>scroll.scrollTop+scroll.clientHeight)scroll.scrollTop=Math.max(0,y-(scroll.clientHeight-h)/2)
 }
 const note=out.querySelector("#inlineNote");if(note)note.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();note.nextElementSibling.click()}};
 scroll.onscroll=()=>{view.left=scroll.scrollLeft;view.top=scroll.scrollTop;clearTimeout(hoverTimer);if(!$("#quickNote")?.contains(document.activeElement))$("#quickNote")?.remove()};

 function frameSelection(all=false){
   const nodes=!all&&picks.length?picks.map(id=>g.byId.get(id)):g.nodes;if(!nodes.length)return;
   const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y));
   const w=Math.max(...nodes.map(n=>n.x))+cardW-x,h=Math.max(...nodes.map(n=>n.y))+cardH-y;
   view.zoom=Math.max(.15,Math.min(1,(scroll.clientWidth-32)/w,(scroll.clientHeight-32)/h));layout();
   scroll.scrollTo((x+w/2)*view.zoom-scroll.clientWidth/2,(y+h/2)*view.zoom-scroll.clientHeight/2)
 }
 function zoomAt(next,x,y){
   const worldX=(scroll.scrollLeft+x)/view.zoom,worldY=(scroll.scrollTop+y)/view.zoom;
   view.zoom=Math.max(.15,Math.min(2,next));layout();scroll.scrollTo(worldX*view.zoom-x,worldY*view.zoom-y)
 }
 for(const b of surface.querySelectorAll("[data-zoom]"))b.onclick=()=>{const code=b.dataset.zoom;if(code==="fit")frameSelection(true);else zoomAt(view.zoom+(code==="+"?.15:-.15),scroll.clientWidth/2,scroll.clientHeight/2)};
 scroll.addEventListener("wheel",e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();if(gesture)return;const bounds=scroll.getBoundingClientRect();zoomAt(view.zoom*(e.deltaY<0?1.15:1/1.15),e.clientX-bounds.left,e.clientY-bounds.top)},{passive:false});
 function removePicks(){const chosen=picks.map(id=>g.byId.get(id).v);if(chosen.length)removeHistoryItems(r,revs,chosen,chosen.map(v=>fileName(v)||v.label).join(", "))}
 scroll.oncontextmenu=e=>{
   const node=nodeAt(e.target);if(!node&&picks.length<2)return;
   e.preventDefault();clearTimeout(hoverTimer);arm(null);$("#quickNote")?.remove();
   surface.querySelector(".compare-menu")?.remove();
   const menu=document.createElement("div");menu.className="compare-menu";menu.popover="auto";menu.setAttribute("role","group");menu.setAttribute("aria-label","Selected revisions");
   if(picks.length===2){
     const pair=picks.map(id=>g.byId.get(id).v),sameName=nodeTitle(pair[0])===nodeTitle(pair[1]);
     menu.innerHTML=pair.map((v,i)=>{const name=nodeTitle(v)+(sameName&&v.path?" · "+v.path:"");return `<small title="${esc(v.path||v.label)}"><b>${i?"After":"Before"}</b> ${esc(name)}</small>`}).join("")
   }else menu.innerHTML=`<small>${picks.length} revisions selected</small>`;
   function action(label,fn){const b=document.createElement("button");b.type="button";b.textContent=label;b.onclick=()=>{menu.hidePopover();fn()};menu.append(b)}
   if(picks.length===2)action("Compare revisions",()=>openGraphCompare(r.id));
   if(node){action("Edit node filename",()=>renameNode(node.v));action("Edit revision",()=>revisionForm(node.v))}
   action("Frame selection",()=>frameSelection());action("Clear selection",()=>{picks.length=0;paintPicks()});action("Remove selected from history…",removePicks);
   surface.append(menu);
   menu.ontoggle=()=>{if(!menu.matches(":popover-open"))menu.remove()};
   menu.showPopover();
   const anchor=node?cards[node.i]:scroll,box=anchor.getBoundingClientRect(),size=menu.getBoundingClientRect();
   menu.style.left=Math.max(6,Math.min(e.clientX||box.left,innerWidth-size.width-6))+"px";
   menu.style.top=Math.max(6,Math.min(e.clientY||box.bottom,innerHeight-size.height-6))+"px";
   menu.querySelector("button").focus({preventScroll:true})
 };

 scroll.onpointerdown=e=>{
   if(gesture||![0,1].includes(e.button))return;
   const n=nodeAt(e.target),pan=e.button===1||e.altKey||(!n&&e.pointerType==="touch");
   if(!pan&&e.target.closest("[data-edge]"))return;
   clearTimeout(hoverTimer);$("#quickNote")?.remove();
   let mode;
   if(pan){mode="pan";arm(null)}
   else if(n&&e.target.closest(".rev-face")&&(e.ctrlKey||e.metaKey||e.shiftKey)){mode="pick";arm(null)}
   else if(e.target.closest(".outlet")){mode="link";arm(n)}
   else if(n)mode=source?"target":"move";
   else{mode="box";arm(null)}
   const group=mode==="move"?(picks.includes(n.v.id)?picks.map(id=>g.byId.get(id)):[n]):[];
   gesture={mode,n,x:e.clientX,y:e.clientY,start:point(e),original:[...picks],add:e.shiftKey||e.ctrlKey||e.metaKey,
     group:group.map(node=>({node,x:node.x,y:node.y})),left:scroll.scrollLeft,top:scroll.scrollTop,moved:false,pointer:e.pointerId};
   scroll.classList.toggle("panning",pan);
   scroll.focus({preventScroll:true});scroll.setPointerCapture(e.pointerId);e.preventDefault()
 };
 function selectBox(d,pt){
   const x=Math.min(d.start.x,pt.x),y=Math.min(d.start.y,pt.y),right=Math.max(d.start.x,pt.x),bottom=Math.max(d.start.y,pt.y);
   const ids=new Set(d.add?d.original:[]);
   for(const n of g.nodes)if(n.x<=right&&n.x+cardW>=x&&n.y<=bottom&&n.y+cardH>=y)ids.add(n.v.id);
   picks.splice(0,picks.length,...ids);paintPicks();
   const bounds=scroll.getBoundingClientRect(),world=stage.getBoundingClientRect();
   const left=Math.max(bounds.left,world.left+x*view.zoom),top=Math.max(bounds.top,world.top+y*view.zoom);
   marquee.hidden=false;Object.assign(marquee.style,{left:left-bounds.left+"px",top:top-bounds.top+"px",
     width:Math.max(0,Math.min(bounds.left+scroll.clientWidth,world.left+right*view.zoom)-left)+"px",
     height:Math.max(0,Math.min(bounds.top+scroll.clientHeight,world.top+bottom*view.zoom)-top)+"px"})
 }
 function scrollBoxAtEdge(){
   edgeFrame=0;
   if(!edgePointer||gesture?.mode!=="box"||!scroll.isConnected)return;
   const b=scroll.getBoundingClientRect(),{clientX,clientY}=edgePointer;
   const speed=(p,start,end)=>p<start+24?-Math.min(14,(start+24-p)/2):p>end-24?Math.min(14,(p-end+24)/2):0;
   const left=scroll.scrollLeft,top=scroll.scrollTop;
   scroll.scrollBy(speed(clientX,b.left,b.left+scroll.clientWidth),speed(clientY,b.top,b.top+scroll.clientHeight));
   if(scroll.scrollLeft===left&&scroll.scrollTop===top)return;
   selectBox(gesture,point(edgePointer));edgeFrame=requestAnimationFrame(scrollBoxAtEdge)
 }
 scroll.onpointermove=e=>{
   const pt=point(e);if(source)pending.setAttribute("d",geometry(source,{x:pt.x,y:pt.y-cardH/2}).d);
   const d=gesture;if(!d||d.pointer!==e.pointerId)return;
   const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.moved&&Math.hypot(dx,dy)<4)return;d.moved=true;
   if(d.mode==="box"){
     selectBox(d,pt);edgePointer={clientX:e.clientX,clientY:e.clientY};
     if(!edgeFrame)edgeFrame=requestAnimationFrame(scrollBoxAtEdge)
   }
   if(d.mode==="move"){
     if(picks.length&&!picks.includes(d.n.v.id)){picks.length=0;paintPicks()}
     const mx=Math.max(8-Math.min(...d.group.map(v=>v.x)),Math.round((pt.x-d.start.x)/4)*4);
     const my=Math.max(8-Math.min(...d.group.map(v=>v.y)),Math.round((pt.y-d.start.y)/4)*4);
     for(const {node,x,y} of d.group){node.x=x+mx;node.y=y+my;cards[node.i].classList.add("moving")}
     layout()
   }
   if(d.mode==="pan"){scroll.scrollLeft=d.left-dx;scroll.scrollTop=d.top-dy}
 };
 function finish(e,cancel){
   const d=gesture;if(!d||d.pointer!==e.pointerId)return;gesture=null;
   cancelAnimationFrame(edgeFrame);edgeFrame=0;edgePointer=null;
   if(scroll.hasPointerCapture(d.pointer))scroll.releasePointerCapture(d.pointer);
   scroll.classList.remove("panning");marquee.hidden=true;
   for(const {node} of d.group)cards[node.i].classList.remove("moving");
   if(cancel){
     if(d.mode==="move"){for(const {node,x,y} of d.group){node.x=x;node.y=y}layout()}
     if(d.mode==="box"||d.mode==="move"){picks.splice(0,picks.length,...d.original);paintPicks()}
     arm(null);return
   }
   if(d.mode==="box"){if(!d.moved&&!d.add){picks.length=0;paintPicks()}return}
   const hit=nodeAt(document.elementFromPoint(e.clientX,e.clientY));
   if(d.mode==="link"){if(d.moved){if(hit)connect(hit);else{const pt=point(e),inside=surface.contains(document.elementFromPoint(e.clientX,e.clientY));arm(null);if(inside)forkRevision(revs,d.n.files.find(f=>f.id===sel?.id)||d.n.v,{x:Math.max(8,pt.x-cardW/2),y:Math.max(8,pt.y-cardH/2)})}}return}
   if(d.mode==="pick"){if(!d.moved&&hit===d.n)togglePick(d.n);return}
   if(d.mode==="target"){connect(hit||d.n);return}
   if(d.mode!=="move")return;if(!d.moved){selectNode(d.n);return}
   lastCommand=d.group.length>1?"move selected revisions":"move revision";
   change(p=>{for(const {node} of d.group)find(p.revisions,node.v.id).canvas={x:node.x,y:node.y}}).then(()=>{render();if(visualTour?.kind==="branches"&&visualTour.stage==="arrange")tourStage("branches","done")}).catch(err=>{render();toast(err.message)})
 }
 scroll.onpointerup=e=>finish(e,false);scroll.onpointercancel=e=>finish(e,true);scroll.onlostpointercapture=e=>finish(e,true);
 scroll.onclick=e=>{const edge=e.target.closest("[data-edge]");if(edge){insert(Number(edge.dataset.edge));return}if(e.detail>0)return;const n=nodeAt(e.target);if(!n)return;if(e.target.closest(".outlet"))arm(n);else if(source)connect(n);else selectNode(n)};
 scroll.onkeydown=e=>{if(e.key==="Escape"){if(gesture)finish({pointerId:gesture.pointer},true);else{picks.length=0;paintPicks();arm(null)}$("#quickNote")?.remove();return}
   if(gesture)return;
   if(e.key==="Delete"&&picks.length){e.preventDefault();removePicks();return}
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="a"){e.preventDefault();picks.splice(0,picks.length,...g.nodes.map(n=>n.v.id));paintPicks();return}
   if(!e.altKey&&!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==="f"){e.preventDefault();frameSelection();return}
   const edge=e.target.closest("[data-edge]");if(edge&&["Enter"," "].includes(e.key)){e.preventDefault();insert(Number(edge.dataset.edge))}const n=nodeAt(e.target);if(n&&(e.ctrlKey||e.metaKey)&&e.key==="Enter"&&e.target.closest(".rev-face")){e.preventDefault();arm(null);togglePick(n);return}if(n&&e.key==="ArrowDown"){e.preventDefault();showQuickNote(cards[n.i],n.files);$("#quickNote textarea")?.focus()}};
 for(const n of g.nodes){const card=cards[n.i];card.onpointerenter=e=>{if(e.pointerType==="touch"||gesture||source||picks.length)return;clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>{if(card.isConnected&&!gesture&&!source&&card.matches(":hover"))showQuickNote(card,n.files)},450)}}
 surface.ondragover=e=>{if(e.dataTransfer.types.includes("Files")){e.preventDefault();e.dataTransfer.dropEffect="link";surface.classList.add("file-over")}};
 surface.ondragleave=e=>{if(!surface.contains(e.relatedTarget))surface.classList.remove("file-over")};
 surface.ondrop=async e=>{e.preventDefault();surface.classList.remove("file-over");const target=nodeAt(e.target);try{await droppedGraphFiles(r,[...e.dataTransfer.files],target?.v)}catch(err){toast(err.message)}}
}
async function pickGraphFiles(r,parent){
 const {paths}=await post("pick",{kind:"files"});if(paths.length&&record()?.id===r.id)graphFileReview(r,paths.map(path=>({path})),parent)
}
async function droppedGraphFiles(r,files,parent){
 if(!files.length)return;
 if(files.length>200)throw Error("Add up to 200 files per batch.");
 const info=files.map(f=>({name:f.name,size:f.size,mtime:f.lastModified}));
 const result=await post("drop-matches",{project:project().id,files:info});
 if(record()?.id!==r.id)return;
 graphFileReview(r,info.map((f,i)=>({...f,path:result.matches[i].length===1?result.matches[i][0]:"",matches:result.matches[i]})),parent)
}
function graphFileReview(r,entries,parent){
 const p=project(),catalog=toolCatalog(p);
 const rows=[];
 let skipped=0;
 function add(row){
   if(row.path&&rows.some(x=>x.path&&pathKey(x.path)===pathKey(row.path))){skipped++;return}
   const name=row.name||row.path.split(/[\\/]/).at(-1),tool=detectSoftware(p,row.path||name,find(p.tools,parent?.tool)?.name),registered=p.tools.find(t=>t.name===tool);
   const info=seriesInfo(row.path||name,registered?.task||formatsByTool[tool]?.stages[0]||"");
   const branch=(parent?.tool===registered?.id&&parent?parent.branch:"")||info.task||"Main";
   const draft={...row,name,tool,label:info.label,task:info.task,branch,note:""};loadTracked(draft);rows.push(draft)
 }
 function resolvedPath(row){if(!row.tool)row.tool=detectSoftware(p,row.path);if(row.tool&&!row.task){row.task=p.tools.find(t=>t.name===row.tool)?.task||formatsByTool[row.tool]?.stages[0]||"";if(row.branch==="Main"&&row.task)row.branch=row.task}loadTracked(row)}
 function loadTracked(row){
   const v=trackedAt(p,row.path);if(!v)return;
   Object.assign(row,{tool:toolName(v.tool),label:v.label,task:v.discipline,branch:v.branch,note:v.note})
 }
 entries.forEach(add);
 if(!rows.length)return;
 const otherSources=p.revisions.filter(v=>v.record===r.id);
 modal("Add files to "+r.name,`<p class="sub">Each entry links to its original file. Add sources and exports from any folder.</p><div id="fileQueue"></div><div class="bar">${btn("+ More files…",async()=>{const {paths}=await post("pick",{kind:"files"});for(const path of paths)add({path});draw()})}</div>`+
 select("importParent","Derived from",opt("","Keep existing sources / match Start and Final",parent?.id)+otherSources.map(v=>opt(v.id,revisionLabel(v)+(v.path?" · "+v.path.split(/[\\/]/).at(-1):""),parent?.id)).join("")),async()=>{
   if(!rows.length)throw Error("Choose a file first.");
   const source=val("importParent");let first;
   await change(p=>{
     const used=new Set(),milestones=new Map();
     for(const row of rows){
       if(!row.path)throw Error("Locate the original file for "+row.name+".");
       if(used.has(pathKey(row.path)))throw Error(row.name+" was picked twice. Remove one copy from the review.");
       const name=row.tool.trim();if(!name||!row.label.trim()||!row.branch.trim())throw Error("Enter the software, version and branch for "+row.name+".");
       let tool=p.tools.find(t=>t.name.toLowerCase()===name.toLowerCase());
       if(!tool){const extensions=catalog.get(name)||fileExt(row.name);tool={id:id(),name,extensions:extensions.split(/[,;\s]+/).filter(Boolean).map(e=>"."+e.replace(/^\./,"")).join(","),folders:[]};p.tools.push(tool)}
       const task=row.task||tool.task||"",tracked=trackedAt(p,row.path);
       if(source&&tracked?.id===source)throw Error("Choose a different source for "+row.name+".");
       const v=tracked||{id:id(),record:r.id,path:row.path,parent:"",preview:"",comparisons:[]};
       if(tracked)moveTracked(p,v,r.id);else p.revisions.push(v);
       Object.assign(v,{tool:tool.id,discipline:task,branch:row.branch.trim(),label:row.label.trim(),note:row.note.trim()});
       if(source)v.parent=source;
       else if(!tracked&&/^(Start|Final)$/i.test(v.label))milestones.set(formatLane(v),v);
       if(task)ensureSection(p,task);first||=v;used.add(pathKey(row.path))
     }
     for(const v of milestones.values())connectMilestones(p,r.id,v.tool,v.branch,fileExt(fileName(v)))
   });
   await revealRevision(find(project().records,r.id),first);toast("History saved.")
 },"Save to history");
 async function locate(row){const {path}=await post("pick",{kind:"file"});if(!path)return;if(path.split(/[\\/]/).at(-1).toLowerCase()!==row.name.toLowerCase())throw Error("Choose the original "+row.name+".");row.path=path;resolvedPath(row);draw()}
 function draw(){
   const queue=$("#fileQueue");if(!queue)return;
   queue.innerHTML=`<datalist id="fileToolNames">${[...catalog.keys()].map(n=>opt(n,n,"")).join("")}</datalist>${skipped?`<small>${skipped} repeated selections skipped.</small>`:""}`+
   rows.map((row,i)=>`<section class="file-draft"><header><b>${esc(row.name)}</b><small>${esc(fileExt(row.name))}</small>${btn("×",()=>{rows.splice(i,1);draw()},"small-btn")}</header>${trackedAt(p,row.path)?`<p class="transfer-note">${esc(transferMessage(p,trackedAt(p,row.path),r.id))}</p>`:""}${row.path?`<small class="path">${esc(row.path)}</small>${row.matches?btn("Change original…",()=>locate(row),"text-btn"):""}`:`<p>${row.matches?.length?"Several originals match. Choose the path.":"Locate this original once so it can open from the graph."}</p>${row.matches?.length?`<select aria-label="Choose original path" data-row="${i}" data-prop="path">${opt("","Choose a path","")}${row.matches.map(path=>opt(path,path,"")).join("")}</select>`:""}${btn("Locate original…",()=>locate(row))}`}
   ${!row.tool?'<small>Choose the software that created this file.</small>':""}<div class="file-fields">${[["tool","Software"],["label","Version"],["branch","Branch"]].map(([k,title])=>`<div><label for="batch-${i}-${k}">${title}</label><input id="batch-${i}-${k}" data-row="${i}" data-prop="${k}" ${k==="tool"?'list="fileToolNames"':""} value="${esc(row[k])}" required></div>`).join("")}</div><label for="batch-note-${i}">Quick note</label><input id="batch-note-${i}" data-row="${i}" data-prop="note" value="${esc(row.note)}" placeholder="What changed?"></section>`).join("");
   queue.oninput=e=>{const k=e.target.dataset.prop;if(k){const row=rows[Number(e.target.dataset.row)];row[k]=e.target.value;if(k==="path"){resolvedPath(row);draw()}
       if(k==="tool"&&catalog.has(row.tool)){const task=p.tools.find(t=>t.name===row.tool)?.task||formatsByTool[row.tool]?.stages[0]||row.task;if(row.branch===row.task||row.branch==="Main"){row.branch=task||"Main";queue.querySelector(`[data-row="${e.target.dataset.row}"][data-prop="branch"]`).value=row.branch}row.task=task}}}
 }
 draw()
}
