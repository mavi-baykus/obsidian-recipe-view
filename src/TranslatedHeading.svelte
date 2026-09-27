<script lang="ts">
	// A heading shared by all languages, shown in the selected language
	import { getContext } from "svelte";
	import RecipeLeaf from "./RecipeLeaf.svelte";
	import { LANGUAGE_CONTEXT, LanguageContext } from "./recipe-context";
	import { HeadingTranslation, showHeading } from "./headings";

	export let childNodesOf: HTMLElement;
	export let asTag: string;
	export let heading: HeadingTranslation;

	const { language } = getContext<LanguageContext>(LANGUAGE_CONTEXT);

	// "Both" isn't a language code, so it shows the heading as written
	$: showHeading(heading, $language);
</script>

<RecipeLeaf {childNodesOf} {asTag} />
