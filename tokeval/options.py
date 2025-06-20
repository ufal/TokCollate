import argparse
import logging
from collections.abc import Sequence
from pathlib import Path

from omegaconf import DictConfig, OmegaConf

from tokeval.utils import file_path

logger = logging.getLogger(__name__)


def parse_args(argv: Sequence[str]) -> DictConfig:
    """TODO"""
    parser = argparse.ArgumentParser(description="TokEval: Tokenization Evaluation.")
    parser.add_argument("--config-file", type=file_path, required=True, help="Evaluator configuration YAML file.")
    parser.add_argument(
        "--log-level", type=str, choices=["info", "debug"], default="info", help="Current logging level."
    )
    args, unparsed = parser.parse_known_args(argv)
    config = create_config(args.config_file, unparsed)
    for arg in vars(args):
        setattr(config, arg, getattr(args, arg))
    return config


def create_config(config_file: Path, argv: Sequence[str] | None = None) -> DictConfig:
    """TODO"""
    config = OmegaConf.load(config_file)
    if argv is not None:
        config = OmegaConf.merge(config, OmegaConf.from_cli(argv))
    return config
