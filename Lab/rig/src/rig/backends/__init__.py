"""Backend registry. Optional ML dependencies are imported only on execution."""

from rig.backends.mlx import MLXBackend
from rig.config import Settings
from rig.errors import RigError
from rig.storage.artifacts import Artifacts


def build_backend(name: str, settings: Settings, artifacts: Artifacts):
    factories = {"mlx": MLXBackend}
    if name not in factories:
        raise RigError(f"Unsupported backend: {name}")
    return factories[name](settings, artifacts)
