import logging

from attrs import define

from tokeval.metrics import TokEvalMetric, register_metric
from tokeval.utils import shannon_entropy

logger = logging.getLogger(__name__)


@register_metric("shannon_entropy")
@define(kw_only=True)
class ShannonEntropyMetric(TokEvalMetric):
    """TODO."""

    def compute(
        self,
        data: dict[str, list[str]],
        system_label: str,
    ) -> float:
        corpus = data[system_label]
        return shannon_entropy(corpus)
