import datetime
import json
import logging
from pathlib import Path
from typing import Any, ClassVar

import numpy as np
from attrs import converters, define, field, fields, validators
from omegaconf import DictConfig

from tokeval.data import LanguageInfo, TokEvalData
from tokeval.metrics import TokEvalMetric, build_metric

logger = logging.getLogger(__name__)


@define(kw_only=True)
class ScorerResultSaver(dict):
    """Class for saving the TokEvalScorer results with the scorer metadata."""

    output_dir: Path = field(converter=Path)

    dataset_name: str = field(default="Unknown Dataset")
    timestamp: str = field(converter=converters.optional(str), default=None)
    tokenizers: list[str] = field(validator=validators.instance_of(list))
    metrics: list[str] = field(validator=validators.instance_of(list))
    languages: list[str] = field(validator=validators.instance_of(list))

    # TODO(varisd): replace any with proper data structure definition
    languages_info: dict[str, Any] = field(validator=validators.optional(validators.instance_of(dict)))

    _languages_info_filename: ClassVar[str] = "languages_info.json"
    _metadata_filename: ClassVar[str] = "metadata.json"
    _results_filename: ClassVar[str] = "results.npz"

    def __attrs_post_init__(self) -> None:
        """Set default values."""
        if self.timestamp is None:
            self.timestamp = f"{datetime.datetime.now():%Y-%m-%d_%H:%M:%S}"

    def _save_metadata(self) -> None:
        path = Path(self.output_dir, self._metadata_filename)
        data = {
            "output_dir": str(self.output_dir),
            "dataset_name": self.dataset_name,
            "timestamp": self.timestamp,
            "tokenizers": self.tokenizers,
            "metrics": self.metrics,
            "languages": self.languages,
        }
        with path.open("w") as fh:
            json.dump(data, sort_keys=True, indent=2, fp=fh)

    def save_results(self, results: dict) -> None:
        logger.info("Saving scorer results to %s", self.output_dir)
        self._save_metadata()

        path = Path(self.output_dir, self._results_filename)
        np.savez(path, **results)

        if self.languages_info:
            path = Path(self.output_dir, self._languages_info_filename)
            with path.open("w") as fh:
                json.dump(self.languages_info, sort_keys=True, indent=2, fp=fh)


@define(kw_only=True)
class TokEvalScorer:
    """Base Scorer class.

    The scorer loads the provided datasets (system outputs, input and reference files) and scores them using
    the requested metrics.
    The metric results are then correlated based on their results across the system outputs

    Args:
        config (DictConfig): TokEval configuration containing scorer details

    OmegaConf Args:
        scorer.input_dir: location of the dataset files
        scorer.output_dir: target location for saving the scorer results. If None, the results are printed to stdout.
        scorer.systems: list of the scored system outputs
        scorer.file_suffix: suffix of the dataset files
        scorer.metrics: list of metrics and their configurations (dict)
    """

    config: DictConfig = field(validator=validators.instance_of(DictConfig))

    input_dir: Path = field(converter=converters.optional(Path), init=False)
    output_dir: Path = field(converter=converters.optional(Path), init=False, default=None)
    systems: list[str] = field(init=False)
    languages: list[str] = field(init=False, factory=list)
    languages_info: dict[str, Any] = field(init=False, default=None)
    file_suffix: str = field(init=False, default="txt")

    metrics: dict[str, TokEvalMetric] = field(init=False, default=None)
    data: TokEvalData = field(init=False, default=None)
    _metric_n_dim: ClassVar[dict] = {"mono": 2, "multi": 3}

    def __attrs_post_init__(self) -> None:
        """Set the class values based on the config contents and build the requested metric objects."""
        for param in self.list_parameters():
            if param.name == "config":
                continue
            if param.name == "languages_info":
                if getattr(self.config.scorer, param.name, None) is not None:
                    path = Path(getattr(self.config.scorer, param.name))
                    self.languages_info = {
                        lang: LanguageInfo.create_entry(entry)
                        for lang, entry in json.load(path.open("r", encoding="utf-8")).items()
                    }
                continue
            if hasattr(self.config.scorer, param.name):
                setattr(self, param.name, getattr(self.config.scorer, param.name))
            if param.default is not None and getattr(self, param.name, None) is None:
                err_msg = (
                    f"Required {self.__class__.__name__} attribute scorer.{param.name} not found in the config file."
                )
                raise ValueError(err_msg)
        self.metrics = self._build_metrics(self.config.scorer)
        self.data = TokEvalData(
            data_dir=self.input_dir,
            systems=self.systems,
            languages=self.languages,
            languages_info=self.languages_info,
            metrics=self.metrics.values(),
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
            if not self.output_dir.exists():
                self.output_dir.mkdir(parents=True)
            ScorerResultSaver(
                output_dir=self.output_dir,
                tokenizers=list(self.systems),
                metrics=list(self.metrics.keys()),
                languages=list(self.languages),
                languages_info=self.languages_info,
            ).save_results(results)
        else:
            logger.info("No scorer.output_dir was provided. Printing results to STDOUT:\n")
            for key in results:
                print(results[key])  # noqa: T201

        return results

    @classmethod
    def list_parameters(cls: "TokEvalScorer") -> list[str]:
        """List the class parameter names."""
        param_list = []
        for p in fields(cls):
            if p.name.startswith("_"):
                continue
            param_list.append(p)
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
        for metric_label, metric in self.metrics.items():
            logger.info("Running %s metric...", metric_label)
            scores[metric_label] = metric.score_all(self.data, self.systems, languages=self.languages)
        return scores

    def _correlate(self, metric_scores: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
        """Return the correlation coefficients between the metrics."""
        corr_scores = {}
        for key in self._metric_n_dim:
            scores = [out for out in metric_scores.values() if out.ndim == self._metric_n_dim[key]]
            if not scores:
                corr_scores[key] = None
            elif len(scores) == 1:
                corr_scores[key] = np.float64(1.0)
            else:
                scores_stacked = np.stack(scores, axis=0)
                scores_flat = scores_stacked.reshape((scores_stacked.shape[0], -1))
                corr_scores[key] = np.corrcoef(scores_flat, rowvar=True)
        return corr_scores
