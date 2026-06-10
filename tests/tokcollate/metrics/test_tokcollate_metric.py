import numpy as np
import pytest
from attrs import define, field

from tokcollate.data import TokCollateData
from tokcollate.metrics import METRIC_REGISTRY, TokCollateMultilingualMetric, build_metric
from tokcollate.metrics.tokcollate_metric import AggMode, TokCollateMetric

MONOLINGUAL_DIM = 2
MULTILINGUAL_DIM = 3


class NoAggregationMetric(TokCollateMetric):
    pass


@define(kw_only=True)
class WrongAggregationTypeMetric(TokCollateMetric):
    aggregation: str = field(converter=str)


def test_no_aggregation_fail():
    """TODO"""
    scores = [1.0, 2.0, 3.0]
    metric = NoAggregationMetric(metric="test_no_aggregation", metric_label="test_no_aggregation_inst")
    with pytest.raises(NotImplementedError):
        metric._aggregate_scores(scores)


def test_wrong_aggregation_type_fail():
    scores = [1.0, 2.0, 3.0]
    metric = WrongAggregationTypeMetric(
        metric="test_wrong_aggregation", metric_label="test_wrong_aggregation_inst", aggregation="mean"
    )
    with pytest.raises(TypeError):
        metric._aggregate_scores(scores)


@pytest.mark.parametrize("agg_mode", list(AggMode))
def test_aggregation_methods(agg_mode):
    """Test different aggregation methods."""
    scores = [1.0, 2.0, 3.0, 4.0, 5.0]

    if agg_mode == "mean":
        metric = build_metric(
            metric="pointwise_mutual_information", metric_label="test_agg_mode_mean", aggregation="mean"
        )
        assert metric._aggregate_scores(scores) == sum(scores) / len(scores)

    if agg_mode == "sum":
        metric = build_metric(
            metric="pointwise_mutual_information", metric_label="test_agg_mode_sum", aggregation="sum"
        )
        assert metric._aggregate_scores(scores) == sum(scores)

    if agg_mode == "var":
        metric = build_metric(
            metric="pointwise_mutual_information", metric_label="test_agg_mode_var", aggregation="var"
        )
        assert metric._aggregate_scores(scores) == sum((np.array(scores) - (sum(scores) / len(scores))) ** 2)

    if agg_mode == "median":
        metric = build_metric(
            metric="pointwise_mutual_information", metric_label="test_agg_mode_median", aggregation="median"
        )
        assert metric._aggregate_scores(scores) == (
            (scores[len(scores) // 2] + scores[(len(scores) // 2) - (1 - len(scores) % 2)]) / 2
        )


@pytest.mark.parametrize("metric", METRIC_REGISTRY.keys())
def test_score_return_value(foo_dataset, metric):
    """TODO"""
    te_metric = build_metric(metric=metric, metric_label=f"{metric}_score")
    te_data = TokCollateData(metrics=[te_metric], **foo_dataset)
    if isinstance(te_metric, TokCollateMultilingualMetric):
        res = te_metric.score(te_data, te_data.systems[0], src_lang=te_data.languages[0], tgt_lang=te_data.languages[1])
    else:
        res = te_metric.score(te_data, te_data.systems[0], language=te_data.languages[0])
    assert isinstance(res, float)


@pytest.mark.parametrize("metric", METRIC_REGISTRY.keys())
def test_score_all_return_value(foo_dataset, metric):
    """TODO"""
    te_metric = build_metric(metric=metric, metric_label=f"{metric}_score_all")
    te_data = TokCollateData(metrics=[te_metric], **foo_dataset)
    res = te_metric.score_all(te_data, systems=foo_dataset["systems"], languages=te_data.languages)
    assert isinstance(res, np.ndarray)
    if isinstance(te_metric, TokCollateMultilingualMetric):
        assert res.ndim == MULTILINGUAL_DIM
    else:
        assert res.ndim == MONOLINGUAL_DIM
