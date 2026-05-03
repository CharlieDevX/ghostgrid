import os
from pathlib import Path


def _resolve() -> Path:
    env = os.getenv("GHOSTGRID_DATA_DIR")
    if env:
        return Path(env).expanduser()

    legacy = Path(__file__).parent / "data"
    if legacy.exists():
        return legacy

    xdg = os.getenv("XDG_DATA_HOME")
    base = Path(xdg) if xdg else Path.home() / ".local" / "share"
    target = base / "ghostgrid"
    target.mkdir(parents=True, exist_ok=True)
    return target


DATA_DIR = _resolve()
