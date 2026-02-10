import React from "react";
import { createRoot } from "react-dom/client";
import { MarkdownEditorPage } from "./pages/MarkdownEditorPage.jsx";
import "./styles.css";

document.body.dataset.page = "editor";

createRoot(document.getElementById("editor-root")).render(
  <React.StrictMode>
    <MarkdownEditorPage />
  </React.StrictMode>
);
