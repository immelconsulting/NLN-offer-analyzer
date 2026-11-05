// Long model-written notes read as a wall of text. New analyses come back in
// short paragraphs; this also breaks up anything written as one block, which
// covers older result links and a model that ignores the instruction.

const ABBREVIATIONS = /(?:^|[\s(])(?:e\.g|i\.e|vs|etc|U\.S|Sr|Jr|Mr|Ms|Mrs|Dr|St|approx)\.$/i;

function splitSentences(text) {
  const sentences = [];
  const ending = /[.!?]["”')]*\s+/g;
  let start = 0;
  let match;
  while ((match = ending.exec(text))) {
    const end = match.index + match[0].length;
    const sentence = text.slice(start, end).trim();
    const next = text[end];
    const endsWithAbbreviation = ABBREVIATIONS.test(text.slice(start, match.index + 1));
    if (!endsWithAbbreviation && next && /["“'$A-Z0-9]/.test(next)) {
      sentences.push(sentence);
      start = end;
    }
  }
  const rest = text.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences;
}

export function splitIntoParagraphs(text, sentencesPerParagraph = 2) {
  if (typeof text !== "string" || !text.trim()) return [];
  return text
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .flatMap((block) => {
      const sentences = splitSentences(block);
      if (sentences.length <= sentencesPerParagraph) return [block];
      const paragraphs = [];
      for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
        paragraphs.push(sentences.slice(i, i + sentencesPerParagraph).join(" "));
      }
      return paragraphs;
    });
}

// Acronyms people don't know, in source labels and notes. Case-sensitive so a
// URL like bls.gov is left alone. Used by the server on new analyses, and by the
// pages so older results links read the same.
const BLS_WAGE_DATA = "U.S. Bureau of Labor Statistics wage data";

export function plainSourceNames(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(
      /(?:(?:the|The) )?(?:U\.S\. )?(?:Bureau of Labor Statistics|BLS)(?:['’]s?)? (?:\(BLS\) )?(?:OEWS|OES|Occupational Employment and Wage Statistics)(?: \(OEWS\))?(?: data)?/g,
      BLS_WAGE_DATA
    )
    .replace(/\bBLS (?:wage )?data\b/g, BLS_WAGE_DATA)
    .replace(/\bOEWS\b(?: data)?/g, BLS_WAGE_DATA)
    .replace(/\bBLS\b/g, "U.S. Bureau of Labor Statistics")
    .replace(/^(?:U\.S\. )?Bureau of Labor Statistics$/, BLS_WAGE_DATA);
}

// Proper curly quotes, and no doubled or missing ones on a spoken line.
export function curlyQuotes(text) {
  if (typeof text !== "string") return text;
  return text
    .split("\n")
    .map((raw) => {
      let line = raw.replace(/[“”"]{2,}/g, '"').replace(/[“”]/g, '"');
      if (line.includes("🗣") && (line.match(/"/g) || []).length === 1) {
        const at = line.indexOf('"');
        const opensLine = /(?:🗣\uFE0F?|[\s*:])$/u.test(line.slice(0, at));
        line = opensLine ? `${line.trimEnd()}"` : line.replace(/(🗣\S*\s*)/u, '$1"');
      }
      return line
        .replace(/(^|[\s(*_:[])"/g, "$1“")
        .replace(/"/g, "”")
        .replace(/(^|[\s(*_“[])'(?=\w)/g, "$1‘")
        .replace(/'/g, "’");
    })
    .join("\n");
}
