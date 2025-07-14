import pytest

from tokeval_cli import main


def test_run_default_values(config_file):
    """Execute 'run' command with default values (required values are provided)."""
    cmd = ["run", "--config-file", str(config_file)]

    rc = main(cmd)
    assert rc == 0


def test_run_missing_required_values_fail():
    """Fail 'run' execution when required values are missing."""
    cmd = ["run"]
    with pytest.raises(SystemExit):
        main(cmd)
