#!/usr/bin/env python3
import logging
import sys
from argparse import Namespace

from tokeval.evaluator import Evaluator
from tokeval.options import parse_args

logger = logging.getLogger(__name__)


def main(args: Namespace) -> int:
    """TODO"""
    evaluator = Evaluator(
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        config_file=args.config_file,
        systems=args.systems,
        system_dataset_suffix=args.system_dataset_suffix,
    )
    evaluator.run()

    return 0


if __name__ == "__main__":
    args = parse_args()
    sys.exit(main(args))
