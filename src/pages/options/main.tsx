import React from "react";
import ReactDOM from "react-dom/client";
import MainLayout from "../components/layout/MainLayout.tsx";
import "@arco-design/web-react/dist/css/arco.css";
import "@App/locales/locales";
import "@App/index.css";
import { Provider } from "react-redux";
import { store } from "@App/store/store.ts";
import { Broker } from "@Packages/message/message_queue.ts";

// 测试监听广播

const border = new Broker();

border.subscribe("installScript", (message) => {
  console.log(message);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <MainLayout className="!flex-col !px-4 box-border">p</MainLayout>
    </Provider>
  </React.StrictMode>
);
