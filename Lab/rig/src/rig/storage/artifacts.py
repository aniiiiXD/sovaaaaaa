from hashlib import sha256
import json
from pathlib import Path

from rig.errors import Conflict, RigError


class Artifacts:
    def __init__(self, root: Path):
        self.root = root.resolve()

    def path(self, relative: str) -> Path:
        path = (self.root / relative).resolve()
        if not path.is_relative_to(self.root):
            raise RigError("Artifact path escapes Rig storage")
        return path

    def write_json(self, relative: str, value) -> str:
        return self.write(relative, json.dumps(value, ensure_ascii=False, sort_keys=True,
                                               indent=2, allow_nan=False).encode())

    def write_jsonl(self, relative: str, rows: list[dict]) -> str:
        content = "".join(json.dumps(row, ensure_ascii=False, sort_keys=True,
                                     allow_nan=False) + "\n" for row in rows)
        return self.write(relative, content.encode())

    def write(self, relative: str, content: bytes) -> str:
        target = self.path(relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            with target.open("xb") as handle:
                handle.write(content)
        except FileExistsError as exc:
            raise Conflict("Artifacts are immutable; create a new version") from exc
        return sha256(content).hexdigest()

    def read_jsonl(self, relative: str, digest: str | None = None) -> list[dict]:
        content = self.path(relative).read_bytes()
        if digest is not None and sha256(content).hexdigest() != digest:
            raise Conflict("Dataset artifact was modified after registration")
        return [json.loads(line) for line in content.splitlines() if line.strip()]
