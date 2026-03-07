/**
 * Parses a YAML string and returns a JavaScript value.
 * @param {string} yamlStr
 * @returns {*}
 * @throws {Error} On parse errors
 */
export function parse(yamlStr: string): any;
/**
 * Parses all YAML documents from a string separated by ---.
 * @param {string} yamlStr
 * @returns {Array<*>}
 */
export function parseAll(yamlStr: string): Array<any>;
/**
 * Converts a JavaScript value to a YAML string.
 * @param {*} value
 * @param {Object} [options={}]
 * @param {number} [options.indent=2] - Spaces per indentation level
 * @param {boolean} [options.noRefs=true] - Ignore circular ref checks
 * @returns {string}
 */
export function stringify(value: any, options?: {
    indent?: number | undefined;
    noRefs?: boolean | undefined;
}): string;
export { parse as load, stringify as dump };
//# sourceMappingURL=heady-yaml.d.ts.map