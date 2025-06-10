import logging
import numpy as np

from attrs import define
from typing import Dict, List

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMetric, register_metric

logger = logging.getLogger(__name__)


@register_metric("chars_per_token")
@define(kw_only=True)
class CharsPerTokenMetric(TokEvalMetric):
    """TODO."""

    def compute(
        self,
        data: Dict[str, List[str]],
        system_label: str,
    ) -> float:
        corpus = data[system_label]
        n_chars = []
        for line in corpus:
            line = line.strip()
            for token in line.split(" "):
                n_chars.append(len(token))
        return np.array(n_chars).mean()
