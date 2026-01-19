import numpy as np
from attrs import define, field

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMetric, register_metric
from tokeval.utils import get_unigram_frequencies


@register_metric("bits")
@define(kw_only=True)
class BitsMetric(TokEvalMetric):
    """Computes the bits of the given vocabulary unigram distribution.

    Based on the code from https://github.com/zouharvi/tokenization-scorer/blob/main/tokenization_scorer/metrics.py#L48
    """

    negate_output: bool = field(default=True)  # negate output so higher is better

    def score(
        self,
        data: TokEvalData,
        system_label: str,
        language: str,
    ) -> float:
        text = data.get_system_text(system_label=system_label, language=language)
        unigram_freqs = get_unigram_frequencies(text)
        vocab_size = unigram_freqs.size
        res = unigram_freqs.sum() * np.log2(vocab_size)
        if self.negate_output:
            return -res
        return res
