import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { Resource } from "@App/app/repo/resource";
import { Script, SCRIPT_STATUS_ENABLE, ScriptCodeDAO, ScriptDAO } from "@App/app/repo/scripts";
import BackupExport from "@App/pkg/backup/export";
import { BackupData, ResourceBackup, ScriptBackupData, ScriptOptions, ValueStorage } from "@App/pkg/backup/struct";
import FileSystem from "@Packages/filesystem/filesystem";
import ZipFileSystem from "@Packages/filesystem/zip/zip";
import { Group, MessageSend } from "@Packages/message/server";
import JSZip from "jszip";
import { ValueService } from "./value";
import { ResourceService } from "./resource";
import dayjs from "dayjs";
import { createObjectURL } from "../offscreen/client";
import FileSystemFactory, { FileSystemType } from "@Packages/filesystem/factory";
import { systemConfig } from "@App/pages/store/global";
import { CloudSyncConfig } from "@App/pkg/config/config";

export class SynchronizeService {
  logger: Logger;

  scriptDAO = new ScriptDAO();
  scriptCodeDAO = new ScriptCodeDAO();

  constructor(
    private send: MessageSend,
    private group: Group,
    private value: ValueService,
    private resource: ResourceService
  ) {
    this.logger = LoggerCore.logger().with({ service: "synchronize" });
  }

  // 生成备份文件到文件系统
  async backup(fs: FileSystem, uuids?: string[]) {
    // 生成导出数据
    const data: BackupData = {
      script: await this.getScriptBackupData(uuids),
      subscribe: [],
    };

    await new BackupExport(fs).export(data);
  }

  // 获取脚本备份数据
  async getScriptBackupData(uuids?: string[]) {
    if (uuids) {
      const rets: Promise<ScriptBackupData>[] = [];
      uuids.forEach((uuid) => {
        rets.push(
          this.scriptDAO.get(uuid).then((script) => {
            if (script) {
              return this.generateScriptBackupData(script);
            }
            return Promise.reject(new Error(`Script ${uuid} not found`));
          })
        );
      });
      return Promise.all(rets);
    }
    // 获取所有脚本
    const list = await this.scriptDAO.all();
    return Promise.all(list.map(async (script): Promise<ScriptBackupData> => this.generateScriptBackupData(script)));
  }

  async generateScriptBackupData(script: Script): Promise<ScriptBackupData> {
    const code = await this.scriptCodeDAO.get(script.uuid);
    if (!code) {
      throw new Error(`Script ${script.uuid} code not found`);
    }
    const ret = {
      code: code.code,
      options: {
        options: this.scriptOption(script),
        settings: {
          enabled: script.status === SCRIPT_STATUS_ENABLE,
          position: script.sort,
        },
        meta: {
          name: script.name,
          uuid: script.uuid,
          sc_uuid: script.uuid,
          modified: script.updatetime,
          file_url: script.downloadUrl,
          subscribe_url: script.subscribeUrl,
        },
      },
      // storage,
      requires: [],
      requiresCss: [],
      resources: [],
    } as unknown as ScriptBackupData;
    const storage: ValueStorage = {
      data: {},
      ts: new Date().getTime(),
    };
    const values = await this.value.getScriptValue(script);
    Object.keys(values).forEach((key) => {
      storage.data[key] = values[key];
    });

    const requires = await this.resource.getResourceByType(script, "require");
    const requiresCss = await this.resource.getResourceByType(script, "require-css");
    const resources = await this.resource.getResourceByType(script, "resource");

    ret.requires = this.resourceToBackdata(requires);
    ret.requiresCss = this.resourceToBackdata(requiresCss);
    ret.resources = this.resourceToBackdata(resources);

    ret.storage = storage;
    return Promise.resolve(ret);
  }

  resourceToBackdata(resource: { [key: string]: Resource }) {
    const ret: ResourceBackup[] = [];
    Object.keys(resource).forEach((key) => {
      ret.push({
        meta: {
          name: this.getUrlName(resource[key].url),
          url: resource[key].url,
          ts: resource[key].updatetime || resource[key].createtime,
          mimetype: resource[key].contentType,
        },
        source: resource[key]!.content || undefined,
        base64: resource[key]!.base64,
      });
    });
    return ret;
  }

  getUrlName(url: string): string {
    let index = url.indexOf("?");
    if (index !== -1) {
      url = url.substring(0, index);
    }
    index = url.lastIndexOf("/");
    if (index !== -1) {
      url = url.substring(index + 1);
    }
    return url;
  }

  // 为了兼容tm
  scriptOption(script: Script): ScriptOptions {
    return {
      check_for_updates: false,
      comment: null,
      compat_foreach: false,
      compat_metadata: false,
      compat_prototypes: false,
      compat_wrappedjsobject: false,
      compatopts_for_requires: true,
      noframes: null,
      override: {
        merge_connects: true,
        merge_excludes: true,
        merge_includes: true,
        merge_matches: true,
        orig_connects: script.metadata.connect || [],
        orig_excludes: script.metadata.exclude || [],
        orig_includes: script.metadata.include || [],
        orig_matches: script.metadata.match || [],
        orig_noframes: script.metadata.noframe ? true : null,
        orig_run_at: (script.metadata.run_at && script.metadata.run_at[0]) || "document-idle",
        use_blockers: [],
        use_connects: [],
        use_excludes: [],
        use_includes: [],
        use_matches: [],
      },
      run_at: null,
    };
  }

  // 请求导出文件
  async requestExport(uuids?: string[]) {
    const zip = new JSZip();
    const fs = new ZipFileSystem(zip);
    await this.backup(fs, uuids);
    // 生成文件,并下载
    const files = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 9,
      },
      comment: "Created by Scriptcat",
    });
    const url = await createObjectURL(this.send, files);
    chrome.downloads.download({
      url,
      saveAs: true,
      filename: `scriptcat-backup-${dayjs().format("YYYY-MM-DDTHH-mm-ss")}.zip`,
    });
    return Promise.resolve();
  }

  // 备份到云端
  async backupToCloud({ type, params }: { type: FileSystemType; params: any }) {
    // 首先生成zip文件
    const zip = new JSZip();
    const fs = new ZipFileSystem(zip);
    await this.backup(fs);
    this.logger.info("backup to cloud");
    // 然后创建云端文件系统
    let cloudFs = await FileSystemFactory.create(type, params);
    try {
      await cloudFs.createDir("ScriptCat");
      cloudFs = await cloudFs.openDir("ScriptCat");
      // 云端文件系统写入文件
      const file = await cloudFs.create(`scriptcat-backup-${dayjs().format("YYYY-MM-DDTHH-mm-ss")}.zip`);
      await file.write(
        await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: {
            level: 9,
          },
          comment: "Created by Scriptcat",
        })
      );
    } catch (e) {
      this.logger.error("backup to cloud error", Logger.E(e));
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  cloudSync() {}

  startCloudSync(value: CloudSyncConfig) {
    if (value.enable) {
      
      this.cloudSync();
    }
  }

  init() {
    this.group.on("export", this.requestExport.bind(this));
    this.group.on("backupToCloud", this.backupToCloud.bind(this));
    // this.group.on("import", this.openImportWindow.bind(this));
  }
}
