import numpy as np
from attrs import define, field

from tokcollate.data import TokCollateData
from tokcollate.metrics import TokCollateMetric, register_metric

from .tokcollate_metric import AggMode


@register_metric("token_length")
@define(kw_only=True)
class TokenLengthMetric(TokCollateMetric):
    """Compute the average number of utf-8 characters per token."""

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
            token_lengths = np.array([len(tok.encode("utf-8")) for line in text for tok in line])
        else:
            token_lengths = np.array([len(tok) for line in text for tok in line])
        return self._aggregate_scores(token_lengths)
