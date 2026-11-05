// The link a script uses to send someone back when their offer arrives. Matches
// any of the site's addresses, since older scripts spell it out in full.
export const OFFER_PATH = "/offer";
export const OFFER_URL = "https://www.jobofferanalyzer.com/offer";

export function isOfferLink(href) {
  return /^(?:https?:\/\/(?:www\.jobofferanalyzer\.com|jobofferanalyzer\.com|nln-offer-analyzer\.vercel\.app))?\/offer\/?$/.test(href || "");
}
