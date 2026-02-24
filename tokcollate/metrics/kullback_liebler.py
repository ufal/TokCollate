from collections import Counter

import numpy as np
from attrs import define, field, validators
from scipy.special import kl_div

from tokeval.data import TextType, TokEvalData
from tokeval.metrics import TokEvalMultilingualMetric, register_metric
from tokeval.utils import get_unigram_distribution, get_vocabulary


@register_metric("kullback_liebler_divergence")
@define(kw_only=True)
class KullbackLieblerDivergenceMetric(TokEvalMultilingualMetric):
    """Measures the Kullback-Liebler Divergence of two vocabulary distributions extracted from (parallel/bilingual)
    texts.

    Args:
        vocab_most_common (int): vocabulary cut-off (only the n most common vocabulary entries are considered)
    """

    vocab_most_common: int = field(validator=validators.optional(validators.instance_of(int)), default=None)

    def score(self, data: TokEvalData, system_label: str, src_lang: str, tgt_lang: str) -> float:
        text_src = data.get_system_text(system_label=system_label, language=src_lang)
        text_tgt = data.get_system_text(system_label=system_label, language=tgt_lang)
        text_all = data.get_system_text(system_label=system_label)
        vocab = self._extract_vocabulary(text_all, self.vocab_most_common)

        unigram_probs_src = get_unigram_distribution(text_src, vocab=vocab)
        unigram_probs_tgt = get_unigram_distribution(text_tgt, vocab=vocab)

        return kl_div(unigram_probs_src, unigram_probs_tgt).sum()

    def score_batched(self, data: TokEvalData, system_label: str, languages: list[str]) -> np.ndarray:
        text_all = data.get_system_text(system_label=system_label)
        vocab = self._extract_vocabulary(text_all, self.vocab_most_common)
        unigram_probs = np.stack(
            [
                get_unigram_distribution(data.get_system_text(system_label=system_label, language=lang), vocab=vocab)
                for lang in languages
            ],
            axis=1,
        )
        res = kl_div(unigram_probs.reshape(-1, len(languages), 1), unigram_probs.reshape(-1, 1, len(languages)))

        # mask values KL(P || Q), where Q(x) = 0.
        res_mask = (res == np.inf).astype(bool)
        res[res_mask] = 0.0

        return res.sum(0)

    def _extract_vocabulary(self, text: TextType, most_common: int | None = None) -> Counter:
        vocab = get_vocabulary(text=text)
        if most_common is not None:
            vocab = Counter(dict(vocab.most_common(most_common)))
        return vocab
