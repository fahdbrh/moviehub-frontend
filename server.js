const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const helmet = require("helmet");
require("dotenv").config();

const movieRoutes = require("./routes/movieRoutes");
const connectDB = require("./config/db");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

/* ------------------------- config ------------------------- */
const PORT = process.env.PORT || 5000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

/* ------------------------- folders ------------------------- */
const clientDir = path.join(__dirname, "client");
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/* ------------------------- middleware ------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        scriptSrcElem: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https://image.tmdb.org", "https:"],
        mediaSrc: ["'self'", "blob:", "data:"],
        connectSrc: ["'self'", "https://formspree.io"]      }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/uploads", express.static(uploadsDir));
app.use(express.static(clientDir));

/* ------------------------- db ------------------------- */
  

/* ------------------------- api routes ------------------------- */
app.use("/api/movies", movieRoutes);


/* ------------------------- tmdb helpers ------------------------- */
function mapTmdbGenresToCategory(genres = []) {
  if (genres.includes("Action")) return "Action";
  if (genres.includes("Comedy")) return "Comedy";
  if (genres.includes("Drama")) return "Drama";
  if (genres.includes("Horror")) return "Horror";
  if (genres.includes("Science Fiction")) return "Sci-Fi";
  if (genres.includes("Romance")) return "Romance";
  if (genres.includes("Adventure")) return "Adventure";
  if (genres.includes("Animation")) return "Animation";
  if (genres.includes("Thriller")) return "Thriller";
  return "Uncategorized";
}

async function downloadTmdbImage(imagePath, size = "w500", prefix = "tmdb") {
  if (!imagePath) throw new Error("Missing image path");

  const imageUrl = `https://image.tmdb.org/t/p/${size}${imagePath}`;
const response = await fetchWithTimeout(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const ext = path.extname(imagePath) || ".jpg";
  const fileName = `${prefix}-${Date.now()}-${crypto.randomUUID()}${ext}`;
  const filePath = path.join(uploadsDir, fileName);

  await fs.promises.writeFile(filePath, Buffer.from(buffer));
  return `/uploads/${fileName}`;
}


async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------- tmdb routes ------------------------- */
app.get("/api/tmdb/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ message: "Missing query" });
    }

    if (!TMDB_API_KEY) {
      return res.status(500).json({ message: "TMDB API key not configured" });
    }

    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
      query
    )}`;

    const response = await fetchWithTimeout(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        message: "TMDB request failed",
        tmdb: data
      });
    }

    const results = (data.results || []).slice(0, 8).map((movie) => ({
      id: movie.id,
      title: movie.title || "",
      description: movie.overview || "",
      rating: movie.vote_average || 0,
      year: movie.release_date ? movie.release_date.slice(0, 4) : "",
      poster: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : ""
    }));

    res.json(results);
  } catch (err) {
    console.error("TMDB SEARCH ERROR:", err);
    res.status(500).json({
      message: "TMDB error",
      error: String(err.message || err)
    });
  }
});

app.get("/api/tmdb/movie/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!TMDB_API_KEY) {
      return res.status(500).json({ message: "TMDB API key not configured" });
    }

    const detailsUrl = `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}`;
    const creditsUrl = `https://api.themoviedb.org/3/movie/${id}/credits?api_key=${TMDB_API_KEY}`;

    const [detailsRes, creditsRes] = await Promise.all([
  fetchWithTimeout(detailsUrl),
  fetchWithTimeout(creditsUrl)
]);

    const details = await detailsRes.json();
const credits = await creditsRes.json();

if (!detailsRes.ok) {
  return res.status(detailsRes.status).json({
    message: "TMDB details failed",
    tmdb: details
  });
}

const castNames = creditsRes.ok
  ? (credits.cast || [])
      .slice(0, 5)
      .map((person) => person.name)
      .join(", ")
  : "";

    const genres = (details.genres || []).map((g) => g.name);
    const category = mapTmdbGenresToCategory(genres);

    res.json({
      id: details.id,
      title: details.title || "",
      description: details.overview || "",
      rating: details.vote_average || 0,
      year: details.release_date ? details.release_date.slice(0, 4) : "",
      duration: details.runtime ? `${details.runtime} min` : "",
      category,
      genres,
      cast: castNames,
      posterPath: details.poster_path || "",
      backdropPath: details.backdrop_path || "",
      poster: details.poster_path
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
        : "",
      backdrop: details.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${details.backdrop_path}`
        : ""
    });
  } catch (err) {
    console.error("TMDB MOVIE ERROR:", err);
    res.status(500).json({
      message: "TMDB movie error",
      error: String(err.message || err)
    });
  }
});

app.post("/api/tmdb/download-poster", async (req, res) => {
  try {
    const { posterPath } = req.body || {};
    if (!posterPath) {
      return res.status(400).json({ message: "Missing posterPath" });
    }

    const savedPath = await downloadTmdbImage(posterPath, "w500", "tmdb-poster");
    res.json({ poster: savedPath });
  } catch (err) {
    console.error("POSTER DOWNLOAD ERROR:", err);
    res.status(500).json({
      message: "Poster download failed",
      error: String(err.message || err)
    });
  }
});

app.post("/api/tmdb/download-backdrop", async (req, res) => {
  try {
    const { backdropPath } = req.body || {};
    if (!backdropPath) {
      return res.status(400).json({ message: "Missing backdropPath" });
    }

    const savedPath = await downloadTmdbImage(
      backdropPath,
      "w780",
      "tmdb-backdrop"
    );
    res.json({ backdrop: savedPath });
  } catch (err) {
    console.error("BACKDROP DOWNLOAD ERROR:", err);
    res.status(500).json({
      message: "Backdrop download failed",
      error: String(err.message || err)
    });
  }
});



/* ------------------------- html routes ------------------------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

/* ------------------------- 404 ------------------------- */
app.use((req, res) => {
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({ message: "Not found" });
  }

  return res.status(404).send("Page not found");
});

app.use((err, req, res, next) => {
  console.error("UNHANDLED ERROR:", err);

  if (req.originalUrl.startsWith("/api/")) {
    return res.status(500).json({
      message: "Internal server error"
    });
  }

  return res.status(500).send("Internal server error");
});

/* ------------------------- start ------------------------- */

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
