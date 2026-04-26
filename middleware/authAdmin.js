const jwt = require("jsonwebtoken");

module.exports = function authAdmin(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized (no token)" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({ message: "Forbidden (not admin)" });
    }

    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Unauthorized (invalid token)" });
  }
};