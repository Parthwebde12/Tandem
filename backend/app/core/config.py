from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    cors_origins: str = ""
    # Demo mode: anyone may sign up and pick a team and role. Keep OFF for real use.
    open_signup: bool = False


settings = Settings()