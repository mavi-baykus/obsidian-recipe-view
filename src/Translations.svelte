<script lang="ts">
	// The translate button for an ingredient or step, and its translations when revealed
	import { getContext } from "svelte";
	import { setIcon } from "obsidian";
	import RecipeLeaf from "./RecipeLeaf.svelte";
	import { Translation } from "./model";
	import { LANGUAGE_CONTEXT, LanguageContext } from "./recipe-context";

	export let translations: Translation[];
	export let others: Translation[];

	const ctx = getContext<LanguageContext>(LANGUAGE_CONTEXT);
	const { revealed, revealAll } = ctx;

	// "Show all translations" flips what each item's own button does
	$: shown = $revealAll != $revealed.has(translations);

	function toggle() {
		revealed.update((set) => {
			const next = new Set(set);
			if (next.has(translations)) next.delete(translations);
			else next.add(translations);
			return next;
		});
	}

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
	}
</script>

<button
	class="clickable-icon reveal-translation"
	class:is-active={shown}
	aria-label={shown ? "Hide translation" : "Show translation"}
	aria-pressed={shown}
	use:icon={"languages"}
	on:click|preventDefault|stopPropagation={toggle}
></button>
{#if shown}
	<div class="translations">
		{#each others as t (t.el)}
			<div class="translation" lang={t.lang}>
				<span class="translation-language">{ctx.names[t.lang] || t.lang}</span>
				<RecipeLeaf childNodesOf={t.el} asTag="div" />
			</div>
		{/each}
	</div>
{/if}

<style>
	.reveal-translation {
		position: absolute;
		top: 0;
		inset-inline-end: 0;
		padding: var(--size-2-1);
		--icon-size: var(--icon-xs);
		color: var(--text-faint);
	}

	.reveal-translation.is-active {
		color: var(--text-accent);
	}

	.translations {
		color: var(--text-muted);
		font-style: italic;
		margin-block-start: var(--size-2-2);
	}

	.translation {
		display: flex;
		gap: var(--size-4-2);
		align-items: baseline;
	}

	.translation-language {
		font-style: normal;
		font-size: var(--font-smallest);
		color: var(--text-faint);
		flex: 0 0 auto;
	}
</style>
