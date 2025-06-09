import logging
import numpy as np

from attrs import define
from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMetric, register_metric

logger = logging.getLogger(__name__)


@register_metric("chars_per_token")
@define(kw_only=True)
class CharsPerTokenMetric(TokEvalMetric):
    """TODO."""

    def compute_metric(
        self,
        data: TokEvalData,
        system_label: str,
    ) -> float:

        logger.debug("Processing %s.%s.out dataset", system_label, self.metric)
        corpus = data["{system_label}.{self.metric}"]
        n_chars = []
        for line in corpus:
            for token in line.split(" "):
                n_chars.append(len(token))
        return np.array(n_chars).mean()
