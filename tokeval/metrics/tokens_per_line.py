import logging

import numpy as np
from attrs import define, field

from tokeval.metrics import TokEvalMetric, register_metric

logger = logging.getLogger(__name__)


@register_metric("tokens_per_line")
@define(kw_only=True)
class TokensPerLineMetric(TokEvalMetric):
    """Computes the average sequence length in the terms of tokens per line."""

    negate_output: bool = field(default=True)  # negate output so higher is better

    def score(
        self,
        data: dict[str, list[list[str]]],
        system_label: str,
    ) -> float:
        corpus = data[system_label]
        n_tokens = [len(line) for line in corpus]
        res = np.array(n_tokens).mean()
        if self.negate_output:
            return -res
        return res
