// Injects PWA tags into the Expo-generated dist/index.html
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "../dist/index.html");

let html = fs.readFileSync(htmlPath, "utf8");

const headTags = `
  <meta name="theme-color" content="#0D0D10">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Docchi">
  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="/icon-192.png">`.trim();

const swScript = `
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js');
      });
    }
  </script>`.trim();

// Inject into <head>
html = html.replace("</head>", `${headTags}\n</head>`);
// Inject before </body>
html = html.replace("</body>", `${swScript}\n</body>`);

fs.writeFileSync(htmlPath, html, "utf8");
console.log("PWA tags injected into dist/index.html");
