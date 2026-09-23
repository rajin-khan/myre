const MARKED_URL = "https://cdn.jsdelivr.net/npm/marked@18.0.7/lib/marked.esm.js";
const PURIFY_URL = "https://cdn.jsdelivr.net/npm/dompurify@3.4.15/dist/purify.es.mjs";
const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs";
const CALLOUTS = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);

function prepareCallouts(container) {
  for (const quote of container.querySelectorAll("blockquote")) {
    const first = quote.firstElementChild;
    const match = first?.textContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s|$)/i);
    if (!match || !CALLOUTS.has(match[1].toUpperCase())) continue;
    const kind = match[1].toUpperCase();
    const text = first.firstChild;
    if (!text || text.nodeType !== Node.TEXT_NODE) continue;
    text.textContent = text.textContent.replace(/^\[![A-Z]+\]\s*/i, "");
    quote.classList.add("markdown-callout", `markdown-callout-${kind.toLowerCase()}`);
    const label = document.createElement("strong");
    label.className = "markdown-callout-label";
    label.textContent = kind.toLowerCase();
    quote.prepend(label);
  }
}

export async function renderMarkdown(container, markdown) {
  let marked;
  let DOMPurify;
  try {
    [{ marked }, { default: DOMPurify }] = await Promise.all([
      import(MARKED_URL),
      import(PURIFY_URL),
    ]);
  } catch (error) {
    container.classList.add("markdown-raw");
    container.textContent = markdown;
    throw new Error("The Markdown formatter could not load. Showing the source text instead.", { cause: error });
  }

  container.classList.remove("markdown-raw");
  marked.setOptions({ gfm: true, breaks: false });
  container.innerHTML = DOMPurify.sanitize(marked.parse(markdown), { USE_PROFILES: { html: true } });
  prepareCallouts(container);
  for (const anchor of container.querySelectorAll("a[href]")) {
    if (anchor.href.startsWith("http")) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
  }
  for (const table of container.querySelectorAll("table")) {
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";
    table.replaceWith(wrapper);
    wrapper.append(table);
  }

  const diagrams = [];
  for (const code of container.querySelectorAll("pre > code.language-mermaid")) {
    const diagram = document.createElement("div");
    diagram.className = "mermaid";
    diagram.textContent = code.textContent;
    code.parentElement.replaceWith(diagram);
    diagrams.push({ element: diagram, source: code.textContent });
  }
  if (!diagrams.length) return;

  try {
    const { default: mermaid } = await import(MERMAID_URL);
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
    await mermaid.run({ nodes: diagrams.map((item) => item.element), suppressErrors: true });
    if (diagrams.some((item) => !item.element.querySelector("svg"))) throw new Error("Diagram did not render");
  } catch (error) {
    for (const { element, source } of diagrams) {
      if (element.querySelector("svg")) continue;
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = source;
      pre.append(code);
      element.replaceWith(pre);
    }
    throw new Error("The diagram could not render. Showing its source instead.", { cause: error });
  }
}
