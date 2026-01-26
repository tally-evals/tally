# @tally-evals/viewer

Web-based viewer for exploring Tally evaluation results. Provides a rich UI for visualizing conversations, metrics, and evaluation reports.

## Overview

This is an internal package used by `@tally-evals/cli` to power the `tally dev server` command. It's not intended to be used directly.

## Features

- **Conversation List**: Browse all conversations in your `.tally` directory
- **Conversation View**: Detailed view of individual conversations with message timeline
- **Run View**: Explore evaluation runs with step-by-step metric breakdowns
- **Trajectory View**: Visualize trajectory execution and step traces

## Usage

The viewer is started via the CLI:

```bash
tally dev server
```

Or directly during development:

```bash
bun dev
```

## Tech Stack

- **Bun** - Runtime and build tool
- **React 19** - UI framework
- **Tailwind CSS 4** - Styling
- **Radix UI** - Accessible UI primitives

## Development

```bash
bun install
bun dev  # Start dev server with hot reload
```

## License

MIT
