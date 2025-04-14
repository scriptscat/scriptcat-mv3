import { createAppSlice } from "../hooks";
import { PayloadAction } from "@reduxjs/toolkit";
import { editor } from "monaco-editor";

function setAutoMode() {
  const darkTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const isMatch = (match: boolean) => {
    if (match) {
      document.body.setAttribute("arco-theme", "dark");
      editor.setTheme("vs-dark");
    } else {
      document.body.removeAttribute("arco-theme");
      editor.setTheme("vs");
    }
  };
  darkTheme.addEventListener("change", (e) => {
    isMatch(e.matches);
  });
  isMatch(darkTheme.matches);
}

export type SystemConfig = {
  lightMode: "light" | "dark" | "auto";
  eslint: {
    enable: boolean;
    config: string;
  };
  scriptListColumnWidth: { [key: string]: number };
  menuExpandNum: number;
};

export const settingSlice = createAppSlice({
  name: "setting",
  initialState: {
    lightMode: localStorage.lightMode || "auto",
    eslint: {
      enable: true,
      config: "",
    },
    scriptListColumnWidth: {} as { [key: string]: number },
    menuExpandNum: 5,
  } as SystemConfig,
  reducers: (create) => {
    // 初始化黑夜模式
    setAutoMode();
    // 加载配置
    chrome.storage.sync.get("systemSetting", (result) => {
      const systemSetting = result.systemSetting as SystemConfig;
      settingSlice.actions.initSetting(systemSetting);
      if (systemSetting) {
        localStorage.lightMode = systemSetting.lightMode;
      }
    });
    return {
      initSetting: create.reducer((state, action: PayloadAction<SystemConfig>) => {
        state.menuExpandNum = action.payload.menuExpandNum;
      }),
      setDarkMode: create.reducer((state, action: PayloadAction<"light" | "dark" | "auto">) => {
        localStorage.loghtMode = action.payload;
        state.lightMode = action.payload;
        if (action.payload === "auto") {
          setAutoMode();
        } else {
          document.body.setAttribute("arco-theme", action.payload);
          editor.setTheme(action.payload === "dark" ? "vs-dark" : "vs");
        }
      }),
      menuExpandNum: create.reducer((state, action: PayloadAction<number>) => {
        state.menuExpandNum = action.payload;
      }),
    };
  },
  selectors: {
    selectThemeMode: (state) => state.lightMode,
    selectScriptListColumnWidth: (state) => state.scriptListColumnWidth,
    selectMenuExpandNum: (state) => state.menuExpandNum,
  },
});

export const { setDarkMode } = settingSlice.actions;

export const { selectThemeMode, selectScriptListColumnWidth, selectMenuExpandNum } = settingSlice.selectors;
