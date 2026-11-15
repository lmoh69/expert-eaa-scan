// Expert EAA - scan d'une boutique en ligne
//
// Pour un marchand, un defaut d'accessibilite ne coute pas une amende : il coute
// une commande. Ce script analyse donc deux pages, la page d'accueil et une page
// de vente (fiche produit, categorie ou panier), et renvoie les deux resultats
// separement, pour que le message parle de ventes perdues et pas de reglement.
//
// Variables d'environnement : URLS, WEBHOOK, REF_LOT (voir scan.mjs).

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { traduire } from './rgaa.mjs';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const URLS = (process.env.URLS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .slice(0, 15);
const WEBHOOK = process.env.WEBHOOK || '';
const REF_LOT = process.env.REF_LOT || '';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Les pages ou se joue la vente se reconnaissent a leur adresse.
const CHEMINS =
  /\/(produit|produits|product|products|boutique|shop|panier|cart|collections|categorie|category|catalogue)(\/|\?|$|-)/i;

const IGNORER =
  /(sentry|wixpress|wordpress|yoast|godaddy|@2x|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|example|exemple|@mail\.com|@domaine|@votresite|@monsite|@site\.|^(votre|vous|nom|prenom|email|mail|adresse|test|essai|no-?reply|ne-?pas-?repondre|utilisateur|user|john|jane)@)/i;

if (URLS.length === 0) {
  console.error('Aucune URL fournie dans URLS.');
  process.exit(1);
}

function hote(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function adresses(html, h) {
  const trouves = new Set();
  for (const brut of html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []) {
    const e = brut.toLowerCase();
    if (!IGNORER.test(e) && e.length <= 64) trouves.add(e);
  }
  const liste = [...trouves];
  const propres = liste.filter((e) => h && e.endsWith('@' + h));
  const generiques = liste.filter((e) =>
    /^(contact|bonjour|hello|info|service|serviceclient|commercial|direction)@/.test(e)
  );
  return [...new Set([...propres, ...generiques, ...liste])].slice(0, 5);
}

function plateforme(html) {
  const signatures = [
    [/cdn\.shopify\.com|Shopify\.theme/i, 'Shopify'],
    [/prestashop/i, 'PrestaShop'],
    [/woocommerce/i, 'WooCommerce'],
    [/magento|mage\/cookies/i, 'Magento'],
    [/wp-content|wp-json/i, 'WordPress'],
    [/wixstatic|parastorage/i, 'Wix'],
    [/squarespace/i, 'Squarespace'],
    [/\/_next\/static/i, 'Next.js']
  ];
  for (const [re, nom] of signatures) if (re.test(html)) return nom;
  return '';
}

async function passerAxe(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(
    (tags) =>
      window.axe.run(document, {
        runOnly: { type: 'tag', values: tags },
        resultTypes: ['violations']
      }),
    TAGS
  );
}

function lire(rapport) {
  const violations = rapport.violations || [];
  const parCritere = new Map();
  let elements = 0;

  for (const v of violations) {
    const t = traduire(v);
    const nb = (v.nodes || []).length;
    elements += nb;
    if (!t.libelle) continue;
    const cle = t.rgaa + '|' + t.libelle;
    const existant = parCritere.get(cle);
    if (existant) existant.nb += nb;
    else parCritere.set(cle, { rgaa: t.rgaa, gravite: t.gravite, libelle: t.libelle, nb });
  }

  const defauts = [...parCritere.values()].sort(
    (a, b) => b.gravite - a.gravite || b.nb - a.nb
  );

  return {
    defauts,
    elements,
    resume: defauts
      .slice(0, 6)
      .map(
        (d) =>
          `- RGAA ${d.rgaa} : ${d.libelle} (${d.nb} element${d.nb > 1 ? 's' : ''} concerne${d.nb > 1 ? 's' : ''})`
      )
      .join('\n')
  };
}

async function scanner(nav, brute) {
  const url = /^https?:\/\//i.test(brute) ? brute : 'https://' + brute;
  const h = hote(url);
  const r = {
    ref_lot: REF_LOT,
    site: url,
    domaine: h,
    ok: false,
    erreur: null,
    titre_page: null,
    url_finale: null,
    contexte: '',
    technologie: '',
    defauts: [],
    resume: '',
    total_elements: 0,
    nb_bloquants: 0,
    url_boutique: null,
    resume_boutique: '',
    total_elements_boutique: 0,
    emails: [],
    scanne_le: new Date().toISOString()
  };

  const ctx = await nav.newContext({
    userAgent: UA,
    viewport: { width: 1366, height: 900 },
    locale: 'fr-FR',
    ignoreHTTPSErrors: true,
    bypassCSP: true
  });

  try {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    r.url_finale = page.url();
    r.titre_page = (await page.title()) || null;

    const accueil = lire(await passerAxe(page));
    r.defauts = accueil.defauts;
    r.resume = accueil.resume;
    r.total_elements = accueil.elements;
    r.nb_bloquants = accueil.defauts.filter((d) => d.gravite === 3).length;

    const signaux = await page.evaluate(() => ({
      description: (
        document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
      ).slice(0, 280),
      h1: (document.querySelector('h1')?.innerText || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 140),
      menu: [
        ...new Set(
          [...document.querySelectorAll('nav a, header a')]
            .map((a) => (a.innerText || '').replace(/\s+/g, ' ').trim())
            .filter((t) => t.length > 1 && t.length < 28)
        )
      ].slice(0, 10),
      accessibilite: [...document.querySelectorAll('a')].some(
        (a) =>
          /accessibilit/i.test(a.innerText || '') ||
          /accessibilit/i.test(a.getAttribute('href') || '')
      )
    }));

    const html = await page.content();
    r.technologie = plateforme(html);

    const lignes = [];
    if (r.titre_page) lignes.push(`Titre de la page : ${r.titre_page}`);
    if (signaux.description) lignes.push(`Description du site : ${signaux.description}`);
    if (signaux.h1) lignes.push(`Titre principal affiche : ${signaux.h1}`);
    if (signaux.menu.length) lignes.push(`Entrees du menu : ${signaux.menu.join(', ')}`);
    if (r.technologie) lignes.push(`Boutique construite avec : ${r.technologie}`);
    lignes.push(
      `Mention d'accessibilite deja presente sur le site : ${signaux.accessibilite ? 'oui' : 'non'}`
    );
    r.contexte = lignes.join('\n');

    // Deuxieme passage : la page ou le visiteur achete.
    const candidats = [];
    for (const m of html.matchAll(/href=["']([^"'>\s]+)["']/gi)) {
      if (!CHEMINS.test(m[1])) continue;
      try {
        const abs = new URL(m[1], r.url_finale);
        if (hote(abs.href) === hote(r.url_finale) && !candidats.includes(abs.href)) {
          candidats.push(abs.href);
        }
      } catch {
        /* lien invalide */
      }
    }

    for (const lien of candidats.slice(0, 3)) {
      try {
        const rep = await page.goto(lien, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (!rep || !rep.ok()) continue;
        await page.waitForTimeout(2000);
        const vente = lire(await passerAxe(page));
        r.url_boutique = page.url();
        r.resume_boutique = vente.resume;
        r.total_elements_boutique = vente.elements;
        break;
      } catch {
        /* page inaccessible, on essaie la suivante */
      }
    }

    let trouves = adresses(html, h);
    if (trouves.length === 0) {
      for (const c of ['/contact', '/contact/', '/pages/contact', '/mentions-legales', '/nous-contacter']) {
        try {
          const rep = await page.goto(new URL(c, r.url_finale).href, {
            waitUntil: 'domcontentloaded',
            timeout: 20000
          });
          if (!rep || !rep.ok()) continue;
          await page.waitForTimeout(1200);
          trouves = adresses(await page.content(), h);
          if (trouves.length) break;
        } catch {
          /* page absente */
        }
      }
    }
    r.emails = trouves;
    r.ok = true;
  } catch (e) {
    r.erreur = String(e && e.message ? e.message : e).slice(0, 300);
  } finally {
    await ctx.close().catch(() => {});
  }

  return r;
}

const nav = await chromium.launch({ args: ['--no-sandbox'] });

for (const u of URLS) {
  console.log(`Boutique : ${u}`);
  const r = await scanner(nav, u);
  if (r.ok) {
    console.log(`  accueil : ${r.defauts.length} critere(s), ${r.total_elements} element(s)`);
    if (r.url_boutique) {
      console.log(`  vente   : ${r.total_elements_boutique} element(s) - ${r.url_boutique}`);
    } else {
      console.log('  vente   : aucune page de vente trouvee');
    }
    if (r.emails.length) console.log(`  contact : ${r.emails[0]}`);
  } else {
    console.log(`  echec : ${r.erreur}`);
  }
  if (WEBHOOK) {
    try {
      const rep = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r)
      });
      console.log(`  -> webhook ${rep.status}`);
    } catch (e) {
      console.error('  -> echec webhook :', e.message);
    }
  }
}

await nav.close();
console.log('Termine.');
