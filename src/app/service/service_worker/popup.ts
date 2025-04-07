import { MessageQueue } from "@Packages/message/message_queue";
import { Group } from "@Packages/message/server";
import { RuntimeService, ScriptMatchInfo } from "./runtime";
import Cache from "@App/app/cache";
import { GetPopupDataReq, GetPopupDataRes } from "./client";
import {
  SCRIPT_RUN_STATUS,
  Metadata,
  SCRIPT_STATUS_ENABLE,
  Script,
  ScriptDAO,
  SCRIPT_TYPE_NORMAL,
} from "@App/app/repo/scripts";
import {
  ScriptMenuRegisterCallbackValue,
  subscribeScriptDelete,
  subscribeScriptEnable,
  subscribeScriptInstall,
  subscribeScriptMenuRegister,
  subscribeScriptRunStatus,
} from "../queue";

export type ScriptMenuItem = {
  id: number;
  name: string;
  accessKey?: string;
  tabId: number; //-1表示后台脚本
  frameId?: number;
  documentId?: string;
};

export type ScriptMenu = {
  uuid: string; // 脚本uuid
  name: string; // 脚本名称
  enable: boolean; // 脚本是否启用
  updatetime: number; // 脚本更新时间
  hasUserConfig: boolean; // 是否有用户配置
  metadata: Metadata; // 脚本元数据
  runStatus?: SCRIPT_RUN_STATUS; // 脚本运行状态
  runNum: number; // 脚本运行次数
  runNumByIframe: number; // iframe运行次数
  menus: ScriptMenuItem[]; // 脚本菜单
  customExclude: string[]; // 自定义排除
};

// 处理popup页面的数据
export class PopupService {
  scriptDAO = new ScriptDAO();

  constructor(
    private group: Group,
    private mq: MessageQueue,
    private runtime: RuntimeService
  ) {}

  genScriptMenuByTabMap(menu: ScriptMenu[]) {
    menu.forEach((script) => {
      // 创建脚本菜单
      if (script.menus.length) {
        chrome.contextMenus.create({
          id: `scriptMenu_` + script.uuid,
          title: script.name,
          contexts: ["all"],
          parentId: "scriptMenu",
        });
        script.menus.forEach((menu) => {
          // 创建菜单
          console.log("create menu", menu);
          chrome.contextMenus.create({
            id: `scriptMenu_menu_${script.uuid}_${menu.id}`,
            title: menu.name,
            contexts: ["all"],
            parentId: `scriptMenu_${script.uuid}`,
          });
        });
      }
    });
  }

  // 生成chrome菜单
  async genScriptMenu(tabId: number) {
    // 移除之前所有的菜单
    chrome.contextMenus.removeAll();
    const [menu, backgroundMenu] = await Promise.all([this.getScriptMenu(tabId), this.getScriptMenu(-1)]);
    console.log(menu, backgroundMenu, tabId);
    if (!menu.length && !backgroundMenu.length) {
      return;
    }
    // 创建根菜单
    chrome.contextMenus.create({
      id: "scriptMenu",
      title: "ScriptCat",
      contexts: ["all"],
    });
    if (menu) {
      this.genScriptMenuByTabMap(menu);
    }
    // 后台脚本的菜单
    if (backgroundMenu) {
      this.genScriptMenuByTabMap(backgroundMenu);
    }
  }

  async registerMenuCommand(message: ScriptMenuRegisterCallbackValue) {
    // 给脚本添加菜单
    const data = await this.getScriptMenu(message.tabId);
    const script = data.find((item) => item.uuid === message.uuid);
    if (script) {
      const menu = script.menus.find((item) => item.id === message.id);
      if (!menu) {
        script.menus.push({
          id: message.id,
          name: message.name,
          accessKey: message.accessKey,
          tabId: message.tabId,
          frameId: message.frameId,
          documentId: message.documentId,
        });
      } else {
        menu.name = message.name;
        menu.accessKey = message.accessKey;
        menu.tabId = message.tabId;
      }
    }
    console.log("set menu", data);
    await Cache.getInstance().set("tabScript:" + message.tabId, data);
    console.log("update menu");
    this.updateScriptMenu();
  }

  async unregisterMenuCommand({ id, uuid, tabId }: { id: number; uuid: string; tabId: number }) {
    const data = await this.getScriptMenu(tabId);
    // 删除脚本菜单
    const script = data.find((item) => item.uuid === uuid);
    if (script) {
      script.menus = script.menus.filter((item) => item.id !== id);
    }
    await Cache.getInstance().set("tabScript:" + tabId, data);
    this.updateScriptMenu();
  }

  updateScriptMenu() {
    // 获取当前页面并更新菜单
    chrome.tabs.query({ active: true }, (tabs) => {
      console.log("query", tabs);
      if (!tabs.length) {
        return;
      }
      const tab = tabs[0];
      // 生成菜单
      tab.id && this.genScriptMenu(tab.id);
    });
  }

  scriptToMenu(script: Script): ScriptMenu {
    return {
      uuid: script.uuid,
      name: script.name,
      enable: script.status === SCRIPT_STATUS_ENABLE,
      updatetime: script.updatetime || 0,
      hasUserConfig: !!script.config,
      metadata: script.metadata,
      runStatus: script.runStatus,
      runNum: 0,
      runNumByIframe: 0,
      menus: [],
      customExclude: (script as ScriptMatchInfo).customizeExcludeMatches || [],
    };
  }

  // 获取popup页面数据
  async getPopupData(req: GetPopupDataReq): Promise<GetPopupDataRes> {
    // 获取当前tabId
    const scriptUuid = await this.runtime.getPageScriptByUrl(req.url);
    // 与运行时脚本进行合并
    const runScript = await this.getScriptMenu(req.tabId);
    // 筛选出未运行的脚本
    const notRunScript = scriptUuid.filter((script) => {
      return !runScript.find((item) => item.uuid === script.uuid);
    });
    // 将未运行的脚本转换为菜单
    const scriptList = notRunScript.map((script): ScriptMenu => {
      return this.scriptToMenu(script);
    });
    runScript.push(...scriptList);
    // 后台脚本只显示开启或者运行中的脚本

    return { scriptList: runScript, backScriptList: await this.getScriptMenu(-1) };
  }

  async getScriptMenu(tabId: number) {
    return ((await Cache.getInstance().get("tabScript:" + tabId)) || []) as ScriptMenu[];
  }

  async addScriptRunNumber({
    tabId,
    frameId,
    scripts,
  }: {
    tabId: number;
    frameId: number;
    scripts: ScriptMatchInfo[];
  }) {
    if (frameId === undefined) {
      // 清理数据
      await Cache.getInstance().del("tabScript:" + tabId);
    }
    // 设置数据
    const data = await this.getScriptMenu(tabId);
    // 设置脚本运行次数
    scripts.forEach((script) => {
      const scriptMenu = data.find((item) => item.uuid === script.uuid);
      if (scriptMenu) {
        scriptMenu.runNum = (scriptMenu.runNum || 0) + 1;
        if (frameId) {
          scriptMenu.runNumByIframe = (scriptMenu.runNumByIframe || 0) + 1;
        }
      } else {
        const item = this.scriptToMenu(script);
        item.runNum = 1;
        if (frameId) {
          item.runNumByIframe = 1;
        }
        data.push(item);
      }
    });
    Cache.getInstance().set("tabScript:" + tabId, data);
  }

  dealBackgroundScriptInstall() {
    // 处理后台脚本
    subscribeScriptInstall(this.mq, async ({ script }) => {
      if (script.type === SCRIPT_TYPE_NORMAL) {
        return;
      }
      const menu = await this.getScriptMenu(-1);
      const scriptMenu = menu.find((item) => item.uuid === script.uuid);
      if (script.status === SCRIPT_STATUS_ENABLE) {
        // 加入菜单
        if (!scriptMenu) {
          const item = this.scriptToMenu(script);
          menu.push(item);
        }
      } else {
        // 移出菜单
        if (scriptMenu) {
          menu.splice(menu.indexOf(scriptMenu), 1);
        }
      }
      Cache.getInstance().set("tabScript:" + -1, menu);
    });
    subscribeScriptEnable(this.mq, async ({ uuid }) => {
      const script = await this.scriptDAO.get(uuid);
      if (!script) {
        return;
      }
      if (script.type === SCRIPT_TYPE_NORMAL) {
        return;
      }
      const menu = await this.getScriptMenu(-1);
      const scriptMenu = menu.find((item) => item.uuid === uuid);
      if (script.status === SCRIPT_STATUS_ENABLE) {
        // 加入菜单
        if (!scriptMenu) {
          const item = this.scriptToMenu(script);
          menu.push(item);
        }
      } else {
        // 移出菜单
        if (scriptMenu) {
          menu.splice(menu.indexOf(scriptMenu), 1);
        }
      }
      Cache.getInstance().set("tabScript:" + -1, menu);
    });
    subscribeScriptDelete(this.mq, async ({ uuid }) => {
      const menu = await this.getScriptMenu(-1);
      const scriptMenu = menu.find((item) => item.uuid === uuid);
      if (scriptMenu) {
        menu.splice(menu.indexOf(scriptMenu), 1);
        Cache.getInstance().set("tabScript:" + -1, menu);
      }
    });
    subscribeScriptRunStatus(this.mq, async ({ uuid, runStatus }) => {
      const menu = await this.getScriptMenu(-1);
      const scriptMenu = menu.find((item) => item.uuid === uuid);
      if (scriptMenu) {
        scriptMenu.runStatus = runStatus;
        Cache.getInstance().set("tabScript:" + -1, menu);
      }
    });
  }

  menuClick({
    uuid,
    id,
    tabId,
    frameId,
    documentId,
  }: {
    uuid: string;
    id: number;
    tabId: number;
    frameId: number;
    documentId: string;
  }) {
    // 菜单点击事件
    console.log("click menu", uuid, id, tabId, frameId, documentId);
    this.runtime.sendMessageToTab(
      tabId,
      "menuClick",
      {
        uuid,
        id,
        tabId,
      },
      {
        frameId,
        documentId: documentId,
      }
    );
    return Promise.resolve(true);
  }

  init() {
    // 处理脚本菜单数据
    subscribeScriptMenuRegister(this.mq, this.registerMenuCommand.bind(this));
    this.mq.subscribe("unregisterMenuCommand", this.unregisterMenuCommand.bind(this));
    this.group.on("getPopupData", this.getPopupData.bind(this));
    this.group.on("menuClick", this.menuClick.bind(this));
    this.dealBackgroundScriptInstall();

    // 监听tab开关
    chrome.tabs.onRemoved.addListener((tabId) => {
      // 清理数据
      Cache.getInstance().del("tabScript:" + tabId);
    });
    // 监听页面切换加载菜单
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.genScriptMenu(activeInfo.tabId);
    });
    // 处理chrome菜单点击
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      const menuIds = (info.menuItemId as string).split("_");
      if (menuIds.length === 4) {
        const [, , uuid, id] = menuIds;
        // 寻找menu信息
        const menu = await this.getScriptMenu(tab!.id!);
        const script = menu.find((item) => item.uuid === uuid);
        if (script) {
          const menuItem = script.menus.find((item) => item.id === parseInt(id, 10));
          if (menuItem) {
            this.menuClick({
              uuid: script.uuid,
              id: menuItem.id,
              tabId: tab!.id!,
              frameId: menuItem.frameId || 0,
              documentId: menuItem.documentId || "",
            });
            return;
          }
        }
      }
    });

    // 监听运行次数
    this.mq.subscribe(
      "pageLoad",
      async ({
        tabId,
        frameId,
        scripts,
      }: {
        tabId: number;
        frameId: number;
        document: string;
        scripts: ScriptMatchInfo[];
      }) => {
        this.addScriptRunNumber({ tabId, frameId, scripts });
        // 设置角标和脚本
        chrome.action.getBadgeText(
          {
            tabId: tabId,
          },
          (res: string) => {
            if (res || scripts.length) {
              chrome.action.setBadgeText({
                text: (scripts.length + (parseInt(res, 10) || 0)).toString(),
                tabId: tabId,
              });
              chrome.action.setBadgeBackgroundColor({
                color: "#4e5969",
                tabId: tabId,
              });
            }
          }
        );
      }
    );
  }
}
