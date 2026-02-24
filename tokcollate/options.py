import argparse
import logging
from collections.abc import Sequence
from pathlib import Path

from omegaconf import DictConfig, OmegaConf

from tokcollate.utils import file_path

logger = logging.getLogger(__name__)


def parse_args(argv: Sequence[str]) -> DictConfig:
    """Basic argument parsing method.

    Loads the configuration file given the --config-file option and overwrites the file parameters given
    the OmegaConf-style notation. The resulting config object is later used to configure the scoring pipeline.
    """
    parser = argparse.ArgumentParser(description="TokCollate: Tokenization Evaluation.")
    parser.add_argument(
        "--config-file", type=file_path, required=True, help="TokCollate execution configuration YAML file."
    )
    parser.add_argument(
        "--log-level", type=str, choices=["info", "debug"], default="info", help="Current logging level."
    )
    args, unparsed = parser.parse_known_args(argv)
    config = create_config(args.config_file, unparsed)
    for arg in vars(args):
        # add the already parsed arguments to the config file
        setattr(config, arg, getattr(args, arg))
    return config


def create_config(config_file: Path, argv: Sequence[str] | None = None) -> DictConfig:
    """Merge the provided configuration file with the configuration parameters provided via CLI.

    Args:
        config_file (Path): file containing the execution configuration
        argv: additional arguments not parsed by the parse_args method. Used for overwriting the values inside the
            config_file

    Returns:
        OmegaConf-style nested dictionary with execution configuration.
    """
    config = OmegaConf.load(config_file)
    if argv is not None:
        config = OmegaConf.merge(config, OmegaConf.from_cli(argv))
    return config
