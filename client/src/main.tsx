import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Инициализируем браузерный логгер для контроля логов в зависимости от окружения
import "./utils/logger";

createRoot(document.getElementById("root")!).render(<App />);
