import numpy as np
from attrs import define, field

from tokcollate.data import TokCollateData
from tokcollate.metrics import TokCollateMetric, register_metric

from .tokcollate_metric import AggMode


@register_metric("sequence_length")
@define(kw_only=True)
class SequenceLengthMetric(TokCollateMetric):
    """Computes the average sequence length in the terms of tokens per line."""

    aggregation: AggMode = field(converter=AggMode, default=AggMode.MEAN)
    use_bytes: bool = field(default=False)

    def score(
        self,
        data: TokCollateData,
        system_label: str,
        language: str,
    ) -> float:
        text = data.get_system_text(system_label=system_label, language=language)
        if self.use_bytes:
            seq_length = np.array([sum(len(tok.encode("utf-8")) for tok in line) for line in text])
        else:
            seq_length = np.array([len(line) for line in text])
        return self._aggregate_scores(seq_length)
