# BFF interface prototype

A React app built with Vite, using a Tinder-inspired interface to browse portfolio apps. The five bottom links open Home, Browser, Likes You, Chats, and Profile. Hash navigation supports direct links, browser Back, and browser Forward without an additional routing package.

Use Node.js 20.19+ or 22.12+ (Node 21 is unsupported). In this directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173). Run `npm run build` for the production output in `dist/`, then `npm run preview` to preview that build.

The app entry point is `src/main.jsx`, the views are in `src/App.jsx`, card gestures and animation are in `src/Swiper.jsx`, deck/reaction logic is in `src/actions.js`, and navigation is in `src/navigation.js`. The 35 projects come from `projects.json`; `src/data.js` adds stable IDs, screenshot references, and the owner’s contact information. Every project has a `firstCommitDate`; the eight originally missing dates were verified against the earliest commits on GitHub. Cards show the final two digits of that year as the project’s “age.” Vite bundles the SVG sprite with the app.

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
| Chats | ChatCircle | Regular / gray |
| Profile | User | Regular / gray |

The prototype uses original, reusable SVG symbols in `icons.svg`, with no icon package or CDN required. Both a flame and hamburger menu are included. Use a symbol like this, with the accessible label on the button:

```html
<button aria-label="Undo">
  <svg aria-hidden="true"><use href="icons.svg#undo"></use></svg>
</button>
```

## Scope and checks

Project `description` fields are short, playful dating bios for the cards. Detailed project context remains in the existing `problem`, `role`, and related fields where provided.

The mobile layout fills the viewport with safe-area padding; desktop uses a centered card interface. Drag anywhere on the card above the buttons, including its image or text. Swiping left passes; swiping right likes. A horizontal drag of roughly a quarter of the card’s width commits a decision (capped at 120px); shorter drags snap back. Vertical gestures remain available for scrolling text, and cancelled gestures do not change the deck. The card rotates with the drag, a blurred next card sits underneath, and committed cards slide off the chosen side. The Like and Pass buttons use the same exit animation. Reduced-motion settings skip automatic transitions.

The shared viewport clips moving cards and cannot scroll, so translated or rotated cards cannot introduce scrollbars. List, chat, and profile pages have their own vertical scroll areas; long card descriptions can scroll independently.

The deck is an ordered queue. Passing puts an app at the bottom so all other queued apps appear before it returns. Likes and superlikes create matches, leave the swipe queue, and appear in Chats. Undo restores the previous decision and exact queue order. Matching every app shows a link to Chats; passing the final unmatched app safely cycles that one card. Browser can still preview any app without automatically putting an existing match back in the queue.

Every app has already liked the visitor: Likes You lists undecided apps, and its navigation badge always displays `99+`. Superlike also opens the shown app’s website in a new tab while its card exits to the right; it is disabled when there is no public website URL. Share opens the shown app’s GitHub repository in a new tab and keeps the same card selected.

Chats lists matched apps once each. Selecting a conversation opens a playful sample thread at `#chats/<app-id>`, using the app’s bio as its first message. These are sample conversations, with no live messaging or backend. Passing an app removes it from Likes You and removes any existing match; undo restores the previous placement. Repeated likes do not duplicate a conversation. Contact information appears exclusively on Profile, which contains Nicholas Bennett’s name, email, GitHub, and LinkedIn links.

Project cards use the captured homepage images, and lists use the same images as thumbnails. Dancefloor Bass Analyzer has no public website URL and displays a labeled fallback.

Profile uses a fixed personal card with only the park photo, a gold “THE AUTHOR” pill, and contact links in the bio area. It shares the swipe cards’ dimensions and text-position rules, but never enters the app-matching deck. The card is rendered by `src/AuthorCard.jsx`.

The served park photo in `public/author-photos/` is a 1320 × 1760 WebP, preserving the original aspect ratio within the iPhone 16 Pro Max’s 1320px screen width. It is 223 KB instead of the original 1.73 MB. Original camera files are retained locally under the ignored `source-assets/author-photos/` directory and are not included in the website build.

Reactions and matches stay available while navigating between views and reset on reload. A thread for an unavailable match returns to the Chats list with an explanation. External project links open with `noopener noreferrer`.

## Project screenshots

`public/project-screenshots/` contains 34 JPEG captures. `src/screenshots.json` records each source URL and capture result. Screenshots use Playwright’s iPhone 16 Pro Max settings with the full 440 × 956 screen viewport and 3× pixel density, producing 1320 × 2868 images. They capture the first screen of each supplied `websiteUrl`, including documentation or package pages where those are the provided links. Medium Talk’s onboarding tip is dismissed before capture.

To refresh screenshots:

```sh
npx playwright install chromium
npm run screenshot
```

To refresh just one project, pass its slug or GitHub repository name: `npm run screenshot -- medium-talk`. Screenshot failures remain visible in the manifest and use a labeled fallback rather than a broken image. A project without a public website is skipped.

## Validation

Run `npm test` for app-specific reaction history and undo, navigation, external project links, contact links, React-rendered view/SVG checks, and screenshot file checks.

With the dev server running, use `TEST_URL=http://127.0.0.1:5173 npm run test:e2e` (adjust the URL to the server’s printed address). Playwright checks the views, matches, contacts, years, external links, and screenshots, then exercises real desktop mouse drags and emulated mobile touch gestures. Swipe checks cover rotation, the blurred next card, short/cancelled/vertical gestures, a complete queue cycle, matched apps staying out, undo, the final card, empty decks, reduced motion, and a full mobile viewport. Profile checks cover the single photo, shared card/copy positions, and the personal card staying fixed without changing the app deck. External destinations are stubbed during navigation tests. Visual QA images are written under `/private/tmp/`.

The production build, unit/render tests, and Playwright checks pass. Browser checks use Chromium mobile emulation; physical iPhone Safari has not been tested.
