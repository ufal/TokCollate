from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def input_dir(tmp_path_factory):
    """Stores input files during testing."""
    return Path(tmp_path_factory.mktemp("input"))


@pytest.fixture(scope="session")
def output_dir(tmp_path_factory):
    """Stores output files during testing."""
    return Path(tmp_path_factory.mktemp("output"))


@pytest.fixture(scope="session")
def config_dir(tmp_path_factory):
    """Stores config files during testing."""
    return Path(tmp_path_factory.mktemp("config"))
