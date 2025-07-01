import numpy as np
from attrs import define
from typing import Tuple

from tokeval.metrics import TokEvalMetric, register_metric


@register_metric("sequence_ratio")
@define(kw_only=True)
class SequenceRatioMetric(TokEvalMetric):
    """Compute the sequence length ratio between two tokenizer outputs."""

    def score(
        self,
        data: dict[str, list[str]],
        system_label_1: str,
        system_label_2: str,
    ) -> Tuple[float, float]:
        text_1 = data[system_label_1]
        text_2 = data[system_label_2]
        ratios = np.array([len(line_1) / len(line_2) for line_1, line_2 in zip(text_1, text_2)])
        return (ratios.mean(), ratios.var())
