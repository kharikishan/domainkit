# Contributing to DomainKit

Thank you for your interest in contributing to DomainKit!

## Getting Started

1. **Fork** the repository on GitHub and clone your fork locally.

2. **Create a branch** for your change:
   ```bash
   git checkout -b feat/my-feature
   ```

3. **Install dependencies** using pnpm (required):
   ```bash
   pnpm install
   ```

4. **Make your changes**, then run the full test suite to make sure everything passes:
   ```bash
   pnpm run lint
   pnpm run typecheck
   pnpm run build
   pnpm test
   ```

5. **Commit** your changes with a clear, concise message describing what and why.

6. **Push** your branch to your fork and **open a Pull Request** against the `develop` branch. Fill in the PR template and describe the motivation for the change.

## Code Style

- All code is TypeScript with strict mode enabled.
- Run `pnpm run lint` before pushing — the CI will reject lint failures.
- Prefer small, focused commits over large squashed blobs.

## Reporting Issues

Use the GitHub issue templates for bug reports and feature requests. Please include a minimal reproduction case for bugs.

## License

By contributing you agree that your contributions will be licensed under the MIT License.
