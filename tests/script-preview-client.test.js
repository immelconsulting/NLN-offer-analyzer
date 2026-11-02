import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { watchPreview } from "../src/lib/scriptPreview.js";

const reply = (body, ok = true) => Promise.resolve({ ok, json: async () => body });

describe("the offer page's preview loader", () => {
  let onDone;
  beforeEach(() => {
    vi.useFakeTimers();
    onDone = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps a finished preview: the time limit doesn't fire afterwards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockReturnValueOnce(reply({ status: "generating" }))
        .mockReturnValue(reply({ status: "ready", preview: "Hi", headings: [] }))
    );
    watchPreview("sub_1", onDone);
    await vi.advanceTimersByTimeAsync(3000);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][0].status).toBe("ready");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("gives up quietly after a minute and stops asking", async () => {
    const fetchMock = vi.fn(() => reply({ status: "generating" }));
    vi.stubGlobal("fetch", fetchMock);
    watchPreview("sub_1", onDone);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(onDone).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onDone).toHaveBeenCalledWith({ status: "none" });
    const asked = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock.mock.calls.length).toBe(asked);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("treats a server error or a dropped connection as no preview", async () => {
    vi.stubGlobal("fetch", vi.fn(() => reply({}, false)));
    watchPreview("sub_1", onDone);
    await vi.advanceTimersByTimeAsync(0);
    expect(onDone).toHaveBeenCalledWith({ status: "none" });

    const second = vi.fn();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    watchPreview("sub_1", second);
    await vi.advanceTimersByTimeAsync(0);
    expect(second).toHaveBeenCalledWith({ status: "none" });
  });

  it("does nothing further once the page is left", async () => {
    vi.stubGlobal("fetch", vi.fn(() => reply({ status: "generating" })));
    const cancel = watchPreview("sub_1", onDone);
    await vi.advanceTimersByTimeAsync(0);
    cancel();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(onDone).not.toHaveBeenCalled();
  });
});
