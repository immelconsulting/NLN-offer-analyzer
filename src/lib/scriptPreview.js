// Asks the server for the free script preview until it's ready, gives up after
// about 30 seconds, and reports once. Any failure just means no preview.

const CHECK_EVERY_MS = 3000;
const GIVE_UP_MS = 30_000;

// Calls onDone once, with { status: "ready", preview, headings, flow } or
// { status: "none" }. Returns a function that cancels it.
export function watchPreview(submissionId, onDone) {
  let done = false;
  let timer;
  let giveUp;
  const controller = new AbortController();

  const stop = () => {
    done = true;
    clearTimeout(timer);
    clearTimeout(giveUp);
  };
  const finish = (result) => {
    if (done) return;
    stop();
    onDone(result);
  };

  giveUp = setTimeout(() => {
    finish({ status: "none" });
    controller.abort();
  }, GIVE_UP_MS);

  async function check() {
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true, submissionId }),
        signal: controller.signal,
      });
      if (done) return;
      const body = res.ok ? await res.json() : { status: "none" };
      if (done) return;
      if (body.status === "ready" && body.preview) finish(body);
      else if (body.status === "generating") timer = setTimeout(check, CHECK_EVERY_MS);
      else finish({ status: "none" });
    } catch {
      finish({ status: "none" });
    }
  }
  check();

  return () => {
    stop();
    controller.abort();
  };
}
