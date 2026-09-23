const PEOPLE = ["rajin", "samiyeel", "saumik"];
const COLUMNS = [
  { id: "todo", name: "up next" },
  { id: "doing", name: "in progress" },
  { id: "done", name: "done for now" },
];
const FOLDERS = [
  {
    id: "learn",
    name: "learn first",
    path: "learning/01-learn",
    lessons: [
      { id: "what-is-an-os", title: "what is an operating system?", file: "learning/01-learn/what-is-an-operating-system.md", summary: "A first look at the jobs an operating system does." },
      { id: "how-a-computer-starts", title: "how does a computer start?", file: "learning/01-learn/how-a-computer-starts.md", summary: "Follow the hand-off from power button to desktop." },
    ],
  },
  {
    id: "test",
    name: "test small ideas",
    path: "learning/02-test",
    lessons: [
      { id: "first-safe-experiment", title: "our first safe experiment", file: "learning/02-test/first-safe-experiment.md", summary: "Change one thing, keep notes, and find out what happened." },
    ],
  },
  {
    id: "make",
    name: "make something",
    path: "learning/03-make",
    lessons: [
      { id: "first-small-build", title: "pick a tiny thing to build", file: "learning/03-make/first-small-build.md", summary: "Turn something we learned into a small working project." },
    ],
  },
];

const state = { videos: [], notes: [], tasks: [], checks: [] };
const config = window.MYRE_SUPABASE || {};
const videoForm = document.querySelector("#video-form");
const videoUrl = document.querySelector("#video-url");
const videoTitle = document.querySelector("#video-title");
const videoError = document.querySelector("#video-url-error");
const videoList = document.querySelector("#video-list");
const noteForm = document.querySelector("#note-form");
const noteTitle = document.querySelector("#note-title");
const noteFolder = document.querySelector("#note-folder");
const noteBody = document.querySelector("#note-body");
const noteCancel = document.querySelector("#note-cancel-button");
const noteSave = document.querySelector("#note-save-button");
const lessonFolders = document.querySelector("#lesson-folders");
const taskForm = document.querySelector("#task-form");
const taskTitle = document.querySelector("#task-title");
const taskAssignee = document.querySelector("#task-assignee");
const taskColumns = document.querySelector(".kanban-columns");
const signInForm = document.querySelector("#sign-in-form");
const learningContent = document.querySelector("#learning-content");
const signedIn = document.querySelector("#signed-in");
const signedInEmail = document.querySelector("#signed-in-email");
const accessCopy = document.querySelector("#access-copy");
const status = document.querySelector("#learning-status");

let db = null;
let canEdit = false;
let editingNoteId = null;

function announce(message) {
  status.textContent = message;
}

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function showEditorControls() {
  document.querySelectorAll("[data-editor-only]").forEach((item) => {
    item.hidden = !canEdit;
  });
  renderAll();
}

function getVideo(value) {
  try {
    const url = new URL(value.trim());
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    let id = "";
    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "watch") id = url.searchParams.get("v") || "";
      if (["shorts", "live", "embed"].includes(parts[0])) id = parts[1] || "";
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id)
      ? { id, url: `https://www.youtube.com/watch?v=${id}` }
      : null;
  } catch {
    return null;
  }
}

function checksFor(key) {
  return state.checks.filter((item) => item.item_key === key && item.checked);
}

function progressChecks(key, label) {
  const fieldset = node("fieldset", "progress-checks");
  fieldset.append(node("legend", "", label));
  const people = node("div", "progress-people");
  const checked = new Set(checksFor(key).map((item) => item.person_id));
  for (const person of PEOPLE) {
    const wrapper = node("label", "progress-person");
    const input = node("input");
    input.type = "checkbox";
    input.checked = checked.has(person);
    input.disabled = !canEdit;
    input.dataset.progressKey = key;
    input.dataset.personId = person;
    wrapper.append(input, node("span", "", person));
    people.append(wrapper);
  }
  fieldset.append(people);
  return fieldset;
}

function renderVideos() {
  videoList.replaceChildren();
  if (!state.videos.length) {
    videoList.append(node("p", "empty-videos", "No videos pinned yet."));
    return;
  }
  for (const video of state.videos) {
    const card = node("article", "video-item");
    const link = node("a", "video-thumb");
    link.href = `https://www.youtube.com/watch?v=${video.id}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Watch ${video.title} on YouTube`);
    const image = node("img");
    image.src = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
    image.alt = `Thumbnail for ${video.title}`;
    image.loading = "lazy";
    image.width = 480;
    image.height = 360;
    link.append(image);

    const heading = node("div", "video-item-heading");
    heading.append(node("h3", "", video.title));
    if (canEdit) {
      const remove = node("button", "video-remove", "remove");
      remove.type = "button";
      remove.dataset.removeVideo = video.id;
      remove.setAttribute("aria-label", `Remove ${video.title}`);
      heading.append(remove);
    }
    card.append(link, heading, progressChecks(`video-${video.id}`, "watched by"));
    videoList.append(card);
  }
}

function renderLessons() {
  lessonFolders.replaceChildren();
  for (const folder of FOLDERS) {
    const section = node("section", "lesson-folder");
    const heading = node("div", "lesson-folder-heading");
    heading.append(node("h3", "", folder.name), node("code", "", folder.path));
    const list = node("div", "lesson-list");

    for (const note of state.notes.filter((item) => item.folder === folder.id)) {
      const details = node("details", "lesson-item note-item");
      details.append(node("summary", "note-summary", note.title));
      details.append(node("pre", "note-body", note.body));
      if (canEdit) {
        const actions = node("div", "note-item-actions");
        const edit = node("button", "plain-button", "edit");
        edit.type = "button";
        edit.dataset.editNote = note.id;
        edit.setAttribute("aria-label", `Edit ${note.title}`);
        const remove = node("button", "plain-button", "remove");
        remove.type = "button";
        remove.dataset.removeNote = note.id;
        remove.setAttribute("aria-label", `Remove ${note.title}`);
        actions.append(edit, remove);
        details.append(actions);
      }
      details.append(progressChecks(`note-${note.id}`, "read by"));
      list.append(details);
    }

    for (const lesson of folder.lessons) {
      const card = node("article", "lesson-item");
      card.append(node("h4", "", lesson.title), node("p", "", lesson.summary));
      const link = node("a", "lesson-link", "open markdown ↗");
      link.href = lesson.file;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `Open the Markdown lesson: ${lesson.title}`);
      card.append(link, progressChecks(`lesson-${lesson.id}`, "read by"));
      list.append(card);
    }
    section.append(heading, list);
    lessonFolders.append(section);
  }
}

function renderTasks() {
  for (const column of COLUMNS) {
    const list = taskColumns.querySelector(`[data-kanban-column="${column.id}"]`);
    const tasks = state.tasks.filter((task) => task.status === column.id);
    document.querySelector(`#count-${column.id}`).textContent = String(tasks.length);
    list.replaceChildren();
    if (!tasks.length) {
      list.append(node("p", "empty-column", "nothing here yet."));
      continue;
    }
    for (const task of tasks) {
      const card = node("article", `kanban-task assignee-${task.assignee}`);
      card.append(node("p", "kanban-task-title", task.title));
      if (canEdit) {
        const controls = node("div", "kanban-task-controls");
        const assignee = node("select", "task-control task-assignee");
        assignee.dataset.taskAssignee = task.id;
        assignee.dataset.assignee = task.assignee;
        assignee.setAttribute("aria-label", `Assignee for ${task.title}`);
        for (const person of PEOPLE) {
          const option = node("option", "", person);
          option.value = person;
          assignee.append(option);
        }
        assignee.value = task.assignee;
        const statusSelect = node("select", "task-control task-status");
        statusSelect.dataset.taskStatus = task.id;
        statusSelect.setAttribute("aria-label", `Column for ${task.title}`);
        for (const status of COLUMNS) {
          const option = node("option", "", status.name);
          option.value = status.id;
          statusSelect.append(option);
        }
        statusSelect.value = task.status;
        const remove = node("button", "task-remove", "remove");
        remove.type = "button";
        remove.dataset.removeTask = task.id;
        remove.setAttribute("aria-label", `Remove task: ${task.title}`);
        controls.append(assignee, statusSelect, remove);
        card.append(controls);
      } else {
        card.append(node("span", "task-owner", task.assignee));
      }
      list.append(card);
    }
  }
}

function renderAll() {
  renderVideos();
  renderLessons();
  renderTasks();
}

async function loadAll() {
  const [videos, notes, tasks, checks] = await Promise.all([
    db.from("myre_videos").select("id,title,created_at").order("created_at", { ascending: false }),
    db.from("myre_notes").select("id,folder,title,body,created_at").order("created_at", { ascending: false }),
    db.from("myre_tasks").select("id,title,assignee,status,created_at").order("created_at", { ascending: false }),
    db.from("myre_checks").select("item_key,person_id,checked"),
  ]);
  const error = [videos, notes, tasks, checks].find((result) => result.error)?.error;
  if (error) throw error;
  state.videos = videos.data;
  state.notes = notes.data;
  state.tasks = tasks.data;
  state.checks = checks.data;
  renderAll();
}

async function save(query, message) {
  const { error } = await query;
  if (error) throw error;
  await loadAll();
  announce(message);
}

function report(error) {
  announce(`Couldn't save that change. ${error.message || "Please try again."}`);
}

function setAccess(session) {
  signInForm.hidden = Boolean(session);
  signedIn.hidden = !session;
  signedInEmail.textContent = session?.user?.email || "";
  learningContent.hidden = !canEdit;
  document.querySelector("#refresh-button").disabled = !canEdit;
  accessCopy.textContent = canEdit
    ? "Shared changes save for the whole crew."
    : session
      ? "This email isn't on the crew list."
      : "Crew members can sign in to see and edit studies.";
  showEditorControls();
}

async function refreshAccess() {
  const { data: { session }, error } = await db.auth.getSession();
  if (error) throw error;
  canEdit = false;
  if (session) {
    const result = await db.rpc("myre_can_edit");
    if (result.error) throw result.error;
    canEdit = result.data === true;
  }
  setAccess(session);
  if (canEdit) await loadAll();
  else {
    state.videos = [];
    state.notes = [];
    state.tasks = [];
    state.checks = [];
    renderAll();
  }
}

signInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!db || !signInForm.reportValidity()) return;
  const email = document.querySelector("#editor-email").value.trim().toLowerCase();
  const button = signInForm.querySelector("button");
  button.disabled = true;
  try {
    const redirect = window.location.protocol === "https:" || window.location.protocol === "http:"
      ? { emailRedirectTo: new URL("learning.html", window.location.href).href }
      : {};
    const { error } = await db.auth.signInWithOtp({ email, options: redirect });
    if (error) throw error;
    announce(`Check ${email} for a sign-in link.`);
  } catch (error) {
    report(error);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#sign-out-button").addEventListener("click", async () => {
  if (!db) return;
  const { error } = await db.auth.signOut();
  if (error) return report(error);
  await refreshAccess();
  announce("Signed out.");
});

document.querySelector("#refresh-button").addEventListener("click", async () => {
  if (!db || !canEdit) return;
  try {
    await loadAll();
    announce("Board refreshed.");
  } catch (error) { report(error); }
});

document.addEventListener("visibilitychange", () => {
  if (db && canEdit && !document.hidden) loadAll().catch(report);
});

videoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  videoUrl.removeAttribute("aria-invalid");
  videoError.hidden = true;
  if (!canEdit || !videoUrl.reportValidity()) return;
  const video = getVideo(videoUrl.value);
  if (!video || state.videos.some((item) => item.id === video.id)) {
    videoUrl.setAttribute("aria-invalid", "true");
    videoError.textContent = video ? "That video is already pinned." : "Paste a youtube.com or youtu.be video link.";
    videoError.hidden = false;
    videoUrl.focus();
    return;
  }
  const title = videoTitle.value.trim().slice(0, 100) || "YouTube video";
  try {
    await save(db.from("myre_videos").insert({ id: video.id, title }), `Pinned ${title}.`);
    videoForm.reset();
    videoUrl.focus();
  } catch (error) { report(error); }
});

videoUrl.addEventListener("input", () => {
  videoUrl.removeAttribute("aria-invalid");
  videoError.hidden = true;
});

videoList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-video]");
  if (!button || !canEdit) return;
  const video = state.videos.find((item) => item.id === button.dataset.removeVideo);
  if (!video || !window.confirm(`Remove ${video.title}?`)) return;
  try {
    await save(db.from("myre_videos").delete().eq("id", video.id), `Removed ${video.title}.`);
  } catch (error) { report(error); }
});

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canEdit || !noteForm.reportValidity()) return;
  const values = {
    folder: noteFolder.value,
    title: noteTitle.value.trim().slice(0, 120),
    body: noteBody.value.trim().slice(0, 20000),
  };
  if (!values.title || !values.body) return;
  try {
    const query = editingNoteId
      ? db.from("myre_notes").update(values).eq("id", editingNoteId)
      : db.from("myre_notes").insert(values);
    await save(query, editingNoteId ? `Updated ${values.title}.` : `Saved ${values.title}.`);
    noteForm.reset();
    editingNoteId = null;
    noteCancel.hidden = true;
    noteSave.textContent = "save note";
    noteTitle.focus();
  } catch (error) { report(error); }
});

noteCancel.addEventListener("click", () => {
  editingNoteId = null;
  noteForm.reset();
  noteCancel.hidden = true;
  noteSave.textContent = "save note";
  noteTitle.focus();
});

lessonFolders.addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit-note]");
  const remove = event.target.closest("[data-remove-note]");
  if (!canEdit || (!edit && !remove)) return;
  const note = state.notes.find((item) => item.id === (edit?.dataset.editNote || remove?.dataset.removeNote));
  if (!note) return;
  if (edit) {
    editingNoteId = note.id;
    noteTitle.value = note.title;
    noteFolder.value = note.folder;
    noteBody.value = note.body;
    noteSave.textContent = "update note";
    noteCancel.hidden = false;
    noteForm.scrollIntoView({ block: "start", behavior: "smooth" });
    noteTitle.focus();
    return;
  }
  if (!window.confirm(`Remove ${note.title}?`)) return;
  try {
    await save(db.from("myre_notes").delete().eq("id", note.id), `Removed ${note.title}.`);
  } catch (error) { report(error); }
});

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canEdit || !taskForm.reportValidity()) return;
  const title = taskTitle.value.trim().slice(0, 120);
  if (!title) return;
  try {
    await save(db.from("myre_tasks").insert({ title, assignee: taskAssignee.value, status: "todo" }), `Added ${title}.`);
    taskForm.reset();
    taskTitle.focus();
  } catch (error) { report(error); }
});

taskColumns.addEventListener("change", async (event) => {
  const input = event.target;
  const id = input.dataset.taskAssignee || input.dataset.taskStatus;
  if (!id || !canEdit) return;
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  const field = input.dataset.taskAssignee ? "assignee" : "status";
  try {
    await save(db.from("myre_tasks").update({ [field]: input.value }).eq("id", id), `Updated ${task.title}.`);
  } catch (error) {
    renderTasks();
    report(error);
  }
});

taskColumns.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-task]");
  if (!button || !canEdit) return;
  const task = state.tasks.find((item) => item.id === button.dataset.removeTask);
  if (!task || !window.confirm(`Remove ${task.title}?`)) return;
  try {
    await save(db.from("myre_tasks").delete().eq("id", task.id), `Removed ${task.title}.`);
  } catch (error) { report(error); }
});

document.querySelector("#learning-content").addEventListener("change", async (event) => {
  const input = event.target;
  if (!input.matches("input[data-progress-key]") || !canEdit) return;
  const { progressKey, personId } = input.dataset;
  input.disabled = true;
  try {
    await save(
      db.from("myre_checks").upsert(
        { item_key: progressKey, person_id: personId, checked: input.checked },
        { onConflict: "item_key,person_id" },
      ),
      `Saved ${personId}'s progress.`,
    );
  } catch (error) {
    input.disabled = false;
    input.checked = !input.checked;
    report(error);
  }
});

async function start() {
  renderAll();
  if (!config.url || !config.publishableKey || !window.supabase?.createClient) {
    accessCopy.textContent = "Shared editing is being set up. The starter lessons are still here.";
    announce("No shared database is connected yet.");
    return;
  }
  db = window.supabase.createClient(config.url, config.publishableKey);
  try {
    await refreshAccess();
    announce(canEdit ? "Shared board is ready." : "Sign in to open studies.");
    db.auth.onAuthStateChange(() => {
      window.setTimeout(() => refreshAccess().catch(report), 0);
    });
  } catch (error) {
    accessCopy.textContent = "The shared board could not load.";
    report(error);
  }
}

start();
