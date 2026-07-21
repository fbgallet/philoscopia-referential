# Philoscopia — une carte ouverte des débats et visions du monde philosophiques, et les outils pour construire votre propre profil philosophique

**[🇬🇧 English](README.md) · 🇫🇷 Français**

Un référentiel ouvert et bilingue (EN/FR) pour cartographier les positions philosophiques : **80 axes** couvrant les grands débats, des **profils sourcés** de philosophes et de mouvements, des **graphes d'influence et de fondation**, un glossaire et un registre des œuvres — le tout en JSON validé et lisible par machine, conçu pour être réutilisé aussi bien par des humains que par des LLM.

Ce référentiel alimente **Philoscopia**, un compagnon philosophique pour découvrir les visions du monde des philosophes et construire la sienne. Les données sont publiées ici afin que chacun — chercheurs, enseignants, développeurs, ou quiconque dispose d'un LLM — puisse les explorer, les réutiliser, les critiquer et les améliorer.

Plus qu'un référentiel encyclopédique, celui-ci est **didactique** — distillé de plus de vingt ans d'enseignement de la philosophie. Chaque strate est construite pour que vous (et votre assistant IA) puissiez véritablement *faire* de la philosophie, et pas seulement la consulter : mettre au jour les positions que vous tenez déjà, les éprouver face aux objections les plus fortes, et bâtir un espace de travail structuré de vos propres idées.

## Ce qu'il contient

Tout se trouve sous `data/`, un fichier JSON par entité :

| Dossier | Contenu |
|---|---|
| `axes/` | Le cœur du référentiel : 80 axes de positions philosophiques (p. ex. le libre arbitre, le souverain bien, la nature de la vérité). Chaque axe définit ses pôles, son territoire et son plan (théorie descriptive ou valeur), son type (bipolaire, spectre, …), ses axes apparentés, et une carte des sous-problèmes vivants qu'il porte. |
| `themes/` | Une strate de découverte pour débutants : des mots d'entrée grand public (thèmes de vie et notions du programme scolaire — la liberté, le bonheur, la justice, …) reliés chacun aux axes qui les traitent. Une porte d'entrée simple et claire dans le référentiel, sans en connaître le vocabulaire des axes ; les thèmes `featured` apparaissent en premier. |
| `philosophers/` | Des profils situant un philosophe sur les axes, avec des **justifications sourcées**, une distinction déclaré/pratiqué, des statuts et une saillance. Des profils complets coexistent avec des ébauches légères (`"stub": true`) qui signalent une couverture encore à rédiger. |
| `movements/` | Le même modèle pour les écoles et les mouvements (stoïcisme, utilitarisme, …). |
| `characters/` | Le même modèle pour les personnages de fiction. |
| `influences/` | Un graphe orienté des filiations historiques entre figures et mouvements : qui a prolongé, transmis ou réagi contre qui, avec des sources sur les liens attestés. |
| `foundations/` | Un graphe orienté acyclique des relations de fondation entre croyances : quelle croyance descriptive fonde quelle autre croyance ou valeur. |
| `tensions/` | Des paires justifiées de positions en tension au sein d'un même profil (deux croyances incompatibles, ou une croyance face à une valeur). |
| `glossary/` | Les définitions des concepts référencés à travers le corpus. |
| `works/` | Un registre des œuvres citées ou balisées dans le corpus. |
| `thought-experiments/` | Des expériences de pensée classiques (le tramway, la machine à expériences, l'anneau de Gygès, …) reliées aux axes qu'elles mettent à l'épreuve. |
| `arguments/` | Les arguments canoniques (SUPPORTS) et les objections (OBJECTS) qui portent sur une position : une chaîne de raisons avec des approfondissements facultatifs, des sources, et — pour les objections — les issues honnêtes (réviser / nuancer / maintenir). |

La plupart des entités (thèmes, axes, philosophes, mouvements, glossaire, personnages) portent aussi des **`aliases`** — des listes bilingues de noms alternatifs et de termes de recherche courants — pour qu'un lecteur ou un LLM atteigne la bonne entrée à partir des mots qu'il emploierait naturellement, et pas seulement de son identifiant canonique.

## Parcourir le corpus

Pas besoin de lire du JSON : chaque entité dispose aussi d'une page markdown générée et hypertexte — les balises sémantiques deviennent des liens entre les pages, et les relations d'influence et de fondation sont affichées sur les pages qu'elles concernent.

**[Parcourir en français](views/fr/README.md) · [Browse in English](views/en/README.md)**

## Le modèle de données en trois points

1. **Bilingue par structure.** Toute chaîne destinée au lecteur est un objet `LocalizedText` : `{ "fr": "…", "en": "…" }`. D'autres langues pourront être ajoutées avec le temps.
2. **Une entité, un fichier.** Les noms de fichiers correspondent aux identifiants d'entité (`philosophers/epictetus.json`, `axes/freedom.json`). Les références croisées utilisent ces identifiants.
La sémantique complète du modèle — les trois registres, les types d'axes et les valeurs de position, les statuts de profil et la saillance, les graphes de relations — est spécifiée dans **[MODEL.md](MODEL.md)** (en anglais) ; la grille de sous-problèmes portée par les axes (`problems`) dans **[docs/problems-ontology.md](docs/problems-ontology.md)**.

3. **Une couche légère d'annotation sémantique.** Les textes du corpus portent des balises en ligne qui marquent leur structure philosophique, avec des attributs entre apostrophes simples. Les balises de référence renvoient à d'autres entités : `<c id='eudaimonia'>` (concept → glossaire), `<ph>`, `<mv>`, `<chr>` (philosophe / mouvement / personnage), `<ax id='FREEDOM'>` (axe, éventuellement `pole='…'`), `<te>` (expérience de pensée), `<w>` (œuvre). Les balises discursives marquent le rôle d'un passage : `<th>` thèse, `<arg>` argument, `<obj>` objection, `<pb>` problème, `<stk>` enjeu, `<dif>` difficulté, `<ex>` exemple, `<ety>` étymologie, `<q>` citation, `<kw>` terme clé, `<per>` personne, `<bel>` croyance. Les balises entourent des mots existants sans les réécrire. Retirez-les et vous obtenez de la prose ordinaire ; conservez-les et vous obtenez un corpus structuré sémantiquement.

## Utiliser ces données avec un LLM

Le plus simple : le **[serveur MCP](mcp/)** (`npx philoscopia-mcp`). Il sert l'ensemble du référentiel à tout assistant compatible MCP et tient à jour votre propre profil philosophique dans un dossier local et privé `my-philosophy/` — du JSON et du markdown qui vous appartiennent, validés contre les schémas publiés, sans aucun appel réseau. C'est le même espace de travail que celui que vous construisez sur le site Philoscopia : les deux se complètent. Par-dessus, six **[skills d'exploration](skills/)** donnent à votre assistant le savoir-faire conversationnel : `philo-discover` (mettre au jour des positions que vous ignoriez tenir), `philo-examine` (mise à l'épreuve socratique d'une croyance), `philo-compare` (face à face avec une figure), `philo-read` (suivre le fil d'un texte ensemble), `philo-concept` (éprouver ce qu'un concept change), `philo-articulate` (s'exercer à dire ce que l'on pense). Ensemble, le serveur et les skills forment un ensemble cohérent et complet de protocoles pour explorer ses idées et les mettre à l'épreuve.

**Ce que ce n'est pas.** Disons-le clairement : un compagnon IA ne remplace pas une conversation vivante avec des humains — un ami, un professeur, un philosophe ; il ne remplace pas la lecture des philosophes eux-mêmes, car suivre le fil d'une pensée est une expérience à part entière (c'est précisément pour cela que la skill de lecture fait entrer les textes *dans* la pratique) ; et il ne remplace pas la pratique vécue de ses propres principes. Le système est conçu pour orienter vers ces trois-là.

Le corpus est aussi directement lisible par les modèles de langage sans aucun outillage : donnez à un modèle [MODEL.md](MODEL.md), les fichiers d'axes pertinents et le vocabulaire d'annotation ci-dessus, et il pourra situer un philosophe qui n'est pas encore couvert ici, comparer des visions du monde, ou vous aider à explorer la vôtre — dans n'importe quelle interface capable de lire du JSON.

## Provenance et maintenance de ce dépôt

Ce dépôt est un **export généré** depuis un monorepo de travail privé, où le contenu est rédigé, validé (validation de schéma, intégrité référentielle, résolution des balises, acyclicité des graphes) et évalué. Ne modifiez pas directement les fichiers de `data/` ici : les changements sont intégrés en amont puis réexportés (voir [CONTRIBUTING](CONTRIBUTING.md) — les corrections et améliorations sourcées sont les bienvenues, en particulier de la part des spécialistes des philosophes couverts).

Une note sur l'exhaustivité : certains sous-problèmes d'axes sont marqués `"resolution": "LATENT"` ; ils sont réalisés par des activités interactives (questions, scénarios) dans les applications Philoscopia, qui ne font pas partie de ce référentiel.

## Feuille de route

- [x] [Schémas JSON](schemas/) publiés pour chaque type de contenu
- [ ] Le parseur / validateur de balises sous forme d'un petit paquet sous licence MIT
- [x] Des vues générées lisibles par l'humain (une page par entité, EN + FR)
- [ ] La spécification complète du modèle d'axes, en anglais
- [x] Un [serveur MCP](mcp/) pour l'exploration pilotée par LLM et l'auto-profilage
- [x] Des [skills d'exploration](skills/) (découverte guidée, examen socratique, comparaison avec des figures)

## Soutenir & suivre

Si Philoscopia vous est utile, vous pouvez soutenir notre travail sur **[Ko-fi](https://ko-fi.com/philoscopia)** — ponctuel ou récurrent, également possible via [GitHub Sponsors](https://github.com/sponsors/fbgallet).

Suivez le projet et écrivez-nous sur **[X (@fbgallet)](https://x.com/fbgallet)** et **[Bluesky (@fbgallet.bsky.social)](https://bsky.app/profile/fbgallet.bsky.social)**.

## Licence

- **Données et documentation** (`data/`, `*.md`) : [Creative Commons Attribution - Partage dans les Mêmes Conditions 4.0](LICENSE) (CC BY-SA 4.0). Vous pouvez les partager et les adapter, y compris à des fins commerciales, à condition de créditer *Philoscopia — Fabrice Gallet* et de placer vos dérivés sous les mêmes conditions.
- **Code** (`scripts/`, et futurs paquets de schémas/parseur) : [MIT](LICENSE-CODE).

## Citation

> Gallet, F. (2026). *Philoscopia : un référentiel ouvert des visions du monde philosophiques.* https://github.com/fbgallet/philoscopia-referential
