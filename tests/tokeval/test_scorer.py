from pathlib import Path

import numpy as np
import pytest
from omegaconf import OmegaConf

from tokeval.scorer import ScorerResultsSaver, TokEvalScorer


@pytest.fixture()
def foo_config(foo_config_file):
    """TODO"""
    return OmegaConf.load(foo_config_file)


@pytest.fixture()
def foo_scorer(foo_config):
    """TODO"""
    return TokEvalScorer(config=foo_config)


@pytest.mark.parametrize("save_results", [False, True])
def test_scorer_default_run(foo_config, save_results):
    """TODO"""
    if not save_results:
        foo_config.scorer.output_dir = None

    scorer = TokEvalScorer(config=foo_config)
    scorer.run()


def test_scorer_saved_results_exist(foo_scorer):
    """TODO"""
    foo_scorer.run()

    for filename in [ScorerResultsSaver._metadata_filename, ScorerResultsSaver._results_filename]:  # noqa: SLF001
        path = Path(foo_scorer.output_dir, filename)
        assert path.exists()


@pytest.mark.parametrize("metric_type", TokEvalScorer._metric_n_dim)  # noqa: SLF001
def test_scorer_correlate_no_or_single_metric(foo_scorer, metric_type):
    """TODO"""
    metric = next(iter(foo_scorer.metrics.values()))
    foo_scorer.metrics = {metric.metric_label: metric}
    results = foo_scorer.run()

    # empty dict when no metrics in the category
    if metric_type not in metric.metric_label:
        assert results["correlation"][metric_type] is None
    # single float value when computing correlation with only a single metric
    else:
        assert results["correlation"][metric_type].ndim == 0


@pytest.mark.parametrize("metric_type", TokEvalScorer._metric_n_dim)  # noqa: SLF001
def test_scorer_correlation_matrix_size(foo_scorer, metric_type):
    """TODO"""
    results = foo_scorer.run()
    ref_shape = [len([metric for metric in foo_scorer.metrics if metric_type in metric])] * 2
    assert results["correlation"][metric_type].shape == np.zeros(ref_shape).shape


@pytest.mark.parametrize("metric_type", TokEvalScorer._metric_n_dim)  # noqa: SLF001
def test_scorer_metric_marix_size(foo_scorer, metric_type):
    """TODO"""
    results = foo_scorer.run()
    for metric_label in foo_scorer.metrics:
        if metric_type not in metric_label:
            continue
        if metric_type == "mono":
            ref_shape = [len(foo_scorer.systems)]
        elif metric_type == "multi":
            ref_shape = [len(foo_scorer.systems), len(foo_scorer.languages), len(foo_scorer.languages)]
        assert results["metrics"][metric_label].shape == np.zeros(ref_shape).shape
