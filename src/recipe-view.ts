import RecipeViewPlugin from "./main";
import { Component, EditableFileView, Keymap, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";
import RecipeCard from "./RecipeCard.svelte"
import { parseRecipeMarkdown } from "./parsing";
import {
    MarkdownModeState, MarkdownPosition, noteBody, parseList, pickMarkdownMode, pickMarkdownPosition,
    stripInlineCodeTokens,
} from "./helpers";
import { ALL_LANGUAGES, chooseLanguage, parseLanguages } from "./languages";

export const VIEW_TYPE_RECIPE = "recipe-view";

export class RecipeView extends EditableFileView {
    plugin: RecipeViewPlugin
    content?: RecipeCard
    // The mode (reading/editing) the note was in before switching to recipe view
    returnState: MarkdownModeState | null = null
    // Where the cursor and scroll were in the note, to return there
    returnPosition: MarkdownPosition | null = null
    // Owns everything rendered from the markdown, so it can be unloaded on re-render
    renderComponent?: Component
    renderedText?: string
    renderCount = 0
    // Kept across re-renders of the same note
    scaleNum = 1
    // The language shown, if chosen; otherwise picked when the recipe is rendered
    language: string | null = null
    // The languages of the rendered recipe
    languages: Array<{ code: string; name: string }> = []

    constructor(leaf: WorkspaceLeaf, plugin: RecipeViewPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_RECIPE;
    }

    getDisplayText(): string {
        return this.file?.basename || "Recipe";
    }

    getIcon(): string {
        return "chef-hat";
    }

    getState() {
        return {
            ...super.getState(),
            language: this.language,
            returnState: this.returnState,
            returnPosition: this.returnPosition,
        };
    }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        if (state && typeof state == "object") {
            const s = state as Record<string, unknown>;
            if ("returnState" in s) {
                this.returnState = pickMarkdownMode(s.returnState);
                this.returnPosition = pickMarkdownPosition(s.returnPosition);
            }
            this.language = typeof s.language == "string" ? s.language : null;
        }
        await super.setState(state, result);
    }

    async onOpen() {
        this.addAction("file-text", "Open as note", () => this.plugin.setMarkdownView(this.leaf));
        // Re-render when the note is changed elsewhere, e.g. in another pane or by sync. When
        // only its properties changed, e.g. by "Mark as made", just show the new properties,
        // keeping crossed-out ingredients, the selected step and the scroll position.
        this.registerEvent(this.app.metadataCache.on("changed", (file, data, cache) => {
            if (file != this.file || data == this.renderedText) return;
            if (this.content && this.renderedText !== undefined && noteBody(data) == noteBody(this.renderedText)) {
                this.renderedText = data;
                this.content.$set({ metadata: cache });
            } else {
                this.renderRecipe();
            }
        }));
        // These events can be registered directly as they'll be cleaned up
        // when `containerEl` goes out of scope
        this.containerEl.on('mouseover', 'a.internal-link', (e, el) => {
            this.app.workspace.trigger('hover-link', {
                event: e,
                source: this,
                hoverParent: this,
                el,
                linktext: el.getAttr("href"),
                sourcePath: this.file!.path,
            });
        });
        this.containerEl.on('click', 'a.internal-link', (e, el) => {
            const inNewLeaf = Keymap.isModEvent(e);
            this.app.workspace.openLinkText(
                el.getAttr("href")!,
                this.file!.path,
                inNewLeaf,
            )
        });
        this.containerEl.on('click', 'a.tag', (e, el) => {
            (this.app as any).internalPlugins.getPluginById('global-search')
                .instance.openGlobalSearch(`tag:${el.getAttr('href')}`);
        });
    }

    async onClose() {
        this.clearRecipe();
    }

    async onLoadFile(file: TFile): Promise<void> {
        await super.onLoadFile(file);
        await this.renderRecipe();
    }

    async onUnloadFile(file: TFile): Promise<void> {
        this.clearRecipe();
        this.renderedText = undefined;
        this.scaleNum = 1;
        await super.onUnloadFile(file);
    }

    clearRecipe() {
        this.content?.$destroy();
        this.content = undefined;
        if (this.renderComponent) {
            this.removeChild(this.renderComponent);
            this.renderComponent = undefined;
        }
        this.contentEl.empty();
    }

    async renderRecipe(): Promise<boolean> {
        const file = this.file;
        if (!file) { return false }
        const renderId = ++this.renderCount;
        const text = await this.app.vault.cachedRead(file);
        // Another render started, or a different file was opened, while reading this one
        if (renderId != this.renderCount || file != this.file) { return false }

        this.clearRecipe();
        this.renderedText = text;
        this.renderComponent = this.addChild(new Component());
        const metadata = this.app.metadataCache.getFileCache(file);
        const parsedRecipe = parseRecipeMarkdown(
            this.plugin,
            stripInlineCodeTokens(text, parseList(this.plugin.settings.hiddenInlineCode)),
            file.path,
            this.renderComponent,
        );
        const settings = this.plugin.settings;
        const requested = this.language;
        const recipeLanguage = metadata?.frontmatter?.["recipe-language"];
        this.languages = parsedRecipe.languages;
        const language = chooseLanguage(
            parsedRecipe.languages.map((l) => l.code),
            {
                requested: requested,
                noteDefault: typeof recipeLanguage == "string" ? recipeLanguage : null,
                lastUsed: settings.openLanguage == "last" ? settings.lastLanguages[file.path] : null,
                defaultLanguage: settings.defaultLanguage,
            },
            parseLanguages(settings.languages),
        );
        // Only keep a language for recipes that have them, so a recipe that gains a second
        // language later still gets the default or is asked about
        this.language = this.hasLanguages() ? language : requested;
        this.content = new RecipeCard({
            target: this.contentEl,
            props: {
                parsedRecipe: parsedRecipe,
                file: file,
                metadata: metadata || undefined,
                view: this,
                initialScale: this.scaleNum,
                onScaleChange: (scale: number) => { this.scaleNum = scale },
                language: language,
                onLanguageChange: (language: string) => this.languageChanged(language),
                initialWidth: this.contentEl.clientWidth || undefined,
            }
        });

        if (!requested && settings.openLanguage == "ask" && this.hasLanguages()) {
            this.askLanguage();
        }

        return true;
    }

    hasLanguages() {
        return this.languages.length > 1;
    }

    hasLanguage(language: string) {
        return language == ALL_LANGUAGES || this.languages.some((l) => l.code == language);
    }

    /** Show the recipe in another language, keeping crossed-out ingredients and steps */
    setLanguage(language: string) {
        if (!this.hasLanguages() || !this.hasLanguage(language)) return;
        // The card calls back to languageChanged
        this.content?.$set({ language });
    }

    askLanguage() {
        this.plugin.askLanguage(this.languages, (language) => this.setLanguage(language));
    }

    languageChanged(language: string) {
        this.language = language;
        if (this.file && this.hasLanguages()) {
            this.plugin.rememberLanguage(this.file.path, language);
        }
        this.app.workspace.requestSaveLayout();
    }
}
