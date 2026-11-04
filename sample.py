"""Illustrative projects included on first launch."""

def section(id, name, kind="Collection", fields=()):
    return dict(id=id, name=name, kind=kind, fields=list(fields))


def record(id, name, section, description="", cover="", cls="", links=()):
    return dict(id=id, name=name, section=section, description=description, cover=cover,
                cls=cls, values={}, links=list(links))


def link(target, note):
    return dict(target=target, note=note)


def tool(id, name, extensions):
    return dict(id=id, name=name, extensions=extensions, folders=[])


def rev(id, record, tool, label, branch, parent, note, art):
    return dict(id=id, record=record, tool=tool, label=label, branch=branch, parent=parent,
                note=note, preview="/art/"+art+".jpg", path="", comparisons=[])


def sample_rev(id, record, tool, filename, branch, parent, note, art):
    label = filename.rsplit(".", 1)[0].rsplit("_", 1)[1]
    discipline = {"kr":"2D Sprites","as":"2D Sprites","sp":"Texturing"}.get(tool,"3D Modeling")
    if branch == "Flight rig":
        discipline = "Rigging"
    return dict(rev(id, record, tool, label, branch, parent, note, art),
                discipline=discipline, exampleFilename=filename)


def install_visual_demo(project):
    """Add the guided case to an existing stock project without rewriting its edits."""
    trace = project["id"] == "canopy"
    if not trace and project["id"] != "brine":
        return False
    owner, section_id, class_id = ("ridge-raptor", "assets", "enemy") if trace else ("floodgate", "props", "hardware")
    if any(r["id"] == owner for r in project["records"]):
        return False
    if not any(s["id"] == section_id for s in project["sections"]) or not any(t["id"] == "bl" for t in project["tools"]):
        return False
    cls = next((c["id"] for c in project["classes"] if c["id"] == class_id and c["section"] == section_id), "")
    if trace:
        asset = record(owner, "Ridgeback raptor", section_id,
            "A pack hunter telegraphs its lunge with a bright crest. Which sculpt made it into the ravine playtest?",
            "/art/raptor-crest.jpg", cls)
        versions = [
            sample_rev("raptor-scout", owner, "bl", "raptor_v001.blend", "Scout silhouette", "", "Check that the stalking pose reads against low foliage.", "raptor-scout"),
            sample_rev("raptor-crest", owner, "bl", "raptor_v001.1.blend", "Crest study", "raptor-scout", "Give the pack hunter an amber crest that reads before its lunge.", "raptor-crest"),
            sample_rev("raptor-armor", owner, "bl", "raptor_v001.2.blend", "Armor study", "raptor-scout", "Try a heavier skull and bone plates for the ambush variant.", "raptor-armor")]
    else:
        asset = record(owner, "Tidebreaker floodgate", section_id,
            "The harbor exit seals at high tide. Can players read the locked state from across the dock?",
            "/art/gate-lockdown.jpg", cls)
        versions = [
            sample_rev("gate-blockout", owner, "bl", "floodgate_v001.blend", "Door blockout", "", "Check the doorway width and moving slab before the lockdown pass.", "gate-blockout"),
            sample_rev("gate-lockdown", owner, "bl", "floodgate_v002.blend", "Lockdown pass", "gate-blockout", "Make the locked state readable from the far dock.", "gate-lockdown")]
    if {v["id"] for v in project["revisions"]}.intersection(v["id"] for v in versions):
        return False
    if trace:
        bird = next((r for r in project["records"] if r["id"] == "bird"), None)
        if bird and bird["cls"] == "enemy" and bird["section"] == "assets" and bird["name"] == "Canopy sentry" and not bird.get("values"):
            wildlife = next((c for c in project["classes"] if c["id"] == "canopy-wildlife"), None)
            if wildlife is None:
                wildlife = dict(id="canopy-wildlife", name="Wildlife", section="assets", parent="", fields=[])
                project["classes"].append(wildlife)
            if wildlife["section"] == "assets":
                bird["cls"] = wildlife["id"]
        if any(r["id"] == "patrol" for r in project["records"]):
            asset["links"].append(link("patrol", "Test the crest cue before the pack hunter lunges."))
    project["records"].append(asset)
    project["revisions"].extend(versions)
    return True


def example():
    brine = dict(id="brine", name="Brinefall", sections=[section("props","Props"),section("release","Release desk")],
        classes=[dict(id="hardware",name="Harbor equipment",section="props",parent="",fields=[])],
        records=[
            record("lamp","Harbor lantern","props","A storm lantern carried by the night watch.","/art/lantern-wide.jpg","hardware"),
            record("cleat","Mooring cleat","props","Dock hardware for the harbor set.","/art/cleat.jpg","hardware"),
            record("bell","Tide bell","props","Signals the incoming tide.","/art/bell.jpg","hardware"),
            record("capsule","Harbor key art","release","Use the wide-handled lantern in the foreground.",links=[link("lamp","Foreground prop")])],
        tools=[tool("bl","Blender",".blend,.fbx"),tool("sp","Substance Painter",".spp"),tool("zb","ZBrush",".zpr,.ztl")],
        revisions=[
            sample_rev("l7","lamp","bl","lantern_v001.blend","Main","","Original handle profile.","lantern-narrow"),
            sample_rev("l71","lamp","bl","lantern_v001.1.blend","Handle study","l7","Test the narrow loop.","lantern-narrow"),
            sample_rev("l72","lamp","bl","lantern_v001.2.blend","Handle study","l71","Wider handle for a gloved hand.","lantern-wide"),
            sample_rev("l8","lamp","bl","lantern_v002.blend","Main","l7","Keep the original silhouette as an alternate.","lantern-narrow"),
            sample_rev("paint","lamp","sp","lantern_v001.spp","Brass wear","l72","Texture pass on the wider mesh.","lantern-wide"),
            sample_rev("sculpt","lamp","zb","lantern_v001.zpr","Vent sculpt","l72","Sculpt study from the same mesh.","lantern-wide")])
    canopy=dict(id="canopy",name="Canopy Run",sections=[section("assets","World & assets"),section("mechanics","Mechanics","Mechanics & features"),
        section("research","Research & decisions","Research"),section("release","Release desk","Publishing")],
        classes=[dict(id="enemy",name="Enemy NPCs",section="assets",parent="",fields=[dict(id="rig",name="Rig type",type="Text")])],
        records=[record("bird","Canopy sentry","assets","A vigilant jungle parrot. Its amber crest warns players before it calls the patrol.","/art/rig.jpg","enemy"),
            record("patrol","Patrol & detection","mechanics","When a player enters the sentry’s sightline, show the amber cue before the attack.","/art/playtest.jpg",links=[link("bird","Flash the amber cue, then call nearby enemies.")]),
            record("test","Cue readability test","research","Illustrative playtest note: the amber cue was easier to see against the foliage.","/art/sprite.jpg",links=[link("patrol","Reason for choosing amber")]),
            record("teaser","Jungle teaser","release","Recapture the sentry reveal for the vertical cut.","/art/jungle.jpg",links=[link("bird","Featured in the reveal shot"),link("patrol","Show the new warning cue")])],
        tools=[tool("kr","Krita",".kra"),tool("bl","Blender",".blend,.fbx"),tool("as","Aseprite",".aseprite,.ase"),tool("dr","DaVinci Resolve",".drp,.mp4")],
        revisions=[sample_rev("c1","bird","kr","sentry_v001.kra","Concept","","Establish the crest silhouette.","concept"),
            sample_rev("c2","bird","bl","sentry_rig_v001.blend","Flight rig","c1","Wing fold test.","rig"),
            sample_rev("c3","bird","as","sentry_alert_v001.aseprite","Alert icon","","Amber alert study.","sprite")])
    for project in (brine, canopy):
        install_visual_demo(project)
    return {"projects":[brine,canopy]}


def upgrade_example_names(project, stock):
    old_labels = {"l7":"v007", "l71":"v007.1", "l72":"v007.2", "l8":"v008",
                  "c2":"v007.2", "c3":"v003", "raptor-scout":"v004", "raptor-crest":"v007.1",
                  "raptor-armor":"v007.2", "gate-blockout":"v003", "gate-lockdown":"v008"}
    changed = False
    for v in project["revisions"]:
        original = stock.get((project["id"], v["id"]))
        if (not original or v.get("path") or v.get("exampleFilename")
                or (v["record"], v["tool"]) != (original["record"], original["tool"])
                or v["label"] != old_labels.get(v["id"], original["label"])):
            continue
        v.update(label=original["label"], exampleFilename=original["exampleFilename"])
        if not v.get("discipline"):
            v["discipline"] = original["discipline"]
        changed = True
    return changed
