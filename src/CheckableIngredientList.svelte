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

	export let list: HTMLUListElement;
	export let bullets: boolean;

	const ctx = getContext<LanguageContext>(LANGUAGE_CONTEXT);
	const { language, checks } = ctx;

	// Depends on $checks so it updates when another language's copy is crossed out
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function isChecked(index: number, _checks = 0): boolean {
		return (
			list.children.item(index)?.getAttr("data-checked") == "true" ||
			false
		);
	}

	function changeChecked(index: number, e: Event) {
		const checked = (e.target as HTMLInputElement).checked ? "true" : "false";
		const item = itemAt(index);
		item.setAttr("data-checked", checked);
		// Cross out the same ingredient in the other languages too
		ctx.translations.get(item)?.forEach((t) => t.el.setAttr("data-checked", checked));
		checks.update((n) => n + 1);
	}

	function itemAt(index: number): HTMLElement {
		return (list.children.item(index) as HTMLLIElement)!;
	}

	function othersOf(index: number, language: string) {
		return language == ALL_LANGUAGES
			? []
			: otherTranslations(ctx, itemAt(index), language);
	}
</script>

<div>
	<ul class:bullets class:reveal-selected-only={ctx.revealOnSelectedOnly}>
		{#each list.children as _, i}
			{@const others = othersOf(i, $language)}
			<li class:translatable={others.length > 0}>
				<label>
					<!-- Persist checkbox state on component re-construction by setting
				data-checked on the underlying LI element from the rendered markdown.
				-->
					<input
						type="checkbox"
						checked={isChecked(i, $checks)}
						on:change={(e) => changeChecked(i, e)}
					/>
					<div class="leaf">
						<RecipeLeaf childNodesOf={itemAt(i)} asTag="div" />
					</div>
				</label>
				{#if others.length > 0}
					<Translations
						translations={ctx.translations.get(itemAt(i)) || []}
						{others}
					/>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	ul {
		padding-inline-start: 0;
	}

	input[type="checkbox"] {
		opacity: 0;
		position: absolute;
		margin: 0;
		padding: 0;
	}

	/* A block, so iOS puts the bullet or number on the first line of the item rather than
	   on a line of its own before it */
	label {
		display: block;
		position: relative;
	}

	input[type="checkbox"]:checked ~ .leaf {
		color: var(--text-muted);
		text-decoration: line-through;
	}

	input[type="checkbox"]:focus ~ .leaf {
		color: var(--text-accent-hover);
	}

	ul > li {
		list-style-type: none;
		margin-block: var(--list-spacing);
	}

	ul > li.translatable {
		position: relative;
		padding-inline-end: var(--size-4-6);
	}

	ul.reveal-selected-only
		> li:not(:focus-within):not(:hover)
		> :global(.reveal-translation:not(.is-active)) {
		visibility: hidden;
	}

	ul.bullets > li {
		list-style-type: square;
		margin-inline-start: var(--list-indent);
	}

	:global(.column-side) ul.bullets > li {
		margin-inline-start: 0px;
	}
</style>
