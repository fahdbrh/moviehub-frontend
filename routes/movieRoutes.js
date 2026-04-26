const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const Movie = require("../models/Movie");

const router = express.Router();
const { Types } = require("mongoose");

/* ------------------------- config ------------------------- */

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  throw new Error("ADMIN_USERNAME or ADMIN_PASSWORD is not defined in environment variables");
}

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/* ------------------------- multer ------------------------- */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || "");
    const safeBase = path
      .basename(file.originalname || "file", ext)
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 50);

    cb(null, `${safeBase}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 500
  },
  fileFilter: (req, file, cb) => {

    const allowedVideo = ["video/mp4", "video/webm", "video/ogg"];
    const allowedImage = ["image/jpeg", "image/png", "image/webp"];

    if (
      file.fieldname === "video" &&
      !allowedVideo.includes(file.mimetype)
    ) {
      return cb(new Error("Invalid video format"));
    }

    if (
      file.fieldname === "poster" &&
      !allowedImage.includes(file.mimetype)
    ) {
      return cb(new Error("Invalid image format"));
    }

    cb(null, true);
  }
});
/* ------------------------- helpers ------------------------- */

function authAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.isAdmin) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

function removeLocalFile(filePath) {
  try {
    if (!filePath) return;
    if (!filePath.startsWith("/uploads/")) return;

    const absolute = path.join(__dirname, "..", filePath);
    if (fs.existsSync(absolute)) {
      fs.promises.unlink(absolute).catch(() => {});
    }
  } catch (err) {
    console.error("FILE DELETE ERROR:", err.message);
  }
}

function isValidObjectId(id) {
  return Types.ObjectId.isValid(id);
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const cleaned = String(value).replace(/[^\d.]/g, "").trim();
  if (!cleaned) {
    return undefined;
  }

  const num = Number(cleaned);
  return Number.isNaN(num) ? undefined : num;
}

/* ------------------------- auth ------------------------- */

router.post("/admin-login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const token = jwt.sign(
      {
        isAdmin: true,
        username: ADMIN_USERNAME
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
});

/* ------------------------- special list routes ------------------------- */

router.get("/featured/one", async (req, res) => {
  try {
    let movie = await Movie.findOne({ featured: true }).sort({ updatedAt: -1 });

    if (!movie) {
      movie = await Movie.findOne({}).sort({ createdAt: -1 });
    }

    if (!movie) {
      return res.status(404).json({ message: "No movies found" });
    }

    res.json(movie);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get("/", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const skip = (page - 1) * limit;

    const category = String(req.query.category || "").trim();
    const filter = {};

    if (category && category.toLowerCase() !== "all") {
      filter.category = category;
    }

    const [movies, total] = await Promise.all([
      Movie.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Movie.countDocuments(filter)
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      movies
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ------------------------- main CRUD ------------------------- */




router.post(
  "/",
  authAdmin,
  // Currently poster and video are uploaded as files; backdrop is handled as URL
  upload.fields([
    { name: "poster", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        title,
        description,
        cast,
        rating,
        category,
        year,
        duration,
        quality,
        posterUrl,
        backdropUrl
      } = req.body;

      if (!title || !description) {
        return res.status(400).json({
          message: "Title and description are required"
        });
      }

      const posterFile = req.files?.poster?.[0];
      const videoFile = req.files?.video?.[0];

      const movie = await Movie.create({
  title,
  description,
  cast: cast || "",
  rating: parseOptionalNumber(rating) ?? 0,
category: category || "Uncategorized",
year: parseOptionalNumber(year),
duration: parseOptionalNumber(duration),
  quality: quality || "HD",
  poster: posterFile ? `/uploads/${posterFile.filename}` : (posterUrl || ""),
  backdrop: backdropUrl || "",
  video: videoFile ? `/uploads/${videoFile.filename}` : "",
  views: 0,
  featured: false
});
      res.status(201).json(movie);
    } catch (err) {
      console.error("ADD MOVIE ROUTE ERROR:", err);
      const posterFile = req.files?.poster?.[0];
const videoFile = req.files?.video?.[0];

if (posterFile) {
  removeLocalFile(`/uploads/${posterFile.filename}`);
}
if (videoFile) {
  removeLocalFile(`/uploads/${videoFile.filename}`);
}
      res.status(500).json({
        message: "Failed to add movie",
        error: err.message
      });
    }
  }
);

router.put(
  "/:id",
  authAdmin,
  // Currently poster and video are uploaded as files; backdrop is handled as URL
  upload.fields([
    { name: "poster", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      if (!isValidObjectId(req.params.id)) {
  return res.status(400).json({ message: "Invalid movie id" });
}
      const {
        title,
        description,
        cast,
        rating,
        category,
        year,
        duration,
        quality,
        posterUrl,
        backdropUrl
      } = req.body;

      const movie = await Movie.findById(req.params.id);
      if (!movie) {
        return res.status(404).json({ message: "Movie not found" });
      }

      const posterFile = req.files?.poster?.[0];
      const videoFile = req.files?.video?.[0];

      if (posterFile && movie.poster) {
        removeLocalFile(movie.poster);
      }

      if (videoFile && movie.video) {
        removeLocalFile(movie.video);
      }

      movie.title = title ?? movie.title;
      movie.description = description ?? movie.description;
      movie.cast = cast ?? movie.cast;
      movie.category = category ?? movie.category;
      movie.rating = rating !== undefined && rating !== "" ? (parseOptionalNumber(rating) ?? movie.rating) : movie.rating;
movie.year = year !== undefined && year !== "" ? (parseOptionalNumber(year) ?? movie.year) : movie.year;
movie.duration = duration !== undefined && duration !== "" ? (parseOptionalNumber(duration) ?? movie.duration) : movie.duration;
      movie.quality = quality ?? movie.quality;
      movie.poster = posterFile
        ? `/uploads/${posterFile.filename}`
        : (posterUrl || movie.poster);
      movie.backdrop = backdropUrl || movie.backdrop;
      movie.video = videoFile
        ? `/uploads/${videoFile.filename}`
        : movie.video;

      await movie.save();

      res.json(movie);
    } catch (err) {
      console.error("UPDATE MOVIE ROUTE ERROR:", err);
      res.status(500).json({
        message: "Failed to update movie",
        error: err.message
      });
    }
  }
);

router.delete("/:id", authAdmin, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
  return res.status(400).json({ message: "Invalid movie id" });
}
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    if (movie.poster) removeLocalFile(movie.poster);
    if (movie.video) removeLocalFile(movie.video);
    // backdrop may be a remote URL; removeLocalFile only deletes local /uploads files
    if (movie.backdrop) removeLocalFile(movie.backdrop);

    await Movie.findByIdAndDelete(req.params.id);

    res.json({ message: "Movie deleted" });
  } catch (err) {
    console.error("DELETE MOVIE ROUTE ERROR:", err);
    res.status(500).json({
      message: "Failed to delete movie",
      error: err.message
    });
  }
});

router.put("/:id/featured", authAdmin, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid movie id" });
    }

    const existingMovie = await Movie.findById(req.params.id);
    if (!existingMovie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    await Movie.updateMany(
      { _id: { $ne: req.params.id }, featured: true },
      { featured: false }
    );

    existingMovie.featured = true;
    await existingMovie.save();

    res.json({ message: "Featured movie updated", movie: existingMovie });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id/view", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
  return res.status(400).json({ message: "Invalid movie id" });
}
    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    res.json({ views: movie.views });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



/* ------------------------- single movie route ------------------------- */
/* IMPORTANT: keep this after featured/top/trending/recent routes */

router.get("/:id/similar", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid movie id" });
    }

    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

   const movies = await Movie.aggregate([
  {
    $match: {
      category: movie.category,
      _id: { $ne: movie._id }
    }
  },
  { $sample: { size: 6 } }
]);

res.json(movies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get("/:id", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
  return res.status(400).json({ message: "Invalid movie id" });
}
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    res.json(movie);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;