# Changelog

Each version's section is used as the notes of its GitHub release.

## 0.5.0-beta.3

Fixes from trying 0.5.0-beta.2 on an iPhone.

- Ingredients and steps line up with their bullets and numbers on iPhone and iPad; before, the
  text started on the line below them. This also affected the original plugin.
- The end of the recipe, with *Mark as made*, can be scrolled above Obsidian's floating
  navigation bar on phones.
- Adding or starting a timer no longer makes a short clicking sound. The alarm is now readied
  with a moment of silence, once.

## 0.5.0-beta.2

Test build with timers, to try on phones and tablets.

**Timers**
- A *Timer* button under *Scale recipe*, and an *Add a timer* command. The first timer is set
  to the recipe's `cook time (hh:mm)` property, read from many formats (01:30, 1 h 30 min,
  90, 1,5 saat, PT1H30M, …).
- Several timers at once, shown at the top of the ingredients or directions column and kept
  there while it scrolls. Start, pause, −1, +1 and +5 minutes, or click the time to type one.
- When a timer finishes it flashes, shows a notice and beeps until dismissed. *+1 min*
  snoozes it.
- Timers keep running across re-renders, language and layout changes, and leaving the recipe,
  and are saved on each device. The screen is kept on while a timer runs.
- Settings for the position, size, sound, keeping the screen on and the cook time property,
  and a *Test alarm* button.

## 0.5.0-beta.1

Test build of the next version, installed by BRAT like 0.4.0.

**Mark as made**
- A *Mark as made* button at the end of the directions, and a *Mark recipe as made* command.
  They check `made`, set `last made` to today and add today to `previously made`, creating
  the properties if needed, with an *Undo* notice. The property names are in the settings.

**Bilingual recipes**
- Headings shared by all languages, like "Ingredients", are shown in the selected language,
  e.g. "Malzemeler". Set them in the new *Heading translations* setting.

**Other**
- Changing only a note's properties no longer redraws the recipe card, so crossed-out
  ingredients and the selected step are kept.

## 0.4.0

First release of this fork ([mavi-baykus/obsidian-recipe-view](https://github.com/mavi-baykus/obsidian-recipe-view)).
It is installed with [BRAT](https://github.com/TfTHacker/obsidian42-brat). It uses the same plugin
id as the original, so it replaces it and keeps its settings.

**Switching between note and recipe view**
- "Open as note" buttons in the recipe view header and next to the recipe title, and an
  "Open as recipe" button in the header of recipe notes (by tag or folder).
- Going back to the note restores the mode it was in (Reading view, Live Preview or Source
  mode) and its cursor and scroll position, or a mode set in the settings.
- Inline code tokens can be hidden in recipe view. By default this is `button-RecipeView`: the
  Buttons plugin's inline buttons fail with "Could not get Active View" there.
- The card re-renders when the note changes, keeping the scale.

**Bilingual recipes**
- Label ingredients and steps by language with a bold line or heading, such as `**Türkçe**`
  and `**English**`, and recipe view shows one language at a time.
- A language switcher under *Scale recipe*. A translate button beside each ingredient and
  step shows the other language underneath. *Show all translations*, and the keys `t` and `T`.
- Crossed-out ingredients and the selected step carry over when switching language.
- The recipe opens in the language last chosen for it. Otherwise it uses its
  `recipe-language` property, then the default language. There's also an option to ask
  every time, and an "Open recipe view in …" command for each language.
- A warning is shown when the languages have different numbers of ingredients or steps.

**Formatting**
- Paragraphs that are only bold text (e.g. `**Dough**`) and `####`–`######` headings are
  sub-headings. They are no longer selectable steps.
- Ordered step lists keep their start number (e.g. a list starting at 8).
- Option to show bullets on ingredients in the two-column layout.

**Quantities**
- Fixes `2½` scaling as `10 ½`. Turkish letters are no longer decomposed.
- Both ends of ranges scale (`1-2`, `520–585 g`, `2 to 3`).
- Turkish units (`su bardağı`, `yemek kaşığı`, `çay kaşığı`, …), `gr` and `lt`, and an
  *Additional units* setting.
- Units no longer match the start of words, and the double space in `6 ounces` is gone.

Requires Obsidian 1.4.4 or newer.
