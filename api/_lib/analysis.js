// Shared web-search analysis loop, used by /api/analyze (offer stage),
// /api/analyze-apply (screening-call stages) and /api/analyze-offer-soon.
// Files under api/_lib are not deployed as serverless functions (underscore
// prefix), just imported.
//
// The behavior here is load-bearing and was arrived at by measurement — see
// CLAUDE.md. Two things must not be "optimized":
//
//   1. tool_choice stays "auto". Forcing the submit tool makes the model
//      answer immediately and skip every search, which is what the whole
//      flow exists to avoid.
//   2. max_uses stays at 3. Dropping to 2 saved ~5s and made the model drop
//      the specialist sources entirely (a tech offer came back citing
//      Glassdoor alone, no Levels.fyi).

export const WEB_SEARCH_TOOL = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 3,
};

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;
const MAX_ATTEMPTS = 4;

// Runs the model with web search plus one structured-output tool, and
// returns that tool's input once the model calls it.
//
// Because tool_choice is "auto", the model may take several turns:
//   - "pause_turn": the server-side search loop hit its cap; resend to resume.
//   - "end_turn" with no tool call: nudge once with the tool forced.
export async function runSearchAnalysis({
  client,
  system,
  userMessage,
  submitTool,
}) {
  const messages = [{ role: "user", content: userMessage }];
  let result = null;
  let forceSubmit = false;

  for (let attempt = 0; attempt < MAX_ATTEMPTS && !result; attempt++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
      tools: [WEB_SEARCH_TOOL, submitTool],
      tool_choice: forceSubmit
        ? { type: "tool", name: submitTool.name }
        : { type: "auto" },
    });

    const toolBlock = response.content.find(
      (b) => b.type === "tool_use" && b.name === submitTool.name
    );
    if (toolBlock) {
      result = toolBlock.input;
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "pause_turn") {
      // Resume without adding a user turn — the API picks up where it left off.
      continue;
    }

    // Talked instead of calling the tool: ask once more, tool forced.
    messages.push({
      role: "user",
      content: `Now call ${submitTool.name} with your complete analysis, citing the sources you found.`,
    });
    forceSubmit = true;
  }

  if (!result) {
    throw new Error(`Model never returned a ${submitTool.name} tool call.`);
  }
  return result;
}

// Shape of the `sources` array, identical in both flows: the market-data
// sources actually retrieved this session. Empty is valid and means no
// usable data was found, which the prompts must then state plainly rather
// than inventing figures.
export const SOURCES_SCHEMA = {
  type: "array",
  minItems: 0,
  maxItems: 4,
  description:
    "The market-data sources actually used, from web searches run this session. Empty array only if no usable data was found.",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "e.g. 'Levels.fyi', 'BLS'" },
      url: { type: "string", description: "URL from the search result." },
      note: {
        type: "string",
        description: "One sentence on what data point this source supported.",
      },
    },
    required: ["name", "url", "note"],
  },
};

// Low / target / stretch, in whole dollars. Shared by every researched-range
// flow so the three points always mean the same thing.
export const RANGE_POINTS = {
  type: "object",
  properties: {
    low: {
      type: "integer",
      description: "Bottom of the defensible range; the walk-away floor.",
    },
    target: {
      type: "integer",
      description: "Realistic, well-supported number to aim at.",
    },
    stretch: {
      type: "integer",
      description: "Top of the band for a strong candidate.",
    },
  },
  required: ["low", "target", "stretch"],
};

// One of the three approaches offered by a pre-offer analysis. The ids are
// fixed because the script generator maps the recommended one to how wide a
// range the candidate quotes out loud.
export const STRATEGY_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", enum: ["cautious", "balanced", "aggressive"] },
    style: {
      type: "string",
      description: "Short label, e.g. 'Deflect and redirect'.",
    },
    when_to_use: { type: "string" },
    summary: {
      type: "string",
      description: "What they actually do, 1-2 sentences.",
    },
  },
  required: ["id", "style", "when_to_use", "summary"],
};

// Maps the form's risk-tolerance answer onto a strategy id. Set server-side
// in every flow rather than trusted from the model.
export const RISK_TO_STRATEGY = {
  Cautious: "cautious",
  Balanced: "balanced",
  Aggressive: "aggressive",
};

// The tool omits market_range when there's no usable data. Normalizing here
// means every client only has to check for null.
export function normalizeRange(analysis) {
  if (!Array.isArray(analysis.sources)) {
    analysis.sources = [];
  }
  if (!analysis.market_range?.base) {
    analysis.market_range = null;
  } else if (!analysis.market_range.total_comp) {
    analysis.market_range.total_comp = null;
  }
  return analysis;
}
