import logging
from pathlib import Path

import numpy as np
from attrs import define, field, fields, validators
from omegaconf import DictConfig

from tokeval.metrics import TokEvalMetric, build_metric
from tokeval.utils import load_tokenized_dataset_file

logger = logging.getLogger(__name__)


@define(kw_only=True)
class Evaluator:
    """Base Evaluator class.

    The evaluator loads the provided datasets (system outputs) and scores them using the requested metrics.
    The metric results are then correlated based on their results across the system outputs

    Args:
        config (DictConfig): evaluation configuration

    OmegaConf Args:
        evaluator.input_dir: location of the dataset files
        evaluator.output_dir: target location for saving the evaluation results
        evaluator.systems: list of the evaluated systems (datasets)
        evaluator.system_dataset_suffix: suffix of the dataset files
        evaluator.metrics: list of metrics and their configurations (dict)
    """

    config: DictConfig = field(validator=validators.instance_of(DictConfig))

    input_dir: Path = field(init=False, default=None)
    output_dir: Path = field(init=False, default=None)
    systems: list[str] = field(init=False, default=None)
    system_dataset_suffix: str = field(init=False, default="out")
    metrics: dict[str, TokEvalMetric] = field(init=False, default=None)

    def __attrs_post_init__(self) -> None:
        """Set the class values based on the config contents and build the requested metric objects."""
        for param_name in self.list_parameters():
            if param_name in ["config", "metrics"]:
                continue
            if hasattr(self.config.evaluator, param_name):
                setattr(self, param_name, getattr(self.config.evaluator, param_name))
            if getattr(self, param_name, None) is None:
                err_msg = f"Required Evaluator attribute evaluator.{param_name} not found in the config file."
                raise ValueError(err_msg)
        self.metrics = self._build_metrics(self.config.evaluator)

    def run(self) -> None:
        """Execute the evaluation.

        Execution has three steps:
            1. Dataset scoring with provided metrics
            2. Computing correlation between the metrics based on the dataset scores.
            3. Reporting the results
        """
        metric_results = self._score_systems()
        corrcoefs = self._correlate(metric_results)
        self._report(metric_results, corrcoefs)

    @classmethod
    def list_parameters(cls: "Evaluator") -> list[str]:
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

    def _load_datasets(self) -> dict[str, dict[str, list[str]]]:
        """Load the provided dataset files."""
        data = {}
        for system in self.systems:
            data[system] = load_tokenized_dataset_file(Path(self.input_dir, f"{system}.{self.system_dataset_suffix}"))
        for metric in self.metrics.values():
            for dataset, dataset_filename in metric.metric_datasets:
                if dataset in data:
                    continue
                data[dataset] = load_tokenized_dataset_file(Path(self.input_dir, dataset_filename))
        return data

    def _score_systems(self) -> np.ndarray:
        """Score the datasets with the requested metrics."""
        res = np.zeros([len(self.metrics), len(self.systems)])
        data = self._load_datasets()
        for i, metric in enumerate(self.metrics.values()):
            for j, system in enumerate(self.systems):
                res[i, j] = metric.score(data, system)
        return res

    def _correlate(self, metric_results: np.ndarray) -> np.ndarray:
        """Return the correlation coefficients between the metrics."""
        return np.corrcoef(metric_results, rowvar=True)

    def _report(self, metric_results: np.ndarray, corrcoefs: np.ndarray) -> None:
        """Print the results into the target outpout_dir."""
        logger.info("Printing metric results...")
        for i, metric in enumerate(self.metrics):
            logger.debug("Printing %s output...", self.metrics[metric].metric_label)
            with Path(self.output_dir, self.metrics[metric].metric_label).open("w") as fh:
                print(metric_results[i], file=fh)

        logger.info("Printing correlation between metrics...")
        with Path(self.output_dir, "corrcoef").open("w") as fh:
            print(corrcoefs, file=fh)

        logger.info("Results have been stored at %s", self.output_dir)
