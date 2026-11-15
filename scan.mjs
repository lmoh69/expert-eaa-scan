// Expert EAA - scan d'accessibilite automatique
//
// Lance un vrai navigateur, execute axe-core sur la page d'accueil d'un site,
// traduit les violations en criteres RGAA, cherche une adresse de contact
// publique, puis envoie le resultat a un webhook Make.
//
// Variables d'environnement :
//   URLS    : adresses separees par des virgules (15 maximum)
//   WEBHOOK : URL du webhook Make qui recoit les resultats
//   REF_LOT : identifiant libre du lot, renvoye tel quel

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

if (URLS.length === 0) {
  console.error('Aucune URL fournie dans URLS.');
  process.exit(1);
}

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function normaliser(u) {
  const s = u.trim();
  return /^https?:\/\//i.test(s) ? s : 'https://' + s;
}

function domaine(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Adresses techniques, fichiers mal interpretes, et surtout les adresses
// d'exemple que beaucoup de sites laissent dans leurs maquettes de formulaire :
// en ecrire une dans un e-mail de prospection ferait perdre le prospect.
const EMAILS_A_IGNORER =
  /(sentry|wixpress|wordpress|yoast|godaddy|@2x|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|example|exemple|@mail\.com|@domaine|@votresite|@monsite|@site\.|^(votre|vous|nom|prenom|email|mail|adresse|test|essai|no-?reply|ne-?pas-?repondre|utilisateur|user|john|jane)@)/i;

function emailsDepuisHtml(html, hote) {
  const trouves = new Set();
  const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  for (const brut of html.match(re) || []) {
    const e = brut.toLowerCase();
    if (EMAILS_A_IGNORER.test(e)) continue;
    if (e.length > 64) continue;
    trouves.add(e);
  }
  const liste = [...trouves];
  // On privilegie une adresse du domaine du prospect, puis une adresse generique.
  const memeDomaine = liste.filter((e) => hote && e.endsWith('@' + hote));
  const generiques = liste.filter((e) => /^(contact|bonjour|hello|info|commercial|direction)@/.test(e));
  return [...new Set([...memeDomaine, ...generiques, ...liste])].slice(0, 5);
}

async function scanner(navigateur, urlBrute) {
  const url = normaliser(urlBrute);
  const hote = domaine(url);
  const resultat = {
    ref_lot: REF_LOT,
    site: url,
    domaine: hote,
    ok: false,
    erreur: null,
    titre_page: null,
    url_finale: null,
    total_problemes: 0,
    total_elements: 0,
    nb_bloquants: 0,
    defauts: [],
    resume: '',
    emails: [],
    scanne_le: new Date().toISOString()
  };

  const contexte = await navigateur.newContext({
    userAgent: UA,
    viewport: { width: 1366, height: 900 },
    locale: 'fr-FR',
    ignoreHTTPSErrors: true,
    // Certains sites interdisent l'injection de script par leur politique de
    // securite ; sans cette option, axe-core ne peut pas s'executer chez eux.
    bypassCSP: true
  });

  try {
    const page = await contexte.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    resultat.url_finale = page.url();
    resultat.titre_page = (await page.title()) || null;

    await page.addScriptTag({ content: axeSource });
    const rapport = await page.evaluate(
      (tags) =>
        window.axe.run(document, {
          runOnly: { type: 'tag', values: tags },
          resultTypes: ['violations']
        }),
      TAGS
    );

    const violations = rapport.violations || [];
    const parCritere = new Map();

    for (const v of violations) {
      const t = traduire(v);
      const nb = (v.nodes || []).length;
      resultat.total_elements += nb;
      if (!t.libelle) continue;
      const cle = t.rgaa + '|' + t.libelle;
      const existant = parCritere.get(cle);
      if (existant) {
        existant.nb += nb;
      } else {
        parCritere.set(cle, { rgaa: t.rgaa, gravite: t.gravite, libelle: t.libelle, nb, regle: v.id });
      }
    }

    const defauts = [...parCritere.values()].sort(
      (a, b) => b.gravite - a.gravite || b.nb - a.nb
    );

    resultat.defauts = defauts;
    resultat.total_problemes = violations.length;
    resultat.nb_bloquants = defauts.filter((d) => d.gravite === 3).length;

    // Resume en clair, pret a etre repris dans un e-mail ou un rapport.
    resultat.resume = defauts
      .slice(0, 6)
      .map((d) => `- RGAA ${d.rgaa} : ${d.libelle} (${d.nb} element${d.nb > 1 ? 's' : ''} concerne${d.nb > 1 ? 's' : ''})`)
      .join('\n');

    // Recherche d'une adresse de contact publique
    const htmlAccueil = await page.content();
    let emails = emailsDepuisHtml(htmlAccueil, hote);

    if (emails.length === 0) {
      for (const chemin of ['/contact', '/contact/', '/mentions-legales', '/mentions-legales/', '/nous-contacter']) {
        try {
          const rep = await page.goto(new URL(chemin, resultat.url_finale).href, {
            waitUntil: 'domcontentloaded',
            timeout: 20000
          });
          if (!rep || !rep.ok()) continue;
          await page.waitForTimeout(1200);
          emails = emailsDepuisHtml(await page.content(), hote);
          if (emails.length > 0) break;
        } catch {
          /* page absente, on continue */
        }
      }
    }
    resultat.emails = emails;
    resultat.ok = true;
  } catch (e) {
    resultat.erreur = String(e && e.message ? e.message : e).slice(0, 300);
  } finally {
    await contexte.close().catch(() => {});
  }

  return resultat;
}

async function envoyer(resultat) {
  if (!WEBHOOK) {
    console.log('Pas de WEBHOOK configure, resultat affiche seulement.');
    return;
  }
  try {
    const rep = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resultat)
    });
    console.log(`  -> webhook ${rep.status}`);
  } catch (e) {
    console.error('  -> echec webhook :', e.message);
  }
}

const navigateur = await chromium.launch({ args: ['--no-sandbox'] });

for (const u of URLS) {
  console.log(`Scan de ${u}`);
  const r = await scanner(navigateur, u);
  if (r.ok) {
    console.log(`  ${r.defauts.length} critere(s) RGAA en defaut, ${r.total_elements} element(s) concerne(s)`);
    if (r.emails.length) console.log(`  contact : ${r.emails[0]}`);
  } else {
    console.log(`  echec : ${r.erreur}`);
  }
  await envoyer(r);
}

await navigateur.close();
console.log('Termine.');
