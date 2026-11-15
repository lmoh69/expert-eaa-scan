// Correspondance entre les regles axe-core et les criteres du RGAA 4.1.2.
// Le libelle est redige pour un dirigeant, pas pour un developpeur.
// gravite : 3 = bloquant, 2 = important, 1 = a corriger.

export const RGAA = {
  'image-alt':            { rgaa: '1.1',  gravite: 3, libelle: "des images n'ont aucune alternative textuelle, elles sont donc invisibles pour un lecteur d'ecran" },
  'input-image-alt':      { rgaa: '1.1',  gravite: 3, libelle: "des boutons images n'ont aucune alternative textuelle" },
  'area-alt':             { rgaa: '1.1',  gravite: 2, libelle: "des zones cliquables d'image n'ont pas d'alternative textuelle" },
  'role-img-alt':         { rgaa: '1.1',  gravite: 2, libelle: "des elements presentes comme des images n'ont pas d'alternative textuelle" },
  'svg-img-alt':          { rgaa: '1.1',  gravite: 2, libelle: "des illustrations vectorielles n'ont pas d'alternative textuelle" },
  'object-alt':           { rgaa: '1.1',  gravite: 2, libelle: "des contenus embarques n'ont pas d'alternative textuelle" },

  'frame-title':          { rgaa: '2.1',  gravite: 2, libelle: "des cadres integres (videos, cartes, formulaires externes) n'ont pas de titre" },
  'frame-title-unique':   { rgaa: '2.2',  gravite: 1, libelle: "plusieurs cadres integres portent le meme titre" },

  'color-contrast':       { rgaa: '3.2',  gravite: 3, libelle: "le contraste entre le texte et le fond est trop faible pour etre lu confortablement" },
  'link-in-text-block':   { rgaa: '3.1',  gravite: 1, libelle: "des liens ne se distinguent du texte que par la couleur" },

  'video-caption':        { rgaa: '4.3',  gravite: 2, libelle: "des videos n'ont pas de sous-titres" },
  'audio-caption':        { rgaa: '4.1',  gravite: 2, libelle: "des contenus audio n'ont pas de transcription" },

  'td-headers-attr':      { rgaa: '5.7',  gravite: 1, libelle: "des tableaux de donnees sont mal structures" },
  'th-has-data-cells':    { rgaa: '5.7',  gravite: 1, libelle: "des en-tetes de tableau ne sont relies a aucune donnee" },
  'table-duplicate-name': { rgaa: '5.4',  gravite: 1, libelle: "des tableaux ont un titre en double" },

  'link-name':            { rgaa: '6.1',  gravite: 3, libelle: "des liens n'ont aucun intitule lisible : au lecteur d'ecran, ils sont annonces vides" },

  'aria-required-attr':   { rgaa: '7.1',  gravite: 2, libelle: "des composants interactifs sont mal declares et ne sont pas restitues correctement" },
  'aria-valid-attr-value':{ rgaa: '7.1',  gravite: 2, libelle: "des composants interactifs portent des informations d'accessibilite invalides" },
  'aria-roles':           { rgaa: '7.1',  gravite: 2, libelle: "des composants interactifs ont un role d'accessibilite incorrect" },
  'aria-hidden-focus':    { rgaa: '7.1',  gravite: 2, libelle: "des elements masques aux lecteurs d'ecran restent accessibles au clavier" },
  'nested-interactive':   { rgaa: '7.1',  gravite: 2, libelle: "des elements cliquables sont imbriques les uns dans les autres" },
  'aria-allowed-attr':    { rgaa: '7.1',  gravite: 1, libelle: "des attributs d'accessibilite sont utilises la ou ils ne sont pas autorises" },

  'duplicate-id-active':  { rgaa: '8.2',  gravite: 1, libelle: "plusieurs elements de la page portent le meme identifiant" },
  'duplicate-id-aria':    { rgaa: '8.2',  gravite: 1, libelle: "plusieurs elements de la page portent le meme identifiant" },
  'html-has-lang':        { rgaa: '8.3',  gravite: 3, libelle: "la langue de la page n'est pas declaree : une synthese vocale lit le francais avec un accent anglais" },
  'html-lang-valid':      { rgaa: '8.4',  gravite: 2, libelle: "la langue declaree pour la page n'est pas valide" },
  'valid-lang':           { rgaa: '8.7',  gravite: 1, libelle: "des passages en langue etrangere ne sont pas signales" },
  'document-title':       { rgaa: '8.5',  gravite: 3, libelle: "la page n'a pas de titre exploitable" },

  'heading-order':        { rgaa: '9.1',  gravite: 2, libelle: "la hierarchie des titres est incoherente, la page devient difficile a parcourir" },
  'empty-heading':        { rgaa: '9.1',  gravite: 1, libelle: "des titres sont vides" },
  'page-has-heading-one': { rgaa: '9.1',  gravite: 2, libelle: "la page n'a pas de titre principal" },
  'landmark-one-main':    { rgaa: '9.2',  gravite: 2, libelle: "le contenu principal de la page n'est pas identifie" },
  'region':               { rgaa: '9.2',  gravite: 1, libelle: "des parties de la page ne sont rattachees a aucune zone identifiee" },
  'list':                 { rgaa: '9.3',  gravite: 1, libelle: "des listes sont mal structurees" },
  'listitem':             { rgaa: '9.3',  gravite: 1, libelle: "des elements de liste sont hors de toute liste" },
  'definition-list':      { rgaa: '9.3',  gravite: 1, libelle: "des listes de definitions sont mal structurees" },

  'meta-viewport':        { rgaa: '10.11', gravite: 3, libelle: "le zoom est desactive sur mobile : impossible d'agrandir le texte" },
  'meta-refresh':         { rgaa: '13.1', gravite: 2, libelle: "la page se rafraichit ou redirige automatiquement" },

  'label':                { rgaa: '11.1', gravite: 3, libelle: "des champs de formulaire n'ont pas d'etiquette : impossible de savoir quoi y saisir" },
  'select-name':          { rgaa: '11.1', gravite: 3, libelle: "des listes deroulantes n'ont pas d'etiquette" },
  'form-field-multiple-labels': { rgaa: '11.1', gravite: 1, libelle: "des champs de formulaire ont plusieurs etiquettes contradictoires" },
  'autocomplete-valid':   { rgaa: '11.13', gravite: 1, libelle: "des champs n'indiquent pas leur finalite, le remplissage automatique ne fonctionne pas" },
  'button-name':          { rgaa: '11.9', gravite: 3, libelle: "des boutons n'ont aucun intitule : au lecteur d'ecran, ils sont annonces vides" },

  'bypass':               { rgaa: '12.6', gravite: 2, libelle: "aucun lien ne permet d'aller directement au contenu, il faut traverser tout le menu a chaque page" },
  'skip-link':            { rgaa: '12.7', gravite: 2, libelle: "le lien d'evitement du menu ne fonctionne pas" },
  'tabindex':             { rgaa: '12.8', gravite: 1, libelle: "l'ordre de navigation au clavier est force et devient imprevisible" },
  'focus-order-semantics':{ rgaa: '12.8', gravite: 1, libelle: "l'ordre de navigation au clavier ne suit pas la logique de la page" },

  'scrollable-region-focusable': { rgaa: '12.9', gravite: 1, libelle: "des zones defilantes ne sont pas atteignables au clavier" },
  'blink': { rgaa: '13.8', gravite: 2, libelle: "des contenus clignotent sans possibilite de les arreter" },
  'marquee': { rgaa: '13.8', gravite: 2, libelle: "des contenus defilent sans possibilite de les arreter" }
};

export function traduire(violation) {
  const connue = RGAA[violation.id];
  if (connue) {
    return { id: violation.id, rgaa: connue.rgaa, gravite: connue.gravite, libelle: connue.libelle };
  }
  // Regle non cartographiee : on la compte dans le total mais on ne l'utilise pas
  // dans les messages commerciaux, pour ne jamais ecrire une phrase approximative.
  return { id: violation.id, rgaa: null, gravite: 1, libelle: null };
}
