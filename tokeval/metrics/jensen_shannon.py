import numpy as np
from attrs import define
from scipy.spatial.distance import jensenshannon

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMultilingualMetric, register_metric
from tokeval.utils import get_unigram_frequencies, get_vocabulary


@register_metric("jensen_shannon_divergence")
@define(kw_only=True)
class JensenShannonDivergenceMetric(TokEvalMultilingualMetric):
    """TODO"""

    def score(self, data: TokEvalData, system_label: str, src_lang: str, tgt_lang: str) -> float:
        text_src = data.get_system_text(system_label=system_label, language=src_lang)
        text_tgt = data.get_system_text(system_label=system_label, language=tgt_lang)
        text_all = data.get_system_text(system_label=system_label)
        vocab = get_vocabulary(text=text_all)

        unigrams_src = get_unigram_frequencies(text_src, vocab=vocab)
        unigrams_tgt = get_unigram_frequencies(text_tgt, vocab=vocab)

        return jensenshannon(unigrams_src, unigrams_tgt)

    def score_batched(self, data: TokEvalData, system_label: str, languages: list[str]) -> np.ndarray:
        text_all = data.get_system_text(system_label=system_label)
        vocab = get_vocabulary(text=text_all)
        unigrams = np.stack(
            [
                get_unigram_frequencies(data.get_system_text(system_label=system_label, language=lang), vocab=vocab)
                for lang in languages
            ],
            axis=1,
        )
        return jensenshannon(unigrams.reshape(-1, len(languages), 1), unigrams.reshape(-1, 1, len(languages)))
