import logging
import numpy as np
from pathlib import Path
from typing import Dict, List

from attrs import define, field
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

    input_dir: Path = field(converter=Path, default=None)
    output_dir: Path = field(converter=Path, default=None)
    systems: list[str] = field(factory=list)
    system_dataset_suffix: str = field(converter=str, default="out")

    config_file: Path = field(converter=Path, default=None)
    config: DictConfig = field(init=False, default=None)
    metrics: TokEvalMetric = field(init=False, default=None)

    def __attrs_post_init__(self) -> None:
        """TODO"""
        self.config = OmegaConf.load(self.config_file)
        self.metrics = self._build_metrics(self.config)

    def run(self) -> None:
        """TODO"""
        res_metrics = self._compute_metrics()
        res_corrcoefs = self._correlate(res_metrics)
        self._report(res_metrics, res_corrcoefs)

    def _build_metrics(self, config: DictConfig) -> Dict[str, TokEvalMetric]:
        """TODO"""
        metrics = {}
        for metric_params in config.metrics:
            metric_inst = build_metric(**metric_params)
            metrics[metric_inst.metric_label] = metric_inst
        return metrics

    def _load_datasets(self) -> Dict[str, Dict[str, List[str]]]:
        """TODO"""
        data = {}
        for system in self.systems:
            data[system] = load_dataset_file(Path(self.input_dir, f"{system}.{self.system_dataset_suffix}"))
        for metric in self.metrics:
            data["metric"] = {}
            for dataset in metric.list_datasets():
                data["metric"][dataset] = load_dataset_file(Path(self,input_dir, metric.get_dataset_filename(dataset)))

    def _compute_metrics(self) -> np.ndarray:
        """TODO"""
        res = np.zeros([len(self.metrics), len(self.systems)])
        data = self._load_datasets()
        for i, metric in enumerate(self.metrics.values()):
            for j, system in enumerate(self.systems):
                res[i, j] = metric.compute(data)
        return res

    def _correlate(self, metric_results: np.ndarray) -> np.ndarray:
        """TODO"""
        res = np.corrcoef(metric_results, rowvar=True)
        return res

    def _report(self, metrics, corrcoefs) -> None:
        """TODO"""
        print("Metric Results:\n{metrics}")
        print("Metric Correlation:\n{corrcoefs}")
