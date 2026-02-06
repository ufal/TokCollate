#!/usr/bin/env python3
import itertools
import sys

from .train_tokenizer_and_encode_text import main as train_and_encode

PARAMETERS = {
    vocab_size: [(x + 1) * 4000 for x in range(8)],
    input_sentence_size: [10000000],
    shuffle_input_sentence: [true],
    train_extremely_large_corpus: [false],
    byte_fallback: [true, false]
}


def get_parameter_combinations() -> list[dict[str, str]]:
    """TODO"""
    parameter_lists = [
        [f"{key=value}" for value in PARAMETERS[key]]
        for key in PARAMETERS.keys()
    ]
    parameter_combinations = list(itertools.product(*parameter_lists))
    param_dicts = []
    for params in parameter_combinations:
        param_dict = {}
        for param in params:
            key, value = param.split("=")
            param_dict[key] = value
            param_dicts.append(param_dict)
    return param_dicts


def main(args: argparse.Namespace) -> int:
    """TODO"""
    for p_dict in get_parameter_combinations():
        print(p_dict)


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train and evaluate various tokenizer configurations on a given data using TokEval."
    )
    parser.add_argument("--train-datasets", type=str, nargs="+", required=True, help="List of training corpora.")
    parser.add_argument(
        "--valid-datasets",
        type=str,
        nargs="+",
        required=True,
        help="List of corpora to parse using the trained tokenizers."
    )
    parser.add_argument("--output_dir", type=str, required=True, help="Root directory for saving any created files.")
    return parser.parse_args(argv)


if __name__ == "__main__":
    sys.exit(main(parse_args(sys.argv[1:])))
