from pathlib import Path

import pytest

from tokeval.utils import open_file


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
def system_output_tiny(input_dir, foo_text_tiny):
    """TODO"""
    file_path = Path(input_dir, "system_1.out")
    with open_file(file_path, "w") as fh:
        print(foo_text_tiny, file=fh)
    return file_path
