# Daywell

界面支持简体中文和 English，首次打开默认中文。可以通过页面顶部的语言选择切换，浏览器会记住你的选择。语言切换不会修改已有健康记录。

A personal health journal based on the selected **A · Daily Dashboard** design: warm cream, sage green, quick daily logging, and a responsive layout.

## Run locally

Use Node.js 24 or later:

```sh
npm ci
npm run dev
```

The development server listens on port 5173. To build and serve the production version:

```sh
npm run build
npm run preview
```

## Preview without a server

```sh
npm run build:standalone
```

Download the generated `daywell-preview.html` file and open it in Chrome or Edge. It includes the application, styles, and fonts and works without a development server or Internet connection. Keep the file in the same location to retain its browser-local journal.

The source `index.html` is a Vite entry point and must be served by Vite. Opening that source file by itself does not run the app. File viewers that restrict JavaScript can show the standalone dashboard, but its controls require opening the downloaded file in a browser.

## Journal features

- Record weight, meals with optional calories, exercise duration and intensity, and daily notes.
- Browse previous days, edit or delete entries, and review weight trends.
- Display weight in kilograms or pounds; stored measurements use kilograms.
- Export a JSON backup and import a validated backup after confirmation.
- Explore clearly labeled sample entries without saving them to your own journal.

The first version stores your journal in this browser. It does not have accounts or synchronization across devices. Export a backup before moving to another browser or clearing browser data.

## Checks

```sh
npm test
npm run build
```

The tests exercise import validation, journal persistence and recovery, dates, and weight conversions. The build checks TypeScript and produces the production assets in `dist/`.

## Deploy

The GitHub Pages workflow in `.github/workflows/deploy-pages.yml` installs dependencies with Node.js 24, runs the journal checks, builds the site with the Pages URL's base path, and publishes `dist/`. Set the repository's **Settings → Pages → Source** to **GitHub Actions**. A push to `main` or a manual workflow run deploys the site. GitHub Pages must be available for the repository's current visibility and account plan.

For another static host, use `npm ci && npm run build` and publish `dist/` over HTTPS. The default build expects a domain root. For this repository's GitHub Pages path, a local deployment build is:

```sh
npm run build -- --base /personal_health_platform/
```

Each deployed origin has its own browser-local journal. Export a backup from an existing preview and import it at the deployed URL to move your records.

## Development notes

This is a React and TypeScript application built with Vite. UI and interaction code live in `src/App.tsx`, styles in `src/styles.css`, and journal validation/storage in `src/data.ts`. All dependencies are pinned in `package.json` and `package-lock.json`.

Each cloud task already has an isolated environment. Use this checkout directly; do not create a Git worktree unless explicitly requested.
