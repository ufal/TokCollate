from pathlib import Path

import pytest
from omegaconf import OmegaConf

PIPELINE_TRAIN_CONFIGS = [
    Path("config", "config.basic.yml"),
]


@pytest.fixture(scope="session", params=PIPELINE_TRAIN_CONFIGS)
def config_file(config_dir, input_dir, output_dir, system_output_tiny, request):
    """TODO"""
    config = OmegaConf.load(request.param)

    config.evaluator["input_dir"] = str(input_dir)
    config.evaluator["output_dir"] = str(output_dir)
    config.evaluator["systems"] = [system_output_tiny.stem]

    config_file = Path(config_dir, "config.basic.yml")
    OmegaConf.save(config=config, f=config_file)
    return config_file
