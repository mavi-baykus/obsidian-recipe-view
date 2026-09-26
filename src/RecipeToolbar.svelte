<script lang="ts">
	import Fraction from "fraction.js";
	import { Writable } from "svelte/store";
	import ScaleSelector from "./ScaleSelector.svelte";
	import { ALL_LANGUAGES } from "./languages";

	export let scale: Fraction;
	export let scaleNum: number | null;
	export let languages: Array<{ code: string; name: string }>;
	export let language: Writable<string>;
	export let revealAll: Writable<boolean>;
</script>

<ScaleSelector bind:scale bind:scaleNum />
{#if languages.length > 1}
	<div class="language-switcher" role="group" aria-label="Recipe language">
		{#each languages as l (l.code)}
			<button
				class:is-active={$language == l.code}
				aria-pressed={$language == l.code}
				lang={l.code}
				on:click={() => language.set(l.code)}>{l.name}</button
			>
		{/each}
		<button
			class:is-active={$language == ALL_LANGUAGES}
			aria-pressed={$language == ALL_LANGUAGES}
			on:click={() => language.set(ALL_LANGUAGES)}
			>{languages.length == 2 ? "Both" : "All"}</button
		>
	</div>
	{#if $language != ALL_LANGUAGES}
		<label class="reveal-all">
			<input type="checkbox" bind:checked={$revealAll} />
			Show all translations
		</label>
	{/if}
{/if}

<style>
	.language-switcher {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--size-4-1);
		margin-block-end: var(--size-4-2);
	}

	.language-switcher button {
		font-size: var(--font-smaller);
		height: auto;
		padding: var(--size-4-1) var(--size-4-3);
	}

	.language-switcher button.is-active {
		background-color: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.reveal-all {
		display: block;
		text-align: center;
		font-size: var(--font-smaller);
		color: var(--text-muted);
		margin-block-end: var(--size-4-4);
	}
</style>
