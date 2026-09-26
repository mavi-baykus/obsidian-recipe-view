# Recipe View overhaul plan

Working plan for this fork. It covers the two requested changes (a working Recipe View
toggle, and bilingual recipes) plus bugs found while testing against real recipe notes
(`Cinnamon Rolls.md`, `Ezogelin Çorbası.md`).

**Starting point:** this fork's `master` is identical to upstream `lachsh/obsidian-recipe-view`
`master` (v0.3.6, May 2024). `npm run build`, `npm test` (31 tests) and `npm run lint`
(0 errors, 35 warnings) all pass.

---

## 1. The "Recipe View" button

### What's actually happening

The button in the notes is written as `` `button-RecipeView` ``. That is an **inline button from
the Buttons community plugin** (shabegom/buttons), not something Recipe View provides. It
presumably runs the command *"Recipe view: Toggle between recipe card and markdown"*.

- **In the markdown view** the button works. Buttons finds the button's line in the active
  `MarkdownView`, then runs the command.
- **In recipe view** the button is still visible. Recipe View renders the whole note body,
  and the Buttons post-processor turns the inline code into a button again. Clicking it
  calls Buttons' `clickHandler` → `getInlineButtonPosition()` → `createContentArray()`.
  That function does `app.workspace.getActiveViewOfType(MarkdownView)`. `RecipeView` is an
  `EditableFileView`, not a `MarkdownView`, so the lookup returns `null`. Buttons then shows
  **"Could not get Active View"** and returns `undefined`. Next,
  `getInlineButtonPosition` throws on `content.contentArray`, so the command is never run.
  (Buttons source: `src/utils.ts` `createContentArray`, `src/button.ts` `clickHandler`,
  `src/parser.ts` `getInlineButtonPosition`.)

Recipe View can't make itself a `MarkdownView`, so it should stop relying on Buttons for this.

Other issues on the Recipe View side:

- The only built-in way back is the ribbon icon or the command palette. The recipe card has
  no toggle of its own.
- `setMarkdownView()` passes the recipe view's state (`{file}`) back to the markdown view.
  That drops the previous mode (Reading vs Live Preview), so the note reopens in whatever
  the default mode for new tabs is.
- `RecipeView.renderRecipe()` never destroys the previous `RecipeCard` before mounting a new
  one. `onUnloadFile` isn't implemented, and the card doesn't re-render when the note is
  edited.

### Plan

1. **Toggle in the view header (both directions, no dependencies).**
   - `RecipeView`: `this.addAction("file-text", "Open as note", …)`.
   - Markdown notes: add a `chef-hat` header action to `MarkdownView`s that look like recipes.
     "Looks like a recipe" is configurable: tag (default `recipe`), folder, or a
     frontmatter key. Register on `active-leaf-change` and `layout-change`. Make it
     idempotent with a `WeakMap<MarkdownView, HTMLElement>`, remove it when the note isn't
     a recipe, and remove everything in `onunload`.
   - The icon stays in the same place in the tab header, so the same spot toggles back and
     forth. It also works on iPad and phone.
2. **Return to the mode you came from.** When entering recipe view, save the markdown
   view's `getState()` (`mode: "source" | "preview"`, `source: boolean`) into the recipe
   view's own state as `returnState`, and restore it on the way back. Add a setting
   *"Return to: previous mode / Reading view / Live Preview"*.
3. **In-card toggle.** Add a small "Open as note" button next to *Scale recipe*. It's
   handy on tablets where the header can be cramped.
4. **Hide the old in-note button while in recipe view.** Add a setting listing inline-code
   tokens to hide in recipe view, defaulting to `button-RecipeView`. The recipe card now has
   its own toggle, so the dead Buttons button disappears.
5. **Native in-note button (later phase, optional).** Recipe View would render its own
   inline token, e.g. `` `recipe-view-toggle` ``:
   - in Reading view, via a markdown post-processor;
   - in Live Preview, via a small CM6 widget (`registerEditorExtension`);
   - inside recipe view, via a delegated click handler on `RecipeView.containerEl`, like the
     existing internal-link handler.

   Because Recipe View handles the click, it always knows which leaf to toggle. There would
   also be an alias setting. If you stop using Buttons for this, `button-RecipeView` can be
   an alias, so none of your notes need editing.
6. **`RecipeView` lifecycle cleanup.**
   - Destroy the old card before re-rendering, and implement `onUnloadFile`.
   - Re-render (debounced) on `vault.on("modify")` for the open file.
   - Toggle the leaf the click came from instead of `getMostRecentLeaf()`.

---

## 2. Bilingual recipes

### Your current format (kept as-is)

```markdown
### Ingredients
**Türkçe**
- 1 kuru soğan
- 7 [[Bardak Ölçüleri (Cup Measurements)|su bardağı]] (1.4 L) et suyu
- Tuz

**English**
- 1 onion
- 7 cups (1.4 L) beef or chicken broth
- Salt, to taste

### Directions
**Türkçe**
1. Çok minik doğranan (rendeleyebilirsiniz) soğan az sıvı yağda kavrulur.

**English**
1. Finely chop (or grate) the onion and sauté it in a little oil.
```

Today both languages render one after the other. The `**Türkçe**` / `**English**` labels
under Directions become clickable "steps", because every paragraph in the main column is
made selectable.

### What it should do

```
 Scale recipe  × 1                 [ Türkçe | English | Both ]

 INGREDIENTS
 ☐ 1 kuru soğan                                           ⇄
 ☐ 7 su bardağı (1.4 L) et suyu                           ⇄
      EN  7 cups (1.4 L) beef or chicken broth      ← revealed
 ☐ Tuz                                                    ⇄

 DIRECTIONS
 1. Çok minik doğranan (rendeleyebilirsiniz) soğan …      ⇄
```

**Choosing the language when opening**
- Settings: a list of languages, each with aliases (e.g. `tr = Türkçe, Turkish`,
  `en = English, İngilizce`), a default language, and an *"On open"* choice: *default
  language / last language used for this note / ask*.
- Optional frontmatter override per note: `recipe-languages: [Türkçe, English]`,
  `recipe-language: en`.
- One command per language ("Open recipe view in Türkçe", "… in English"), so each can have
  a hotkey.
- With *ask*, the header action and in-note button pop up a small `Menu` listing the
  languages.
- The language is stored in the view state (`{file, lang, returnState}`), so it survives
  an Obsidian restart.

**Switching and revealing**
- A language switcher in the card: `Türkçe | English | Both`. **Both** is today's behavior.
- **Reveal one item:** each paired ingredient and step gets a small, low-contrast
  translate button (⇄). Tapping it expands the matching item from the other language
  inline, underneath and muted, with a language badge. Tapping again collapses it. It
  must be a real `<button>` that stops the event from reaching the surrounding `<label>`,
  or the tap would also cross out the ingredient or select the step.
- Keyboard: `t` reveals the counterpart for the focused ingredient or selected step; `T`
  reveals all of them.
- Setting: show ⇄ on every item, or only on the selected step and focused ingredient
  (less clutter).
- Revealed text still scales with *Scale recipe*. Links such as
  `[[Bardak Ölçüleri…|su bardağı]]` stay clickable and hoverable.
- Crossing out an ingredient also crosses out its counterpart, and the selected step
  follows a language switch, so switching mid-cook keeps your place.

### Pairing rules

- A **language label** is a paragraph that is *only* bold text (`**English**`), or an H4–H6
  heading, whose text matches a configured language or alias. Matching is
  case-insensitive and diacritic-insensitive (`Türkçe` = `turkce`). It uses
  Turkish-safe casing, so `İ`/`ı` aren't mangled.
- A language block runs until the next language label, the next heading at the same or a
  higher level than the section heading (`### Directions`), or a `---`.
- Content before the first label in a section is **shared** and shown in every language.
  An untranslated `### Notes`, for example, just shows up.
- Within each section, the "pairable units" of each language are collected in order:
  top-level list items, bold-only sub-labels (e.g. `**Hamur**` ↔ `**Dough**`) and main-column
  paragraphs. These lists are then zipped by position. Nested sub-bullets travel with
  their parent item.
- **Counts don't match:** that section falls back to "no reveal" and shows a small warning
  such as *"English has 12 ingredients, Türkçe has 13"*. That's better than showing the
  wrong translation.
- Recipes without language labels behave exactly as they do today.
- More than two languages works the same way; reveal shows every other language.

### Implementation sketch

- **Split parsing into two passes.**
  - A new `src/model.ts` is a pure DOM pass over the rendered markdown. It produces
    sections → blocks, each with `{kind, lang | null, element, pairId}`.
  - `parsing.ts` then maps that model to Svelte components.

  The model pass can be unit-tested under jsdom (`jest-environment-jsdom`), using your two
  recipes, rendered to HTML, as fixtures.
- `src/languages.ts`: alias matching and normalization.
- `CheckableIngredientList` and `SelectableStepList` get `lang`, `counterparts` and a
  `revealed` store. `RecipeCard` filters components by the selected language.
- `RecipeLeaf` moves real DOM nodes rather than copying them. That's fine: in
  single-language mode the other language's list isn't mounted, so its `<li>` can be moved
  into the reveal slot. Per-item reveal is disabled in **Both** mode.
- Checked and selected state moves from `data-checked` on the `<li>` to a store keyed by
  `pairId`. That makes cross-language sync possible and survives layout changes.
- Bold-only paragraphs in the main column become non-selectable sub-headings. This is
  needed for language labels, and it also fixes `**Dough**` being a clickable "step" in
  Cinnamon Rolls.

---

## 3. Other bugs found in your recipes

| # | Bug | Seen in | Fix |
|---|-----|---------|-----|
| 1 | **`2½ teaspoons` shows as `10 ½`**, and `4½ cups` as `20 ½`. NFKD turns `2½` into `21⁄2`, which is parsed as 21/2. Confirmed with the parser. | Cinnamon Rolls, yeast and flour | Before normalizing, insert a space between a digit and a vulgar-fraction character. Add tests. **Highest priority: it silently gives wrong amounts.** |
| 2 | All ingredient text is NFKD-normalized, which decomposes Turkish letters (`ğ` → `g`+◌̆, `ş`, `ç`, `İ`). Search and copy break, and some fonts render it poorly. | Ezogelin | Only map the fraction characters; leave all other text alone. |
| 3 | `6 ounces` shows a double space: the unit regex captures a leading space. | Cinnamon Rolls, frosting | Trim the unit, or fix `\s+` in `UNIT`. |
| 4 | In `520–585 g`, only `585` scales. | Cinnamon Rolls, flour | Add range support: port [lachsh/obsidian-recipe-view#42](https://github.com/lachsh/obsidian-recipe-view/pull/42) and include the en dash. |
| 5 | `SelectableStepList` drops the `<ol start>` attribute, so a list starting at "8." renumbers from 1. | Cinnamon Rolls (after fix 6) | Copy `start` onto the rendered `<ol>`. |
| 6 | `**Filling & Shaping**` directly followed by `8. …` renders as a single paragraph. In CommonMark only a list starting at `1.` can interrupt a paragraph. | Cinnamon Rolls | Note fix: put a blank line after the bold label. Obsidian's Reading view does the same thing. |
| 7 | Bold-only labels in Directions are selectable steps. | Both | Part of the parsing split (section 2). |
| 8 | Turkish units (`su bardağı`, `yemek kaşığı`, `tatlı kaşığı`, `çay kaşığı`, `gr`, `lt`) aren't recognized. A leading number still scales, but quantities in the middle of a step don't. | Ezogelin | Configurable extra units, with Turkish presets. |

---

## 4. Upstream PRs worth reviewing

Upstream has had no commits since May 2024. These open PRs line up with this plan:

- [lachsh/obsidian-recipe-view#30](https://github.com/lachsh/obsidian-recipe-view/pull/30): auto-open recipe view for notes with the recipe tag. Could be an optional setting next to the header action.
- [lachsh/obsidian-recipe-view#42](https://github.com/lachsh/obsidian-recipe-view/pull/42): quantity ranges (bug 4).
- [lachsh/obsidian-recipe-view#41](https://github.com/lachsh/obsidian-recipe-view/pull/41): replaces invalid `<div>`-inside-`<p>`/`<label>` markup that breaks lists on iOS.
- [lachsh/obsidian-recipe-view#37](https://github.com/lachsh/obsidian-recipe-view/pull/37): all property types in the title block (e.g. `made: true`).
- [lachsh/obsidian-recipe-view#39](https://github.com/lachsh/obsidian-recipe-view/pull/39): +/- scale buttons, friendlier on touch screens.

---

## 5. Phases

Each phase can be shipped on its own and keeps build, tests and lint green.

| Phase | Scope | Size | Status |
|-------|-------|------|--------|
| 0 | Test setup: jsdom environment, fixtures from your two recipes | S | ✅ Done (fixtures are Obsidian-rendered synthetic notes) |
| 1 | **Toggle fix:** header actions, return-to-previous-mode, in-card toggle, hide the Buttons token, `RecipeView` lifecycle | S–M | ✅ Done |
| 2 | **Quantity fixes:** bugs 1–5 and 8, with tests | S | ✅ Done (bug 6 is a note edit) |
| 3 | Parsing split (model → components) and bold labels as sub-headings. No other visible change. | M | ✅ Done (`src/model.ts`; `####`–`######` headings are sub-headings too) |
| 4 | **Bilingual:** language settings, detection and pairing, language in view state and per-language commands, switcher, reveal UI, synced check/step state | L | |
| 5 | Native in-note toggle token (Reading view, Live Preview and recipe view) with `button-RecipeView` alias | M | |
| 6 | Docs, version bump to 0.4.0, tagged release so the fork can be installed with BRAT | S | |

Phases 1 and 2 were checked in Obsidian 1.13.7 with the Buttons plugin (0.9.13) and both
recipe notes: the original build reproduced "Could not get Active View" and `10 ½`; the new
build round-trips Reading view, Live Preview and Source mode (including from the Buttons
button in Live Preview, keeping the cursor and scroll position), hides the dead button,
and scales correctly.

**Distribution:** keep the manifest id `recipe-view` and install the fork through BRAT
from this repo. The release workflow already builds on tags; GitHub Actions has to be
enabled on the fork. Version 0.4.0 is newer than upstream's 0.3.6, so Obsidian's
community updater won't overwrite it.

---

## 6. Open questions (a default is proposed for each)

1. **"Standard preview"**: should toggling back open Reading view or Live Preview?
   *Default: whichever mode the note was in before, with a setting to force one.*
2. **Buttons plugin**: keep using Buttons in notes (Recipe View just hides it in recipe
   view), or switch to Recipe View's own token? *Default: phase 1 hides it. Phase 5 adds
   the native token, with `button-RecipeView` as an alias once Buttons no longer defines
   that button.*
3. **How to reveal**: a ⇄ on every item, or only on the selected step and focused
   ingredient? *Default: on every item, low contrast, plus a setting.*
4. **Choosing the language**: pop up a menu every time, or default/last-used plus the
   in-card switcher? *Default: last-used for the note, then the default language; in-card
   switcher; one command per language.*
5. **Language names**: are `Türkçe` and `English` the only labels you use, or also
   `TR` / `EN` / `Turkish`? *Default: configurable aliases, so any of them work.*
