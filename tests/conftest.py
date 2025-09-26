import pytest

from tokeval import metrics

pytest_plugins = ["fixtures.configs", "fixtures.data", "fixtures.directories"]


@pytest.fixture()
def clear_instance_registry(monkeypatch):  # noqa: PT004
    """Clear the initialized metric instances (to reuse metric labels)."""
    monkeypatch.setattr(metrics, "METRIC_INSTANCE_REGISTRY", {})


@pytest.fixture()
def clear_registries(monkeypatch):  # noqa: PT004
    """Clear all the registries."""
    monkeypatch.setattr(metrics, "METRIC_REGISTRY", {})
    monkeypatch.setattr(metrics, "METRIC_INSTANCE_REGISTRY", {})
    monkeypatch.setattr(metrics, "METRIC_CLASS_NAMES", set())
