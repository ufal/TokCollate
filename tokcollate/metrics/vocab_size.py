import numpy as np
from attrs import define, field

from tokcollate.data import TokCollateData
from tokcollate.metrics import TokCollateMetric, register_metric
from tokcollate.utils import get_vocabulary


@register_metric("vocab_size")
@define(kw_only=True)
class VocabSizeMetric(TokCollateMetric):
    """Computes the vocabulary size based on the given tokenized text.

    Useful for visualizing correlation of other metrics with respect to vocabulary size.
    """
    def score(
        self,
        data: TokCollateData,
        system_label: str,
        language: str,
    ) -> float:
        text = data.get_system_text(system_label=system_label, language=language)
        return float(len(get_vocabulary(text)))
