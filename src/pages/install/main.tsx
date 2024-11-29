import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import MainLayout from "../components/layout/MainLayout.tsx";
import "@arco-design/web-react/dist/css/arco.css";
import "@App/locales/locales";
import "@App/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MainLayout className="!flex-col !px-4 box-border">
      <App />
    </MainLayout>
  </React.StrictMode>
);
