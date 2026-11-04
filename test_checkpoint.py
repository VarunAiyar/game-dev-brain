import base64
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import app
from capture_vision import review


class CaptureTest(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root=Path(tmp.name)
        for name,value in (("DATA",self.root/"db"),("SESSION_KEY","")):
            mock=patch.object(app,name,value);mock.start();self.addCleanup(mock.stop)
        env=patch.dict(app.os.environ,{"MODEL_API_KEY":""});env.start();self.addCleanup(env.stop)
        app.initialize()
        self.image=base64.b64encode(app.preview_bytes("/art/lantern-wide.jpg")).decode()

    def capture(self,name,id,**kwargs):
        path=self.root/name;path.touch()
        route=app.checkpoint_action({"mode":"route","path":str(path)})
        family=app.capture_routing.series(path)[0]
        target=next((c for c in route["choices"] if c["source"] and c["recordName"]==family),None)
        if target is None:
            target=next(c for c in route["choices"] if not c["record"])
        data=dict(mode="save",id=id*32,jpeg=self.image,size=[640,400],path=str(path),**target)
        return app.checkpoint_action(dict(data,**kwargs))

    def test_checkpoint_repeat_save_as_and_undo(self):
        one=self.capture("Pen_Start.blend","a")
        two=self.capture("Pen_Start.blend","b")
        self.assertEqual(one["revision"],two["revision"])
        self.assertEqual(two,self.capture("Pen_Start.blend","b"))
        three=self.capture("Pen_Final.blend","c")
        snap=app.snapshot()
        p=app.by_id(snap["state"]["projects"],one["project"])
        start=app.by_id(p["revisions"],one["revision"]);final=app.by_id(p["revisions"],three["revision"])
        self.assertEqual(len(start["checkpoints"]),2)
        self.assertEqual(final["parent"],start["id"])
        self.assertEqual(final["checkpoints"][0]["before"],start["preview"])
        self.assertEqual(final["note"],"")
        self.assertEqual(app.checkpoint_action({"mode":"result","id":three["id"]})["status"],"offline")
        state=app.travel("undo",snap["version"])["state"]
        self.assertFalse(any(v["id"]==final["id"] for v in state["projects"][0]["revisions"]))

    def test_ambiguous_project_requires_choice(self):
        path=self.root/"Prop_v1.blend";path.touch()
        snap=app.snapshot()
        for p in snap["state"]["projects"]:
            next(t for t in p["tools"] if t["name"]=="Blender")["folders"]=[str(self.root)]
        app.commit(snap)
        route=app.checkpoint_action({"mode":"route","path":str(path)})
        self.assertFalse(route["automatic"])
        self.assertEqual(len([c for c in route["choices"] if not c["record"]]),2)

    def test_first_checkpoint_retries_token_exhaustion_without_recapturing(self):
        saved=self.capture("Desk_v001.blend","f")
        before=app.snapshot()
        p=app.by_id(before["state"]["projects"],saved["project"])
        cp=app.by_id(p["revisions"],saved["revision"])["checkpoints"][0]
        truncated={"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"},"output":[]}
        complete={"status":"completed","output":[{"content":[{"type":"output_text","text":"A desk lamp with a curved shade."}]}]}
        replies=[io.BytesIO(json.dumps(reply).encode()) for reply in (truncated,complete)]
        with patch("urllib.request.urlopen",side_effect=replies) as transport:
            app.capture_analysis(cp,"test-key")
        requests=[json.loads(call.args[0].data) for call in transport.call_args_list]
        self.assertEqual([r["max_output_tokens"] for r in requests],[4096,8192])
        self.assertTrue(all(r["reasoning"]=={"effort":"low"} for r in requests))
        self.assertEqual(requests[0]["input"],requests[1]["input"])
        self.assertEqual(app.checkpoint_action({"mode":"result","id":saved["id"]}),
                         {"status":"done","note":"A desk lamp with a curved shade.","changes":[]})
        self.assertEqual(app.snapshot(),before)

    def test_different_file_can_join_preview_only_node_and_branch(self):
        path=self.root/"HighPolySculpt.blend";path.touch()
        before=app.snapshot()
        route=app.checkpoint_action({"mode":"route","path":str(path)})
        self.assertFalse(route["automatic"])
        choice=next(c for c in route["choices"] if c["project"]=="brine" and c["source"]=="l7")
        body=dict(mode="save",id="d"*32,jpeg=self.image,size=[640,400],path=str(path),**choice)
        body["branch"]="High poly"
        result=app.checkpoint_action(body)
        p=app.by_id(app.snapshot()["state"]["projects"],"brine")
        v=app.by_id(p["revisions"],result["revision"])
        self.assertEqual(len(p["records"]),len(before["state"]["projects"][0]["records"]))
        self.assertEqual((v["record"],v["parent"],v["branch"],v["tool"]),("lamp","l7","High poly","bl"))
        self.assertEqual(v["checkpoints"][0]["before"],app.by_id(p["revisions"],"l7")["preview"])
        self.assertEqual(result,app.checkpoint_action(body))
        repeated=app.checkpoint_action({"mode":"route","path":str(path)})
        self.assertTrue(repeated["automatic"])
        self.assertEqual(len(repeated["choices"]),1)
        self.assertEqual(repeated["choices"][0]["source"],v["id"])
        self.assertEqual(app.travel("undo",app.snapshot()["version"])["state"],before["state"])

    def test_existing_empty_asset_and_cross_software_handoff(self):
        for index,(record,source) in enumerate((("cleat",""),("lamp","paint"))):
            path=self.root/f"Sculpt{index}.blend";path.touch()
            route=app.checkpoint_action({"mode":"route","path":str(path)})
            choice=next(c for c in route["choices"] if c["project"]=="brine" and c["record"]==record and c["source"]==source)
            result=app.checkpoint_action(dict(mode="save",id=str(index)*32,jpeg=self.image,size=[640,400],path=str(path),**choice))
            p=app.by_id(app.snapshot()["state"]["projects"],"brine")
            v=app.by_id(p["revisions"],result["revision"])
            self.assertEqual((v["record"],v["parent"],v["tool"],v["discipline"]),(record,source,"bl","3D Modeling"))

    def test_deleted_or_mismatched_source_is_rejected(self):
        path=self.root/"HighPoly.blend";path.touch()
        route=app.checkpoint_action({"mode":"route","path":str(path)})
        choice=next(c for c in route["choices"] if c["project"]=="brine" and c["source"]=="l7")
        body=dict(mode="save",id="e"*32,jpeg=self.image,size=[640,400],path=str(path),**choice)
        with self.assertRaises(app.Problem):
            app.checkpoint_action(dict(body,record="cleat"))
        snap=app.snapshot()
        p=app.by_id(snap["state"]["projects"],"brine")
        p["revisions"]=[v for v in p["revisions"] if v["id"]!="l7"]
        for v in p["revisions"]:
            if v["parent"]=="l7":
                v["parent"]=""
        app.commit(snap)
        with self.assertRaises(app.Problem):
            app.checkpoint_action(body)

    @unittest.skipUnless(importlib.util.find_spec("meta_sam_parser"),"install requirements-capture.txt to test SAM decoding")
    def test_model_note_and_actual_mask_decoder(self):
        cp={"id":"a","before":"left","preview":"right","size":[100,100]}
        diff={"summary":"A wider clip.","changes":[{"part":"Clip","detail":"Edge extends out.","after":[0,0,500,500]}]}
        def segment(content,key,model):
            self.assertEqual(model,"sam-3.1")
            self.assertIn("box;x1=0;y1=0;x2=50;y2=50",content[0]["text"])
            return {"text":"<0f>1<|box;x1=4;y1=6;x2=40;y2=42;w=100;h=100|><|mask;x=0;y=0;data=2,2,!!!!!&MoT/:|>"}
        out=review(cp,"test",lambda *args:diff,lambda ref:b"jpeg",segment,app.image_block)
        self.assertIn("Edge extends out",out["note"])
        self.assertEqual(out["mask"]["box"],[4,6,37,37])
        self.assertTrue(out["mask"]["path"])

    def test_no_change_skips_segmentation(self):
        diff={"summary":"No visible change.","changes":[]}
        cp={"before":"a","preview":"b"}
        self.assertEqual(review(cp,"test",lambda *args:diff,None,None,None)["note"],diff["summary"])
