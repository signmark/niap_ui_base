import { createRoot } from "react-dom/client";
import App from "./App-minimal";
import "./index.css";

// Временно отключен logger для диагностики
// import "./utils/logger";

createRoot(document.getElementById("root")!).render(<App />);
