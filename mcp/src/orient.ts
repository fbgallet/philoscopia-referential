// orient: the session-opening overview, designed to be RESTATED to the user
// (never dumped): what the referential offers, who the user is (expertise,
// goals, motivations), where their carnet stands, the thread left open, and a
// few ways to continue. Everything derives from the corpus and the workspace;
// this file only assembles.

import { pickLocale, type Corpus, type Locale } from "./corpus.js";
import type { Workspace } from "./workspace.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const T = {
  guidance: {
    en: "Open the conversation FROM this data, in a few warm and simple sentences adapted to user.expertise — never show this JSON or enumerate it all. Where they stand, the open thread (next) if any, then two or three ways to continue. For someone unsure where to begin, a featured theme (referential.themes.featured — a general-public entry point) or an affinity they hold is the easiest way in.",
    fr: "Ouvrir la conversation À PARTIR de ces données, en quelques phrases chaleureuses et simples adaptées à user.expertise — ne jamais montrer ce JSON ni tout énumérer. Où en est la personne, le fil laissé ouvert (next) s'il existe, puis deux ou trois façons de continuer. Pour quelqu'un qui ne sait pas par où commencer, un thème mis en avant (referential.themes.featured, une porte d'entrée grand public) ou une affinité qu'il porte est l'entrée la plus facile.",
  },
  // A note addressed to the ASSISTANT, not for restating: delegate the
  // skill-detection the server can't do itself (it has no view of the client's
  // loaded context) to the model, which CAN see what it has. It self-limits —
  // the condition goes false once a philo-* protocol is loaded, so the nudge
  // stops nagging exactly when it should. TIMING matters as much as the
  // content: this note rides along with notInitialized on a first session, and
  // a welcome that asks for an install before giving any value drives people
  // away — hence the explicit ban on raising it at the first exchange, and the
  // ordering (the free, immediate prompt menu before the effortful install).
  setup: {
    en: "FOR THE ASSISTANT (do not recite to the person): if no philo-* session protocol is loaded (a skill) and no session prompt is running, you are working from the built-in guide alone — usable, but coarser. DO NOT raise it at the first exchange: the person must taste something first (welcome, getting acquainted, a first exploration); asking for an install before giving anything drives people away. The right moment: the close of the first session, or when they hit something this guide handles poorly. Then, once and without insisting — first the client's session-prompt menu (immediate, nothing to install), then the philo-* skills (auto-triggered, hands-free) if they want the best experience (the philoscopia-referential repo's skills/ folder → the assistant's skills directory). This note is moot once a protocol is loaded.",
    fr: "POUR L'ASSISTANT (ne pas réciter à la personne) : si aucun protocole de session philo-* n'est chargé (un skill) et qu'aucun prompt de session n'est en cours, tu mènes avec le seul guide intégré — utilisable, mais plus fruste. N'EN PARLE PAS au premier échange : la personne doit d'abord goûter quelque chose (accueil, faire connaissance, une première exploration) ; demander un effort d'installation avant d'avoir rien donné fait fuir. Le bon moment : la clôture de la première session, ou quand elle bute sur quelque chose que ce guide rend mal. Alors, une fois et sans insister — d'abord le menu de prompts de session du client (immédiat, rien à installer), puis les skills philo-* (déclenchés automatiquement, mains-libres) si elle veut le meilleur confort (dossier skills/ du dépôt philoscopia-referential → dossier de skills de l'assistant). Note caduque dès qu'un protocole est chargé.",
  },
  referential: {
    en: (axes: number) =>
      `A shared map of ${axes} great philosophical questions (axes), each with its poles, plus the figures and materials to explore them.`,
    fr: (axes: number) =>
      `Une carte partagée de ${axes} grandes questions philosophiques (axes), chacune avec ses pôles, plus les figures et les matériaux pour les explorer.`,
  },
  notInitialized: {
    en: "No personal carnet yet. Offer to create it (init_workspace), then get acquainted conversationally: their familiarity with philosophy (beginner / cultivated amateur / expert), what they hope for (goals) and what draws them to philosophy (motivations) — their own words, saved with the workspace.",
    fr: "Pas encore de carnet personnel. Proposer de le créer (init_workspace), puis faire connaissance en conversation : leur familiarité avec la philosophie (débutant / amateur cultivé / expert), ce qu'ils en attendent (goals) et ce qui les pousse vers la philosophie (motivations) — leurs propres mots, enregistrés avec le workspace.",
  },
  userMissing: {
    en: "The user block is empty: when natural, get acquainted (expertise, goals, motivations) and save it with set_user.",
    fr: "Le bloc user est vide : au moment naturel, faire connaissance (expertise, goals, motivations) et l'enregistrer avec set_user.",
  },
  inquiry: { en: "Open question", fr: "Question ouverte" },
  exploring: { en: "Axis still being explored", fr: "Axe encore en exploration" },
  stale: {
    en: (n: number) => `${n} position(s) untouched for 90+ days — worth revisiting?`,
    fr: (n: number) => `${n} position(s) non revisitée(s) depuis 90 jours ou plus — à réinterroger ?`,
  },
  menu: {
    en: [
      "PROBLEMATIZE — “what is there to think about here?”: raise a question of your own and see what makes it philosophical",
      "DISCOVER — “what do I really think about…?”: explore a question and elicit your position",
      "EXAMINE — “challenge my belief”: Socratic testing of a conviction",
      "COMPARE — “which philosopher am I close to?”: face-to-face with a figure",
      "READ — “let's read this text together”: a passage, its difficulties, what it asks you",
      "CONCEPT — “what would this concept change for me?”: try a concept on your own life",
      "ARTICULATE — “help me say what I think”: formulation exercises",
    ],
    fr: [
      "QUESTIONNER — « qu'y a-t-il à penser là-dedans ? » : faire naître votre propre question et voir ce qui la rend philosophique",
      "DÉCOUVRIR — « qu'est-ce que je pense vraiment de… ? » : explorer une question et dégager votre position",
      "EXAMINER — « mets ma conviction à l'épreuve » : examen socratique d'une croyance",
      "COMPARER — « de quel philosophe suis-je proche ? » : face-à-face avec une figure",
      "LIRE — « lisons ce texte ensemble » : un passage, ses difficultés, ce qu'il vous demande",
      "CONCEPT — « que changerait ce concept pour moi ? » : essayer un concept sur votre propre vie",
      "FORMULER — « aide-moi à dire ce que je pense » : exercices de formulation",
    ],
  },
} as const;

const STALE_DAYS = 90;
const MAX_THREADS = 4;

const countByPrefix = (corpus: Corpus, prefix: string): number => {
  let n = 0;
  for (const ref of corpus.byRef.keys()) if (ref.startsWith(`${prefix}:`)) n += 1;
  return n;
};

export function computeOrient(corpus: Corpus, ws: Workspace, locale: Locale) {
  const axesList = [...corpus.axes.values()];
  const byRelation: Record<string, number> = {};
  for (const axis of axesList) byRelation[axis.relation] = (byRelation[axis.relation] ?? 0) + 1;

  // Themes: the general-public entry points. featured = the curated selection to
  // offer someone unsure where to begin (a life theme, a school-programme notion).
  // Each carries its ref so a picked theme goes straight to get_entity (no search
  // round-trip); ref is already the `theme:<id>` byRef key.
  const featuredThemes: { ref: string; label: string }[] = [];
  let themeCount = 0;
  for (const [ref, entity] of corpus.byRef) {
    if (!ref.startsWith("theme:")) continue;
    themeCount += 1;
    if (entity.featured) featuredThemes.push({ ref, label: pickLocale(entity.label, locale) });
  }

  const referential = {
    what: T.referential[locale](axesList.length),
    axesByRelation: byRelation,
    figures:
      countByPrefix(corpus, "ph") + countByPrefix(corpus, "mv") + countByPrefix(corpus, "chr"),
    concepts: countByPrefix(corpus, "c"),
    thoughtExperiments: countByPrefix(corpus, "te"),
    works: countByPrefix(corpus, "w"),
    liveProblems: countByPrefix(corpus, "problem"),
    ...(themeCount > 0 ? { themes: { count: themeCount, featured: featuredThemes } } : {}),
  };

  const base = { guidance: T.guidance[locale], setup: T.setup[locale], referential, sessionMenu: T.menu[locale] };

  if (!ws.exists()) {
    return { ...base, workspace: { initialized: false, note: T.notInitialized[locale] } };
  }

  const manifest = ws.manifest();
  const profile = ws.profile();
  const entries: Record<string, any> = profile.entries ?? {};
  const now = Date.now();
  const axisLabel = (id: string) => pickLocale(corpus.axes.get(id)?.label ?? id, locale);

  // Threads to pick up, most actionable first: high-priority inquiries, then
  // axes left in EXPLORING, then the staleness nudge. Capped: an opening is a
  // hand extended, not a todo list.
  const threads: string[] = [];
  const inquiries = ws.list("inquiries", { status: "ACTIVE" });
  inquiries.sort((a, b) => (a.priority === "HIGH" ? -1 : 0) - (b.priority === "HIGH" ? -1 : 0));
  for (const inquiry of inquiries.slice(0, 2)) {
    threads.push(`${T.inquiry[locale]}: ${inquiry.statement}`);
  }
  const exploring = Object.entries(entries)
    .filter(([, e]) => e.status === "EXPLORING")
    .sort(([, a], [, b]) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  for (const [axisId] of exploring.slice(0, MAX_THREADS - threads.length)) {
    threads.push(`${T.exploring[locale]}: ${axisLabel(axisId)} (${axisId})`);
  }
  const staleCount = Object.values(entries).filter(
    (e: any) => now - Date.parse(e.updatedAt) > STALE_DAYS * 24 * 3600 * 1000,
  ).length;
  if (staleCount > 0 && threads.length < MAX_THREADS) threads.push(T.stale[locale](staleCount));

  const positioned = Object.values(entries).filter((e: any) => e.status === "POSITIONED").length;
  const carnet = {
    axesTouched: Object.keys(entries).length,
    axesPositioned: positioned,
    totalAxes: axesList.length,
    beliefs: ws.list("beliefs", { status: "HELD" }).length,
    inquiriesActive: inquiries.length,
    practices: ws.list("practices").length,
    concepts: ws.list("concepts").length,
    affinities: ws.list("affinities").length,
    quotes: ws.list("quotes").length,
    readings: ws.list("readings").length,
  };

  const lastSession = ws.lastSession();
  return {
    ...base,
    workspace: {
      initialized: true,
      ...(manifest.user ? { user: manifest.user } : { userNote: T.userMissing[locale] }),
      carnet,
      ...(lastSession ? { lastSession } : {}),
      ...(manifest.next ? { next: manifest.next } : {}),
      ...(threads.length > 0 ? { threads } : {}),
    },
  };
}
