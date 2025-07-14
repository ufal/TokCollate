import logging
from pathlib import Path

import numpy as np
from attrs import define, field, fields, validators
from omegaconf import DictConfig

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMetric, build_metric

logger = logging.getLogger(__name__)

MONO_SCORES_DIM = 1
MULTI_SCORES_DIM = 2


@define(kw_only=True)
class TokEvalScorer:
    """Base Scorer class.

    The scorer loads the provided datasets (system outputs, input and reference files) and scores them using
    the requested metrics.
    The metric results are then correlated based on their results across the system outputs

    Args:
        config (DictConfig): scorer configuration

    OmegaConf Args:
        scorer.input_dir: location of the dataset files
        scorer.output_dir: target location for saving the scorer results. If None, the results are printed to stdout.
        scorer.systems: list of the scored system outputs
        scorer.system_dataset_suffix: suffix of the dataset files
        scorer.metrics: list of metrics and their configurations (dict)
    """

    config: DictConfig = field(validator=validators.instance_of(DictConfig))

    input_dir: Path = field(init=False, default=None)
    output_dir: Path = field(init=False, default=None)
    systems: list[str] = field(init=False, default=None)
    languages: list[str] = field(init=False, default=None)
    file_suffix: str = field(init=False, default="txt")

    metrics: dict[str, TokEvalMetric] = field(init=False, default=None)
    data: TokEvalData = field(init=False, default=None)

    def __attrs_post_init__(self) -> None:
        """Set the class values based on the config contents and build the requested metric objects."""
        for param_name in self.list_parameters():
            if param_name in ["config", "metrics"]:
                continue
            if hasattr(self.config.scorer, param_name):
                setattr(self, param_name, getattr(self.config.scorer, param_name))
            if getattr(self, param_name, None) is None:
                err_msg = f"Required {self.__class__.__name__} attribute scorer.{param_name} not found in the config file."
                raise ValueError(err_msg)
        self.metrics = self._build_metrics(self.config.scorer)
        self.data = TokEvalData(
            data_dir=self.input_dir,
            systems=self.systems,
            languages=self.languages,
            metrics=self.metrics,
            file_suffix=self.file_suffix,
        )

    def run(self) -> None:
        """Execute the evaluation.

        Execution has three steps:
            1. Dataset scoring with provided metrics
            2. Computing correlation between the metrics based on the dataset scores.
            3. Reporting the results
        """
        logger.info("Scoring datasets...")
        metric_scores = self._score_systems()

        logger.info("Computing correlation...")
        corr_scores = self._correlate(metric_scores)

        if self.output_dir is not None:
            metric_scores_path = Path(self.output_dir, "metric.scores.npz")
            logger.info("Saving metric scores to %s...", metric_scores_path)
            np.savez(metric_scores_path, **metric_scores)

            corr_scores_path = Path(self.output_dir, "correlation.scores.npz")
            logger.info("Saving correlation scores to %s...", corr_scores_path)
            np.savez(corr_scores_path, **corr_scores)

    @classmethod
    def list_parameters(cls: "TokEvalScorer") -> list[str]:
        """List the class parameter names."""
        param_list = []
        for p in fields(cls):
            if p.name.startswith("_"):
                continue
            param_list.append(p.name)
        return param_list

    def _build_metrics(self, config: DictConfig) -> dict[str, TokEvalMetric]:
        """Build the requested metric objects based on their definition in the config."""
        metrics = {}
        for metric_params in config.metrics:
            metric = metric_params.metric
            del metric_params["metric"]

            metric_inst = build_metric(metric=metric, **metric_params)
            metrics[metric_inst.metric_label] = metric_inst
        return metrics

    def _score_systems(self) -> dict[str, np.ndarray]:
        """Score the datasets with the requested metrics."""
        scores = {}
        for i, metric in enumerate(self.metrics.values()):
            scores[self.metrics[i]] = metric.score_all(self.data, self.systems, self.languages)
        return scores

    def _correlate(self, metric_scores: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
        """Return the correlation coefficients between the metrics."""
        corr_scores = {}
        scores_mono = np.stack([scores for scores in metric_scores.values() if scores.ndim == MONO_SCORES_DIM], axis=0)
        corr_scores["mono"] = np.corrcoef(scores_mono, rowvar=True)

        scores_multi = np.stack(
            [scores for scores in metric_scores.values() if scores.ndim == MULTI_SCORES_DIM], axis=1
        )
        corr_scores["multi"] = np.corrcoef(scores_multi, rowvar=True)

        return corr_scores
