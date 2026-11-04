"use strict";

let formatsByTool={},compoundFormats=[];
function extensions(list){return [...new Set((list||"").toLowerCase().split(/[\s,;]+/).filter(Boolean).map(e=>"."+e.replace(/^\./,"")))]}
function installFormats(formats){
 formatsByTool=formats||{};
 for(const [name,profile] of Object.entries(formatsByTool)){
   for(const task of profile.stages){
     const stage=setupStages[categoryLabels.indexOf(task)];if(!stage)continue;
     const prior=stage[2].find(row=>row[0]===name);
     const list=extensions([profile.working,profile.exchange,prior?.[1]].join(" ")).map(e=>e.slice(1)).join(",");
     if(prior)prior[1]=list;else stage[2].push([name,list])
   }
 }
}
function toolCatalog(p){
 const catalog=new Map(setupStages.flatMap(s=>s[2]));
 for(const t of p.tools)catalog.set(t.name,extensions([catalog.get(t.name),t.extensions].join(" ")).join(","));
 return catalog
}
function updateCompoundFormats(p){
 const all=[...Object.values(formatsByTool).map(profile=>profile.working+" "+profile.exchange),...p.tools.map(t=>t.extensions)];
 compoundFormats=extensions(all.join(" ")).filter(e=>e.indexOf(".",1)>0).sort((a,b)=>b.length-a.length)
}
function fileExt(path){
 const name=(path||"").split(/[\\/]/).at(-1).toLowerCase();
 return compoundFormats.find(e=>name.endsWith(e))||name.match(/\.[^.\s]+$/)?.[0]||""
}
function detectSoftware(p,path,context){
 const ext=fileExt(path);if(!ext)return "";
 const catalog=toolCatalog(p),matches=[...catalog.keys()].filter(n=>extensions(catalog.get(n)).includes(ext));
 const eligible=p.tools.filter(t=>matches.includes(t.name)),key=pathKey(path);
 const folders=eligible.flatMap(t=>(t.folders||[]).map(folder=>({name:t.name,folder:pathKey(folder).replace(/\/$/,"")+"/"})))
   .filter(x=>key.startsWith(x.folder)).sort((a,b)=>b.folder.length-a.folder.length);
 if(folders.length&&new Set(folders.filter(x=>x.folder===folders[0].folder).map(x=>x.name)).size===1)return folders[0].name;
 const native=matches.filter(n=>extensions(formatsByTool[n]?.working).includes(ext));
 const choices=native.length?native:matches;
 if(choices.includes(context))return context;
 if(choices.length===1)return choices[0];
 const registered=eligible.filter(t=>choices.includes(t.name));
 return registered.length===1?registered[0].name:""
}
const classPath=cls=>lineage(cls).map(c=>c.name).join(" / ");
const fileName=v=>v.path?.split(/[\\/]/).at(-1)||"";
const numericLabels=new Intl.Collator(undefined,{numeric:true,sensitivity:"base"});
function versionCompare(a,b){
 const phase=v=>/^start$/i.test(v.label)?-1:/^final$/i.test(v.label)?1:0;
 return (a.sequence??Infinity)-(b.sequence??Infinity)||phase(a)-phase(b)||numericLabels.compare(a.label,b.label)||numericLabels.compare(a.path||"",b.path||"")
}
const formatLane=v=>JSON.stringify([v.tool,v.branch,fileExt(v.path)]);
function connectMilestones(p,recordId,tool,branch,format){
 const group=p.revisions.filter(v=>v.record===recordId&&v.tool===tool&&v.branch===branch&&fileExt(v.path)===format);
 const families=new Map();
 for(const v of group){
   if(!/^(start|final)$/i.test(v.label)||!v.path)continue;
   const asset=seriesInfo(v.path,v.discipline).asset.toLowerCase();
   if(!families.has(asset))families.set(asset,[]);families.get(asset).push(v)
 }
 for(const pair of families.values()){
   const first=pair.find(v=>/^start$/i.test(v.label)),last=pair.find(v=>/^final$/i.test(v.label));
   if(pair.length===2&&first&&last&&!last.parent&&!hasAncestor(p.revisions,first.id,last.id))last.parent=first.id
 }
}
function folderTypeOptions(box,name,src){
 const formats=extensions([appExtensions(name),toolCatalog(project()).get(name)].join(" ")),working=extensions(formatsByTool[name]?.working);
 box.innerHTML=src.folders.map((path,i)=>{
   const key=pathKey(path),chosen=src.formats[key]??(working.length?formats.filter(e=>working.includes(e)):formats.slice());
   src.formats[key]=chosen;
   return `<fieldset class="format-options"><legend>File types to track</legend><small class="path">${esc(path)}</small><div>${formats.map(ext=>`<label><input type="checkbox" data-dir="${i}" value="${esc(ext)}" ${chosen.includes(ext)?"checked":""}>${esc(ext)}${working.includes(ext)?" · working file":formatsByTool[name]?" · exchange / export":""}</label>`).join("")}</div></fieldset>`
 }).join("");
 box.onchange=e=>{const input=e.target;if(!input.matches("[data-dir]"))return;src.formats[pathKey(src.folders[Number(input.dataset.dir)])]=[...input.closest("fieldset").querySelectorAll("input:checked")].map(x=>x.value);stash()}
}
const closedClasses=new Set();
document.addEventListener("toggle",e=>{
 const group=e.target;if(!group.isConnected||!group.matches?.("details[data-class-key]"))return;
 if(group.open)closedClasses.delete(group.dataset.classKey);else closedClasses.add(group.dataset.classKey)
},true);
function classLibrary(p,card){
 const children=new Map(),assets=new Map();
 function group(map,key,value){if(!map.has(key))map.set(key,[]);map.get(key).push(value)}
 for(const c of p.classes)group(children,c.parent||"",c);
 for(const r of p.records)group(assets,r.cls||"",r);
 function draw(key){
   const rows=(children.get(key)||[]).map(c=>{
     const sec=find(p.sections,c.section),classKey=p.id+"/"+c.id,tag=!c.parent&&sec?`<small>${esc(sec.name)}</small>`:"";
     const button=(label,tip,fn)=>`<button type="button" data-a="${bind(fn)}" data-help="${esc(tip)}" aria-label="${esc(tip)}">${label}</button>`;
     const content=draw(c.id);
     return `<details class="class-group" data-class-key="${esc(classKey)}" ${closedClasses.has(classKey)?"":"open"}><summary><span class="class-heading"><b>${esc(c.name)}</b>${tag}<span class="class-actions">${button("+","Add a subclass to "+c.name,()=>classForm(sec,null,c.id))}${button("Edit","Edit or organize "+c.name,()=>classForm(sec,c))}</span></span></summary>${content||`<div class="class-empty">Empty class ${btn("+ Add asset",()=>recordForm(null,c.section,c.id),"text-btn")}</div>`}</details>`
   });
   return rows.join("")+(assets.get(key)||[]).map(card).join("")
 }
 return draw("")
}
const accents={embergen:"#e87624",illugen:"#a64d9a",liquigen:"#267dd0",geogen:"#81a74a",gaea:"#478b77",toolbag:"#b58547",assetforge:"#4b9db4",rizomuv:"#c04d41",blender:"#ea7500",painter:"#58a30a",designer:"#829b0d",maya:"#208ca0",zbrush:"#726753",photoshop:"#239dea",illustrator:"#ef9006",obsidian:"#8b68d2",aseprite:"#866da5",krita:"#ba528f",unity:"#737882",unreal:"#405064",godot:"#4788bb",uefn:"#475775",resolve:"#437e92",premiere:"#8a66d3",aftereffects:"#9674df",reaper:"#65936d",fmod:"#777777",houdini:"#e06c24",roblox:"#4c69c6",steam:"#39749d",figma:"#b15a92",notion:"#65645f",miro:"#d2a014",audacity:"#3e64ae",flstudio:"#da862c",meta:"#307fe3",docs:"#3a7dda",affinity:"#299ab6",clip:"#6f8291",blockbench:"#416bc5",max:"#398887",spine:"#ba6857",cascadeur:"#74a746",mixamo:"#b7793b",armor:"#ab7540",mari:"#719653",gamemaker:"#66a482",obs:"#555555",capcut:"#595959",canva:"#20a5ba",chatgpt:"#448977",claude:"#bf765b",codex:"#c8823d",ableton:"#727374",wwise:"#55899c",xbox:"#469143",nvidia:"#6da121",sharex:"#586fc6",itch:"#d95d61",finalcut:"#9879ac",fortnite:"#8267b3"};
function defaultAccent(tool){
 const simple=tool.replace(/^(Adobe|Autodesk)\s+/i,"").toLowerCase(),key=Object.keys(iconNames).find(k=>k.toLowerCase()===simple);
 return productBadges[tool]?.[1]||accents[iconNames[key]]||"#9b9283"
}
function nodeColor(v){return /^#[\da-f]{6}$/i.test(v.color)?v.color:defaultAccent(toolName(v.tool))}
function colorDialog(v){
 const base=defaultAccent(toolName(v.tool));
 modal("Node color",`<p>Choose a tint for ${esc(fileName(v)||v.label)}.</p>`+input("nodeTint","Custom tint",nodeColor(v),"color")+`<label class="switch-line"><input id="autoTint" type="checkbox" ${v.color?"":"checked"}> Use ${esc(toolName(v.tool))} logo color</label>`,async()=>{
  await change(p=>{const x=find(p.revisions,v.id);if($("#autoTint").checked)delete x.color;else x.color=val("nodeTint")});render()
 });
 $("#nodeTint").oninput=()=>{$("#autoTint").checked=false};$("#autoTint").onchange=e=>{if(e.target.checked)$("#nodeTint").value=base}
}
function graphSettings(r,revs){
 const g=r.graphPrefs||{},types=[...new Set(revs.map(v=>fileExt(v.path)).filter(Boolean))].sort();
 modal("Graph settings",select("graphTitles","Card titles",[["file","Filename first"],["version","Version first"],["short","Version only"]].map(([k,n])=>opt(k,n,g.titles||"file")).join(""))+select("graphFormat","Visible file type",opt("","All tracked files",g.format||"")+types.map(t=>opt(t,t,g.format)).join(""))+`<label class="switch-line"><input type="checkbox" id="graphPics" ${g.previews!==false?"checked":""}> Show preview thumbnails</label>`,async()=>{
  await change(p=>{find(p.records,r.id).graphPrefs={titles:val("graphTitles"),format:val("graphFormat"),previews:$("#graphPics").checked}});locationState.showAll=false;render()
 })
}
function setReady(r,v){
 return change(p=>{const current=find(p.revisions,v.id),clear=current.engineReady;for(const f of p.revisions)if(f.record===r.id)delete f.engineReady;if(!clear)current.engineReady=true}).then(render)
}
function productionPath(r,revs){
 const steps=new Map();for(const v of revs){const task=v.discipline||v.branch;steps.set(task,v)}
 const ready=revs.find(v=>v.engineReady);
 return `<div class="asset-process"><span>Asset workflow</span>${[...steps.keys()].map(task=>btn(task,()=>revealRevision(r,steps.get(task)),"stage-pill")).join("")}${ready?btn("✓ Engine ready · "+(fileName(ready)||ready.label),()=>revealRevision(r,ready),"ready-pill"):'<small>Engine ready · unmarked</small>'}</div>`
}
function revealRevision(r,v){openRecord(r.id,"History",{revision:v.id})}
function trackedAt(p,path){return path&&p.revisions.find(v=>v.path&&pathKey(v.path)===pathKey(path))}
function transferSet(p,revision,dest){
 if(!revision||revision.record===dest)return [];
 const peers=p.revisions.filter(v=>v.record===revision.record),neighbors=new Map(peers.map(v=>[v.id,[]]));
 for(const v of peers){for(const other of [v.parent,...(v.comparisons||[]).map(c=>c.before)])if(neighbors.has(other)){neighbors.get(v.id).push(other);neighbors.get(other).push(v.id)}}
 const stack=[revision.id],seen=new Set();
 while(stack.length){const id=stack.pop();if(seen.has(id))continue;seen.add(id);stack.push(...neighbors.get(id))}
 return peers.filter(v=>seen.has(v.id))
}
function transferMessage(p,v,dest){
 const family=transferSet(p,v,dest);
 if(!family.length)return "Already in this graph. Save to update this revision.";
 const readyConflict=family.some(f=>f.engineReady)&&p.revisions.some(f=>f.record===dest&&f.engineReady);
 return `Move ${fileName(v)||v.label} from ${find(p.records,v.record).name} into this asset.${family.length>1?` Its ${family.length-1} linked revision${family.length===2?"":"s"} will move with it to preserve handoffs and comparisons.`:""}${readyConflict?" The destination keeps its current engine-ready version.":""}`
}
function moveTracked(p,v,dest){
 const group=transferSet(p,v,dest);
 const ready=p.revisions.some(x=>x.record===dest&&x.engineReady);
 for(const f of group){f.record=dest;delete f.canvas;delete f.sequence;if(ready)delete f.engineReady}
}
function chooseTracked(r,parent){
 const p=project(),items=p.revisions.filter(v=>v.path&&v.record!==r.id);
 if(!items.length){toast("This project has no tracked files in other assets.");return}
 modal("Bring a tracked file here",select("trackedSource","Tracked file",items.map(v=>opt(v.id,`${recordName(v.record)} / ${fileName(v)}`,"")).join(""))+`<p id="moveImpact"></p>`+select("trackedParent","Derived from",opt("","Keep existing source",parent?.id)+p.revisions.filter(v=>v.record===r.id).map(v=>opt(v.id,(fileName(v)||revisionLabel(v))+" · "+v.label,parent?.id)).join("")),async()=>{
  const key=val("trackedSource"),source=val("trackedParent");await change(p=>{const v=find(p.revisions,key);moveTracked(p,v,r.id);if(source)v.parent=source});await revealRevision(find(project().records,r.id),find(project().revisions,key))
 },"Bring into this graph");
 const update=()=>{$("#moveImpact").textContent=transferMessage(p,find(p.revisions,val("trackedSource")),r.id)};$("#trackedSource").onchange=update;update()
}
const fieldHelp=[
 [/^Link \(optional\)/i,"The original web page, document or conversation for this saved source."],
 [/^Tool name$/i,"Enter the name you use for this application. It will appear alongside the other tools in your workflow."],
 [/^Find by project|^Search names/i,"Search by filename, software, asset name or version to return to its history."],
 [/^What would you like help with/i,"Ask the studio assistant about the current setup step or practice exercise."],
 [/^Position among siblings$/i,"Choose where this class appears under its parent. Its assets and subclasses move with it."],
 [/^Project name$/i,"The name of your game in this workspace. Each project keeps its own asset histories, tools and classes."],
 [/^Comparison note/i,"Record the differences between the two versions on screen. The saved note stays with that pair."],
 [/^Before$|^After$/i,"Choose the revision to show on this side of the comparison."],
 [/^Existing record$|^Role in this record$/i,"Link an existing asset or feature here and explain how it is used. Its Used in tab links back."],
 [/^Question$/i,"Ask Meta about the files, handoffs and decisions saved in the current project."],
 [/^Linked record$|^Asset name$|^Record name$/i,"The game asset that owns this history. A single asset can have Blender, Painter and engine files."],
 [/^Branch\b/i,"A named line of work on this asset. Keep successive rig fixes on “Rigging”, or give an experiment its own branch, such as “Longer claws”."],
 [/^Discipline$|^Task \/ branch|^What are you doing/i,"The production step this file belongs to, such as modeling, texturing, rigging or engine integration."],
 [/^Source revision|^Derived from|^Source version/i,"Choose the exact version you used to make this one. The graph draws an arrow from that source. Leave it independent if you don’t know."],
 [/^Revision label$|^Version$/i,"A short name for this point in the history, such as v007, Start or Final. The original filename is kept separately."],
 [/^Source file path$|^Source file$|^Project file$/i,"Where the original file lives on your PC. Browse to it once so you can reopen it from the graph."],
 [/^Software$|^Created in$|^Software name$/i,"The application that produced this file, such as Blender for a .blend project or Painter for a .spp texture project."],
 [/^Artist note|^Quick note|^What did you create/i,"Write what changed or why you saved this version. This note stays with the file and appears when you hover its card."],
 [/^Preview image|^Use an image/i,"An optional screenshot or render for the card and side-by-side comparisons. Choose the working file separately."],
 [/^Asset class path|^Classification|^Or create a classification/i,"How you group this asset in the game. Enter a path such as NPCs / NPC Wildlife / Friendly to create nested classes."],
 [/^Class$|^Class name$|^Parent class$/i,"Classes group assets by their role in the game. A parent class lets you nest Wildlife under NPCs and Friendly under Wildlife."],
 [/^Asset type$/i,"A broad description of what this is, such as character, prop, sound or environment."],
 [/^Project section|^Section name|^What goes here/i,"The part of the project where this record lives. Its revision history can span several production disciplines."],
 [/^Purpose & notes/i,"Describe the asset as a whole here. Use quick notes for changes specific to one file version."],
 [/^Field name|^Field type|^Choose records from/i,"Define an extra property for records in this class or section. Use a Reference field to point to another asset or mechanic."],
 [/^File types to track|^File extensions/i,"Only the checked file types are discovered in this folder. For Blender, .blend is the editable project and .fbx is an export."],
 [/^Project folders|^Application folder/i,"Choose folders for this tool and game. Working folders are scanned for matching files. Installation folders are shortcuts."],
 [/^Tracked file$/i,"Pick a revision that is already in another asset history in this project. Review which linked files will move before saving."],
 [/^Card titles$/i,"Choose which text is largest on each card. Filename first shows the real file above its version label."],
 [/^Visible file type$/i,"Show one file format in this graph or show all of them. Hidden files stay tracked."],
 [/^Custom tint$/i,"Pick an accent for this node. The card uses a light tint for readability. Use the software color option to reset it."],
 [/^Asset emoji|^Emoji|^Image or emoji/i,"A small visual identifier for this asset in the library."],
 [/^Destination branch|^Branch name/i,"Enter an existing branch to join it, or give this line of work a new name."],
 [/^Source title|^Source type|^Original excerpt|^Decision or next check/i,"Save the document, conversation or observation that informed this asset, along with the relevant excerpt or decision."],
 [/^Session key|Meta Model API key/i,"Connect your Meta account for live suggestions, comparisons and project questions. This session key stays in server memory."],
 [/^Node order/i,"Move this file within its format and branch. Confirmed source arrows still determine which version must come first."]
];
const actionHelp=[
 [/^\+ Add field$/,"Add a property to this section or class. Remove the row with ×, or use Undo field."],
 [/^\+ Add record$|^\+ Add asset$/,"Create an asset and optionally select its first project file, software and revision note."],
 [/^\+ New class$/,"Group assets by their role in this game. Choose a parent to make a more specific class."],
 [/^File types$/,"Choose which formats to discover in each folder linked to this tool."],
 [/^Project settings$/,"Change the project name, active disciplines and the software you use for each one."],
 [/^\+ Root class$/,"Create a top-level group for game assets. Use the + beside a class to nest another group."],
 [/^Paste screenshot$/,"Apply an image from your clipboard. You can also press Ctrl+V with a revision or preview field selected."],
 [/^Asset library$/,"Browse your project by asset class and open an asset’s revision graph."],
 [/^Software & folders$/,"Choose working folders and find the files created in each application."],
 [/^(?:⑂ )?New branch$|^Fork from here$/,"Start an alternative line of work from the selected version. Its first revision keeps a link back to the source."],
 [/^\+ Add files$|^Choose files…$|^Add files from here$/,"Pick files from any folder. You can bring an existing tracked revision into this asset during review."],
 [/^Bring tracked file/,"Join a file from another asset in this project without picking it again on disk. You’ll see which connected revisions travel with it."],
 [/^Graph settings$/,"Change card titles, filter by file type, or toggle preview images for this asset."],
 [/^Manage branches$/,"Rename branches, change their order, and move or remove revisions."],
 [/^Node color$/,"Override the software’s default tint on the selected version, or restore the logo color."],
 [/^Mark engine ready$|^Clear engine-ready/,"Identify the exact revision you would import into the engine. One version per asset can hold this designation."],
 [/^Classify asset$|^Edit class path$/,"Choose where this asset appears in the project’s class tree."],
 [/^Delete branch/,"Review the whole branch and its handoffs before removing it from the library. Undo can restore it."],
 [/^Delete version/,"Review the selected version before removing it from the library."],
 [/^Compare revisions$|^Compare$/,"Choose two versions of this asset to inspect their previews and record the differences."],
 [/^Disconnect source$/,"Remove the selected version’s incoming arrow. Its file and notes stay with the asset."],
 [/^Earlier$|^Later$/,"Move this version one place within the same branch and format. You can reverse a direct source arrow after reviewing the change."],
 [/^Edit revision$/,"Change this file’s label, branch, discipline, source, notes or preview."],
 [/^Reveal$|^Show in folder$/,"Select this original file in Windows Explorer."],
 [/^Fit$/,"Zoom the canvas to fit the visible revision cards."],
 [/^Save note$/,"Save the note for this exact version. Ctrl+Enter also saves from the note box."],
 [/^Used in/,"See which mechanics, systems and other project records reference this asset."],
 [/^History$/,"Open the asset’s revisions and the handoffs between tools."],
 [/^Organize folder assets$|^Scan folders$/,"Look in linked folders for files that match their selected extensions."],
 [/^Edit record$/,"Edit the asset’s name, home section, classification, description and preview."]
];
function guidance(text,table){return table.find(([re])=>re.test(text.trim()))?.[1]||""}
function explainFields(root){
 const labels=root.matches?.("label[for]")?[root]:[...(root.querySelectorAll?.("label[for]")||[])];
 for(const label of labels){
   if(label.dataset.explained||!label.isConnected)continue;
   const name=label.textContent.trim();let help=guidance(name,fieldHelp);
   if(!help&&label.closest("#custom")){const field=fieldsFor(val("section"),val("cls")).find(f=>"f"+f.id===label.htmlFor);
     if(field)help=field.type==="Reference"?"Choose the existing project record to reference here.":`A ${field.type.toLowerCase()} property defined for this record’s class or section.`
   }
   if(!help)continue;
   label.dataset.explained="true";const cap=document.createElement("span");cap.className="help-caption";label.before(cap);cap.append(label);
   const b=document.createElement("button");b.className="info-button";b.type="button";b.textContent="i";b.dataset.help=help;b.setAttribute("aria-label","Help for "+name);cap.append(b)
 }
}
function installHelp(){
 let tip=null,anchor=null,pending=0;
 function close(){clearTimeout(pending);if(anchor?.getAttribute("aria-describedby")==="context-help")anchor.removeAttribute("aria-describedby");tip?.remove();tip=null;anchor=null}
 function show(el,message){
   close();if(!el.isConnected)return;
   anchor=el;tip=document.createElement("div");tip.id="context-help";tip.className="context-help";tip.setAttribute("role","tooltip");tip.textContent=message;
   if("showPopover" in tip)tip.popover="manual";(el.closest("dialog[open]")||document.body).append(tip);tip.showPopover?.();el.setAttribute("aria-describedby",tip.id);
   const a=el.getBoundingClientRect(),b=tip.getBoundingClientRect();const left=Math.max(7,Math.min(a.left,innerWidth-b.width-7)),top=a.bottom+b.height+9<innerHeight?a.bottom+6:Math.max(7,a.top-b.height-6);
   tip.style.left=left+"px";tip.style.top=top+"px"
 }
 function describe(e,instant=false){
   const el=e.target.closest?.("button,[data-help]");if(!el||el===anchor)return;
   const msg=el.dataset.help||guidance(el.textContent,actionHelp);if(!msg)return;
   close();if(instant)show(el,msg);else pending=setTimeout(()=>show(el,msg),320)
 }
 document.addEventListener("pointerover",e=>describe(e));document.addEventListener("focusin",e=>describe(e,true));
 document.addEventListener("pointerout",e=>{if(e.target.closest?.("button,[data-help]")&&!e.target.closest("button,[data-help]").contains(e.relatedTarget))close()});
 document.addEventListener("focusout",close);document.addEventListener("click",e=>{const b=e.target.closest?.(".info-button");if(b)show(b,b.dataset.help);else close()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&tip){close();e.preventDefault()}});
 window.addEventListener("resize",close);document.addEventListener("scroll",close,true);
 new MutationObserver(records=>{for(const m of records)for(const n of m.addedNodes)if(n.nodeType===1)explainFields(n);if(anchor&&!anchor.isConnected)close()}).observe(document.body,{childList:true,subtree:true});
 explainFields(document.body)
}
document.addEventListener("DOMContentLoaded",installHelp);
