import logging
import numpy as np

from attrs import define
from typing import Dict, List

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMetric, register_metric

logger = logging.getLogger(__name__)


@register_metric("tokens_per_line")
@define(kw_only=True)
class TokensPerLineMetric(TokEvalMetric):
    """TODO."""

    def compute(
        self,
        data: Dict[str, List[str]],
        system_label: str,
    ) -> float:

        logger.debug("Processing %s.%s.out dataset", system_label, self.metric)
        corpus = data[system_label]
        n_tokens = []
        for line in corpus:
            n_tokens.append(len(line.split(" ")))
        return np.array(n_tokens).mean()
