import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { validateConfig } from '../scripts/lib/validate.mjs';
import { loadConfig } from '../scripts/lib/data.mjs';
import { TEST_DATE } from './helpers/test-date.mjs';

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
  process.env.BUILD_DATE = TEST_DATE;
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
    assert.match(page('legal').replace(/\s+([).,])/g, '$1'), /send the request to the publisher at hello@example\.org or data@example\.org, with a copy to the host/);
    assert.match(page('privacy'), /The host is Example Host Ltd, 1 Example Road, Nowhere\. Its data processing addendum covers transfers from the European Economic Area to the United States/);
    assert.match(page('privacy'), /data@example\.org/);
    assert.match(page('sponsors'), /ads@example\.org/);
    assert.match(page('about'), /hello@example\.org/);
    assert.ok(page('privacy').includes(`If you write to hello@example.org, data@example.org or ads@example.org, your message reaches ${['Tho', 'mas', ' ', 'Ram', 'baut'].join('')} through Cloudflare Email Routing and a private mailbox. We use it only to answer you, on the basis of our legitimate interest in answering (GDPR, article 6(1)(f))`));
    for (const p of ['legal', 'privacy', 'sponsors', 'about']) assert.doesNotMatch(page(p), /@rulefiles\.dev|Cloudflare, Inc\./, p);
    // The host comes from the configuration. Cloudflare is named only for its mail routing and for Web Analytics, which are not the host.
    // The footer of every page names Cloudflare Web Analytics.
    for (const p of ['legal', 'sponsors', 'about']) assert.doesNotMatch(page(p).replace(/Cloudflare Web Analytics/g, ''), /Cloudflare/, p);
    const analytics = /To count visits, Cloudflare adds its Web Analytics script.*?You can object by writing to data@example\.org \./;
    assert.match(page('privacy'), analytics);
    assert.doesNotMatch(page('privacy').replace(analytics, '').replace(/Cloudflare (Email Routing|Web Analytics)/g, ''), /Cloudflare/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the content pages hold no publisher address, phone or registration field, and only the privacy page and the legal notice carry a name', () => {
  for (const f of ['legal.md', 'privacy.md', 'about.md', 'sponsors.md']) {
    const md = fs.readFileSync(path.join(root, 'content', f), 'utf8');
    assert.doesNotMatch(md, /\[\[TODO-OWNER: (publisher|director|contact email|privacy contact|correction|host)/i, f);
    assert.doesNotMatch(md, /[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.[a-z]{2,}/, `${f} holds a literal email address, use the configuration`);
  }
  const md = fs.readFileSync(path.join(root, 'content', 'legal.md'), 'utf8');
  assert.doesNotMatch(md, /^- (Name|Address|Phone|Registration): (?!\{\{host)/m);
  const owner = ['Tho', 'mas', ' ', 'Ram', 'baut'].join('');
  for (const f of ['about.md', 'sponsors.md']) assert.equal(fs.readFileSync(path.join(root, 'content', f), 'utf8').includes(owner), false, `${f} holds no name`);
  for (const f of ['legal.md', 'privacy.md']) assert.ok(fs.readFileSync(path.join(root, 'content', f), 'utf8').includes(owner), `${f} names the publisher of the site and of the newsletter`);
});

// What would be a publisher's postal address or phone number written into the prose: a postal code, a street word, a
// phone number in a French or an international format, or the words "phone", "téléphone" and "postal address".
const ADDRESS_WORDS = /\b\d{5}(?:-\d{4})?\b|\b(?:rue|avenue|boulevard|bd|street|road|lane|chemin|all[ée]e|impasse|place)\b|\bt[ée]l(?:[ée]phone)?\b|\bphone\b|\bfax\b|\+\d[\d .()-]{7,}|\b0[1-9](?:[ .-]?\d{2}){4}\b|\bpostal\b|\bcode postal\b/i;
// The notice may say that no address and no phone number are published, and shows the host's phone line from the configuration.
const HOST_LINES = ['- Name: {{hostName}}', '- Address: {{hostAddress}}', '- Phone: {{hostPhone}}'];
// Only these three lines are exempt, and only when the whole line is exactly that: an address written after the variable still counts.
const proseOf = (md) => md.split('\n').filter((l) => !HOST_LINES.includes(l.trimEnd())).join('\n')
  .replace(/(?:[Nn]o|[Aa]s no) postal address(?: and no phone number)?(?: (?:is|are) published)?/g, '');

test('the content prose holds no postal code, street, phone number or registration number, and the checker catches them', () => {
  for (const f of ['legal.md', 'privacy.md', 'about.md', 'sponsors.md']) {
    const prose = proseOf(fs.readFileSync(path.join(root, 'content', f), 'utf8'));
    assert.doesNotMatch(prose, ADDRESS_WORDS, `${f} holds an address or a phone number`);
    assert.doesNotMatch(prose, /\b(?:SIRET|SIREN|RCS|TVA)\b/, `${f} holds a registration number`);
  }
  for (const bad of ['Write to 12 rue de la Paix, 75002 Paris.', '10 Downing Street', '1 Example Road', 'Call +33 1 23 45 67 89', 'Appelez le 01 23 45 67 89', 'Phone: 0123456789', 'Our postal address is below', 'Téléphone : 01 02 03 04 05', 'ZIP 94107']) {
    assert.match(proseOf(bad), ADDRESS_WORDS, bad);
  }
  assert.doesNotMatch(proseOf('No postal address is published.'), ADDRESS_WORDS);
  assert.doesNotMatch(proseOf('The publisher uses that option for the site: no postal address and no phone number are published.'), ADDRESS_WORDS);
  assert.doesNotMatch(proseOf('- Phone: {{hostPhone}}'), ADDRESS_WORDS);
  assert.doesNotMatch(proseOf(HOST_LINES.join('\n')), ADDRESS_WORDS, 'the three host lines pass');
  // Mutations: an address or a phone number written on one of the host lines is not exempt.
  for (const bad of ['- Address: {{hostAddress}} 12 rue de la Paix', '- Address: 12 rue de la Paix, 75002 Paris', '- Address: 1 Example Road', '- Phone: {{hostPhone}} or +33 1 23 45 67 89', '- Phone: 01 23 45 67 89', '- Name: {{hostName}}, 12 rue de la Paix', '- Address: {{hostAddress}}, 94107']) {
    assert.match(proseOf(bad), ADDRESS_WORDS, bad);
  }
});

test('the legal notice, privacy and sponsors pages show the "updated" date of their own front matter, the about page shows none', () => {
  process.env.BUILD_DATE = TEST_DATE;
  delete process.env.SITE_URL;
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-updated-'));
  try {
    build({ root, outDir, quiet: true });
    for (const page of ['legal', 'privacy', 'sponsors']) {
      const md = fs.readFileSync(path.join(root, 'content', `${page}.md`), 'utf8');
      const updated = md.match(/^updated: (\d{4}-\d{2}-\d{2})$/m)?.[1];
      assert.ok(updated, `${page}.md has an "updated: YYYY-MM-DD" line`);
      const html = fs.readFileSync(path.join(outDir, page, 'index.html'), 'utf8');
      assert.ok(html.includes(`<p class="muted page-updated">Last updated: <time datetime="${updated}">${updated}</time></p>`), page);
      assert.equal(textOf(html).match(new RegExp(`Last updated: ${updated}`, 'g'))?.length, 1, page);
      assert.ok(html.includes(`"dateModified":"${updated}"`), page);
    }
    const about = fs.readFileSync(path.join(outDir, 'about', 'index.html'), 'utf8');
    assert.doesNotMatch(about, /Last updated:/);
    assert.doesNotMatch(about, /dateModified/);
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'content', 'about.md'), 'utf8'), /^updated:/m);
  } finally { fs.rmSync(outDir, { recursive: true, force: true }); }
});

test('a page with an updated date that is not YYYY-MM-DD stops the build with a clear message', () => {
  process.env.BUILD_DATE = TEST_DATE;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-updated-bad-'));
  try {
    for (const d of ['data', 'content', 'src', 'scripts']) fs.cpSync(path.join(root, d), path.join(dir, d), { recursive: true });
    fs.copyFileSync(path.join(root, 'site.config.json'), path.join(dir, 'site.config.json'));
    const file = path.join(dir, 'content', 'legal.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('updated: 2026-10-16', 'updated: 16 October 2026'));
    assert.throws(() => build({ root: dir, outDir: path.join(dir, 'dist'), quiet: true }), /legal\.md: "updated" must be a date written YYYY-MM-DD, got "16 October 2026"/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the Cloudflare links on the privacy page stay tied to the host in site.config.json', () => {
  const md = fs.readFileSync(path.join(root, 'content', 'privacy.md'), 'utf8');
  const c = loadConfig(root);
  const linksCloudflare = md.includes('https://www.cloudflare.com/cloudflare-customer-dpa/') || md.includes('https://www.cloudflare.com/privacypolicy/');
  // The two links are written by hand. If the host changes, change the links and the sentence with it.
  assert.equal(linksCloudflare, /^Cloudflare\b/.test(c.host.name), 'host and privacy page links disagree');
  assert.equal(c.host.sourceUrl.startsWith('https://www.cloudflare.com/'), linksCloudflare);
});
