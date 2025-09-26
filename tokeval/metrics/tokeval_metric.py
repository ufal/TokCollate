import enum
import logging

import numpy as np
from attrs import define, field

from tokeval.data import TokEvalData

logger = logging.getLogger(__name__)


class EvalMode(enum.Enum):
    """Indicate the evaluation mode of a metric.

    Some metrics can aggregate multiple values (e.g. over lines) in various ways, however,
    to keep the .score() method interface simple, we always want to return a single float value.
    In cases when we need to report e.g. both mean and variance over the aggregated values, the user should call two
    different instances of a same metric class, one for each `mode`.

    # TODO(varisd): more modes?
    """

    NONE = None
    MEAN = "mean"
    VAR = "var"
    SUM = "sum"


@define(kw_only=True)
class TokEvalMetric:
    """Base class for TokEval metrics.

    Each TokEvalMetric derived class must implement the following interface, mainly the .score() and .score_all()
    methods.
    Derived classes must be registered using tokeval.metrics.register_metric() decorator.
    Instances should be created using the tokeval.metrics.build_metric() method.

    Some metrics might require a reference or an input file in addition to the tokenizer output. In such cases,
    the metric should set the relevat private class attributes self._requires_*_text to True.
    TODO(varisd): is there a better way to implement this?

    Args:
        metric (str): metric class identifier (registered using register_metric)
        metric_label (str): unique metric class instance identifier
    """

    metric: str = field(converter=str)
    metric_label: str = field(converter=str)

    _requires_reference_text: bool = False
    _requires_input_text: bool = False

    @classmethod
    def build_metric(
        cls: "TokEvalMetric",
        metric: str,
        metric_label: str,
        **kwargs,  # noqa: ANN003
    ) -> "TokEvalMetric":
        """Build a specified metric instance.

        This method can be called directly or (preferably) using the tokeval.metrics.build_metric() method.

        Args:
            metric (str): metric class identifier (registered using register_metric)
            metric_label (str): unique metric class instance identifier
            **kwargs: additional parameters for the specific metric class implementation

        Returns:
            An instance of the specified metric class.
        """
        return cls(metric=metric, metric_label=metric_label, **kwargs)

    @property
    def requires_input_text(self) -> bool:
        """Accessor to the ._requires_input_text private attribute."""
        return self._requires_input_text

    @property
    def requires_reference_text(self) -> bool:
        """Accessor to the ._requires_reference_text private attribute."""
        return self._requires_reference_text

    def score(
        self,
        data: TokEvalData,
        system_label: str,
        **kwargs,  # noqa: ANN003
    ) -> float:
        """Implements the metric computation.

        The method receives a data representation TokEvalData instance, a label of the evaluated system and additional
        (optional) arguments such as languages for retrieving a required set of texts from the TokEvalData and
        computing the metric score.

        Args:
            data (TokEvalData): data structure containing all texts available for evaluation
            system_label (str): tokenizer label used for text selection
            src_lang (str): optional source language for text selection. Usually used with tgt_lang argument during
                a multilingual evaluation
            tgt_lang (str): optional target language for text selection
            **kwargs: catch-all parameter for metric-specific parameters (NOTE(varisd): for faster prototyping of new
                metrics)

        Returns:
            A single floating value metric score.
        """
        raise NotImplementedError()

    def score_all(self, data: TokEvalData, systems: list[str], **kwargs) -> np.ndarray:  # noqa: ANN003, ARG002
        """Wrapper for evaluating a set of tokenizers (and languages).

        Calls the .score() method for each provided system (and languages) and collects the results in a single
        np.ndarray.

        Args:
            data (TokEvalData): data structure containing all texts available for evaluation
            systems (list[str]): list of the evaluated tokenizer labels
            **kwargs: catch-all parameter for parameters required by specific metric groupings
                (e.g. multilingual metrics)
            languages (list[str]): (optional) list of available languages for multi-lingual evaluation

        Returns:
            Numpy ndarray with shape(len(systems)) or shape(len(systems), len(languages, len(languages)).
        """
        res = np.zeros(shape=[len(systems)])
        for i, system_label in enumerate(systems):
            logger.debug("[%s] Scoring system: %s...", self.metric_label, system_label)
            res[i] = self.score(data=data, system_label=system_label)
        return res


class TokEvalMultilingualMetric(TokEvalMetric):
    """TODO"""

    def score(
        self,
        data: TokEvalData,
        system_label: str,
        src_lang: str,
        tgt_lang: str,
    ) -> float:
        raise NotImplementedError()

    def score_all(self, data: TokEvalData, systems: list[str], languages: list[str]) -> np.ndarray:
        """TODO"""
        res = np.zeros(shape=[len(systems), len(languages), len(languages)])
        for i, system_label in enumerate(systems):
            for j, src_lang in enumerate(languages):
                for k, tgt_lang in enumerate(languages):
                    logger.debug(
                        "[%s] Scoring system: %s, src_lang: %s, tgt_lang: %s",
                        self.metric_label, system_label, src_lang, tgt_lang
                    )
                    res[i, j, k] = self.score(
                        data=data, system_label=system_label, src_lang=src_lang, tgt_lang=tgt_lang
                    )
        return res
