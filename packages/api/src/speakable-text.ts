/**
 * Rewrites symbols that text-to-speech engines would otherwise spell out
 * ("slash", "greater than") or mangle into spoken-friendly words and pauses.
 *
 * Operates on plain, unescaped text. For the SSML path it must run *before*
 * XML-escaping, so an arrow's `>` is rewritten before it becomes `&gt;`.
 */
export function verbalizeSymbols(text: string): string {
  return (
    text
      // Arrows — ASCII (`->`, `-->`) and common Unicode forms — read as "to".
      .replace(/-+>|[→⇒⟶➔➙➜]/g, ' to ')
      // Reverse arrows read as "from". Requiring a dash leaves the comparison
      // operators `<=` / `>=` untouched.
      .replace(/<-+|[←⇐⟵]/g, ' from ')
      // A slash usually pairs two terms ("TCP/IP", "and/or"); a comma gives the
      // brief pause a spoken "slash" never would.
      .replace(/\s*\/\s*/g, ', ')
      // Collapse whitespace the substitutions introduced.
      .replace(/\s+/g, ' ')
  );
}
