import pytest

from tokcollate import metrics


@pytest.fixture(scope="module")
def foo_metric_cls():
    """Mock class that inherits from TokCollateMetric."""

    class FooMetric(metrics.TokCollateMetric):
        pass

    return FooMetric


def test_register_metric_name(clear_registries, foo_metric_cls):  # noqa: ARG001
    """Tests metric class name registration."""
    metric_name = "foo"
    metrics.register_metric(metric_name)(foo_metric_cls)
    assert metric_name in metrics.METRIC_REGISTRY


def test_register_metric_incorrect_subclass_fail(clear_registries):  # noqa: ARG001
    """Fail when the registered metric class does not inherit from TokCollateMetric."""

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

    class BarMetric(metrics.TokCollateMetric):
        pass

    metrics.register_metric("foo")(foo_metric_cls)
    with pytest.raises(ValueError):  # noqa: PT011
        metrics.register_metric("foo")(BarMetric)


def test_list_registered_metrics(clear_registries):  # noqa: ARG001
    """Test listing registered metrics."""

    class FooMetric(metrics.TokCollateMetric):
        pass

    metrics.register_metric("foo")(FooMetric)

    class BarMetric(metrics.TokCollateMetric):
        pass

    metrics.register_metric("bar")(BarMetric)

    assert set(metrics.list_metrics()) == {"foo", "bar"}


def test_list_instantiated_metric_labels(clear_registries):  # noqa: ARG001
    """Test listing of all instantiated metric labels."""

    class FooMetric(metrics.TokCollateMetric):
        pass

    metrics.register_metric("foo")(FooMetric)

    metric_labels = ["inst_a", "inst_b"]
    for metric_label in metric_labels:
        metrics.build_metric(metric="foo", metric_label=metric_label)

    assert set(metrics.list_metric_instance_labels()) == set(metric_labels)
