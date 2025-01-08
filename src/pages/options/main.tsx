import React from "react";
import ReactDOM from "react-dom/client";
import MainLayout from "../components/layout/MainLayout.tsx";
import Sider from "../components/layout/Sider.tsx";
import { Provider } from "react-redux";
import { store } from "@App/store/store.ts";
import "@arco-design/web-react/dist/css/arco.css";
import "@App/locales/locales";
import "@App/index.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <MainLayout className="!flex-row" pageName="options">
        <Sider />
      </MainLayout>
    </Provider>
  </React.StrictMode>
);
