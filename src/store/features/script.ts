import { createAsyncThunk } from "@reduxjs/toolkit";
import { createAppSlice } from "../hooks";
import { Script, ScriptDAO } from "@App/app/repo/scripts";

export const fetchScriptList = createAsyncThunk("script/fetchScriptList", () => {
  return new ScriptDAO().all();
});

export const scriptSlice = createAppSlice({
  name: "script",
  initialState: {
    scripts: [] as Script[],
  },
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchScriptList.fulfilled, (state, action) => {
      const newScripts: Script[] = [];
      action.payload.forEach((item) => {
        newScripts.push(item);
      });
      state.scripts = newScripts;
    });
  },
  selectors: {
    selectScripts: (state) => state.scripts,
  },
});

// export const {} = scriptSlice.actions;

export const { selectScripts } = scriptSlice.selectors;
