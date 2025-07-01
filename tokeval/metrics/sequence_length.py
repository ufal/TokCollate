import numpy as np
from attrs import define, field
from typing import Tuple

from tokeval.metrics import TokEvalMetric, register_metric


@register_metric("sequence_length")
@define(kw_only=True)
class SequenceLengthMetric(TokEvalMetric):
    """Computes the average sequence length in the terms of tokens per line."""

    negate_output: bool = field(default=True)  # negate output so higher is better

    def score(
        self,
        data: dict[str, list[list[str]]],
        system_label: str,
    ) -> Tuple[float, float]:
        text = data[system_label]
        seq_length = np.array([len(line) for line in text])
        if self.negate_output:
            return (-seq_length.mean(), seq_length.var())
        return (seq_length.mean(), seq_length.var())
