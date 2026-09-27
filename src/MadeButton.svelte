<script lang="ts">
	// "Mark as made", at the end of the directions
	import { setIcon } from "obsidian";
	import { MadeProperties, isMadeOn, localDate } from "./made";

	export let frontmatter: Record<string, unknown>;
	export let names: MadeProperties;
	export let onMark: () => void;

	$: madeToday = isMadeOn(frontmatter, names, localDate());

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return { update: (name: string) => setIcon(node, name) };
	}
</script>

<div class="made">
	<button
		class:mod-cta={!madeToday}
		class:made-today={madeToday}
		aria-pressed={madeToday}
		on:click={onMark}
	>
		<span class="made-icon" use:icon={madeToday ? "check-check" : "check"}></span>
		{madeToday ? "Made today" : "Mark as made"}
	</button>
</div>

<style>
	.made {
		display: flex;
		justify-content: center;
		margin-block: var(--size-4-6) var(--size-4-4);
	}

	button {
		display: inline-flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.made-icon {
		display: flex;
		--icon-size: var(--icon-s);
	}

	button.made-today {
		color: var(--text-muted);
	}
</style>
