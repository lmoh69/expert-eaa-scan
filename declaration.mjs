// Expert EAA - detecteur de declarations d'accessibilite manquantes
//
// Pour un organisme public, publier une declaration d'accessibilite n'est pas
// une bonne pratique : c'est une obligation, et elle se verifie de l'exterieur.
// Ce script parcourt les sites de mairies via l'annuaire de l'administration
// (api-lannuaire.service-public.fr, gratuit, sans cle) et classe chaque site
// selon ce qu'il publie. Les cas les plus vendables sont ceux qui n'ont aucune
// mention d'accessibilite : l'obligation n'est pas remplie, c'est factuel, et
// la conversation commence sans avoir a juger la qualite de leur site.
//
// Variables d'environnement :
//   DEPTS  codes departement separes par des virgules (defaut 69,38,42,01)
//   MAX    nombre de communes a verifier (defaut 200)
//
// Sortie : rapports/declarations-<date>.json et rapports/declarations.md

import { mkdirSync, writeFileSync } from 'node:fs';

const DEPTS = (process.env.DEPTS || '69,38,42,01')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const MAX = Number(process.env.MAX || 200);

const ANNUAIRE =
  'https://api-lannuaire.service-public.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function sansAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function lire(url, timeout = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const rep = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html,application/json' },
      redirect: 'follow',
      signal: ctrl.signal
    });
    const type = (rep.headers.get('content-type') || '').toLowerCase();
    const texte = await rep.text();
    return { ok: rep.ok, statut: rep.status, url: rep.url, type, texte };
  } catch (e) {
    return { ok: false, statut: 0, erreur: String(e.message || e).slice(0, 120) };
  } finally {
    clearTimeout(t);
  }
}

// L'annuaire renvoie site_internet sous forme de chaine JSON.
function premiereUrl(brut) {
  if (!brut) return '';
  try {
    const liste = JSON.parse(brut);
    for (const e of liste) {
      const v = (e && e.valeur ? String(e.valeur) : '').trim();
      if (/^https?:\/\//i.test(v)) return v;
    }
  } catch {
    if (/^https?:\/\//i.test(brut)) return brut.trim();
  }
  return '';
}

async function communes() {
  const sortie = [];
  const parPage = 100;
  for (let offset = 0; offset < 10000 && sortie.length < MAX; offset += parPage) {
    const url =
      `${ANNUAIRE}?where=pivot%20like%20%22mairie%22&limit=${parPage}&offset=${offset}` +
      `&select=nom,site_internet,code_insee_commune`;
    const r = await lire(url);
    if (!r.ok) break;
    let bloc;
    try {
      bloc = JSON.parse(r.texte);
    } catch {
      break;
    }
    const lignes = bloc.results || [];
    if (lignes.length === 0) break;
    for (const l of lignes) {
      const insee = String(l.code_insee_commune || '');
      const dept = insee.length === 5 ? insee.slice(0, 2) : '';
      if (!DEPTS.includes(dept)) continue;
      const site = premiereUrl(l.site_internet);
      if (!site) continue;
      sortie.push({ nom: String(l.nom || '').replace(/^Mairie\s*-\s*/i, ''), site, dept });
      if (sortie.length >= MAX) break;
    }
  }
  return sortie;
}

// Un lien d'accessibilite se reconnait a son adresse ou a son libelle.
function lienAccessibilite(html, base) {
  const liens = [...html.matchAll(/<a[^>]+href=["']([^"'#>]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)];
  for (const m of liens) {
    const href = m[1];
    const libelle = sansAccents(m[2].replace(/<[^>]*>/g, ' ')).toLowerCase();
    if (/accessibilit/i.test(href) || /accessibilit/.test(libelle)) {
      try {
        return new URL(href, base).href;
      } catch {
        /* lien invalide */
      }
    }
  }
  return '';
}

function analyser(texte) {
  const t = sansAccents(texte.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')).toLowerCase();
  const declaration = /declaration d.?accessibilite/.test(t);
  const schema = /schema pluriannuel/.test(t);
  const nonConforme = /non conforme/.test(t);
  const partielle = /conformite partielle|partiellement conforme/.test(t);
  const totale = /totalement conforme|pleinement conforme/.test(t);
  const taux = (t.match(/(\d{1,3})\s?(?:%|pour cent)/) || [])[1];
  return { declaration, schema, nonConforme, partielle, totale, taux: taux ? Number(taux) : null };
}

function classer(a) {
  if (!a) return { classe: 'aucune_mention', argument: "aucune mention d'accessibilite sur le site" };
  if (!a.declaration)
    return {
      classe: 'mention_sans_declaration',
      argument: "une page accessibilite existe mais aucune declaration d'accessibilite formelle"
    };
  if (a.nonConforme && !a.partielle && !a.totale)
    return { classe: 'declare_non_conforme', argument: 'le site se declare non conforme' };
  if (a.partielle)
    return {
      classe: 'conformite_partielle',
      argument:
        'conformite partielle declaree' + (a.taux !== null ? ` (${a.taux} %)` : '') +
        (a.schema ? '' : ', sans schema pluriannuel publie')
    };
  if (a.totale)
    return { classe: 'declare_conforme', argument: 'conformite totale declaree, a verifier' };
  return { classe: 'declaration_incomplete', argument: 'declaration presente mais sans niveau de conformite lisible' };
}

const PRIORITE = {
  aucune_mention: 1,
  mention_sans_declaration: 2,
  declare_non_conforme: 3,
  declaration_incomplete: 4,
  conformite_partielle: 5,
  declare_conforme: 6,
  injoignable: 9
};

async function verifier(c) {
  const accueil = await lire(c.site, 20000);
  if (!accueil.ok || !accueil.type.includes('text/html')) {
    return { ...c, classe: 'injoignable', argument: `site injoignable (${accueil.erreur || accueil.statut})` };
  }

  const lien = lienAccessibilite(accueil.texte, accueil.url);
  if (!lien) {
    const direct = await lire(new URL('/accessibilite', accueil.url).href, 12000);
    if (direct.ok && direct.type.includes('text/html')) {
      const a = analyser(direct.texte);
      return { ...c, page: direct.url, ...classer(a), details: a };
    }
    return { ...c, page: '', ...classer(null) };
  }

  const page = await lire(lien, 15000);
  if (!page.ok || !page.type.includes('text/html')) {
    return { ...c, page: lien, classe: 'mention_sans_declaration', argument: "le lien accessibilite ne mene a aucune page lisible" };
  }
  const a = analyser(page.texte);
  return { ...c, page: page.url, ...classer(a), details: a };
}

const liste = await communes();
console.log(`${liste.length} commune(s) avec un site, departements ${DEPTS.join(', ')}`);

const resultats = [];
for (const c of liste) {
  const r = await verifier(c);
  resultats.push(r);
  console.log(`${r.classe.padEnd(26)} ${r.nom} - ${r.site}`);
  await new Promise((res) => setTimeout(res, 400));
}

resultats.sort(
  (a, b) => (PRIORITE[a.classe] || 8) - (PRIORITE[b.classe] || 8) || a.nom.localeCompare(b.nom)
);

const compte = {};
for (const r of resultats) compte[r.classe] = (compte[r.classe] || 0) + 1;

const jour = new Date().toISOString().slice(0, 10);
mkdirSync('rapports', { recursive: true });
writeFileSync(
  `rapports/declarations-${jour}.json`,
  JSON.stringify({ jour, departements: DEPTS, compte, resultats }, null, 2)
);

const lignes = [
  `# Declarations d'accessibilite - ${jour}`,
  '',
  `Departements : ${DEPTS.join(', ')} - ${resultats.length} site(s) verifie(s)`,
  '',
  ...Object.entries(compte)
    .sort((a, b) => (PRIORITE[a[0]] || 8) - (PRIORITE[b[0]] || 8))
    .map(([k, v]) => `- ${k} : ${v}`),
  '',
  '## A prospecter en priorite',
  '',
  ...resultats
    .filter((r) => PRIORITE[r.classe] <= 3)
    .map((r) => `- **${r.nom}** (${r.dept}) - ${r.site} - ${r.argument}`)
];
writeFileSync('rapports/declarations.md', lignes.join('\n') + '\n');

console.log('\n--- synthese');
for (const [k, v] of Object.entries(compte)) console.log(`${k} : ${v}`);
console.log(`\nRapport ecrit dans rapports/declarations-${jour}.json`);
