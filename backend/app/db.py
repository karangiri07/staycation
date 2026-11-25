from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import settings
IS_SQLITE = settings.database_url.startswith("sqlite")
if IS_SQLITE:
    engine = create_engine(settings.database_url, connect_args={"check_same_thread": False}, pool_pre_ping=True)
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record):
        # WAL lets readers and one writer work at the same time, so a long list never blocks a save.
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL"); cursor.execute("PRAGMA synchronous=NORMAL"); cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()
else:
    engine = create_engine(settings.database_url, pool_pre_ping=True, pool_size=10, max_overflow=20, pool_recycle=1800)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
class Base(DeclarativeBase): pass
def get_db():
    db=SessionLocal()
    try: yield db
    finally: db.close()
