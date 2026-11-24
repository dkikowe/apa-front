import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentButton } from "../web/src/components/DocumentButton";
import { getDocumentFile } from "../web/src/api";
afterEach(() => vi.unstubAllGlobals());
describe("On-demand documents", () => {
  it("renders receipt and identity buttons without requesting or embedding files", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const html = renderToStaticMarkup(<><DocumentButton documentId="id-one" kind="identity" /><DocumentButton documentId="id-two" kind="receipt" compact /></>);
    expect(html).toContain("Куәлікті көрсету");
    expect(html).toContain("Чекті көрсету");
    expect(html).not.toMatch(/<iframe|<img|\/content/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("loads the authorized original once and preserves its download name and abort signal", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({mime: "application/pdf", originalName: "Чек.pdf"}), {headers: {"content-type": "application/json"}})).mockResolvedValueOnce(new Response("%PDF-test", {headers: {"content-type": "application/pdf"}}));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const file = await getDocumentFile("test-id", controller.signal);
    expect(file.name).toBe("Чек.pdf");
    expect(await file.blob.text()).toBe("%PDF-test");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith("/api/documents/test-id/content", {credentials: "same-origin", signal: controller.signal});
  });
  it("does not fetch unsupported content or treat an error page as a document", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({mime: "text/html"})));
    vi.stubGlobal("fetch", fetch);
    await expect(getDocumentFile("html-id", new AbortController().signal)).rejects.toThrow("бұл түрін");
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({mime: "image/png"}))).mockResolvedValueOnce(new Response(JSON.stringify({message: "Құжат табылмады."}), {status: 404}));
    await expect(getDocumentFile("missing-id", new AbortController().signal)).rejects.toThrow("Құжат табылмады.");
  });
});
