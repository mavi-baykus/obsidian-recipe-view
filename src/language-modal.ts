import { App, SuggestModal } from "obsidian";
import { ALL_LANGUAGES } from "./languages";

interface LanguageOption {
    code: string;
    name: string;
}

/** Asks which language to show a bilingual recipe in */
export class LanguageModal extends SuggestModal<LanguageOption> {
    options: LanguageOption[];
    onChoose: (code: string) => void;

    constructor(app: App, languages: LanguageOption[], onChoose: (code: string) => void) {
        super(app);
        this.options = languages.concat({
            code: ALL_LANGUAGES,
            name: languages.length == 2 ? "Both languages" : "All languages",
        });
        this.onChoose = onChoose;
        this.setPlaceholder("Show recipe in…");
    }

    getSuggestions(query: string): LanguageOption[] {
        const q = query.toLowerCase();
        return this.options.filter((o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q));
    }

    renderSuggestion(option: LanguageOption, el: HTMLElement) {
        el.setText(option.name);
    }

    onChooseSuggestion(option: LanguageOption) {
        this.onChoose(option.code);
    }
}
