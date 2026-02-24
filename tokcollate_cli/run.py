#!/usr/bin/env python3
import logging
import sys

from omegaconf import DictConfig

from tokeval.options import parse_args
from tokeval.scorer import TokEvalScorer

logger = logging.getLogger(__name__)


def main(config: DictConfig) -> int:
    """Main TokEval entry point. Executes the scoring based on the provided config file."""
    scorer = TokEvalScorer(config=config)
    scorer.run()
    return 0


if __name__ == "__main__":
    sys.exit(main(parse_args()))
