import { createRoot } from "react-dom/client";
import App from "./App-ultra-minimal";

try {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    createRoot(rootElement).render(<App />);
    console.log("React приложение загружено успешно!");
  } else {
    console.error("Элемент root не найден!");
  }
} catch (error) {
  console.error("Ошибка загрузки React:", error);
}
