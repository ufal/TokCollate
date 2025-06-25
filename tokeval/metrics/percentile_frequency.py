import logging

import numpy as np
from attrs import define, field

from tokeval.metrics import TokEvalMetric, register_metric
from tokeval.utils import get_unigram_distribution

logger = logging.getLogger(__name__)


@register_metric("percentile_frequency")
@define(kw_only=True)
class PercentileFrequencyMetric(TokEvalMetric):
    """Computes the percentile frequency from `Zouhar et al., 2023, Tokenization and the Noiseless Channel`.

    Args:
        gamma_1 (float): top `gamma_1` percentile cutoff
        gamma_2 (float): bottom `gamma_2` percentile cutoff
    """

    gamma_1: float = field(default=0.03)
    gamma_2: float = field(default=0.83)

    def score(
        self,
        data: dict[str, list[str]],
        system_label: str,
    ) -> float:
        corpus = data[system_label]
        unigram_probs = get_unigram_distribution(corpus)

        gamma_1_val = np.percentile(unigram_probs, self.gamma_1)
        gamma_2_val = np.percentile(unigram_probs, self.gamma_2)

        return (unigram_probs * (unigram_probs >= gamma_1_val) * (unigram_probs * gamma_2_val)).sum()
