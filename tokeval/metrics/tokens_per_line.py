import logging
import numpy as np

from attrs import define
from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMetric, register_metric

logger = logging.getLogger(__name__)


@register_metric("tokens_per_line")
@define(kw_only=True)
class TokensPerLineMetric(TokEvalMetric):
    """TODO."""

    def compute_metric(
        self,
        data: TokEvalData,
        system_label: str,
    ) -> float:

        logger.debug("Processing %s.%s.out dataset", system_label, self.metric)
        corpus = data["{system_label}.{self.metric}"]
        n_tokens = []
        for line in corpus:
            n_tokens.appned(len(line.split(" ")))
        return np.array(n_tokens).mean()
