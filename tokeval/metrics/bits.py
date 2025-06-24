import logging

import numpy as np
from attrs import define

from tokeval.metrics import TokEvalMetric, register_metric
from tokeval.utils import get_unigram_frequencies

logger = logging.getLogger(__name__)


@register_metric("bits")
@define(kw_only=True)
class BitsMetric(TokEvalMetric):
    """TODO."""

    def score(
        self,
        data: dict[str, list[str]],
        system_label: str,
    ) -> float:
        corpus = data[system_label]
        unigram_freqs = get_unigram_frequencies(corpus)
        vocab_size = unigram_freqs.size

        return -unigram_freqs.sum() * np.log2(vocab_size)
