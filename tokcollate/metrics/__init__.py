import importlib
from collections.abc import Callable
from pathlib import Path

from .tokcollate_metric import TokCollateMetric, TokCollateMultilingualMetric

__all__ = [
    "TokCollateMetric",
    "TokCollateMultilingualMetric",
]

METRIC_REGISTRY = {}
METRIC_INSTANCE_REGISTRY = {}
METRIC_CLASS_NAMES = set()


def build_metric(metric: str, metric_label: str, **kwargs) -> TokCollateMetric:  # noqa: ANN003
    """TODO"""
    if metric_label is not None and metric_label in METRIC_INSTANCE_REGISTRY:
        return METRIC_INSTANCE_REGISTRY[metric_label]

    metric_instance = get_metric(metric).build_metric(metric, metric_label, **kwargs)

    METRIC_INSTANCE_REGISTRY[metric_instance.metric_label] = metric_instance
    return metric_instance


def register_metric(name: str) -> Callable:
    """
    New metric modules can be added to TokCollate with the
    :func:`~tokcollate.metric_modules.register_metric` function decorator.

    For example:

        @register_metric('chars_per_token_metric')
        class CharPerTokenmetric(TokCollateMetric):
            (...)

    Args:
        name (str): the name of the metric module
    """

    def register_metric_cls(cls: TokCollateMetric) -> TokCollateMetric:
        if name in METRIC_REGISTRY:
            err_msg = f"Cannot register duplicate metric ({name})"
            raise ValueError(err_msg)
        if not issubclass(cls, TokCollateMetric):
            err_msg = f"metric module ({name}: {cls.__name__}) must extend TokCollateMetric"
            raise TypeError(err_msg)
        if cls.__name__ in METRIC_CLASS_NAMES:
            err_msg = f"Cannot register metric module with duplicate class name ({cls.__name__})"
            raise ValueError(err_msg)
        METRIC_REGISTRY[name] = cls
        METRIC_CLASS_NAMES.add(cls.__name__)
        return cls

    return register_metric_cls


def list_metrics() -> list[str]:
    """Return a list of available metrics."""
    return METRIC_REGISTRY.keys()


def list_metric_instance_labels() -> list[str]:
    """Return a list of labels associated with available metric instances."""
    return METRIC_INSTANCE_REGISTRY.keys()


def get_metric(name: str) -> TokCollateMetric:
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
        importlib.import_module("tokcollate.metrics." + str(metric_name))
