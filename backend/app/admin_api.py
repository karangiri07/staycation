"""Admin-only API: login/password, dashboard numbers, paged lists, exports and the error log.
Lists never load whole tables: every one is a COUNT plus a LIMIT/OFFSET page, so 100,000 rows cost the same as 100."""
import csv, io, json, math, time
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import case, delete, func, literal_column, or_, select, text
from sqlalchemy.orm import Session
from .config import settings, INSECURE_PASSWORDS
from .db import SessionLocal, engine, get_db
from .media import cloud_ready
from .models import EnquiryClick, ErrorLog, Property, PropertyImage, Reel, Setting, Subscriber
from .schemas import (Login, PasswordChange, PasswordChanged, OkOut, TokenOut, PropertyOut, PropertyPatch, PropertyLite, PropertyPage, ReelOut, ReelPage,
    SubscriberOut, SubscriberPage, StatusOut, StatsOut, ErrorList)
from .security import (as_utc, bump_token_version, check_credentials, client_ip, COMMON_PASSWORDS, current_hash, hash_password, make_token, now_utc,
    require_admin, security_state, throttle_check, throttle_clear, throttle_fail, verify_password)
router=APIRouter()
# ---------- helpers ----------
def paging(page:int,page_size:int):
    return max(1,page),min(100,max(1,page_size))
def page_out(items,total:int,page:int,page_size:int):
    return {"items":items,"total":total,"page":page,"page_size":page_size,"pages":max(1,math.ceil(total/page_size))}
def like(q:str)->str:
    # % and _ typed by the admin are searched literally.
    return "%"+q.strip()[:100].replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%"
def today_str(): return datetime.now(timezone.utc).strftime("%Y-%m-%d")
# ---------- sign-in, refresh, password ----------
@router.post("/api/auth/login",response_model=TokenOut)
def login(body:Login,request:Request,db:Session=Depends(get_db)):
    ip=client_ip(request); throttle_check(db,ip)
    if not check_credentials(db,body.username,body.password):
        throttle_fail(db,ip); time.sleep(0.4)
        raise HTTPException(401,"Incorrect username or password")
    throttle_clear(db,ip)
    return make_token(db)
@router.post("/api/admin/refresh",response_model=TokenOut)
def refresh(_:str=Depends(require_admin),db:Session=Depends(get_db)): return make_token(db)
@router.post("/api/admin/logout-all",response_model=OkOut)
def logout_all(_:str=Depends(require_admin),db:Session=Depends(get_db)):
    bump_token_version(db); return {"ok":True}
@router.post("/api/admin/password",response_model=PasswordChanged)
def change_password(body:PasswordChange,request:Request,_:str=Depends(require_admin),db:Session=Depends(get_db)):
    ip=client_ip(request); throttle_check(db,ip)
    if not verify_password(body.current_password,current_hash(db)):
        throttle_fail(db,ip); time.sleep(0.4)
        raise HTTPException(400,"Current password is wrong")
    new=body.new_password
    if len(new)<10: raise HTTPException(400,"New password must be at least 10 characters")
    if len(new.encode("utf-8"))>72: raise HTTPException(400,"New password must be at most 72 characters")
    if verify_password(new,current_hash(db)): raise HTTPException(400,"New password must be different from the current one")
    if new.strip().lower()==settings.admin_username.lower(): raise HTTPException(400,"Password cannot be the same as the username")
    if new.strip().lower() in COMMON_PASSWORDS or new in INSECURE_PASSWORDS: raise HTTPException(400,"That password is too common. Choose something harder to guess.")
    item=db.get(Setting,"admin.password_hash"); hashed=hash_password(new)
    if item: item.value=hashed
    else: db.add(Setting(key="admin.password_hash",value=hashed))
    db.commit(); bump_token_version(db); throttle_clear(db,ip)
    return {"ok":True,**make_token(db)}
# ---------- status, dashboard numbers, error log ----------
@router.get("/api/admin/status",response_model=StatusOut)
def status(_:str=Depends(require_admin),db:Session=Depends(get_db)):
    db_ok=True
    try: db.execute(text("SELECT 1"))
    except Exception: db_ok=False; db.rollback()
    state=security_state(db); warnings=list(state["warnings"])
    cloud=cloud_ready()
    if not cloud: warnings.append("Cloudinary is not set up, so photo and reel uploads will fail. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to backend/.env and restart the backend.")
    number=db.get(Setting,"whatsapp_number"); digits="".join(c for c in (number.value if number else "") if c.isdigit()); whatsapp_set=8<=len(digits)<=15
    if not whatsapp_set: warnings.append("No WhatsApp number is saved yet, so Enquire buttons will not open WhatsApp. Save it in the WhatsApp Contact card.")
    if settings.is_production and all("localhost" in o or "127.0.0.1" in o for o in settings.origins): warnings.append("CORS_ORIGINS in backend/.env only lists localhost. Add your website address (for example https://yoursite.com) or the live site cannot reach this API.")
    try: errors_24h=db.execute(select(func.count()).select_from(ErrorLog).where(ErrorLog.created_at>=now_utc()-timedelta(hours=24))).scalar_one()
    except Exception: errors_24h=0; db.rollback()
    if errors_24h: warnings.append(f"{errors_24h} server error{'' if errors_24h==1 else 's'} in the last 24 hours. See Settings > Recent errors.")
    return {"api_version":2,"database":{"ok":db_ok,"kind":engine.dialect.name},"cloudinary":cloud,"whatsapp_set":whatsapp_set,"secure_secret":state["secure_secret"],"secure_password":state["secure_password"],
        "app_env":settings.app_env,"warnings":warnings,"errors_24h":errors_24h,"server_time":now_utc().isoformat()}
@router.get("/api/admin/stats",response_model=StatsOut)
def stats(_:str=Depends(require_admin),db:Session=Depends(get_db)):
    def counts(model):
        total,published=db.execute(select(func.count(model.id),func.coalesce(func.sum(case((model.published.is_(True),1),else_=0)),0))).one()
        return {"total":total,"published":int(published),"draft":total-int(published)}
    start_today=now_utc().replace(hour=0,minute=0,second=0,microsecond=0); since=start_today-timedelta(days=13)
    total,today,week=db.execute(select(func.count(Subscriber.id),func.coalesce(func.sum(case((Subscriber.created_at>=start_today,1),else_=0)),0),
        func.coalesce(func.sum(case((Subscriber.created_at>=start_today-timedelta(days=6),1),else_=0)),0))).one()
    day=func.date(func.timezone(literal_column("'UTC'"),Subscriber.created_at)) if engine.dialect.name=="postgresql" else func.date(Subscriber.created_at)
    by_day={str(d):c for d,c in db.execute(select(day,func.count()).where(Subscriber.created_at>=since).group_by(day)).all()}
    series=[]
    for offset in range(14):
        date=(since+timedelta(days=offset)).strftime("%Y-%m-%d"); series.append({"date":date,"count":by_day.get(date,0)})
    recent=db.execute(select(Subscriber).order_by(Subscriber.id.desc()).limit(5)).scalars().all()
    reel_views=int(db.execute(select(func.coalesce(func.sum(Reel.views),0))).scalar_one())
    # WhatsApp enquiries: the same day windows as the sign-ups above (UTC days), plus a per-property ranking for the last 7 days.
    week_start=start_today-timedelta(days=6)
    in_week=case((EnquiryClick.created_at>=week_start,1),else_=0)
    e_total,e_today,e_week=db.execute(select(func.count(EnquiryClick.id),func.coalesce(func.sum(case((EnquiryClick.created_at>=start_today,1),else_=0)),0),func.coalesce(func.sum(in_week),0))).one()
    e_day=func.date(func.timezone(literal_column("'UTC'"),EnquiryClick.created_at)) if engine.dialect.name=="postgresql" else func.date(EnquiryClick.created_at)
    e_by_day={str(d):c for d,c in db.execute(select(e_day,func.count()).where(EnquiryClick.created_at>=since).group_by(e_day)).all()}
    e_series=[{"date":(since+timedelta(days=offset)).strftime("%Y-%m-%d"),"count":e_by_day.get((since+timedelta(days=offset)).strftime("%Y-%m-%d"),0)} for offset in range(14)]
    ranking=db.execute(select(Property.id,Property.name,func.coalesce(func.sum(in_week),0),func.count(EnquiryClick.id)).join(EnquiryClick,EnquiryClick.property_id==Property.id)
        .group_by(Property.id,Property.name).order_by(func.sum(in_week).desc(),func.count(EnquiryClick.id).desc(),Property.id).limit(10)).all()
    enquiries={"total":int(e_total),"today":int(e_today),"week":int(e_week),"by_day":e_series,"properties":[{"id":pid,"name":name,"week":int(w),"total":int(t)} for pid,name,w,t in ranking]}
    return {"properties":counts(Property),"reels":{**counts(Reel),"views":reel_views},"subscribers":{"total":total,"today":int(today),"week":int(week)},"signups_by_day":series,"recent_subscribers":recent,"enquiries":enquiries}
@router.get("/api/admin/errors",response_model=ErrorList)
def list_errors(_:str=Depends(require_admin),db:Session=Depends(get_db)):
    items=db.execute(select(ErrorLog).order_by(ErrorLog.id.desc()).limit(30)).scalars().all()
    return {"items":items,"total":db.execute(select(func.count()).select_from(ErrorLog)).scalar_one()}
@router.delete("/api/admin/errors",response_model=OkOut)
def clear_errors(_:str=Depends(require_admin),db:Session=Depends(get_db)):
    db.execute(delete(ErrorLog)); db.commit(); return {"ok":True}
# ---------- properties ----------
def lite_columns():
    photos=select(func.count(PropertyImage.id)).where(PropertyImage.property_id==Property.id).correlate(Property).scalar_subquery().label("photo_count")
    return (Property.id,Property.name,Property.category,Property.location,Property.price,Property.original_price,Property.tag,Property.published,Property.image_url,photos)
def lite_item(row)->dict:
    return {"id":row.id,"name":row.name,"category":row.category,"location":row.location,"price":row.price,"original_price":row.original_price or "","tag":row.tag or "","published":bool(row.published),
        "image_url":row.image_url or "","photo_count":row.photo_count or (1 if row.image_url else 0)}
@router.get("/api/admin/properties",response_model=PropertyPage)
def admin_properties(page:int=1,page_size:int=20,q:str="",status:str="all",category:str="",_:str=Depends(require_admin),db:Session=Depends(get_db)):
    page,page_size=paging(page,page_size); where=[]
    if status=="published": where.append(Property.published.is_(True))
    elif status=="draft": where.append(Property.published.is_(False))
    if category in ("Villa","Farmhouse","Resort"): where.append(Property.category==category)
    if q.strip(): pattern=like(q); where.append(or_(Property.name.ilike(pattern,escape="\\"),Property.location.ilike(pattern,escape="\\"),Property.tag.ilike(pattern,escape="\\")))
    total=db.execute(select(func.count(Property.id)).where(*where)).scalar_one()
    rows=db.execute(select(*lite_columns()).where(*where).order_by(Property.id.desc()).limit(page_size).offset((page-1)*page_size)).all()
    return page_out([lite_item(r) for r in rows],total,page,page_size)
@router.get("/api/admin/properties/{item_id}",response_model=PropertyOut)
def admin_property(item_id:int,_:str=Depends(require_admin),db:Session=Depends(get_db)):
    item=db.get(Property,item_id)
    if not item: raise HTTPException(404,"Property not found")
    return item
@router.patch("/api/admin/properties/{item_id}",response_model=PropertyLite)
def patch_property(item_id:int,body:PropertyPatch,_:str=Depends(require_admin),db:Session=Depends(get_db)):
    item=db.get(Property,item_id)
    if not item: raise HTTPException(404,"Property not found")
    item.published=body.published; db.commit()
    return lite_item(db.execute(select(*lite_columns()).where(Property.id==item_id)).one())
# ---------- reels ----------
@router.get("/api/admin/reels",response_model=ReelPage)
def admin_reels(page:int=1,page_size:int=20,q:str="",status:str="all",_:str=Depends(require_admin),db:Session=Depends(get_db)):
    page,page_size=paging(page,page_size); where=[]
    if status=="published": where.append(Reel.published.is_(True))
    elif status=="draft": where.append(Reel.published.is_(False))
    if q.strip(): where.append(Reel.title.ilike(like(q),escape="\\"))
    total=db.execute(select(func.count(Reel.id)).where(*where)).scalar_one()
    rows=db.execute(select(Reel.id,Reel.title,Reel.video_url,Reel.published,Reel.views,Reel.duration).where(*where).order_by(Reel.id.desc()).limit(page_size).offset((page-1)*page_size)).all()
    return page_out([{"id":r.id,"title":r.title,"video_url":r.video_url,"published":bool(r.published),"views":r.views or 0,"duration":r.duration or 0} for r in rows],total,page,page_size)
# ---------- email sign-ups ----------
@router.get("/api/admin/subscribers",response_model=SubscriberPage)
def admin_subscribers(page:int=1,page_size:int=20,q:str="",_:str=Depends(require_admin),db:Session=Depends(get_db)):
    page,page_size=paging(page,page_size); where=[Subscriber.email.ilike(like(q),escape="\\")] if q.strip() else []
    total=db.execute(select(func.count(Subscriber.id)).where(*where)).scalar_one()
    rows=db.execute(select(Subscriber).where(*where).order_by(Subscriber.id.desc()).limit(page_size).offset((page-1)*page_size)).scalars().all()
    return page_out(rows,total,page,page_size)
def csv_cell(value:str)->str:
    # A cell starting with = + - @ would run as a formula in Excel, so it gets a leading apostrophe.
    return "'"+value if value[:1] in ("=","+","-","@","\t","\r") else value
def signups_csv(q:str):
    where=[Subscriber.email.ilike(like(q),escape="\\")] if q.strip() else []
    buffer=io.StringIO(); writer=csv.writer(buffer,lineterminator="\r\n"); writer.writerow(["email","signed_up_at"]); yield buffer.getvalue()
    with SessionLocal() as db:
        rows=db.execute(select(Subscriber.email,Subscriber.created_at).where(*where).order_by(Subscriber.id.desc()).execution_options(yield_per=1000))
        for batch in rows.partitions(1000):
            buffer=io.StringIO(); writer=csv.writer(buffer,lineterminator="\r\n")
            for email,created in batch: writer.writerow([csv_cell(email),as_utc(created).strftime("%Y-%m-%d %H:%M:%S") if created else ""])
            yield buffer.getvalue()
@router.get("/api/admin/subscribers/export.csv")
def export_subscribers(q:str="",_:str=Depends(require_admin)):
    return StreamingResponse(signups_csv(q),media_type="text/csv; charset=utf-8",headers={"Content-Disposition":f'attachment; filename="staycation-signups-{today_str()}.csv"'})
# ---------- full backup (JSON download) ----------
def backup_json():
    def dump(value): return json.dumps(value,ensure_ascii=False,default=str)
    with SessionLocal() as db:
        yield '{"exported_at":'+dump(now_utc().isoformat())+',"properties":['
        first=True; last=0
        while True:
            rows=db.execute(select(Property).where(Property.id>last).order_by(Property.id).limit(200)).scalars().all()
            if not rows: break
            for item in rows:
                yield ("" if first else ",")+dump(PropertyOut.model_validate(item).model_dump(mode="json")); first=False
            last=rows[-1].id; db.expunge_all()
        yield '],"reels":['
        first=True; last=0
        while True:
            rows=db.execute(select(Reel).where(Reel.id>last).order_by(Reel.id).limit(500)).scalars().all()
            if not rows: break
            for item in rows:
                yield ("" if first else ",")+dump({"id":item.id,"title":item.title,"video_url":item.video_url,"public_id":item.public_id,"published":item.published,"views":item.views,"duration":item.duration}); first=False
            last=rows[-1].id; db.expunge_all()
        yield '],"subscribers":['
        first=True
        for batch in db.execute(select(Subscriber.id,Subscriber.email,Subscriber.created_at).order_by(Subscriber.id).execution_options(yield_per=2000)).partitions(2000):
            # One chunk per 2000 rows (not one per row), so 100,000 sign-ups stream in a couple of seconds.
            chunk=",".join(dump({"id":sid,"email":email,"created_at":as_utc(created).isoformat() if created else None}) for sid,email,created in batch)
            yield ("" if first else ",")+chunk; first=False
        yield '],"settings":'+dump({s.key:s.value for s in db.execute(select(Setting)).scalars() if not s.key.startswith("admin.")})+"}"
@router.get("/api/admin/backup")
def backup(_:str=Depends(require_admin)):
    return StreamingResponse(backup_json(),media_type="application/json; charset=utf-8",headers={"Content-Disposition":f'attachment; filename="staycation-backup-{today_str()}.json"'})
