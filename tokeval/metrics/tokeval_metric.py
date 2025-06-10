import logging
from attrs import define, field
from typing import Dict, List

logger = logging.getLogger(__name__)


@define(kw_only=True)
class TokEvalMetric:
    """Base class for TokEval metrics."""

    metric: str = field(converter=str)
    metric_label: str = field(converter=str)

    _datasets: dict = {}

    @classmethod
    def build_metric(
        cls: "TokEvalMetric", metric: str, metric_label: str, **kwargs
    ) -> "TokEvalMetric":  # noqa: ANN003
        """Build a specified metric instance.

        TODO: ...

        Args:
            TODO
            **kwargs: additional parameters for the specific metric class implementation

        Returns:
            An instance of the specified metric class.
        """
        return cls(metric=metric, metric_label=metric_label, **kwargs)

    @classmethod
    def list_datasets(cls: "TokEvalMetric") -> List[str]:
        """List auxilliary datasets required for the metric computation."""
        return [self._datasets.keys()]

    def get_dataset_filename(self, system: str, dataset: str) -> str:
        """Return a default dataset filename for the specified metric's dataset."""
        return self._datasets[dataset]

    def compute(self, data: Dict[str, List[str]], system_label: str) -> float:
        """Implements the metric computation.

        TODO
        """
        raise NotImplementedError()
