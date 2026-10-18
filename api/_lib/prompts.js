import fs from "fs";
import path from "path";

// Loads one of the six prompt .md files from the project root. These files
// ARE the product (source routing, "never invent salary figures", Alex's
// voice rules), so a missing or empty one is an error, never a reason to
// fall back to a generic one-liner: that would quietly sell a $47 script, or
// show an analysis with made-up numbers, built without any of those rules.
// The error surfaces as the endpoint's normal "please try again" response,
// and nothing is cached, so a retry works once the file is back.
//
// vercel.json lists *-prompt.md under each function's includeFiles so the
// deploy always bundles them.

export function loadPrompt(filename) {
  let content = "";
  try {
    content = fs.readFileSync(path.join(process.cwd(), filename), "utf-8").trim();
  } catch (err) {
    throw new Error(`Prompt file ${filename} could not be read: ${err.message}`);
  }
  if (!content) throw new Error(`Prompt file ${filename} is empty`);
  return content;
}
