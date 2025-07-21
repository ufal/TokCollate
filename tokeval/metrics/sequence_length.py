import numpy as np
from attrs import define, field

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMetric, register_metric


@register_metric("sequence_length")
@define(kw_only=True)
class SequenceLengthMetric(TokEvalMetric):
    """Computes the average sequence length in the terms of tokens per line."""

    negate_output: bool = field(default=True)  # negate output so higher is better

    def score(
        self,
        data: TokEvalData,
        system_label: str,
    ) -> tuple[float, float]:
        text = data.get_system_text(system_label=system_label)
        seq_length = np.array([len(line) for line in text])
        res = self._aggregate_scores(seq_length)
        if self.negate_output:
            return -res
        return res
