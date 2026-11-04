"use strict";
function visualReview(out,a,b,saved){
 const review={current:saved?.beforePreview===a.preview&&saved?.afterPreview===b.preview?saved:null};
 const panel=document.createElement("section");panel.className="panel visual-review";out.prepend(panel);
 panel.innerHTML=`<div class="spread"><div><small class="eyebrow">Meta vision</small><h2>Visual change markers</h2></div><button type="button" class="primary ai-action" data-highlight>Highlight changes</button></div><p class="sub">Inspect the two previews and point to what changed.</p><div data-findings aria-live="polite"></div><label class="marker-toggle" hidden><input type="checkbox" checked> Show markers on both previews</label>`;
 const button=panel.querySelector("[data-highlight]"),findings=panel.querySelector("[data-findings]");
 const toggle=panel.querySelector(".marker-toggle"),visibility=toggle.querySelector("input");let active=0;visibility.onchange=paint;
 function paint(){
   for(const container of out.querySelectorAll(".visual-preview")){
     container.querySelector("svg")?.remove();
     const img=container.querySelector("img"),box=review.current?.changes[active]?.[container.dataset.side];
     if(!img||!box||!img.naturalWidth||!visibility.checked)continue;
     const svg=document.createElementNS("http://www.w3.org/2000/svg","svg"),rect=document.createElementNS(svg.namespaceURI,"rect");
     const w=img.naturalWidth,h=img.naturalHeight;
     svg.setAttribute("viewBox",`0 0 ${w} ${h}`);svg.setAttribute("aria-hidden","true");
     for(const [key,value] of Object.entries({x:box[0]*w/1000,y:box[1]*h/1000,width:(box[2]-box[0])*w/1000,height:(box[3]-box[1])*h/1000}))rect.setAttribute(key,value);
     svg.append(rect);container.append(svg)
   }
   findings.querySelectorAll("[data-marker]").forEach((b,i)=>b.setAttribute("aria-pressed",String(i===active)))
 }
 function draw(){
   const v=review.current;toggle.hidden=!v?.changes.length;
   if(!v){findings.replaceChildren();return}
   findings.innerHTML=`<p>${esc(v.summary)}</p><div class="marker-list">${v.changes.map((c,i)=>`<button type="button" data-marker="${i}"><strong>${i+1} · ${esc(c.part)}</strong> ${esc(c.detail)}</button>`).join("")}</div>`;
   for(const b of findings.querySelectorAll("[data-marker]"))b.onclick=b.onpointerenter=b.onfocus=()=>{active=Number(b.dataset.marker);paint()};
   paint()
 }
 for(const img of out.querySelectorAll(".visual-preview img"))img.addEventListener("load",paint);
 draw();
 if(!a.preview||!b.preview){button.disabled=true;button.title="Attach a screenshot to each revision first."}
 button.onclick=async()=>{
   if(!hasKey){keyForm();return}
   button.disabled=true;button.textContent="Finding changes…";findings.textContent="Muse Spark is inspecting both screenshots.";panel.setAttribute("aria-busy","true");
   try{
     const v=await post("ai",{project:project().id,mode:"highlight",before:a.id,after:b.id});
     if(!panel.isConnected)return;
     if(v.beforePreview!==a.preview||v.afterPreview!==b.preview)throw Error("A preview changed. Reopen Compare to analyze the latest images.");
     review.current=v;active=0;draw();
     if($("#diff")&&!$("#diff").value.trim())$("#diff").value=[v.summary,...v.changes.map(c=>c.part+" — "+c.detail)].join("\n");
     toast("Review the markers, then save the comparison.")
   }catch(err){if(panel.isConnected){draw();const msg=document.createElement("p");msg.className="error";msg.textContent=err.message;findings.append(msg)}}
   finally{button.disabled=false;button.textContent="Highlight changes";panel.setAttribute("aria-busy","false")}
 };
 return review
}

function traceScreenshot(r,revs,useExample=false){
 if(!revs.length){
   revisionForm(null,{record:r.id});
   $("#fields").insertAdjacentHTML("afterbegin",`<p>To trace a screenshot to ${esc(r.name)}, choose its source file and attach a preview of that version. Then open Screenshot trace again.</p>`);
   return
 }
 let candidates=orderedRevisions(revs.filter(v=>v.preview));
 const example=project().id==="canopy"&&r.id==="bird";
 const choices=checked=>candidates.map(v=>`<label class="trace-candidate"><input type="checkbox" value="${esc(v.id)}" ${checked.includes(v.id)?"checked":""}>${image(v.preview,"candidate-thumb","")}<span>${toolIcon(toolName(v.tool))} ${esc(fileName(v)||revisionLabel(v))}<small>${esc(v.path||v.branch)}</small></span></label>`).join("");
 const missingOptions=()=>orderedRevisions(revs.filter(v=>!v.preview)).map(v=>opt(v.id,v.path||revisionLabel(v),"")).join("");
 const missing=missingOptions();
 modal(traceLabel,`<div id="tracePane"><small class="eyebrow">Meta vision · ${esc(r.name)}</small>
 <div class="trace-workspace">
   <section class="trace-source"><h3>1. Pick the subject</h3><p>Paste your engine screenshot. Click the asset for a SAM 3.1 crop, or drag a box around it.</p>
   <details class="trace-input" open><summary>Choose screenshot</summary>${pictureField("traceShot","")}${example?'<button type="button" data-sample>Use example playtest frame</button>':""}</details>
   <div class="trace-crop" hidden><canvas tabindex="0" aria-label="Screenshot. Drag to crop to the asset."></canvas><div class="trace-box" hidden></div></div>
   <div class="trace-controls"><button type="button" data-full>Use full frame</button><small data-size></small></div></section>
   <section class="trace-revisions"><h3>2. Find the revision</h3><p>Muse Spark checks the region against the previews you choose.</p>
   <details class="trace-choices" open><summary>Candidate revisions <span data-count></span></summary><div data-candidates>${choices(candidates.slice(-8).map(v=>v.id))}</div></details>
   ${missing?`<details class="trace-reference" ${candidates.length?"":"open"}><summary>Add a file preview</summary><p>Choose a revision and attach a screenshot of that file open in your editor. Muse Spark uses this as its reference.</p>${select("traceRevision","Source revision",missing)}${pictureField("traceReference")}<button type="button" data-save-reference>Save file preview</button><small data-reference-status role="status"></small></details>`:""}
   ${hasKey?"":`<details class="trace-key"><summary>${metaLensMark()} Connect Meta AI</summary><p>Connect a key to crop this subject and match it against the checked revisions.</p><label>Meta Model API key<input type="password" data-key autocomplete="off" spellcheck="false"></label><button type="button" data-connect>Connect for this session</button></details>`}<button type="button" class="primary ai-action" data-trace>Find matching revisions</button><div data-trace-results aria-live="polite"></div></section>
 </div><small class="trace-disclosure">Clicking sends the frame and point to Meta. Matching sends only the selected region and checked previews. Filenames and notes stay on your PC.</small></div>`,()=>{},"Done");
 const pane=$("#tracePane"),field=$("#traceShot"),wrap=pane.querySelector(".trace-crop"),canvas=wrap.querySelector("canvas"),outline=wrap.querySelector(".trace-box"),results=pane.querySelector("[data-trace-results]"),run=pane.querySelector("[data-trace]"),size=pane.querySelector("[data-size]");
 const keyBox=pane.querySelector(".trace-key");
 function requestKey(){if(keyBox){keyBox.open=true;keyBox.querySelector("input").focus()}results.textContent="Connect a Meta Model API key for this session, then try again."}
 if(keyBox){
   const input=keyBox.querySelector("input"),connect=keyBox.querySelector("button");
   connect.onclick=async()=>{if(!input.value.trim()){input.focus();return}connect.disabled=true;
     try{await setSessionKey(input.value.trim());input.value="";keyBox.hidden=true;results.textContent="Key configured. Click a subject or find matching revisions."}
     catch(err){results.textContent=err.message}finally{connect.disabled=false}
   };
   input.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();connect.click()}}
 }
 const checks=()=>[...pane.querySelectorAll(".trace-candidate input:checked")].map(el=>el.value);
 const full=pane.querySelector("[data-full]");let crop=null,anchor=null,previousCrop=null,version=0,ready=false,pending=false;
 function sync(){
   const n=checks().length;
   pane.querySelector("[data-count]").textContent=`${n} of ${candidates.length}`;
   full.disabled=!crop;run.disabled=!ready||!n||n>8||pending;
   if(n>8)size.textContent="Choose up to eight candidate previews.";
   else size.textContent=crop?"Comparing the outlined region.":ready?"Comparing the full screenshot.":"";
 }
 function invalidate(){version++;pending=false;results.replaceChildren();run.textContent="Find matching revisions";sync()}
 const saveReference=pane.querySelector("[data-save-reference]");
 if(saveReference)saveReference.onclick=async()=>{
   const key=val("traceRevision"),input=$("#traceReference"),file=input.files[0],status=pane.querySelector("[data-reference-status]");
   if(!file){status.textContent=" Choose or paste a preview of the selected revision first.";input.focus();return}
   saveReference.disabled=true;
   try{
     const path=await uploadPreview(file);
     if(!dialog.open||!pane.isConnected)return;
     await change(p=>{
       const v=find(p.revisions,key);
       if(!v||v.record!==r.id||v.preview)throw Error("This revision changed. Reopen screenshot trace to see its current preview.");
       v.preview=path
     });
     if(!dialog.open||!pane.isConnected)return;
     const checked=checks();
     if(checked.length<8)checked.push(key);
     revs=project().revisions.filter(v=>v.record===r.id);candidates=orderedRevisions(revs.filter(v=>v.preview));
     pane.querySelector("[data-candidates]").innerHTML=choices(checked);
     $("#traceRevision").innerHTML=missingOptions();
     input.value="";input.closest(".image-field").querySelector(".paste-status").textContent="";
     const details=saveReference.closest("details");details.open=false;details.hidden=!$("#traceRevision").options.length;
     invalidate();render();toast("File preview saved.")
   }catch(err){status.textContent=" "+err.message}finally{saveReference.disabled=false}
 };
 pane.querySelector(".trace-choices").onchange=invalidate;
 function drawBox(){
   outline.hidden=!crop;
   if(crop)Object.assign(outline.style,{left:100*crop.x/canvas.width+"%",top:100*crop.y/canvas.height+"%",width:100*crop.w/canvas.width+"%",height:100*crop.h/canvas.height+"%"});
   sync()
 }
 full.onclick=()=>{crop=null;invalidate();drawBox()};
 field.onchange=async()=>{
   ready=false;crop=null;anchor=null;wrap.hidden=true;invalidate();drawBox();
   const file=field.files[0];if(!file)return;
   try{
     const bmp=await createImageBitmap(file);
     try{
       if(!pane.isConnected||field.files[0]!==file)return;
       const scale=Math.min(1,1280/Math.max(bmp.width,bmp.height));
       canvas.width=Math.max(1,Math.round(bmp.width*scale));canvas.height=Math.max(1,Math.round(bmp.height*scale));
       const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bmp,0,0,canvas.width,canvas.height);
       wrap.style.width=Math.min(canvas.width,385*canvas.width/canvas.height)+"px";ready=true;wrap.hidden=false;
       const picker=pane.querySelector(".trace-input");picker.open=false;picker.querySelector("summary").textContent="Replace screenshot";sync()
     }finally{bmp.close()}
   }catch(err){if(field.files[0]===file)results.textContent="The screenshot could not be read. Try a PNG or JPEG."}
 };
 const sampleButton=pane.querySelector("[data-sample]");if(sampleButton)sampleButton.onclick=async()=>{try{const res=await fetch("/art/playtest.jpg");if(!res.ok)throw Error("Could not load the example frame.");const file=new File([await res.blob()],"Canopy Run · Build 19.jpg",{type:"image/jpeg"});await assignScreenshot(field.closest(".image-field"),file)}catch(err){results.textContent=err.message}};
 function at(e){const b=canvas.getBoundingClientRect();return {x:Math.round(Math.max(0,Math.min(1,(e.clientX-b.left)/b.width))*canvas.width),y:Math.round(Math.max(0,Math.min(1,(e.clientY-b.top)/b.height))*canvas.height)}}
 canvas.onpointerdown=e=>{if(e.button!==0||!e.isPrimary)return;previousCrop=crop;anchor=at(e);canvas.setPointerCapture(e.pointerId);invalidate();e.preventDefault()};
 canvas.onpointermove=e=>{if(!anchor)return;const pt=at(e);crop={x:Math.min(anchor.x,pt.x),y:Math.min(anchor.y,pt.y),w:Math.abs(anchor.x-pt.x),h:Math.abs(anchor.y-pt.y)};drawBox()};
 canvas.onpointercancel=()=>{anchor=null;crop=previousCrop;drawBox()};
 canvas.onpointerup=async e=>{
   if(!anchor)return;const p=at(e),clicked=Math.hypot(p.x-anchor.x,p.y-anchor.y)<5;anchor=null;
   if(!clicked){if(crop&&(crop.w<8||crop.h<8))crop=null;drawBox();return}
   crop=previousCrop;drawBox();
   if(!hasKey){requestKey();return}
   const stamp=++version;pending=true;sync();results.textContent="SAM 3.1 is locating the clicked asset…";
   try{
     const result=await post("ai",{mode:"locate",project:project().id,jpeg:canvas.toDataURL("image/jpeg",.88).split(",")[1],width:canvas.width,height:canvas.height,x:Math.min(canvas.width-1,p.x),y:Math.min(canvas.height-1,p.y)});
     if(stamp!==version||!pane.isConnected||!dialog.open)return;
     if(result.box){const [x,y,w,h]=result.box;crop={x,y,w,h};results.textContent="SAM crop ready. Find matching revisions to compare this region."}
     else{crop=null;results.textContent="No subject found at that point. Drag a crop or click another part."}
     drawBox()
   }catch(err){if(stamp===version&&pane.isConnected)results.textContent=err.message}
   finally{if(stamp===version){pending=false;sync()}}
 };
 sync();if(useExample)sampleButton?.click();
 run.onclick=async()=>{
   if(!hasKey){requestKey();return}
   if(!ready||pending)return;
   if(anchor||(crop&&(!crop.w||!crop.h)))return;
   const roi=crop||{x:0,y:0,w:canvas.width,h:canvas.height},sample=document.createElement("canvas");
   sample.width=roi.w;sample.height=roi.h;sample.getContext("2d").drawImage(canvas,roi.x,roi.y,roi.w,roi.h,0,0,roi.w,roi.h);
   const stamp=++version;pending=true;sync();run.textContent="Comparing previews…";results.textContent="Muse Spark is comparing shapes and surface details. Filenames and notes stay local.";
   try{
     const jpeg=sample.toDataURL("image/jpeg",.88).split(",")[1],chosen=checks();
     const res=await post("ai",{project:project().id,record:r.id,mode:"trace",revisions:chosen,jpeg});
     if(stamp!==version||!pane.isConnected||!dialog.open)return;
     const titles={likely:"Likely visual match",ambiguous:"Several versions could match",no_match:"No supported match"};
     results.innerHTML=`<h3>${esc(titles[res.status])}</h3><p>${esc(res.summary)}</p>`;
     for(const match of res.matches){
       const row=document.createElement("section");row.className="trace-result";
       const files=match.revisions.map(key=>find(revs,key)).filter(Boolean);
       row.innerHTML=`${files[0]?image(files[0].preview,"trace-thumb","Candidate preview"):""}<div><p>${esc(match.evidence)}</p>${files.length>1?"<small>These revisions share the same screenshot.</small>":""}</div>`;
       for(const v of files){
         const open=document.createElement("button");open.type="button";open.textContent="Show in graph · "+(fileName(v)||revisionLabel(v));open.title=v.path;
         open.onclick=()=>{const live=find(project().revisions,v.id);if(!live||live.record!==r.id||live.preview!==v.preview){results.textContent="This revision changed. Reopen Trace screenshot to compare the current previews.";return}dialog.close();openRecord(r.id,"History",{revision:v.id})};
         row.lastElementChild.append(open)
       }
       results.append(row)
     }
     const keep=document.createElement("button"),sourceId=id(),projectId=project().id;
     keep.type="button";keep.textContent="Save to Sources & decisions";results.append(keep);
     const label=v=>fileName(v)||revisionLabel(v);
     const source={id:sourceId,kind:"Playtest",name:"Visual trace · "+(field.files[0]?.name||r.name),url:"",note:titles[res.status]+" — "+res.summary,
       excerpt:["Muse Spark compared the screenshot region with "+chosen.length+" revision previews.",...res.matches.map(m=>m.revisions.map(k=>label(find(revs,k))).join(" / ")+" — "+m.evidence)].join("\n"),
       traceRevisions:res.matches.flatMap(m=>m.revisions),traceModel:res.model};
     keep.onclick=async()=>{keep.disabled=true;
       try{
         source.traceImage??=(await post("preview",{jpeg})).preview;
         if(stamp!==version||!dialog.open||!pane.isConnected||project().id!==projectId)return;
         lastCommand="Save screenshot trace";
         await change(p=>{const asset=find(p.records,r.id);asset.sources??=[];if(!find(asset.sources,source.id))asset.sources.push(source)});
         keep.textContent="Saved in Sources & decisions";toast("Saved the screenshot crop and visual evidence.")
       }catch(err){keep.disabled=false;toast(err.message)}
     };
     results.querySelector("h3")?.scrollIntoView({block:"nearest"});
   }catch(err){if(stamp===version&&pane.isConnected)results.textContent=err.message}
   finally{if(stamp===version){pending=false;run.textContent="Find matching revisions";sync()}}
 }
}
