import { Writable } from "svelte/store";
import { Translation } from "./model";

/** Svelte context key for the language state of a recipe card */
export const LANGUAGE_CONTEXT = "recipe-view-language";

export interface LanguageContext {
    /** The language shown, or ALL_LANGUAGES */
    language: Writable<string>;
    /** Display names of the recipe's languages, by code */
    names: Record<string, string>;
    /** Ingredients and steps matched between languages */
    translations: Map<HTMLElement, Translation[]>;
    /** Items whose translations are shown, by any one of their elements */
    revealed: Writable<Set<Translation[]>>;
    /** Show every translation */
    revealAll: Writable<boolean>;
    /** Changes whenever an ingredient is crossed out, to update its other languages */
    checks: Writable<number>;
    /** The element of the selected step */
    selectedStep: Writable<HTMLElement | null>;
    /** Only show the translate button on the selected step and focused ingredient */
    revealOnSelectedOnly: boolean;
}

/** The translations of an item in other languages than the one shown */
export function otherTranslations(ctx: LanguageContext | undefined, el: HTMLElement, language: string): Translation[] {
    if (!ctx) return [];
    return (ctx.translations.get(el) || []).filter((t) => t.el != el && t.lang != language);
}
