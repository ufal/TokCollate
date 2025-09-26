import numpy as np
from attrs import define, field

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMultilingualMetric, register_metric

from .tokeval_metric import EvalMode


@register_metric("sequence_ratio")
@define(kw_only=True)
class SequenceRatioMetric(TokEvalMultilingualMetric):
    """Compute the sequence length ratio between two outputs of a single tokenizer."""

    mode: EvalMode = field(converter=EvalMode, default=EvalMode.MEAN)

    def score(self, data: TokEvalData, system_label: str, src_lang: str, tgt_lang: str) -> float:
        text_src = data.get_system_text(system_label=system_label, language=src_lang)
        text_tgt = data.get_system_text(system_label=system_label, language=tgt_lang)

        lengths_src = np.array([len(line) for line in text_src])
        lengths_tgt = np.array([len(line) for line in text_tgt])
        ratios = lengths_src / lengths_tgt
        return self._aggregate_scores(ratios)

    def score_batched(self, data: TokEvalData, system_label: str, languages: list[str]) -> np.ndarray:
        texts = [data.get_system_text(system_label=system_label, language=lang) for lang in languages]
        lengths = np.stack([np.array([len(line) for line in text]) for text in texts], axis=1)
        ratios = lengths.reshape(-1, len(languages), 1) / lengths.reshape(-1, 1, len(languages))
        return self._aggregate_scores(ratios, axis=0)

    def _aggregate_scores(self, scores: np.ndarray, axis: int = 0) -> float:
        if self.mode == EvalMode.MEAN:
            return scores.mean(axis=axis)
        if self.mode == EvalMode.VAR:
            return scores.var(axis=axis)
        if self.mode == EvalMode.SUM:
            return scores.sum(axis=axis)
        err_msg = f"Unknown metric mode: {self.mode}"
        raise ValueError(err_msg)
