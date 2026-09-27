// Marking a recipe as made: the properties the "Mark as made" button sets. Pure helpers
// with no runtime dependency on Obsidian, working on the frontmatter object that
// FileManager.processFrontMatter passes in.

export type Frontmatter = Record<string, unknown>;

/** Names of the properties that record when a recipe was made */
export interface MadeProperties {
    /** A checkbox, set to true */
    made: string;
    /** A date, set to today */
    lastMade: string;
    /** A list of dates, today added to the end */
    previouslyMade: string;
}

/** A property as it was before marking the recipe as made */
interface SavedProperty {
    key: string;
    existed: boolean;
    value: unknown;
}

/** What marking a recipe as made changed, to undo it */
export interface MadeChange {
    changed: boolean;
    saved: SavedProperty[];
}

/** A date as YYYY-MM-DD in the local time zone, the format of Obsidian's date properties */
export function localDate(date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The key a property has in the frontmatter. Obsidian treats property names without
 * regard to case, so "Made" is the "made" property.
 */
function propertyKey(frontmatter: Frontmatter, name: string): string {
    const lower = name.toLowerCase();
    return Object.keys(frontmatter).find((k) => k.toLowerCase() == lower) || name;
}

function asDate(value: unknown): string | null {
    // A YAML date is read as midnight UTC
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
    if (typeof value == "string" || typeof value == "number") {
        const text = String(value).trim();
        return text.length > 0 ? text : null;
    }
    return null;
}

/** A list property's dates, whether it holds a list, a single date or nothing */
function asDates(value: unknown): string[] {
    const values = Array.isArray(value) ? value : [value];
    return values.map(asDate).filter((d): d is string => d !== null);
}

/** Whether the recipe's last made date is the given date */
export function isMadeOn(frontmatter: Frontmatter | undefined, names: MadeProperties, date: string): boolean {
    if (!frontmatter) return false;
    return asDate(frontmatter[propertyKey(frontmatter, names.lastMade)]) == date;
}

/**
 * Mark a recipe as made on a date: check "made", set "last made" to the date, and add
 * the date to "previously made" unless it's already there. Missing properties are
 * created, and a "previously made" that holds a single date becomes a list. Changes the
 * frontmatter in place and returns what it was, for undoing.
 */
export function markMade(frontmatter: Frontmatter, names: MadeProperties, date: string): MadeChange {
    const made = propertyKey(frontmatter, names.made);
    const lastMade = propertyKey(frontmatter, names.lastMade);
    const previouslyMade = propertyKey(frontmatter, names.previouslyMade);
    const saved = [made, lastMade, previouslyMade].map((key) => ({
        key,
        existed: key in frontmatter,
        value: copyValue(frontmatter[key]),
    }));

    const dates = asDates(frontmatter[previouslyMade]);
    if (!dates.includes(date)) dates.push(date);
    const wanted: Frontmatter = { [made]: true, [lastMade]: date, [previouslyMade]: dates };

    let changed = false;
    for (const [key, value] of Object.entries(wanted)) {
        if (!(key in frontmatter) || JSON.stringify(frontmatter[key]) != JSON.stringify(value)) {
            frontmatter[key] = value;
            changed = true;
        }
    }
    return { changed, saved };
}

/** Put back the properties as they were before marking the recipe as made */
export function undoMarkMade(frontmatter: Frontmatter, change: MadeChange) {
    for (const { key, existed, value } of change.saved) {
        if (existed) frontmatter[key] = value;
        else delete frontmatter[key];
    }
}

function copyValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(copyValue);
    if (value instanceof Date) return new Date(value.getTime());
    if (value && typeof value == "object") {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copyValue(v)]));
    }
    return value;
}
