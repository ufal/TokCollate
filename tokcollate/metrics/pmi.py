from collections import Counter, defaultdict

import numpy as np
from attrs import define, field, validators

from tokcollate.data import TextType, TokCollateData
from tokcollate.metrics import TokCollateMultilingualMetric, register_metric
from tokcollate.utils import get_vocabulary


@register_metric("pointwise_mutual_information")
@define(kw_only=True)
class PointwiseMutualInformationMetric(TokCollateMultilingualMetric):
    """Measures the average Pointwise Mutual Information (PMI) between token pairs in parallel sentences.

    PMI measures how much more or less likely two tokens are to co-occur in parallel sentences
    compared to what we'd expect if they were independent:

    PMI(token_src, token_tgt) = log(P(token_src, token_tgt) / (P(token_src) * P(token_tgt)))

    Higher PMI values indicate stronger associations between tokens in parallel sentences.

    Args:
        vocab_most_common (int): vocabulary cut-off (only the n most common entries are considered)
        min_cooccurrence (int): minimum co-occurrence count to consider a token pair (default: 1)
        aggregation (str): how to aggregate PMI values across token pairs ("mean", "sum", "median")
    """

    vocab_most_common: int = field(validator=validators.optional(validators.instance_of(int)), default=None)
    min_cooccurrence: int = field(validator=validators.instance_of(int), default=1)
    aggregation: str = field(validator=validators.in_(["mean", "sum", "median"]), default="mean")

    def score(self, data: TokCollateData, system_label: str, src_lang: str, tgt_lang: str) -> float:
        text_src = data.get_system_text(system_label=system_label, language=src_lang)
        text_tgt = data.get_system_text(system_label=system_label, language=tgt_lang)

        # Get vocabularies for both languages
        text_all = data.get_system_text(system_label=system_label)
        vocab_src = self._extract_vocabulary(
            data.get_system_text(system_label=system_label, language=src_lang), self.vocab_most_common
        )
        vocab_tgt = self._extract_vocabulary(
            data.get_system_text(system_label=system_label, language=tgt_lang), self.vocab_most_common
        )

        # Compute PMI
        pmi_scores = self._compute_pmi(text_src, text_tgt, vocab_src, vocab_tgt)

        # Aggregate
        return self._aggregate_pmi(pmi_scores)

    def score_batched(self, data: TokCollateData, system_label: str, languages: list[str]) -> np.ndarray:
        """Compute PMI for all language pairs in a batched manner."""
        res = np.zeros((len(languages), len(languages)))

        # Pre-compute vocabularies for all languages
        vocabs = {}
        texts = {}
        for lang in languages:
            text = data.get_system_text(system_label=system_label, language=lang)
            texts[lang] = text
            vocabs[lang] = self._extract_vocabulary(text, self.vocab_most_common)

        # Compute PMI for each language pair
        for i, src_lang in enumerate(languages):
            for j, tgt_lang in enumerate(languages):
                if i == j:
                    # PMI with itself doesn't make much sense, set to 0
                    res[i, j] = 0.0
                else:
                    pmi_scores = self._compute_pmi(texts[src_lang], texts[tgt_lang], vocabs[src_lang], vocabs[tgt_lang])
                    res[i, j] = self._aggregate_pmi(pmi_scores)

        return res

    def _extract_vocabulary(self, text: TextType, most_common: int | None = None) -> Counter:
        """Extract vocabulary from text, optionally limiting to most common tokens."""
        vocab = get_vocabulary(text=text)
        if most_common is not None:
            vocab = Counter(dict(vocab.most_common(most_common)))
        return vocab

    def _compute_pmi(
        self, text_src: TextType, text_tgt: TextType, vocab_src: Counter, vocab_tgt: Counter
    ) -> list[float]:
        """Compute PMI scores for all co-occurring token pairs in parallel sentences.

        Args:
            text_src: Source language tokenized text (list of token lists)
            text_tgt: Target language tokenized text (list of token lists)
            vocab_src: Source vocabulary (Counter of tokens)
            vocab_tgt: Target vocabulary (Counter of tokens)

        Returns:
            List of PMI scores for all token pairs with sufficient co-occurrence
        """
        # Count co-occurrences
        cooccurrence = defaultdict(int)
        total_pairs = 0

        for src_sent, tgt_sent in zip(text_src, text_tgt, strict=False):
            # Get unique tokens in each sentence to avoid counting duplicates within sentence
            src_tokens = set(tok for tok in src_sent if tok in vocab_src)
            tgt_tokens = set(tok for tok in tgt_sent if tok in vocab_tgt)

            # Count co-occurrences
            for src_tok in src_tokens:
                for tgt_tok in tgt_tokens:
                    cooccurrence[(src_tok, tgt_tok)] += 1
                    total_pairs += 1

        if total_pairs == 0:
            return [0.0]

        # Compute marginal probabilities
        total_src = sum(vocab_src.values())
        total_tgt = sum(vocab_tgt.values())

        # Compute PMI for each pair
        pmi_scores = []
        for (src_tok, tgt_tok), count in cooccurrence.items():
            if count < self.min_cooccurrence:
                continue

            # Joint probability
            p_joint = count / total_pairs

            # Marginal probabilities
            p_src = vocab_src[src_tok] / total_src
            p_tgt = vocab_tgt[tgt_tok] / total_tgt

            # PMI = log(P(x,y) / (P(x) * P(y)))
            if p_src > 0 and p_tgt > 0 and p_joint > 0:
                pmi = np.log2(p_joint / (p_src * p_tgt))
                pmi_scores.append(pmi)

        return pmi_scores if pmi_scores else [0.0]

    def _aggregate_pmi(self, pmi_scores: list[float]) -> float:
        """Aggregate PMI scores according to the specified aggregation method."""
        if not pmi_scores:
            return 0.0

        if self.aggregation == "mean":
            return float(np.mean(pmi_scores))
        elif self.aggregation == "sum":
            return float(np.sum(pmi_scores))
        elif self.aggregation == "median":
            return float(np.median(pmi_scores))
        else:
            raise ValueError(f"Unknown aggregation method: {self.aggregation}")
