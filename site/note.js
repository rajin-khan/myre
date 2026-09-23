import { renderMarkdown } from "./markdown.js";

const title = document.querySelector("#note-title");
const source = document.querySelector("#note-source");
const body = document.querySelector("#markdown-body");
const status = document.querySelector("#note-status");

async function openNote() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const branch = params.get("branch");
  const path = params.get("path");
  if (!id && !(branch && path)) {
    title.textContent = "note not found";
    source.textContent = "Open a note from the studies board.";
    return;
  }

  try {
    const response = await fetch("/api/studies", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("The studies board could not load.");
    const board = await response.json();
    if (!board.name) {
      title.textContent = "sign in to read";
      source.textContent = "This note is on the shared studies board.";
      const link = document.createElement("a");
      link.href = "learning.html";
      link.textContent = "go to studies to sign in ↗";
      body.append(link);
      return;
    }

    const note = id
      ? board.notes?.find((item) => item.id === id)
      : board.files?.find((item) => item.branch === branch && item.path === path);
    if (!note) {
      title.textContent = "note not found";
      source.textContent = "It may have moved or been removed.";
      return;
    }

    title.textContent = note.title;
    source.textContent = id ? "shared note / " + note.folder : `${note.author} / ${note.branch} / ${note.path}`;
    document.title = `${note.title} · myre os`;
    try {
      await renderMarkdown(body, note.body);
      if (body.firstElementChild?.tagName === "H1" && body.firstElementChild.textContent.trim() === note.title.trim()) {
        body.firstElementChild.remove();
      }
      status.textContent = "";
    } catch (error) {
      console.error("Note formatting failed:", error);
      status.textContent = error.message;
    }
  } catch (error) {
    console.error("Note reader failed:", error);
    title.textContent = "couldn't open note";
    source.textContent = "The reader is having trouble loading.";
    status.textContent = error.message || "Please try again.";
  }
}

openNote();
