#!/usr/bin/env python3
import logging
import sys

from omegaconf import DictConfig

from tokeval.evaluator import Evaluator
from tokeval.options import parse_args

logger = logging.getLogger(__name__)


def main(config: DictConfig) -> int:
    """Main TokEval entry point. Executes the evaluation based on the provided config file."""
    evaluator = Evaluator(config=config)
    evaluator.run()
    return 0


if __name__ == "__main__":
    sys.exit(main(parse_args()))
