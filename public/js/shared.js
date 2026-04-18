(function () {
  var saved = localStorage.getItem("symbolang-theme");
  var theme = saved || "dark";
  document.documentElement.setAttribute("data-theme", theme);

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;

    function updateIcon() {
      btn.textContent = theme === "dark" ? "☀" : "☽";
    }
    updateIcon();

    btn.addEventListener("click", function () {
      theme = theme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("symbolang-theme", theme);
      updateIcon();
    });
  });
})();
