import numpy as np
from attrs import define

from tokcollate.data import TokCollateData
from tokcollate.metrics import TokCollateMetric, register_metric
from tokcollate.utils import get_unigram_frequencies


@register_metric("bits")
@define(kw_only=True)
class BitsMetric(TokCollateMetric):
    """Computes the bits of the given vocabulary unigram distribution.

    Based on the code from https://github.com/zouharvi/tokenization-scorer/blob/main/tokenization_scorer/metrics.py#L48
    """

    def score(
        self,
        data: TokCollateData,
        system_label: str,
        language: str,
    ) -> float:
        text = data.get_system_text(system_label=system_label, language=language)
        unigram_freqs = get_unigram_frequencies(text)
        vocab_size = unigram_freqs.size
        return unigram_freqs.sum() * np.log2(vocab_size)
