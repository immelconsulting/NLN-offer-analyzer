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
