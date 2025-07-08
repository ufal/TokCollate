from pathlib import Path
from typing import List

import pytest
from attrs import define, field

from tokeval.metrics import TokEvalMetric, build_metric, register_metric


@register_metric("foo")
@define(kw_only=True)
class FooMetric(TokEvalMetric):
    """Mock metric for ligthweight unit testing.

    Waits for the SLEEP_TIME seconds and prints the output filenames into the respective output files.
    """

    def get_command_targets(self) -> List[Path]:
        return [Path(self.output_dir, f"out_{x}.txt") for x in ["A", "B"]]

    def get_output_str(self, outfile: Path) -> str:
        return outfile.stem + outfile.suffix

    def command(self, target_file: Path) -> None:
        time.sleep(self.sleep_time)
        with target_file.open("w") as fh:
            print(self.get_output_str(target_file), file=fh)

    def _generate_cmd_file_contents(self) -> str:
        cmd = super()._generate_cmd_file_contents()
        cmd_split = cmd.split("\n")
        cmd_split = [cmd_split[0], "import tests.fixtures.steps", *cmd_split[1:]]
        return "\n".join(cmd_split)


@pytest.fixture()
def foo_metric(tmp_path_factory):
    """Basic mock step without dependencies."""
    pipeline_dir = tmp_path_factory.mktemp("foo.pipeline")
    step = build_step(step="foo", step_label="foo.test", pipeline_dir=pipeline_dir)
    yield step

    teardown_step(step)
