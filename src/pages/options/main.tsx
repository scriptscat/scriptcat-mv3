import React from "react";
import ReactDOM from "react-dom/client";
import MainLayout from "../components/layout/MainLayout.tsx";
import Sider from "../components/layout/Sider.tsx";
import { Provider } from "react-redux";
import { store } from "@App/pages/store/store.ts";
import "@arco-design/web-react/dist/css/arco.css";
import "@App/locales/locales";
import "@App/index.css";
import "./index.css";
import migrate from "@App/app/migrate.ts";
import LoggerCore from "@App/app/logger/core.ts";
import { LoggerDAO } from "@App/app/repo/logger.ts";
import DBWriter from "@App/app/logger/db_writer.ts";

// 初始化数据库
migrate();
// 初始化日志组件
const loggerCore = new LoggerCore({
  writer: new DBWriter(new LoggerDAO()),
  labels: { env: "options" },
});

loggerCore.logger().debug("page start");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <MainLayout className="!flex-row" pageName="options">
        <Sider />
      </MainLayout>
    </Provider>
  </React.StrictMode>
);
