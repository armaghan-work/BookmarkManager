# Contributing to Bookmark Manager

Thanks for helping improve Bookmark Manager.

## Before You Start

- Search existing issues and pull requests before opening a new one.
- Keep changes focused. Small pull requests are easier to review and merge.
- For larger changes, open an issue first so the approach can be discussed.

## Local Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/armaghan-work/BookmarkManager.git
   cd BookmarkManager
   ```

2. Install development dependencies:

   ```bash
   npm install
   ```

3. Start the application locally:

   ```bash
   php -S localhost:8000
   ```

   For static UI work that does not require PHP persistence, you can also use:

   ```bash
   npx http-server -p 8080 -o
   ```

4. Open the app in your browser and, if useful, import `examples/demo-bookmarks.json`
   to test with sample data.

## Quality Checks

Run the checks that match your change before opening a pull request:

- `npm run lint`
- `node tests/run-tests.js`
- Browser-based checks in `tests/*.html` for UI changes

If you change `bookmark_api.php`, verify loading and saving through the PHP server
before submitting.

## Pull Request Guidelines

- Branch from `main`.
- Use a clear title and explain why the change is needed.
- Link related issues when applicable.
- Include screenshots or a short video for visible UI changes.
- Update documentation when behavior, setup, or workflows change.
- Keep unrelated refactors out of the same pull request.

## Issue Reporting

Use the issue templates whenever possible and include:

- the version or commit you tested
- your browser and operating system
- steps to reproduce
- expected behavior
- actual behavior

## Code of Conduct

By participating in this project, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).
