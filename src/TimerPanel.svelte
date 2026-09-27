<script lang="ts">
	// The recipe's timers, kept at the top of their column as it scrolls
	import { TimerManager } from "./timer-manager";
	import TimerRow from "./TimerRow.svelte";

	export let manager: TimerManager;
	/** The recipe shown */
	export let path: string;
	export let size: "small" | "medium" | "large" = "medium";
	export let onAdd: () => void;

	const { timers } = manager;
</script>

{#if $timers.length > 0}
	<div class="recipe-timers size-{size}" role="region" aria-label="Timers">
		{#each $timers as timer (timer.id)}
			<TimerRow
				{manager}
				{timer}
				recipe={timer.path && timer.path != path ? manager.recipeName(timer.path) : ""}
			/>
		{/each}
		<button class="add-timer" on:click={onAdd}>+ Timer</button>
	</div>
{/if}

<style>
	.recipe-timers {
		position: sticky;
		top: 0;
		z-index: 3;
		background-color: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		box-shadow: var(--shadow-s);
		padding: var(--size-2-2) var(--size-4-3);
		margin-block-end: var(--size-4-4);
		--timer-font-size: 1.9em;
		--timer-button-font-size: var(--font-smaller);
		--timer-icon-size: var(--icon-m);
	}

	.size-small {
		--timer-font-size: 1.3em;
		--timer-button-font-size: var(--font-smallest);
		--timer-icon-size: var(--icon-s);
	}

	.size-large {
		--timer-font-size: 2.8em;
		--timer-button-font-size: var(--font-ui-medium);
		--timer-icon-size: var(--icon-l);
	}

	.add-timer {
		font-size: var(--font-smallest);
		height: auto;
		padding: var(--size-2-1) var(--size-4-2);
		margin-block: var(--size-2-2);
		background: none;
		box-shadow: none;
		color: var(--text-muted);
	}

	/* One column: centred at the top of the card, like the columns */
	:global(.recipe-card.one-column) .recipe-timers,
	:global(.recipe-card.split-steps) .recipe-timers {
		width: calc(100% - 2 * var(--file-margins));
		max-width: var(--file-line-width);
		margin-inline: auto;
	}
</style>
