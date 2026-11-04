"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const {spawn} = require("node:child_process");
const {once} = require("node:events");
const {setTimeout: delay} = require("node:timers/promises");

async function until(check, description) {
  const end = Date.now() + 15000;
  do {
    const result = await check();
    if (result) return result;
    await delay(60);
  } while (Date.now() < end);
  throw Error("Timed out waiting for " + description);
}

async function devtools(url) {
  const socket = new WebSocket(url);
  await once(socket, "open");
  const pending = new Map();
  let sequence = 0;
  socket.onmessage = e => {
    const msg = JSON.parse(e.data), reply = pending.get(msg.id);
    if (reply) {pending.delete(msg.id); reply(msg)}
  };
  function send(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending.set(id, msg => msg.error ? reject(Error(msg.error.message)) : resolve(msg.result));
      socket.send(JSON.stringify({id, method, params}));
    });
  }
  async function evaluate(expression) {
    const answer = await send("Runtime.evaluate", {expression, returnByValue:true, awaitPromise:true});
    if (answer.exceptionDetails) throw Error(answer.exceptionDetails.exception?.description || answer.exceptionDetails.text);
    return answer.result.value;
  }
  return {send, evaluate, socket};
}

test("Graph selection, exact revision comparisons, visual review, screenshot tracing and native-format intake", {timeout:90000}, async t => {
  const browser = process.env.EDGE_PATH || path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe");
  await fs.access(browser);
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "game-devs-best-friend-compare-"));
  const profile = path.join(temp, "edge");
  const serve = [
    "import app, sys",
    "app.DATA = app.Path(sys.argv[1])",
    "app.initialize()",
    "server = app.LocalServer(('127.0.0.1', 0), app.Handler)",
    "print(server.server_port, flush=True)",
    "server.serve_forever()"
  ].join("\n");
  const server = spawn("python", ["-u", "-c", serve, path.join(temp, "library")], {cwd:__dirname, windowsHide:true,env:{...process.env,MODEL_API_KEY:""}});
  let edge, client;
  t.after(async () => {
    try {if (client) await client.send("Browser.close")} finally {
      client?.socket.close();
      if (edge && edge.exitCode === null && edge.signalCode === null) {
        await Promise.race([once(edge, "exit"), delay(1500)]);
        if (edge.exitCode === null) edge.kill();
      }
      server.kill();
      const resolvedTemp = await fs.realpath(temp);
      const resolvedTempRoot = await fs.realpath(os.tmpdir());
      if (path.dirname(resolvedTemp) !== resolvedTempRoot || !path.basename(resolvedTemp).startsWith("game-devs-best-friend-compare-")) throw Error("Unexpected temporary test directory");
      await fs.rm(resolvedTemp, {recursive:true, force:true, maxRetries:8, retryDelay:200});
    }
  });
  const [port] = await once(server.stdout, "data");
  const url = "http://127.0.0.1:" + Number(port.toString().trim());
  const init = await (await fetch(url + "/api/state")).json();
  const addon = await fetch(url + "/addon/game_dev_brain.py");
  assert.equal(addon.status, 200);
  assert.match(await addon.text(),/Game Dev's Best Friend/);
  const p = init.state.projects[0], asset = p.records[0];
  const headers = {"Content-Type":"application/json","X-Brain-Token":init.token};
  async function upload(filename) {
    const jpeg = await fs.readFile(path.join(__dirname,"ui","art",filename), "base64");
    const response = await fetch(url + "/api/preview", {method:"POST", headers, body:JSON.stringify({jpeg})});
    assert.equal(response.status, 200);
    return (await response.json()).preview;
  }
  const startImage = await upload("lantern-narrow.jpg"), finalImage = await upload("lantern-wide.jpg");
  function revision(id, filename, label, preview, note, parent = "", tool = "bl") {
    return {id, path:"D:/test/" + filename, record:asset.id, tool, label, preview, note, parent, branch:"Main", comparisons:[]};
  }
  const demoGate=p.revisions.filter(v=>v.record==="floodgate");
  p.revisions = [
    revision("export-final", "Pen_Final.fbx", "Final", "", "Exported for engine", "export-start"),
    revision("blend-final", "Pen_Final.blend", "Final", finalImage, "Polished the cap", "blend-start"),
    revision("export-start", "Pen_Start.fbx", "Start", "", "First export"),
    revision("blend-start", "Pen_Start.blend", "Start", startImage, "Blocked out the nib"),
    revision("paint", "Pen.spp", "v001", "", "Painted brass", "blend-final", "sp"),
    revision("twin", "alternate/Pen_Final.blend", "Final", "", "Alternate folder")
  ];
  asset.graphPrefs = {format:".blend"};
  const saved = await fetch(url + "/api/save", {method:"POST", headers, body:JSON.stringify(init)});
  assert.equal(saved.status, 200, await saved.text());

  edge = spawn(browser, ["--headless=new","--disable-gpu","--disable-background-networking","--no-first-run","--no-default-browser-check","--window-size=1500,950","--remote-debugging-port=0","--user-data-dir=" + profile, url], {stdio:"ignore",windowsHide:true});
  const portFile = path.join(profile, "DevToolsActivePort");
  const debugPort = await until(async () => (await fs.readFile(portFile, "utf8").catch(() => "")).split(/\s/)[0], "browser debugger");
  const page = await until(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(target => target.url.startsWith(url)), "app tab");
  client = await devtools(page.webSocketDebuggerUrl);
  const ev = client.evaluate;
  await until(() => ev("typeof data !== 'undefined' && !!data"), "app startup");
  await ev(`localStorage.setItem(guideOnLaunch,"off"); openRecord(${JSON.stringify(asset.id)},"History")`);

  async function mouse(selector, button = "left", modifiers = 0) {
    const point = await ev(`(async () => {
      const el=document.querySelector(${JSON.stringify(selector)});
      el.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"});
      // The floating guide repositions on the next frame after scrolling.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const b=el.getBoundingClientRect();
      return {x:b.left+b.width/2,y:b.top+b.height/2};
    })()`);
    for (const type of ["mousePressed","mouseReleased"]) {
      const buttons = type === "mouseReleased" ? 0 : button === "right" ? 2 : 1;
      await client.send("Input.dispatchMouseEvent", {type, button, buttons, modifiers, clickCount:1, ...point});
    }
  }
  const selected = () => ev("[before.value,after.value]");
  const node = name => `.rev-face[title="D:/test/${name}"] strong`;
  const open = (tab, more = {}) => ev(`openRecord(${JSON.stringify(asset.id)},${JSON.stringify(tab)},${JSON.stringify(more)})`);


  async function drag(from,to,button="left",modifiers=0) {
    const buttons=button==="middle"?4:1;
    await client.send("Input.dispatchMouseEvent",{type:"mousePressed",button,buttons,modifiers,clickCount:1,...from});
    await client.send("Input.dispatchMouseEvent",{type:"mouseMoved",button,buttons,modifiers,...to});
    await client.send("Input.dispatchMouseEvent",{type:"mouseReleased",button,buttons:0,modifiers,clickCount:1,...to});
  }
  const keypress=async(key,modifiers=0)=>{for(const type of ["keyDown","keyUp"])await client.send("Input.dispatchKeyEvent",{type,key,modifiers})};
  await mouse('[data-zoom="fit"]');
  const box=await ev(`(() => {const el=document.querySelector('.rev-card'), b=el.getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,h:b.height}})()`);
  await drag({x:box.x-6,y:box.y-6},{x:box.x+box.w/2,y:box.y+box.h/2});
  assert.equal(await ev("locationState.compareSelection.length"),1);
  await keypress("a",2);
  assert.equal(await ev("locationState.compareSelection.length"),3);
  const first=await ev("document.querySelector('.rev-card').getBoundingClientRect().toJSON()");
  await drag({x:first.x+30,y:first.y+30},{x:first.x+60,y:first.y+55});
  await until(()=>ev("!busy && project().revisions.filter(v=>v.canvas).length===3"),"one group move");
  await ev("travelEdit('undo')");
  assert.equal(await ev("project().revisions.filter(v=>v.canvas).length"),0);
  await ev("document.querySelector('.graph-scroll').focus()");
  await keypress("Escape");
  assert.equal(await ev("locationState.compareSelection.length"),0);
  assert.equal(await ev("detectSoftware(project(),'D:/water/river.LIQUIGEN')"),"JangaFX LiquiGen");
  assert.equal(await ev("detectSoftware(project(),'D:/terrain/Level.TERRAIN')"),"Gaea");
  assert.equal(await ev("fileExt('Fx/smoke.v003.BGEO.SC')"),".bgeo.sc");
  assert.equal(await ev("detectSoftware({tools:[]},'D:/exports/tree.fbx')"),"");
  assert.equal(await ev("detectSoftware({tools:[{name:'Maya',folders:['D:/Maya'],extensions:'.fbx'}]},'D:/Maya/export.fbx')"),"Maya");
  await mouse(node("Pen_Start.blend"), "right");
  await ev("[...document.querySelectorAll('.compare-menu button')].find(b=>b.textContent==='Edit revision').click()");
  assert.equal(await ev("dialog.open && $('#dialogTitle').textContent"), "Edit revision");
  await mouse("#cancel");
  await mouse(node("Pen_Start.blend"), "left", 2);
  await mouse(node("Pen_Start.blend"), "left", 2);
  assert.equal(await ev("document.querySelectorAll('[data-compare-side]').length"), 0);
  await mouse(node("Pen_Final.blend"), "left", 2);
  await mouse(node("Pen_Start.blend"), "left", 2);
  assert.deepEqual(await ev("locationState.compareSelection"), ["blend-final","blend-start"]);
  assert.equal(await ev("document.querySelector('.compare-picked').hidden"),false);
  await mouse(".compare-picked");
  assert.deepEqual(await selected(), ["blend-final","blend-start"]);
  await open("History");
  await mouse(node("Pen_Final.blend"), "left", 2);
  await mouse(node("Pen_Start.blend"), "left", 2);
  await mouse(node("Pen_Start.blend"), "right");
  assert.equal(await ev("document.querySelector('.compare-menu:popover-open button').textContent"), "Compare revisions");
  await mouse(".compare-menu button");
  const pair = ["blend-final","blend-start"];
  assert.deepEqual(await selected(), pair);
  await until(() => ev("[...document.querySelectorAll('img.comparepic')].filter(img=>img.naturalWidth>0).length===2"), "both saved images");
  assert.deepEqual(await ev("[...document.querySelectorAll('.compare-pane')].map(p=>[p.querySelector('img.comparepic').getAttribute('src'),p.querySelector('.text').textContent])"),
    [[finalImage,"Polished the cap"],[startImage,"Blocked out the nib"]]);
  const [left, right] = await ev("[...document.querySelectorAll('.compare-pane')].map(p=>p.getBoundingClientRect().toJSON())");
  assert.equal(left.top, right.top);
  assert.ok(left.right <= right.left);
  await client.send("Page.reload");
  await until(() => ev("!!document.querySelector('#after')"), "restored comparison");
  assert.deepEqual(await selected(), pair);

  await open("Compare");
  assert.deepEqual(await selected(), ["blend-start","blend-final"]);
  await open("Compare", {before:"export-final", after:"paint"});
  assert.deepEqual(await selected(), ["export-final","paint"]);
  assert.deepEqual(await ev("[...document.querySelectorAll('.compare-pane .text')].map(x=>x.textContent)"), ["Exported for engine","Painted brass"]);
  assert.match(await ev("document.querySelector('.compare-pane .placeholder').textContent"), /Pen_Final\.fbx/);
  await open("Compare", {revision:"paint"});
  assert.deepEqual(await selected(), ["blend-final","paint"]);
  await ev("$('#before').value='twin';$('#before').dispatchEvent(new Event('change'))");
  assert.equal(await ev("document.querySelector('.compare-pane .text').textContent"), "Alternate folder");
  assert.match(await ev("before.selectedOptions[0].textContent"), /alternate\/Pen_Final\.blend/);
  await open("Compare", {before:"no-longer-here", after:"paint"});
  assert.deepEqual(await selected(), ["","paint"]);
  assert.match(await ev("$('#content').textContent"), /no longer in this asset/);
  await open("Compare", {before:"blend-final", after:"paint"});
  const noteTops = await ev("[...document.querySelectorAll('.compare-pane h3')].map(h=>h.getBoundingClientRect().top)");
  assert.equal(noteTops[0], noteTops[1]);
  await ev("find(project().revisions,'blend-final').preview='/media/'+ '0'.repeat(32);render()");
  await until(() => ev("document.querySelector('.compare-pane .placeholder')?.textContent.includes('load the saved preview')"), "missing image message");
  assert.deepEqual(await selected(), ["blend-final","paint"]);
  assert.equal(await ev("document.querySelector('.compare-pane .text').textContent"), "Polished the cap");

  // Only this temporary library uses controlled model replies. Backend tests check the actual API payloads.
  await client.send("Page.reload");
  await until(()=>ev("!!document.querySelector('#after')"),"saved workspace");
  await open("Compare",{before:"blend-start",after:"blend-final"});
  await ev(`hasKey=true;const realPost=post;post=async(route,body)=>{
    if(route!=="ai")return realPost(route,body);
    if(body.mode==="highlight")return {model:"muse-spark-1.3",summary:"The cap changed.",changes:[{part:"Cap",detail:"Wider cap",before:[50,80,350,700],after:[60,90,400,750]}],beforePreview:find(project().revisions,body.before).preview,afterPreview:find(project().revisions,body.after).preview};
    if(body.mode==="locate")return {box:[10,10,100,100],model:"sam-3.1"};
    if(body.mode==="trace")return {status:"likely",summary:"A visible match.",matches:[{revisions:["blend-final"],evidence:"Same cap."}]};
    throw Error("Unexpected model action")
  }`);
  await mouse("[data-highlight]");
  await until(()=>ev("document.querySelectorAll('.visual-preview rect').length===2"),"paired visual overlays");
  assert.match(await ev("$('#diff').value"),/Wider cap/);
  await ev("[...document.querySelectorAll('button')].find(b=>b.textContent==='Save comparison').click()");
  await until(()=>ev("!!find(project().revisions,'blend-final').comparisons[0]?.visual"),"saved visual findings");
  await open("History");
  await ev("[...document.querySelectorAll('button')].find(b=>b.textContent==='Trace screenshot to exact project file').click()");
  await ev(`(async()=>{const file=new File([await (await fetch('/art/lantern-wide.jpg')).blob()],'engine.jpg',{type:'image/jpeg'});await assignScreenshot($('#tracePane [data-image-target]'),file)})()`);
  await until(()=>ev("!document.querySelector('.trace-crop').hidden"),"pasteable trace screenshot");
  await mouse(".trace-crop canvas");
  await until(()=>ev("!document.querySelector('.trace-box').hidden"),"SAM crop");
  await mouse("[data-trace]");
  await until(()=>ev("!!document.querySelector('.trace-result button')"),"visual trace evidence");
  await ev("[...document.querySelectorAll('#tracePane button')].find(b=>b.textContent==='Save to Sources & decisions').click()");
  await until(()=>ev("!!record().sources?.find(s=>s.traceImage)"),"saved screenshot evidence");
  await mouse(".trace-result button");
  assert.equal(await ev("locationState.revision"),"blend-final");
  await open("Overview");
  await mouse(".saved-trace summary");
  await until(()=>ev("document.querySelector('img.saved-trace-pic')?.naturalWidth>0"),"stored region");
  await mouse(".saved-trace button");
  assert.equal(await ev("locationState.revision"),"blend-final");
  await open("Compare",{before:"blend-start",after:"blend-final"});
  await until(()=>ev("document.querySelectorAll('.visual-preview rect').length===2"),"restored saved evidence");

  await open("History");
  await ev("document.querySelector('.graph-scroll').focus()");
  await keypress("a",2);
  await mouse(node("Pen_Start.blend"),"right");
  assert.equal(await ev("document.querySelector('.compare-menu small').textContent"),"3 revisions selected");
  await ev("[...document.querySelectorAll('.compare-menu button')].find(b=>b.textContent.startsWith('Remove selected')).click()");
  assert.match(await ev("$('#fields').textContent"),/Remove 3 revisions and 1 saved comparison/);
  await mouse("#cancel");
  assert.equal(await ev("project().revisions.length"),6);
  await ev("document.querySelector('.graph-scroll').focus()");
  await keypress("Delete");
  await mouse("#submit");
  await until(()=>ev("!busy && !dialog.open && project().revisions.length===3"),"group removal");
  assert.equal(await ev("find(project().revisions,'paint').parent"),"");
  await ev("travelEdit('undo')");
  assert.equal(await ev("find(project().revisions,'paint').parent"),"blend-final");
  assert.equal(await ev("find(project().revisions,'blend-final').comparisons.length"),1);

  await ev(`for(let i=0;i<8;i++)document.querySelector('[data-zoom="+"]').click();document.querySelector('.graph-scroll').scrollTo(0,0)`);
  const canvas=await ev("document.querySelector('.graph-scroll').getBoundingClientRect().toJSON()");
  const nearEdge={x:canvas.right-18,y:canvas.top+100};
  await client.send("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",buttons:1,clickCount:1,x:canvas.x+5,y:canvas.y+5});
  await client.send("Input.dispatchMouseEvent",{type:"mouseMoved",button:"left",buttons:1,...nearEdge});
  await until(()=>ev("document.querySelector('.graph-scroll').scrollLeft>20"),"edge scrolling during marquee");
  await keypress("Escape");
  await client.send("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",buttons:0,clickCount:1,...nearEdge});
  assert.equal(await ev("document.querySelector('.graph-marquee').hidden"),true);

  await ev("revisionForm(null,{record:record().id});$('#path').value='D:/terrain/Cliffs_v004.TERRAIN';$('#path').dispatchEvent(new Event('change'))");
  assert.deepEqual(await ev("[$('#tool').selectedOptions[0].textContent,val('discipline'),val('label')]"),["Gaea","Terrain & foliage","v004"]);
  await mouse("#submit");
  await until(()=>ev("!busy && !dialog.open && project().revisions.some(v=>v.path.endsWith('.TERRAIN'))"),"native project file registered");
  assert.equal(await ev("toolName(project().revisions.find(v=>v.path.endsWith('.TERRAIN')).tool)"),"Gaea");

  await client.send("Page.navigate",{url:url+"/?demo=trace"});
  await until(()=>ev("!!document.querySelector('.lab-coach.coach-intro')"),"trace introduction");
  assert.equal(await ev("document.querySelector('.coach-count').textContent"),"Progress 1/5");
  assert.match(await ev("document.querySelector('.lab-coach p').textContent"),/most recent changes/);
  await mouse(".coach-next");
  await until(()=>ev("document.querySelector('.tour-target')?.matches('.vision-launch')"),"trace graph guide");
  assert.equal(await ev("document.querySelector('.coach-count').textContent"),"Progress 2/5");
  await mouse(".tour-target");
  await until(()=>ev("document.querySelector('.trace-crop')?.hidden===false"),"example deep link");
  assert.equal(await ev("record().id"),"ridge-raptor");
  assert.equal(await ev("document.querySelector('.coach-count').textContent"),"Progress 3/5");
  assert.equal(await ev("location.search"),"");
  await mouse("[data-trace]");
  assert.equal(await ev("document.querySelector('.trace-key').open"),true);
  assert.equal(await ev("document.activeElement.matches('[data-key]')"),true);
  await ev("document.querySelector('[data-key]').value='isolated-test-session-key';document.querySelector('[data-connect]').click()");
  await until(()=>ev("hasKey && document.querySelector('.trace-key').hidden"),"inline session connection");
  assert.equal(await ev("document.querySelector('.trace-crop').hidden"),false);
  await ev(`const demoPost=post;post=async(route,body)=>route!=="ai"?demoPost(route,body):body.mode==="trace"?{status:"ambiguous",summary:"Two crests are plausible",matches:[],model:"test"}:{changes:[],summary:"No confident markers",beforePreview:find(project().revisions,body.before).preview,afterPreview:find(project().revisions,body.after).preview};`);
  await mouse("[data-full]");
  assert.equal(await ev("document.querySelector('.coach-count').textContent"),"Progress 4/5");
  await mouse("[data-trace]");
  await until(()=>ev("document.querySelector('.tour-target')?.matches('[data-keep-trace]')"),"trace save guide");
  await mouse("[data-keep-trace]");
  await until(()=>ev("document.querySelector('.coach-count')?.textContent.includes('Complete')"),"trace saved");
  await mouse(".coach-close");
  assert.equal(await ev("!!document.querySelector('.lab-coach')"),false);
  await mouse("#submit");
  await ev(`locationState.project='brine';change(p=>p.revisions.push(...${JSON.stringify(demoGate)})).then(()=>go('home'))`);
  assert.equal(await ev("!!document.querySelector('.lab-feature,.lab-coach,.project-trace[open]')"),false);
  await ev("localStorage.setItem(intakeSlot,JSON.stringify({...newIntake(),step:2,name:'Work in progress',project:'brine',stages:[3]}))");
  await mouse("#rail .home-brand");
  await until(()=>ev("!!document.querySelector('#gameName')"),"logo opens the first screen during an existing setup");
  assert.equal(await ev("JSON.parse(localStorage.getItem(intakeSlot)).step"),2);
  await mouse(".how-link");
  await until(()=>ev("!!document.querySelector('.story-options')"),"help story");
  assert.deepEqual(await ev("[...document.querySelectorAll('.story-options a')].map(a=>a.getAttribute('href'))"),["?demo=branches","?demo=trace","?demo=compare"]);
  assert.equal(await ev("document.querySelector('.story-home').getAttribute('href')"),"?view=welcome");
  assert.match(await ev("document.querySelector('.story-nav .home-brand').textContent"),/Game Dev's Best Friend/);
  await ev("document.querySelector('.inline-scene .story-pair').closest('.story-chapter').scrollIntoView({block:'center'})");
  await until(()=>ev("!!document.querySelector('.scene-layer.current .story-pair')"),"scroll advances the comparison illustration");
  await ev("document.querySelector('.inline-scene .story-trace').closest('.story-chapter').scrollIntoView({block:'center'})");
  await until(()=>ev("document.querySelector('.board-foot span').textContent==='05 / 05' && !!document.querySelector('.scene-layer.current .story-trace')"),"final screenshot trace chapter");
  await mouse('.story-options a[href="?demo=branches"]');
  await until(()=>ev("!!document.querySelector('.branch-choices')"),"branch learning choices");
  assert.equal(await ev("document.querySelectorAll('.branch-choices section').length"),2);
  await mouse(".branch-choices section:first-child button");
  await until(()=>ev("locationState.view==='home' && !!document.querySelector('.lab-coach.coach-intro')"),"branch library introduction");
  await until(()=>ev("document.querySelector('.coach-count')?.textContent==='Progress 1/8'"),"branch introduction");
  await mouse(".coach-next");
  await until(()=>ev("document.querySelector('.coach-count')?.textContent==='Progress 2/8' && !!document.querySelector('.root-class.tour-target')"),"class guidance");
  assert.match(await ev("document.querySelector('.lab-coach p').textContent"),/NPCs/);
  await mouse(".coach-next");
  await until(()=>ev("document.querySelector('.coach-count')?.textContent==='Progress 3/8'"),"open example asset guide");
  await mouse('[data-asset="lamp"]');
  await until(()=>ev("!!document.querySelector('.graph-toolbar')"),"branch editor example");
  assert.equal(await ev("record().id"),"lamp");
  await until(()=>ev("document.querySelector('.coach-count')?.textContent==='Progress 4/8'"),"branch selection guide");
  await mouse(".rev-card.selected .rev-face");
  await until(()=>ev("document.querySelector('.coach-count')?.textContent==='Progress 5/8'"),"branch note guide");
  await ev("document.querySelector('#inlineNote').value='A note from the walkthrough.'");
  await mouse("#inlineNote + button");
  await until(()=>ev("document.querySelector('.coach-count')?.textContent==='Progress 6/8'"),"branch fork guide");
  await until(()=>ev("(()=>{const e=document.querySelector('.fork-from-here'),b=e.getBoundingClientRect();return document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)===e})()"),"fork button visible");
  await mouse(".fork-from-here");
  await until(()=>ev("dialog.open && document.querySelector('.tour-target')?.id==='branch'"),"branch form guide");
  await mouse("#submit");
  await until(()=>ev("!dialog.open && document.querySelector('.coach-count')?.textContent==='Progress 7/8'"),"branch connection guide");
  const connection=await ev(`(() => {const point=el=>{const b=el.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}};return [point(visualTour.target),point(visualTour.extraTarget)]})()`);
  await drag(connection[0],connection[1]);
  await until(()=>ev("document.querySelector('.coach-count')?.textContent==='Progress 8/8'"),"branch arrangement guide");
  const selectedCard=await ev(`(() => {const b=document.querySelector('.rev-card.selected .rev-face').getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}})()`);
  await drag(selectedCard,{x:selectedCard.x+40,y:selectedCard.y+25});
  await until(()=>ev("document.querySelector('.coach-count')?.textContent.includes('Complete')"),"branch walkthrough complete");
  assert.deepEqual(await ev("[...document.querySelectorAll('.coach-finish a')].map(a=>a.getAttribute('href'))"),["?view=welcome&branchTour=own","?view=help#examples"]);
  await mouse(".coach-next");
  await ev("history.back()");
  await until(()=>ev("!!document.querySelector('.story-options')"),"return to examples");
  await mouse('.story-options a[href="?demo=trace"]');
  await until(()=>ev("!!document.querySelector('.lab-coach.coach-intro')"),"screenshot trace introduction");
  await mouse(".coach-next");
  await until(()=>ev("!!document.querySelector('.tour-target.vision-launch')"),"screenshot trace example");
  await ev("history.back()");
  await until(()=>ev("!!document.querySelector('.story-options')"),"revisit examples");
  await mouse('.story-options a[href="?demo=compare"]');
  await until(()=>ev("document.querySelector('.coach-count')?.textContent==='Progress 1/5'"),"comparison introduction");
  await mouse(".coach-next");
  await until(()=>ev("!!document.querySelector('.tour-target.tab-compare')"),"comparison example");
  await ev(`const comparePost=post;post=async(route,body)=>route!=="ai"?comparePost(route,body):{changes:[],summary:"No confident markers",beforePreview:find(project().revisions,body.before).preview,afterPreview:find(project().revisions,body.after).preview}`);
  await mouse(".tab-compare");
  assert.deepEqual(await selected(),["gate-blockout","gate-lockdown"]);
  await ev(`const workingDemoPost=post;post=async(route,body)=>{if(route==="ai"){post=workingDemoPost;throw Error("Try the review again.")}return workingDemoPost(route,body)}`);
  await mouse("[data-highlight]");
  await until(()=>ev("document.querySelector('[data-findings] .error')?.textContent.includes('again')"),"recoverable review failure");
  assert.equal(await ev("document.querySelector('.coach-count').textContent"),"Progress 3/5");
  await mouse("[data-highlight]");
  await until(()=>ev("document.querySelector('.tour-target')?.matches('.see-markers')"),"compare inspection guide");
  await mouse(".see-markers");
  await mouse(".save-comparison");
  await until(()=>ev("document.querySelector('.coach-count')?.textContent.includes('Complete')"),"comparison saved");
  await ev("go('home')");
  assert.equal(await ev("!!document.querySelector('.lab-coach')"),false);
  await ev("openRecord('floodgate')");
  assert.equal(await ev("!!document.querySelector('.lab-coach')"),false);

  await fetch(url+"/api/key",{method:"POST",headers,body:JSON.stringify({key:""})});
  const capturedPath=path.join(temp,"Lantern_v001.blend");
  await fs.writeFile(capturedPath,"fixture");
  const capture=async body=>{
    const res=await fetch(url+"/api/checkpoint",{method:"POST",headers,body:JSON.stringify(body)});
    const value=await res.json();assert.equal(res.status,200,value.error);return value;
  };
  const route=await capture({mode:"route",path:capturedPath});
  const jpeg=await fs.readFile(path.join(__dirname,"ui","art","lantern-wide.jpg"),"base64");
  const captured=await capture({mode:"save",...route.choices[0],path:capturedPath,id:"d".repeat(32),size:[640,480],jpeg});
  await client.send("Page.reload");
  await until(()=>ev("typeof data !== 'undefined' && !!data"),"captured library");
  await ev(`locationState.project=${JSON.stringify(captured.project)}; openRecord(${JSON.stringify(captured.record)},"History",{revision:${JSON.stringify(captured.revision)}})`);
  await until(()=>ev("document.querySelector('.checkpoint-panel')?.textContent.includes('First viewport captured')"),"checkpoint inspector");
  assert.equal(await ev("document.querySelector('#inlineNote').value"),"");
  assert.ok(await ev("document.querySelector('.checkpoint-figure img').naturalWidth>0"));
  const assetCount=await ev("project().records.length");
  const highPolyPath=path.join(temp,"CompletelyDifferentHighPoly.blend");
  await fs.writeFile(highPolyPath,"fixture");
  const highRoute=await capture({mode:"route",path:highPolyPath});
  assert.equal(highRoute.automatic,false);
  const highTarget=highRoute.choices.find(c=>c.project===captured.project && c.source===captured.revision);
  assert.ok(highTarget);
  const high=await capture({mode:"save",...highTarget,branch:"High poly",path:highPolyPath,id:"e".repeat(32),size:[640,480],jpeg});
  assert.equal(high.record,captured.record);
  await ev("refreshCaptureGraph()");
  await until(()=>ev(`!!project().revisions.find(v=>v.id===${JSON.stringify(high.revision)})`),"new high-poly node arrives");
  await ev(`openRecord(${JSON.stringify(high.record)},"History",{revision:${JSON.stringify(high.revision)}})`);
  assert.equal(await ev("project().records.length"),assetCount);
  assert.deepEqual(await ev(`(() => {const v=project().revisions.find(v=>v.id===${JSON.stringify(high.revision)});return [v.parent,v.branch,v.path]})()`),
    [captured.revision,"High poly",highPolyPath]);
  assert.ok(await ev(`!!document.querySelector('[data-revision="${high.revision}"]')`));
  const highCard=`[data-revision="${high.revision}"] .rev-face`;
  await mouse(highCard,"right");
  await ev("[...document.querySelectorAll('.compare-menu button')].find(b=>b.textContent==='Edit node filename').click()");
  await ev("$('#nodeName').value='DeskLamp_v002'");
  await mouse("#submit");
  await until(()=>ev("!dialog.open && document.querySelector('.inspector-head h2')?.textContent==='DeskLamp_v002'"),"renamed node inspector");
  assert.equal(await ev(`document.querySelector('${highCard} strong').textContent`),"DeskLamp_v002");
  await ev(`showQuickNote(document.querySelector('${highCard}'),[find(project().revisions,${JSON.stringify(high.revision)})])`);
  assert.match(await ev("$('#quickNote b').textContent"),/DeskLamp_v002/);
  await ev(`openRecord(${JSON.stringify(high.record)},"Compare",{before:${JSON.stringify(captured.revision)},after:${JSON.stringify(high.revision)}})`);
  assert.match(await ev("$('#after').selectedOptions[0].textContent"),/DeskLamp_v002/);
  await client.send("Page.reload");
  await until(()=>ev("typeof data!=='undefined' && !!data && !!document.querySelector('#after')"),"renamed node after reload");
  assert.match(await ev("$('#after').selectedOptions[0].textContent"),/DeskLamp_v002/);
  assert.equal(await ev(`find(project().revisions,${JSON.stringify(high.revision)}).path`),highPolyPath);
  await ev("travelEdit('undo')");
  assert.equal(await ev(`find(project().revisions,${JSON.stringify(high.revision)}).nodeName||''`),"");

  await ev(`change((p,state)=>state.projects.push({id:"trace-test",name:"Mechs",sections:p.sections,classes:[],records:[],tools:p.tools,revisions:[]}))`);
  await ev("locationState={project:'trace-test',view:'home'};render()");
  const traceButton=".project-trace .vision-launch";
  await mouse(".project-trace summary");
  assert.equal(await ev(`$('${traceButton}').textContent`),"Trace screenshot to exact project file");
  await mouse(traceButton);
  assert.equal(await ev("$('#dialogTitle').textContent"),"Add record");
  await mouse("#cancel");
  await ev(`change(p=>{
    const asset={id:"rig",name:"Patapim",section:p.sections[0].id,cls:"",links:[],values:{}};
    p.records.push(asset,{...asset,id:"prop",name:"Pen"});
    p.revisions.push({id:"rig-v9",record:"rig",tool:p.tools[0].id,path:"D:/test/Patapim_v9.blend",label:"v9",branch:"Rigging",parent:"",preview:"",note:"",comparisons:[]})
  }).then(render)`);
  assert.deepEqual(await ev("[...$('#traceAsset').options].map(o=>o.textContent)"),["Patapim · Add a preview","Pen · Add a file"]);
  await mouse(".project-trace summary");
  await ev("$('#traceAsset').value='prop'");
  await mouse(traceButton);
  assert.equal(await ev("$('#dialogTitle').textContent"),"Track a revision");
  await mouse("#cancel");
  await ev("go('home');document.querySelector('.project-trace').open=true;$('#traceAsset').value='rig'");
  await mouse(traceButton);
  assert.equal(await ev("$('#traceRevision').selectedOptions[0].textContent"),"D:/test/Patapim_v9.blend");
  await ev(`(async()=>{const file=new File([await (await fetch('/art/lantern-wide.jpg')).blob()],'rig.jpg',{type:'image/jpeg'});
    await assignScreenshot($('#traceReference').closest('.image-field'),file);$('#tracePane [data-save-reference]').click()})()`);
  await until(()=>ev("!!$('#tracePane .trace-candidate input:checked')"),"saved first file preview, ready for matching");
  assert.equal(await ev("$('#tracePane .trace-candidate input:checked').value"),"rig-v9");
  await mouse("#cancel");
  await ev("go('home')");
  assert.match(await ev("$('#traceAsset').selectedOptions[0].textContent"),/Patapim · 1 preview/);

  await ev(`change(p=>{
    p.tools.push({id:"effect-tool",name:"Studio FX",extensions:".fx",folders:[]},
      {id:"wiki",name:"Notion",extensions:".md",folders:[]});
    p.disciplines=["VFX & simulation","Terrain & foliage"];
    p.workflow=[{stage:"VFX & simulation",tool:"effect-tool",section:ensureSection(p,"VFX & simulation").id}];
  }).then(()=>projectOptions(project()))`);
  const disciplineChoices=name=>ev(`(()=>{
    const row=[...document.querySelectorAll('.discipline-item')].find(el=>el.querySelector('strong').textContent===${JSON.stringify(name)});
    return [...row.querySelectorAll('.discipline-tools input')].map(el=>[el.value,el.checked])
  })()`);
  const vfx=new Map(await disciplineChoices("VFX & simulation")),terrain=new Map(await disciplineChoices("Terrain & foliage"));
  assert.equal(vfx.get("Studio FX"),true);
  assert.ok(vfx.has("Houdini")&&terrain.has("Houdini"));
  assert.ok(vfx.has("JangaFX EmberGen")&&!terrain.has("JangaFX EmberGen"));
  assert.ok(terrain.has("Gaea")&&!vfx.has("Gaea"));
  assert.ok(!terrain.has("Studio FX")&&!terrain.has("Notion")&&!vfx.has("Notion"));
  assert.ok(new Map(await disciplineChoices("Design")).has("Notion"));
  await mouse("#submit");
  await until(()=>ev("!dialog.open && !busy"),"saved discipline settings");
  await ev("projectOptions(project())");
  assert.equal(new Map(await disciplineChoices("VFX & simulation")).get("Studio FX"),true);

  await mouse("#cancel");
  const clickButton=(scope,label)=>ev(`[...document.querySelectorAll(${JSON.stringify(scope+" button")})].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
  await clickButton("#rail","Manage projects");
  const managed=id=>`[data-project-id="${id}"]`;
  assert.match(await ev(`$(${JSON.stringify(managed("trace-test"))}).textContent`),/2 records · 1 revision/);
  await clickButton(managed("brine"),"Rename");
  await ev("$('#projectName').value='Harbor test'");
  await mouse("#submit");
  await until(()=>ev("!dialog.open && find(data.projects,'brine').name==='Harbor test'"),"rename another project");
  assert.equal(await ev("project().id"),"trace-test");
  const beforeDelete=await ev("JSON.stringify(project())");
  await clickButton(managed("trace-test"),"Delete");
  assert.match(await ev("$('#fields').textContent"),/Mechs/);
  await mouse("#cancel");
  assert.equal(await ev("JSON.stringify(project())"),beforeDelete);
  await clickButton(managed("trace-test"),"Delete");
  await mouse("#submit");
  await until(()=>ev("!dialog.open && !find(data.projects,'trace-test')"),"delete active project");
  assert.equal(await ev("locationState.view"),"projects");
  assert.equal(await ev("$('#projectPicker').value"),await ev("project().id"));
  await mouse(".edit-history button:first-child");
  await until(()=>ev("!!find(data.projects,'trace-test')"),"restore deleted project");
  assert.equal(await ev("JSON.stringify(find(data.projects,'trace-test'))"),beforeDelete);
  await mouse(".edit-history button:last-child");
  await until(()=>ev("!find(data.projects,'trace-test')"),"redo project deletion");
  const current=await ev("project().id");
  const other=await ev("data.projects.find(p=>p.id!==project().id).id");
  await clickButton(managed(other),"Delete");
  await mouse("#submit");
  await until(()=>ev("!dialog.open && data.projects.length===1"),"delete inactive project");
  assert.equal(await ev("project().id"),current);
  assert.ok(await ev("!!document.querySelector('.project-list button:disabled')"));
  assert.equal(await fs.readFile(capturedPath,"utf8"),"fixture");

  await client.send("Page.navigate",{url:url+"/?demo=branches"});
  await until(()=>ev("!!document.querySelector('.branch-choices')"),"branch learning choices for a new project");
  await mouse(".branch-choices section:nth-child(2) a");
  await until(()=>ev("!!document.querySelector('#gameName')"),"new project start");
  await ev("document.querySelector('#gameName').value='Fresh Journey';document.querySelector('#gameChat').requestSubmit()");
  await until(()=>ev("locationState.view==='setup' && intake?.step===1"),"new project disciplines");
  await ev("[...document.querySelectorAll('#intakePanel .bar button')].find(b=>b.textContent.includes('3D modeling & sculpting')).click()");
  await mouse("#intakePanel .actions .primary");
  await until(()=>ev("intake?.step===2"),"new project software");
  await mouse("#intakePanel .actions .primary");
  await until(()=>ev("intake?.step===3"),"new project folders");
  await mouse("#intakePanel .actions .primary");
  await until(()=>ev("intake?.step===4 && !intakeWorking"),"new project asset review");
  await mouse("#intakePanel .actions .primary");
  await until(()=>ev("locationState.view==='home' && visualTour?.kind==='own' && visualTour.stage==='intro'"),"own project introduction");
  assert.match(await ev("document.querySelector('.lab-coach p').textContent"),/Hover over an ⓘ/);
  await mouse(".coach-next");
  await until(()=>ev("visualTour?.stage==='classes' && !!document.querySelector('.root-class.tour-target')"),"own project class guidance");
  await mouse(".root-class");
  await ev("document.querySelector('#name').value='NPCs'");
  await mouse("#submit");
  await until(()=>ev("!dialog.open && project().classes.some(c=>c.name==='NPCs')"),"create a root class");
  await mouse(".class-group .class-actions button:first-child");
  await ev("document.querySelector('#name').value='Wildlife'");
  await mouse("#submit");
  await until(()=>ev("!dialog.open && project().classes.some(c=>c.name==='Wildlife')"),"create a nested class");
  assert.equal(await ev("project().classes.find(c=>c.name==='Wildlife').parent"),await ev("project().classes.find(c=>c.name==='NPCs').id"));
  await mouse(".coach-next");
  await until(()=>ev("visualTour?.stage==='asset' && !!document.querySelector('.add-asset.tour-target')"),"own project asset guidance");
  await mouse(".add-asset");
  await ev("document.querySelector('#name').value='Forest Critter';document.querySelector('#cls').value=project().classes.find(c=>c.name==='Wildlife').id");
  await mouse("#submit");
  await until(()=>ev("!dialog.open && visualTour?.stage==='graph' && !!document.querySelector('.tab-history.tour-target')"),"own asset history guidance");
  assert.equal(await ev("record().cls"),await ev("project().classes.find(c=>c.name==='Wildlife').id"));
  await mouse(".tab-history");
  await until(()=>ev("!!document.querySelector('.graph-title.tour-target')"),"own revision graph guide");
  await ev("document.querySelector('.coach-next').click()");
  assert.equal(await ev("visualTour"),null);

  await clickButton("#rail","Ask this project");
  assert.ok(await ev("!!document.querySelector('#rail button.ai-action.active')"));
  assert.ok(!await ev("document.querySelector('#rail').innerText.includes('Setup guide')"));
  await clickButton("#rail","+ New Project");
  await until(()=>ev("!!document.querySelector('#gameName')"),"homepage from sidebar");
  assert.equal(await ev("document.querySelector('#gameName').placeholder"),"Type your game's name to create a new Project");
  assert.equal(await ev("document.querySelector('#guideOnLaunch')"),null);
  await clickButton(".guide-toolbar","Open Project Library");
  await until(()=>ev("locationState.view==='home' && !!document.querySelector('#projectPicker')"),"open project library");
  await clickButton("#rail","Manage projects");
  await clickButton("main","+ New Project");
  await until(()=>ev("!!document.querySelector('#gameName') && locationState.view==='welcome'"),"homepage from project management");

});
