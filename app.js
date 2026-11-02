const fingers = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
const shapes = [
  { id: "almond", name: "Almond", caption: "SOFT ALMOND" },
  { id: "coffin", name: "Coffin", caption: "MODERN COFFIN" },
  { id: "square", name: "Square", caption: "CLASSIC SQUARE" },
  { id: "oval", name: "Oval", caption: "SOFT OVAL" },
  { id: "stiletto", name: "Stiletto", caption: "BOLD STILETTO" },
];

const state = {
  selectedFinger: 3,
  shape: "almond",
  fingerDesigns: fingers.map(() => null),
  photoPositions: fingers.map(() => ({ x: 50, y: 50 })),
  uploads: [],
  undoStack: [],
  saved: false,
};

const fingerPicker = document.querySelector("#fingerPicker");
const designGrid = document.querySelector("#designGrid");
const shapeOptions = document.querySelector("#shapeOptions");
const nailDisplay = document.querySelector("#nailDisplay");
const toast = document.querySelector("#toast");
let toastTimeout;

function updateUndoButton() {
  document.querySelector("#undoButton").disabled = state.undoStack.length === 0;
}

function recordUndo(extra = {}) {
  state.undoStack.push({
    selectedFinger: state.selectedFinger,
    shape: state.shape,
    fingerDesigns: [...state.fingerDesigns],
    photoPositions: state.photoPositions.map((position) => ({ ...position })),
    ...extra,
  });
  if (state.undoStack.length > 30) state.undoStack.shift();
  updateUndoButton();
}

async function undoLastChange() {
  const previous = state.undoStack.pop();
  if (!previous) return;
  if (previous.deletedUpload) {
    try {
      await writeStudioRecord("uploads", previous.deletedUpload);
      state.uploads.push(previous.deletedUpload);
    } catch (error) {
      state.undoStack.push(previous);
      updateUndoButton();
      console.error("Could not restore a deleted Stylish Tipzz photo.", error);
      showToast("That photo couldn’t be restored. Please try undo again.");
      return;
    }
  }
  state.selectedFinger = previous.selectedFinger;
  state.shape = previous.shape;
  state.fingerDesigns = previous.fingerDesigns;
  state.photoPositions = previous.photoPositions;
  state.saved = false;
  render();
  updateUndoButton();
  saveStudioPreferences();
  showToast("Your last nail change was undone.");
}

function openStudioDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This browser does not support saved photo storage."));
      return;
    }

    const request = indexedDB.open("stylish-tipzz-studio", 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("uploads")) database.createObjectStore("uploads", { keyPath: "id" });
      if (!database.objectStoreNames.contains("preferences")) database.createObjectStore("preferences", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("The photo library could not be opened."));
  });
}

async function readStudioRecords(storeName) {
  const database = await openStudioDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    let records = [];
    request.onsuccess = () => { records = request.result; };
    transaction.oncomplete = () => {
      database.close();
      resolve(records);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || request.error || new Error("Saved studio data could not be read."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Reading saved studio data was interrupted."));
    };
  });
}

async function readStudioRecord(storeName, key) {
  const database = await openStudioDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    transaction.oncomplete = () => {
      database.close();
      resolve(request.result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || request.error || new Error("Saved studio settings could not be read."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Reading saved studio settings was interrupted."));
    };
  });
}

async function writeStudioRecord(storeName, record) {
  const database = await openStudioDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(record);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("The studio couldn't save this change."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Saving the studio change was interrupted."));
    };
  });
}

async function deleteStudioRecord(storeName, key) {
  const database = await openStudioDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("The photo couldn’t be removed from this device."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Removing the photo was interrupted."));
    };
  });
}

async function saveStudioPreferences() {
  try {
    await writeStudioRecord("preferences", {
      id: "current",
      fingerDesigns: state.fingerDesigns,
      photoPositions: state.photoPositions,
      shape: state.shape,
    });
  } catch (error) {
    console.error("Could not save Stylish Tipzz preferences.", error);
    showToast("Your set couldn’t be saved on this device.");
  }
}

async function restoreStudio() {
  const [uploads, preferences] = await Promise.all([
    readStudioRecords("uploads"),
    readStudioRecord("preferences", "current"),
  ]);
  state.uploads = uploads;
  if (preferences) {
    const availableIds = new Set(uploads.map((design) => design.id));
    if (Array.isArray(preferences.fingerDesigns) && preferences.fingerDesigns.length === fingers.length) {
      state.fingerDesigns = preferences.fingerDesigns.map((id) => availableIds.has(id) ? id : null);
    }
    if (Array.isArray(preferences.photoPositions) && preferences.photoPositions.length === fingers.length) {
      state.photoPositions = preferences.photoPositions.map((position) => ({
        x: Number.isFinite(position?.x) ? Math.min(100, Math.max(0, position.x)) : 50,
        y: Number.isFinite(position?.y) ? Math.min(100, Math.max(0, position.y)) : 50,
      }));
    }
    if (shapes.some((shape) => shape.id === preferences.shape)) state.shape = preferences.shape;
  }
  render();
}

function getDesign(id) {
  return state.uploads.find((design) => design.id === id);
}

function renderFingerPicker() {
  fingerPicker.innerHTML = fingers.map((name, index) => {
    const design = getDesign(state.fingerDesigns[index]);
    const selected = state.selectedFinger === index;
    return `<button class="picker-item${selected ? " selected" : ""}" data-finger="${index}" data-photo="${design?.id || ""}" aria-pressed="${selected}" aria-label="${name} finger, ${design?.name || "no photo selected"}">
      <span class="picker-nail">${design?.image ? `<img class="picker-photo" src="${design.image}" alt="" />` : '<span class="picker-empty" aria-hidden="true">+</span>'}</span><span class="picker-name">${name}</span>
    </button>`;
  }).join("");
}

function renderDesignGrid() {
  document.querySelector("#emptyPhotos").hidden = state.uploads.length > 0;
  designGrid.hidden = state.uploads.length === 0;
  designGrid.innerHTML = state.uploads.map((design) => {
    const applied = state.fingerDesigns[state.selectedFinger] === design.id;
    return `<div class="design-card photo-card${applied ? " applied" : ""}">
      <button class="design-select" type="button" data-design="${design.id}" aria-pressed="${applied}" aria-label="Apply ${escapeHtml(design.name)} to ${fingers[state.selectedFinger].toLowerCase()} nail">
        ${applied ? '<span class="applied-check">✓</span>' : ""}<img class="swatch uploaded" src="${design.image}" alt="" loading="lazy" />
        <span class="design-name">${escapeHtml(design.name)}</span>
      </button><button class="delete-photo-button" type="button" data-delete-design="${design.id}" aria-label="Delete ${escapeHtml(design.name)} photo" title="Delete photo">×</button>
    </div>`;
  }).join("");
}

function renderShapes() {
  shapeOptions.innerHTML = shapes.map((shape) => `<button class="shape-option${state.shape === shape.id ? " selected" : ""}" data-shape="${shape.id}" aria-pressed="${state.shape === shape.id}">
    <span class="shape-sample ${shape.id}"></span>${shape.name}
  </button>`).join("");
  nailDisplay.className = `nail-display shape-${state.shape}`;
  document.querySelector("#shapeCaption").textContent = shapes.find((shape) => shape.id === state.shape).caption;
}

function renderPhotoAlignment() {
  const design = getDesign(state.fingerDesigns[state.selectedFinger]);
  const position = state.photoPositions[state.selectedFinger];
  const controls = document.querySelector("#photoAlignment");
  controls.hidden = !design?.image;
  if (design?.image) {
    const photo = nailDisplay.querySelector(`.display-nail[data-finger="${state.selectedFinger}"] .nail-photo`);
    controls.querySelector(".alignment-copy span").textContent = photo.title
      ? `${fingers[state.selectedFinger]} · ${photo.title}`
      : `${fingers[state.selectedFinger]} · scanning and fitting photo`;
    controls.querySelector(".alignment-reset").disabled = position.x === 50 && position.y === 50;
  }
}

function renderNails() {
  nailDisplay.querySelectorAll(".display-nail").forEach((nailButton) => {
    const index = Number(nailButton.dataset.finger);
    const designId = state.fingerDesigns[index];
    const design = getDesign(designId);
    nailButton.dataset.photo = designId || "";
    nailButton.classList.toggle("active-nail", state.selectedFinger === index);
    const nail = nailButton.querySelector(".nail");
    const photo = nail.querySelector(".nail-photo");
    const hasPhoto = Boolean(design?.image);
    photo.hidden = !hasPhoto;
    nail.classList.toggle("has-photo", hasPhoto);
    if (hasPhoto) {
      if (photo.dataset.source !== design.image) {
        photo.src = design.image;
        photo.dataset.source = design.image;
        photo.addEventListener("load", () => fitPhotoToNail(photo), { once: true });
        if (photo.complete && photo.naturalWidth) fitPhotoToNail(photo);
      }
      photo.style.objectPosition = `${state.photoPositions[index].x}% ${state.photoPositions[index].y}%`;
    } else {
      photo.removeAttribute("src");
      delete photo.dataset.source;
      photo.removeAttribute("title");
      nail.classList.remove("photo-fit-whole", "photo-low-resolution");
      nail.style.removeProperty("background-image");
      nail.style.removeProperty("background-color");
    }
    nailButton.setAttribute("aria-label", `${fingers[index]} nail: ${design?.name || "no photo"}`);
  });
}

function fitPhotoToNail(photo) {
  const nail = photo.parentElement;
  const isLowResolution = photo.naturalWidth < nail.clientWidth * 2 || photo.naturalHeight < nail.clientHeight * 2;
  photo.style.objectFit = "cover";
  nail.classList.remove("photo-fit-whole");
  nail.classList.toggle("photo-low-resolution", isLowResolution);
  nail.style.removeProperty("background-image");
  nail.style.removeProperty("background-color");
  photo.title = `${photo.naturalWidth} × ${photo.naturalHeight}px · ${isLowResolution ? "small image enlarged to fill the nail" : "image fitted to fill the nail"}`;
  const nailIndex = Number(nail.closest(".display-nail").dataset.finger);
  if (state.selectedFinger === nailIndex) {
    document.querySelector("#photoAlignment .alignment-copy span").textContent = `${fingers[nailIndex]} · ${photo.title}`;
  }
}

function render() {
  renderFingerPicker();
  renderDesignGrid();
  renderShapes();
  renderNails();
  renderPhotoAlignment();
  document.querySelector("#selectedNoteText").textContent = `${fingers[state.selectedFinger]} finger selected`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2600);
}

fingerPicker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-finger]");
  if (!button) return;
  state.selectedFinger = Number(button.dataset.finger);
  render();
});

nailDisplay.addEventListener("click", (event) => {
  const nailButton = event.target.closest(".display-nail");
  if (!nailButton) return;
  state.selectedFinger = Number(nailButton.dataset.finger);
  render();
});

designGrid.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-design]");
  if (deleteButton) {
    removeUploadedPhoto(deleteButton.dataset.deleteDesign);
    return;
  }
  const button = event.target.closest(".design-select");
  if (!button) return;
  const photo = state.uploads.find((upload) => upload.id === button.dataset.design);
  if (!photo) return;
  recordUndo();
  state.fingerDesigns[state.selectedFinger] = photo.id;
  state.photoPositions[state.selectedFinger] = { x: 50, y: 50 };
  state.saved = false;
  render();
  saveStudioPreferences();
});

async function removeUploadedPhoto(id) {
  const photo = state.uploads.find((upload) => upload.id === id);
  if (!photo) return;
  try {
    await deleteStudioRecord("uploads", id);
  } catch (error) {
    console.error("Could not delete the Stylish Tipzz photo.", error);
    showToast("This photo couldn’t be deleted. Please try again.");
    return;
  }
  recordUndo({ deletedUpload: photo });
  state.uploads = state.uploads.filter((upload) => upload.id !== id);
  state.fingerDesigns = state.fingerDesigns.map((designId, index) => {
    if (designId !== id) return designId;
    state.photoPositions[index] = { x: 50, y: 50 };
    return null;
  });
  state.saved = false;
  render();
  await saveStudioPreferences();
  showToast("Photo deleted from your library.");
}

document.querySelector("#photoAlignment").addEventListener("click", (event) => {
  const button = event.target.closest("[data-shift]");
  if (!button) return;
  const position = state.photoPositions[state.selectedFinger];
  const shifts = {
    left: { x: -10, y: 0 },
    right: { x: 10, y: 0 },
    up: { x: 0, y: -10 },
    down: { x: 0, y: 10 },
  };
  if (button.dataset.shift !== "center" && !shifts[button.dataset.shift]) return;
  if (button.dataset.shift === "center" && position.x === 50 && position.y === 50) return;
  recordUndo();
  if (button.dataset.shift === "center") {
    state.photoPositions[state.selectedFinger] = { x: 50, y: 50 };
  } else {
    const shift = shifts[button.dataset.shift];
    state.photoPositions[state.selectedFinger] = {
      x: Math.min(100, Math.max(0, position.x + shift.x)),
      y: Math.min(100, Math.max(0, position.y + shift.y)),
    };
  }
  render();
  saveStudioPreferences();
});

shapeOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-shape]");
  if (!button) return;
  if (state.shape === button.dataset.shape) return;
  recordUndo();
  state.shape = button.dataset.shape;
  renderShapes();
  saveStudioPreferences();
});

document.querySelector("#themeToggle").addEventListener("click", (event) => {
  const isDark = document.body.classList.toggle("dark");
  event.currentTarget.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  event.currentTarget.querySelector(".theme-icon").textContent = isDark ? "☀" : "☾";
});

let deferredInstallPrompt;
const installButton = document.querySelector("#installButton");

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
  showToast("Stylish Tipzz is installed and ready!");
});

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Could not register the Stylish Tipzz offline app.", error);
    });
  });
}

function openPhotoPicker() {
  document.querySelector("#photoInput").click();
}

document.querySelector("#uploadButton").addEventListener("click", openPhotoPicker);
document.querySelector("#photoHintButton").addEventListener("click", openPhotoPicker);
document.querySelector("#photoInput").addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  const added = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      showToast(`${file.name} isn’t an image file.`);
      continue;
    }
    try {
      const image = await readPhoto(file);
      const id = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const design = { id, name: file.name.replace(/\.[^.]+$/, "") || "Your photo", image };
      await writeStudioRecord("uploads", design);
      state.uploads.push(design);
      added.push(design);
    } catch (error) {
      console.error(`Could not add ${file.name} to the Stylish Tipzz photo library.`, error);
      showToast(`${file.name} couldn’t be saved. Try a smaller image or another photo.`);
    }
  }
  if (added.length) {
    recordUndo();
    const nailsToFill = Math.min(added.length, fingers.length);
    for (let offset = 0; offset < nailsToFill; offset += 1) {
      const fingerIndex = (state.selectedFinger + offset) % fingers.length;
      state.fingerDesigns[fingerIndex] = added[offset].id;
      state.photoPositions[fingerIndex] = { x: 50, y: 50 };
    }
    render();
    await saveStudioPreferences();
    const assigned = Math.min(added.length, fingers.length);
    showToast(added.length > assigned
      ? `${added.length} photos saved; the first ${assigned} were fitted to your nails.`
      : `${added.length} photo${added.length === 1 ? "" : "s"} fitted to your nail${added.length === 1 ? "" : "s"}.`);
  }
  event.target.value = "";
});

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error("The selected photo could not be read."));
        return;
      }
      resolve(reader.result);
    }, { once: true });
    reader.addEventListener("error", () => reject(reader.error || new Error("The selected photo could not be read.")), { once: true });
    reader.readAsDataURL(file);
  });
}

document.querySelector("#resetButton").addEventListener("click", () => {
  recordUndo();
  state.fingerDesigns = fingers.map(() => null);
  state.photoPositions = fingers.map(() => ({ x: 50, y: 50 }));
  state.shape = "almond";
  state.selectedFinger = 3;
  state.saved = false;
  render();
  saveStudioPreferences();
  showToast("Your nails are ready for new photos.");
});

document.querySelector("#shuffleButton").addEventListener("click", () => {
  if (state.uploads.length === 0) {
    showToast("Upload a photo first to mix your own designs.");
    return;
  }
  const options = state.uploads.map((photo) => photo.id);
  recordUndo();
  state.fingerDesigns = fingers.map(() => options[Math.floor(Math.random() * options.length)]);
  state.photoPositions = fingers.map(() => ({ x: 50, y: 50 }));
  state.saved = false;
  render();
  saveStudioPreferences();
  showToast("Your uploaded photos have been mixed across the hand.");
});

document.querySelector("#saveButton").addEventListener("click", () => {
  state.saved = true;
  showToast("Saved! Your set is waiting in your studio.");
});

document.querySelector("#undoButton").addEventListener("click", undoLastChange);

document.querySelector("#backButton").addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    showToast("There isn’t a previous page to go back to.");
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.target.closest("input, textarea, select, [contenteditable='true']")) {
    event.preventDefault();
    undoLastChange();
  }
});

document.querySelector("#shareButton").addEventListener("click", async () => {
  const summary = `My nail set: ${state.fingerDesigns.map((id, index) => `${fingers[index]} — ${getDesign(id)?.name || "no photo"}`).join(", ")} (${state.shape})`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "My Stylish Tipzz set", text: summary });
    } catch (error) {
      if (error.name !== "AbortError") showToast("Your set couldn’t be shared right now.");
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(summary);
    showToast("Your set details are copied to your clipboard!");
  } catch {
    showToast("Sharing isn’t available in this browser.");
  }
});

document.querySelector("#expandButton").addEventListener("click", () => {
  const stage = document.querySelector(".preview-stage");
  if (!document.fullscreenElement && stage.requestFullscreen) {
    stage.requestFullscreen().catch(() => showToast("Full-screen preview isn’t available here."));
  } else if (document.fullscreenElement) {
    document.exitFullscreen();
  }
});

render();
updateUndoButton();
restoreStudio().catch((error) => {
  console.error("Could not restore the Stylish Tipzz studio.", error);
  showToast("Saved photos couldn’t be restored. You can still add them again.");
});
