import numpy as np
from attrs import define
from typing import Tuple

from tokeval.metrics import TokEvalMetric, register_metric


@register_metric("token_length")
@define(kw_only=True)
class TokenLengthMetric(TokEvalMetric):
    """Compute the average number of utf-8 characters per token."""

    def score(
        self,
        data: dict[str, list[str]],
        system_label: str,
    ) -> Tuple[float, float]:
        text = data[system_label]
        token_lengths = np.array([len(tok) for line in text for tok in line])
        return (token_lengths.mean(), token_lengths.var())
