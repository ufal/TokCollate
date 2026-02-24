import pytest

from tokcollate.data import LanguageInfo


@pytest.fixture()
def foo_language_info_dict():
    return {
        "name": "Acehnese (Jawi script)",
        "scripts": ["Arab", "Latn"],
        "glottocodes": ["achi1257"],
        "families": "Austronesian",
        "speakers": 3500032,
        "continent": "Asia",
        "wikipedia": "https://en.wikipedia.org/wiki/Acehnese_language",
        "tier": 1,
        "morphology": "isolating",
        "fineweb2": {"Latn": 13810487},
    }


def test_create_instance(foo_language_info_dict):
    inst = LanguageInfo.create_entry(foo_language_info_dict)
    assert isinstance(inst, LanguageInfo)


@pytest.mark.parametrize("null_attr", ["continent", "families", "fineweb2", "speakers", "tier", "wikipedia"])
def test_create_instance_null_attr_pass(foo_language_info_dict, null_attr):
    foo_language_info_dict[null_attr] = None
    inst = LanguageInfo.create_entry(foo_language_info_dict)
    assert isinstance(inst, LanguageInfo)


@pytest.mark.parametrize("null_attr", ["name", "scripts", "glottocodes", "morphology"])
def test_crete_instance_null_attr_fail(foo_language_info_dict, null_attr):
    foo_language_info_dict[null_attr] = None
    with pytest.raises(TypeError):
        LanguageInfo.create_entry(foo_language_info_dict)
