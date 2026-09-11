// Fire-and-forget funnel event tracking. Never throws, never blocks, never
// surfaces anything to the user — a tracking failure must not break the app
// or delay a navigation.
//
// sendBeacon is preferred because several of these fire immediately before
// the page goes away (clicking through to Stripe), and the browser guarantees
// a beacon is still delivered after unload. keepalive fetch is the fallback
// for anywhere sendBeacon isn't available.
//
// Payloads are anonymous by design: no email, no name, no company. Only the
// event name plus the small metadata the caller passes.

export function track(event, meta = {}) {
  try {
    const body = JSON.stringify({ event, meta });

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
