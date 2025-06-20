import logging
import numpy as np

from attrs import define, field

from tokeval.metrics import TokEvalMetric, register_metric
from tokeval.utils import get_unigram_distribution, shannon_entropy

logger = logging.getLogger(__name__)


@register_metric("renyi_entropy")
@define(kw_only=True)
class RenyiEntropyMetric(TokEvalMetric):
    """TODO."""

    power: float = field(default=3.0)

    def compute(
        self,
        data: dict[str, list[str]],
        system_label: str,
    ) -> float:
        corpus = data[system_label]
        if self.power == 1.0:
            return shannon_entropy(corpus)

        unigram_probs = get_unigram_distribution(corpus)
        scale = 1 / (1 - self.power)
        return scale * np.log2(np.sum(unigram_probs ** self.power))
