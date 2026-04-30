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

## Spacing And Density
- Padding, gap, row height, icon slot size, and other density-sensitive layout values must prefer shared CSS variables over hardcoded literals.
- Before adding a raw spacing value such as `px-4`, `py-3`, `gap-3`, `min-h-9`, or `h-6 w-6` in app-shell, sidebar, editor, tree list, dialogs, or settings UI, first check whether an existing token already represents that role.
- If no suitable token exists, add a new semantic variable in [`src/styles.css`](/Users/jys/Documents/repo/learn/codex-note/src/styles.css) and wire it into the density presets in [`src/state/notes.ts`](/Users/jys/Documents/repo/learn/codex-note/src/state/notes.ts).
- `comfortable` and `compact` must produce a visible layout difference. At minimum, they should affect page padding, panel padding, list row padding, list row height, and editor padding when those surfaces participate in the main workflow.
- Prefer role-based names such as `--editor-pad-x`, `--settings-page-pad`, `--tree-item-min-height`, or `--panel-pad`. Avoid introducing one-off variables that encode a single screen or temporary experiment.

## Settings Pages
- Settings navigation, cards, option selectors, and footer actions must use the same hover language as the rest of the app shell.
- Avoid mixing old `accent`-based hover colors with newer interaction tokens in the same screen.
- Section titles should not appear visually detached from the controls they introduce. Avoid wrapping a section heading in a separate emphasized container unless it is intentionally a standalone summary or callout.
- Use heavy card treatments only for major, high-impact choices. Secondary settings should usually be rendered as lighter rows, grouped controls, or compact segmented selectors.
