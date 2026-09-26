Bilingual recipes
=================

A recipe can have its ingredients and steps in more than one language. Recipe view then shows one language at a time, with a button next to each ingredient and step to show it in the other language.

Formatting
**********

Label each language with a line of bold text, or a heading, using one of the names set under *Languages* in the plugin settings:

.. code-block:: markdown

  ### Ingredients
  **Türkçe**
  - 1 kuru soğan
  - 7 su bardağı (1.4 L) et suyu

  **English**
  - 1 onion
  - 7 cups (1.4 L) beef or chicken broth

  ### Directions
  **Türkçe**
  1. Soğanı doğrayın.

  **English**
  1. Chop the onion.

A language's section runs until the next language label or the next section heading (``### Directions`` above). With heading labels like ``#### English``, it runs until the next heading of the same or a higher level. Anything outside a language section, such as a ``### Notes`` section, is shown in every language.

Ingredients and steps are matched between languages by position: the third ingredient in Türkçe goes with the third in English. Sub-headings inside a language, like ``**Dough**``, are fine. If the number of ingredients (or steps) differs between languages, they can't be matched, and a warning is shown instead of translation buttons.

Choosing a language
*******************

* Use the buttons under *Scale recipe* to switch between languages, or show both.
* The *When opening a bilingual recipe* setting chooses between the language last used for that recipe, the *Default language*, or asking each time.
* A recipe can set its own language with a ``recipe-language`` property, e.g. ``recipe-language: English``.
* The *Open recipe view in <language>* commands open a recipe in a particular language, and *Choose the language of a bilingual recipe* asks.

Showing translations
********************

Click the translate button next to an ingredient or step to show it in the other language underneath; click it again to hide it. *Show all translations* shows every one. Translations are scaled along with the recipe, and crossing out an ingredient or selecting a step carries over when you switch languages.

The *Show translation buttons* setting can show the buttons only on the selected step and the focused ingredient.
