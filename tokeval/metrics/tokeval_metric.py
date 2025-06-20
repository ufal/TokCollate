import logging
from typing import ClassVar

from attrs import define, field

logger = logging.getLogger(__name__)


@define(kw_only=True)
class TokEvalMetric:
    """Base class for TokEval metrics."""

    metric: str = field(converter=str)
    metric_label: str = field(converter=str)

    _datasets: ClassVar[dict[str, str]] = {}
    _has_reference_file: bool = False
    _has_input_file: bool = False

    def __attrs_post_init__(self) -> None:
        """TODO"""
        if self._has_reference_file:
            self.metric_datasets["reference"] = "reference.txt"
        if self._has_input_file:
            self.metric_datasts["input"] = "input.txt"

    @classmethod
    def build_metric(
        cls: "TokEvalMetric",
        metric: str,
        metric_label: str,
        **kwargs,  # noqa: ANN003
    ) -> "TokEvalMetric":
        """Build a specified metric instance.

        TODO: ...

        Args:
            TODO
            **kwargs: additional parameters for the specific metric class implementation

        Returns:
            An instance of the specified metric class.
        """
        return cls(metric=metric, metric_label=metric_label, **kwargs)

    @property
    def metric_datasets(self) -> list[tuple[str, str]]:
        """List auxilliary datasets required for the metric computation."""
        return [(d, self._datasets[d]) for d in self._datasets]

    def compute(self, data: dict[str, list[list[str]]], system_label: str) -> float:
        """Implements the metric computation.

        TODO
        """
        raise NotImplementedError()
