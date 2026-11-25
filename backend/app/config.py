from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
# Values that ship in .env.example or in the code. They are public knowledge, so they are never safe on a live site.
INSECURE_SECRETS = {"development-only-change-me", "replace-with-a-long-random-secret"}
INSECURE_PASSWORDS = {"change-me-now", "replace-before-deploy"}
def postgres_url(value: str) -> str:
    # Neon, Render and Heroku give "postgres://..." or "postgresql://...". This app uses the psycopg 3 driver, so the address must say so.
    value = (value or "").strip()
    for start in ("postgres://", "postgresql://"):
        if value.startswith(start): return "postgresql+psycopg://" + value[len(start):]
    return value
class Settings(BaseSettings):
    database_url: str = "sqlite:///./staycation.db"
    jwt_secret: str = "development-only-change-me"
    jwt_expire_minutes: int = 60
    admin_username: str = "admin"
    admin_password: str = "change-me-now"
    cors_origins: str = "http://localhost:5173"
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    # Set APP_ENV=production on the live server: weak secrets then stop the server from starting and /docs is hidden.
    app_env: str = "development"
    # True when a proxy (Render, Nginx, Cloudflare) sits in front of the API and sets X-Forwarded-For. False when exposed directly.
    trust_proxy: bool = True
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    @field_validator("database_url")
    @classmethod
    def _database_driver(cls, value): return postgres_url(value)
    @property
    def origins(self): return [x.strip() for x in self.cors_origins.split(",") if x.strip()]
    @property
    def is_production(self): return self.app_env.strip().lower() in {"production", "prod"}
settings = Settings()
