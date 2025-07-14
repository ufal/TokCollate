import logging
from pathlib import Path
from typing import ClassVar

import numpy as np
from attrs import define, field, fields, validators
from omegaconf import DictConfig

from tokeval.data import TokEvalData
from tokeval.metrics import TokEvalMetric, build_metric

logger = logging.getLogger(__name__)


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
    _filenames: ClassVar[dict] = {"metrics": "metrics.scores.npz", "correlation": "correlation.scores.npz"}
    _metric_dims: ClassVar[dict] = {"mono": 1, "multi": 3}

    def __attrs_post_init__(self) -> None:
        """Set the class values based on the config contents and build the requested metric objects."""
        for param_name in self.list_parameters():
            if param_name in ["config", "data", "metrics"]:
                continue
            if hasattr(self.config.scorer, param_name):
                setattr(self, param_name, getattr(self.config.scorer, param_name))
            if getattr(self, param_name, None) is None:
                err_msg = (
                    f"Required {self.__class__.__name__} attribute scorer.{param_name} not found in the config file."
                )
                raise ValueError(err_msg)
        self.metrics = self._build_metrics(self.config.scorer)
        self.data = TokEvalData(
            data_dir=self.input_dir,
            systems=self.systems,
            languages=self.languages,
            metrics=self.metrics,
            file_suffix=self.file_suffix,
        )

    def run(self) -> dict[str, dict[str, np.ndarray]]:
        """Execute the evaluation.

        Execution has three steps:
            1. Dataset scoring with provided metrics
            2. Computing correlation between the metrics based on the dataset scores.
            3. Reporting the results
        """
        results = {}

        logger.info("Scoring datasets...")
        results["metrics"] = self._score_systems()

        logger.info("Computing correlation...")
        results["correlation"] = self._correlate(results["metrics"])

        if self.output_dir is not None:
            results_path = Path(self.output_dir, self._filenames["metrics"])
            logger.info("Saving metric scores to %s...", results_path)
            np.savez(results_path, **results["metrics"])

            results_path = Path(self.output_dir, self._filenames["correlation"])
            logger.info("Saving correlation scores to %s...", results_path)
            np.savez(results_path, **results["correlation"])
        else:
            logger.info("No scorer.output_dir was provided. Printing results to STDOUT:\n")
            for key in self._filenames:
                print(results[key])  # noqa: T201

        return results

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
        for key in self._metric_dims:
            scores = np.stack([out for out in metric_scores.values() if out.ndim == self._metric_dims[key]], axis=0)
            corr_scores[key] = np.corrcoef(scores, rowvar=True)

        return corr_scores
