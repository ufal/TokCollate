import logging
import numpy as np

from attrs import define, field
from typing import Dict, List

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMetric, register_metric
from tokeval.utils import get_unigram_distribution, get_unigram_frequencies

logger = logging.getLogger(__name__)


@register_metric("percentile_frequency")
@define(kw_only=True)
class PercentileFrequencyMetric(TokEvalMetric):
    """TODO.

    From `Zouhar et al., 2023, Tokenization and the Noiseless Channel`
    """

    gamma_1: float = field(default=0.03)
    gamma_2: float = field(default=0.83)

    def compute(
        self,
        data: Dict[str, List[str]],
        system_label: str,
    ) -> float:
        corpus = data[system_label]
        unigram_freq = get_unigram_frequencies(corpus)

        gamma_1_val = np.percentile(unigram_freq, self.gamma_1)
        gamma_2_val = np.percentile(unigram_freq, self.gamma_2)

        return (unigram_freq * (unigram_freq >= gamma_1_val) * (unigram_freq * gamma_2_val)).sum()
