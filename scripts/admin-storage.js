// ============================================================
// admin-storage.js — cover image upload & preview
// Depends on: admin-utils.js
// Exposes: coverImageUrl, coverImagePath, setupCoverUpload,
//          renderCoverPreview, resetCoverImage
// ============================================================

const BUCKET        = "recipe-images";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

let coverImageUrl  = null;
let coverImagePath = null;

function resetCoverImage() {
  coverImageUrl  = null;
  coverImagePath = null;
  $("coverPreview").innerHTML = "";
  $("coverProgress").textContent = "";
}

// Resize and compress any image to max 1200px, JPEG at 72% quality.
// Uses FileReader instead of blob: URLs to avoid CSP issues in Firefox.
function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1200;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height / width) * MAX_DIM);
            width  = MAX_DIM;
          } else {
            width  = Math.round((width / height) * MAX_DIM);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(new File([blob], "cover.jpg", { type: "image/jpeg" })),
          "image/jpeg",
          0.72
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleCoverFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    flash($("editorFlash"), "Ógilt skráarsnið. Notaðu JPEG, PNG, WebP eða GIF."); return;
  }
  if (coverImagePath) {
    await sb.storage.from(BUCKET).remove([coverImagePath]);
    coverImagePath = null;
  }
  $("coverProgress").textContent = "Minnkar mynd...";
  const resized = await resizeImage(file);
  await uploadCover(resized);
}

async function uploadCover(file) {
  const progress = $("coverProgress");
  progress.textContent = "Hleð upp...";

  const ext  = file.name.split(".").pop().toLowerCase();
  const base = editingId || slugify($("fTitle").value.trim()) || "new";
  const path = `${base}/cover-${Date.now()}.${ext}`;

  const { data, error } = await sb.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    progress.textContent = "";
    flash($("editorFlash"), "Upphlöðun mistókst: " + error.message);
    return;
  }

  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(data.path);
  coverImageUrl  = publicUrl;
  coverImagePath = data.path;
  const kb = Math.round(file.size / 1024);
  progress.textContent = `Mynd vistuð (${kb} KB)`;

  // On local dev the public URL is http://127.0.0.1 which browsers block in previews.
  // Use a data URL for the preview thumbnail instead — the stored URL is still correct.
  const previewUrl = publicUrl.includes("127.0.0.1") || publicUrl.includes("localhost")
    ? await fileToDataUrl(file)
    : publicUrl;
  renderCoverPreview(previewUrl, data.path);
}

function renderCoverPreview(url, storagePath) {
  const preview = $("coverPreview");
  preview.innerHTML = "";
  const item = document.createElement("div");
  item.className = "img-preview-item";
  const img = document.createElement("img");
  img.src = url;
  img.alt = "";
  const rm = document.createElement("button");
  rm.className = "remove-img";
  rm.textContent = "×";
  rm.setAttribute("aria-label", "Fjarlægja mynd");
  rm.addEventListener("click", async () => {
    if (storagePath) await sb.storage.from(BUCKET).remove([storagePath]);
    resetCoverImage();
  });
  item.appendChild(img);
  item.appendChild(rm);
  preview.appendChild(item);
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

function setupCoverUpload() {
  const area  = $("coverUploadArea");
  const input = $("coverFileInput");
  area.addEventListener("dragover",  e => { e.preventDefault(); area.classList.add("dragover"); });
  area.addEventListener("dragleave", () => area.classList.remove("dragover"));
  area.addEventListener("drop", e => {
    e.preventDefault();
    area.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) handleCoverFile(file);
  });
  input.addEventListener("change", () => {
    if (input.files[0]) handleCoverFile(input.files[0]);
    input.value = "";
  });
}

setupCoverUpload();