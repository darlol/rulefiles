import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { validateConfig } from '../scripts/lib/validate.mjs';
import { loadConfig } from '../scripts/lib/data.mjs';

const root = new URL('..', import.meta.url).pathname;
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

test('site.config.json holds the three role aliases and the host details with their source', () => {
  const c = loadConfig(root);
  assert.equal(c.contactEmail, 'contact@rulefiles.dev');
  assert.equal(c.privacyEmail, 'privacy@rulefiles.dev');
  assert.equal(c.sponsorContact, 'sponsors@rulefiles.dev');
  assert.deepEqual(c.host, {
    name: 'Cloudflare, Inc.',
    address: '101 Townsend St, San Francisco, CA 94107, USA',
    phone: '+1 (650) 319-8930',
    sourceUrl: 'https://www.cloudflare.com/website-terms/',
    readOn: '2026-10-16'
  });
  assert.deepEqual(validateConfig(c), []);
});

test('validateConfig rejects a missing or malformed contact address and incomplete host details', () => {
  const base = loadConfig(root);
  for (const key of ['contactEmail', 'privacyEmail', 'sponsorContact']) {
    for (const bad of [undefined, '', 'not an address', 'a@b', 'x@rulefiles.dev?subject=1']) {
      const c = structuredClone(base);
      if (bad === undefined) delete c[key]; else c[key] = bad;
      assert.match(validateConfig(c).join('\n'), new RegExp(`"${key}" must be an email address`), `${key} ${bad}`);
    }
  }
  const noHost = structuredClone(base);
  delete noHost.host;
  assert.match(validateConfig(noHost).join('\n'), /host object is missing/);
  for (const key of ['name', 'address', 'phone']) {
    const c = structuredClone(base);
    c.host[key] = ' ';
    assert.match(validateConfig(c).join('\n'), new RegExp(`host\\.${key} must be a non-empty string`));
  }
  const c1 = structuredClone(base);
  c1.host.sourceUrl = 'http://example.com';
  assert.match(validateConfig(c1).join('\n'), /host\.sourceUrl must be the https page/);
  const c2 = structuredClone(base);
  c2.host.readOn = 'yesterday';
  assert.match(validateConfig(c2).join('\n'), /host\.readOn must be YYYY-MM-DD/);
});

test('the legal notice, the privacy page, the sponsors page and the About page read the aliases and the host from the configuration', () => {
  process.env.BUILD_DATE = '2026-10-16';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-legal-'));
  try {
    for (const d of ['data', 'content', 'src', 'scripts']) fs.cpSync(path.join(root, d), path.join(dir, d), { recursive: true });
    const c = loadConfig(root);
    c.contactEmail = 'hello@example.org';
    c.privacyEmail = 'data@example.org';
    c.sponsorContact = 'ads@example.org';
    c.host = { ...c.host, name: 'Example Host Ltd', address: '1 Example Road, Nowhere', phone: '+00 000 000' };
    fs.writeFileSync(path.join(dir, 'site.config.json'), JSON.stringify(c, null, 2));
    const outDir = path.join(dir, 'dist');
    build({ root: dir, outDir, quiet: true });
    const page = (p) => textOf(fs.readFileSync(path.join(outDir, p, 'index.html'), 'utf8'));
    assert.match(page('legal'), /Name: Example Host Ltd Address: 1 Example Road, Nowhere Phone: \+00 000 000/);
    assert.match(page('legal'), /hello@example\.org/);
    assert.match(page('privacy'), /The host is Example Host Ltd, 1 Example Road, Nowhere\./);
    assert.match(page('privacy'), /data@example\.org/);
    assert.match(page('sponsors'), /ads@example\.org/);
    assert.match(page('about'), /hello@example\.org/);
    for (const p of ['legal', 'privacy', 'sponsors', 'about']) assert.doesNotMatch(page(p), /@rulefiles\.dev|Cloudflare/, p);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the content pages hold no publisher identity: no name, address, phone or registration field', () => {
  for (const f of ['legal.md', 'privacy.md', 'about.md', 'sponsors.md']) {
    const md = fs.readFileSync(path.join(root, 'content', f), 'utf8');
    assert.doesNotMatch(md, /\[\[TODO-OWNER: (publisher|director|contact email|privacy contact|correction|host)/i, f);
    assert.doesNotMatch(md, /[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.[a-z]{2,}/, `${f} holds a literal email address, use the configuration`);
  }
  const md = fs.readFileSync(path.join(root, 'content', 'legal.md'), 'utf8');
  assert.doesNotMatch(md, /^- (Name|Address|Phone|Registration): (?!\{\{host)/m);
});
