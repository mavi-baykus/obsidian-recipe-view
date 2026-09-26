<script lang="ts">
	export let message: string;
</script>

<div class="language-warning">{message}</div>

<style>
	.language-warning {
		font-size: var(--font-smaller);
		color: var(--text-warning);
		margin-block: var(--size-4-2);
	}
</style>
