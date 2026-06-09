"""Tests for the Pointwise Mutual Information metric."""

from tokcollate.metrics import build_metric


def test_pmi_basic():
    """Test basic PMI computation with simple parallel data."""

    # Create simple test data
    # Source: "a b" appears twice, target: "x y" appears twice
    # This should create a strong association between a-x, a-y, b-x, b-y
    text_src = [["a", "b"], ["a", "b"], ["c"]]
    text_tgt = [["x", "y"], ["x", "y"], ["z"]]

    # We'll test using the internal methods directly
    metric = build_metric(
        metric="pointwise_mutual_information",
        metric_label="test_pmi",
        vocab_most_common=None,
        min_cooccurrence=1,
        aggregation="mean",
    )

    from collections import Counter

    vocab_src = Counter({"a": 2, "b": 2, "c": 1})
    vocab_tgt = Counter({"x": 2, "y": 2, "z": 1})

    pmi_scores = metric._compute_pmi(text_src, text_tgt, vocab_src, vocab_tgt)

    # Should have PMI scores for co-occurring pairs
    assert len(pmi_scores) > 0
    assert all(isinstance(score, float) for score in pmi_scores)


def test_pmi_aggregation_methods():
    """Test different aggregation methods for PMI."""
    pmi_scores = [1.0, 2.0, 3.0, 4.0, 5.0]

    metric_mean = build_metric(metric="pointwise_mutual_information", metric_label="test_pmi_mean", aggregation="mean")
    assert metric_mean._aggregate_pmi(pmi_scores) == sum(pmi_scores) / len(pmi_scores)

    metric_sum = build_metric(metric="pointwise_mutual_information", metric_label="test_pmi_sum", aggregation="sum")
    assert metric_sum._aggregate_pmi(pmi_scores) == sum(pmi_scores)

    metric_median = build_metric(
        metric="pointwise_mutual_information", metric_label="test_pmi_median", aggregation="median"
    )
    assert metric_median._aggregate_pmi(pmi_scores) == (len(pmi_scores) // 2) + 1


def test_pmi_min_cooccurrence():
    """Test that min_cooccurrence filters rare pairs."""
    text_src = [["a"], ["b"], ["c"]]
    text_tgt = [["x"], ["y"], ["z"]]

    from collections import Counter

    vocab_src = Counter({"a": 1, "b": 1, "c": 1})
    vocab_tgt = Counter({"x": 1, "y": 1, "z": 1})

    # With min_cooccurrence=1, should get all pairs
    metric_min1 = build_metric(
        metric="pointwise_mutual_information", metric_label="test_pmi_min1", min_cooccurrence=1, aggregation="mean"
    )
    pmi_scores_min1 = metric_min1._compute_pmi(text_src, text_tgt, vocab_src, vocab_tgt)

    # With min_cooccurrence=2, should filter out single occurrences
    metric_min2 = build_metric(
        metric="pointwise_mutual_information", metric_label="test_pmi_min2", min_cooccurrence=2, aggregation="mean"
    )
    pmi_scores_min2 = metric_min2._compute_pmi(text_src, text_tgt, vocab_src, vocab_tgt)

    # Should have fewer or equal scores with higher min_cooccurrence
    # (or just [0.0] if all filtered out)
    assert len(pmi_scores_min2) <= len(pmi_scores_min1)


def test_pmi_identical_sentences():
    """Test PMI when source and target are identical."""
    text_same = [["a", "b", "c"], ["d", "e", "f"]]

    from collections import Counter

    vocab = Counter({"a": 1, "b": 1, "c": 1, "d": 1, "e": 1, "f": 1})

    metric = build_metric(metric="pointwise_mutual_information", metric_label="test_pmi_identical", aggregation="mean")

    pmi_scores = metric._compute_pmi(text_same, text_same, vocab, vocab)

    # Should have positive PMI scores since tokens co-occur with themselves
    assert len(pmi_scores) > 0
    avg_pmi = metric._aggregate_pmi(pmi_scores)
    assert avg_pmi > 0  # Positive PMI indicates association


def test_pmi_empty_input():
    """Test PMI with empty input."""
    from collections import Counter

    metric = build_metric(metric="pointwise_mutual_information", metric_label="test_pmi_empty", aggregation="mean")

    vocab = Counter()
    pmi_scores = metric._compute_pmi([], [], vocab, vocab)

    # Should return [0.0] for empty input
    assert pmi_scores == [0.0]
    assert metric._aggregate_pmi(pmi_scores) == 0.0
