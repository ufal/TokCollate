from pathlib import Path

import pytest
from omegaconf import OmegaConf


@pytest.fixture(scope="session")
def foo_config_file(config_dir, input_dir, output_dir, system_outputs_tiny_multilingual):
    """TODO"""
    languages = [path.stem.split(".")[-1] for path in system_outputs_tiny_multilingual]
    config = OmegaConf.create(
        {
            "scorer": {
                "input_dir": str(input_dir),
                "output_dir": str(output_dir),
                "systems": [".".join(path.stem.split(".")[:-1]) for path in system_outputs_tiny_multilingual],
                "languages": languages,
                "file_suffix": "txt",
                "metrics": [
                    {"metric": "sequence_length", "metric_label": "metric_foo_mono_1"},
                    {"metric": "token_length", "metric_label": "metric_foo_mono_2"},
                    {"metric": "sequence_ratio", "metric_label": "metric_foo_multi_1"},
                    # {"metric": "XXX", "metric_label": "metric_foo_multi_2"},
                ],
            }
        }
    )

    config_file = Path(config_dir, "config.foo.base.yml")
    OmegaConf.save(config=config, f=config_file)
    return config_file
