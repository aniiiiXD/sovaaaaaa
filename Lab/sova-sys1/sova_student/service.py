"""Local-only HTTP interface for a saved SOVA student decision model."""

from __future__ import annotations

import argparse
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from sova_data import ModelInput
from sova_data.loader import LABELS
from sova_model import ContextTooLongError


class DecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contract: str = Field(min_length=1)
    statement: str = Field(min_length=1)

    @field_validator("contract", "statement")
    @classmethod
    def non_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value


def create_app(scorer) -> FastAPI:
    app = FastAPI(title="SOVA legal decision demo", version="0.1.0")

    @app.get("/health")
    def health() -> dict:
        return {"status": "ready"}

    @app.post("/v1/decisions")
    def decide(request: DecisionRequest) -> dict:
        try:
            result = scorer.score(ModelInput(request.contract, request.statement, LABELS))
        except ContextTooLongError as exc:
            raise HTTPException(status_code=413, detail="The full contract and statement exceed the model context limit") from exc
        return {"decision": result.predicted_label, "scores": result.probabilities,
                "calibrated": False, "input_tokens": result.input_tokens}

    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve a saved SOVA student on localhost")
    parser.add_argument("model_dir", type=Path)
    parser.add_argument("tokenizer_dir", type=Path)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    import uvicorn
    from transformers import AutoTokenizer
    from .artifacts import load_saved_student
    from .inference import StudentScorer

    tokenizer = AutoTokenizer.from_pretrained(args.tokenizer_dir, local_files_only=True, trust_remote_code=False)
    model, metadata = load_saved_student(args.model_dir, device="cuda")
    scorer = StudentScorer(model, tokenizer, device="cuda", max_input_tokens=metadata["student_max_input_tokens"])
    uvicorn.run(create_app(scorer), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
