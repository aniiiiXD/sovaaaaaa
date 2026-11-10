"""Read SOVA's prepared ContractNLI dataset without leaking answer labels."""

from .loader import (
    ContractNLILoader,
    DatasetIntegrityError,
    DecisionExample,
    EvidenceSpan,
    GoldTarget,
    ModelInput,
    SplitAudit,
)

__all__ = [
    "ContractNLILoader", "DatasetIntegrityError", "DecisionExample", "EvidenceSpan",
    "GoldTarget", "ModelInput", "SplitAudit",
]
