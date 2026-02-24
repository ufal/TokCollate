import importlib
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

from omegaconf import DictConfig

from tokcollate import options

CMD_MODULES = {}


def _print_usage() -> None:
    """Print the TokCollate usage message."""
    print(  # noqa: T201
        f"usage: {sys.argv[0]} " + "{" + ",".join(CMD_MODULES.keys()) + "} [options]",
    )


def parse_args(argv: Sequence[str]) -> DictConfig:
    """Shortcut for the argument parsing, given the subcommand."""
    if not argv:
        _print_usage()
        sys.exit(1)

    cmd = argv[0]
    if cmd not in CMD_MODULES:
        _print_usage()
        sys.exit(1)

    config = options.parse_args(argv[1:])
    config.command = cmd

    return config


def main(argv: Sequence[str]) -> int:
    """Process the CLI arguments and call the specified subcommand main method."""
    config = parse_args(argv)
    if config.log_level == "info":
        logging.basicConfig(level=logging.INFO)
    elif config.log_level == "debug":
        logging.basicConfig(level=logging.DEBUG)
    return CMD_MODULES[config.command].main(config)


cli_dir = Path(__file__).parents[0]
for file in cli_dir.iterdir():
    if (
        not file.stem.startswith("_")
        and not file.stem.startswith(".")
        and file.name.endswith("py")
        and not file.is_dir()
    ):
        cmd_name = file.stem if file.name.endswith(".py") else file

        # Import all the CLI modules and register them for later calls
        importlib.import_module(f"tokcollate_cli.{cmd_name}")
        CMD_MODULES[cmd_name] = sys.modules[f"tokcollate_cli.{cmd_name}"]
