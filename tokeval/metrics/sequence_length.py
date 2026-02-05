import numpy as np
from attrs import define, field

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMetric, register_metric

from .tokeval_metric import EvalMode


@register_metric("sequence_length")
@define(kw_only=True)
class SequenceLengthMetric(TokEvalMetric):
    """Computes the average sequence length in the terms of tokens per line."""

    negate_output: bool = field(default=True)  # negate output so higher is better
    mode: EvalMode = field(converter=EvalMode, default=EvalMode.MEAN)

    def score(
        self,
        data: TokEvalData,
        system_label: str,
        language: str,
    ) -> float:
        text = data.get_system_text(system_label=system_label, language=language)
        seq_length = np.array([len(line) for line in text])
        res = self._aggregate_scores(seq_length)
        if self.negate_output:
            return -res
        return res

    def _aggregate_scores(self, scores: np.ndarray) -> float:
        if self.mode == EvalMode.MEAN:
            return scores.mean()
        if self.mode == EvalMode.VAR:
            return scores.var()
        if self.mode == EvalMode.SUM:
            return scores.sum()
        err_msg = f"Unknown metric mode: {self.mode}"
        raise ValueError(err_msg)
