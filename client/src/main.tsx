import { createRoot } from "react-dom/client";
import App from "./App-minimal";

// Убираем CSS пока - может быть причиной проблемы
// import "./index.css";

// Временно отключен logger для диагностики
// import "./utils/logger";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
} else {
  console.error("Элемент root не найден!");
}
