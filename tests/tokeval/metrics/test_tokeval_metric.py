import numpy as np
import pytest

from tokeval.data import TokEvalData
from tokeval.metrics import METRIC_REGISTRY, TokEvalMultilingualMetric, build_metric

MONOLINGUAL_DIM = 2
MULTILINGUAL_DIM = 3


@pytest.mark.parametrize("metric", METRIC_REGISTRY.keys())
def test_score_return_value(foo_dataset, metric):
    """TODO"""
    te_metric = build_metric(metric=metric, metric_label=f"{metric}_score")
    te_data = TokEvalData(metrics=[te_metric], **foo_dataset)
    if isinstance(te_metric, TokEvalMultilingualMetric):
        res = te_metric.score(te_data, te_data.systems[0], src_lang=te_data.languages[0], tgt_lang=te_data.languages[1])
    else:
        res = te_metric.score(te_data, te_data.systems[0], language=te_data.languages[0])
    assert isinstance(res, float)


@pytest.mark.parametrize("metric", METRIC_REGISTRY.keys())
def test_score_all_return_value(foo_dataset, metric):
    """TODO"""
    te_metric = build_metric(metric=metric, metric_label=f"{metric}_score_all")
    te_data = TokEvalData(metrics=[te_metric], **foo_dataset)
    res = te_metric.score_all(te_data, systems=foo_dataset["systems"], languages=te_data.languages)
    assert isinstance(res, np.ndarray)
    if isinstance(te_metric, TokEvalMultilingualMetric):
        assert res.ndim == MULTILINGUAL_DIM
    else:
        assert res.ndim == MONOLINGUAL_DIM
