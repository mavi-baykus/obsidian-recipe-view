import { App, MarkdownView, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, addIcon, debounce, getAllTags } from 'obsidian';

import { RecipeView, VIEW_TYPE_RECIPE } from './recipe-view';
import store from './store';
import { WHISK_SVG } from './whisk';
import { ReturnMode, isRecipeNote, markdownModeForReturn, parseList, pickMarkdownMode, pickMarkdownPosition } from './helpers';
import { parseLanguages } from './languages';
import { LanguageModal } from './language-modal';

type HeaderButtonMode = "recipes" | "all" | "off";
type OpenLanguageMode = "last" | "default" | "ask";
type RevealButtonsMode = "all" | "selected";

interface RecipeViewPluginSettings {
	sideColumnRegex: string;
	treatH1AsFilename: boolean;
	renderUnicodeFractions: boolean;
	singleColumnMaxWidth: number;
	showBulletsTwoColumn: boolean;
	headerButton: HeaderButtonMode;
	recipeTags: string;
	recipeFolders: string;
	returnMode: ReturnMode;
	hiddenInlineCode: string;
	extraUnits: string;
	languages: string;
	defaultLanguage: string;
	openLanguage: OpenLanguageMode;
	revealButtons: RevealButtonsMode;
	/** The language last chosen for each bilingual recipe, by path */
	lastLanguages: Record<string, string>;
}

const DEFAULT_SETTINGS: RecipeViewPluginSettings = {
	sideColumnRegex: 'Ingredients|Nutrition',
	treatH1AsFilename: false,
	renderUnicodeFractions: true,
	singleColumnMaxWidth: 600,
	showBulletsTwoColumn: false,
	headerButton: "recipes",
	recipeTags: "recipe",
	recipeFolders: "",
	returnMode: "previous",
	hiddenInlineCode: "button-RecipeView",
	extraUnits: "",
	languages: "en: English, İngilizce\ntr: Türkçe, Turkish",
	defaultLanguage: "",
	openLanguage: "last",
	revealButtons: "all",
	lastLanguages: {},
}

export default class RecipeViewPlugin extends Plugin {
	settings: RecipeViewPluginSettings = DEFAULT_SETTINGS;

	// "Open as recipe" buttons added to the header of markdown views
	headerActions = new Map<MarkdownView, HTMLElement>();

	// Ids of the "Open recipe view in <language>" commands
	languageCommandIds: string[] = [];
	registeredLanguages = "";

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_RECIPE, (leaf) => new RecipeView(leaf, this));

		addIcon("recipe-whisk", WHISK_SVG)
		this.addRibbonIcon("recipe-whisk", "Toggle recipe view", () => {
			this.toggleView(false);
		});

		this.addCommand({
			id: "toggle-recipe-view",
			name: "Toggle between recipe card and markdown",
			checkCallback: (c) => this.toggleView(c),
		});

		this.addCommand({
			id: "choose-recipe-language",
			name: "Choose the language of a bilingual recipe",
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(RecipeView);
				if (!view || !view.hasLanguages()) return false;
				if (!checking) view.askLanguage();
				return true;
			},
		});
		this.registerLanguageCommands();

		// Keep the last chosen languages when recipes are renamed or deleted
		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
			if (oldPath in this.settings.lastLanguages) {
				this.settings.lastLanguages[file.path] = this.settings.lastLanguages[oldPath];
				delete this.settings.lastLanguages[oldPath];
				this.saveData(this.settings);
			}
		}));
		this.registerEvent(this.app.vault.on("delete", (file) => {
			if (file.path in this.settings.lastLanguages) {
				delete this.settings.lastLanguages[file.path];
				this.saveData(this.settings);
			}
		}));

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new RecipeViewSettingsTab(this.app, this));

		// Load style settings variables
		this.app.workspace.trigger("parse-style-settings");

		store.plugin.set(this);

		// Keep the "Open as recipe" header buttons in sync with the open notes and their tags
		const updateHeaderActions = () => this.updateHeaderActions();
		this.registerEvent(this.app.workspace.on("layout-change", updateHeaderActions));
		this.registerEvent(this.app.workspace.on("file-open", updateHeaderActions));
		this.registerEvent(this.app.metadataCache.on("changed", updateHeaderActions));
		this.app.workspace.onLayoutReady(updateHeaderActions);
	}

	onunload() {
		this.headerActions.forEach((el) => el.remove());
		this.headerActions.clear();
	}

	isRecipeFile(file: TFile | null) {
		if (!file) return false;
		const cache = this.app.metadataCache.getFileCache(file);
		return isRecipeNote(
			file.path,
			(cache && getAllTags(cache)) || [],
			parseList(this.settings.recipeTags),
			parseList(this.settings.recipeFolders),
		);
	}

	shouldShowHeaderButton(file: TFile | null) {
		switch (this.settings.headerButton) {
			case "all":
				return !!file;
			case "recipes":
				return this.isRecipeFile(file);
			default:
				return false;
		}
	}

	updateHeaderActions() {
		const open = new Set<MarkdownView>();
		this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) return;
			open.add(view);
			const existing = this.headerActions.get(view);
			const wanted = this.shouldShowHeaderButton(view.file);
			if (wanted && !existing) {
				this.headerActions.set(
					view,
					view.addAction("chef-hat", "Open as recipe", () => this.setRecipeView(view.leaf)),
				);
			} else if (!wanted && existing) {
				existing.remove();
				this.headerActions.delete(view);
			}
		});
		// Forget views that have been closed or replaced, e.g. by a recipe view
		this.headerActions.forEach((el, view) => {
			if (!open.has(view)) {
				el.remove();
				this.headerActions.delete(view);
			}
		});
	}

	refreshRecipeViews = debounce(() => {
		this.app.workspace.getLeavesOfType(VIEW_TYPE_RECIPE).forEach((leaf) => {
			if (leaf.view instanceof RecipeView) leaf.view.renderRecipe();
		});
	}, 500, true);

	toggleView(checking: boolean) {
		const activeLeaf = this.app.workspace.getMostRecentLeaf();

		if (activeLeaf?.getViewState().type == "markdown") {
			if (!checking) {
				this.setRecipeView(activeLeaf!);
			}
		} else if (activeLeaf?.getViewState().type == VIEW_TYPE_RECIPE) {
			if (!checking) {
				this.setMarkdownView(activeLeaf!);
			}
		} else {
			return false;
		}
		return true;
	}

	/** Add a command for each language, replacing the previous ones if they changed */
	registerLanguageCommands() {
		if (this.registeredLanguages == this.settings.languages) return;
		this.registeredLanguages = this.settings.languages;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const commands = (this.app as any).commands;
		this.languageCommandIds.forEach((id) => commands?.removeCommand?.(`${this.manifest.id}:${id}`));
		this.languageCommandIds = [];
		for (const language of parseLanguages(this.settings.languages)) {
			const id = `open-recipe-in-${language.code}`;
			this.languageCommandIds.push(id);
			this.addCommand({
				id,
				name: `Open recipe view in ${language.names[0]}`,
				checkCallback: (checking) => {
					const leaf = this.app.workspace.getMostRecentLeaf();
					if (leaf?.view instanceof RecipeView) {
						if (!leaf.view.hasLanguages() || !leaf.view.hasLanguage(language.code)) return false;
						if (!checking) leaf.view.setLanguage(language.code);
						return true;
					}
					if (leaf?.view instanceof MarkdownView) {
						if (!checking) this.setRecipeView(leaf, language.code);
						return true;
					}
					return false;
				},
			});
		}
	}

	/** Remember the language chosen for a recipe, without re-rendering anything */
	rememberLanguage(path: string, language: string) {
		if (this.settings.lastLanguages[path] == language) return;
		this.settings.lastLanguages[path] = language;
		this.saveData(this.settings);
	}

	askLanguage(languages: Array<{ code: string; name: string }>, onChoose: (code: string) => void) {
		new LanguageModal(this.app, languages, onChoose).open();
	}

	async setRecipeView(leaf: WorkspaceLeaf, language?: string) {
		const state = leaf.view.getState();
		await leaf.setViewState({
			type: VIEW_TYPE_RECIPE,
			// Remember whether the note was in reading view or editing, and where, to return to it
			state: {
				file: state.file,
				language: language,
				returnState: pickMarkdownMode(state),
				returnPosition: pickMarkdownPosition(leaf.getEphemeralState()),
			},
			active: true,
			// @ts-ignore
			popstate: true,
		})
	}

	async setMarkdownView(leaf: WorkspaceLeaf) {
		const state = leaf.view.getState();
		const previous = leaf.view instanceof RecipeView ? leaf.view.returnState : null;
		const position = leaf.view instanceof RecipeView ? leaf.view.returnPosition : null;
		await leaf.setViewState({
			type: "markdown",
			state: { file: state.file, ...markdownModeForReturn(this.settings.returnMode, previous) },
			active: true,
			// @ts-ignore
			popstate: true,
		}, position ?? undefined)
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.settings.lastLanguages = { ...this.settings.lastLanguages };
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateHeaderActions();
		this.registerLanguageCommands();
		this.refreshRecipeViews();
	}
}

class RecipeViewSettingsTab extends PluginSettingTab {
	plugin: RecipeViewPlugin;

	constructor(app: App, plugin: RecipeViewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName("Recipe parsing").setHeading()

		new Setting(containerEl)
			.setName('Side column regex')
			.setDesc('A regular expression for headings of sections to pull to the side column')
			.addText(text => text
				.setPlaceholder('Ingredients|Nutrition')
				.setValue(this.plugin.settings!.sideColumnRegex)
				.onChange(async (value) => {
					this.plugin.settings!.sideColumnRegex = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Treat level one heading as filename')
			.setDesc('If turned on, then in recipes that have a "# Level one heading", there should only be one – and it will be used as the recipe title. Turn this on if you usually start your notes with a level one heading that matches the filename, and turn it off if you would ever use headings like "# Ingredients", "# Directons", etc.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings!.treatH1AsFilename)
				.onChange(async (value) => {
					this.plugin.settings!.treatH1AsFilename = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Additional units')
			.setDesc('Extra units to scale quantities with, separated by commas, e.g. "cloves, pinch". Common English and Turkish units are built in.')
			.addText(text => text
				.setPlaceholder('cloves, pinch')
				.setValue(this.plugin.settings.extraUnits)
				.onChange(async (value) => {
					this.plugin.settings.extraUnits = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName("Switching between note and recipe view").setHeading()

		new Setting(containerEl)
			.setName('Show recipe view button in note header')
			.setDesc('Adds a button next to the note\'s reading/editing toggle to open it as a recipe card. Recipe view always has a button to go back to the note.')
			.addDropdown(dropdown => dropdown
				.addOption("recipes", "Recipe notes only")
				.addOption("all", "All notes")
				.addOption("off", "Never")
				.setValue(this.plugin.settings.headerButton)
				.onChange(async (value) => {
					this.plugin.settings.headerButton = value as HeaderButtonMode;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Recipe tags')
			.setDesc('Notes with any of these tags count as recipe notes, separated by commas. Nested tags like #recipe/dessert are included.')
			.addText(text => text
				.setPlaceholder('recipe')
				.setValue(this.plugin.settings.recipeTags)
				.onChange(async (value) => {
					this.plugin.settings.recipeTags = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Recipe folders')
			.setDesc('Notes inside any of these folders also count as recipe notes, separated by commas.')
			.addText(text => text
				.setPlaceholder('Recipes')
				.setValue(this.plugin.settings.recipeFolders)
				.onChange(async (value) => {
					this.plugin.settings.recipeFolders = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('When leaving recipe view, open the note in')
			.addDropdown(dropdown => dropdown
				.addOption("previous", "The mode it was in before")
				.addOption("reading", "Reading view")
				.addOption("live", "Live Preview")
				.setValue(this.plugin.settings.returnMode)
				.onChange(async (value) => {
					this.plugin.settings.returnMode = value as ReturnMode;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Hide in recipe view')
			.setDesc('Inline code to leave out of the recipe card, separated by commas and without backticks. Use this for buttons from other plugins that don\'t work in recipe view, like the Buttons plugin\'s `button-RecipeView`.')
			.addText(text => text
				.setPlaceholder('button-RecipeView')
				.setValue(this.plugin.settings.hiddenInlineCode)
				.onChange(async (value) => {
					this.plugin.settings.hiddenInlineCode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName("Bilingual recipes").setHeading()

		new Setting(containerEl)
			.setName('Languages')
			.setDesc('One language per line: a short code, then the names you use to label each language in your notes, e.g. "tr: Türkçe, Turkish". A bold line or a heading with one of these names starts that language\'s ingredients or steps.')
			.addTextArea(text => text
				.setPlaceholder('en: English\ntr: Türkçe, Turkish')
				.setValue(this.plugin.settings.languages)
				.onChange(async (value) => {
					this.plugin.settings.languages = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default language')
			.setDesc('The language to show bilingual recipes in, as a code or name. Leave empty to use the first language in each recipe. A recipe can set its own default with a "recipe-language" property.')
			.addText(text => text
				.setPlaceholder('en')
				.setValue(this.plugin.settings.defaultLanguage)
				.onChange(async (value) => {
					this.plugin.settings.defaultLanguage = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('When opening a bilingual recipe')
			.addDropdown(dropdown => dropdown
				.addOption("last", "Use the language last chosen for it")
				.addOption("default", "Use the default language")
				.addOption("ask", "Ask which language")
				.setValue(this.plugin.settings.openLanguage)
				.onChange(async (value) => {
					this.plugin.settings.openLanguage = value as OpenLanguageMode;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show translation buttons')
			.setDesc('The button next to each ingredient and step that shows it in the other language.')
			.addDropdown(dropdown => dropdown
				.addOption("all", "On every ingredient and step")
				.addOption("selected", "Only on the selected step and ingredient")
				.setValue(this.plugin.settings.revealButtons)
				.onChange(async (value) => {
					this.plugin.settings.revealButtons = value as RevealButtonsMode;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Recipe card appearance")
			.setDesc("More options are available using the style settings plugin.")
			.setHeading()

		new Setting(containerEl)
			.setName('Render fractions in quantities as unicode')
			.setDesc('If on, fractions will appear like e.g. "½ cup". If off, they will appear like e.g. "1/2 cup".')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings!.renderUnicodeFractions)
				.onChange(async (value) => {
					this.plugin.settings!.renderUnicodeFractions = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Display ingredients in two-column view with bullets')
			.setDesc('If turned on, will display bullets for all checkable ingredient lists – not just in single-column view.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings!.showBulletsTwoColumn)
				.onChange(async (value) => {
					this.plugin.settings!.showBulletsTwoColumn = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Maximum pixel width for single-column view')
			.setDesc('Recipe cards shown wider than this view will switch to two-column layout.')
			.addSlider(slider => slider
				.setDynamicTooltip()
				.setLimits(50, 2000, 10)
				.setValue(this.plugin.settings!.singleColumnMaxWidth)
				.onChange(async (value) => {
					this.plugin.settings!.singleColumnMaxWidth = value;
					await this.plugin.saveSettings()
				}))
	}
}
