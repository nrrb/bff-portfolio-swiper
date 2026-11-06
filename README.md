# BFF interface prototype

A React app built with Vite, using a Tinder-inspired interface to browse portfolio apps. The five bottom links open Home, Browser, Likes, Contact, and Profile. Hash navigation supports direct links, browser Back, and browser Forward without an additional routing package.

Use Node.js 20.19+ or 22.12+ (Node 21 is unsupported). In this directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173). Run `npm run build` for the production output in `dist/`, then `npm run preview` to preview that build.

The app entry point is `src/main.jsx`, the interface is `src/App.jsx`, reaction/share logic is in `src/actions.js`, and navigation is in `src/navigation.js`. The 35 projects come from `projects.json`; `src/data.js` adds stable IDs, screenshot references, and the owner’s contact information. Years use `firstCommitDate` when provided; entries without dates omit the year. Vite bundles the SVG sprite with the app.

## Icons

Recommended library: [Phosphor](https://phosphoricons.com/). Its [official SVG catalog](https://github.com/phosphor-icons/core) includes filled, bold, and regular weights under the MIT license. These are the equivalent names:

| Action | Phosphor name | Suggested weight / color |
| --- | --- | --- |
| Undo | ArrowCounterClockwise | Bold / yellow |
| Pass | X | Bold / pink |
| Superlike | Star | Fill / blue |
| Like | Heart | Fill / green |
| Share | PaperPlaneTilt | Fill / blue |
| Home | Fire | Fill / pink |
| Browser | Compass | Regular / gray |
| Likes | Heart | Regular / gray |
| Contact | ChatCircle | Regular / gray |
| Profile | User | Regular / gray |

The prototype uses original, reusable SVG symbols in `icons.svg`, with no icon package or CDN required. Both a flame and hamburger menu are included. Use a symbol like this, with the accessible label on the button:

```html
<button aria-label="Undo">
  <svg aria-hidden="true"><use href="icons.svg#undo"></use></svg>
</button>
```

## Scope and checks

Home displays one app card at a time. Pass, like, and superlike advance to the next app; undo reopens the app whose decision was undone. Browser lists every app, and selecting one opens its Home card. Likes lists each liked or superliked app once and labels superlikes separately. A later pass removes an app from Likes, and undo restores its previous reaction. The bottom badge shows the actual saved count.

The chat icon opens Contact; Profile displays Nicholas Bennett’s name and the same email, GitHub, and LinkedIn links. Project cards use the captured homepage images, and Browser and Likes use the same images as thumbnails. Dancefloor Bass Analyzer has no public website URL and displays a labeled fallback.

Reactions stay available while navigating between views and reset on reload. Share uses the system share sheet or copies the local Home address. A local address works only where the preview server is reachable.

## Project screenshots

`public/project-screenshots/` contains 34 JPEG captures. `src/screenshots.json` records each source URL and capture result. Screenshots use Playwright’s iPhone 16 Pro Max settings with the full 440 × 956 screen viewport and 3× pixel density, producing 1320 × 2868 images. They capture the first screen of each supplied `websiteUrl`, including documentation or package pages where those are the provided links. Medium Talk’s onboarding tip is dismissed before capture.

To refresh screenshots:

```sh
npx playwright install chromium
npm run screenshot
```

To refresh just one project, pass its slug or GitHub repository name: `npm run screenshot -- medium-talk`. Screenshot failures remain visible in the manifest and use a labeled fallback rather than a broken image. A project without a public website is skipped.

## Validation

Run `npm test` for app-specific reaction history and undo, navigation, sharing, contact links, React-rendered view/SVG checks, and screenshot file checks.

With the dev server running, use `TEST_URL=http://127.0.0.1:5173 npm run test:e2e` (adjust the URL to the server’s printed address). This uses Playwright to check all five views, all project rows, like/superlike/pass/undo behavior, contact and profile information, browser Back, direct links, responsive layout, and screenshot dimensions. It also writes visual QA images under `/private/tmp/`.

The production build, unit/render tests, and Playwright checks pass. Browser checks use Chromium mobile emulation; physical iPhone Safari has not been tested.
