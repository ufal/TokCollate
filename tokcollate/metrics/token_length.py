import numpy as np
from attrs import define, field

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMetric, register_metric

from .tokeval_metric import EvalMode


@register_metric("token_length")
@define(kw_only=True)
class TokenLengthMetric(TokEvalMetric):
    """Compute the average number of utf-8 characters per token."""

    mode: EvalMode = field(converter=EvalMode, default=EvalMode.MEAN)

    def score(
        self,
        data: TokEvalData,
        system_label: str,
        language: str,
    ) -> float:
        text = data.get_system_text(system_label=system_label, language=language)
        token_lengths = np.array([len(tok) for line in text for tok in line])
        return self._aggregate_scores(token_lengths)

    def _aggregate_scores(self, scores: np.ndarray) -> float:
        if self.mode == EvalMode.MEAN:
            return scores.mean()
        if self.mode == EvalMode.VAR:
            return scores.var()
        if self.mode == EvalMode.SUM:
            return scores.sum()
        err_msg = f"Unknown metric mode: {self.mode}"
        raise ValueError(err_msg)
