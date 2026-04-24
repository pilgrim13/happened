# Happened Reports

This directory stores owner-facing progress reports.

Each report is append-only and numbered:

- `001-project-brief/`
- `002-home-ui-prototype/`
- `003-auth-flow/`

## Report Structure

Each report should include:

- `report.md`: short Korean progress report.
- `assets/`: optional screenshots, SVG boards, compressed images, or small videos.

## GitHub-Friendly Asset Rules

- Prefer Markdown and SVG for design reports because they stay small and diffable.
- Prefer compressed PNG/JPEG for screenshots.
- Keep individual committed assets under 10 MB when possible.
- Keep normal report folders under 25 MB when possible.
- Do not commit raw simulator recordings, large videos, generated build files, or app archives.
- If an artifact is too large, commit a short note in the report and store the artifact elsewhere after approval.

## Current Policy

GitHub is suitable as the primary reporting channel once the remote repository is created.

I will not create a remote repository, push to GitHub, configure GitHub Actions, or choose any paid storage/distribution path without explicit approval.
