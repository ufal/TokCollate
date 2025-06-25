import logging
from typing import ClassVar

from attrs import define, field

logger = logging.getLogger(__name__)


@define(kw_only=True)
class TokEvalMetric:
    """Base class for TokEval metrics.

    Each TokEvalMetric derived class must implement the following interface, mainly the .score() method.
    Derived classes must be registered using tokeval.metrics.register_metric() decorator.
    Instances should be created using the tokeval.metrics.build_metric() method.

    Some metrics might require a reference or an input file in addition to the tokenizer output. In such cases,
    the metric should set the relevat private class attributes _has_* to True.
    TODO(varisd): is there a better way to implement this?
    """

    metric: str = field(converter=str)
    metric_label: str = field(converter=str)

    _datasets: ClassVar[dict[str, str]] = {}
    _has_reference_file: bool = False
    _has_input_file: bool = False

    def __attrs_post_init__(self) -> None:
        """"""
        if self._has_reference_file:
            self._datasets["reference"] = "reference.txt"
        if self._has_input_file:
            self._datasets["input"] = "input.txt"

    @classmethod
    def build_metric(
        cls: "TokEvalMetric",
        metric: str,
        metric_label: str,
        **kwargs,  # noqa: ANN003
    ) -> "TokEvalMetric":
        """Build a specified metric instance.

        This method can be called directly or (preferably) using the tokeval.metrics.build_metric() method.

        Args:
            metric (str): metric class identifier (registered using register_metric)
            metric_label (str): unique metric class instance identifier
            **kwargs: additional parameters for the specific metric class implementation

        Returns:
            An instance of the specified metric class.
        """
        return cls(metric=metric, metric_label=metric_label, **kwargs)

    @property
    def metric_datasets(self) -> list[tuple[str, str]]:
        """List auxilliary datasets required for the metric computation."""
        return [(d, self._datasets[d]) for d in self._datasets]

    def score(self, data: dict[str, list[list[str]]], system_label: str) -> float:
        """Implements the metric computation.

        The method receives a data representation (currently as a dict) and a label of the evaluated system.
        The metric scoring method then retrieves the system's output dataset using the system_label and (optionally)
        the auxiliary datasets (indicated by self.metric_datasets)

        Returns:
            Metric's score over the given system's output.
        """
        raise NotImplementedError()
