import numpy as np
from attrs import define, field

from tokcollate.data import TokCollateData
from tokcollate.metrics import TokCollateMultilingualMetric, register_metric

from .tokcollate_metric import AggMode


@register_metric("sequence_ratio")
@define(kw_only=True)
class SequenceRatioMetric(TokCollateMultilingualMetric):
    """Compute the sequence length ratio between two outputs of a single tokenizer."""

    aggregation: AggMode = field(converter=AggMode, default=AggMode.MEAN)
    use_bytes: bool = field(default=False)

    def score(self, data: TokCollateData, system_label: str, src_lang: str, tgt_lang: str) -> float:
        text_src = data.get_system_text(system_label=system_label, language=src_lang)
        text_tgt = data.get_system_text(system_label=system_label, language=tgt_lang)

        if self.use_bytes:
            lengths_src = np.array([sum(len(tok.encode("utf-8")) for tok in line) for line in text_src])
            lengths_tgt = np.array([sum(len(tok.encode("utf-8")) for tok in line) for line in text_tgt])
        else:
            lengths_src = np.array([len(line) for line in text_src])
            lengths_tgt = np.array([len(line) for line in text_tgt])
        ratios = lengths_src / lengths_tgt
        return self._aggregate_scores(ratios)

    def score_batched(self, data: TokCollateData, system_label: str, languages: list[str]) -> np.ndarray:
        texts = [data.get_system_text(system_label=system_label, language=lang) for lang in languages]
        if self.use_bytes:
            lengths = np.stack(
                [np.array([sum(len(tok.encode("utf-8")) for tok in line) for line in text]) for text in texts], axis=1
            )
        else:
            lengths = np.stack([np.array([len(line) for line in text]) for text in texts], axis=1)
        ratios = lengths.reshape(-1, len(languages), 1) / lengths.reshape(-1, 1, len(languages))
        return self._aggregate_scores(ratios, axis=0)
