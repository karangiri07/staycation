from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base
class Property(Base):
    __tablename__="properties"
    id:Mapped[int]=mapped_column(Integer,primary_key=True)
    name:Mapped[str]=mapped_column(String(160),nullable=False)
    category:Mapped[str]=mapped_column(String(30),nullable=False,index=True)
    location:Mapped[str]=mapped_column(String(180),nullable=False)
    price:Mapped[str]=mapped_column(String(60),nullable=False)
    tag:Mapped[str]=mapped_column(String(80),default="")
    description:Mapped[str]=mapped_column(Text,default="")
    image_url:Mapped[str]=mapped_column(Text,default="")
    image_public_id:Mapped[str]=mapped_column(String(255),default="")
    original_price:Mapped[str]=mapped_column(String(60),default="",server_default="")
    published:Mapped[bool]=mapped_column(Boolean,default=True,index=True)
    images:Mapped[list["PropertyImage"]]=relationship(back_populates="property",cascade="all, delete-orphan",order_by="PropertyImage.position",lazy="selectin")
class PropertyImage(Base):
    __tablename__="property_images"
    id:Mapped[int]=mapped_column(Integer,primary_key=True)
    property_id:Mapped[int]=mapped_column(Integer,ForeignKey("properties.id",ondelete="CASCADE"),index=True,nullable=False)
    url:Mapped[str]=mapped_column(Text,nullable=False)
    public_id:Mapped[str]=mapped_column(String(255),default="")
    position:Mapped[int]=mapped_column(Integer,default=0)
    property:Mapped["Property"]=relationship(back_populates="images")
class Reel(Base):
    __tablename__="reels"
    id:Mapped[int]=mapped_column(Integer,primary_key=True)
    title:Mapped[str]=mapped_column(String(160),nullable=False)
    video_url:Mapped[str]=mapped_column(Text,nullable=False)
    public_id:Mapped[str]=mapped_column(String(255),default="")
    published:Mapped[bool]=mapped_column(Boolean,default=False,index=True)
    views:Mapped[int]=mapped_column(Integer,default=0,server_default="0",nullable=False)  # plays counted from the public website
    duration:Mapped[int]=mapped_column(Integer,default=0,server_default="0",nullable=False)  # seconds, read from Cloudinary at upload
class Setting(Base):
    __tablename__="settings"
    key:Mapped[str]=mapped_column(String(80),primary_key=True)
    value:Mapped[str]=mapped_column(Text,default="")
def _now(): return datetime.now(timezone.utc)
class Subscriber(Base):
    __tablename__="subscribers"
    id:Mapped[int]=mapped_column(Integer,primary_key=True)
    email:Mapped[str]=mapped_column(String(254),unique=True,index=True,nullable=False)
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=_now,index=True)
class LoginAttempt(Base):
    # One row per wrong password. Used to block an IP after 5 failures in 15 minutes (works across restarts and workers).
    __tablename__="login_attempts"
    __table_args__=(Index("ix_login_attempts_ip_created_at","ip","created_at"),)
    id:Mapped[int]=mapped_column(Integer,primary_key=True)
    ip:Mapped[str]=mapped_column(String(64),nullable=False)
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=_now,index=True)
class ErrorLog(Base):
    # Latest server errors, shown in the admin panel under Settings > Recent errors (newest 200 are kept).
    __tablename__="error_logs"
    id:Mapped[int]=mapped_column(Integer,primary_key=True)
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=_now,index=True)
    method:Mapped[str]=mapped_column(String(10),default="")
    path:Mapped[str]=mapped_column(String(300),default="")
    message:Mapped[str]=mapped_column(String(500),default="")
class EnquiryClick(Base):
    # One row each time a visitor taps WhatsApp on a property (at most one per visitor per property every 10 minutes). Shown in the admin dashboard.
    __tablename__="enquiry_clicks"
    __table_args__=(Index("ix_enquiry_clicks_property_id_created_at","property_id","created_at"),)
    id:Mapped[int]=mapped_column(Integer,primary_key=True)
    property_id:Mapped[int]=mapped_column(Integer,ForeignKey("properties.id",ondelete="CASCADE"),nullable=False)
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=_now,index=True)
