from pathlib import Path
import time
from fastapi import FastAPI, Depends, HTTPException, Request, Response, UploadFile, File
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from .admin_api import router as admin_router
from .config import settings
from .db import Base, engine, get_db, SessionLocal
from .errors import crash_response, log_error, validation_handler
from .media import delete_media, upload_media
from .models import EnquiryClick, Property, PropertyImage, Reel, Setting, Subscriber
from .schemas import PropertyIn, PropertyOut, ConfigIn, ConfigOut, ReelIn, ReelOut, ReelPatch, CreatorIn, SubscribeIn
from .security import client_ip, require_admin, startup_security_check
# Live site (APP_ENV=production): no public API docs.
docs={} if not settings.is_production else {"docs_url":None,"redoc_url":None,"openapi_url":None}
app=FastAPI(title="Staycation API",version="2.0.0",**docs)
@app.middleware("http")
async def guard(request:Request,call_next):
    # Added before CORS on purpose: CORS wraps it, so even a 500 reply carries CORS headers and the browser can read the message.
    try: response=await call_next(request)
    except Exception as exc: response=crash_response(await run_in_threadpool(log_error,request,exc))
    response.headers["X-Content-Type-Options"]="nosniff"; response.headers["X-Frame-Options"]="DENY"; response.headers["Referrer-Policy"]="no-referrer"
    if request.url.path.startswith(("/api/admin","/api/auth")): response.headers["Cache-Control"]="no-store"
    return response
app.add_middleware(CORSMiddleware,allow_origins=settings.origins,allow_credentials=True,allow_methods=["GET","POST","PUT","PATCH","DELETE"],allow_headers=["Authorization","Content-Type"],expose_headers=["Retry-After","Content-Disposition"])
app.add_exception_handler(RequestValidationError,validation_handler)
INDEXES=["CREATE INDEX IF NOT EXISTS ix_reels_published ON reels (published)",
    "CREATE INDEX IF NOT EXISTS ix_subscribers_created_at ON subscribers (created_at)",
    "CREATE INDEX IF NOT EXISTS ix_error_logs_created_at ON error_logs (created_at)",
    "CREATE INDEX IF NOT EXISTS ix_login_attempts_created_at ON login_attempts (created_at)",
    "CREATE INDEX IF NOT EXISTS ix_login_attempts_ip_created_at ON login_attempts (ip, created_at)"]
NEW_COLUMNS=[("properties","original_price","VARCHAR(60) NOT NULL DEFAULT ''"),("reels","views","INTEGER NOT NULL DEFAULT 0"),("reels","duration","INTEGER NOT NULL DEFAULT 0")]
def ensure_columns():
    # create_all only creates missing tables, it never alters existing ones. Newer columns are added here (safe on every start).
    from sqlalchemy import inspect
    inspector=inspect(engine)
    for table,column,ddl in NEW_COLUMNS:
        if column not in {c["name"] for c in inspector.get_columns(table)}:
            with engine.begin() as conn: conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
def ensure_indexes():
    # Indexes on tables that already existed are not created by create_all, so add them here (idempotent, SQLite and Postgres).
    with engine.begin() as conn:
        for statement in INDEXES: conn.exec_driver_sql(statement)
def init_db():
    Base.metadata.create_all(bind=engine); ensure_columns(); ensure_indexes()
    from . import models
    migration=Path(__file__).resolve().parents[1]/"migrations"/"001_initial.sql"
    if engine.dialect.name=="postgresql":
        with engine.begin() as conn:
            for statement in migration.read_text().split(";"):
                if statement.strip(): conn.exec_driver_sql(statement)
    with SessionLocal() as db:
        if db.query(Property).count()==0:
            originals=[
                ("Riverdale Farmhouse","Farmhouse","Vasai, Maharashtra","₹12,000","FEATURED","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=85"),
                ("Palm Bliss Villa","Villa","Virar, Maharashtra","₹8,500","POPULAR","https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=85"),
                ("The Hills Resort","Resort","Igatpuri, Maharashtra","₹15,000","GREAT ESCAPE","https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1000&q=85"),
                ("Green Escape Farm","Farmhouse","Alibaug, Maharashtra","₹10,000","NEW","https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=85"),
                ("Sunset View Villa","Villa","Lonavala, Maharashtra","₹13,500","SCENIC VIEW","https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85"),
                ("Palm Grove Resort","Resort","Nashik, Maharashtra","₹9,500","RELAX & UNWIND","https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=85")]
            db.add_all([Property(name=n,category=c,location=l,price=p,tag=t,image_url=image,published=True) for n,c,l,p,t,image in originals]); db.commit()
        if db.query(Reel).count()==0:
            source_reels=[("Property tour 01","DfMM3-6s5Kl"),("Villa experience 02","De30XeTNPe3"),("Farmhouse tour 03","DeoQS4UsnPW"),("Resort getaway 04","Dd3cRAINYuz"),("Weekend escape 05","Dbz3MxIy7ez")]
            db.add_all([Reel(title=title,video_url=f"https://www.instagram.com/reel/{code}/",published=False) for title,code in source_reels]); db.commit()
        startup_security_check(db)
init_db()
app.include_router(admin_router)
def set_images(item,images):
    # Photos are stored in order. The first photo is the cover, so the old single-image fields stay in sync.
    item.images.clear()
    for position,image in enumerate(images): item.images.append(PropertyImage(url=image.url,public_id=image.public_id,position=position))
    if images: item.image_url=images[0].url; item.image_public_id=images[0].public_id
@app.get("/api/health")
def health(): return {"ok":True}
@app.get("/api/properties",response_model=list[PropertyOut])
def list_properties(limit:int=500,offset:int=0,db:Session=Depends(get_db)):
    return db.query(Property).filter(Property.published.is_(True)).order_by(Property.id.desc()).offset(max(0,offset)).limit(min(1000,max(1,limit))).all()
def seconds(result)->int:
    # Cloudinary reports the video length in seconds (a float) when the upload finishes.
    try: return max(0,min(86400,int(round(float(result.get("duration") or 0)))))
    except (TypeError,ValueError): return 0
@app.get("/api/reels",response_model=list[ReelOut])
def public_reels(db:Session=Depends(get_db)):
    return db.query(Reel).filter(Reel.published.is_(True)).order_by(Reel.id.desc()).all()
@app.get("/api/public/config",response_model=ConfigOut)
def public_config(db:Session=Depends(get_db)):
    item=db.get(Setting,"whatsapp_number"); return {"whatsapp_number":item.value if item else "91XXXXXXXXXX"}
@app.get("/api/admin/config",response_model=ConfigOut)
def get_config(_:str=Depends(require_admin),db:Session=Depends(get_db)):
    item=db.get(Setting,"whatsapp_number"); return {"whatsapp_number":item.value if item else "91XXXXXXXXXX"}
@app.put("/api/admin/config",response_model=ConfigOut)
def set_config(body:ConfigIn,_:str=Depends(require_admin),db:Session=Depends(get_db)):
    number="".join(c for c in body.whatsapp_number if c.isdigit())
    if not 8<=len(number)<=15: raise HTTPException(422,"Use an international phone number with 8 to 15 digits")
    item=db.get(Setting,"whatsapp_number")
    if not item: item=Setting(key="whatsapp_number",value=number); db.add(item)
    else: item.value=number
    db.commit(); return {"whatsapp_number":number}
@app.post("/api/admin/properties",response_model=PropertyOut,status_code=201)
def create_property(body:PropertyIn,_:str=Depends(require_admin),db:Session=Depends(get_db)):
    item=Property(**body.model_dump(exclude={"images"})); set_images(item,body.images); db.add(item); db.commit(); db.refresh(item); return item
@app.put("/api/admin/properties/{item_id}",response_model=PropertyOut)
def update_property(item_id:int,body:PropertyIn,_:str=Depends(require_admin),db:Session=Depends(get_db)):
    item=db.get(Property,item_id)
    if not item: raise HTTPException(404,"Property not found")
    old={i.public_id for i in item.images if i.public_id}|({item.image_public_id} if item.image_public_id else set())
    for key,value in body.model_dump(exclude={"images"}).items(): setattr(item,key,value)
    set_images(item,body.images); db.commit(); db.refresh(item)
    for pid in old-{i.public_id for i in body.images}-{item.image_public_id}:
        try: delete_media(pid)
        except Exception: pass
    return item
@app.delete("/api/admin/properties/{item_id}",status_code=204)
def remove_property(item_id:int,_:str=Depends(require_admin),db:Session=Depends(get_db)):
    item=db.get(Property,item_id)
    if not item: raise HTTPException(404,"Property not found")
    for pid in {i.public_id for i in item.images if i.public_id}|({item.image_public_id} if item.image_public_id else set()):
        try: delete_media(pid)
        except Exception: pass
    db.execute(delete(EnquiryClick).where(EnquiryClick.property_id==item_id)); db.delete(item); db.commit()
@app.post("/api/admin/upload/image")
def upload_image(file:UploadFile=File(...),_:str=Depends(require_admin)):
    result=upload_media(file,"image"); return {"url":result["secure_url"],"public_id":result["public_id"]}
@app.post("/api/admin/upload/reel")
def upload_reel(file:UploadFile=File(...),_:str=Depends(require_admin),db:Session=Depends(get_db)):
    result=upload_media(file,"video"); item=Reel(title=(file.filename or "Staycation reel")[:160],video_url=result["secure_url"],public_id=result["public_id"],duration=seconds(result),published=False); db.add(item); db.commit(); db.refresh(item); return {"id":item.id,"title":item.title,"video_url":item.video_url,"published":item.published}
@app.delete("/api/admin/upload/{public_id:path}")
def remove_upload(public_id:str,_:str=Depends(require_admin)):
    if not settings.cloudinary_api_secret: raise HTTPException(503,"Cloudinary is not set up: add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to backend/.env and restart the backend.")
    delete_media(public_id); return {"deleted":True}
@app.post("/api/admin/reels",response_model=ReelOut,status_code=201)
def create_reel(body:ReelIn,file:UploadFile=File(...),_:str=Depends(require_admin),db:Session=Depends(get_db)):
    result=upload_media(file,"video"); item=Reel(title=body.title,video_url=result["secure_url"],public_id=result["public_id"],duration=seconds(result),published=body.published); db.add(item); db.commit(); db.refresh(item); return item
@app.patch("/api/admin/reels/{item_id}",response_model=ReelOut)
def update_reel(item_id:int,body:ReelPatch,_:str=Depends(require_admin),db:Session=Depends(get_db)):
    item=db.get(Reel,item_id)
    if not item: raise HTTPException(404,"Reel not found")
    if body.title is not None: item.title=body.title
    if body.published is not None: item.published=body.published
    db.commit(); db.refresh(item); return item
@app.delete("/api/admin/reels/{item_id}",status_code=204)
def remove_reel(item_id:int,_:str=Depends(require_admin),db:Session=Depends(get_db)):
    item=db.get(Reel,item_id)
    if not item: raise HTTPException(404,"Reel not found")
    delete_media(item.public_id); db.delete(item); db.commit()
# ---------- creator profile (shown in the "Meet the creator" card and the footer) ----------
CREATOR_FIELDS=("name","headline","bio","photo","instagram_url","youtube_url","email","stat_instagram","stat_youtube","stat_views")
def read_creator(db):
    rows=db.query(Setting).filter(Setting.key.like("creator.%")).all()
    return {r.key[8:]:r.value for r in rows if r.key[8:] in CREATOR_FIELDS and r.value}
@app.get("/api/public/creator")
def public_creator(db:Session=Depends(get_db)): return read_creator(db)
@app.put("/api/admin/creator")
def save_creator(body:CreatorIn,_:str=Depends(require_admin),db:Session=Depends(get_db)):
    for field,value in body.model_dump(exclude_none=True).items():
        key=f"creator.{field}"; value=value.strip(); item=db.get(Setting,key)
        if not value:
            if item: db.delete(item)
        elif item: item.value=value
        else: db.add(Setting(key=key,value=value))
    db.commit(); return read_creator(db)
# ---------- "Stay in the loop" email sign-ups ----------
_recent={}
def too_many(request:Request,limit=6,window=600):
    # Small in-memory brake against form spam: 6 sign-ups per 10 minutes per visitor.
    who=client_ip(request); now=time.time()
    hits=[t for t in _recent.get(who,[]) if now-t<window]
    if len(hits)>=limit: _recent[who]=hits; return True
    hits.append(now); _recent[who]=hits
    if len(_recent)>5000: _recent.clear()
    return False
@app.post("/api/subscribe",status_code=201)
def subscribe(body:SubscribeIn,request:Request,db:Session=Depends(get_db)):
    if too_many(request): raise HTTPException(429,"Too many attempts. Please try again in a few minutes.")
    email=body.email.strip().lower()
    if not db.query(Subscriber).filter(Subscriber.email==email).first():
        try: db.add(Subscriber(email=email)); db.commit()
        except IntegrityError: db.rollback()  # two visitors sent the same address at the same instant: one row is enough
    return {"ok":True}
@app.delete("/api/admin/subscribers/{item_id}",status_code=204)
def remove_subscriber(item_id:int,_:str=Depends(require_admin),db:Session=Depends(get_db)):
    item=db.get(Subscriber,item_id)
    if not item: raise HTTPException(404,"Subscriber not found")
    db.delete(item); db.commit()
# ---------- reel views (counted when a visitor really watches a reel on the website) ----------
_seen_views={}
@app.post("/api/reels/{item_id}/view",status_code=204)
def count_reel_view(item_id:int,request:Request,db:Session=Depends(get_db)):
    # One view per visitor per reel per hour, so refreshing or replaying cannot inflate the number. Counted inside the database in one UPDATE.
    key=(client_ip(request),item_id); now=time.time()
    if now-_seen_views.get(key,0)>=3600:
        _seen_views[key]=now
        if len(_seen_views)>20000: _seen_views.clear()
        db.execute(update(Reel).where(Reel.id==item_id,Reel.published.is_(True)).values(views=Reel.views+1)); db.commit()
    return Response(status_code=204)
# ---------- WhatsApp enquiries (counted when a visitor taps WhatsApp on a property) ----------
_seen_enquiries={}
@app.post("/api/properties/{item_id}/enquiry",status_code=204)
def count_enquiry(item_id:int,request:Request,db:Session=Depends(get_db)):
    # One enquiry per visitor per property every 10 minutes, so double taps and refreshes cannot inflate the number. Unknown or unpublished properties are ignored.
    key=(client_ip(request),item_id); now=time.time()
    if now-_seen_enquiries.get(key,0)>=600 and db.execute(select(Property.id).where(Property.id==item_id,Property.published.is_(True))).first():
        _seen_enquiries[key]=now
        if len(_seen_enquiries)>20000: _seen_enquiries.clear()
        db.add(EnquiryClick(property_id=item_id)); db.commit()
    return Response(status_code=204)
