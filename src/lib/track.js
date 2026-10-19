// Fire-and-forget funnel event tracking. Never throws, never blocks, never
// surfaces anything to the user — a tracking failure must not break the app
// or delay a navigation.
//
// sendBeacon is preferred because several of these fire immediately before
// the page goes away (clicking through to Stripe), and the browser guarantees
// a beacon is still delivered after unload. keepalive fetch is the fallback
// for anywhere sendBeacon isn't available.
//
// Each browser gets a random visitor id (localStorage "nln:vid"). Events
// carry it plus the flow of the page they came from. The id isn't personal
// on its own; once the visitor enters their email on the landing page,
// /api/lead links the two so the admin dashboard can follow a person's
// journey (disclosed in the privacy policy). No email or name is ever sent
// from here.

const VID_KEY = "nln:vid";
let memoryVid = null;

export function getVisitorId() {
  try {
    let vid = localStorage.getItem(VID_KEY);
    if (!vid) {
      vid = crypto.randomUUID();
      localStorage.setItem(VID_KEY, vid);
    }
    return vid;
  } catch {
    // Private mode or storage blocked: one id for this page load.
    if (!memoryVid) memoryVid = `m-${Math.random().toString(36).slice(2, 12)}`;
    return memoryVid;
  }
}

// Which funnel a page belongs to, from its path.
export function flowFromPath(path) {
  if (path.startsWith("/offer-soon")) return "offer_soon";
  if (path.startsWith("/apply")) return "apply";
  if (path.startsWith("/interview")) return "interview";
  if (path === "/offer" || path === "/results" || path === "/proof") return "offer";
  return null;
}

export function track(event, meta = {}) {
  try {
    const path = typeof location !== "undefined" ? location.pathname : "";
    const body = JSON.stringify({ event, meta, vid: getVisitorId(), flow: flowFromPath(path) });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      // Blob carries the content type — some browsers reject a bare string.
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/event", blob)) return;
      // sendBeacon returns false if it couldn't queue; fall through to fetch.
    }

    fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Swallow everything — tracking is never worth an error in the funnel.
  }
}
