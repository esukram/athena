import { verbalizeSymbols } from '@athena/api/speakable-text';
import { fromMarkdown } from 'mdast-util-from-markdown';

/**
 * Converts a Markdown answer into an SSML *body* fragment suitable for Azure
 * speech synthesis. The result intentionally contains no `<speak>`/`<voice>`
 * envelope — the server wraps it (see `wrapSsml` in the server's speech
 * service) so the voice and language stay authoritative.
 *
 * Markdown structure is mapped to prosody: headings/bold become strong
 * emphasis, italics moderate emphasis, paragraphs and list items get pauses,
 * code is spoken slowly, and links keep only their text (URLs dropped).
 */

/** Minimal structural shape of an mdast node — avoids an extra type dep. */
interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
}

const BARE_URL = /https?:\/\/\S+/g;

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Renders a text leaf: drop bare URLs, verbalize symbols the synthesizer
 * would otherwise spell out (done before escaping, so an arrow's `>` is
 * rewritten before it turns into `&gt;`), then XML-escape what remains.
 */
const renderText = (value: string): string =>
  escapeXml(verbalizeSymbols(value.replace(BARE_URL, '')));

/** Wraps inner content in an emphasis tag, omitting it when empty. */
const emphasize = (inner: string, level: 'strong' | 'moderate'): string => {
  if (!inner.trim()) return '';
  return `<emphasis level="${level}">${inner}</emphasis>`;
};

const renderChildren = (node: MdNode): string =>
  (node.children ?? []).map(renderNode).join('');

/**
 * Walks the mdast tree to decide whether it contains any leaf that produces
 * spoken words. Working off the tree (rather than stripping tags from the
 * rendered SSML) keeps the emptiness check exact and avoids regex-based
 * markup parsing.
 */
function hasSpokenText(node: MdNode): boolean {
  switch (node.type) {
    case 'text':
      return /\S/.test((node.value ?? '').replace(BARE_URL, ''));

    case 'inlineCode':
    case 'code':
      return /\S/.test(node.value ?? '');

    case 'image':
    case 'html':
      // Never spoken — see `renderNode`.
      return false;

    default:
      return (node.children ?? []).some(hasSpokenText);
  }
}

function renderNode(node: MdNode): string {
  switch (node.type) {
    case 'root':
      return renderChildren(node);

    case 'heading':
      return `${emphasize(renderChildren(node), 'strong')}<break time="600ms"/>`;

    case 'paragraph':
      return `${renderChildren(node)}<break time="600ms"/>`;

    case 'strong':
      return emphasize(renderChildren(node), 'strong');

    case 'emphasis':
      return emphasize(renderChildren(node), 'moderate');

    case 'text':
      return renderText(node.value ?? '');

    case 'inlineCode':
      return `<prosody rate="-20%">${escapeXml(node.value ?? '')}</prosody>`;

    case 'code':
      return `<prosody rate="-20%">${escapeXml(node.value ?? '')}</prosody><break time="400ms"/>`;

    case 'link':
      // Speak the link text only; the URL is dropped.
      return renderChildren(node);

    case 'image':
      return '';

    case 'list':
      return renderChildren(node);

    case 'listItem':
      // A list item's paragraph child already emits a trailing break.
      return renderChildren(node);

    case 'blockquote':
      return renderChildren(node);

    case 'thematicBreak':
      return '<break time="800ms"/>';

    case 'break':
      return ' ';

    case 'html':
      return '';

    default:
      return node.children ? renderChildren(node) : '';
  }
}

export function markdownToSsml(markdown: string): string {
  if (!markdown || !markdown.trim()) return '';

  const tree = fromMarkdown(markdown) as unknown as MdNode;

  // A body with only break/markup and no spoken text is not worth synthesizing.
  if (!hasSpokenText(tree)) return '';

  const body = renderNode(tree)
    // Collapse any run of adjacent break tags into the first one.
    .replace(/(<break time="[^"]*"\/>)(?:<break time="[^"]*"\/>)+/g, '$1')
    .trim();

  return body;
}
