from pathlib import Path

import pytest

from tests.utils import FooMetric
from tokcollate.data import TokCollateData
from tokcollate.utils import open_file, remove_dir

LANGUAGES = ["en", "fr"]


@pytest.fixture(params=[f"{lang}_{metric_f}" for lang in ["mono", "multi"] for metric_f in ["none", "input", "ref"]])
def foo_data(request, foo_text_tiny, tmp_path_factory):
    """TODO"""

    def create_file(file_path, text):  # noqa: ANN202
        if not file_path.parent.exists():
            file_path.parent.mkdir(parents=True)
        with open_file(file_path, "w") as fh:
            print(text, file=fh)

    data = {
        "params": request.param,
        "systems": ["foo_sys_1", "foo_sys_2"],
        "input_dir": Path(tmp_path_factory.mktemp("foo_input")),
        "filenames": [],
        "input_file_stem": "input",
        "reference_file_stem": "reference",
        "file_suffix": "txt",
    }

    for system in data["systems"]:
        if "mono" in request.param:
            data["languages"] = []
            data["filenames"].append(f"{system}." + data["file_suffix"])
            create_file(Path(data["input_dir"], data["filenames"][-1]), foo_text_tiny)
        elif "multi" in request.param:
            data["languages"] = LANGUAGES
            for lang in LANGUAGES:
                data["filenames"].append(f"{lang}." + data["file_suffix"])
                create_file(Path(data["input_dir"], f"{system}", data["filenames"][-1]), foo_text_tiny)
        else:
            pytest.fail(f"Unknown system label ({request.param}).")

    if "input" in request.param:
        data["filenames"].append(data["input_file_stem"] + "." + data["file_suffix"])
        create_file(Path(data["input_dir"], data["filenames"][-1]), foo_text_tiny)
    elif "ref" in request.param:
        data["filenames"].append(data["reference_file_stem"] + "." + data["file_suffix"])
        create_file(Path(data["input_dir"], data["filenames"][-1]), foo_text_tiny)
    elif "none" in request.param:
        pass
    else:
        pytest.fail(f"Unknown metric label ({request.param})")

    yield data
    remove_dir(data["input_dir"])


@pytest.fixture()
def foo_tokcollate_data_obj(foo_data):
    foo_metric = FooMetric(has_input=("input" in foo_data["params"]), has_reference=("ref" in foo_data["params"]))
    return TokCollateData(
        data_dir=foo_data["input_dir"],
        systems=foo_data["systems"],
        languages=foo_data["languages"],
        metrics=[foo_metric],
        file_suffix=foo_data["file_suffix"],
        input_file_stem=foo_data["input_file_stem"],
        reference_file_stem=foo_data["reference_file_stem"],
    )


def test_list_systems(foo_data, foo_tokcollate_data_obj):
    """TODO"""
    assert set(foo_data["systems"]) == set(foo_tokcollate_data_obj.systems)


def test_list_languages(foo_data, foo_tokcollate_data_obj):
    """TODO"""
    assert set(foo_data["languages"]) == set(foo_tokcollate_data_obj.languages)


def test_load_data(foo_tokcollate_data_obj):
    """TODO"""
    assert isinstance(foo_tokcollate_data_obj, TokCollateData)


def test_get_full_text(foo_data, foo_tokcollate_data_obj, foo_text_tiny_tokenized):
    """TODO"""
    text = foo_tokcollate_data_obj.get_full_text()
    assert text is not None
    assert len(text) == len(foo_data["filenames"]) * len(foo_text_tiny_tokenized)


def test_get_metric_text(foo_data, foo_tokcollate_data_obj):
    """TODO"""
    if "input" in foo_data["params"]:
        assert foo_tokcollate_data_obj.get_input_text() is not None
    elif "ref" in foo_data["params"]:
        assert foo_tokcollate_data_obj.get_reference_text() is not None
    else:
        with pytest.raises(AttributeError):
            assert foo_tokcollate_data_obj.get_input_text() is None
        with pytest.raises(AttributeError):
            assert foo_tokcollate_data_obj.get_reference_text() is None


def test_get_system_texts(foo_data, foo_tokcollate_data_obj, foo_text_tiny_tokenized):
    """TODO"""
    for sys in foo_data["systems"]:
        text = foo_tokcollate_data_obj.get_system_text(sys, language=None)
        num_subsets = len(foo_data["languages"])
        if not foo_data["languages"]:
            num_subsets = 1
        assert text is not None
        assert len(text) == num_subsets * len(foo_text_tiny_tokenized)


def test_get_system_language_text(foo_data, foo_tokcollate_data_obj, foo_text_tiny_tokenized):
    """TODO"""
    for sys in foo_data["systems"]:
        for lang in foo_data["languages"]:
            text = foo_tokcollate_data_obj.get_system_text(sys, language=lang)
            assert text is not None
            assert len(text) == len(foo_text_tiny_tokenized)
