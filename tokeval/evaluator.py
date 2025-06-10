import logging
import numpy as np
from pathlib import Path
from typing import Dict, List

from attrs import define, field, fields, validators
from omegaconf import DictConfig, OmegaConf

from tokeval.metrics import TokEvalMetric, build_metric
from tokeval.utils import load_dataset_file

logger = logging.getLogger(__name__)


@define(kw_only=True)
class Evaluator:
    """Base Evaluator class.i

    Args:
        TODO
    """
    config: DictConfig = field(validator=validators.instance_of(DictConfig))

    input_dir: Path = field(init=False, default=None)
    output_dir: Path = field(init=False, default=None)
    systems: list[str] = field(init=False, default=None)
    system_dataset_suffix: str = field(init=False, default="out")
    metrics: TokEvalMetric = field(init=False, default=None)

    def __attrs_post_init__(self) -> None:
        """TODO"""
        for param_name in self.list_parameters():
            if param_name in ["config", "metrics"]:
                continue
            if hasattr(self.config.evaluator, param_name):
                setattr(self, param_name, getattr(self.config.evaluator, param_name))
            if getattr(self, param_name, None) is None:
                raise ValueError(f"Required Evaluator attribute evaluator.{param_name} not found in the config file.")
        self.metrics = self._build_metrics(self.config.evaluator)

    def run(self) -> None:
        """TODO"""
        res_metrics = self._compute_metrics()
        res_corrcoefs = self._correlate(res_metrics)
        self._report(res_metrics, res_corrcoefs)

    @classmethod
    def list_parameters(cls: "Evaluator") -> List[str]:
        """TODO"""
        param_list = []
        for p in fields(cls):
            if p.name.startswith("_"):
                continue
            param_list.append(p.name)
        return param_list

    def _build_metrics(self, config: DictConfig) -> Dict[str, TokEvalMetric]:
        """TODO"""
        metrics = {}
        for metric_params in config.metrics:
            metric = metric_params.metric
            del metric_params["metric"]

            metric_inst = build_metric(metric=metric, **metric_params)
            metrics[metric_inst.metric_label] = metric_inst
        return metrics

    def _load_datasets(self) -> Dict[str, Dict[str, List[str]]]:
        """TODO"""
        data = {}
        for system in self.systems:
            data[system] = load_dataset_file(Path(self.input_dir, f"{system}.{self.system_dataset_suffix}"))
        for metric in self.metrics:
            # TODO(varisd): add metric-specific datasets (reference, input, etc.)
            pass
        return data

    def _compute_metrics(self) -> np.ndarray:
        """TODO"""
        res = np.zeros([len(self.metrics), len(self.systems)])
        data = self._load_datasets()
        for i, metric in enumerate(self.metrics.values()):
            for j, system in enumerate(self.systems):
                res[i, j] = metric.compute(data, system)
        return res

    def _correlate(self, metric_results: np.ndarray) -> np.ndarray:
        """TODO"""
        res = np.corrcoef(metric_results, rowvar=True)
        return res

    def _report(self, metrics, corrcoefs) -> None:
        """TODO"""
        print(f"Metric Results:")
        for i, metric in enumerate(self.metrics):
            print(f"{metric}:\n{metrics[i]}\n")

        print(f"Metric Correlation:")
        for i, metric in enumerate(self.metrics):
            print(f"{metric}:\t{corrcoefs[i]}")
