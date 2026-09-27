# Recipe View overhaul plan

Working plan for this fork. It covers the two requested changes (a working Recipe View
toggle, and bilingual recipes) plus bugs found while testing against real recipe notes
(`Cinnamon Rolls.md`, `Ezogelin Çorbası.md`).
Section 7 covers the second round: Turkish headings, a "Made" button and timers.

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
| 4 | **Bilingual:** language settings, detection and pairing, language in view state and per-language commands, switcher, reveal UI, synced check/step state | L | ✅ Done (docs/usage/bilingual.rst) |
| 5 | Native in-note toggle token (Reading view, Live Preview and recipe view) with `button-RecipeView` alias | M | |
| 6 | Docs, version bump to 0.4.0, tagged release so the fork can be installed with BRAT | S | ✅ Done (CHANGELOG.md; the release workflow publishes, and tags with a `-` are pre-releases) |
| 7 | **Heading translations** (section 7.1) | S | ✅ Done (`src/headings.ts`, `TranslatedHeading.svelte`) |
| 8 | **Made button**, keeping the cooking state when only properties change (7.2, 7.3) | S–M | |
| 9 | **Timers**: panel, alarm, screen kept on, durations (7.4) | L | |
| 10 | **Clickable times** in ingredients and steps (7.5) | M | |

Phases 1 and 2 were checked in Obsidian 1.13.7 with the Buttons plugin (0.9.13) and both
recipe notes: the original build reproduced "Could not get Active View" and `10 ½`; the new
build round-trips Reading view, Live Preview and Source mode (including from the Buttons
button in Live Preview, keeping the cursor and scroll position), hides the dead button,
and scales correctly.

**Distribution:** keep the manifest id `recipe-view` and install the fork through BRAT
from this repo. Version 0.4.0 is newer than upstream's 0.3.6, so Obsidian's community
updater won't overwrite it.

**Making a release:**
1. Bump the version with `npm version <version> --no-git-tag-version`.
2. Add a `## <version>` section to `CHANGELOG.md`.
3. Push the branch.
4. Publish a GitHub release whose new tag is the version, targeting the branch (or push
   the tag).

The release workflow then builds, tests and attaches `main.js`, `manifest.json` and
`styles.css`. It fills in empty release notes from the changelog. GitHub Actions has to be
enabled on the fork. This session can only push to its branch, not tags.

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

---

## 7. Round 2: Turkish headings, "Made" button and timers

### Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Headings to translate | Ingredients, Directions, Notes |
| 2 | Headings in **Both** | As written in the note |
| 3 | Title and the plugin's own labels | Unchanged |
| 4 | "Made" clicked twice on one day | The date isn't added again |
| 5 | Where the Made button goes | At the end of the directions |
| 6 | Devices | Mostly iPhone and iPad, sometimes a MacBook |
| 7 | Timers | Several at once |
| 8 | Tapping a time in the recipe | Sets a timer; you start it with ▶ |
| 9 | Ranges like "10–12 minutes" | The shorter time |
| 10 | Timer preset | A `cook time (hh:mm)` property, to be added to your template. A bare number like `90` is minutes. |
| 11 | Alarm | Rings until dismissed |

### 7.1 Heading translations

- **Setting:** *Heading translations*, one heading per line, with the names in the same order as
  the Languages setting (`en`, then `tr`):
  ```
  Ingredients | Malzemeler
  Directions | Hazırlanışı
  Notes | Notlar
  ```
- **What's translated:** headings and bold labels that sit outside the language sections, i.e.
  the ones shared by both languages. With one language selected, the card shows the name for
  that language. **Both** shows the heading as written.
- **Matching:** the whole heading, trimmed, ignoring case, diacritics and a trailing colon.
  Any name in a line matches, so a note with `### Malzemeler` shows "Ingredients" in English.
  If a line has no name for the selected language, the heading shows as written.
- **Layout:** the side column is still chosen from the heading as written, so
  `sideColumnRegex` needs no Turkish names.
- **Code:**
  - `model.ts` marks shared heading and label blocks.
  - `parsing.ts` attaches the matching line's names.
  - A small wrapper around `RecipeLeaf` swaps the heading text for the selected language.

### 7.2 Keep the cooking state when only properties change

Today any change to the note re-renders the card. That includes a property change, such as
the Made button writing the frontmatter. The re-render clears crossed-out ingredients, the
selected step, revealed translations and the scroll position.

- **Fix:** in `RecipeView`'s `metadataCache.on("changed")`, compare the note *body* (the text
  after the frontmatter) with the last render.
  - Body unchanged: pass the new metadata to the card with `$set({ metadata })`. That updates
    the title block, the Made button and the cook-time preset.
  - Body changed: re-render as today.
- **Also covers:** editing properties in another pane, and sync updating them.

### 7.3 "Made" button

```
 DIRECTIONS
 …
 6. Cooking time can vary …

              [ ✓ Mark as made ]        → after clicking:  [ ✓ Made today ]
```

- **Where:** at the end of the directions in every layout:
  - two-column: after the last section of the main column;
  - one-column: at the bottom of the card;
  - multi-section: a final row under the main column.

  Each layout gets a `footer` slot, like the existing title-block and toolbar slots.
- **Command:** *Mark recipe as made*. It works in recipe view and in note view for recipe
  notes, so it can also be bound to a hotkey or used from a Buttons button.
- **What it writes** (via `app.fileManager.processFrontMatter`, which the Properties editor
  also uses):

  | Property | Change |
  |----------|--------|
  | `made` | `true`, whatever it was |
  | `last made` | Today, as a local date `YYYY-MM-DD` |
  | `previously made` | Today appended, unless it's already there. An empty value or a single date is turned into a list first. |

  Missing properties are created.
- **Feedback:**
  - A notice, *Marked as made · 27 Sep 2026*, has an **Undo** button for 10 seconds. Undo puts
    the three properties back exactly as they were, removing any that didn't exist.
  - When `last made` is today, the button reads **Made today** and a click does nothing.
- **Property types:** if `last made` or `previously made` have no type in the vault yet, set
  them to Date and List. This uses the internal `app.metadataTypeManager`, guarded, so it's
  skipped if that API is missing. The types can still be set by hand in the Properties editor.
- **Settings:** the three property names. The defaults are the names above.
- **Tests:**
  - The frontmatter change is a pure function, `markMade(frontmatter, today, names)`,
    unit-tested for every value shape, the same-day case, and undo.
  - In Obsidian, check that the rest of your template's frontmatter is left unchanged.

### 7.4 Timers

```
 ┌ Ingredients column (or Directions), pinned while the column scrolls ┐
 │ Cook time          1:30:00    ▶   −1  +1  +5   ✕                   │
 │ 3. Üzerine et su…    44:12    ⏸   −1  +1  +5   ✕                   │
 │ 4. Düdüklüde 15…      0:00    🔔 Dismiss   +1 min                   │  ← ringing, flashing
 │ + Timer                                                             │
 └─────────────────────────────────────────────────────────────────────┘
```

**Adding and setting timers**

- **Adding one:** a **Timer** button next to *Scale recipe*, or the *Add timer* command, adds
  a paused timer. It's set from `cook time (hh:mm)` if the note has one and that timer isn't
  already there; otherwise the last duration used; otherwise 10:00.
- **Typing a time:** tap the digits and type in any of the formats below. A bare number is
  minutes. **Enter** applies it.
- **Adjusting:** −1 / +1 / +5 min, ▶/⏸, ✕ to remove, **+ Timer** for another one.
- **Several at once**, each labelled:
  - *Cook time*;
  - the start of the step it came from;
  - *Timer 2*, and so on, for manual ones.
- **Tapping a time in the recipe** (see 7.5) adds a paused timer set to that time. If the
  newest timer also came from a tap and was never started, it's replaced, so exploratory
  taps don't pile up.

**Where it shows**

- **Position:** the panel sits at the top of the Ingredients or Directions column, as set in
  the settings.
  - Two-column: each column scrolls on its own, so the panel is `position: sticky` at the top
    of that column.
  - One-column and multi-section layouts: it's sticky at the top of the card.
- **Size:** small, medium or large; scales the digits and buttons.
- **Visibility:** the panel is hidden when there are no timers.

**Surviving the things that rebuild the card**

- **Where the timers live:** in the plugin, not in the card. So they survive:
  - a re-render;
  - a layout switch while resizing;
  - a language switch;
  - the Made button;
  - switching to note view or another note;
  - closing the recipe.
- **Other recipes:** every recipe view shows every timer. Timers from another recipe are
  labelled with that recipe's name.
- **Counting:** end times are stored as clock times, so the countdown stays right after the
  app has been paused.
- **Restarts:** running timers are saved in the plugin data. If iOS closes Obsidian, the
  timers come back when it reopens. One that finished while Obsidian was closed rings on
  reopening and says how long ago it finished.
- **Desktop:** the status bar shows the soonest running timer.

**Alarm**

- **What happens:**
  - a repeating beep until dismissed;
  - the timer flashes;
  - a notice appears that stays until clicked;
  - on desktop, a system notification when Obsidian isn't focused.
- **Dismissing:** from the timer, the notice, or the *Dismiss timer alarms* command.
  **+1 min** snoozes.
- **Sound:** a short WAV generated in code (no sound files), played through an `<audio>`
  element.
  - The element is primed when you tap ▶, because iOS only allows sound that follows a tap.
  - It plays through the media channel. Where available it also sets
    `navigator.audioSession.type = "playback"`, so the ringer switch shouldn't mute it. This
    must be checked on your iPhone.
- **Keeping the screen on:** while any timer runs or rings, `navigator.wakeLock` keeps the
  screen on. It's re-requested when Obsidian comes back to the foreground.
  - If the API is missing, it falls back to a muted, looping, invisible video (the NoSleep
    technique).
  - Setting: *Keep screen on while a timer runs* (default on).
- **Limit that can't be fixed:**
  - If you lock the device or switch apps, iOS pauses Obsidian and the alarm can't sound
    until you return.
  - Keeping the screen on is what avoids this.
- **Settings:**
  - position (Ingredients / Directions column);
  - size;
  - sound on or off;
  - the preset property name;
  - keep screen on;
  - a **Test alarm** button. It plays the alarm and reports whether the sound played and
    whether the screen lock worked, so it doubles as an on-device check.

**Duration formats** (`src/durations.ts`, pure, unit-tested)

`parseDuration(text)` returns seconds or `null`. It's used for the property and for typed
times. It accepts:

- **Clock forms:** `01:30`, `1:30` (h:mm), `1:30:00` (h:mm:ss).
- **Units, with or without spaces:** `1h 30m`, `1 h 30 m`, `1hr 30min`, `1 hr 30 min`,
  `1hour 30minutes`, `1 hour 30 minutes`, `1 hour and 30 minutes`, `1h30`, `90 min`, `30m`,
  `1 hr`, `45 sec`.
- **Unit spellings:**
  - English: h, hr, hrs, hour(s); m, min, mins, minute(s); s, sec, second(s).
  - Turkish: sa, saat; dk, dk., dakika; sn, saniye.
- **Numbers:** decimals with `.` or `,` (`1.5 h`, `1,5 saat`), fractions (`1½ hours`), and words
  (`an hour`, `half an hour`, `yarım saat`, `bir saat`).
- **ISO durations:** `PT1H30M`, as copied from recipe websites.
- **Bare numbers:** `90` is 90 minutes. The property may come through as a number, in which
  case it's also minutes.

Anything else gives `null`. The timer then opens at the default with a small "couldn't read
cook time" note.

### 7.5 Clickable times in the recipe

- **What's found:** `findDurations(text)` finds times in the text of ingredients, steps and
  revealed translations. Examples:
  - *about 45 minutes*, *45 dk.*, *15 dakika*;
  - *10–12 minutes* and *10 to 12 minutes*, which set 10;
  - *1 saat 15 dakika*, *1½ hours*, *30 saniye*.

  Each becomes a tappable chip with a small timer icon.
- **Avoiding false matches:**
  - In running text the single-letter units `h`/`m`/`s` only count when attached to the
    number (`30m`), not after a space.
  - Clock forms like `1:30` aren't matched in text, so ratios like `1:2` are safe.
  - Temperatures (`350°F`) and quantities are skipped.
- **Order:** times are found before quantities, and are marked `data-qty-no-parse` so scaling
  never changes them.
- **Tapping a chip:** adds a paused timer, as in 7.4, and opens the panel.
  - In an ingredient, the tap doesn't cross it out.
  - In a step, it also selects that step.
- **Scope:** times are found within one text node, so a time split by formatting, like
  `**45** minutes`, isn't found. That's rare in these recipes.

### 7.6 Phases

| Phase | Scope | Size |
|-------|-------|------|
| 7 | Heading translations (7.1), with docs | S |
| 8 | Keep the cooking state on property changes (7.2); Made button and command (7.3) | S–M |
| 9 | Duration parser; timer panel, timers kept in the plugin and saved; alarm, screen-on and Test alarm; settings (7.4) | L |
| 10 | Clickable times in ingredients and steps (7.5) | M |

The suggested order is 7 → 8 → 9 → 10.

**Testing**

- **Automated:** unit tests for the parser (every format above, plus text that mustn't match,
  in English and Turkish), time detection on your two recipes, heading matching, and
  `markMade`.
- **Obsidian 1.13.7 desktop:** every piece of UI, in all three layouts.
- **Your iPhone and iPad:** only you can check these. For phase 9 there's a checklist: sound
  with the ringer off, the screen staying on, the alarm after locking and unlocking, the
  sticky panel while scrolling, and tapping times.

**Installing test builds:** phase 6 (a tagged release, installable with BRAT) is worth doing
before phase 9. BRAT can then update the plugin on the iPhone and iPad, without copying
files by hand.
