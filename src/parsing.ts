import RecipeViewPlugin from "./main";
import RecipeLeaf from "./RecipeLeaf.svelte";
import CheckableIngredientList from "./CheckableIngredientList.svelte";
import SelectableStepList from "./SelectableStepList.svelte";
import { Component, MarkdownRenderer } from "obsidian";
import store from "./store"
import { Writable, get, writable } from "svelte/store"
import Fraction from "fraction.js";
import { matchQuantities, normaliseFractions } from "./quantities";
import { parseList } from "./helpers";
import { RecipeBlock, Translation, buildRecipeModel } from "./model";
import { languageName, parseLanguages } from "./languages";
import LanguageWarning from "./LanguageWarning.svelte";
import ScaledQuantity from "./ScaledQuantity.svelte";
import { ComponentType } from "svelte";


export interface ParsedRecipeComponent {
    type: ComponentType;
    props: Record<string, unknown>;
    origIndex: number;
    /** The language the component is in, if it is in a language section */
    lang?: string;
    /** Whether it is the label naming its language, hidden when showing one language */
    languageLabel?: boolean;
}

export interface ParsedRecipeSection {
    containsHeader: boolean;
    sideComponents: Array<ParsedRecipeComponent>;
    mainComponents: Array<ParsedRecipeComponent>;
}
export interface ParsedRecipe {
    title: string;
    thumbnailPath: string;
    sections: Array<ParsedRecipeSection>;
    renderedMarkdownParent: HTMLElement;
    qtyScaleStore: Writable<Fraction>;
    /** Languages the recipe has labels for, in order */
    languages: Array<{ code: string; name: string }>;
    /** Ingredients and steps matched between languages */
    translations: Map<HTMLElement, Translation[]>;
}

function parseForQty(n: Node, qtyScaleStore: Writable<Fraction>, extraUnits: string[]) {
    if (n.nodeType == Node.ELEMENT_NODE) {
        if (
            (n as HTMLElement).hasAttribute("data-qty") ||
            (n as HTMLElement).hasAttribute("data-qty-no-parse")
        ) {
            return;
        }
    }

    if (n.nodeType == Node.TEXT_NODE) {
        const parent = n.parentNode!;
        let currentIndex = 0;
        n.textContent = normaliseFractions(n.textContent!);
        for (const match of matchQuantities(n.textContent!, extraUnits)) {
            parent.insertBefore(
                document.createTextNode(
                    n.textContent!.slice(currentIndex, match.index)
                ),
                n
            );
            const qtyTarget = createEl("span");
            qtyTarget.setAttribute("data-qty", "true");
            parent.insertBefore(qtyTarget, n);
            new ScaledQuantity({
                target: qtyTarget,
                props: {
                    value: match.value.value,
                    format: match.value.format,
                    unit: match.unit,
                    qtyScaleStore: qtyScaleStore,
                },
            });
            currentIndex = (match.index || currentIndex) + match.length;
        }
        parent.insertBefore(
            document.createTextNode(n.textContent!.slice(currentIndex)),
            n
        );
        parent.removeChild(n);
    }

    if (n.hasChildNodes()) {
        Array.from(n.childNodes).forEach((c) =>
            parseForQty(c, qtyScaleStore, extraUnits)
        );
    }
}

function injectQuantities(parsedRecipe: ParsedRecipe, extraUnits: string[]) {
    parsedRecipe.sections.flatMap((s) => s.sideComponents.concat(s.mainComponents)).map((c) => {
        switch (c.type) {
            case RecipeLeaf:
                Array.from((c.props.childNodesOf as HTMLElement).querySelectorAll("[data-qty-parse]"))
                    .forEach((n) => parseForQty(n, parsedRecipe.qtyScaleStore, extraUnits));
                break;

            case SelectableStepList:
                if (c.props.kind == "ol") {
                    Array.from((c.props.list as HTMLElement).querySelectorAll("[data-qty-parse]"))
                        .forEach((n) => parseForQty(n, parsedRecipe.qtyScaleStore, extraUnits));
                } else {
                    (c.props.list as Array<HTMLElement>).forEach((p) => {
                        Array.from(p.querySelectorAll("[data-qty-parse]"))
                            .forEach((n) => parseForQty(n, parsedRecipe.qtyScaleStore, extraUnits));
                    })
                }
                break;

            case CheckableIngredientList:
                parseForQty((c.props.list as HTMLElement), parsedRecipe.qtyScaleStore, extraUnits);
                break;

            default:
                break;
        }
    })
}

function blockToComponent(
    block: RecipeBlock, plugin: RecipeViewPlugin, radioName: string
): ParsedRecipeComponent {
    const [item] = block.elements;
    switch (block.kind) {
        case "ingredients":
            return {
                type: CheckableIngredientList,
                props: { list: item, bullets: plugin.settings.showBulletsTwoColumn },
                origIndex: block.origIndex,
            };
        case "steps":
            return {
                type: SelectableStepList,
                props: { list: item, kind: "ol", radioName: radioName },
                origIndex: block.origIndex,
            };
        case "paragraphs":
            return {
                type: SelectableStepList,
                props: { list: block.elements, kind: "p", radioName: radioName },
                origIndex: block.origIndex,
            };
        case "warning":
            return {
                type: LanguageWarning,
                props: { message: block.message },
                origIndex: block.origIndex,
            };
        case "callout": {
            // A callout is a top-level div, so it needs wrapping or we'll steal its
            // children without the actual <div class='callout'> around them
            const calloutWrapper = createDiv();
            calloutWrapper.appendChild(item);
            return {
                type: RecipeLeaf,
                props: { childNodesOf: calloutWrapper, asTag: "div" },
                origIndex: block.origIndex,
            };
        }
        default:
            // Headings, sub-heading labels and anything else are shown as they are
            return {
                type: RecipeLeaf,
                props: { childNodesOf: item, asTag: item.nodeName },
                origIndex: block.origIndex,
            };
    }
}

export function parseRecipeMarkdown(
    plugin: RecipeViewPlugin, text: string, path: string, component: Component
) {
    // Create our object to store the result.
    // - When we want to render HTML elements created from rendering the markdown, we need
    // to reparent them rather than clone them (or e.g. callout icons, transclusions,
    // etc. get lost.) As such, every element being rendered directly from the rendered
    // markdown needs to be wrapped in a RecipeLeaf, which ensures it doesn't get
    // destroyed if the components get rebuilt e.g. because the layout changes.
    const result: ParsedRecipe = {
        title: "",
        thumbnailPath: "",
        sections: [{
            containsHeader: false,
            sideComponents: [],
            mainComponents: [],
        }],
        renderedMarkdownParent: createDiv(),
        qtyScaleStore: writable(new Fraction(1)),
        languages: [],
        translations: new Map(),
    };

    MarkdownRenderer.render(plugin.app, text, result.renderedMarkdownParent, path, component);


    const radioName = `selectable-steps-${get(store.counter)}`;
    store.counter.update((n) => n + 1);

    const languages = parseLanguages(plugin.settings.languages);
    const model = buildRecipeModel(result.renderedMarkdownParent, {
        sideColumnRegex: RegExp(plugin.settings.sideColumnRegex, "i"),
        treatH1AsFilename: plugin.settings.treatH1AsFilename,
        languages: languages,
    });
    result.title = model.title;
    result.thumbnailPath = model.thumbnailPath;
    result.languages = model.languages.map((code) => ({ code, name: languageName(code, languages) }));
    result.translations = model.translations;
    result.sections = model.sections.map((section) => {
        const parsed: ParsedRecipeSection = {
            containsHeader: section.containsHeader,
            sideComponents: [],
            mainComponents: [],
        };
        for (const block of section.blocks) {
            const components = block.column == "side" ? parsed.sideComponents : parsed.mainComponents;
            const component = blockToComponent(block, plugin, radioName);
            if (block.lang) component.lang = block.lang;
            if (block.languageLabel) component.languageLabel = true;
            components.push(component);
        }
        return parsed;
    });

    injectQuantities(result, parseList(plugin.settings.extraUnits));

    return result;
}