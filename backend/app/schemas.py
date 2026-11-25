import re
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator
EMAIL_RE=re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
def _empty_or_http(value:str|None,what:str):
    # Links must be empty (meaning "reset") or a real web address; javascript: and data: links are refused.
    if value is None: return value
    value=value.strip()
    if value and not re.match(r"^https?://\S+$",value,re.I): raise ValueError(f"{what} must start with http:// or https://")
    return value
class Login(BaseModel): username:str=Field(min_length=1,max_length=80); password:str=Field(min_length=1,max_length=256)
class PasswordChange(BaseModel): current_password:str=Field(max_length=256); new_password:str=Field(max_length=256)
class TokenOut(BaseModel): access_token:str; token_type:str="bearer"; expires_in:int
class PasswordChanged(TokenOut): ok:bool=True
class OkOut(BaseModel): ok:bool=True
class ImageIn(BaseModel):
    url:str=Field(min_length=1,max_length=2000); public_id:str=Field(default="",max_length=255)
    @field_validator("url")
    @classmethod
    def _url(cls,v):
        v=_empty_or_http(v,"Photo link")
        if not v: raise ValueError("Photo link is required")
        return v
class ImageOut(ImageIn): model_config=ConfigDict(from_attributes=True); id:int
class PropertyIn(BaseModel):
    name:str=Field(min_length=2,max_length=160); category:str=Field(pattern="^(Villa|Farmhouse|Resort)$"); location:str=Field(min_length=2,max_length=180); price:str=Field(min_length=1,max_length=60); original_price:str=Field(default="",max_length=60); tag:str=Field(default="",max_length=80); description:str=Field(default="",max_length=5000); image_url:str=Field(default="",max_length=2000); image_public_id:str=Field(default="",max_length=255); published:bool=True; images:list[ImageIn]=Field(default_factory=list,max_length=30)
class PropertyOut(PropertyIn): model_config=ConfigDict(from_attributes=True); id:int; images:list[ImageOut]=Field(default_factory=list)
class PropertyPatch(BaseModel): published:bool
class PropertyLite(BaseModel): id:int; name:str; category:str; location:str; price:str; original_price:str=""; tag:str=""; published:bool; image_url:str=""; photo_count:int=0
class ConfigIn(BaseModel): whatsapp_number:str=Field(min_length=8,max_length=20,pattern="^[0-9+() -]+$")
class ConfigOut(BaseModel): whatsapp_number:str
class ReelIn(BaseModel): title:str=Field(min_length=2,max_length=160); published:bool=False
class ReelPatch(BaseModel): title:str|None=Field(default=None,min_length=2,max_length=160); published:bool|None=None
class ReelOut(BaseModel): id:int; title:str; video_url:str; published:bool
class ReelAdminOut(ReelOut): views:int=0; duration:int=0
class CreatorIn(BaseModel):
    # Every field is optional: only the ones sent are saved, and an empty string resets that field to the site default.
    name:str|None=Field(default=None,max_length=60); headline:str|None=Field(default=None,max_length=80); bio:str|None=Field(default=None,max_length=500)
    photo:str|None=Field(default=None,max_length=2000); instagram_url:str|None=Field(default=None,max_length=300); youtube_url:str|None=Field(default=None,max_length=300)
    email:str|None=Field(default=None,max_length=254); stat_instagram:str|None=Field(default=None,max_length=20); stat_youtube:str|None=Field(default=None,max_length=20); stat_views:str|None=Field(default=None,max_length=20)
    @field_validator("photo")
    @classmethod
    def _photo(cls,v): return _empty_or_http(v,"Photo link")
    @field_validator("instagram_url")
    @classmethod
    def _ig(cls,v): return _empty_or_http(v,"Instagram link")
    @field_validator("youtube_url")
    @classmethod
    def _yt(cls,v): return _empty_or_http(v,"YouTube link")
    @field_validator("email")
    @classmethod
    def _email(cls,v):
        if v is None: return v
        v=v.strip()
        if v and not EMAIL_RE.match(v): raise ValueError("must be a valid email address, for example hello@example.com")
        return v
class SubscribeIn(BaseModel): email:str=Field(min_length=5,max_length=254,pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
class SubscriberOut(BaseModel): model_config=ConfigDict(from_attributes=True); id:int; email:str; created_at:datetime
# ---------- admin list pages and dashboard ----------
class _Page(BaseModel): total:int; page:int; page_size:int; pages:int
class PropertyPage(_Page): items:list[PropertyLite]
class ReelPage(_Page): items:list[ReelAdminOut]
class SubscriberPage(_Page): items:list[SubscriberOut]
class DbStatus(BaseModel): ok:bool; kind:str
class StatusOut(BaseModel): api_version:int=2; database:DbStatus; cloudinary:bool; whatsapp_set:bool; secure_secret:bool; secure_password:bool; app_env:str; warnings:list[str]; errors_24h:int; server_time:str
class Counts(BaseModel): total:int; published:int; draft:int
class ReelCounts(Counts): views:int=0
class SubCounts(BaseModel): total:int; today:int; week:int
class DayCount(BaseModel): date:str; count:int
class EnquiryProperty(BaseModel): id:int; name:str; week:int; total:int
class EnquiryStats(BaseModel): total:int; today:int; week:int; by_day:list[DayCount]; properties:list[EnquiryProperty]
class StatsOut(BaseModel): properties:Counts; reels:ReelCounts; subscribers:SubCounts; signups_by_day:list[DayCount]; recent_subscribers:list[SubscriberOut]; enquiries:EnquiryStats|None=None
class ErrorItem(BaseModel): model_config=ConfigDict(from_attributes=True); id:int; created_at:datetime; method:str; path:str; message:str
class ErrorList(BaseModel): items:list[ErrorItem]; total:int
