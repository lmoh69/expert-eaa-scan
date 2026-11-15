# Expert EAA — scanner d'accessibilité

Outil interne d'[Expert EAA](https://expert-eaa.fr) (LP SERVICE, Lyon).

Il ouvre la page d'accueil d'un site dans un vrai navigateur, y exécute
[axe-core](https://github.com/dequelabs/axe-core) sur les règles WCAG 2.1 niveaux A et AA,
puis traduit chaque violation en critère du **RGAA 4.1.2** avec une formulation
compréhensible par un dirigeant.

Aucune donnée de prospect n'est stockée dans ce dépôt : les adresses sont passées
en paramètre et les résultats sont envoyés à un webhook.

## Utilisation

Onglet **Actions** → *Scan accessibilite* → *Run workflow*, puis saisir les adresses
séparées par des virgules.

## Configuration

Un secret de dépôt `MAKE_WEBHOOK` doit contenir l'URL du webhook qui reçoit les résultats
(*Settings → Secrets and variables → Actions*). Sans ce secret, les résultats sont
seulement affichés dans le journal d'exécution.

## Portée

Le scan est automatique et ne porte que sur la page d'accueil. Il détecte une partie
des non-conformités, jamais la totalité : certains critères du RGAA ne sont vérifiables
que manuellement. Il ne remplace pas un audit complet et ne vaut pas déclaration de
conformité.
