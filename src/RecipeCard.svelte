<script lang="ts">
	import { CachedMetadata, TFile } from "obsidian";
	import { setContext } from "svelte";
	import { writable } from "svelte/store";
	import RecipeCardTitleBlock from "./RecipeCardTitleBlock.svelte";
	import RecipeViewPlugin from "./main";
	import store from "./store";
	import RecipeToolbar from "./RecipeToolbar.svelte";
	import LanguageWarning from "./LanguageWarning.svelte";
	import MadeButton from "./MadeButton.svelte";
	import { ALL_LANGUAGES } from "./languages";
	import { LANGUAGE_CONTEXT, LanguageContext } from "./recipe-context";
	import Fraction from "fraction.js";
	import RecipeCardTwoColumn from "./RecipeCardTwoColumn.svelte";
	import RecipeCardSplitSteps from "./RecipeCardSplitSteps.svelte";
	import RecipeCardOneColumn from "./RecipeCardOneColumn.svelte";
	import { ParsedRecipe, ParsedRecipeComponent } from "./parsing";
	import { RecipeView } from "./recipe-view";

	let plugin: RecipeViewPlugin;
	store.plugin.subscribe((p) => (plugin = p));

	// Props to be passed in
	export let parsedRecipe: ParsedRecipe;
	export let metadata: CachedMetadata | undefined;
	export let file: TFile;
	export let view: RecipeView;
	export let initialScale = 1;
	export let onScaleChange: ((scale: number) => void) | undefined = undefined;
	export let language: string = ALL_LANGUAGES;
	// Width of the view when first rendered, so the right layout is picked straight away
	export let initialWidth: number | undefined = undefined;
	export let onLanguageChange: ((language: string) => void) | undefined =
		undefined;

	// Recipe scaling - create store here to pass to all children via ctx
	let scaleNum = initialScale;
	let qtyScale: Fraction;
	$: parsedRecipe?.qtyScaleStore.set(qtyScale);
	$: if (scaleNum) onScaleChange?.(scaleNum);

	// Languages of bilingual recipes, shared with the ingredient and step lists
	const languageStore = writable(language);
	const revealAll = writable(false);
	const languageContext: LanguageContext = {
		language: languageStore,
		names: Object.fromEntries(
			parsedRecipe.languages.map(({ code, name }) => [code, name]),
		),
		translations: parsedRecipe.translations,
		revealed: writable(new Set()),
		revealAll: revealAll,
		checks: writable(0),
		selectedStep: writable(null),
		revealOnSelectedOnly: view.plugin.settings.revealButtons == "selected",
	};
	setContext(LANGUAGE_CONTEXT, languageContext);
	// The language can be changed from outside (a command) or by the toolbar
	$: languageStore.set(language);
	let previousLanguage = language;
	languageStore.subscribe((l) => {
		if (l == previousLanguage) return;
		previousLanguage = l;
		language = l;
		onLanguageChange?.(l);
	});

	// When showing one language, hide the other languages and the language labels
	function isShown(c: ParsedRecipeComponent, language: string) {
		if (language == ALL_LANGUAGES) return c.type != LanguageWarning;
		return !c.lang || (c.lang == language && !c.languageLabel);
	}
	$: visibleSections = parsedRecipe.sections.map((s) => ({
		...s,
		sideComponents: s.sideComponents.filter((c) => isShown(c, language)),
		mainComponents: s.mainComponents.filter((c) => isShown(c, language)),
	}));

	// Determining the recipe format
	let containerWidth: number | undefined = initialWidth;
	$: isBelowSingleColumnWidth =
		containerWidth !== undefined &&
		containerWidth < plugin.settings.singleColumnMaxWidth;
	$: twoColumnSideComponents = visibleSections.flatMap(
		({ sideComponents }) => sideComponents,
	);
	$: twoColumnMainComponents = visibleSections.map(
		({ mainComponents }) => mainComponents,
	);
	$: singleColumnSections = visibleSections.map((s) =>
		s.sideComponents
			.concat(s.mainComponents)
			.sort(
				(a: ParsedRecipeComponent, b: ParsedRecipeComponent) =>
					a.origIndex - b.origIndex
			)
	);

	// Titleblock variables
	$: title = parsedRecipe.title ? parsedRecipe.title : file.basename;
	$: frontmatter = metadata?.frontmatter || {};

	// "Mark as made", at the end of the directions
	const showMadeButton = view.plugin.settings.madeButton;
	const madeProperties = view.plugin.madeProperties();
	const markMade = () => view.plugin.markMade(file);

	// DOM searching and manipulating keyboard shortcuts
	let container: HTMLDivElement;

	function checkNext(focusOnly: boolean) {
		const nextUnchecked = container.querySelector(
			"li input[type=checkbox]:not(:checked)"
		) as HTMLInputElement;
		if (nextUnchecked) {
			if (!focusOnly) setChecked(nextUnchecked, true);
			nextUnchecked.focus();
		}
	}

	function uncheckPrevious() {
		const checked = container.querySelectorAll(
			"li input[type=checkbox]:checked"
		) as NodeListOf<HTMLInputElement>;
		if (checked.length > 0) {
			const lastChecked = checked.item(checked.length - 1);
			setChecked(lastChecked, false);
			lastChecked.focus();
		}
	}

	// Cross out an ingredient as if it was clicked, so it is kept across languages
	function setChecked(ingredient: HTMLInputElement, checked: boolean) {
		ingredient.checked = checked;
		ingredient.dispatchEvent(new Event("change"));
	}

	function advanceStep(focusOnly: boolean) {
		const steps = container.querySelectorAll(
			"input[type=radio]"
		) as NodeListOf<HTMLInputElement>;
		for (let i = 0; i < steps.length; i++) {
			if (steps.item(i).checked) {
				if (!focusOnly && steps.item(i + 1)) select(steps.item(i + 1));
				if (focusOnly || steps.item(i + 1))
					steps.item(focusOnly ? i : i + 1).focus();
				return;
			}
		}
		if (!focusOnly) select(steps.item(0));
		steps.item(0).focus();
	}

	function retreatStep() {
		const steps = container.querySelectorAll(
			"input[type=radio]"
		) as NodeListOf<HTMLInputElement>;
		for (let i = 1; i < steps.length; i++) {
			if (steps.item(i).checked) {
				select(steps.item(i - 1));
				steps.item(i - 1).focus();
				return;
			}
		}
	}

	// Select a step as if it was clicked, so the selection is kept across languages
	function select(step: HTMLInputElement) {
		step.checked = true;
		step.dispatchEvent(new Event("change"));
	}

	// Show or hide the translation of the focused ingredient or the selected step
	function toggleTranslation() {
		const focused = container.querySelector(
			"input[type=checkbox]:focus, input[type=radio]:focus",
		);
		const input =
			focused || container.querySelector("input[type=radio]:checked");
		const button = input
			?.closest(".translatable")
			?.querySelector(":scope > .reveal-translation") as HTMLElement | null;
		button?.click();
	}

	function handleKeypress(e: KeyboardEvent) {
		if (e.key == "n") {
			checkNext(false);
		} else if (e.key == "p") {
			uncheckPrevious();
		} else if (e.key == "j") {
			advanceStep(false);
		} else if (e.key == "k") {
			retreatStep();
		} else if (e.key == "[") {
			if (scaleNum) {
				scaleNum -= 0.25;
			} else {
				scaleNum = 0.75;
			}
		} else if (e.key == "]") {
			if (scaleNum) {
				scaleNum += 0.25;
			} else {
				scaleNum = 1.25;
			}
		} else if (e.key == "h") {
			checkNext(true);
		} else if (e.key == "l") {
			advanceStep(true);
		} else if (e.key == "t") {
			toggleTranslation();
		} else if (e.key == "T" && language != ALL_LANGUAGES) {
			revealAll.update((all) => !all);
		}
	}
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
	class={frontmatter?.cssclasses?.join(" ")}
	class:container={true}
	class:markdown-rendered={true}
	bind:clientWidth={containerWidth}
	bind:this={container}
	on:keypress={handleKeypress}
	role="document"
>
	{#if isBelowSingleColumnWidth != false || twoColumnSideComponents.length == 0 || twoColumnMainComponents.flat().length == 0}
		<RecipeCardOneColumn sections={singleColumnSections}>
			<RecipeToolbar
				slot="scaleselector"
				bind:scale={qtyScale}
				bind:scaleNum
				language={languageStore}
				languages={parsedRecipe.languages}
				{revealAll}
			/>

			<RecipeCardTitleBlock
				slot="titleblock"
				{title}
				{frontmatter}
				thumbnailPath={parsedRecipe?.thumbnailPath}
				singleColumn={true}
				app={plugin.app}
				{file}
				{view}
			/>
			<svelte:fragment slot="footer">
				{#if showMadeButton}
					<MadeButton {frontmatter} names={madeProperties} onMark={markMade} />
				{/if}
			</svelte:fragment>
		</RecipeCardOneColumn>
	{:else if parsedRecipe?.sections.length <= 3}
		<RecipeCardTwoColumn
			sideColumnComponents={twoColumnSideComponents}
			mainColumnSections={twoColumnMainComponents}
		>
			<RecipeToolbar
				slot="scaleselector"
				bind:scale={qtyScale}
				bind:scaleNum
				language={languageStore}
				languages={parsedRecipe.languages}
				{revealAll}
			/>

			<RecipeCardTitleBlock
				slot="titleblock"
				{title}
				{frontmatter}
				thumbnailPath={parsedRecipe?.thumbnailPath}
				singleColumn={false}
				app={plugin.app}
				{file}
				{view}
			/>
			<svelte:fragment slot="footer">
				{#if showMadeButton}
					<MadeButton {frontmatter} names={madeProperties} onMark={markMade} />
				{/if}
			</svelte:fragment>
		</RecipeCardTwoColumn>
	{:else}
		<RecipeCardSplitSteps sections={visibleSections}>
			<RecipeToolbar
				slot="scaleselector"
				bind:scale={qtyScale}
				bind:scaleNum
				language={languageStore}
				languages={parsedRecipe.languages}
				{revealAll}
			/>

			<RecipeCardTitleBlock
				slot="titleblock"
				{title}
				{frontmatter}
				thumbnailPath={parsedRecipe?.thumbnailPath}
				singleColumn={false}
				app={plugin.app}
				{file}
				{view}
			/>
			<svelte:fragment slot="footer">
				{#if showMadeButton}
					<MadeButton {frontmatter} names={madeProperties} onMark={markMade} />
				{/if}
			</svelte:fragment>
		</RecipeCardSplitSteps>
	{/if}
</div>

<style>
	.container {
		position: relative;
		top: 0;
		left: 0;
		right: 0;
		height: 100%;
		width: 100%;
		display: block;
	}

	/* Hide strange mobile frontmatter stuff */
	:global(.recipe-card div:has(> .frontmatter-section)) {
		display: none;
	}
</style>
