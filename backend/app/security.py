import logging, math
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from .config import settings, INSECURE_PASSWORDS, INSECURE_SECRETS
from .db import get_db
from .models import LoginAttempt, Setting
log=logging.getLogger("staycation.security")
pwd=CryptContext(schemes=["bcrypt"],deprecated="auto"); bearer=HTTPBearer(auto_error=False)
WINDOW=timedelta(minutes=15); MAX_FAILS=5
COMMON_PASSWORDS={"change-me-now","replace-before-deploy","password","admin","12345678","123456789","1234567890","qwerty123","password123","admin123","adminadmin","staycation","staycation123","letmein123","welcome123"}
def now_utc(): return datetime.now(timezone.utc)
def as_utc(value):
    # SQLite hands back naive datetimes that are really UTC; Postgres hands back aware ones.
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
def _bytes(plain:str)->bytes: return plain.encode("utf-8")[:72]  # bcrypt only reads the first 72 bytes
def hash_password(plain:str)->str: return pwd.hash(_bytes(plain))
def verify_password(plain:str,hashed:str)->bool:
    try: return pwd.verify(_bytes(plain),hashed)
    except (ValueError,TypeError): return False
# The sample/env password is hashed once at start-up, never per request.
ENV_HASH=hash_password(settings.admin_password)
def client_ip(request:Request)->str:
    # Behind a proxy the LAST X-Forwarded-For entry is the one the proxy itself added; earlier ones can be faked by the visitor.
    if settings.trust_proxy:
        parts=[p.strip() for p in request.headers.get("x-forwarded-for","").split(",") if p.strip()]
        if parts: return parts[-1][:64]
    return (request.client.host if request.client else "unknown")[:64]
# ---------- login throttle (stored in the database, so it survives restarts and several workers) ----------
def throttle_check(db:Session,ip:str):
    rows=db.execute(select(LoginAttempt.created_at).where(LoginAttempt.ip==ip,LoginAttempt.created_at>=now_utc()-WINDOW).order_by(LoginAttempt.created_at.desc()).limit(MAX_FAILS)).scalars().all()
    if len(rows)>=MAX_FAILS:
        wait=max(1,math.ceil((as_utc(rows[-1])+WINDOW-now_utc()).total_seconds())); minutes=max(1,math.ceil(wait/60))
        raise HTTPException(429,f"Too many wrong attempts. Try again in {minutes} minute{'' if minutes==1 else 's'}.",headers={"Retry-After":str(wait)})
def throttle_fail(db:Session,ip:str):
    db.add(LoginAttempt(ip=ip)); db.execute(delete(LoginAttempt).where(LoginAttempt.created_at<now_utc()-timedelta(days=1))); db.commit()
def throttle_clear(db:Session,ip:str):
    db.execute(delete(LoginAttempt).where(LoginAttempt.ip==ip)); db.commit()
# ---------- password and token version (both live in the settings table) ----------
def current_hash(db:Session)->str:
    item=db.get(Setting,"admin.password_hash")
    return item.value if item and item.value else ENV_HASH
def has_saved_password(db:Session)->bool:
    item=db.get(Setting,"admin.password_hash"); return bool(item and item.value)
def check_credentials(db:Session,username:str,password:str)->bool:
    # Always run the bcrypt check, even for a wrong username, so response time does not reveal which usernames exist.
    password_ok=verify_password(password,current_hash(db)); user_ok=username==settings.admin_username
    return password_ok and user_ok
def token_version(db:Session)->int:
    item=db.get(Setting,"admin.token_version")
    try: return int(item.value) if item and item.value else 0
    except ValueError: return 0
def bump_token_version(db:Session):
    item=db.get(Setting,"admin.token_version"); new=token_version(db)+1
    if item: item.value=str(new)
    else: db.add(Setting(key="admin.token_version",value=str(new)))
    db.commit()
def make_token(db:Session)->dict:
    minutes=settings.jwt_expire_minutes
    token=jwt.encode({"sub":settings.admin_username,"ver":token_version(db),"exp":now_utc()+timedelta(minutes=minutes)},settings.jwt_secret,algorithm="HS256")
    return {"access_token":token,"token_type":"bearer","expires_in":minutes*60}
def require_admin(cred:HTTPAuthorizationCredentials|None=Depends(bearer),db:Session=Depends(get_db)):
    if not cred: raise HTTPException(status_code=401,detail="Sign in required")
    try:
        data=jwt.decode(cred.credentials,settings.jwt_secret,algorithms=["HS256"])
        if data.get("sub")!=settings.admin_username: raise ValueError()
        if int(data.get("ver",0))!=token_version(db): raise ValueError()
    except (JWTError,ValueError,TypeError): raise HTTPException(status_code=401,detail="Invalid or expired login")
    return data["sub"]
# ---------- configuration health ----------
def security_state(db:Session)->dict:
    secret_bad=settings.jwt_secret in INSECURE_SECRETS or len(settings.jwt_secret)<32
    password_bad=settings.admin_password in INSECURE_PASSWORDS and not has_saved_password(db)
    warnings=[]
    if secret_bad: warnings.append("JWT_SECRET in backend/.env is missing, a sample value or shorter than 32 characters, so admin logins could be forged. Set it to a long random value (python -c \"import secrets;print(secrets.token_urlsafe(48))\") and restart the backend.")
    if password_bad: warnings.append("The admin password is still the sample one. Change it now under Settings > Change password (or set ADMIN_PASSWORD in backend/.env).")
    return {"secure_secret":not secret_bad,"secure_password":not password_bad,"warnings":warnings}
def startup_security_check(db:Session):
    state=security_state(db)
    if settings.is_production:
        problems=[]
        if settings.database_url.startswith("sqlite"): problems.append("DATABASE_URL points to a SQLite file. Free hosts (Render and others) erase local files on every restart, so every property, reel and sign-up would be lost. Set DATABASE_URL to a PostgreSQL address (for example from Neon).")
        if not state["secure_secret"]: problems.append("JWT_SECRET is missing, a sample value, or shorter than 32 characters. Set a strong JWT_SECRET in backend/.env (python -c \"import secrets;print(secrets.token_urlsafe(48))\").")
        if not state["secure_password"]: problems.append("ADMIN_PASSWORD is a sample value and no new password was saved from the admin panel. Set a strong ADMIN_PASSWORD in backend/.env.")
        if problems: raise RuntimeError("Refusing to start with APP_ENV=production: "+" ".join(problems))
    else:
        for text in state["warnings"]: log.warning("SECURITY WARNING: %s",text)
