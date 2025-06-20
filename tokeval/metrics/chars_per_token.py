import logging

import numpy as np
from attrs import define

from tokeval.metrics import TokEvalMetric, register_metric

logger = logging.getLogger(__name__)


@register_metric("chars_per_token")
@define(kw_only=True)
class CharsPerTokenMetric(TokEvalMetric):
    """TODO."""

    def compute(
        self,
        data: dict[str, list[str]],
        system_label: str,
    ) -> float:
        corpus = data[system_label]
        n_chars = [len(token) for line in corpus for token in line]
        return np.array(n_chars).mean()
