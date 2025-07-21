import numpy as np
from attrs import define

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMultilingualMetric, register_metric


@register_metric("sequence_ratio")
@define(kw_only=True)
class SequenceRatioMetric(TokEvalMultilingualMetric):
    """Compute the sequence length ratio between two outputs of a single tokenizer."""

    def score(self, data: TokEvalData, system_label: str, src_lang: str, tgt_lang: str) -> tuple[float, float]:
        text_src = data.get_system_text(system_label=system_label, language=src_lang)
        text_tgt = data.get_system_text(system_label=system_label, language=tgt_lang)
        ratios = np.array(
            [len(line_src) / len(line_tgt) for line_src, line_tgt in zip(text_src, text_tgt, strict=False)]
        )
        return self._aggregate_scores(ratios)
