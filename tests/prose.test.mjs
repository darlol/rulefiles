import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderMarkdown, parseFrontmatter } from '../scripts/lib/markdown.mjs';

const root = new URL('..', import.meta.url).pathname;
const listMd = (dir) => (fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.md')).map((f) => `${dir}/${f}`) : []);
const prose = ['README.md', 'LICENSE-DATA.md', ...listMd('docs'), ...listMd('content')];

function stripCode(s) {
  return s.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '').replace(/https?:\/\/\S+/g, '');
}

test('authored prose has no em dashes, en dashes or curly quotes', () => {
  for (const f of prose) {
    const text = stripCode(fs.readFileSync(path.join(root, f), 'utf8'));
    assert.doesNotMatch(text, /[\u2014\u2013\u201c\u201d]/, `${f} contains a dash or curly quote`);
  }
});

test('authored prose avoids stock AI phrases', () => {
  const banned = /\b(delve|tapestry|testament to|game-changer|seamless(ly)?|cutting-edge|in today's fast-paced|it's not just|not only .{1,40} but also|let's dive|unlock the power|robust solution|stands as a)\b/i;
  for (const f of prose) {
    const text = stripCode(fs.readFileSync(path.join(root, f), 'utf8'));
    assert.doesNotMatch(text, banned, f);
  }
});

test('markdown renderer escapes HTML and renders links, lists and code', () => {
  const html = renderMarkdown('# T\n\nHello <b>x</b> `a<b`\n\n- one\n- [two](/p/)\n\n1. a\n2. b\n');
  assert.match(html, /<h1>T<\/h1>/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /<code>a&lt;b<\/code>/);
  assert.match(html, /<ul><li>one<\/li><li><a href="\/p\/">two<\/a><\/li><\/ul>/);
  assert.match(html, /<ol><li>a<\/li><li>b<\/li><\/ol>/);
});

test('frontmatter parsing and template variables', () => {
  const { meta, body } = parseFrontmatter('---\ntitle: X\ndescription: Y z\n---\nBody {{n}} {{missing}}');
  assert.deepEqual(meta, { title: 'X', description: 'Y z' });
  assert.equal(renderMarkdown(body, { n: 3 }), '<p>Body 3 {{missing}}</p>');
});

test('every content page has a title and a description', () => {
  for (const f of fs.readdirSync(path.join(root, 'content'))) {
    const { meta } = parseFrontmatter(fs.readFileSync(path.join(root, 'content', f), 'utf8'));
    assert.ok(meta.title && meta.description && meta.description.length <= 200, f);
  }
});
