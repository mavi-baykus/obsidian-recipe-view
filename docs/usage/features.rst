Features overview
=================

.. image:: /_static/preview.png

**Features include:**

* 📒 Works with your recipes as-is, in :ref:`whatever format you like to write them<Formatting your recipes>`
* 🎨 Strives for maximum compatability with custom themes
* 🌈 Lets you use all the markdown that works in the rest of your vault
* ⚖️ :ref:`Scales the quantities in your recipes easily<Scaling ingredients>`
* ⚙️ Can :ref:`split your recipes into two columns<Side column sections>` or :ref:`separate ingredients out by step<Split steps>`, for easier reference while cooking
* ✅ Makes :ref:`ingredient lists cross-out-able<Checkable ingredient lists>`
* 📌 Lets you :ref:`highlight steps<Selectable step lists>` to keep track of where you're up to
* 📱 Works on phones and tablets

**Why keep your recipes in Obsidian?**

* 🗃 Portable and future-proof markdown
* 📝 Everything is a note – keep your nicely formatted recipes in the same folders as your scanned magazine clippings
* 🌏 Cross-link and tag your recipes, link them to notes on technique, keep a baking log in your daily notes, or use Dataview or Kanban to plan out your cooking
* ☁️ Write them on your laptop, check ingredients in the store on your phone, and cook from them in the kitchen with your iPad

Switching between note and recipe view
**************************************

* Recipe notes get a chef's hat button in the note header to open them as a recipe card. A note counts as a recipe if it has one of the *Recipe tags* (default ``recipe``, including nested tags like ``#recipe/dessert``) or is in one of the *Recipe folders* set in the plugin settings. The button can also be shown on all notes, or turned off.
* In recipe view, the "Open as note" button in the header (and next to the recipe title) goes back to the note where you left it: in whichever mode it was in before (Reading view, Live Preview or Source mode), with the same cursor and scroll position. This can be changed to always open Reading view or Live Preview.
* The ribbon icon and the *Toggle between recipe card and markdown* command also switch back and forth.
* Buttons from other plugins that don't work inside recipe view, like a Buttons plugin inline button ``button-RecipeView`` that runs the toggle command, can be hidden from the recipe card under *Hide in recipe view*.
* The recipe card updates when the note is changed elsewhere, e.g. in another pane or by sync, keeping the current scale. When only the note's properties change, crossed-out ingredients, the selected step and the scroll position are kept too.

Marking a recipe as made
************************

At the end of the directions, the *Mark as made* button records that you made the recipe today. It changes three properties, creating any that are missing:

* ``made`` is checked.
* ``last made`` is set to today's date.
* Today is added to the end of ``previously made``, a list of dates. Clicking again on the same day doesn't add it twice.

A notice confirms it, with an *Undo* button that puts the properties back as they were. Once a recipe is marked as made today, the button reads *Made today*.

The *Mark recipe as made* command does the same in recipe view or in a recipe note, so it can have a hotkey or be run from a Buttons plugin button, e.g.:

.. code-block:: text

    ```button
    name Made it
    type command
    action Recipe view: Mark recipe as made
    ```

The property names can be changed in the plugin settings, and the button can be hidden. New ``last made`` and ``previously made`` properties get the Date and List types, unless they already have a type.
