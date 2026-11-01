from pathlib import Path
import sys

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RIG_", extra="ignore")

    home: Path = Path(__file__).resolve().parents[2] / ".rig"
    api_token: SecretStr | None = None
    execution_enabled: bool = False
    allow_downloads: bool = False
    model_import_root: Path | None = None
    max_model_import_bytes: int = Field(default=100_000_000_000, ge=1)
    store_content: bool = False
    host: str = "127.0.0.1"
    port: int = Field(default=8787, ge=1, le=65535)
    mlx_python: Path = Path(sys.executable)
    max_body_bytes: int = Field(default=20_000_000, ge=1024)
    device_wait_seconds: float = Field(default=30, gt=0)
    job_timeout_seconds: int = Field(default=14400, ge=1)
    generation_timeout_seconds: int = Field(default=120, ge=1)

    @property
    def database(self) -> Path:
        return self.home / "rig.sqlite3"
