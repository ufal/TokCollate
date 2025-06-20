import logging

import numpy as np
from attrs import define

from tokeval.metrics import TokEvalMetric, register_metric

logger = logging.getLogger(__name__)


@register_metric("tokens_per_line")
@define(kw_only=True)
class TokensPerLineMetric(TokEvalMetric):
    """TODO."""

    def compute(
        self,
        data: dict[str, list[list[str]]],
        system_label: str,
    ) -> float:
        corpus = data[system_label]
        n_tokens = [len(line) for line in corpus]
        return np.array(n_tokens).mean()
