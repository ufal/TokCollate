# TokEval

A tokenization evaluation suite with interactive visualization that allows quick comparison of tokenizers across languages.

## Features

- **Comprehensive Metrics**: Evaluate tokenizers using multiple metrics including entropy, bits per character, sequence length/ratio, token length, and divergence measures (Jensen-Shannon, Kullback-Liebler)
- **Multi-Language Support**: Built-in support for 200+ languages from FLORES-200 dataset
- **Interactive Visualization**: Web-based interface for exploring and comparing tokenization metrics
- **Flexible Configuration**: YAML-based configuration for customizing evaluation runs

## Quick Start

### 1. Prepare Tokenized Data

Download and tokenize FLORES-200 data with tokenizers from various LLMs:

```bash
cd data/tokenized/flores
snakemake
```

This will download the FLORES-200 dataset and tokenize it using multiple state-of-the-art tokenizers (Llama-4, Gemma-3, Command-A, Qwen, Mistral-3, DeepSeek-V3, and more).

### 2. Analyze the Tokenized Data

Run the evaluation using the example configuration:

```bash
./go.py run --config-file example-config.yml
```

**Warning**: This analysis requires a significant amount of memory (several GB depending on the number of tokenizers and languages).

The results will be saved to the directory specified in your config file (default: `experiments/flores-example/`).

### 3. Visualize the Results

Launch the interactive web interface to explore your results:

```bash
cd frontend
npm install  # First time only
npm run dev
```

The visualization interface will open at `http://localhost:3000`. From there:

1. Click **Import Data** to import the directory with evaluation results.
2. Configure graphs by selecting tokenizers, metrics, and languages
3. Click **Generate Graph** to create visualizations
4. Export graphs as images or save your configuration for later

See [frontend/README.md](frontend/README.md) for detailed visualization instructions.

## Installation

### Prerequisites

- Python 3.8+
- Node.js 16+ (for visualization)
- Snakemake (for data preparation)

### Setup

1. Install Python dependencies:

```bash
pip install -r requirements.txt
```

2. Install frontend dependencies (optional, only needed for visualization):

```bash
cd frontend
npm install
```

## Configuration

TokEval uses YAML configuration files. See `example-config.yml` for a template that works with the FLORES-200 Snakemake pipeline.

Key configuration options:

- `input_dir`: Directory containing tokenized text files
- `output_dir`: Where to save evaluation results
- `metrics`: List of metrics to compute
- `languages`: Languages to evaluate (if omitted, all available languages are used)
- `system_dataset_suffix`: File extension for tokenized files (default: "txt")

## License

See [LICENSE](LICENSE) file for details.
