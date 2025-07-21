import pytest

from tokeval import metrics


@pytest.fixture(scope="module")
def foo_metric_cls():
    """Mock class that inherits from TokEvalMetric."""

    class FooMetric(metrics.TokEvalMetric):
        pass

    return FooMetric


def test_register_metric_name(clear_registries, foo_metric_cls):  # noqa: ARG001
    """Tests metric class name registration."""
    metric_name = "foo"
    metrics.register_metric(metric_name)(foo_metric_cls)
    assert metric_name in metrics.METRIC_REGISTRY


def test_register_metric_incorrect_subclass_fail(clear_registries):  # noqa: ARG001
    """Fail when the registered metric class does not inherit from TokEvalMetric."""

    class FooMetric:
        pass

    with pytest.raises(TypeError):
        metrics.register_metric("foo")(FooMetric)


def test_register_metric_duplicate_class_fail(clear_registries, foo_metric_cls):  # noqa: ARG001
    """Fail when trying to register duplicate metric class."""
    metrics.register_metric("foo")(foo_metric_cls)
    with pytest.raises(ValueError):  # noqa: PT011
        metrics.register_metric("bar")(foo_metric_cls)


def test_register_metric_duplicate_name_fail(clear_registries, foo_metric_cls):  # noqa: ARG001
    """Fail when trying to register duplicate metric name."""

    class BarMetric(metrics.TokEvalMetric):
        pass

    metrics.register_metric("foo")(foo_metric_cls)
    with pytest.raises(ValueError):  # noqa: PT011
        metrics.register_metric("foo")(BarMetric)
