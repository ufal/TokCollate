import pytest
import numpy as np

from tokeval.metrics import build_metric, METRIC_REGISTRY, TokEvalMultilingualMetric


@pytest.mark.parametrize("metric", METRIC_REGISTRY.keys())
def test_score_return_value(foo_data, foo_system, metric):
    """TODO"""
    metric = build_metric(metric=metric, metric_label=f"{metric}_score")
    res = metric.score(foo_data, foo_data.systems, src_lang=foo_data.languages[0], tgt_lang=foo_data.languages[1])
    assert isinstance(res, float)


@pytest.mark.parametrize("metric", METRIC_REGISTRYy.keys())
def test_score_all_return_value(foo_data, foo_system, metric):
    """TODO"""
    metric = build_metric(metric=metric, metric_label=f"{metric}_score_all")
    res = metric.score_all(foo_data, languages=foo_data.langauges)
    assert isinstance(res, np.ndarray)
    if isinstance(metric, TokEvalMultilingualMetric):
        assert res.ndim == 3
    else:
        assert res.ndim == 1
