# Style Guidelines

## Interaction Colors
- All interactive hover, selected-hover, and pressed-like surface colors must come from shared CSS variables in [`src/styles.css`](/Users/jys/Documents/repo/learn/codex-note/src/styles.css).
- Do not hardcode one-off hover colors inside feature components with ad hoc `color-mix(...)` values when the interaction belongs to the app shell, sidebar, settings, menus, or shared controls.
- Prefer these tokens first:
  - `--interactive-hover`
  - `--interactive-hover-strong`
  - `--interactive-selected`
  - `--interactive-selected-hover`
  - `--tree-item-hover`
  - `--tree-item-selected`
  - `--tree-item-selected-hover`

## Shared Components
- Shared UI primitives such as buttons, inputs, and menus should default to shared interaction tokens instead of feature-local colors.
- If a surface needs a different hover treatment, add a new named token in [`src/styles.css`](/Users/jys/Documents/repo/learn/codex-note/src/styles.css) and reuse it, rather than embedding a raw color directly in the component.

## Settings Pages
- Settings navigation, cards, option selectors, and footer actions must use the same hover language as the rest of the app shell.
- Avoid mixing old `accent`-based hover colors with newer interaction tokens in the same screen.
