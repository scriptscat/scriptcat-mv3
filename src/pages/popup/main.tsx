import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import LoggerCore from "@App/app/logger/core.ts";
import "@arco-design/web-react/dist/css/arco.css";
import "@App/locales/locales";
import "@App/index.css";
import "./index.css";
import { Provider } from "react-redux";
import { store } from "../store/store.ts";
import MessageWriter from "@App/app/logger/message_writer.ts";
import { message } from "../store/global.ts";

// 初始化日志组件
const loggerCore = new LoggerCore({
  writer: new MessageWriter(message),
  labels: { env: "install" },
});

loggerCore.logger().debug("page start");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <div
        style={{
          borderBottom: "1px solid var(--color-neutral-3)",
        }}
      >
        <App />
      </div>
    </Provider>
  </React.StrictMode>
);
