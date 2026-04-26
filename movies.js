const API = "https://moviehub-production-e79e.up.railway.app";

const grid = document.getElementById("moviesGrid");
const countEl = document.getElementById("count");
const emptyEl = document.getElementById("empty");

const qInput = document.getElementById("q");
const searchSuggestions = document.getElementById("searchSuggestions");

const heroSection = document.getElementById("heroSection");
const heroPoster = document.getElementById("heroPoster");
const heroTitle = document.getElementById("heroTitle");
const heroDesc = document.getElementById("heroDesc");
const heroRating = document.getElementById("heroRating");
const heroCategory = document.getElementById("heroCategory");
const heroQuality = document.getElementById("heroQuality");
const heroWatchBtn = document.getElementById("heroWatchBtn");

let allMovies = [];
let currentCategory = "All";

let visibleCount = 21;
const INITIAL_VISIBLE = 21;
const LOAD_MORE_STEP = 9;

const FALLBACK_POSTER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="50%" fill="#777" font-size="28" font-family="Arial" text-anchor="middle">
        No Poster
      </text>
    </svg>
  `);

function safeText(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    const m = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return m[c] || c;
  });
}

function normalizePath(p) {
  return String(p || "").replace(/\\/g, "/").trim();
}

function posterUrl(p) {
  if (!p) return "";
  const s = normalizePath(p);

  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.toLowerCase().includes("fakepath")) return "";
  if (s.startsWith("/uploads/")) return API + s;
  if (s.startsWith("uploads/")) return API + "/" + s;
  if (!s.includes("/")) return API + "/uploads/" + s;
  if (s.startsWith("/")) return API + s;

  return API + "/" + s;
}

function setHero(movie) {
  if (!movie || !heroSection) return;

  const id = movie._id || movie.id;
  const title = movie.title || "Movie";
  const desc = movie.description || "No description available.";
  const image = posterUrl(movie.backdrop || movie.poster) || FALLBACK_POSTER;

  if (heroPoster) {
    heroPoster.src = image;
    heroPoster.onerror = () => {
      heroPoster.src = posterUrl(movie.poster) || FALLBACK_POSTER;
    };
  }

  if (heroTitle) heroTitle.textContent = title;
  if (heroDesc) heroDesc.textContent = desc;
  if (heroRating) heroRating.textContent = `⭐ ${Number(movie.rating || 0).toFixed(1)}`;
  if (heroCategory) heroCategory.textContent = movie.category || "Uncategorized";
  if (heroQuality) heroQuality.textContent = movie.quality || "HD";
  if (heroWatchBtn) heroWatchBtn.href = `watch.html?id=${encodeURIComponent(id)}`;
}

function cardHTML(movie) {
  const id = movie._id || movie.id;
  const title = movie.title || "Movie";
  const poster = posterUrl(movie.poster) || FALLBACK_POSTER;
  const rating = Number(movie.rating || 0).toFixed(1);
  const category = movie.category || "Uncategorized";
  const views = Number(movie.views || 0);
  const quality = movie.quality || "HD";

  return `
    <a class="card" href="watch.html?id=${encodeURIComponent(id)}" title="${safeText(title)}">
      <span class="qualityBadge">${safeText(quality)}</span>
      <span class="ratingBadge">⭐ ${rating}</span>
      <span class="viewsBadge">👁 ${views}</span>
      <span class="categoryBadge">${safeText(category)}</span>

      <div class="cardImage">
        <img
          src="${poster}"
          alt="${safeText(title)}"
          loading="lazy"
          referrerpolicy="no-referrer"
          onerror="this.onerror=null;this.src='${FALLBACK_POSTER}'"
        >
      </div>

      <div class="cardOverlay"></div>

      <div class="cardContent">
        <div class="cardTitle alwaysTitle">${safeText(title)}</div>
        <div class="cardHover">
          <div class="hoverButtons">
            <span class="playBtn">▶ Play</span>
          </div>

          <div class="hoverMeta">
            ⭐ ${rating} • ${safeText(category)}
          </div>

          <div class="hoverDesc">
            ${safeText((movie.description || "").slice(0, 80))}...
          </div>
        </div>
      </div>
    </a>
  `;
}

function renderGrid(targetEl, list = []) {
  if (!targetEl) return;
  const movies = Array.isArray(list) ? list : [];
  targetEl.innerHTML = movies.map(cardHTML).join("");
}

function renderSuggestions(list) {
  if (!searchSuggestions) return;

  const movies = Array.isArray(list) ? list.slice(0, 6) : [];

  if (!movies.length) {
    searchSuggestions.style.display = "none";
    searchSuggestions.innerHTML = "";
    return;
  }

  searchSuggestions.style.display = "block";
  searchSuggestions.innerHTML = movies.map((movie) => {
    const id = movie._id || movie.id;
    const title = movie.title || "Movie";
    const poster = posterUrl(movie.poster) || FALLBACK_POSTER;
    const category = movie.category || "Uncategorized";
    const rating = Number(movie.rating || 0).toFixed(1);

    return `
      <a class="suggestionItem" href="watch.html?id=${encodeURIComponent(id)}">
        <img
          class="suggestionPoster"
          src="${poster}"
          alt="${safeText(title)}"
          onerror="this.onerror=null;this.src='${FALLBACK_POSTER}'"
        >
        <div class="suggestionText">
          <div class="suggestionTitle">${safeText(title)}</div>
          <div class="suggestionMeta">${safeText(category)} • ⭐ ${rating}</div>
        </div>
      </a>
    `;
  }).join("");
}

function renderBrowse(list = []) {
  const movies = Array.isArray(list) ? list : [];
  const visibleMovies = movies.slice(0, visibleCount);

  renderGrid(grid, visibleMovies);

  if (emptyEl) {
    emptyEl.style.display = movies.length ? "none" : "block";
  }

  if (countEl) {
    countEl.textContent = `${visibleMovies.length} of ${movies.length} movie${movies.length === 1 ? "" : "s"}`;
  }

  const loadMoreWrap = document.getElementById("loadMoreWrap");
  const loadMoreBtn = document.getElementById("loadMoreBtn");

  if (loadMoreWrap && loadMoreBtn) {
    const hasMore = visibleCount < movies.length;
    loadMoreWrap.style.display = hasMore ? "flex" : "none";
    loadMoreBtn.disabled = !hasMore;
  }
}

function applySearch(resetVisible = false) {
  const q = String(qInput?.value || "").trim().toLowerCase();

  if (resetVisible) {
    visibleCount = INITIAL_VISIBLE;
  }

  let filtered = [...allMovies];

  if (currentCategory !== "All") {
    filtered = filtered.filter((movie) => {
      return String(movie.category || "Uncategorized").toLowerCase() === currentCategory.toLowerCase();
    });
  }

  if (q) {
    filtered = filtered.filter((movie) => {
      const title = String(movie.title || "").toLowerCase();
      const desc = String(movie.description || "").toLowerCase();
      const cast = String(movie.cast || "").toLowerCase();
      const category = String(movie.category || "").toLowerCase();

      return (
        title.includes(q) ||
        desc.includes(q) ||
        cast.includes(q) ||
        category.includes(q)
      );
    });
  }

  renderBrowse(filtered);

  if (q) {
    renderSuggestions(filtered);
  } else {
    renderSuggestions([]);
  }
}

function setupCategoryFilters() {
  const buttons = document.querySelectorAll(".catBtn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentCategory = btn.dataset.category || "All";

      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      applySearch(true);
    });
  });
}

async function loadMovies() {
  try {
    if (countEl) countEl.textContent = "Loading...";

    const res = await fetch(`${API}/api/movies`, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (countEl) countEl.textContent = data.message || `Failed (${res.status})`;
      renderBrowse([]);
      return;
    }

    allMovies = Array.isArray(data) ? data : Array.isArray(data.movies) ? data.movies : [];

    const allBtn = document.querySelector('.catBtn[data-category="All"]');
    document.querySelectorAll(".catBtn").forEach((btn) => btn.classList.remove("active"));
    if (allBtn) allBtn.classList.add("active");

    if (allMovies.length) {
      const featured = allMovies.find((m) => m.featured === true) || allMovies[0];
      setHero(featured);
    }

    visibleCount = INITIAL_VISIBLE;
    applySearch(true);
  } catch (e) {
    console.error("loadMovies error:", e);
    if (countEl) countEl.textContent = "Server error";
    renderBrowse([]);
  }
}

if (qInput) {
  qInput.addEventListener("input", () => applySearch(true));

  qInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      qInput.value = "";
      applySearch(true);
    }
  });

  qInput.addEventListener("focus", () => {
    if (qInput.value.trim()) {
      applySearch(true);
    }
  });
}

document.addEventListener("click", (e) => {
  if (!searchSuggestions) return;

  const inside = e.target.closest(".searchWrap");
  if (!inside) {
    searchSuggestions.style.display = "none";
  }
});

const loadMoreBtn = document.getElementById("loadMoreBtn");
if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", () => {
    visibleCount += LOAD_MORE_STEP;
    applySearch(false);
  });
}


document.addEventListener("click", function(e){
  const btn = e.target.closest(".playBtn");
  if(!btn) return;

  const circle = document.createElement("span");
  circle.classList.add("ripple");

  const rect = btn.getBoundingClientRect();
  circle.style.left = (e.clientX - rect.left) + "px";
  circle.style.top = (e.clientY - rect.top) + "px";

  btn.appendChild(circle);

  setTimeout(() => circle.remove(), 600);
});

setupCategoryFilters();
loadMovies();