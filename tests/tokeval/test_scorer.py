import pytest
from omegaconf import OmegaConf

from tokeval.scorer import TokEvalScorer


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
        foo_config.scorer.output_dir = False

    scorer = TokEvalScorer(config=foo_config)
    scorer.run()


def test_scorer_saved_results_exist(foo_scorer):
    """TODO"""
    foo_scorer.run()
    for filename in foo_scorer._filenames.values():
        path = Path(foo_scorer.output_dir, filename)
        assert path.exists()


@pytest.mark.parametrize("metric_type", TokEvalScorer._metric_dims.keys())
def test_scorer_correlation_matrix_size(foo_scorer, metric_type):
    """TODO"""
    results = foo_scorer.run()
    ref_shape = tuple([len([system for system in foo_scorer.systems if metric_type in system])] * 2)
    assert results["correlation"][metric_type].shape == ref_shape


@pytest.mark.parametrize("metric_type", TokEvalScorer._metric_dims.keys())
def test_scorer_metric_marix_size(foo_scorer, metric_type):
    """TODO"""
    results = foo_scorer.run()
    for metric_label in self.metrics.keys():
        if metric_type == "mono":
            ref_shape = tuple([len(foo_scorer.systems) * len(foo_scorer.languages)])
        elif metric_type == "multi":
            ref_shape = tuple([len(foo_scorer.systems), len(foo_scorer.languages), len(foo_scorer.languages)])
        assert results["metrics"][metric_label].shape == ref_shape
