import numpy as np
from attrs import define, field

from tokeval.metrics import TokEvalMetric, register_metric


@define(kw_only=True)
class FooMetric(TokEvalMetric):
    """Mock metric used for testing."""
    metric: str = "foo_metric"
    metric_label: str = "foo_metric_label"
    has_input: bool = False
    has_reference: bool = False

    def __attrs_post_init__(self) -> None:
        self._requires_input_text = self.has_input
        self._requires_reference_text = self.has_reference

    def score(self, data: dict[str, list[list[str]]], system_label: str) -> tuple[float, float]:
        pass
