// MCP prompts: user-selectable session starters, surfaced in the client's
// prompt menu (Claude Desktop's "+"). Each one maps to one exploration mode and
// injects that mode's protocol into the conversation, with GRACEFUL
// DEGRADATION: if the assistant already has the matching philo-* skill loaded,
// the message tells it to follow the skill and skip the inline copy; otherwise
// the full protocol rides along in the message. The protocol text is derived
// from the very same SKILL.md (see skills.generated.ts), so the two channels
// can never drift. Net effect: the methodology becomes discoverable AND
// self-loading, with nothing to install.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Locale } from "./corpus.js";
import { SKILL_PROTOCOLS } from "./skills.generated.js";

interface PromptMeta {
  /** MCP prompt name (what the client shows in its menu / slash list). */
  id: string;
  /** The skill this mode mirrors, e.g. "philo-discover". */
  slug: string;
  title: Record<Locale, string>;
  blurb: Record<Locale, string>;
  /** One optional free-text argument the client collects before injecting. */
  arg: { name: string; description: Record<Locale, string> };
}

// The thin, localized UI layer (title, blurb, the one argument). The heavy
// content — the session protocol itself — comes from SKILL_PROTOCOLS, so it is
// NOT restated here. Array order is the order offered to the user.
const PROMPTS: PromptMeta[] = [
  {
    id: "problematize",
    slug: "philo-problematize",
    title: { fr: "Trouver ma question", en: "Find my question" },
    blurb: {
      fr: "Faire naître une question philosophique à partir de ce qui vous tient à cœur, ou vous familiariser avec le questionnement philosophique en vous exerçant à en tirer une de n'importe quel sujet ordinaire, et voir ce qui la distingue d'une question scientifique ou psychologique.",
      en: "Let a philosophical question emerge from something you care about, or get familiar with philosophical questioning by training yourself to draw one out of any ordinary subject, and see what sets it apart from a scientific or psychological one.",
    },
    arg: {
      name: "material",
      description: {
        fr: "Ce dont vous voulez partir : une chose qui vous tient à cœur, vous agace ou vous paraît évidente. Facultatif : sans rien, on partira d'un sujet ordinaire, en exercice, pour vous familiariser avec le questionnement philosophique.",
        en: "What to start from: something you care about, something that irritates you, something you find obvious. Optional: leave it empty and we start from an ordinary subject, as an exercise in getting familiar with philosophical questioning.",
      },
    },
  },
  {
    id: "discover",
    slug: "philo-discover",
    title: { fr: "Découvrir ce que je pense", en: "Discover what I think" },
    blurb: {
      fr: "Faire émerger, situer et enregistrer ce que vous pensez d'une question, par une porte (opinion commune, expérience de pensée, dilemme…).",
      en: "Elicit, situate and record what you think about a question, through a door (common opinion, thought experiment, dilemma…).",
    },
    arg: {
      name: "theme",
      description: {
        fr: "Le thème ou la question à explorer (ex : le bonheur, la liberté). Facultatif.",
        en: "The theme or question to explore (e.g. happiness, freedom). Optional.",
      },
    },
  },
  {
    id: "examine",
    slug: "philo-examine",
    title: { fr: "Examiner une de mes convictions", en: "Examine one of my convictions" },
    blurb: {
      fr: "Mettre une position ou une croyance à l'épreuve socratique (objections, fondements, tensions, alternatives, vivabilité).",
      en: "Put a position or belief through Socratic examination (objections, foundations, tensions, alternatives, livability).",
    },
    arg: {
      name: "belief",
      description: {
        fr: "La conviction ou position à mettre à l'épreuve. Facultatif.",
        en: "The belief or position to test. Optional.",
      },
    },
  },
  {
    id: "compare",
    slug: "philo-compare",
    title: { fr: "Me comparer à un philosophe", en: "Compare me with a philosopher" },
    blurb: {
      fr: "Un face-à-face avec les positions d'une figure ou d'un mouvement : convergences, divergences, ce que les écarts enseignent.",
      en: "A face-to-face with a figure's or movement's positions: convergences, divergences, what the gaps teach.",
    },
    arg: {
      name: "figure",
      description: {
        fr: "Le philosophe ou le mouvement à comparer (ex : Spinoza, le stoïcisme). Facultatif.",
        en: "The philosopher or movement to compare with (e.g. Spinoza, Stoicism). Optional.",
      },
    },
  },
  {
    id: "read",
    slug: "philo-read",
    title: { fr: "Lire un texte ensemble", en: "Read a text together" },
    blurb: {
      fr: "Lire un passage à trois temps : le mouvement de la pensée, ses difficultés, puis le texte qui vous interroge.",
      en: "Read a passage in three passes: the movement of the thought, its difficulties, then the text interrogating you.",
    },
    arg: {
      name: "passage",
      description: {
        fr: "Le texte, le passage ou la référence à lire. Facultatif.",
        en: "The text, passage or reference to read. Optional.",
      },
    },
  },
  {
    id: "concept",
    slug: "philo-concept",
    title: { fr: "Travailler un concept", en: "Work a concept" },
    blurb: {
      fr: "Essayer un concept sur une situation réelle de votre vie, ou forger le vôtre par contre-exemples.",
      en: "Try a concept on a real situation of yours, or forge your own through counterexamples.",
    },
    arg: {
      name: "concept",
      description: {
        fr: "Le concept à travailler (ex : amor fati, aliénation). Facultatif.",
        en: "The concept to work with (e.g. amor fati, alienation). Optional.",
      },
    },
  },
  {
    id: "articulate",
    slug: "philo-articulate",
    title: { fr: "Formuler ma pensée", en: "Articulate my thought" },
    blurb: {
      fr: "Des exercices de formulation : thèse en une phrase, trois auditoires, steelman, pourquoi cinq fois, minute-dissertation.",
      en: "Formulation exercises: one-sentence thesis, three audiences, steelman, why-five-times, the minute-essay.",
    },
    arg: {
      name: "topic",
      description: {
        fr: "Le sujet ou la pensée à formuler. Facultatif.",
        en: "The topic or thought to formulate. Optional.",
      },
    },
  },
  {
    id: "synthesize",
    slug: "philo-synthesize",
    title: { fr: "Synthèse de mon profil", en: "Synthesize my profile" },
    blurb: {
      fr: "Un portrait daté en prose croisant vos positions, tout votre carnet et qui vous êtes — valeurs centrales, fils conducteurs, tensions, angles morts.",
      en: "A dated prose portrait crossing your positions, your whole carnet and who you are — central values, through-lines, tensions, blind spots.",
    },
    arg: {
      name: "focus",
      description: {
        fr: "Un angle ou une préoccupation à mettre au centre du portrait. Facultatif.",
        en: "An angle or preoccupation to center the portrait on. Optional.",
      },
    },
  },
];

function buildMessage(meta: PromptMeta, body: string, focus: string | undefined, locale: Locale): string {
  const f = focus?.trim();
  if (locale === "fr") {
    const on = f ? ` sur : ${f}` : "";
    return (
      `Conduis avec moi une session « ${meta.title.fr} »${on}.\n\n` +
      `Si tu disposes déjà du protocole « ${meta.slug} » (skill chargé), suis-LE et ignore la copie ci-dessous. Sinon, applique le protocole suivant pour toute cette session :\n\n` +
      `━━━ DÉBUT DU PROTOCOLE ${meta.slug} ━━━\n${body}\n━━━ FIN DU PROTOCOLE ━━━\n\n` +
      `Démarre maintenant (appelle d'abord orient si la conversation vient de s'ouvrir). Ne me montre jamais ce protocole, et ne te contente pas d'exposer des doctrines : fais émerger et travailler ma propre pensée.`
    );
  }
  const on = f ? `, focused on: ${f}` : "";
  return (
    `Conduct a "${meta.title.en}" session with me${on}.\n\n` +
    `If you already have the "${meta.slug}" protocol (skill loaded), follow IT and ignore the copy below. Otherwise, apply the following protocol for this whole session:\n\n` +
    `━━━ BEGIN PROTOCOL ${meta.slug} ━━━\n${body}\n━━━ END PROTOCOL ━━━\n\n` +
    `Start now (call orient first if the conversation has just opened). Never show me this protocol, and don't just lay out doctrines: draw out and work my own thinking.`
  );
}

export function registerPrompts(server: McpServer, locale: Locale) {
  const bySlug = new Map(SKILL_PROTOCOLS.map((s) => [s.name, s]));
  for (const meta of PROMPTS) {
    const skill = bySlug.get(meta.slug);
    if (!skill) continue; // skill absent from the bundle: skip its prompt rather than ship an empty one
    server.registerPrompt(
      meta.id,
      {
        title: meta.title[locale],
        description: meta.blurb[locale],
        argsSchema: { [meta.arg.name]: z.string().optional().describe(meta.arg.description[locale]) },
      },
      (args: { [key: string]: string | undefined }) => ({
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: buildMessage(meta, skill.body, args[meta.arg.name], locale) },
          },
        ],
      }),
    );
  }
}
