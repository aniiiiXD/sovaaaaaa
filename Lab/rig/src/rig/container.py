from rig.backends import build_backend
from rig.config import Settings
from rig.data.service import DatasetService
from rig.evaluation.service import EvaluationService
from rig.optimization.service import OptimizationService
from rig.pipeline.service import PipelineService
from rig.serving.service import ServingService
from rig.storage.artifacts import Artifacts
from rig.storage.repository import Repository
from rig.training.service import CandidateService, TrainingService


class Container:
    """Composition root. Nothing initializes a database or loads a model on import."""

    def __init__(self, settings: Settings, backend=None):
        self.settings = settings
        self.repository = Repository(settings.database)
        self.artifacts = Artifacts(settings.home / "artifacts")
        self.backend = backend if backend is not None else build_backend("mlx", settings, self.artifacts)
        self.datasets = DatasetService(self.repository, self.artifacts)
        self.candidates = CandidateService(self.repository, self.artifacts)
        self.training = TrainingService(self.datasets, self.candidates, self.backend, self.artifacts)
        self.evaluations = EvaluationService(self.repository, self.artifacts, self.datasets,
                                             self.candidates, self.backend)
        self.optimization = OptimizationService(self.candidates, self.evaluations,
                                                self.backend, self.artifacts)
        self.pipeline = PipelineService(self.training, self.evaluations, self.optimization)
        self.serving = ServingService(settings, self.repository, self.candidates,
                                      self.evaluations, self.backend)

    def initialize(self) -> None:
        self.repository.initialize()
