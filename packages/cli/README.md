# @tally-evals/cli

Interactive CLI for visualizing and exploring Tally evaluation results.

## Install

```bash
bun add @tally-evals/cli
```

## Usage

The CLI provides several commands for interacting with your `.tally` directory:

### Browse runs

Interactive browser for exploring all conversation runs in your project:

```bash
tally browse
```

This opens an interactive terminal UI where you can:
- Navigate through conversations
- View evaluation reports
- Compare runs side-by-side

### View a specific conversation

View a single conversation with its evaluation report:

```bash
tally view <conversation-id> --report <run-id>
```

Example:
```bash
tally view weather-golden --report run_2024-01-15T10-30-00
```

### Web Viewer (Development)

Start the web-based viewer for a richer UI experience:

```bash
tally dev server
```

Options:
- `-p, --port <port>` - Port to listen on (default: 4321)
- `--no-open` - Don't open browser automatically

The web viewer provides:
- Conversation timeline visualization
- Metric breakdowns per step
- Aggregated summaries and charts

## Requirements

- Must be run from a directory containing a `.tally/` folder or `tally.config.ts`
- Interactive commands (`browse`, `view`) require a TTY (real terminal)
- Web viewer requires the `@tally-evals/viewer` package

## Development

This package is part of the Tally monorepo.

```bash
bun install
bun run build
bun run dev  # Watch mode
```

## License

MIT
