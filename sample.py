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
            rev("l7","lamp","bl","v007","Main","","Original handle profile.","lantern-narrow"),
            rev("l71","lamp","bl","v007.1","Handle study","l7","Test the narrow loop.","lantern-narrow"),
            rev("l72","lamp","bl","v007.2","Handle study","l71","Wider handle for a gloved hand.","lantern-wide"),
            rev("l8","lamp","bl","v008","Main","l7","Keep the original silhouette as an alternate.","lantern-narrow"),
            rev("paint","lamp","sp","v001","Brass wear","l72","Texture pass on the wider mesh.","lantern-wide"),
            rev("sculpt","lamp","zb","v001","Vent sculpt","l72","Sculpt study from the same mesh.","lantern-wide")])
    canopy=dict(id="canopy",name="Canopy Run",sections=[section("assets","World & assets"),section("mechanics","Mechanics","Mechanics & features"),
        section("research","Research & decisions","Research"),section("release","Release desk","Publishing")],
        classes=[dict(id="enemy",name="Enemy NPCs",section="assets",parent="",fields=[dict(id="rig",name="Rig type",type="Text")])],
        records=[record("bird","Canopy sentry","assets","A vigilant jungle parrot. Its amber crest warns players before it calls the patrol.","/art/rig.jpg","enemy"),
            record("patrol","Patrol & detection","mechanics","When a player enters the sentry’s sightline, show the amber cue before the attack.","/art/playtest.jpg",links=[link("bird","Flash the amber cue, then call nearby enemies.")]),
            record("test","Cue readability test","research","Illustrative playtest note: the amber cue was easier to see against the foliage.","/art/sprite.jpg",links=[link("patrol","Reason for choosing amber")]),
            record("teaser","Jungle teaser","release","Recapture the sentry reveal for the vertical cut.","/art/jungle.jpg",links=[link("bird","Featured in the reveal shot"),link("patrol","Show the new warning cue")])],
        tools=[tool("kr","Krita",".kra"),tool("bl","Blender",".blend,.fbx"),tool("as","Aseprite",".aseprite,.ase"),tool("dr","DaVinci Resolve",".drp,.mp4")],
        revisions=[rev("c1","bird","kr","v001","Concept","","Establish the crest silhouette.","concept"),
            rev("c2","bird","bl","v007.2","Flight rig","c1","Wing fold test.","rig"),
            rev("c3","bird","as","v003","Alert icon","","Amber alert study.","sprite")])
    return {"projects":[brine,canopy]}
