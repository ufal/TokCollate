import numpy as np
from attrs import define, field

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMetric, register_metric
from tokeval.utils import get_unigram_distribution


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
        data: TokEvalData,
        system_label: str,
        language: str,
    ) -> float:
        text = data.get_system_text(system_label=system_label, language=language)
        unigram_probs = get_unigram_distribution(text)

        gamma_1_val = np.percentile(unigram_probs, self.gamma_1)
        gamma_2_val = np.percentile(unigram_probs, self.gamma_2)

        return (unigram_probs * (unigram_probs >= gamma_1_val) * (unigram_probs * gamma_2_val)).sum()
