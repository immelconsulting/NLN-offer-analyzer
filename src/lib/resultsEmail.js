// "Email me my results": the browser side. The wait screen asks before the
// analysis has an id, so a random request reference ties the two together on
// the server (api/_lib/resultsEmail.js). Email is optional, so nothing here is
// allowed to get in the way of the analysis.

import { getVisitorId } from "./track.js";

const EMAILED_KEY = "nln:results-emailed";
const REF_EMAILED_KEY = "nln:results-emailed-ref";

export function newRequestRef() {
  try {
    return crypto.randomUUID();
  } catch {
    return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export async function submitResultsEmail({ email, marketingOptIn, requestRef, submissionId, flow }) {
  const clean = email.trim();
  const res = await fetch("/api/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: clean, marketingOptIn, requestRef, submissionId, flow, vid: getVisitorId() }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "We couldn't send that just now. Please try again.");
  }
  try {
    // So checkout can prefill it, as it did when the landing page asked.
    const lead = JSON.parse(sessionStorage.getItem("nln:lead")) || {};
    sessionStorage.setItem("nln:lead", JSON.stringify({ ...lead, email: clean }));
    if (submissionId) markEmailed(submissionId);
    else if (requestRef) sessionStorage.setItem(REF_EMAILED_KEY, requestRef);
  } catch {
    // Only conveniences; the email is already on its way.
  }
}

function markEmailed(id) {
  try {
    const list = JSON.parse(localStorage.getItem(EMAILED_KEY)) || [];
    localStorage.setItem(EMAILED_KEY, JSON.stringify([...list, id].slice(-20)));
  } catch {
    // The offer just shows again; the server won't send a duplicate.
  }
}

export function wasEmailed(id) {
  try {
    return (JSON.parse(localStorage.getItem(EMAILED_KEY)) || []).includes(id);
  } catch {
    return false;
  }
}

// Called when an analysis comes back, so the results page doesn't offer the
// email again to someone who already said yes on the wait screen.
export function linkRequestToAnalysis(requestRef, id) {
  try {
    if (id && requestRef && sessionStorage.getItem(REF_EMAILED_KEY) === requestRef) markEmailed(id);
  } catch {
    // See markEmailed.
  }
}
