<script lang="ts">
	// One timer: its label, the time left (tap to type a new time), and its buttons
	import { tick } from "svelte";
	import { setIcon } from "obsidian";
	import { TimerManager } from "./timer-manager";
	import { Timer, secondsLeft } from "./timer-state";
	import { formatDuration, parseDuration } from "./durations";

	export let manager: TimerManager;
	export let timer: Timer;
	/** The recipe the timer is from, if it isn't the one shown */
	export let recipe = "";

	const { now } = manager;

	$: left = secondsLeft(timer, $now);
	$: running = timer.state == "running";
	$: ringing = timer.state == "ringing";

	let editing = false;
	let text = "";
	let invalid = false;
	let input: HTMLInputElement;

	async function edit() {
		if (ringing) return;
		text = formatDuration(left);
		invalid = false;
		editing = true;
		await tick();
		input?.focus();
		input?.select();
	}

	// Typed like the time shown, so "12:00" is 12 minutes
	function apply() {
		if (!editing) return;
		const seconds = parseDuration(text, "m:ss");
		if (seconds === null) {
			invalid = true;
			return;
		}
		manager.setTime(timer.id, seconds);
		editing = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key == "Enter") apply();
		else if (e.key == "Escape") editing = false;
	}

	function onBlur() {
		apply();
		// Give up on a time that can't be read, rather than trapping the focus
		editing = false;
	}

	function toggle() {
		if (running) manager.pause(timer.id);
		else manager.start(timer.id);
	}

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return { update: (name: string) => setIcon(node, name) };
	}
</script>

<div class="timer" class:running class:ringing class:paused={timer.state == "paused"}>
	<div class="timer-label">
		{#if recipe}<span class="timer-recipe">{recipe} · </span>{/if}{timer.label}
	</div>
	<div class="timer-row">
		{#if editing}
			<!-- Keys typed here aren't recipe shortcuts -->
			<input
				class="timer-input"
				class:invalid
				type="text"
				inputmode="text"
				aria-label="Time, e.g. 12:00, 1h 30m or 90"
				placeholder="12:00, 1h 30m, 90"
				bind:this={input}
				bind:value={text}
				on:keydown|stopPropagation={onKeydown}
				on:keypress|stopPropagation
				on:blur={onBlur}
			/>
		{:else}
			<button class="timer-time" aria-label="Set the time" disabled={ringing} on:click={edit}
				>{formatDuration(left)}</button
			>
		{/if}
		<div class="timer-buttons">
			{#if ringing}
				<button class="mod-cta" on:click={() => manager.dismiss(timer.id)}>Dismiss</button>
				<button on:click={() => manager.adjust(timer.id, 60)}>+1 min</button>
			{:else}
				<button
					class="clickable-icon timer-toggle"
					aria-label={running ? "Pause" : "Start"}
					disabled={!running && left == 0}
					use:icon={running ? "pause" : "play"}
					on:click={toggle}
				></button>
				<button aria-label="1 minute less" on:click={() => manager.adjust(timer.id, -60)}>−1</button>
				<button aria-label="1 minute more" on:click={() => manager.adjust(timer.id, 60)}>+1</button>
				<button aria-label="5 minutes more" on:click={() => manager.adjust(timer.id, 300)}>+5</button>
			{/if}
			<button
				class="clickable-icon timer-remove"
				aria-label="Remove timer"
				use:icon={"x"}
				on:click={() => manager.remove(timer.id)}
			></button>
		</div>
	</div>
</div>

<style>
	.timer {
		padding-block: var(--size-2-2);
	}

	.timer + :global(.timer) {
		border-top: 1px solid var(--background-modifier-border);
	}

	.timer-label {
		font-size: var(--font-smallest);
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.timer-recipe {
		color: var(--text-faint);
	}

	.timer-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--size-2-2) var(--size-4-2);
	}

	.timer-time,
	.timer-input {
		font-size: var(--timer-font-size);
		font-variant-numeric: tabular-nums;
		font-weight: var(--font-semibold);
		height: auto;
		padding: 0 var(--size-2-2);
		line-height: 1.2;
		min-width: 3.2em;
	}

	.timer-time {
		background: none;
		box-shadow: none;
		color: var(--text-normal);
	}

	.timer-time:disabled {
		opacity: 1;
		cursor: default;
	}

	.timer-input {
		width: 6em;
	}

	.timer-input.invalid {
		border-color: var(--text-error);
	}

	.paused .timer-time {
		color: var(--text-muted);
	}

	.timer-buttons {
		display: flex;
		align-items: center;
		gap: var(--size-2-2);
		margin-inline-start: auto;
	}

	.timer-buttons button {
		font-size: var(--timer-button-font-size);
		height: auto;
		padding: var(--size-2-2) var(--size-4-2);
	}

	.timer-buttons .clickable-icon {
		--icon-size: var(--timer-icon-size);
		padding: var(--size-2-2);
	}

	.timer-toggle {
		color: var(--text-accent);
	}

	.ringing {
		animation: timer-flash 1s steps(1) infinite;
		border-radius: var(--radius-s);
		padding-inline: var(--size-2-2);
	}

	/* Follow the flashing colours */
	.ringing .timer-label,
	.ringing .timer-time {
		color: inherit;
	}

	@keyframes timer-flash {
		0% {
			background-color: var(--interactive-accent);
			color: var(--text-on-accent);
		}
		50% {
			background-color: transparent;
			color: var(--text-normal);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ringing {
			animation: none;
			background-color: var(--interactive-accent);
		}
	}
</style>
