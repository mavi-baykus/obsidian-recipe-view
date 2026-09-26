<script lang="ts">
	import { getContext } from "svelte";
	import RecipeLeaf from "./RecipeLeaf.svelte";
	import Translations from "./Translations.svelte";
	import {
		LANGUAGE_CONTEXT,
		LanguageContext,
		otherTranslations,
	} from "./recipe-context";
	import { ALL_LANGUAGES } from "./languages";

	export let list: HTMLOListElement | Array<HTMLElement>;
	export let kind: string;
	export let radioName: string;

	const ctx = getContext<LanguageContext>(LANGUAGE_CONTEXT);
	const { language, selectedStep } = ctx;

	function othersOf(el: HTMLElement, language: string) {
		return language == ALL_LANGUAGES ? [] : otherTranslations(ctx, el, language);
	}

	// The selected step stays selected when switching to another language
	function isSelected(el: HTMLElement, selected: HTMLElement | null, language: string) {
		if (!selected) return false;
		if (selected == el) return true;
		return (
			language != ALL_LANGUAGES &&
			!!ctx.translations.get(el)?.some((t) => t.el == selected)
		);
	}

	function olChildren() {
		return (list as HTMLOListElement).children;
	}

	// Keep the numbering of lists that don't start at 1, e.g. "8. Next step"
	function olStart() {
		const start = (list as HTMLOListElement).getAttribute("start");
		return start ? parseInt(start) : undefined;
	}

	function olChild(index: number) {
		return olChildren().item(index)! as HTMLElement;
	}

	function pList() {
		return list as Array<HTMLElement>;
	}
</script>

{#if kind == "ol"}
	<!-- means steps is the children of an OL element -->
	<div>
		<ol
			class="recipe-mutex-select"
			class:reveal-selected-only={ctx.revealOnSelectedOnly}
			start={olStart()}
		>
			{#each olChildren() as _, i}
				{@const others = othersOf(olChild(i), $language)}
				<li class:translatable={others.length > 0}>
					<label>
						<input
							type="radio"
							name={radioName}
							checked={isSelected(olChild(i), $selectedStep, $language)}
							on:change={() => selectedStep.set(olChild(i))}
						/>
						<div class="leaf">
							<RecipeLeaf childNodesOf={olChild(i)} asTag="div" />
						</div>
					</label>
					{#if others.length > 0}
						<Translations
							translations={ctx.translations.get(olChild(i)) || []}
							{others}
						/>
					{/if}
				</li>
			{/each}
		</ol>
	</div>
{:else if kind == "p"}
	<!-- means steps is an array of P elements -->
	{#each pList() as p}
		{@const others = othersOf(p, $language)}
		<div class:reveal-selected-only={ctx.revealOnSelectedOnly}>
			<p class:translatable={others.length > 0}>
				<label>
					<input
						type="radio"
						name={radioName}
						checked={isSelected(p, $selectedStep, $language)}
						on:change={() => selectedStep.set(p)}
					/>
					<div class="leaf">
						<RecipeLeaf childNodesOf={p} asTag="div" />
					</div>
				</label>
				{#if others.length > 0}
					<Translations translations={ctx.translations.get(p) || []} {others} />
				{/if}
			</p>
		</div>
	{/each}
{/if}

<style>
	li {
		margin-block: var(--p-spacing);
	}

	input[type="radio"] {
		opacity: 0;
		position: absolute;
		height: 100%;
		width: 100%;
		margin: 0;
		padding: 0;
		z-index: -1;
	}

	label {
		position: relative;
	}

	.translatable {
		position: relative;
		padding-inline-end: var(--size-4-6);
	}

	.reveal-selected-only
		> .translatable:not(:has(input:checked)):not(:focus-within):not(:hover)
		> :global(.reveal-translation:not(.is-active)) {
		visibility: hidden;
	}

	.leaf {
		border-radius: var(--radius-m);
		padding: var(--size-4-2);
		margin: calc(-1 * var(--size-4-2));
	}

	:global(body:not(.is-mobile)) li .leaf {
		/* on desktop, include number in selected step
           -> operates weirdly on mobile, so there just leave default spacing 
		*/
		padding-inline-start: var(--list-indent);
		margin-inline-start: calc(-1 * var(--list-indent));
	}

	input[type="radio"]:checked ~ .leaf {
		background-color: hsla(
			var(--accent-h),
			var(--accent-s),
			var(--accent-l),
			var(--selected-step-alpha)
		);
	}

	input[type="radio"]:focus ~ .leaf {
		box-shadow: inset 0px 0px 0px var(--border-width)
			var(--interactive-accent);
	}
</style>
