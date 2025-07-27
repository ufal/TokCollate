from attrs import define
from scipy.special import kl_div

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMultilingualMetric, register_metric
from tokeval.utils import get_unigram_frequencies, get_vocabulary


@register_metric("kullback_liebler_divergence")
@define(kw_only=True)
class KullbackLieblerDivergenceMetric(TokEvalMultilingualMetric):
    """TODO"""

    def score(self, data: TokEvalData, system_label: str, src_lang: str, tgt_lang: str) -> tuple[float, float]:
        text_src = data.get_system_text(system_label=system_label, language=src_lang)
        text_tgt = data.get_system_text(system_label=system_label, language=tgt_lang)
        vocab = get_vocabulary(text=(text_src + text_tgt))

        unigrams_src = get_unigram_frequencies(text_src, vocab=vocab)
        unigrams_tgt = get_unigram_frequencies(text_tgt, vocab=vocab)

        return kl_div(unigrams_src, unigrams_tgt)
