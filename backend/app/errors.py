import logging, traceback
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import delete
from .db import SessionLocal
from .models import ErrorLog
log=logging.getLogger("staycation.errors")
LABELS={"name":"Name","category":"Category","location":"Location","price":"Price","original_price":"Original price","tag":"Tag","description":"Description","whatsapp_number":"WhatsApp number","email":"Email","username":"Username","password":"Password","current_password":"Current password","new_password":"New password","title":"Title","published":"Published","url":"Photo link","images":"Photos","photo":"Photo","headline":"Heading","bio":"Short bio","instagram_url":"Instagram link","youtube_url":"YouTube link","stat_instagram":"Instagram followers","stat_youtube":"YouTube subscribers","stat_views":"Reel views","image_url":"Cover photo","file":"File"}
def _label(loc)->str:
    parts=[p for p in loc if isinstance(p,str) and p not in ("body","query","path","form")]
    if not parts: return "Request"
    field=parts[-1]; label=LABELS.get(field,field.replace("_"," ").capitalize())
    return label
def _humanise(error:dict,field:str)->str:
    kind=error.get("type",""); ctx=error.get("ctx") or {}; msg=error.get("msg","is not valid")
    if kind=="missing": return "field required"
    if kind=="string_too_short": return "can't be empty" if ctx.get("min_length")==1 else f"must be at least {ctx.get('min_length')} characters"
    if kind=="string_too_long": return f"must be at most {ctx.get('max_length')} characters"
    if kind=="string_pattern_mismatch":
        if field=="category": return "must be Villa, Farmhouse or Resort"
        if field=="whatsapp_number": return "can only contain digits, +, spaces, brackets and -"
        if field=="email": return "must be a valid email address"
        return "has an invalid format"
    if kind=="too_long": return f"has too many items (maximum {ctx.get('max_length')})"
    if kind=="json_invalid": return "was not valid JSON"
    if kind=="value_error": return msg.removeprefix("Value error, ")
    if kind in ("bool_parsing","bool_type"): return "must be true or false"
    if kind in ("int_parsing","int_type"): return "must be a whole number"
    return msg[:1].lower()+msg[1:]
def validation_message(errors:list)->str:
    seen=[]
    for error in errors:
        label=_label(error.get("loc",())); field=next((p for p in reversed(error.get("loc",())) if isinstance(p,str)),"")
        text=f"{label}: {_humanise(error,field)}"
        if text not in seen: seen.append(text)
    return "; ".join(seen[:6])+(f"; and {len(seen)-6} more" if len(seen)>6 else "") if seen else "The submitted data is not valid"
async def validation_handler(request:Request,exc):
    return JSONResponse(status_code=422,content={"detail":validation_message(exc.errors())})
def log_error(request:Request,exc:Exception)->int|None:
    # Prints the traceback in the backend terminal and keeps a short copy in the database for the admin panel.
    traceback.print_exception(type(exc),exc,exc.__traceback__)
    try:
        frames=traceback.extract_tb(exc.__traceback__); where=f" (at {frames[-1].filename.split('/')[-1]}:{frames[-1].lineno} in {frames[-1].name})" if frames else ""
        message=f"{type(exc).__name__}: {exc}{where}"[:500]
        with SessionLocal() as db:
            row=ErrorLog(method=request.method[:10],path=request.url.path[:300],message=message); db.add(row); db.commit()
            ref=row.id; db.execute(delete(ErrorLog).where(ErrorLog.id<=ref-200)); db.commit()
            return ref
    except Exception:
        log.exception("Could not save the error to the error log")
        return None
def crash_response(ref:int|None)->JSONResponse:
    if ref is None: return JSONResponse(status_code=500,content={"detail":"Server error. Check the backend terminal window to see what happened.","ref":None})
    return JSONResponse(status_code=500,content={"detail":f"Server error (ref {ref}). Open Settings > Recent errors in the admin panel to see what happened.","ref":ref})
