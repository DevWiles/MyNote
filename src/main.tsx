import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Windows：加 .win 类，走不透明底 + 自绘标题栏（避免透明露桌面/原生标题栏）
if (navigator.userAgent.includes("Windows")) {
  document.documentElement.classList.add("win");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
