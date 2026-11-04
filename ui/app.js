"use strict";
const $=s=>document.querySelector(s), main=$("#main"), rail=$("#rail"), dialog=$("#editor");
let data, version, token, hasKey, locationState, query="", classFilter="", timer, busy=false;
let actions=[], formAction, activeDrawer, candidates=[], scanIssues=[], scanSignature="", draft="", recall="", pairStamp="";
const id=()=>crypto.randomUUID();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const find=(arr,key)=>arr.find(x=>x.id===key);
const project=()=>find(data.projects,locationState.project)||data.projects[0];
const record=()=>find(project().records,locationState.record);
const toolName=key=>find(project().tools,key)?.name||"Unknown tool";
const recordName=key=>find(project().records,key)?.name||"Unknown record";
const textBlock=t=>`<div class="text">${esc(t)}</div>`;
const image=(ref,cls,alt)=>/^\/(?:art\/[a-z-]+\.jpg|media\/[a-f0-9]{32})$/.test(ref||"")?`<img class="${cls}" alt="${esc(alt)}" src="${esc(ref)}">`:`<div class="placeholder ${cls}">No preview</div>`;
function bind(fn){actions.push(fn);return actions.length-1}
const btn=(label,fn,cls="")=>`<button type="button" class="${cls}" data-a="${bind(fn)}">${esc(label)}</button>`;
const opt=(val,label,sel)=>`<option value="${esc(val)}" ${val===sel?"selected":""}>${esc(label)}</option>`;
const opts=(arr,sel)=>arr.map(x=>opt(x.id,x.name,sel)).join("");
const head=(crumb,title,buttons="")=>`<div class="eyebrow">${esc(crumb)}</div><div class="top"><h1>${esc(title)}</h1><div class="actions">${buttons}</div></div>`;
const empty=msg=>`<p class="empty">${esc(msg)}</p>`;
function toast(msg){$("#toast").textContent=msg;clearTimeout(timer);timer=setTimeout(()=>$("#toast").textContent="",6500)}
async function post(route,body){const res=await fetch("/api/"+route,{method:"POST",headers:{"Content-Type":"application/json","X-Brain-Token":token},body:JSON.stringify(body)});const r=await res.json();if(!res.ok)throw Error(r.error||res.statusText);return r}
let editHistory={undo:null,redo:null},lastCommand="workspace change";
async function travelEdit(direction){
 if(busy||!editHistory[direction])return;
 busy=true;const label=editHistory[direction];
 try{
   const res=await post(direction,{version});
   data=res.state;version=res.version;editHistory=res.history;lastRemoval=null;scanSignature="";
   if(!find(data.projects,locationState.project))locationState={project:data.projects[0].id,view:"home"};
   if(locationState.view==="setup"){guide=null;intake=null;manifest=[];localStorage.removeItem(intakeSlot);go("home")}else render();
   toast((direction==="undo"?"Undid ":"Redid ")+label+".")
 }finally{busy=false}
}
function undoBar(){
 return `<div class="edit-history" aria-label="Saved edit history">${["undo","redo"].map((d,i)=>`<button type="button" ${editHistory[d]?"":"disabled"} title="${esc(editHistory[d]||"No saved edit")} · ${i?"Ctrl+Shift+Z":"Ctrl+Z"}" data-a="${bind(()=>travelEdit(d))}">${i?"↷ Redo":"↶ Undo"}</button>`).join("")}</div>`
}
document.addEventListener("keydown",e=>{
 if(dialog.open||e.target.closest?.("input,textarea,select,[contenteditable=true]")||!(e.ctrlKey||e.metaKey)||e.altKey)return;
 const k=e.key.toLowerCase();if(k!=="z"&&k!=="y")return;
 e.preventDefault();travelEdit(k==="y"||e.shiftKey?"redo":"undo").catch(err=>toast(err.message))
});
const productionSections=()=>["2D Sprites","3D Modeling","Texturing"].map(name=>({id:id(),name,kind:"Collection",fields:[]}));
const iconNames={
 "JangaFX GeoGen":"geogen","Cinema 4D":"cinema","Rhino":"rhino","SketchUp":"sketchup","3DCoat":"threedcoat","Plasticity":"plasticity","Marvelous Designer":"marvelous","CLO":"clo","LightWave 3D":"lightwave","World Machine":"worldmachine","SpeedTree":"speedtree","Mudbox":"autodesk","MotionBuilder":"autodesk","Fusion":"autodesk","Modo":"foundry","Quixel Mixer":"mixer","JangaFX EmberGen":"embergen","JangaFX LiquiGen":"liquigen","JangaFX IlluGen":"illugen","Gaea":"gaea","Marmoset Toolbag":"toolbag","RizomUV":"rizomuv","Asset Forge":"assetforge","Notion":"notion","Obsidian":"obsidian","Miro":"miro","Google Docs":"docs","ChatGPT":"chatgpt","Codex":"codex","Claude":"claude","Krita":"krita","Photoshop":"photoshop","Illustrator":"illustrator","Aseprite":"aseprite","Affinity Designer":"affinity","Clip Studio Paint":"clip","Blender":"blender","Maya":"maya","ZBrush":"zbrush","3ds Max":"max","Houdini":"houdini","Blockbench":"blockbench","Substance 3D Painter":"painter","Substance Painter":"painter","Substance 3D Designer":"designer","Mari":"mari","ArmorPaint":"armor","Spine":"spine","Cascadeur":"cascadeur","Mixamo":"mixamo","After Effects":"aftereffects","REAPER":"reaper","Audacity":"audacity","FL Studio":"flstudio","Ableton Live":"ableton","FMOD Studio":"fmod","Wwise":"wwise","Unreal Engine":"unreal","UEFN":"uefn","Unity":"unity","Godot":"godot","Roblox Studio":"roblox","Meta Horizon Worlds":"meta","GameMaker":"gamemaker","OBS Studio":"obs","Xbox Game Bar":"xbox","NVIDIA App":"nvidia","ShareX":"sharex","DaVinci Resolve":"resolve","Premiere Pro":"premiere","CapCut":"capcut","Final Cut Pro":"finalcut","Canva":"canva","Figma":"figma","Steamworks":"steam","itch.io":"itch","Creator Portal":"fortnite","Roblox Creator Dashboard":"roblox","Meta Horizon Creator Portal":"meta"
};
const productBadges={"Substance 3D Sampler":["Sa","#466710"],"Substance 3D Modeler":["Md","#496d14"],"Substance 3D Stager":["Sg","#486810"],MagicaVoxel:["MV","#386c93"],MeshLab:["ML","#526d3d"],RealityScan:["RS","#825626"],"Agisoft Metashape":["MS","#3d7185"],Terragen:["TG","#48617c"]};
function toolIcon(name){
 const match=Object.keys(iconNames).find(n=>n.toLowerCase()===String(name).toLowerCase().replace(/^(adobe|autodesk)\s+/,""));
 const badge=productBadges[name];if(badge)return `<span class="tool-icon tool-initial" style="background:${badge[1]};color:white" aria-hidden="true">${badge[0]}</span>`;
 return match?`<img class="tool-icon" alt="" src="/art/logo-${iconNames[match]}.${["geogen","threedcoat"].includes(iconNames[match])?"svg":"jpg"}">`:`<span class="tool-icon tool-initial" aria-hidden="true">${esc((name||"Tool").slice(0,2).toUpperCase())}</span>`
}
function toolButton(name,fn,cls=""){return `<button type="button" data-a="${bind(fn)}" class="${cls}">${toolIcon(name)} ${esc(name)}</button>`}
async function change(edit){
 if(busy)throw Error("A save is in progress.");
 busy=true;
 try{const next=structuredClone(data);edit(find(next.projects,project().id),next);const result=await post("save",{version,state:next,label:dialog.open?activeDrawer:lastCommand});editHistory=result.history;data=next;version=result.version}finally{busy=false}
}
function go(view,extras={}){
 locationState={project:project().id,view,...extras};query="";classFilter="";draft="";recall="";render()
}
function openRecord(key,tab,more={}){
 const p=project(),format=find(p.records,key)?.graphPrefs?.format,v=more.revision&&find(p.revisions,more.revision);
 const showAll=!!(format&&v&&fileExt(v.path)!==format);
 go("record",{record:key,tab:tab||(p.revisions.some(v=>v.record===key)?"History":"Overview"),...more,showAll})
}
const dialogButtonAction=new WeakMap();
function render(){
 // A pending save or undo can refresh the graph while another form is open.
 if(dialog.open)for(const b of dialog.querySelectorAll("[data-a]")){
   if(!dialogButtonAction.has(b))dialogButtonAction.set(b,actions[Number(b.dataset.a)])
 }
 document.querySelector("#quickNote")?.remove();actions=[];const p=project(),s=locationState;updateCompoundFormats(p);
 document.body.classList.remove("booting");
 document.body.classList.toggle("in-guide",s.view==="setup");
 if(s.view==="setup"){
   localStorage.setItem("gdb.view",JSON.stringify(s));document.title="Studio setup · Game Dev Brain";
   rail.innerHTML="";if(s.practice&&guide){setupView();refreshCoach()}else studioIntake();return
 }
 localStorage.setItem("gdb.view",JSON.stringify(s));document.title=`${p.name} · Game Dev Brain`;
 rail.innerHTML=`<div class="rail-brand">${graphMark()}<b>Game Dev Brain</b></div><small>Workspace</small><select id="projectPicker" aria-label="Project">${opts(data.projects,p.id)}</select>${btn("Asset library",()=>go("home"),["home","record","branches"].includes(s.view)?"active":"")}${btn("Software & folders",()=>go("software"),s.view==="software"?"active":"")}${btn("Search project",()=>go("search"),s.view==="search"?"active":"")}${btn("Project settings",()=>projectOptions(p))}<hr><details class="rail-sections" ${s.view==="section"?"open":""}><summary>Project sections</summary>${sectionNavigation(p,s)}${btn("+ New section",()=>sectionForm())}</details><div class="push"></div><hr>${btn("Ask this project",()=>go("ask"),s.view==="ask"?"active":"")}${metaRailButton()}${btn("Setup guide",startSetup)}${btn("+ New project",newProject)}`;
 $("#projectPicker").onchange=e=>{locationState={project:e.target.value,view:"home"};go("home")};
 if(s.view==="section"&&find(p.sections,s.section))showSection();
 else if(s.view==="branches"&&record())branchManager();
 else if(s.view==="record"&&record())showRecord();
 else if(s.view==="software")software();
 else if(s.view==="ask")askView();
 else if(s.view==="search")searchView();
 else home();
 main.insertAdjacentHTML("afterbegin",undoBar());
}
function assetArt(r,cls=""){return r.cover||!r.emoji?image(r.cover,cls,r.name):`<div class="placeholder asset-emoji ${cls}">${esc(r.emoji)}</div>`}
function card(r){return `<button type="button" class="card" data-a="${bind(()=>openRecord(r.id))}">${assetArt(r)}<section><small>${esc(find(project().classes,r.cls)?.name||find(project().sections,r.section)?.name)}</small><h3>${esc(r.name)}</h3><p>${esc(r.description.slice(0,95))}</p></section></button>`}
function home(){
 const p=project(),demo=p.id==="brine";
 const guide=[
 ["Trace a branch","Select v007.2. Follow its two handoffs to Painter and ZBrush.",()=>openRecord("lamp","History",{revision:"l72"})],
 ["Compare the handles","Compare v007.1 with v007.2. Choose Highlight changes to see the handle difference on both images.",()=>openRecord("lamp","Compare",{before:"l71",after:"l72"})],
 ["Follow a reference","Open Harbor lantern from the key-art record. Check its Used in tab.",()=>openRecord("capsule")],
 ["Track a real file","Pick software, link a folder, scan it, then attach a file to a record.",()=>go("software")],
 ["Try a mechanic","Open Patrol & detection and follow its Canopy sentry reference.",()=>{locationState.project="canopy";openRecord("patrol")}]
 ].filter((task,index)=>[p.revisions.some(v=>v.id==="l72"),["l71","l72"].every(id=>find(p.revisions,id)),!!find(p.records,"capsule"),true,!!find(data.projects,"canopy")?.records.some(r=>r.id==="patrol")][index]);
 main.innerHTML=head(p.name,"Asset library",btn("Project settings",()=>projectOptions(p))+btn("+ Root class",()=>classForm())+btn("+ Add asset",()=>recordForm(),"primary"))+
 `<div class="library-caption"><span>${p.records.length} assets & records</span><span>${p.revisions.length} revision entries</span><span>${p.tools.length} tools</span></div><div class="asset-table"><div class="asset-line asset-columns"><span>Asset</span><span>Software</span><span>History</span></div>${classLibrary(p,r=>{const revs=p.revisions.filter(v=>v.record===r.id),tools=[...new Set(revs.map(v=>toolName(v.tool)))];return `<button class="asset-line" data-a="${bind(()=>openRecord(r.id))}"><span class="asset-cell">${r.cover?image(r.cover,"asset-thumb",r.name):`<i class="asset-thumb">${esc(r.emoji||"◇")}</i>`}<span><b>${esc(r.name)}</b><small>${esc(classPath(r.cls)||find(p.sections,r.section)?.name)}</small></span></span><span class="asset-tools">${tools.map(n=>`<span title="${esc(n)}">${toolIcon(n)}</span>`).join("")||"—"}</span><span>${revs.length?new Set(revs.map(branchKey)).size+" branches":"Open record"} ↗</span></button>`})||empty("Add your first asset to start its history.")}</div>`+
 `<details class="library-guide"><summary>Project guide</summary>${btn("Practice the basics",startPractice)}${p.id==="canopy"&&find(p.records,"bird")?btn("Trace the example playtest frame",()=>{openRecord("bird","History");traceScreenshot(record(),p.revisions.filter(v=>v.record==="bird"),true)}):""}${demo?guide.map(([name,desc,fn])=>`<div class="row"><div class="grow"><b>${esc(name)}</b><p>${esc(desc)}</p></div>${btn("Open →",fn)}</div>`).join(""):""}</details>`;
}
function sectionNavigation(p,s){
 const link=sec=>btn(sec.name,()=>go("section",{section:sec.id}),s.section===sec.id?"active":"");
 const inactive=p.sections.filter(sec=>p.disciplines&&categoryLabels.includes(sec.name)&&!p.disciplines.includes(sec.name));
 return p.sections.filter(sec=>!inactive.includes(sec)).map(link).join("")+(inactive.length?`<details class="inactive-sections" ${inactive.some(sec=>sec.id===s.section)?"open":""}><summary>Other disciplines</summary>${inactive.map(link).join("")}</details>`:"")
}
function activeDisciplines(p){
 if(Array.isArray(p.disciplines))return categoryLabels.filter(n=>p.disciplines.includes(n));
 return categoryLabels.filter((n,i)=>p.sections.some(s=>s.name.toLowerCase()===n.toLowerCase())||
   (p.workflow||[]).some(w=>w.stage===setupStages[i][0])||p.revisions.some(v=>v.discipline===n)||p.tools.some(t=>t.task===n||t.disciplines?.includes(n)))
}
function disciplineTools(p,i){
 const assigned=(p.workflow||[]).filter(w=>w.stage===setupStages[i][0]).map(w=>w.tool);
 return p.tools.filter(t=>assigned.includes(t.id)||(!Array.isArray(p.disciplines)&&(t.task===categoryLabels[i]||t.disciplines?.includes(categoryLabels[i])||p.revisions.some(v=>v.tool===t.id&&v.discipline===categoryLabels[i])))).map(t=>t.name)
}
function disciplineSettings(p){
 const active=activeDisciplines(p);
 return `<fieldset class="discipline-settings"><legend>Project disciplines</legend><p>Pick the work you handle. Expand a discipline to choose its software.</p>${setupStages.map(([stage,,catalog],i)=>{
   const name=categoryLabels[i],enabled=active.includes(name),chosen=disciplineTools(p,i);
   const tools=[...new Set([...catalog.map(([n])=>p.tools.find(t=>t.name.toLowerCase()===n.toLowerCase())?.name||n),...p.tools.map(t=>t.name)])];
   return `<div class="discipline-item"><label class="discipline-choice"><input type="checkbox" data-stage="${i}" ${enabled?"checked":""}><strong>${esc(name)}</strong></label><details ${enabled?"":"hidden"}><summary>Software <span>${chosen.length}</span></summary><div class="discipline-tools">${tools.map(n=>`<label><input type="checkbox" value="${esc(n)}" ${chosen.includes(n)?"checked":""}>${toolIcon(n)} ${esc(n)}</label>`).join("")}</div></details></div>`
 }).join("")}</fieldset>`
}
function saveDisciplines(p,rows){
 const previous=p.workflow||[],managed=new Set(setupStages.map(s=>s[0]));
 const active=rows.filter(row=>row.enabled);
 p.disciplines=active.map(row=>categoryLabels[row.i]);
 p.workflow=(p.workflow||[]).filter(w=>!managed.has(w.stage));
 for(const {i,tools} of active){
   const [stage,,catalog]=setupStages[i],name=categoryLabels[i],section=ensureSection(p,name);
   for(const software of tools){
     let t=p.tools.find(t=>t.name===software);
     if(!t){const ext=catalog.find(([n])=>n===software)?.[1];if(!ext)throw Error("Unknown software: "+software);
       t={id:id(),name:software,extensions:ext.split(",").map(e=>"."+e).join(","),folders:[]};p.tools.push(t)}
     p.workflow.push(previous.find(w=>w.stage===stage&&w.tool===t.id)||{stage,tool:t.id,section:section.id})
   }
 }
 for(const t of p.tools){
   const enabled=active.filter(row=>row.tools.includes(t.name)).map(row=>categoryLabels[row.i]);
   t.disciplines=[...new Set([...(t.disciplines||[]).filter(n=>!categoryLabels.includes(n)),...enabled])];
   if(enabled.length&&!enabled.includes(t.task))t.task=enabled[0]
 }
}
function wireDisciplineSettings(){
 const el=$(".discipline-settings");
 el.onchange=e=>{
   const row=e.target.closest(".discipline-item");if(!row)return;
   const details=row.querySelector("details");
   if(e.target.hasAttribute("data-stage")){details.hidden=!e.target.checked;details.open=e.target.checked}
   details.querySelector("summary span").textContent=details.querySelectorAll("input:checked").length
 }
}
function readDisciplineSettings(){
 return [...document.querySelectorAll(".discipline-item")].map(row=>{
   const toggle=row.querySelector("[data-stage]");return {i:Number(toggle.dataset.stage),enabled:toggle.checked,tools:[...row.querySelectorAll("details input:checked")].map(el=>el.value)}
 })
}
function projectOptions(p){
 modal("Project settings",input("projectName","Project name",p.name,"text",true)+disciplineSettings(p),async()=>{
   const name=need("projectName"),rows=readDisciplineSettings();await change(current=>{current.name=name;saveDisciplines(current,rows)});render();toast("Project settings saved.")
 });wireDisciplineSettings();
 if(data.projects.length>1)$("#fields").insertAdjacentHTML("beforeend",btn("Remove project…",()=>modal("Remove project",
   `<p>Remove <b>${esc(p.name)}</b> and its ${p.records.length} records from your library? Source files stay on disk. Undo restores the project.</p>`,
   async()=>{await change((current,state)=>{state.projects=state.projects.filter(x=>x.id!==p.id)});locationState={project:data.projects[0].id,view:"home"};render()},"Remove project"),"danger"))
}
function showSection(){
 const p=project(),sec=find(p.sections,locationState.section),classes=p.classes.filter(c=>c.section===sec.id);
 const related=new Set(p.revisions.filter(v=>v.discipline===sec.name).map(v=>v.record));
 const items=p.records.filter(r=>(r.section===sec.id||related.has(r.id))&&(!classFilter||lineage(r.cls).some(c=>c.id===classFilter)));
 main.innerHTML=head(p.name+" / Project sections",sec.name,btn("Edit section",()=>sectionForm(sec))+btn("+ New class",()=>classForm(sec))+btn("+ Add record",()=>recordForm(null,sec.id),"primary"))+
 `<div class="eyebrow">${esc(sec.kind)}</div><div class="bar">${btn("All records",()=>{classFilter="";render()},!classFilter?"chosen":"")}${classes.map(c=>btn(classPath(c.id),()=>{classFilter=c.id;render()},classFilter===c.id?"chosen":"")).join("")}</div>${classFilter?btn("Edit class fields",()=>classForm(sec,find(classes,classFilter))):""}<div class="grid">${items.map(card).join("")}</div>`+(items.length?"":empty("No records here yet. Add one to start."));
}
function lineage(key){const list=[],seen=new Set();while(key&&!seen.has(key)){seen.add(key);const c=find(project().classes,key);if(!c)break;list.unshift(c);key=c.parent}return list}
function fieldsFor(sec,cls){return [...(find(project().sections,sec)?.fields||[]),...lineage(cls).flatMap(c=>c.fields)]}
function references(r){
 const l=r.links.map(x=>({...x,field:"Reference"}));
 for(const f of fieldsFor(r.section,r.cls)){if(f.type==="Reference"&&r.values[f.id])l.push({target:r.values[f.id],note:"",field:f.name})}
 return l;
}
function showRecord(){
 const p=project(),s=locationState,r=record(),sec=find(p.sections,r.section);
 const revs=p.revisions.filter(x=>x.record===r.id),tab=s.tab||"Overview";
 const backs=p.records.flatMap(src=>references(src).filter(l=>l.target===r.id).map(l=>({src,...l})));
 main.innerHTML=head(p.name+" / "+(classPath(r.cls)||sec.name),r.name,btn("← "+sec.name,()=>go("section",{section:sec.id}))+btn("Edit record",()=>recordForm(r)))+
 `<div class="tabs">${["Overview","History","Compare","Used in"].map(t=>btn(t+(t==="Used in"?` (${backs.length})`:""),()=>{if(t===tab)return;if(t==="Compare"&&tab==="History")openGraphCompare(r.id,s.revision);else openRecord(r.id,t)},tab===t?"chosen":"")).join("")}</div><div id="content"></div>`;
 const out=$("#content");
 if(tab==="History"){historyView(out,revs);return}
 if(tab==="Compare"){compareView(out,revs);return}
 if(tab==="Used in"){out.innerHTML=`<div class="panel"><h2>Referenced by</h2>${backs.map(l=>`<div class="row"><div class="grow"><b>${esc(l.src.name)}</b><p>${esc(l.note||l.field)}</p></div>${btn("Open record →",()=>openRecord(l.src.id))}</div>`).join("")||empty("Other records that reference this one appear here.")}</div>`;return}
 out.innerHTML=`<div class="cols"><div><div class="panel"><span class="chip">${esc(find(p.classes,r.cls)?.name||sec.kind)}</span> ${r.assetType?`<span class="chip">${esc(r.assetType)}</span>`:""}<h2 class="bar">Project notes</h2>${textBlock(r.description||"Add a purpose, workflow, or decision in Edit record.")}${fieldsFor(r.section,r.cls).filter(f=>f.type!=="Reference"&&r.values[f.id]).map(f=>`<div class="fieldbox"><small>${esc(f.name)}</small>${textBlock(r.values[f.id])}</div>`).join("")}</div><div class="panel"><div class="spread"><h2>References</h2>${btn("+ Reference record",()=>linkForm(r))}</div>${references(r).map(l=>`<div class="row"><div class="grow"><b>${esc(recordName(l.target))}</b><p>${esc(l.note||l.field)}</p></div>${btn("Open →",()=>openRecord(l.target))}${l.field==="Reference"?btn("Edit",()=>linkForm(r,l)):""}</div>`).join("")||empty("Link an existing record and describe its role here.")}</div>${sourcePanel(r)}</div><div class="panel">${assetArt(r,"inspectorpic")}<h3>Production files</h3><p>${revs.length} tracked revisions</p>${btn("View history →",()=>openRecord(r.id,"History"))}</div></div>`;
}
function traceEvidence(src,r){
 if(!src.traceImage)return "";
 const candidates=(src.traceRevisions||[]).map(key=>find(project().revisions,key)).filter(v=>v?.record===r.id);
 return `<details class="saved-trace"><summary>Screenshot evidence</summary>${image(src.traceImage,"saved-trace-pic","Screenshot region used for visual matching")}<div class="actions">${candidates.map(v=>btn("Show in graph · "+(fileName(v)||revisionLabel(v)),()=>openRecord(r.id,"History",{revision:v.id}))).join("")}</div></details>`
}
function sourcePanel(r){
 const items=r.sources||[];
 return `<div class="panel"><div class="spread"><h2>Sources & decisions</h2>${btn("+ Attach source",()=>sourceForm(r))}</div>${items.map(src=>`<div class="fieldbox"><small>${esc(src.kind)}</small><h3>${esc(src.name)}</h3>${textBlock(src.note)}${traceEvidence(src,r)}<details><summary>Source excerpt</summary>${textBlock(src.excerpt)}</details><div class="actions">${safeLink(src.url)}${btn("Edit source",()=>sourceForm(r,src))}</div></div>`).join("")||empty("Keep a documentation excerpt, AI conversation, or playtest observation with this record.")}</div>`;
}
function safeLink(url){
 try{const parsed=new URL(url);if(["https:","http:"].includes(parsed.protocol))return `<a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>`}catch{}return ""
}
function sourceForm(r,src){
 const kinds=["Documentation","AI conversation","Playtest","Artist note","Publishing"];
 modal(src?"Edit source":"Attach a source",input("name","Source title",src?.name,"text",true)+select("sourceKind","Source type",kinds.map(k=>opt(k,k,src?.kind)).join(""))+input("url","Link (optional)",src?.url,"url")+area("excerpt","Original excerpt",src?.excerpt)+
 `<small>Draft sends only this excerpt to Meta.</small><div>`+btn("Draft decision with Meta",async()=>{const excerpt=need("excerpt");if(!hasKey)throw Error("Connect Meta AI first, or write the decision yourself.");const res=await post("ai",{project:project().id,mode:"capture",excerpt});if(dialog.open&&$("#decision")&&val("excerpt")===excerpt)$("#decision").value=res.text})+"</div>"+area("decision","Decision or next check · review before saving",src?.note),async()=>{
 const item={id:src?.id||id(),name:need("name"),kind:val("sourceKind"),url:val("url"),excerpt:need("excerpt"),note:val("decision")};
 if(item.url&&!safeLink(item.url))throw Error("Use an http or https source link.");
 await change(p=>{const rec=find(p.records,r.id);rec.sources=rec.sources||[];if(src)Object.assign(find(rec.sources,src.id),item);else rec.sources.push(item)});render()
 });if(src)removeExisting("source",src)
}
function orderedRevisions(revs){
 const waiting=[...revs].sort(versionCompare),pending=new Set(waiting.map(v=>v.id)),ordered=[];
 while(waiting.length){
   const i=waiting.findIndex(v=>!pending.has(v.parent));if(i<0)return ordered.concat(waiting);
   const [next]=waiting.splice(i,1);pending.delete(next.id);ordered.push(next)
 }
 return ordered
}
function showQuickNote(node,group){
 const old=$("#quickNote");
 if(old?.dataset.owner===group[0].id)return;
 if(old?.contains(document.activeElement))return;
 old?.remove();
 const popup=document.createElement("section");popup.className="quick-note";popup.id="quickNote";popup.dataset.owner=group[0].id;
 popup.setAttribute("aria-label","Quick revision note");
 let file=group.find(f=>f.note)||group[0],closeTimer;
 popup.innerHTML=`<div class="spread"><b>${esc(file.label)} · Quick note</b><button type="button" data-close aria-label="Close quick note">×</button></div>${group.length>1?`<select aria-label="File for note">${group.map(f=>opt(f.id,f.path.split(/[\\/]/).at(-1),file.id)).join("")}</select>`:""}<textarea aria-label="Revision note" placeholder="What changed in this version?">${esc(file.note)}</textarea><button class="primary" data-save>Save note</button>`;
 document.body.append(popup);showCapture(popup,file,true);
 const box=node.getBoundingClientRect(),bounds=popup.getBoundingClientRect();
 popup.style.left=Math.max(8,Math.min(box.left,innerWidth-bounds.width-8))+"px";
 popup.style.top=Math.max(8,Math.min(box.bottom+bounds.height+8<innerHeight?box.bottom+4:box.top-bounds.height-4,innerHeight-bounds.height-8))+"px";
 const close=()=>{clearTimeout(closeTimer);popup.remove()};
 function later(){clearTimeout(closeTimer);closeTimer=setTimeout(()=>{if(!popup.matches(":hover")&&!popup.contains(document.activeElement)&&!node.matches(":hover")&&node!==document.activeElement)close()},220)}
 node.onpointerleave=later;node.onblur=later;popup.onfocusout=later;popup.onpointerleave=later;popup.onpointerenter=()=>clearTimeout(closeTimer);
 const field=popup.querySelector("textarea"),chooser=popup.querySelector("select");
 if(chooser)chooser.onchange=()=>{file=group.find(f=>f.id===chooser.value);field.value=file.note};
 popup.querySelector("[data-close]").onclick=close;popup.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();popup.querySelector("[data-save]").click()}if(e.key==="Escape"){node.focus();close()}};
 popup.querySelector("[data-save]").onclick=async()=>{try{lastCommand="quick revision note";await change(p=>{find(p.revisions,file.id).note=field.value.trim()});close();render();toast("Revision note saved.")}catch(err){toast(err.message)}}
}
function revisionLabel(v){return v?toolName(v.tool)+" "+v.label+" · "+v.branch:""}
async function openFile(v,reveal){const result=await post("open",{project:project().id,revision:v.id,reveal});if(result.revealed&&!reveal)toast("Selected this file in Explorer.")}
function comparisonPair(ordered,state,format){
 const byId=new Map(ordered.map(v=>[v.id,v]));
 if("before" in state||"after" in state){
   const before=byId.get(state.before),after=byId.get(state.after);
   return [before,before===after?undefined:after]
 }
 const visible=format?ordered.filter(v=>fileExt(v.path)===format):ordered;
 if(state.revision){
   const focus=byId.get(state.revision);
   if(!focus)return [];
   const parent=byId.get(focus.parent);if(parent)return [parent,focus];
   const lane=ordered.filter(v=>formatLane(v)===formatLane(focus)),index=lane.indexOf(focus);
   if(index>0)return [lane[index-1],focus];
   const children=ordered.filter(v=>v.parent===focus.id);
   return [focus,children.find(v=>formatLane(v)===formatLane(focus))||lane[index+1]||children[0]]
 }
 // Suggest a recorded handoff or revisions from the same tool, branch and file type.
 const visibleIds=new Set(visible.map(v=>v.id)),previous=new Map(),lastPreview=new Map();
 let best=[visible[0],undefined],bestScore=-1;
 function consider(a,b,source){
   if(!a)return;
   const score=2*(Number(!!a.preview)+Number(!!b.preview))+Number(source);
   if(score>=bestScore){best=[a,b];bestScore=score}
 }
 for(const v of visible){
   const lane=formatLane(v);
   consider(lastPreview.get(lane),v,false);
   consider(previous.get(lane),v,false);
   if(visibleIds.has(v.parent))consider(byId.get(v.parent),v,true);
   previous.set(lane,v);if(v.preview)lastPreview.set(lane,v)
 }
 return best
}
function openGraphCompare(recordId,revision){
 if(locationState.compareSelection?.length>2){toast("Select exactly two revisions to compare.");return}
 const [before,after]=locationState.compareSelection||[];
 openRecord(recordId,"Compare",before&&after?{before,after}:{revision:before||revision})
}
function compareView(out,revs){
 if(!revs.length){out.innerHTML=empty("Add two revisions to compare their previews.")+btn("Open history",()=>openRecord(record().id,"History"));return}
 const s=locationState,ordered=orderedRevisions(revs),[a,b]=comparisonPair(ordered,s,s.showAll?"":record().graphPrefs?.format);
 const stamp=JSON.stringify([project().id,record().id,a?.id,b?.id]);
 if(pairStamp!==stamp){draft="";pairStamp=stamp}
 const choiceName=v=>[fileName(v),revisionLabel(v)].filter(Boolean).join(" · ");
 const counts=new Map();for(const v of ordered){const name=choiceName(v);counts.set(name,(counts.get(name)||0)+1)}
 function pane(v,key,title){
   const filename=v&&(fileName(v)||revisionLabel(v));
   const choices=ordered.map(x=>{const name=choiceName(x),path=counts.get(name)>1&&x.path?" · "+x.path:"";return opt(x.id,name+path+(x.preview?"":" · No preview"),v?.id)}).join("");
   const picker=`<div class="compare-choice">${v?toolIcon(toolName(v.tool)):""}<select id="${key}" aria-label="${title}" title="${esc(v?.path||filename)}">${opt("","Choose a revision",v?.id||"")}${choices}</select></div>`;
   const preview=v?.preview?image(v.preview,"comparepic",filename):`<div class="placeholder comparepic">${v?"No preview for "+esc(filename):"Choose a revision"}</div>`;
   return `<section class="panel compare-pane"><label for="${key}">${title}</label>${picker}<small class="compare-path" title="${esc(v?.path)}">${esc(v?.path||"")}</small><div class="visual-preview" data-side="${key}">${preview}</div><h3>Quick note</h3>${textBlock(v?(v.note||"No quick note for this revision."):"—")}</section>`
 }
 out.innerHTML=`<div class="half compare-pair">${pane(a,"before","Before")}${pane(b,"after","After")}</div>`;
 for(const img of out.querySelectorAll("img.comparepic")){
   const unavailable=()=>{const message=document.createElement("div");message.className="placeholder comparepic";message.textContent="Couldn’t load the saved preview for "+img.alt;img.replaceWith(message)};
   img.addEventListener("error",unavailable,{once:true});
   if(img.complete&&!img.naturalWidth)unavailable()
 }
 for(const key of ["before","after"])$("#"+key).onchange=e=>{
   const chosen=e.target.value,other=key==="before"?b:a;
   if(chosen&&chosen===other?.id){s.before=b?.id||"";s.after=a?.id||""}
   else{s.before=key==="before"?chosen:a?.id||"";s.after=key==="after"?chosen:b?.id||""}
   render()
 };
 if(!a||!b){
   const missing=[s.before,s.after,s.revision].some(key=>key&&!find(ordered,key));
   out.insertAdjacentHTML("beforeend",empty(missing?"A selected revision is no longer in this asset. Choose a replacement above.":revs.length===1?"Add a second revision to compare.":"Choose the two revisions to compare."));return
 }
 const saved=b.comparisons.find(c=>c.before===a.id);
 const review=visualReview(out,a,b,saved?.visual);
 out.insertAdjacentHTML("beforeend",`<div class="panel"><div class="spread"><h2>Visible change</h2><span class="chip">Muse Spark · two previews</span></div><p class="sub">Generate sends only these two previews to Meta. Review the draft before saving.</p><div class="actions">${btn("Generate AI draft",async()=>{if(!hasKey){keyForm();return}if(!a.preview||!b.preview||a.id===b.id)throw Error("Choose two different revisions with previews.");const result=await post("ai",{project:project().id,mode:"compare",before:a.id,after:b.id});if(!$("#diff")||pairStamp!==stamp||locationState.tab!=="Compare")return;draft=result.text;$("#diff").value=draft;toast("Draft ready to review.")},"primary")}</div><label for="diff">Comparison note · ${esc(fileName(a)||revisionLabel(a))} → ${esc(fileName(b)||revisionLabel(b))}</label><textarea id="diff">${esc(draft||saved?.text||"")}</textarea>${btn("Save comparison",async()=>{const val=$("#diff").value.trim();if(!val||a.id===b.id)throw Error("Choose different revisions and enter a comparison.");await change(p=>{const v=find(p.revisions,b.id);v.comparisons=v.comparisons.filter(c=>c.before!==a.id);v.comparisons.push({before:a.id,text:val,...(review.current?{visual:review.current}:{})})});draft="";render();toast("Comparison saved.")})}</div>`);
}
const watchKey=(p,t)=>"gdb.watch."+p.id+"."+t.id;
const watching=(p,t)=>localStorage.getItem(watchKey(p,t))==="on";
let scanning=false;
async function pollFolders(){
 if(scanning||!data||locationState.view!=="software"||dialog.open||document.hidden||$("#filterFiles")?.value)return;
 const p=project(),t=find(p.tools,locationState.tool)||p.tools[0];
 if(!t||!t.folders.length||!watching(p,t))return;
 const sig=scanSignature;scanning=true;
 try{const res=await post("scan",{project:p.id,tool:t.id});if(locationState.view!=="software"||sig!==scanSignature||dialog.open||$("#filterFiles")?.value)return;
 if(JSON.stringify([res.files,res.issues])!==JSON.stringify([candidates,scanIssues])){candidates=res.files;scanIssues=res.issues;render()}}
 catch(error){toast(error.message)}finally{scanning=false}
}
setInterval(pollFolders,12000);
function software(){
 const p=project(),s=locationState,t=find(p.tools,s.tool)||p.tools[0];
 main.innerHTML=head(p.name,"Software & folders",btn("Across projects",allProjectFiles)+btn("+ Add software",()=>toolForm(),"primary"));
 if(!t){main.innerHTML+=empty("Register a tool and its file extensions, then link its source folders.");return}
 const sig=p.id+"|"+t.id+"|"+JSON.stringify([t.folders,t.extensions]);if(scanSignature!==sig){scanSignature=sig;candidates=[];scanIssues=[]}
 const tracked=p.revisions.filter(v=>v.tool===t.id),normalized=path=>path.replaceAll("/","\\").toLowerCase();
 const existing=new Set(tracked.filter(v=>v.path).map(v=>normalized(v.path)));
 const unlinked=candidates.filter(path=>!existing.has(normalized(path)));
 main.innerHTML+=`<div class="bar">${p.tools.map(x=>toolButton(x.name,()=>go("software",{tool:x.id}),x.id===t.id?"chosen":"")).join("")}</div><div class="panel"><div class="spread"><div class="eyebrow">Registered software</div>${btn("Edit software",()=>toolForm(t))}</div><h2>${toolIcon(t.name)} ${esc(t.name)}</h2><p class="sub">${esc(t.extensions)}</p>${(t.installFolders||[]).map(f=>`<div class="row"><small>Install</small>${btn(f,()=>post("open-folder",{project:p.id,tool:t.id,path:f}),"path file-link")}</div>`).join("")}${t.folders.map(f=>`<div class="row">${btn(f,()=>post("open-folder",{project:p.id,tool:t.id,path:f}),"grow path file-link")}<small>${esc(t.folderFormats?.[pathKey(f)]?.join(", ")||t.extensions)}</small>${btn("File types",()=>folderIntake(t))}${btn("Unlink folder",async()=>{await change(p=>{const x=find(p.tools,t.id);x.folders=x.folders.filter(v=>v!==f);if(x.folderFormats)delete x.folderFormats[pathKey(f)]});render()})}</div>`).join("")}<div class="actions">${btn("+ Link folder",async()=>{const {path}=await post("pick",{kind:"folder"});if(!path)return;folderIntake(t,path)})}${t.folders.length?btn("Organize folder assets",()=>folderIntake(t))+btn("Scan folders",async()=>{const res=await post("scan",{project:p.id,tool:t.id});if(scanSignature!==sig||locationState.view!=="software")return;candidates=res.files;scanIssues=res.issues;render();toast(`${candidates.length} files found.`)},"primary")+btn(watching(p,t)?"Auto-scan on":"Auto-scan off",()=>{localStorage.setItem(watchKey(p,t),watching(p,t)?"off":"on");render();if(watching(p,t))pollFolders()}):""}</div></div>
 <div class="panel"><div class="spread"><h2>Tracked files & revisions</h2>${btn("+ Track file",async()=>{const {path}=await post("pick",{kind:"file",software:t.name});if(path)singleIntake(t,path)})}</div>${tracked.map(v=>`<div class="row"><div class="grow">${v.path?btn(v.path.split(/[\\/]/).at(-1),()=>openFile(v,false),"file-link"):esc(revisionLabel(v))}<p>${esc(v.note)}</p><small>${esc(recordName(v.record))}</small></div>${btn("View revision →",()=>openRecord(v.record,"History",{revision:v.id}))}</div>`).join("")||empty("Track a file to link it to a record.")}</div>
 <div class="panel"><h2>Discovered files</h2><p class="sub">Scan linked folders for new files. Choose the record and parent when you track one.</p>${scanIssues.map(e=>`<p class="error">${esc(e)}</p>`).join("")}${unlinked.length?`<label for="filterFiles">Filter ${unlinked.length} paths</label><input id="filterFiles" placeholder="Filename or folder"><div id="discovered"></div>`:""}</div>`;
 if(unlinked.length){const results=()=>{const q=$("#filterFiles").value.toLowerCase(),files=unlinked.filter(f=>f.toLowerCase().includes(q));$("#discovered").innerHTML=files.slice(0,100).map(f=>`<div class="row"><div class="grow"><b>${esc(f.split(/[\\/]/).at(-1))}</b><div class="path">${esc(f)}</div></div>${btn("Suggest record",()=>matchFile(t,f))}${btn("Track file",()=>singleIntake(t,f))}</div>`).join("")+(files.length>100?empty("Showing 100. Filter to narrow the list."):"")};$("#filterFiles").oninput=results;results()}
}
async function matchFile(tool,path){
 if(!hasKey){keyForm();return}
 const p=project();
 modal("Suggest a matching record",`<p>Muse Spark receives the filename, software name, and this project’s record names, descriptions, and tracked filenames.</p><p class="path">${esc(path.split(/[\\/]/).at(-1))}</p>`,async()=>{
   const result=await post("ai",{project:p.id,mode:"match",tool:tool.id,filename:path.split(/[\\/]/).at(-1)});
   if(!result.record){throw Error(result.reason||"No clear match. Choose a record manually.")}
   setTimeout(()=>revisionForm(null,{tool:tool.id,path,record:result.record,matchReason:result.reason}),0)
 },"Get suggestion")
}
function allProjectFiles(){
 const rows=data.projects.flatMap(p=>p.revisions.map(v=>({p,v,t:find(p.tools,v.tool),r:find(p.records,v.record)})));
 modal("Files across projects",input("globalFind","Find by project, software, asset, or file")+`<div id="globalFiles"></div>`,async()=>{},"Done");
 function list(){const q=val("globalFind").toLowerCase(),matches=rows.filter(({p,r,t,v})=>[p.name,r.name,t.name,v.path,v.label,v.note].join(" ").toLowerCase().includes(q));
 $("#globalFiles").innerHTML=matches.slice(0,120).map(({p,r,t,v})=>`<div class="row"><div class="grow"><b>${esc(r.name)}</b><p>${esc(p.name)} · ${esc(t.name)} ${esc(v.label)}</p><small class="path">${esc(v.path||v.branch)}</small></div>${btn("Open",()=>{dialog.close();locationState.project=p.id;openRecord(r.id,"History",{revision:v.id})})}</div>`).join("")||empty("No matches.")}
 $("#globalFind").oninput=list;list()
}
function searchView(){
 const p=project();main.innerHTML=head(p.name,"Find in project")+`<label for="find">Search names, notes, tools, versions and paths</label><input id="find" placeholder="Try wing fold, v007.2, or a filename"><div class="panel" id="results"></div>`;
 const results=()=>{const q=$("#find").value.trim().toLowerCase(),rows=[];
 for(const r of p.records)if([r.name,r.description,...Object.values(r.values),...r.links.map(l=>l.note),...(r.sources||[]).flatMap(s=>[s.name,s.excerpt,s.note])].join(" ").toLowerCase().includes(q))rows.push([r.name,find(p.sections,r.section)?.name,()=>openRecord(r.id)]);
 for(const v of p.revisions)if([toolName(v.tool),v.path,v.note,v.label,v.branch,...v.comparisons.map(c=>c.text)].join(" ").toLowerCase().includes(q))rows.push([revisionLabel(v),recordName(v.record),()=>openRecord(v.record,"History",{revision:v.id})]);
 $("#results").innerHTML=rows.slice(0,150).map(([n,d,fn])=>`<div class="row"><div class="grow"><b>${esc(n)}</b><p>${esc(d)}</p></div>${btn("Open →",fn)}</div>`).join("")||empty("No matches.")};$("#find").oninput=results;results();$("#find").focus()
}
function askView(){
 const p=project();
 main.innerHTML=head(p.name,"Ask this project")+`<div class="panel"><span class="chip">Meta · Muse Spark</span><h2 class="bar">Pick up where you left off</h2><p>Ask about an experiment, source revision, or decision. This sends the project’s record text, references, and revision notes to Meta.</p><label for="question">Question</label><textarea id="question" placeholder="Which mesh was used for the first texture pass?"></textarea>${btn("Ask Muse Spark",async()=>{if(!hasKey){keyForm();return}const q=$("#question").value.trim();if(!q)throw Error("Enter a question.");const res=await post("ai",{project:p.id,mode:"recall",question:q});if(project().id===p.id&&locationState.view==="ask")$("#answer").textContent=res.text},"primary")}<div class="text panel" id="answer" role="status">Your answer appears here.</div></div>`;
}
function modal(title,html,submit,label="Save"){
 activeDrawer=title;$("#dialogTitle").textContent=title;$("#fields").innerHTML=html;$("#formError").textContent="";$("#submit").textContent=label;formAction=submit;
 if(!dialog.open)dialog.showModal()
}
const input=(k,title,val="",type="text",req=false)=>`<label for="${k}">${esc(title)}</label><input id="${k}" type="${type}" ${req?"required":""} value="${esc(val)}">`;
const area=(k,title,val="")=>`<label for="${k}">${esc(title)}</label><textarea id="${k}">${esc(val)}</textarea>`;
const select=(k,title,options)=>`<label for="${k}">${esc(title)}</label><select id="${k}">${options}</select>`;
const val=k=>$("#"+k).value.trim();
const need=(k)=>{const v=val(k);if(!v)throw Error("Fill in "+($(`label[for="${k}"]`)?.textContent||k)+".");return v};
function pictureField(key,current=""){
 return `<div class="image-field" tabindex="0" data-image-target="${esc(key)}"><label for="${esc(key)}">Preview image</label><div class="image-selected">${current?image(current,"picked-preview","Current image"):""}</div><input type="file" accept="image/*" id="${esc(key)}"><div class="image-actions"><button type="button" data-paste-image>Paste screenshot</button><kbd>Ctrl+V</kbd>${key==="pic"?btn("Clear selection",()=>{const el=$("#pic");el.value="";el.dispatchEvent(new Event("change",{bubbles:true}))},"text-btn"):""}</div><small class="paste-status" aria-live="polite"></small></div>`
}
const previewPicker=current=>pictureField("pic",current);
function imageDestination(target=document.activeElement){
 const scope=dialog.open?dialog:main;
 if(!dialog.open&&target.closest?.("#quickNote"))return;
 if(!scope.contains(target))target=scope;
 const field=target.closest("[data-image-target]")||target.closest(".series-card")?.querySelector("[data-image-target]");
 if(field)return field;
 const fields=scope.querySelectorAll("[data-image-target]");
 if(fields.length===1)return fields[0];
 if(!dialog.open&&!target.closest("input,textarea,[contenteditable=true],#quickNote"))return scope.querySelector("[data-paste-node]");
}
async function assignScreenshot(target,file){
 if(!target?.isConnected||(dialog.open&&!dialog.contains(target)))return;
 if(target.hasAttribute("data-image-target")){
   const input=target.querySelector('input[type="file"]'),transfer=new DataTransfer();
   transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));return
 }
 const key=target.dataset.pasteNode,projectId=project().id,stamp=String(++pasteNumber);
 target.dataset.pending=stamp;target.querySelector(".paste-status").textContent="Saving screenshot…";
 const ref=await uploadPreview(file);
 if(!target.isConnected||target.dataset.pending!==stamp||project().id!==projectId)return;
 if(dialog.open){target.querySelector(".paste-status").textContent="Paste again after closing the editor.";return}
 lastCommand="Set revision image";await change(p=>{find(p.revisions,key).preview=ref});
 if(target.isConnected&&!dialog.open){
   const note=$("#inlineNote").value;render();$("#inlineNote").value=note;toast("Revision image saved.")
 }
}
let pasteNumber=0;
document.addEventListener("paste",e=>{
 const clip=e.clipboardData;
 const item=[...(clip?.items||[])].find(item=>item.kind==="file"&&item.type.startsWith("image/"));
 const file=item?.getAsFile()||[...(clip?.files||[])].find(f=>f.type.startsWith("image/"));
 if(!file)return;
 const el=e.target instanceof Element?e.target:document.activeElement;
 if(el.closest('textarea,input:not([type=file]),[contenteditable=true]')&&clip.types.includes("text/plain"))return;
 const target=imageDestination(el);
 if(!target){if(!dialog.open&&main.querySelectorAll("[data-image-target]").length>1)toast("Select an asset’s preview field, then press Ctrl+V.");return}
 e.preventDefault();assignScreenshot(target,file).catch(err=>{if(target.isConnected)target.querySelector(".paste-status").textContent=err.message})
});
document.addEventListener("click",async e=>{
 const button=e.target.closest("[data-paste-image]");if(!button)return;
 const target=button.closest("[data-image-target],[data-paste-node]"),status=target.querySelector(".paste-status");
 let file;
 try{
   if(navigator.clipboard?.read){
     const items=await navigator.clipboard.read();
     for(const item of items){const type=item.types.find(t=>t.startsWith("image/"));if(type){const blob=await item.getType(type);file=new File([blob],"Screenshot."+type.split("/")[1],{type});break}}
   }
 }catch{/* Ctrl+V also works when clipboard reading permission is unavailable. */}
 if(!target.isConnected)return;
 if(!file){target.focus();status.textContent="Copy a screenshot, then press Ctrl+V here.";return}
 try{await assignScreenshot(target,file)}catch(err){status.textContent=err.message}
});
document.addEventListener("change",e=>{
 if(e.target.id!=="pic")return;
 const input=e.target,field=input.closest(".image-field"),file=input.files[0],preview=field.querySelector(".image-selected");
 if(!("original" in preview.dataset))preview.dataset.original=preview.innerHTML;
 if(!file){preview.innerHTML=preview.dataset.original;field.querySelector(".paste-status").textContent="";return}
 const reader=new FileReader();reader.onload=()=>{
   if(!field.isConnected||input.files[0]!==file)return;
   const img=new Image();img.className="picked-preview";img.alt="Selected screenshot";img.src=reader.result;preview.replaceChildren(img);
 };reader.readAsDataURL(file);
 field.querySelector(".paste-status").textContent="Image selected. Save to apply."
});
async function preview(current){
 const file=$("#pic")?.files[0];return file?uploadPreview(file):current||""
}
async function uploadPreview(file){
 const bitmap=await createImageBitmap(file);const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const ctx=canvas.getContext("2d");ctx.fillStyle="#f5f3e9";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 return (await post("preview",{jpeg:canvas.toDataURL("image/jpeg",.88).split(",")[1]})).preview;
}
function newProject(){
 modal("New project",input("name","Project name","","text",true)+`<div class="fieldbox"><b>Bring your existing work</b><p>Pick your tools and connect their working folders.</p>${btn("Open setup guide →",()=>{intake=newIntake();intake.name=val("name");stash();manifest=[];dialog.close();startSetup()})}</div>`,async()=>{const key=id(),name=need("name");await change((p,state)=>state.projects.push({id:key,name,sections:productionSections(),classes:[],records:[],tools:[],revisions:[]}));locationState={project:key,view:"home"};render()},"Create empty project")
}
function schemaEditor(fields){
 const list=structuredClone(fields||[]),past=[],future=[],types=["Text","Number","File","URL","Reference"];
 const remember=()=>{past.push(structuredClone(list));future.length=0};
 const draw=()=>{$("#undoFields").disabled=!past.length;$("#redoFields").disabled=!future.length;$("#schemalist").innerHTML=list.map(f=>`<div class="fieldbox"><div class="row"><input aria-label="Field name" data-name="${esc(f.id)}" value="${esc(f.name)}" placeholder="Field name" required><select aria-label="Field type" data-type="${esc(f.id)}">${types.map(t=>opt(t,t,f.type)).join("")}</select><button type="button" data-remove="${esc(f.id)}" aria-label="Remove field" title="Remove this field">×</button></div>${f.type==="Reference"?`<label>Choose records from</label><select data-target="${esc(f.id)}">${opt("","All sections",f.targetSection)}${opts(project().sections,f.targetSection)}</select><label>Restrict class</label><select data-class="${esc(f.id)}">${opt("","Any class",f.targetClass)}${opts(project().classes.filter(c=>!f.targetSection||c.section===f.targetSection),f.targetClass)}</select>`:""}</div>`).join("");
 for(const el of $("#schemalist").querySelectorAll("[data-remove]"))el.onclick=()=>{remember();list.splice(list.findIndex(f=>f.id===el.dataset.remove),1);draw()};
 for(const el of $("#schemalist").querySelectorAll("[data-name]"))el.oninput=()=>find(list,el.dataset.name).name=el.value;
 for(const el of $("#schemalist").querySelectorAll("[data-type]"))el.onchange=()=>{remember();const f=find(list,el.dataset.type);f.type=el.value;draw()};
 for(const el of $("#schemalist").querySelectorAll("[data-target]"))el.onchange=()=>{const f=find(list,el.dataset.target);f.targetSection=el.value;f.targetClass="";draw()};
 for(const el of $("#schemalist").querySelectorAll("[data-class]"))el.onchange=()=>find(list,el.dataset.class).targetClass=el.value;
 };
 for(const [button,from,to] of [["undoFields",past,future],["redoFields",future,past]])$("#"+button).onclick=()=>{if(!from.length)return;to.push(structuredClone(list));list.splice(0,list.length,...from.pop());draw()};
 $("#addField").onclick=()=>{remember();list.push({id:id(),name:"",type:"Text"});draw()};draw();return ()=>list.map(f=>({...f,name:f.name.trim()}))
}
const schemaBox=()=>`<h3 class="bar">Custom fields</h3><div id="schemalist"></div><button type="button" id="addField">+ Add field</button> <button type="button" id="undoFields">↶ Undo field</button> <button type="button" id="redoFields">↷ Redo field</button>`;
function sectionForm(existing){
 let getFields;const kinds=["Collection","Mechanics & features","Research","Publishing","Custom"];
 modal(existing?"Edit section":"Create a project section",input("name","Section name",existing?.name,"text",true)+select("kind","What goes here?",kinds.map(k=>opt(k,k,existing?.kind)).join(""))+schemaBox(),async()=>{
 const x={id:existing?.id||id(),name:need("name"),kind:val("kind"),fields:getFields()};await change(p=>{if(existing)Object.assign(find(p.sections,x.id),x);else p.sections.push(x)});go("section",{section:x.id})
 },existing?"Save changes":"Create section");getFields=schemaEditor(existing?.fields);if(existing)removeExisting("section",existing)
}
function classForm(sec,existing,parentId){
 const p=project(),home=locationState.view==="home",section=sec?.id||p.sections[0]?.id||"",initialParent=existing?.parent??parentId??(!home?classFilter:"");
 const sectionField=!sec&&p.sections.length?select("classSection","Project section",opts(p.sections,section)):"";
 let getFields;
 modal(existing?"Edit asset class":initialParent?"New subclass":"New asset class",input("name","Class name",existing?.name,"text",true)+sectionField+select("parent","Parent class","")+select("classPosition","Position among siblings","")+schemaBox(),async()=>{
   const name=need("name"),owner=sectionId(),parent=val("parent"),after=val("classPosition"),fields=getFields(),key=existing?.id||id();
   await change(next=>{
     const section=owner||ensureSection(next,"Assets").id;
     if(next.classes.some(c=>c.id!==key&&c.section===section&&c.parent===parent&&c.name.toLowerCase()===name.toLowerCase()))throw Error("A class with that name already exists under this parent.");
     const x={id:key,section,name,parent,fields};if(existing)next.classes=next.classes.filter(c=>c.id!==key);
     const first=next.classes.findIndex(c=>c.parent===parent);
     const at=after?next.classes.findIndex(c=>c.id===after)+1:first<0?next.classes.length:first;
     next.classes.splice(at,0,{...existing,...x})
   });
   if(!home)classFilter=key;for(const c of lineage(key))closedClasses.delete(p.id+"/"+c.id);render()
 },existing?"Save changes":"Create class");
 function sectionId(){return $("#classSection")?.value||section}
 function parents(){
   const allowed=p.classes.filter(c=>c.section===sectionId()&&!lineage(c.id).some(a=>a.id===existing?.id));
   $("#parent").innerHTML=opt("","Library root",initialParent)+allowed.map(c=>opt(c.id,classPath(c.id),initialParent)).join("");positions()
 }
 function positions(){
   const parent=val("parent"),all=p.classes.filter(c=>c.parent===parent);
   const prior=existing&&all.includes(existing)?all[all.indexOf(existing)-1]:all.at(-1),chosen=prior?.id||"";
   $("#classPosition").innerHTML=opt("","First",chosen)+all.filter(c=>c.id!==existing?.id).map(c=>opt(c.id,"After "+c.name+(parent?"":" · "+find(p.sections,c.section).name),chosen)).join("")
 }
 getFields=schemaEditor(existing?.fields);parents();$("#parent").onchange=positions;if($("#classSection"))$("#classSection").onchange=parents;
 if(existing)$("#fields").insertAdjacentHTML("beforeend",btn("Delete class…",()=>deleteLibraryClass(existing),"danger"))
}
function deleteLibraryClass(c){
 const p=project(),parentName=c.parent?classPath(c.parent):"the library root",records=p.records.filter(r=>r.cls===c.id),kids=p.classes.filter(child=>child.parent===c.id);
 const fieldOwner=c.parent?parentName:find(p.sections,c.section).name;
 modal("Delete "+c.name,`<p>${records.length} direct asset${records.length===1?"":"s"} and ${kids.length} subclass${kids.length===1?"":"es"} will move to <strong>${esc(parentName)}</strong>. Their revisions stay attached.</p>${c.fields.length?`<p>The ${c.fields.length} custom field definitions will move to ${esc(fieldOwner)} so saved values stay accessible.</p>`:""}<p>You can restore this class with Undo.</p>`,async()=>{
   await change(next=>{
     const target=find(next.classes,c.id),parent=target.parent;
     const peers=next.classes.filter(x=>x.id!==c.id&&x.parent===parent&&x.section===c.section);
     const collision=next.classes.find(x=>x.parent===c.id&&peers.some(y=>y.name.toLowerCase()===x.name.toLowerCase()));
     if(collision)throw Error("Rename or move "+collision.name+" first. Its new parent already has a class with that name.");
     const owner=parent?find(next.classes,parent):find(next.sections,c.section);
     owner.fields.push(...target.fields);
     for(const child of next.classes)if(child.parent===c.id)child.parent=parent;
     for(const r of next.records)if(r.cls===c.id)r.cls=parent;
     next.classes=next.classes.filter(x=>x.id!==c.id);
     for(const owner of [...next.sections,...next.classes])for(const f of owner.fields)if(f.targetClass===c.id){f.targetClass=parent;if(!parent)f.targetSection=c.section}
   });classFilter="";render()
 },"Delete class")
}
function removeExisting(kind,item){
 const p=project();
 function remove(){
  modal("Remove "+kind,`<p>Remove <b>${esc(item.name)}</b> from ${esc(p.name)}? ${kind==="record"?"Its revision history will also be removed. ":""}Source files stay on disk. You can undo this change.</p>`,async()=>{
   await change(next=>{
    const group={record:"records",section:"sections",class:"classes",software:"tools",source:null}[kind];
    const fields=[...next.classes,...next.sections].flatMap(x=>x.fields);
    if(kind==="section"&&(next.records.some(r=>r.section===item.id)||next.classes.some(c=>c.section===item.id)||fields.some(f=>f.targetSection===item.id)))throw Error("Move the records, classes and field references out of this section first.");
    if(kind==="class"&&(next.records.some(r=>r.cls===item.id)||next.classes.some(c=>c.parent===item.id)||fields.some(f=>f.targetClass===item.id)))throw Error("Move the records, child classes and field references out of this class first.");
    if(kind==="software"&&next.revisions.some(v=>v.tool===item.id))throw Error("Reassign the revisions using this software first.");
    if(kind==="record"){
      if(next.records.some(r=>r.id!==item.id&&references(r).some(l=>l.target===item.id)))throw Error("Unlink the records listed under Used in first.");
      next.revisions=next.revisions.filter(v=>v.record!==item.id)
    }
    if(kind==="source"){const r=find(next.records,record().id);r.sources=r.sources.filter(s=>s.id!==item.id)}
    else next[group]=next[group].filter(x=>x.id!==item.id);
    if(kind==="section"||kind==="software")next.workflow=(next.workflow||[]).filter(w=>(kind==="section"?w.section:w.tool)!==item.id)
   });if(kind==="record"||kind==="section")go("home");else if(kind==="software")go("software");else {classFilter="";render()}
  },"Remove "+kind)
 }
 $("#fields").insertAdjacentHTML("beforeend",`<div class="actions">${btn("Remove "+kind+"…",remove,"danger")}</div>`)
}
function sourceAttachment(p){
 const catalog=toolCatalog(p);
 const names=[...catalog.keys()].sort((a,b)=>a.localeCompare(b));
 const controls=`<div class="fieldbox"><h3>Project file</h3><small>Choose the working file to track as this record’s first revision.</small>${input("sourcePath","Source file path")}<div class="actions">${btn("Browse project file…",async()=>{const result=await post("pick",{kind:"file"});if(result.path&&$("#sourcePath")){$("#sourcePath").value=result.path;detect()}})}${btn("Clear file",()=>{$("#sourcePath").value="";$("#sourceSoftware").value="";$("#sourceLabel").value="v001";update();targetHint()})}</div>${select("sourceSoftware","Created in",opt("","Choose software","")+names.map(n=>opt(n,n,"")).join("")+opt("__custom","Other software…",""))}<div id="sourceIdentity"></div><p id="sourceTarget" role="status"></p>${input("sourceLabel","Revision label","v001")}${select("sourceTask","Discipline",categoryLabels.map(n=>opt(n,n,"")).join(""))}${area("sourceNote","What did you create or change?")}</div>`;
 function update(){
   const n=val("sourceSoftware");$("#sourceIdentity").innerHTML=n==="__custom"?input("sourceCustom","Software name"):n?toolIcon(n)+" "+esc(n):"";
 }
 function targetHint(){const target=val("sourcePath")&&p.records.find(r=>r.name.toLowerCase()===val("name").toLowerCase());const hit=trackedAt(p,val("sourcePath"));$("#sourceTarget").textContent=hit?transferMessage(p,hit,target?.id):target?"This file will join the existing "+target.name+" history.":"";$("#submit").textContent=target?"Add to existing history":"Save";for(const el of document.querySelectorAll(".record-identity"))el.hidden=!!target}
 function detect(){
   const path=val("sourcePath");if(!path){targetHint();return}
   const g=fileGuess(path),hit=trackedAt(p,path);if(!val("name"))$("#name").value=hit?recordName(hit.record):g.name;
   if(g.label!=="Initial")$("#sourceLabel").value=g.label;
   const discipline=seriesInfo(path,find(p.sections,val("section"))?.name).task;if(categoryLabels.includes(discipline))$("#sourceTask").value=discipline;
   const software=detectSoftware(p,path);$("#sourceSoftware").value=software;
   if(software&&!hit){const task=p.tools.find(t=>t.name===software)?.task||formatsByTool[software]?.stages[0];if(task)$("#sourceTask").value=seriesInfo(path,task).task}
   if(hit){$("#sourceSoftware").value=toolName(hit.tool);$("#sourceLabel").value=hit.label;$("#sourceTask").value=hit.discipline;$("#sourceNote").value=hit.note}update();targetHint()
 }
 function read(){
   const path=val("sourcePath");if(!path)return null;
   const choice=need("sourceSoftware"),name=choice==="__custom"?need("sourceCustom"):choice;
   const ext=fileExt(path);
   const extensions=(catalog.get(name)||ext).split(/[\s,;]+/).filter(Boolean).map(e=>"."+e.replace(/^\./,"")).join(",");
   return {name,path,label:need("sourceLabel"),discipline:val("sourceTask"),note:val("sourceNote"),extensions}
 }
 return {controls,read,wire(){ $("#name").addEventListener("input",targetHint);$("#sourcePath").onchange=detect;$("#sourceSoftware").onchange=update }}
}
function recordForm(existing,section,initialClass){
 const p=project();if(!p.sections.length){sectionForm();return}
 const initial=existing?.section||section||p.sections[0].id,attachment=existing?null:sourceAttachment(p);
 modal(existing?"Edit record":"Add record",input("name","Record name",existing?.name,"text",true)+`<div class="record-identity">`+select("section","Project section",opts(p.sections,initial))+select("cls","Class","")+input("newClass","Or create a classification")+input("assetType","Asset type",existing?.assetType)+input("assetEmoji","Asset emoji",existing?.emoji)+`</div>`+(attachment?.controls||"")+`<div class="record-identity">`+area("desc","Purpose & notes",existing?.description)+`<div id="custom"></div></div>`+previewPicker(existing?.cover),async()=>{
 const source=attachment?.read();const sec=val("section"),cls=val("cls"),values={...existing?.values};for(const f of fieldsFor(sec,cls))values[f.id]=val("f"+f.id);
 const matches=source?p.records.filter(r=>r.name.toLowerCase()===val("name").toLowerCase()):[];if(matches.length>1)throw Error("Several records use this name. Open the intended asset and choose Add revision.");const target=matches[0];
 const x={id:existing?.id||target?.id||id(),name:need("name"),section:sec,cls,assetType:val("assetType"),emoji:val("assetEmoji"),description:val("desc"),values,cover:await preview(existing?.cover),links:existing?.links||[]};
 await change(p=>{
   if(!target){assetClass(p,x,val("newClass"));if(existing)Object.assign(find(p.records,x.id),x);else p.records.push(x)}
   if(source){
     ensureSection(p,source.discipline);const hit=trackedAt(p,source.path);
     let t=p.tools.find(t=>t.name.toLowerCase()===source.name.toLowerCase());
     if(!t){t={id:id(),name:source.name,extensions:source.extensions,folders:[]};p.tools.push(t)}
     if(hit){moveTracked(p,hit,x.id);Object.assign(hit,{label:source.label,discipline:source.discipline,note:source.note,tool:t.id})}else p.revisions.push({id:id(),record:x.id,tool:t.id,label:source.label,path:source.path,branch:source.discipline,discipline:source.discipline,parent:"",note:source.note,preview:x.cover,comparisons:[]})
   }
 });if(source)await revealRevision(find(project().records,x.id),trackedAt(project(),source.path));else openRecord(x.id,"Overview")
 });
 function custom(){const fields=fieldsFor(val("section"),val("cls"));$("#custom").innerHTML=fields.map(f=>{
 const key="f"+f.id,value=existing?.values[f.id]||"";
 if(f.type==="Reference")return select(key,f.name,opt("","Choose record",value)+opts(p.records.filter(r=>r.id!==existing?.id&&(!f.targetSection||r.section===f.targetSection)&&(!f.targetClass||lineage(r.cls).some(c=>c.id===f.targetClass))),value));
 return input(key,f.name,value,f.type==="Number"?"number":f.type==="URL"?"url":"text")+(f.type==="File"?btn("Browse…",async()=>{const res=await post("pick",{kind:"file"});if(res.path)$("#"+key).value=res.path}):"")
 }).join("")}
 function classes(){const sec=val("section");$("#cls").innerHTML=opt("","No class","")+p.classes.filter(c=>c.section===sec).map(c=>opt(c.id,classPath(c.id),existing?.cls||initialClass||classFilter)).join("");custom()}
 $("#section").onchange=classes;$("#cls").onchange=custom;classes();attachment?.wire();if(attachment)$("#sourceTask").value=categoryLabels.includes(find(p.sections,initial)?.name)?find(p.sections,initial).name:"3D Modeling";if(existing)removeExisting("record",existing)
}
function linkForm(r,existing){
 const targets=project().records.filter(x=>x.id!==r.id);if(!targets.length)throw Error("Add another record first.");
 modal(existing?"Edit reference":"Reference a record",select("target","Existing record",opts(targets,existing?.target))+area("purpose","Role in this record",existing?.note),async()=>{
 const target=val("target"),note=val("purpose");await change(p=>{const item=find(p.records,r.id);if(existing)item.links=item.links.filter(l=>l.target!==existing.target);item.links=item.links.filter(l=>l.target!==target);item.links.push({target,note})});render()
 });if(existing)$("#fields").insertAdjacentHTML("beforeend",btn("Remove reference",async()=>{await change(p=>{const x=find(p.records,r.id);x.links=x.links.filter(l=>l.target!==existing.target)});dialog.close();render()}))
}
function toolForm(existing){
 const catalog=toolCatalog(project());
 modal(existing?"Edit software":"Add software",input("name","Software name",existing?.name,"text",true)+input("extensions","File extensions (comma separated)",existing?.extensions||"","text",true)+`<datalist id="knownTools">${[...catalog.keys()].map(n=>opt(n,n,"")).join("")}</datalist>`,async()=>{
 const x={id:existing?.id||id(),name:need("name"),extensions:need("extensions").split(/[\s,;]+/).filter(Boolean).map(e=>"."+e.replace(/^\./,"").toLowerCase()).join(",")};
 if(!x.extensions.split(",").every(e=>/^\.[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/.test(e)))throw Error("Use file extensions such as .blend, .fbx.");
 await change(p=>{if(existing)Object.assign(find(p.tools,x.id),x);else p.tools.push({...x,folders:[]})});go("software",{tool:x.id})
 });$("#name").setAttribute("list","knownTools");$("#name").onchange=()=>{const name=val("name"),match=[...catalog.keys()].find(n=>n.toLowerCase()===name.toLowerCase());if(match&&!existing){$("#name").value=match;$("#extensions").value=extensions(catalog.get(match)).join(",")}};if(existing)removeExisting("software",existing)
}
function revisionForm(existing,defaults={}){
 const p=project();if(!p.records.length)throw Error("Add a record first.");const catalog=toolCatalog(p);
 const initial=existing||defaults,origin=find(p.revisions,initial.parent),initialTool=find(p.tools,initial.tool||origin?.tool),initialTask=initial.discipline||origin?.discipline||initialTool?.task||find(p.sections,find(p.records,initial.record)?.section)?.name||"";
 modal(existing?"Edit revision":defaults.insertTargets?"Insert revision":defaults.fork?"Create branch":"Track a revision",select("owner","Linked record",opts(p.records,initial.record))+select("tool","Software",opt("","Choose software",initialTool?.id||"")+opts(p.tools,initialTool?.id)+[...catalog.keys()].filter(n=>!p.tools.some(t=>t.name===n)).sort().map(n=>opt("preset:"+n,n,"")).join(""))+
 (initial.matchReason?`<div class="pillbox"><b>Meta suggestion · review before saving</b>${textBlock(initial.matchReason)}</div>`:"")+input("path","Source file path",initial.path)+btn("Browse file…",async()=>{const {path}=await post("pick",{kind:"file"});if(path){$("#path").value=path;suggestLabel()}})+
 `<div id="trackedHint" role="status"></div>`+input("label","Revision label",initial.label||"v001","text",true)+select("discipline","Discipline",opt("","Choose discipline",initialTask)+categoryLabels.map(n=>opt(n,n,initialTask)).join(""))+input("branch","Branch name",initial.branch||origin?.branch||initialTask||"Main","text",true)+select("parent","Source revision / handoff","")+area("note","Artist note · why this version exists",initial.note)+previewPicker(existing?.preview),async()=>{
 const sourceChoice=val("parent"),owner=val("owner"),label=need("label"),branch=need("branch"),path=val("path"),tool=need("tool"),note=val("note");
 const hit=trackedAt(p,path);
 if(existing&&hit&&hit.id!==existing.id)throw Error("That path belongs to another version. Use Bring tracked file to join its history.");
 const original=existing||hit,parent=sourceChoice==="keepSource"?original?.parent||"":sourceChoice;
 if(original?.id===parent)throw Error("This is the source itself. Choose another file or another source.");
 const x={id:original?.id||id(),record:owner,tool,label,branch,discipline:val("discipline"),parent,note,path,preview:await preview(original?.preview),comparisons:original?.comparisons||[]};
 if(defaults.canvas)x.canvas=defaults.canvas;
 await change(p=>{
   if(tool.startsWith("preset:")){const name=tool.slice(7);let t=p.tools.find(t=>t.name===name);if(!t){t={id:id(),name,extensions:extensions(catalog.get(name)).join(","),folders:[]};p.tools.push(t)}x.tool=t.id}
   if(x.discipline)ensureSection(p,x.discipline);
   if(defaults.fork&&!hit&&p.revisions.some(v=>v.record===owner&&v.tool===x.tool&&v.branch===branch))throw Error("Give the new branch its own name.");
   if(original){const v=find(p.revisions,x.id);moveTracked(p,v,owner);Object.assign(v,x)}else p.revisions.push(x);
   if(defaults.insertTargets)for(const targetId of defaults.insertTargets)find(p.revisions,targetId).parent=x.id;
 });openRecord(owner,"History",{revision:x.id})
 });
 let customBranch=false;
 $("#branch").oninput=()=>{customBranch=true};
 function suggestBranch(){
   if(customBranch||existing||defaults.insertTargets)return;
   const task=val("discipline")||"Main";let name=task;
   if(defaults.fork){let i=1;while(p.revisions.some(v=>v.record===val("owner")&&v.tool===val("tool")&&v.branch===name)){name=task+" fork"+(i>1?" "+i:"");i++}}
   $("#branch").value=name
 }
 function suggestLabel(){
   $("#parent option[value=keepSource]")?.remove();const hit=trackedAt(p,val("path")),hint=$("#trackedHint");hint.textContent=hit&&!existing?transferMessage(p,hit,val("owner")):"";
   const context=find(p.tools,val("tool"))?.name||val("tool").replace(/^preset:/,"");
   const guess=detectSoftware(p,val("path"),context),prior=p.tools.find(t=>t.name===guess),info=seriesInfo(val("path"),prior?.task||formatsByTool[guess]?.stages[0]||val("discipline"));
   if(!existing&&!hit&&val("path"))$("#tool").value=guess?(prior?.id||"preset:"+guess):"";
   if(hit&&!existing){$("#tool").value=hit.tool;$("#discipline").value=hit.discipline||"";$("#label").value=hit.label;if(!val("note"))$("#note").value=hit.note||"";
     if(!customBranch&&!defaults.fork)$("#branch").value=hit.branch;
     if(!defaults.fork&&!defaults.insertTargets&&hit.parent&&!val("parent")){
       if(hit.record===val("owner"))$("#parent").value=hit.parent;
       else{$("#parent").add(new Option("Keep existing source · "+revisionLabel(find(p.revisions,hit.parent)),"keepSource"));$("#parent").value="keepSource"}
     }return}
   if(info.label!=="Initial")$("#label").value=info.label;
   if(!existing&&!defaults.record){const match=p.records.find(r=>r.name.toLowerCase()===info.asset.toLowerCase());if(match){$("#owner").value=match.id;parents()}}
   if(info.task&&categoryLabels.includes(info.task)&&!existing){$("#discipline").value=info.task;suggestBranch()}
 }
 $("#discipline").onchange=suggestBranch;
 $("#tool").onchange=()=>{const t=find(p.tools,val("tool")),name=t?.name||val("tool").replace(/^preset:/,""),index=setupStages.findIndex(s=>s[2].some(([n])=>n===name)),task=t?.task||categoryLabels[index];if(task)$("#discipline").value=task;suggestBranch()};
 function parents(){const eligible=existing?p.revisions.filter(v=>!hasAncestor(p.revisions,v.id,existing.id)):p.revisions;$("#parent").innerHTML=opt("","Independent / unknown","")+eligible.filter(v=>v.record===val("owner")).map(v=>opt(v.id,(fileName(v)||revisionLabel(v))+" · "+v.label,initial.parent)).join("")}
 $("#owner").disabled=!!(existing||defaults.record);$("#parent").disabled=!!(defaults.fork||defaults.insertTargets);$("#owner").onchange=parents;$("#path").onchange=suggestLabel;parents();if(defaults.path)suggestLabel()
}
async function setSessionKey(key){hasKey=(await post("key",{key})).hasKey}
function metaLensMark(){
 return '<svg class="meta-lens" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="m12 5 2.2 4.8L19 12l-4.8 2.2L12 19l-2.2-4.8L5 12l4.8-2.2Z" fill="currentColor"/></svg>'
}
function metaRailButton(){
 return `<button type="button" class="meta-entry" data-a="${bind(keyForm)}">${metaLensMark()}<span>${hasKey?"Meta AI settings":"Connect Meta AI"}</span><span class="meta-entry-arrow" aria-hidden="true">↗</span></button>`
}
function keyForm(){
 modal(hasKey?"Meta AI settings":"Connect Meta AI",`<div class="meta-connect">
   <p class="meta-intro">Trace a playtest screenshot back to likely source files, or pinpoint a change between two revisions.</p>
   <div class="meta-features">
     <article><div class="meta-example trace-example" aria-hidden="true"><img src="/art/playtest.jpg" alt=""><span class="subject-frame"></span><span class="example-tag">PLAYTEST FRAME</span></div>
     <div class="meta-feature-copy"><small>SAM 3.1 + Muse Spark 1.3</small><h3>Trace a screenshot</h3><p>Click a subject to find likely matches in its revision history.</p></div></article>
     <article><div class="meta-example diff-example" aria-hidden="true"><img src="/art/lantern-narrow.jpg" alt=""><img src="/art/lantern-wide.jpg" alt=""><span class="example-version">v007.1</span><span class="example-version after">v007.2</span><span class="example-tag">BEFORE / AFTER</span></div>
     <div class="meta-feature-copy"><small>Muse Spark 1.3</small><h3>Compare revisions</h3><p>Mark visible changes on both previews and save them with the pair.</p></div></article>
   </div>
   <p class="meta-import"><b>Organize an import</b> Review suggested asset names and disciplines when you scan a folder.</p>
   <div class="meta-key-panel">${input("key","Meta Model API key","","password",!hasKey)}<small id="key-storage">${hasKey?"A key is configured. Leave blank to clear the session key.":"Stored in local server memory for this session."}</small>
   <details><summary>Use an environment variable</summary><small>Set <code>MODEL_API_KEY</code> before launching the app. It also applies when the session key is empty.</small></details></div></div>`,async()=>{
     await setSessionKey(val("key"));$("#key").value="";render();toast(hasKey?"Key configured. Try Highlight changes in Compare or Trace screenshot in History.":"Session key cleared.")
   },hasKey?"Save settings":"Connect for this session");
 $("#dialogTitle").insertAdjacentHTML("afterbegin",metaLensMark());$("#key").autocomplete="off";$("#key").setAttribute("aria-describedby","key-storage");
 if(matchMedia("(pointer:fine)").matches)$("#key").focus({preventScroll:true})
}
document.addEventListener("click",async e=>{const b=e.target.closest("[data-a]");if(!b||b.disabled)return;const fn=dialogButtonAction.get(b)||actions[Number(b.dataset.a)];if(!fn)return;
 lastCommand=b.textContent.trim();b.disabled=true;try{await fn()}catch(err){if(dialog.open)$("#formError").textContent=err.message;else if(locationState.view==="setup"&&b.isConnected)checkpoint(b,err.message);else toast(err.message)}finally{b.disabled=false}});
$("#form").onsubmit=async e=>{e.preventDefault();if($("#submit").disabled)return;$("#submit").disabled=true;$("#formError").textContent="";
 try{await formAction();dialog.close()}catch(err){$("#formError").textContent=err.message}finally{$("#submit").disabled=false}};
$("#closeDialog").onclick=$("#cancel").onclick=()=>{if(!$("#submit").disabled)dialog.close()};
dialog.oncancel=e=>{if($("#submit").disabled)e.preventDefault()};
dialog.onclose=()=>{if(!dialog.open){$("#fields").innerHTML="";formAction=null}};
const branchKey=v=>JSON.stringify([v.tool,v.branch]);
function branchKeys(r,revs){
 const live=new Set(revs.map(branchKey));
 return [...new Set([...(r.branchOrder||[]).filter(k=>live.has(k)),...live])];
}
let lastRemoval=null;
function removeHistoryItems(r,revs,victims,title){
 const p=project();
   const ids=new Set(victims.map(v=>v.id)),children=revs.filter(v=>!ids.has(v.id)&&ids.has(v.parent));
   const comparisons=revs.reduce((n,v)=>n+v.comparisons.filter(c=>ids.has(v.id)||ids.has(c.before)).length,0);
   modal("Remove from history",`<h3>${esc(title)}</h3><p>Remove ${victims.length} revision${victims.length===1?"":"s"} and ${comparisons} saved comparison${comparisons===1?"":"s"} from this project. Your files stay on disk.</p>${children.length?`<div class="fieldbox"><b>These revisions will have an unknown source</b>${children.map(v=>`<p>${esc(revisionLabel(v))}</p>`).join("")}</div>`:""}`,async()=>{
     const original=p.revisions,order=r.branchOrder||[];
     await change(next=>{next.revisions=next.revisions.filter(v=>!ids.has(v.id));for(const v of next.revisions.filter(v=>v.record===r.id)){if(ids.has(v.parent))v.parent="";v.comparisons=v.comparisons.filter(c=>!ids.has(c.before))}
       find(next.records,r.id).branchOrder=branchKeys(r,next.revisions.filter(v=>v.record===r.id))});
     lastRemoval={project:p.id,record:r.id,version,original,order};render()
   },"Remove from history")
 }

function branchManager(){
 const p=project(),r=record(),revs=p.revisions.filter(v=>v.record===r.id),keys=branchKeys(r,revs);
 async function move(key,to){
   const order=keys.slice();order.splice(order.indexOf(key),1);order.splice(to,0,key);
   await change(p=>{find(p.records,r.id).branchOrder=order});render()
 }
 function rename(key){
   const [tool,name]=JSON.parse(key);
   modal("Rename branch",input("branchName","Branch name",name,"text",true),async()=>{
     const next=need("branchName"),newKey=JSON.stringify([tool,next]);
     if(newKey!==key&&keys.includes(newKey))throw Error("This software already has a branch with that name.");
     await change(p=>{for(const v of p.revisions)if(v.record===r.id&&branchKey(v)===key)v.branch=next;
       find(p.records,r.id).branchOrder=keys.map(k=>k===key?newKey:k)});render()
   })
 }
 function remove(victims,title){return removeHistoryItems(r,revs,victims,title)}
 const undo=lastRemoval?.version===version&&lastRemoval.project===p.id&&lastRemoval.record===r.id;
 main.innerHTML=head(r.name,"Organize branches",btn("← History",()=>openRecord(r.id,"History")))+`<p>Move lanes into reading order. Expand a branch to move or remove individual revisions.</p>${undo?`<div class="pillbox spread">Removed from history.${btn("Undo removal",async()=>{const old=lastRemoval;await change(p=>{p.revisions=old.original;find(p.records,r.id).branchOrder=old.order});lastRemoval=null;render()})}</div>`:""}<div id="branchList">${keys.map((k,i)=>{
 const [t,b]=JSON.parse(k),members=revs.filter(v=>branchKey(v)===k);
 return `<div class="panel branch-row" data-lane="${i}"><div class="spread"><div><small>${toolIcon(toolName(t))} ${esc(toolName(t))} · ${members.length} revision${members.length===1?"":"s"}</small><h2>${esc(b)}</h2></div><div class="actions">${i?btn("↑ Up",()=>move(k,i-1)):""}${i<keys.length-1?btn("↓ Down",()=>move(k,i+1)):""}${btn("Rename",()=>rename(k))}${btn("Remove branch",()=>remove(members,b),"danger")}</div></div><details><summary>Revisions (${members.length})</summary>${members.map(v=>`<div class="row"><div class="grow"><b>${esc(v.label)}</b> · ${esc(v.note)}</div>${btn("Move to branch",()=>{modal("Move revision",input("targetBranch","Destination branch",v.branch,"text",true)+`<datalist id="laneNames">${keys.map(s=>JSON.parse(s)).filter(([tool])=>tool===t).map(([,name])=>opt(name,name,"")).join("")}</datalist><small>Choose an existing branch or type a new one.</small>`,async()=>{const name=need("targetBranch");await change(p=>{find(p.revisions,v.id).branch=name});render()});$("#targetBranch").setAttribute("list","laneNames")})}${btn("Remove",()=>remove([v],revisionLabel(v)),"danger")}</div>`).join("")}</details></div>`
 }).join("")||empty("No branches yet. Add a revision from History.")}</div>`;
 for(const el of main.querySelectorAll("[data-lane]")){
   el.draggable=true;
   el.ondragstart=e=>{e.dataTransfer.setData("application/x-brain-lane",el.dataset.lane);e.dataTransfer.effectAllowed="move"};
   el.ondragover=e=>{if(e.dataTransfer.types.includes("application/x-brain-lane")){e.preventDefault();el.classList.add("drop-target")}};
   el.ondragleave=()=>el.classList.remove("drop-target");
   el.ondrop=async e=>{e.preventDefault();el.classList.remove("drop-target");const from=e.dataTransfer.getData("application/x-brain-lane");
     if(from!==""&&keys[from]&&from!==el.dataset.lane)try{await move(keys[from],Number(el.dataset.lane))}catch(err){toast(err.message)}};
 }
}
const setupStages=[
 ["Planning & design","Design",[["Notion","md,csv"],["Obsidian","md,canvas"],["Miro","pdf,png"],["Google Docs","docx,pdf"]]],
 ["Documentation & AI sessions","Research",[["Obsidian","md,canvas"],["Notion","md,csv"],["ChatGPT","md,json,txt"],["Codex","md,jsonl,txt"],["Claude","md,json,txt"]]],
 ["2D illustration & pixel art","2D Sprites",[["Krita","kra"],["Photoshop","psd,psb"],["Illustrator","ai,svg"],["Aseprite","ase,aseprite"],["Affinity Designer","afdesign"],["Clip Studio Paint","clip"]]],
 ["3D modeling & sculpting","3D Modeling",[["Blender","blend,fbx,obj"],["Maya","ma,mb"],["ZBrush","zpr,ztl"],["3ds Max","max"],["Houdini","hip,hiplc"],["Blockbench","bbmodel"]]],
 ["Texturing & materials","Texturing",[["Substance 3D Painter","spp"],["Substance 3D Designer","sbs,sbsar"],["Blender","blend,fbx,obj"],["Mari","mra"],["ArmorPaint","arm"]]],
 ["Rigging","Rigging",[["Blender","blend,fbx,obj"],["Maya","ma,mb"],["Spine","spine"],["Cascadeur","casc"],["Mixamo","fbx"]]],
 ["Animation","Animation",[["Blender","blend,fbx,obj"],["Maya","ma,mb"],["Spine","spine"],["Aseprite","ase,aseprite"],["Cascadeur","casc"],["After Effects","aep"]]],
 ["Audio & music","Audio",[["REAPER","rpp"],["Audacity","aup3"],["FL Studio","flp"],["Ableton Live","als"],["FMOD Studio","fspro"],["Wwise","wproj"]]],
 ["Engine & mechanics","Mechanics",[["Unreal Engine","uproject,uasset,umap"],["Unity","unity,prefab,asset,cs"],["Godot","godot,tscn,tres,gd"],["UEFN","uefnproject,verse"],["Roblox Studio","rbxl,rbxlx,rbxm"],["Meta Horizon Worlds","ts,json"],["GameMaker","yyp,yy"]]],
 ["Playtesting & capture","Playtests",[["OBS Studio","mkv,mp4"],["Xbox Game Bar","mp4"],["NVIDIA App","mp4"],["ShareX","png,mp4"]]],
 ["Video editing","Release desk",[["DaVinci Resolve","drp,dra"],["Premiere Pro","prproj"],["After Effects","aep"],["CapCut","mp4,mov"],["Final Cut Pro","fcpxml"]]],
 ["Marketing & store art","Marketing",[["Photoshop","psd,psb"],["Canva","png,pdf,mp4"],["Figma","fig,svg"],["Illustrator","ai,svg"],["Krita","kra"]]],
 ["Publishing & updates","Release desk",[["Steamworks","md,txt,png"],["itch.io","zip,md,png"],["Creator Portal","png,jpg,mp4,md"],["Roblox Creator Dashboard","png,jpg,md"],["Meta Horizon Creator Portal","png,jpg,mp4,md"]]],
 ["VFX & simulation","VFX & simulation",[]],
 ["Terrain & foliage","Terrain & foliage",[]]
];
let guide;
function startSetup(){go("setup")}
const guideOnLaunch="gdb.guide.onLaunch";
const drills=[
 {title:"Track a source file",line:"This Blender file needs a home. Pick the asset it belongs to.",file:"harbor_lantern_v007.2.blend",picks:["Harbor lantern","Tide bell"],art:["lantern-wide","bell"],answer:0,tip:"Match the filename to its asset.",success:"Linked. The lantern record now knows which Blender file made it."},
 {title:"Read a revision",line:"Look at these two previews. Which note describes the visible change?",picks:["The handle is wider","The glass is blue"],answer:0,tip:"Compare the metal handle above the lamp.",success:"Exactly. The visible change and the artist’s reason can be saved separately."},
 {title:"Trace the handoff",line:"The texture pass used the wide-handle mesh. Pick its exact source revision.",file:"brass_wear_v001.spp",picks:["Blender v007.1","Blender v007.2"],art:["lantern-narrow","lantern-wide"],answer:1,tip:"Follow the version you just compared.",success:"Handoff recorded. Painter v001 points back to Blender v007.2."}
];
let introReply="",introPending=false,introAttempted=false;
function askCoach(lesson,question){return post("ai",{project:project().id,mode:"coach",lesson,question})}
function chatWithStudioAssistant(){
 const lesson=!locationState.practice?["Name the game to create or continue a project.","Pick a role and adjust disciplines.","Adjust suggested software per discipline.","Choose working folders and describe what you do in each tool.","Review asset names, categories, file notes and suggested branches."][getIntake().step]:(drills[guide.practice-1]?.line||"Introduce the app and the practice sequence.");
 modal("Ask the assistant",`<div class="coach-identity">${graphMark()}<div><b>Studio assistant</b><br><small>Live coaching with Meta Muse Spark</small></div></div>${hasKey?"":input("coachKey","Meta Model API key · this session","","password")}${area("coachQuestion","What would you like help with?")}<div class="actions">${btn("Ask →",async()=>{
 const q=need("coachQuestion");if(!hasKey){const k=need("coachKey");hasKey=(await post("key",{key:k})).hasKey;$("#coachKey").value=""}
 $("#coachAnswer").textContent="Thinking…";
 try{const res=await askCoach(lesson,q);if($("#coachAnswer"))$("#coachAnswer").textContent=res.text}catch(err){if($("#coachAnswer"))$("#coachAnswer").textContent=err.message}
 },"primary")}</div><p class="sub">Only this lesson and your question go to Meta.</p><div id="coachAnswer" class="text" role="status"></div>`,async()=>{},"Done")
}
function startPractice(){guide={practice:0};go("setup",{practice:true})}
function advancePractice(){
 if(guide.practice===3){go("home");toast("Practice complete.");return}
 guide.practice=(guide.practice||0)+1;delete guide.passed;render();window.scrollTo(0,0)
}
function practiceView(n){
 const out=$("#setupBody");
 if(!n){
   out.innerHTML=`<div class="briefing"><div><div class="eyebrow">Your first assignment</div><h2>One prop. Three studio skills.</h2><p>Give a Blender file a home, spot a revision, then trace the mesh into Painter. You’ll try all three with a practice lantern.</p><div class="actions">${btn("Start practice →",advancePractice,"primary")}</div></div><div class="brief-art">${image("/art/lantern-wide.jpg","","Practice lantern")}<span>FIELD SPECIMEN &nbsp; / &nbsp; 001</span></div></div>`;
   if(hasKey&&!introAttempted&&!introPending){
     introAttempted=true;introPending=true;askCoach("Welcome to guided onboarding.","Explain what tracking a file, comparing revisions and following a handoff will let me do.").then(res=>{introReply=res.text;if((guide?.practice||0)===0&&$("#pipIntro"))$("#pipIntro").textContent=introReply}).catch(()=>{}).finally(()=>{introPending=false})
   }
   return
 }
 const d=drills[n-1];
 function choose(i,b){
   if(i!==d.answer){checkpoint(b,n===2?"Look at the handle and try again.":"Try the other match.");return}
   guide.passed=true;render()
 }
 const cards=d.picks.map((label,i)=>`<button type="button" class="drill-pick ${guide.passed&&i===d.answer?"matched":""}" ${guide.passed?"disabled":""} data-a="${bind(()=>choose(i,$("#practicePick"+i)))}" id="practicePick${i}">${d.art?image("/art/"+d.art[i]+".jpg","",label):""}<span>${esc(label)}</span></button>`).join("");
 out.innerHTML=`<div class="practice-board"><div class="eyebrow">Practice bench · ${n} of 3</div><h2>${esc(d.title)}</h2><p>${esc(d.line)}</p>${d.file?`<div class="bench-file">${toolIcon(n===1?"Blender":"Substance Painter")} ${esc(d.file)}</div>`:""}${n===2?`<div class="bench-comparison">${["lantern-narrow","lantern-wide"].map((art,i)=>`<figure>${image("/art/"+art+".jpg","","Handle profile")}<figcaption>Blender v007.${i+1}</figcaption></figure>`).join("")}</div>`:""}<div class="drill-choices">${cards}</div>${guide.passed?`<div class="practice-result" role="status">✓ ${esc(d.success)}</div><div class="actions">${btn(n===3?"Return to project →":"Next exercise →",advancePractice,"primary")}</div>`:""}</div>`;
}
let priorMeter=0;
function animateMeter(){
 const meter=$(".journey-meter"),fill=meter.querySelector("i");
 const value=Number(meter.getAttribute("aria-valuenow"));
 if(value!==priorMeter&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
   fill.animate([{width:priorMeter+"%"},{width:value+"%"}],{duration:650,easing:"cubic-bezier(.19,1,.22,1)"})
 }
 priorMeter=value
}
function guideBanner(){
 const step=guide.practice||0;
 const practice=guide.practice||0;
 const scene=practice===0?{title:"Welcome to your studio.",line:introReply||"I’ll help you find the file behind an asset, see what changed, and remember why you made it.",art:"jungle"}:{title:["","Find its home.","Spot the difference.","Follow the handoff."][practice],line:"Try this on the practice bench. Your project files stay untouched.",art:practice===2?"concept":"jungle"};
 const stops=["Briefing","Match a file","Compare","Trace a handoff"],index=step;
 const percent=Math.round((step===0?0:step-1+(guide.passed?1:0))/3*100);

 return `<div class="guide-toolbar"><span class="studio-brand">${graphMark()} Game Dev Brain</span><div class="actions"><label class="launch-switch"><input type="checkbox" id="guideOnLaunch" ${localStorage.getItem(guideOnLaunch)!=="off"?"checked":""}> Guide me on launch</label>${btn("Back to project",()=>go("home"))}${btn("Ask the assistant",chatWithStudioAssistant)}</div></div>
 <header class="practice-header">${graphMark()}<small class="eyebrow">Practice / ${esc(stops[index])}</small><h1>${esc(scene.title)}</h1><p id="pipIntro">${esc(scene.line)}</p></header>
 <div class="journey"><div class="spread"><strong>Your studio journey</strong><small>${percent}% complete</small></div><div class="journey-meter" role="progressbar" aria-label="Onboarding progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="--progress:${percent}%"></i></div><div class="journey-stops">${stops.map((n,i)=>`<span class="${i===index?"now":i<index?"past":""}" ${i===index?'aria-current="step"':""}><b>${i<index?"✓":"0"+(i+1)}</b> ${n}</span>`).join("")}</div></div><div id="setupBody"></div>`;
}
function refreshCoach(){
 if(locationState?.view!=="setup"||!guide)return;
 const body=$("#setupBody");if(!body)return;
 const next=body.querySelector(".actions:last-child .primary");
 let target,copy;
 const practice=guide.practice||0;
 if(practice===0){target=next;copy="Start here. I’ll guide each click."}
 else if(practice<4){target=guide.passed?next:$("#practicePick"+drills[practice-1].answer);copy=guide.passed?"Good work. Continue here.":drills[practice-1].tip}
 const old=$("#pipCue"),previous=body.querySelector(".cue-target");
 if(target&&previous===target&&old?.textContent==="TIP"+copy)return;
 if(previous){previous.classList.remove("cue-target");previous.removeAttribute("aria-describedby")}
 old?.remove();if(!target)return;
 const tip=document.createElement("span");tip.id="pipCue";tip.className="pip-cue";tip.innerHTML="<b>TIP</b>"+esc(copy);
 target.classList.add("cue-target");target.setAttribute("aria-describedby","pipCue");
 // Keep palettes intact: the callout follows the relevant button in reading order.
 target.insertAdjacentElement("afterend",tip)
}
function checkpoint(el,message){
 if(!el?.isConnected)return;
 const badge=document.createElement("span");badge.className="checkpoint";badge.setAttribute("role","status");badge.textContent=message;
 document.querySelector(".checkpoint")?.remove();el.insertAdjacentElement("afterend",badge);setTimeout(()=>badge.remove(),1800)
}
document.addEventListener("pointerdown",e=>{
 if(!e.target.closest("button")||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 const ring=document.createElement("i");ring.className="click-wave";ring.style.left=(e.clientX-6)+"px";ring.style.top=(e.clientY-6)+"px";
 document.body.append(ring);setTimeout(()=>ring.remove(),500)
});
function setupView(){
 main.innerHTML=guideBanner();animateMeter();
 $("#guideOnLaunch").onchange=e=>{localStorage.setItem(guideOnLaunch,e.target.checked?"on":"off");render()};practiceView(guide.practice)
}
const pathKey=s=>s.replaceAll("\\","/").toLowerCase();
function fileGuess(path){const info=seriesInfo(path,"");return {name:info.asset,label:info.label}}
async function boot(){
 const res=await fetch("/api/state");if(!res.ok)throw Error("Local server unavailable.");
 const init=await res.json();installFormats(init.formats);({state:data,version,token,hasKey}=init);editHistory=init.history||editHistory;
 try{locationState=JSON.parse(localStorage.getItem("gdb.view"))}catch{}
 if(!locationState||!find(data.projects,locationState.project))locationState={project:data.projects[0].id,view:"home"};
 const address=new URL(location.href),demo=address.searchParams.get("demo");
 if(demo==="trace"||demo==="compare"){
   const trace=demo==="trace",p=find(data.projects,trace?"canopy":"brine"),asset=p&&find(p.records,trace?"bird":"lamp");
   address.searchParams.delete("demo");history.replaceState(null,"",address);
   if(asset&&(trace||["l71","l72"].every(id=>find(p.revisions,id)?.record===asset.id))){
     locationState.project=p.id;openRecord(asset.id,trace?"History":"Compare",trace?{}:{before:"l71",after:"l72"});
     if(trace)traceScreenshot(asset,p.revisions.filter(v=>v.record===asset.id),true);
     return
   }
   toast("This example is missing from this library.")
 }
 if(localStorage.getItem(guideOnLaunch)!=="off"){locationState.view="setup";delete locationState.practice}
 else if(locationState.view==="setup"&&(!localStorage.getItem(intakeSlot)||locationState.practice))locationState.view="home";
 render()
}
boot().catch(e=>{main.textContent=e.message});
