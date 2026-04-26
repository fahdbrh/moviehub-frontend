const API = "http://localhost:5000";

// Load movies when page opens
document.addEventListener("DOMContentLoaded", loadMovies);

async function loadMovies() {
  try {
    const res = await fetch(`${API}/api/movies`);
    const movies = await res.json();

    const container = document.getElementById("movies-list");
    container.innerHTML = "";

    if (movies.length === 0) {
      container.innerHTML = "<p>No movies yet.</p>";
      return;
    }

    movies.forEach(movie => {
      const div = document.createElement("div");
      div.style.border = "1px solid #ccc";
      div.style.padding = "10px";
      div.style.marginBottom = "10px";

      div.innerHTML = `
        <h3>${movie.title}</h3>
        <p>${movie.description}</p>
        ${
          movie.poster
            ? `<img src="http://localhost:5000${movie.poster}" width="150" />`
            : ""
        }
        ${
          movie.video
            ? `<br><a href="http://localhost:5000${movie.video}" target="_blank">▶ Watch video</a>`
            : ""
        }
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error("Error loading movies:", err);
  }
}