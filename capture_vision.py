"""Automatic checkpoint review. Only the before/after JPEGs leave the workstation."""
import re


def review(checkpoint,key,highlight,preview_bytes,meta_request,image_block):
    before=checkpoint["before"]
    after=checkpoint["preview"]
    if not before:
        if not key:
            return {"status":"baseline","note":"First viewport captured. Future checkpoints can be compared with this one."}
        prompt="Write one concise baseline note for this Blender checkpoint. Describe the visible asset and its current appearance. Do not infer what changed, artist intent or hidden properties."
        answer=meta_request([{"type":"input_text","text":prompt},image_block(preview_bytes(after))],key)
        return {"status":"done","note":answer["text"][:900],"changes":[]}
    if not key:
        return {"status":"offline","note":"Connect Meta AI to analyze this checkpoint."}
    result=highlight({"preview":before},{"preview":after},key)
    changes=result["changes"]
    note=" ".join(dict.fromkeys([result["summary"],*(c["detail"] for c in changes)]))
    evidence={"status":"done","note":note,"changes":changes}
    candidate=next((c for c in changes if c.get("after")),None)
    if not candidate:
        return evidence
    try:
        from meta_sam_parser import SegmentationMask, decode_mask_to_svg_path
        w,h=checkpoint["size"]
        box=[max(0,min(size-1,round(n*size/1000))) for n,size in zip(candidate["after"],(w,h,w,h))]
        l,t,r,b=box
        prompt=f"<0f>1<|box;x1={l};y1={t};x2={r};y2={b};w={w};h={h}|>"
        raw=meta_request([{"type":"input_text","text":prompt},image_block(preview_bytes(after))],key,model="sam-3.1")["text"]
        match=re.search(r"<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)\|><\|mask;x=0;y=0;data=(\d+),(\d+),!([^|]+)\|>",raw)
        if not match:
            raise ValueError("No mask")
        left,top,right,bottom,sw,sh,mh,mw=map(int,match.groups()[:8])
        if not ((sw,sh)==(w,h) and 0<=left<=right<w and 0<=top<=bottom<h and 0<mw*mh<=1280**2):
            raise ValueError("Invalid bounds")
        if right<l or left>r or bottom<t or top>b:
            raise ValueError("Mask misses the proposed change")
        shape=decode_mask_to_svg_path(SegmentationMask("one_bit","!"+match[9],mw,mh))
        if not shape or len(shape)>500000:
            raise ValueError("No usable outline")
        evidence["mask"]={"path":shape,"box":[left,top,right-left+1,bottom-top+1],"raster":[mw,mh],"part":candidate["part"]}
    except ImportError:
        evidence["warning"]="Install requirements-capture.txt to enable SAM outlines."
    except Exception as exc:
        evidence["warning"]="SAM outline unavailable. "+str(exc)[:170]
    return evidence
