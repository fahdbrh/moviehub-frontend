const mongoose = require("mongoose");

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const movieSchema = new mongoose.Schema(
  {
    title: {
  type: String,
  required: true,
  trim: true,
  minlength: 1,
  maxlength: 200,
  unique: true
},

slug: {
  type: String,
  unique: true,
  trim: true
},

    description: {
      type: String,
      required: true,
      trim: true
    },

    cast: {
      type: String,
      default: "",
      trim: true
    },

    poster: {
      type: String,
      default: "",
      trim: true
    },

    backdrop: {
      type: String,
      default: "",
      trim: true
    },

    video: {
  type: String,
  required: true,
  trim: true
},
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 10
    },

    category: {
      type: String,
      default: "Uncategorized",
      trim: true
    },

    genres: [
  {
    type: String,
    trim: true
  }
],

   year: {
  type: Number,
  min: 1888,
  max: 2100
},

    duration: {
  type: Number,
  min: 1
},

    quality: {
      type: String,
      default: "HD",
      enum: ["HD", "Full HD", "4K"]
    },

    views: {
      type: Number,
      default: 0,
      min: 0
    },

    featured: {
      type: Boolean,
      default: false
    },

    status: {
  type: String,
  enum: ["draft", "published"],
  default: "published"
}

  },
  {
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform: function (doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
}
);

movieSchema.index({ title: "text" });
movieSchema.index({ category: 1 });
movieSchema.index({ rating: -1 });
movieSchema.index({ views: -1 });
movieSchema.index({ featured: 1, createdAt: -1 });
movieSchema.index({ category: 1, rating: -1 });
movieSchema.index({ status: 1, createdAt: -1 });
movieSchema.index({ genres: 1 });
movieSchema.index({ slug: 1 }, { unique: true });

movieSchema.pre("save", function (next) {
  if (this.isModified("title") || !this.slug) {
    this.slug = slugify(this.title);
  }
  next();
});
module.exports = mongoose.model("Movie", movieSchema);