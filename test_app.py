"""Regression checks for revision integrity, source scanning and the Meta runtime contract."""
import base64
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

import app


class BrainTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        for name, value in (("DATA", Path(self.temp.name)), ("SESSION_KEY", "test-key")):
            replacement = patch.object(app, name, value)
            replacement.start()
            self.addCleanup(replacement.stop)
        app.initialize()
        self.snap = app.snapshot()
        self.p = self.snap["state"]["projects"][0]

    def test_save_conflict_and_invalid_parent(self):
        self.p["records"][0]["description"] = "Artist saved this."
        app.commit(self.snap)
        with self.assertRaises(app.Problem) as conflict:
            app.commit(self.snap)
        self.assertEqual(conflict.exception.status, 409)
        current = app.snapshot()
        current["state"]["projects"][0]["revisions"][0]["parent"] = "l72"
        with self.assertRaises(app.Problem):
            app.commit(current)
        self.assertEqual(app.snapshot()["version"], 2)
        self.assertEqual(app.snapshot()["state"]["projects"][0]["records"][0]["description"], "Artist saved this.")

    def test_insert_source_after_child_in_storage_order(self):
        original=app.by_id(self.p["revisions"],"paint")
        middle=dict(original,id="handoff",parent=original["parent"])
        original["parent"]=middle["id"]
        self.p["revisions"].append(middle)
        saved=app.commit(self.snap)
        self.assertEqual(app.by_id(app.snapshot()["state"]["projects"][0]["revisions"],"paint")["parent"],"handoff")
        middle["parent"]="paint"
        with self.assertRaisesRegex(app.Problem,"loop"):
            app.commit(dict(self.snap,version=saved["version"]))
        self.assertEqual(app.snapshot()["version"],saved["version"])

    def test_drop_matching_uses_project_folders_and_preserves_ambiguity(self):
        import os
        folders=[Path(self.temp.name)/name for name in ("source","exports","unlinked")]
        stamp=1710000000000000000
        for folder in folders:
            folder.mkdir()
            file=folder/"rig_v7.fbx"
            file.write_bytes(b"rig")
            os.utime(file,ns=(stamp,stamp))
        self.p["tools"][0]["folders"]=[str(f) for f in folders[:2]]
        item=dict(name="rig_v7.fbx",size=3,mtime=stamp//1_000_000)
        hits=app.drop_matches(self.p,[item,dict(item,size=4)])
        self.assertEqual(set(hits[0]),{str(f/item["name"]) for f in folders[:2]})
        self.assertEqual(hits[1],[])

    def test_persistent_undo_redo_and_diverging_edit(self):
        original=self.snap["state"]
        edit=json.loads(json.dumps(original))
        edit["projects"][0]["name"]="New name"
        saved=app.commit(dict(state=edit,version=self.snap["version"],label="Rename project"))
        undone=app.travel("undo",saved["version"])
        self.assertEqual(undone["state"],original)
        app.initialize()
        self.assertEqual(app.snapshot()["history"]["redo"],"Rename project")
        with self.assertRaises(app.Problem):
            app.travel("redo",saved["version"])
        redone=app.travel("redo",undone["version"])
        self.assertEqual(redone["state"],edit)
        again=app.travel("undo",redone["version"])
        self.assertIsNone(app.commit(dict(state=edit,version=again["version"]))["history"]["redo"])

    def test_scan(self):
        folder = Path(self.temp.name) / "Models"
        folder.mkdir()
        (folder / "sub").mkdir()
        (folder / "sub" / "Model_v007.2.BLEND").touch()
        (folder / "notes.txt").touch()
        tool = self.p["tools"][0]
        tool["folders"] = [str(folder), str(folder / "missing")]
        result = app.scan(tool)
        self.assertEqual([Path(f).name for f in result["files"]], ["Model_v007.2.BLEND"])
        self.assertEqual(len(result["issues"]), 1)

    def test_folder_formats_distinguish_sources_exports_and_nested_overrides(self):
        folder=Path(self.temp.name)/"Patapim"
        exports=folder/"Export"
        exports.mkdir(parents=True)
        for sub in (folder,exports):
            for suffix in (".blend",".fbx",".blend1"):
                (sub/("PatapimRig_v9_PoseBakeTest"+suffix)).touch()
        tool=dict(extensions=".blend,.fbx",folders=[str(folder),str(exports)],
                  folderFormats={folder.as_posix().lower():[".blend"],exports.as_posix().lower():[".fbx"]})
        result=app.scan(tool)
        self.assertEqual(result["issues"],[])
        self.assertEqual({Path(f) for f in result["files"]},
                         {folder/"PatapimRig_v9_PoseBakeTest.blend",exports/"PatapimRig_v9_PoseBakeTest.fbx"})
        self.assertEqual(len(result["files"]),2)
        del tool["folderFormats"]
        self.assertEqual(len(app.scan(tool)["files"]),4)

    def call(self, mode, reply, **kwargs):
        payload = {"output":[{"type":"message","content":[{"type":"output_text","text":reply}]}]}
        with patch("urllib.request.urlopen", return_value=io.BytesIO(json.dumps(payload).encode())) as transport:
            result = app.ai(self.p, dict(mode=mode, **kwargs))
        req = transport.call_args.args[0]
        self.assertEqual(req.full_url, "https://api.meta.ai/v1/responses")
        self.assertEqual(req.get_header("Authorization"), "Bearer test-key")
        body = json.loads(req.data)
        self.assertEqual(body["model"], "muse-spark-1.3")
        if mode in ("compare","trace","highlight"):
            self.assertEqual(body["reasoning"]["effort"],"low")
            self.assertGreater(body["max_output_tokens"],900)
        if mode in ("trace","highlight"):
            fmt=body["text"]["format"]
            self.assertEqual((fmt["name"],fmt["type"],fmt["strict"]),(mode,"json_schema",True))
        return result, body["input"][0]["content"]

    def test_visual_comparison_uses_both_real_previews_in_order(self):
        result, content = self.call("compare", "Wider handle.", before="l71", after="l72")
        self.assertEqual(result["text"], "Wider handle.")
        for block, name in zip(content[1:], ["lantern-narrow", "lantern-wide"], strict=True):
            self.assertEqual(block["type"], "input_image")
            self.assertEqual(base64.b64decode(block["image_url"].split(",")[1]), app.preview_bytes("/art/"+name+".jpg"))
        with self.assertRaises(app.Problem):
            app.ai(self.p, dict(mode="compare", before="l71", after="l71"))

    def test_incomplete_comparison_is_not_a_draft(self):
        reply={"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"},"output":[]}
        with patch("urllib.request.urlopen",return_value=io.BytesIO(json.dumps(reply).encode())):
            with self.assertRaisesRegex(app.Problem,"token limit"):
                app.ai(self.p,dict(mode="compare",before="l71",after="l72"))

    def test_visual_markers_validate_regions_and_preserve_source_pair(self):
        row=dict(part="Handle",detail="Handle bows outward.",before=[100,50,800,900],after=[60,52,900,902])
        reply=dict(summary="Handle silhouette changed.",changes=[row])
        result,content=self.call("highlight",json.dumps(reply),before="l71",after="l72")
        self.assertEqual(result["changes"],[row])
        self.assertEqual(result["afterPreview"],"/art/lantern-wide.jpg")
        self.assertEqual(len(content),3)
        row["after"]=[-1,0,201,551]
        with self.assertRaises(app.Problem):
            self.call("highlight",json.dumps(reply),before="l71",after="l72")
        with self.assertRaises(app.Problem):
            self.call("highlight",json.dumps(reply),before="l71",after="l71")

    def test_visual_trace_blinds_candidates_and_keeps_duplicate_images_tied(self):
        shot=base64.b64encode(app.preview_bytes("/art/lantern-wide.jpg")).decode()
        args=dict(record="lamp",revisions=["l7","l71","l72"],jpeg=shot)
        response=dict(status="likely",summary="Narrow handle.",matches=[dict(candidate=1,evidence="The loop is narrow.")])
        result,content=self.call("trace",json.dumps(response),**args)
        self.assertEqual(result["status"],"ambiguous")
        self.assertEqual(result["matches"][0]["revisions"],["l7","l71"])
        self.assertEqual(sum(c["type"]=="input_image" for c in content),3)
        prompt=" ".join(c["text"] for c in content if c["type"]=="input_text")
        self.assertNotIn("Harbor lantern",prompt)
        self.assertNotIn("Test the narrow loop",prompt)
        response["matches"][0]["candidate"]=9
        with self.assertRaises(app.Problem):
            self.call("trace",json.dumps(response),**args)
        with self.assertRaises(app.Problem):
            self.call("trace","{}",**dict(args,record="cleat"))
        result,_=self.call("trace",json.dumps(dict(status="no_match",summary="No visible match.",matches=[])),**args)
        self.assertEqual(result["matches"],[])

    def test_sam_click_sends_pixels_and_parses_inclusive_box(self):
        sample=base64.b64encode(app.preview_bytes("/art/lantern-wide.jpg")).decode()
        args=dict(mode="locate",width=800,height=600,x=112,y=220,jpeg=sample)
        def response(text):
            return io.BytesIO(json.dumps({"output":[{"content":[{"type":"output_text","text":text}]}]}).encode())
        with patch("urllib.request.urlopen",return_value=response("<0f>1<|box;x1=110;y1=111;x2=335;y2=410;w=800;h=600|><|mask;x=0;y=0;data=300,226,!sample|>")) as mock:
            result=app.ai(self.p,args)
        request=json.loads(mock.call_args.args[0].data)
        self.assertEqual(request["model"],"sam-3.1")
        self.assertEqual(request["input"][0]["content"][0]["text"],"<0f>1<|point;x=112;y=220;w=800;h=600|>")
        self.assertEqual(result["box"],[110,111,226,300])
        with patch("urllib.request.urlopen",return_value=response("")):
            self.assertIsNone(app.ai(self.p,args)["box"])
        with self.assertRaises(app.Problem):
            app.ai(self.p,dict(args,x=900))

    def test_format_catalog_scans_native_and_compound_extensions(self):
        folder=Path(self.temp.name)/"vfx";folder.mkdir()
        names=["smoke.EMBER","river.liquigen","spark.illugen","hill.TERRAIN","cache.v001.BGEO.SC","random.sc","sample.terrain.exe"]
        for name in names:(folder/name).touch()
        for name,product in zip(names[:4],["JangaFX EmberGen","JangaFX LiquiGen","JangaFX IlluGen","Gaea"]):
            self.assertIn(Path(name).suffix[1:].lower(),app.FORMATS[product]["working"].split())
        result=app.scan(dict(folders=[str(folder)],extensions="EMBER,liquigen .ILLUGEN; terrain,bgeo.sc"))
        self.assertEqual({Path(f).name for f in result["files"]},set(names[:5]))
        filtered=app.scan(dict(folders=[str(folder)],extensions="bgeo.sc,terrain",folderFormats={str(folder):["BGEO.SC"]}))
        self.assertEqual([Path(f).name for f in filtered["files"]],[names[4]])

    def test_recall_capture_and_reviewable_match(self):
        _, content = self.call("recall", "Blender v007.2", question="Which mesh?")
        self.assertIn("Wider handle for a gloved hand.", content[0]["text"])
        _, content = self.call("capture", "Proposed: adjust handle.", excerpt="Maybe adjust handle.")
        self.assertIn("Maybe adjust handle.", content[0]["text"])
        result,_ = self.call("match",'{"recordId":"lamp","reason":"Matching lantern name."}',filename="lantern.blend",tool="bl")
        self.assertEqual(result["record"],"lamp")
        with self.assertRaises(app.Problem):
            self.call("match",'{"recordId":"invented","reason":"unknown"}',filename="lamp.blend",tool="bl")
        self.assertEqual(app.snapshot()["version"], 1)

    def test_open_registered_paths(self):
        folder=Path(self.temp.name)
        tool=self.p["tools"][0]
        tool["folders"]=[str(folder)]
        working=folder/"test.blend"
        working.touch()
        rev=self.p["revisions"][0]
        rev["path"]=str(working)
        app.commit(self.snap)
        folder_args=dict(project=self.p["id"],tool=tool["id"],path=str(folder))
        file_args=dict(project=self.p["id"],revision=rev["id"])
        with patch("app.os.startfile",create=True) as launch:
            app.Handler.action(None,"/api/open-folder",folder_args)
            launch.assert_called_once_with(str(folder.resolve()))
            app.Handler.action(None,"/api/open",file_args)
            self.assertEqual(launch.call_args.args,(str(working.resolve()),))
            with self.assertRaises(app.Problem):
                app.Handler.action(None,"/api/open-folder",dict(folder_args,path=str(folder.parent)))
        with patch("app.subprocess.Popen") as launch:
            self.assertTrue(app.Handler.action(None,"/api/open",dict(file_args,reveal=True))["revealed"])
            self.assertIn(str(working.resolve()),launch.call_args.args[0])

    def test_asset_group_suggestions_are_reviewable(self):
        groups=[{"id":"rig","asset":"Patapim","allowed":["Rigging","3D Modeling"],
                 "files":["Patapim/v1/PatapimRig_v9_MHS_PoseBakeTest.fbx"]}]
        suggestion={"id":"rig","asset":"Patapim","discipline":"Rigging","type":"Character","classification":""}
        reply=json.dumps([suggestion,dict(suggestion,id="unknown"),dict(suggestion,discipline="Invented")])
        result,content=self.call("organize",reply,groups=groups)
        self.assertEqual(result["suggestions"],[suggestion])
        self.assertIn("PoseBakeTest",content[0]["text"])
        self.assertIn("Harbor lantern",content[0]["text"])
        self.assertEqual(app.snapshot()["version"],1)
        with self.assertRaisesRegex(app.Problem,"unreadable"):
            self.call("organize","broken JSON",groups=groups)

    def test_missing_key_and_auth_failure(self):
        response,content=self.call("coach","Try the lantern.",lesson="Match the source file.",question="What do I pick?")
        self.assertEqual(response["text"],"Try the lantern.")
        self.assertIn("Match the source file.",content[0]["text"])
        self.assertNotIn("Wider handle for a gloved hand.",content[0]["text"])
        with patch.object(app,"SESSION_KEY",""), patch.dict("os.environ",{"MODEL_API_KEY":""}):
            with self.assertRaisesRegex(app.Problem,"API key"):
                app.ai(self.p,{"mode":"recall","question":"hello"})
        with patch("urllib.request.urlopen",side_effect=HTTPError(app.ENDPOINT,401,"Unauthorized",{},None)):
            with self.assertRaisesRegex(app.Problem,"401"):
                app.ai(self.p,{"mode":"recall","question":"hello"})


if __name__=="__main__":
    unittest.main()

