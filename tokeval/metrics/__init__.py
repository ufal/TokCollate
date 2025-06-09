import importlib
from collections.abc import Callable
from pathlib import Path
from typing import Optional

from .tokeval_metric import TokEvalMetric

__all__ = [
    "TokEvalMetric",
]

METRIC_REGISTRY = {}
METRIC_INSTANCE_REGISTRY = {}
METRIC_CLASS_NAMES = set()


def build_metric(metric: str, metric_label: str, **kwargs) -> TokEvalMetric:  # noqa: ANN003
    """TODO"""
    if metric_label is not None and metric_label in METRIC_INSTANCE_REGISTRY:
        return METRIC_INSTANCE_REGISTRY[metric_label]

    metric_instance = get_metric(metric).build_metric(metric, metric_label, **kwargs)

    METRIC_INSTANCE_REGISTRY[metric_instance.metric_label] = metric_instance
    return metric_instance


def register_metric(name: str) -> Callable:
    """
    New metric modules can be added to TokEval with the
    :func:`~tokeval.metric_modules.register_metric` function decorator.

    For example:

        @register_metric('chars_per_token_metric')
        class CharPerTokenmetric(TokEvalMetric):
            (...)

    Args:
        name (str): the name of the metric module
    """

    def register_metric_cls(cls: TokEvalMetric) -> TokEvalMetric:
        if name in METRIC_REGISTRY:
            err_msg = f"Cannot register duplicate metric ({name})"
            raise ValueError(err_msg)
        if not issubclass(cls, TokEvalMetric):
            err_msg = f"metric module ({name}: {cls.__name__}) must extend TokEvalMetric"
            raise TypeError(err_msg)
        if cls.__name__ in METRIC_CLASS_NAMES:
            err_msg = f"Cannot register metric module with duplicate class name ({cls.__name__})"
            raise ValueError(err_msg)
        METRIC_REGISTRY[name] = cls
        METRIC_CLASS_NAMES.add(cls.__name__)
        return cls

    return register_metric_cls


def get_metric(name: str) -> TokEvalMetric:
    return METRIC_REGISTRY[name]


metric_module_dir = Path(__file__).parents[0]
for file in metric_module_dir.iterdir():
    if (
        not file.stem.startswith("_")
        and not file.stem.startswith(".")
        and file.name.endswith("py")
        and not file.is_dir()
    ):
        metric_name = file.stem if file.name.endswith(".py") else file
        importlib.import_module("tokeval.metrics." + str(metric_name))
