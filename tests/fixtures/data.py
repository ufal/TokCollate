from pathlib import Path

import pytest

from tokeval.utils import open_file


@pytest.fixture(scope="session")
def languages():
    """TODO"""
    return ["en", "fr"]


@pytest.fixture(scope="session")
def foo_text_tiny():
    """TODO"""
    return "\n".join(  # noqa: FLY002
        [
            "the colorless ideas slept furiously",
            "pooh slept all nigth",
            "working class hero is something to be",
            "I am the working class walrus",
            "walrus for president",
        ]
    )


@pytest.fixture(scope="session")
def foo_text_tiny_tokenized(foo_text_tiny):
    """TODO"""
    return [line.split(" ") for line in foo_text_tiny.split("\n")]


@pytest.fixture(scope="session")
def foo_system_output_tiny(input_dir, foo_text_tiny):
    """TODO"""
    file_path = Path(input_dir, "system_1.txt")
    with open_file(file_path, "w") as fh:
        print(foo_text_tiny, file=fh)
    return file_path


@pytest.fixture(scope="session")
def foo_system_output_tiny_multilingual(input_dir, foo_text_tiny, languages):
    """TODO"""
    paths = []
    Path(input_dir, "system_multi_1").mkdir()
    for lang in languages:
        paths.append(Path(input_dir, "system_multi_1", f"{lang}.txt"))
        with open_file(paths[-1], "w") as fh:
            print(foo_text_tiny, file=fh)
    return paths


@pytest.fixture(scope="session")
def foo_dataset(input_dir, foo_system_output_tiny_multilingual, languages):
    system_name = str(foo_system_output_tiny_multilingual[0].parent).split("/")[-1]
    return {
        "data_dir": input_dir,
        "systems": [str(path.parent).split("/")[-1] for path in foo_system_output_tiny_multilingual],
        "languages": languages,
    }
