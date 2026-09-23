const PEOPLE = [
  { id: "rajin", name: "rajin" },
  { id: "samiyeel", name: "samiyeel" },
  { id: "saumik", name: "saumik" },
];

const LESSON_FOLDERS = [
  {
    name: "learn first",
    path: "learning/01-learn",
    lessons: [
      {
        id: "what-is-an-os",
        title: "what is an operating system?",
        file: "learning/01-learn/what-is-an-operating-system.md",
        summary: "A first look at the jobs an operating system does.",
      },
      {
        id: "how-a-computer-starts",
        title: "how does a computer start?",
        file: "learning/01-learn/how-a-computer-starts.md",
        summary: "Follow the hand-off from power button to desktop.",
      },
    ],
  },
  {
    name: "test small ideas",
    path: "learning/02-test",
    lessons: [
      {
        id: "first-safe-experiment",
        title: "our first safe experiment",
        file: "learning/02-test/first-safe-experiment.md",
        summary: "Change one thing, keep notes, and find out what happened.",
      },
    ],
  },
  {
    name: "make something",
    path: "learning/03-make",
    lessons: [
      {
        id: "first-small-build",
        title: "pick a tiny thing to build",
        file: "learning/03-make/first-small-build.md",
        summary: "Turn something we learned into a small working project.",
      },
    ],
  },
];

const STORAGE_KEY = "myre-learning-v1";
const TASK_COLUMNS = [
  { id: "todo", name: "up next" },
  { id: "doing", name: "in progress" },
  { id: "done", name: "done for now" },
];
const videoForm = document.querySelector("#video-form");
const videoUrlInput = document.querySelector("#video-url");
const videoTitleInput = document.querySelector("#video-title");
const videoUrlError = document.querySelector("#video-url-error");
const videoList = document.querySelector("#video-list");
const lessonFolders = document.querySelector("#lesson-folders");
const learningStatus = document.querySelector("#learning-status");
const learningHub = document.querySelector("#learning-hub");
const taskForm = document.querySelector("#task-form");
const taskTitleInput = document.querySelector("#task-title");
const taskAssigneeInput = document.querySelector("#task-assignee");
const kanbanColumns = document.querySelector(".kanban-columns");

function getYouTubeVideo(urlText) {
  try {
    const url = new URL(urlText.trim());
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    let id = "";
    if (hostname === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else id = url.pathname.split("/").filter(Boolean)[1] || "";
    }

    return /^[A-Za-z0-9_-]{11}$/.test(id)
      ? { id, url: `https://www.youtube.com/watch?v=${id}` }
      : null;
  } catch {
    return null;
  }
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const seen = new Set();
    const videos = Array.isArray(saved.videos)
      ? saved.videos.flatMap((video) => {
          if (!video || typeof video.url !== "string") return [];
          const parsed = getYouTubeVideo(video.url);
          if (!parsed || seen.has(parsed.id)) return [];
          seen.add(parsed.id);
          return [{
            ...parsed,
            title: typeof video.title === "string" && video.title.trim()
              ? video.title.trim().slice(0, 100)
              : "YouTube video",
          }];
        })
      : [];
    const knownPeople = new Set(PEOPLE.map((person) => person.id));
    const knownColumns = new Set(TASK_COLUMNS.map((column) => column.id));
    const taskIds = new Set();
    const tasks = Array.isArray(saved.tasks)
      ? saved.tasks.flatMap((task) => {
          if (!task || typeof task !== "object") return [];
          const id = typeof task.id === "string" ? task.id : "";
          const title = typeof task.title === "string" ? task.title.trim().slice(0, 120) : "";
          if (!/^[a-z0-9-]{1,100}$/.test(id) || taskIds.has(id) || !title
            || !knownPeople.has(task.assignee) || !knownColumns.has(task.status)) return [];
          taskIds.add(id);
          return [{ id, title, assignee: task.assignee, status: task.status }];
        })
      : [];
    return {
      videos,
      tasks,
      checks: saved.checks && typeof saved.checks === "object" && !Array.isArray(saved.checks)
        ? saved.checks
        : {},
    };
  } catch {
    return { videos: [], checks: {}, tasks: [] };
  }
}

const state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeProgressChecks(itemKey, legendText) {
  const fieldset = element("fieldset", "progress-checks");
  fieldset.append(element("legend", "", legendText));
  const people = element("div", "progress-people");
  const checks = state.checks[itemKey] || {};

  for (const person of PEOPLE) {
    const label = element("label", "progress-person");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `check-${itemKey}-${person.id}`;
    input.checked = checks[person.id] === true;
    input.dataset.progressKey = itemKey;
    input.dataset.personId = person.id;
    const name = element("span", "", person.name);
    label.htmlFor = input.id;
    label.append(input, name);
    people.append(label);
  }

  fieldset.append(people);
  return fieldset;
}

function renderVideos() {
  videoList.replaceChildren();

  if (!state.videos.length) {
    videoList.append(element("p", "empty-videos", "No videos pinned yet. Add the first one above."));
    return;
  }

  for (const video of state.videos) {
    const card = element("article", "video-item");
    const thumbnailLink = element("a", "video-thumb");
    thumbnailLink.href = video.url;
    thumbnailLink.target = "_blank";
    thumbnailLink.rel = "noopener noreferrer";
    thumbnailLink.setAttribute("aria-label", `Watch ${video.title} on YouTube`);

    const image = document.createElement("img");
    image.src = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
    image.alt = `Thumbnail for ${video.title}`;
    image.loading = "lazy";
    image.width = 480;
    image.height = 360;
    thumbnailLink.append(image);

    const heading = element("div", "video-item-heading");
    heading.append(element("h4", "", video.title));
    const removeButton = element("button", "video-remove", "remove");
    removeButton.type = "button";
    removeButton.dataset.removeVideo = video.id;
    removeButton.setAttribute("aria-label", `Remove ${video.title} from the YouTube pile`);
    heading.append(removeButton);

    card.append(thumbnailLink, heading, makeProgressChecks(`video-${video.id}`, "watched by"));
    videoList.append(card);
  }
}

function renderLessons() {
  lessonFolders.replaceChildren();

  for (const folder of LESSON_FOLDERS) {
    const section = element("section", "lesson-folder");
    const heading = element("div", "lesson-folder-heading");
    heading.append(element("h4", "", folder.name), element("code", "", folder.path));

    const list = element("div", "lesson-list");
    for (const lesson of folder.lessons) {
      const card = element("article", "lesson-item");
      card.append(element("h5", "", lesson.title), element("p", "", lesson.summary));
      const link = element("a", "lesson-link", "open markdown ↗");
      link.href = lesson.file;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `Open the Markdown lesson: ${lesson.title}`);
      card.append(link, makeProgressChecks(`lesson-${lesson.id}`, "read by"));
      list.append(card);
    }

    section.append(heading, list);
    lessonFolders.append(section);
  }
}

function renderKanban() {
  for (const column of TASK_COLUMNS) {
    const list = kanbanColumns.querySelector(`[data-kanban-column="${column.id}"]`);
    const tasks = state.tasks.filter((task) => task.status === column.id);
    document.querySelector(`#count-${column.id}`).textContent = String(tasks.length);
    list.replaceChildren();

    if (!tasks.length) {
      list.append(element("p", "empty-column", "nothing here yet."));
      continue;
    }

    for (const task of tasks) {
      const card = element("article", `kanban-task assignee-${task.assignee}`);
      card.dataset.assignee = task.assignee;
      card.append(element("p", "kanban-task-title", task.title));

      const controls = element("div", "kanban-task-controls");
      const assigneeLabel = element("label", "visually-hidden", `Assignee for ${task.title}`);
      const assigneeSelect = document.createElement("select");
      assigneeSelect.id = `task-assignee-${task.id}`;
      assigneeSelect.className = "task-control task-assignee";
      assigneeSelect.dataset.taskAssignee = task.id;
      assigneeSelect.setAttribute("aria-label", `Assignee for ${task.title}`);
      assigneeSelect.dataset.assignee = task.assignee;
      for (const person of PEOPLE) {
        const option = element("option", "", person.name);
        option.value = person.id;
        option.selected = person.id === task.assignee;
        assigneeSelect.append(option);
      }
      assigneeLabel.htmlFor = assigneeSelect.id;

      const statusLabel = element("label", "visually-hidden", `Status for ${task.title}`);
      const statusSelect = document.createElement("select");
      statusSelect.id = `task-status-${task.id}`;
      statusSelect.className = "task-control task-status";
      statusSelect.dataset.taskStatus = task.id;
      statusSelect.setAttribute("aria-label", `Move ${task.title} to a column`);
      for (const status of TASK_COLUMNS) {
        const option = element("option", "", status.name);
        option.value = status.id;
        option.selected = status.id === task.status;
        statusSelect.append(option);
      }
      statusLabel.htmlFor = statusSelect.id;

      const removeButton = element("button", "task-remove", "remove");
      removeButton.type = "button";
      removeButton.dataset.removeTask = task.id;
      removeButton.setAttribute("aria-label", `Remove task: ${task.title}`);
      controls.append(assigneeLabel, assigneeSelect, statusLabel, statusSelect, removeButton);
      card.append(controls);
      list.append(card);
    }
  }
}

function announce(message) {
  learningStatus.textContent = message;
}

videoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  videoUrlInput.removeAttribute("aria-invalid");
  videoUrlError.hidden = true;

  if (!videoUrlInput.checkValidity()) {
    videoUrlInput.reportValidity();
    return;
  }

  const video = getYouTubeVideo(videoUrlInput.value);
  if (!video) {
    videoUrlInput.setAttribute("aria-invalid", "true");
    videoUrlError.hidden = false;
    videoUrlInput.focus();
    return;
  }

  if (state.videos.some((saved) => saved.id === video.id)) {
    videoUrlInput.setAttribute("aria-invalid", "true");
    videoUrlError.textContent = "That video is already in the pile.";
    videoUrlError.hidden = false;
    videoUrlInput.focus();
    return;
  }

  const title = videoTitleInput.value.trim().slice(0, 100) || "YouTube video";
  state.videos.unshift({ ...video, title });
  renderVideos();
  videoForm.reset();
  announce(saveState()
    ? `Pinned ${title}. Video and progress are saved in this browser.`
    : `Pinned ${title}, but this browser couldn't save it.`);
  videoUrlInput.focus();
});

videoUrlInput.addEventListener("input", () => {
  videoUrlInput.removeAttribute("aria-invalid");
  videoUrlError.hidden = true;
  videoUrlError.textContent = "That link doesn't look like a YouTube video. Try a youtube.com or youtu.be link.";
});

videoList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-video]");
  if (!button) return;

  const id = button.dataset.removeVideo;
  const video = state.videos.find((saved) => saved.id === id);
  state.videos = state.videos.filter((saved) => saved.id !== id);
  delete state.checks[`video-${id}`];
  renderVideos();
  announce(saveState()
    ? `Removed ${video?.title || "the video"} from the pile.`
    : `Removed ${video?.title || "the video"}, but this browser couldn't save the change.`);
});

learningHub.addEventListener("change", (event) => {
  const input = event.target;
  if (input.matches("select[data-task-assignee], select[data-task-status]")) {
    const isAssignee = input.matches("[data-task-assignee]");
    const taskId = isAssignee ? input.dataset.taskAssignee : input.dataset.taskStatus;
    const task = state.tasks.find((saved) => saved.id === taskId);
    if (!task) return;

    if (isAssignee) {
      task.assignee = input.value;
    } else {
      task.status = input.value;
    }
    const focusId = isAssignee ? `task-assignee-${taskId}` : `task-status-${taskId}`;
    renderKanban();
    document.getElementById(focusId)?.focus();
    announce(saveState()
      ? `Updated ${task.title} on this browser.`
      : `Updated ${task.title}, but this browser couldn't save the change.`);
    return;
  }

  if (!input.matches("input[data-progress-key]")) return;

  const { progressKey, personId } = input.dataset;
  state.checks[progressKey] ||= {};
  state.checks[progressKey][personId] = input.checked;
  announce(saveState()
    ? `Saved ${personId}'s check on this browser.`
    : `Changed ${personId}'s check, but this browser couldn't save it.`);
});

taskTitleInput.addEventListener("input", () => taskTitleInput.setCustomValidity(""));

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = taskTitleInput.value.trim().slice(0, 120);
  if (!title) {
    taskTitleInput.setCustomValidity("Add a short task name first.");
    taskTitleInput.reportValidity();
    return;
  }

  const taskId = globalThis.crypto?.randomUUID?.()
    || `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  state.tasks.unshift({ id: taskId, title, assignee: taskAssigneeInput.value, status: "todo" });
  renderKanban();
  taskForm.reset();
  announce(saveState()
    ? `Added ${title}. The task board is saved in this browser.`
    : `Added ${title}, but this browser couldn't save the task.`);
  taskTitleInput.focus();
});

kanbanColumns.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-task]");
  if (!button) return;

  const task = state.tasks.find((saved) => saved.id === button.dataset.removeTask);
  state.tasks = state.tasks.filter((saved) => saved.id !== button.dataset.removeTask);
  renderKanban();
  announce(saveState()
    ? `Removed ${task?.title || "the task"} from the board.`
    : `Removed ${task?.title || "the task"}, but this browser couldn't save the change.`);
  taskTitleInput.focus();
});

renderVideos();
renderLessons();
renderKanban();
