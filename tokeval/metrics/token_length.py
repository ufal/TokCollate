import numpy as np
from attrs import define

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMetric, register_metric


@register_metric("token_length")
@define(kw_only=True)
class TokenLengthMetric(TokEvalMetric):
    """Compute the average number of utf-8 characters per token."""

    def score(
        self,
        data: TokEvalData,
        system_label: str,
    ) -> tuple[float, float]:
        text = data.get_system_text(system_label=system_label)
        token_lengths = np.array([len(tok) for line in text for tok in line])
        return self._aggregate_scores(token_lengths)
