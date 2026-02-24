#!/usr/bin/env python3
import logging
import sys

from omegaconf import DictConfig

from tokcollate.options import parse_args
from tokcollate.scorer import TokCollateScorer

logger = logging.getLogger(__name__)


def main(config: DictConfig) -> int:
    """Main TokCollate entry point. Executes the scoring based on the provided config file."""
    scorer = TokCollateScorer(config=config)
    scorer.run()
    return 0


if __name__ == "__main__":
    sys.exit(main(parse_args()))
