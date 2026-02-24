import logging

import numpy as np
from attrs import Attribute, define, field, validators

from tokcollate.data import TokCollateData
from tokcollate.metrics import TokCollateMetric, register_metric
from tokcollate.utils import get_unigram_distribution

logger = logging.getLogger(__name__)


@register_metric("entropy")
@define(kw_only=True)
class EntropyMetric(TokCollateMetric):
    """Metric class implementing various entropy computations.

    Args:
        function_type (str): specifies which entropy function to use
        power (float): power value used in the Renyi entropy computation
    """

    function_type: str = field(validator=validators.instance_of(str), default="renyi_entropy")
    power: float = field(default=2.5)

    _functions = frozenset(["renyi_efficiency", "renyi_entropy", "shannon_efficiency", "shannon_entropy"])

    @function_type.validator
    def _supported_function(self, attribute: Attribute, value: str) -> None:
        """Check whether the specified function_type is supported by the class."""
        if value not in self._functions:
            err_msg = f"Unknown {attribute.name} value: {value}. Supported values [{self._functions}]."
            raise ValueError(err_msg)

    def _shannon_entropy(self, unigram_probs: np.ndarray) -> float:
        """Shannon entropy implementation."""
        return -np.sum(unigram_probs * np.log2(unigram_probs))

    def score(
        self,
        data: TokCollateData,
        system_label: str,
        language: str,
    ) -> float:
        text = data.get_system_text(system_label=system_label, language=language)
        unigram_probs = get_unigram_distribution(text)
        vocab_size = unigram_probs.size

        value_err_msg = f"Unknown entropy function: {self.function_type}"

        if "shannon" in self.function_type:
            ent = self._shannon_entropy(unigram_probs)
            if self.function_type == "shannon_entropy":
                return ent
            if self.function_type == "shannon_efficiency":
                return ent / np.log2(vocab_size)
            raise ValueError(value_err_msg)

        if self.power == 1.0:
            if "shannon" not in self.function_type:
                logger.warning(
                    "%s function parameter `power=1.0`. Computing shannon variant instead.", self.function_type
                )
            ent = self._shannon_entropy(unigram_probs)
            if "entropy" in self.function_type:
                return ent
            if "efficiency" in self.function_type:
                return ent / np.log2(vocab_size)
            raise ValueError(value_err_msg)

        scale = 1 / (1 - self.power)
        ent = scale * np.log2(np.sum(unigram_probs**self.power))
        if self.function_type == "renyi_entropy":
            return ent
        if self.function_type == "renyi_efficiency":
            return ent / np.log2(vocab_size)
        raise ValueError(value_err_msg)
