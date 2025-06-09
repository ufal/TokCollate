import argparse
import logging
from collections.abc import Sequence

from tokeval.utils import file_path

logger = logging.getLogger(__name__)


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    """TODO"""
    parser = argparse.ArgumentParser(description="TokEval: Tokenization Evaluation.")

    parser.add_argument("--input-dir", type=file_path, required=True, help="Directory containing input files.")
    parser.add_argument("--output-dir", type=file_path, required=True, help="TokEval output directory.")

    parser.add_argument("--systems", required=True, nargs="+", help="List of the evaluated systems.")
    parser.add_argument(
        "--system-dataset-suffix", type=str,
        default="out", help="Suffix of the output dataset files from the evaluated systems."
    )
    parser.add_argument("--config-file", type=file_path, required=True, help="Evaluator configuration YAML file.")

    parser.add_argument(
        "--log-level", type=str, choices=["info", "debug"], default="info", help="Current logging level."
    )

    return parser.parse_args(argv)
