#!/usr/bin/env python3
import argparse
import logging
import sentencepiece as spm
import sys

from collections.abc import Sequence
from pathlib import Path
from tokcollate.utils import concat_files

logger = logging.getLogger(__name__)

MODEL_DIR = "model"
MODEL_PREFIX = "model"
TOKENIZED_DIR = "tokenized"


def train_tokenizer(
    model_dir: Path,
    train_datasets: list[Path],
    tokenizer_args: dict[str, str],
) -> spm.SentencePieceProcessor:
    """Train the tokenizer from scratch using the provided data and return the trained model

    Based on the tutorial at:
        https://pypi.org/project/sentencepiece/

    Args:
        TODO
    """
    train_concat_path = Path(model_dir, "train.txt")
    concat_files(train_datasets, train_concat_path)

    model_path_prefix = Path(model_dir, MODEL_PREFIX)
    logger.info("Training model %s...", model_path_prefix)
    spm.SentencePieceTrainer.train(
        input=train_concat_path,
        bos_id=-1,
        eos_id=0,
        unk_id=1,
        model_prefix=model_path_prefix,
        **tokenizer_args
    )
    return spm.SentencePieceProcessor(model_file=f"{model_path_prefix}.model")


def main(args: argparse.Namespace) -> int:
    output_dir = Path(args.output_dir)
    if not output_dir.exists():
        logger.info("Directory %s does not exists. Creating...", output_dir)
        output_dir.mkdir(parents=True)

    # Train tokenizer
    model_dir = Path(output_dir, MODEL_DIR)
    model_path = Path(model_dir, "{MODEL_PREFIX}.model")
    if not model_path.exists():
        logger.info("Training tokenizer model...")
        if not model_dir.exists():
            model_dir.mkdir()
        tokenizer_args = None
        if args.tokenizer_args is not None:
            tokenizer_args = {}
            for arg in args.tokenizer_args.split(","):
                arg_key, arg_value = arg.split("=")
                tokenizer_args[arg_key] = arg_value
        model = train_tokenizer(
            model_dir,
            [Path(dset) for dset in args.train_datasets],
            tokenizer_args,
        )
    else:
        logger.info("Found an existing tokenizer at %s. Loading...", model_path)
        model = spm.SentencePieceProcessor(model_file=model_path)

    # Tokenize datasets
    tokenized_dir = Path(output_dir, TOKENIZED_DIR)
    if not tokenized_dir.exists():
        tokenized_dir.mkdir()

    for dataset in args.valid_datasets:
        dataset_path = Path(dataset)
        tokenized_path = Path(tokenized_dir, dataset_path.name)
        if tokenized_path.exists():
            logger.info("Output file %s exists. Skipping...", tokenized_path)
            continue

        # TODO(varisd): do we need to change input/output newline handling?
        logger.info("Processing dataset %s...", dataset_path)
        with dataset_path.open("r") as fh_in:
            with tokenized_path.open("w") as fh_out:
                for line in fh_in:
                    print(" ".join(model.encode(line.strip(), out_type=str)), file=fh_out)
    return 0


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a tokenizer and evaluate it using TokCollate")
    parser.add_argument("--tokenizer-args", type=str, default=None, help="Tokenizer training parameters.")
    parser.add_argument("--train-datasets", type=str, nargs="+", required=True, help="List of training corpora.")
    parser.add_argument(
        "--valid-datasets",
        type=str,
        nargs="+",
        required=True,
        help="List of corpora to parse using the trained tokenizer."
    )
    parser.add_argument("--output-dir", type=str, required=True, help="Directory for saving any created output.")

    return parser.parse_args(argv)


if __name__ == "__main__":
    sys.exit(main(parse_args(sys.argv[1:])))
