import cloudinary, cloudinary.uploader
from fastapi import HTTPException, UploadFile
from .config import settings
IMAGE_LIMIT=10*1024*1024; VIDEO_LIMIT=100*1024*1024
IMAGE_TYPES={"image/jpeg","image/png","image/webp","image/avif"}; VIDEO_TYPES={"video/mp4","video/quicktime","video/webm"}
NOT_IMAGE="That file does not look like a real photo. Use JPG, PNG, WebP or AVIF."
NOT_VIDEO="That file does not look like a real video. Use MP4, MOV or WebM."
def cloud_ready()->bool: return bool(settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret)
def cloud_config(): return {"cloud_name":settings.cloudinary_cloud_name,"api_key":settings.cloudinary_api_key,"api_secret":settings.cloudinary_api_secret}
def delete_media(pid):
    if pid and cloud_ready():
        cloudinary.config(**cloud_config()); cloudinary.uploader.destroy(pid,invalidate=True)
def sniff(head:bytes,resource_type:str)->bool:
    # The browser-supplied content type can be faked, so the first bytes of the file must also look like a real photo or video.
    if resource_type=="image":
        return head.startswith(b"\xff\xd8\xff") or head.startswith(b"\x89PNG\r\n\x1a\n") or (head[:4]==b"RIFF" and head[8:12]==b"WEBP") or (head[4:8]==b"ftyp" and head[8:12] in (b"avif",b"avis"))
    return head[4:8] in (b"ftyp",b"moov",b"mdat",b"wide",b"free") or head.startswith(b"\x1a\x45\xdf\xa3")
def real_size(handle)->int:
    # file.size can be missing for chunked uploads, so measure the stored file itself.
    position=handle.tell(); handle.seek(0,2); size=handle.tell(); handle.seek(position); return size
def upload_media(file:UploadFile,resource_type:str):
    if not cloud_ready(): raise HTTPException(503,"Cloudinary is not set up: add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to backend/.env and restart the backend.")
    image=resource_type=="image"; handle=file.file
    size=real_size(handle)
    if size==0: raise HTTPException(400,"The file is empty. Choose the photo or video again.")
    if size>(IMAGE_LIMIT if image else VIDEO_LIMIT): raise HTTPException(413,"That photo is larger than 10 MB. Resize it and try again." if image else "That video is larger than 100 MB. Compress it and try again.")
    head=handle.read(16); handle.seek(0)
    if file.content_type not in (IMAGE_TYPES if image else VIDEO_TYPES) or not sniff(head,resource_type): raise HTTPException(415,NOT_IMAGE if image else NOT_VIDEO)
    cloudinary.config(**cloud_config())
    try: return cloudinary.uploader.upload(file.file,resource_type=resource_type,folder=f"staycation/{resource_type}")
    except Exception: raise HTTPException(502,"Cloudinary rejected the upload. Check the three CLOUDINARY_* values in backend/.env and the internet connection, then try again.")
