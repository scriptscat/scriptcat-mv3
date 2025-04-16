import React, { useEffect, useRef, useState } from "react";
import { Button, Card, Checkbox, Drawer, Empty, Input, List, Message, Modal, Space } from "@arco-design/web-react";
import Title from "@arco-design/web-react/es/Typography/title";
import { formatUnixTime } from "@App/pkg/utils/utils";
import FileSystemParams from "@App/pages/components/FileSystemParams";
import { IconQuestionCircleFill } from "@arco-design/web-react/icon";
import { RefInputType } from "@arco-design/web-react/es/Input/interface";
import { useTranslation } from "react-i18next";
import { FileSystemType } from "@Packages/filesystem/factory";
import { message, systemConfig } from "@App/pages/store/global";
import { SynchronizeClient } from "@App/app/service/service_worker/client";
import Cache from "@App/app/cache";
import CacheKey from "@App/app/cache_key";
import { v4 as uuidv4 } from "uuid";

const synchronizeClient = new SynchronizeClient(message);

function Tools() {
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileSystemType, setFilesystemType] = useState<FileSystemType>("webdav");
  const [fileSystemParams, setFilesystemParam] = useState<{
    [key: string]: any;
  }>({});
  const [backupFileList, setBackupFileList] = useState<File[]>([]);
  const vscodeRef = useRef<RefInputType>(null);
  const { t } = useTranslation();

  useEffect(() => {
    // 获取配置
    systemConfig.getBackup().then((backup) => {
      setFilesystemType(backup.filesystem);
      setFilesystemParam(backup.params[backup.filesystem] || {});
    });
  }, []);

  return (
    <Space
      className="tools"
      direction="vertical"
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        position: "relative",
      }}
    >
      <Card className="backup" title={t("backup")} bordered={false}>
        <Space direction="vertical">
          <Title heading={6}>{t("local")}</Title>
          <Space>
            <input type="file" ref={fileRef} style={{ display: "none" }} accept=".zip" />
            <Button
              type="primary"
              loading={loading.local}
              onClick={async () => {
                setLoading((prev) => ({ ...prev, local: true }));
                await synchronizeClient.backup();
                setLoading((prev) => ({ ...prev, local: false }));
              }}
            >
              {t("export_file")}
            </Button>
            <Button
              type="primary"
              onClick={() => {
                const el = fileRef.current!;
                el.onchange = async () => {
                  const { files } = el;
                  if (!files) {
                    return;
                  }
                  const file = files[0];
                  if (!file) {
                    return;
                  }
                  const url = URL.createObjectURL(file);
                  try {
                    const uuid = uuidv4();
                    Cache.getInstance()
                      .set(CacheKey.importFile(uuid), {
                        filename: file.name,
                        url: url,
                      })
                      .then(() => {
                        Message.success(t("select_import_script")!);
                        // 打开导入窗口
                        chrome.tabs.create({
                          url: `/src/import.html?uuid=${uuid}`,
                        });
                      });
                  } catch (e) {
                    Message.error(`${t("import_error")}: ${e}`);
                  }
                };
                el.click();
              }}
            >
              {t("import_file")}
            </Button>
          </Space>
          <Title heading={6}>{t("cloud")}</Title>
          <FileSystemParams
            preNode={t("backup_to")}
            onChangeFileSystemType={(type) => {
              setFilesystemType(type);
            }}
            onChangeFileSystemParams={(params) => {
              setFilesystemParam(params);
            }}
            actionButton={[
              <Button
                key="backup"
                type="primary"
                loading={loading.cloud}
                onClick={() => {
                  // Store parameters
                  const params = { ...fileSystemParams };
                  params[fileSystemType] = fileSystemParams;
                  systemConfig.setBackup({
                    filesystem: fileSystemType,
                    params,
                  });
                  setLoading((prev) => ({ ...prev, cloud: true }));
                  Message.info(t("preparing_backup")!);
                  syncCtrl
                    .backupToCloud(fileSystemType, fileSystemParams)
                    .then(() => {
                      Message.success(t("backup_success")!);
                    })
                    .catch((e) => {
                      Message.error(`${t("backup_failed")}: ${e}`);
                    })
                    .finally(() => {
                      setLoading((prev) => ({ ...prev, cloud: false }));
                    });
                }}
              >
                {t("backup")}
              </Button>,
              <Button
                key="list"
                type="primary"
                onClick={async () => {
                  let fs = await FileSystemFactory.create(fileSystemType, fileSystemParams);
                  try {
                    fs = await fs.openDir("ScriptCat");
                    let list = await fs.list();
                    list.sort((a, b) => b.updatetime - a.updatetime);
                    // Filter non-zip files
                    list = list.filter((file) => file.name.endsWith(".zip"));
                    if (list.length === 0) {
                      Message.info(t("no_backup_files")!);
                      return;
                    }
                    setBackupFileList(list);
                  } catch (e) {
                    Message.error(`${t("get_backup_files_failed")}: ${e}`);
                  }
                }}
              >
                {t("backup_list")}
              </Button>,
            ]}
            fileSystemType={fileSystemType}
            fileSystemParams={fileSystemParams}
          />
          <Drawer
            width={400}
            title={
              <div className="flex flex-row justify-between w-full gap-10">
                <span>{t("backup_list")}</span>
                <Button
                  type="secondary"
                  size="mini"
                  onClick={async () => {
                    let fs = await FileSystemFactory.create(fileSystemType, fileSystemParams);
                    try {
                      fs = await fs.openDir("ScriptCat");
                      const url = await fs.getDirUrl();
                      if (url) {
                        window.open(url, "_black");
                      }
                    } catch (e) {
                      Message.error(`${t("get_backup_dir_url_failed")}: ${e}`);
                    }
                  }}
                >
                  {t("open_backup_dir")}
                </Button>
              </div>
            }
            visible={backupFileList.length !== 0}
            onOk={() => {
              setBackupFileList([]);
            }}
            onCancel={() => {
              setBackupFileList([]);
            }}
          >
            <List
              bordered={false}
              dataSource={backupFileList}
              render={(item: File) => (
                <List.Item key={item.name}>
                  <List.Item.Meta title={item.name} description={formatUnixTime(item.updatetime / 1000)} />
                  <Space className="w-full justify-end">
                    <Button
                      type="primary"
                      size="small"
                      onClick={async () => {
                        Message.info(t("pulling_data_from_cloud")!);
                        let fs = await FileSystemFactory.create(fileSystemType, fileSystemParams);
                        let file: FileReader;
                        let data: Blob;
                        try {
                          fs = await fs.openDir("ScriptCat");
                          file = await fs.open(item);
                          data = (await file.read("blob")) as Blob;
                        } catch (e) {
                          Message.error(`${t("pull_failed")}: ${e}`);
                          return;
                        }
                        const url = URL.createObjectURL(data);
                        setTimeout(() => {
                          URL.revokeObjectURL(url);
                        }, 60 * 100000);
                        syncCtrl
                          .openImportWindow(item.name, url)
                          .then(() => {
                            Message.success(t("select_import_script")!);
                          })
                          .then((e) => {
                            Message.error(`${t("import_error")}${e}`);
                          });
                      }}
                    >
                      {t("restore")}
                    </Button>
                    <Button
                      type="primary"
                      status="danger"
                      size="small"
                      onClick={() => {
                        Modal.confirm({
                          title: t("confirm_delete"),
                          content: `${t("confirm_delete_backup_file")}${item.name}?`,
                          onOk: async () => {
                            let fs = await FileSystemFactory.create(fileSystemType, fileSystemParams);
                            try {
                              fs = await fs.openDir("ScriptCat");
                              await fs.delete(item.name);
                              setBackupFileList(backupFileList.filter((i) => i.name !== item.name));
                              Message.success(t("delete_success")!);
                            } catch (e) {
                              Message.error(`${t("delete_failed")}${e}`);
                            }
                          },
                        });
                      }}
                    >
                      {t("delete")}
                    </Button>
                  </Space>
                </List.Item>
              )}
            />
          </Drawer>
          <Title heading={6}>{t("backup_strategy")}</Title>
          <Empty description={t("under_construction")} />
        </Space>
      </Card>

      <Card
        title={
          <>
            <span>{t("development_debugging")}</span>
            <Button
              type="text"
              style={{
                height: 24,
              }}
              icon={
                <IconQuestionCircleFill
                  style={{
                    margin: 0,
                  }}
                />
              }
              href="https://www.bilibili.com/video/BV16q4y157CP"
              target="_blank"
              iconOnly
            />
          </>
        }
        bordered={false}
      >
        <Space direction="vertical">
          <Title heading={6}>{t("vscode_url")}</Title>
          <Input
            ref={vscodeRef}
            defaultValue={systemConfig.vscodeUrl}
            onChange={(value) => {
              systemConfig.vscodeUrl = value;
            }}
          />
          <Checkbox
            onChange={(checked) => {
              systemConfig.vscodeReconnect = checked;
            }}
            defaultChecked={systemConfig.vscodeReconnect}
          >
            {t("auto_connect_vscode_service")}
          </Checkbox>
          <Button
            type="primary"
            onClick={() => {
              const ctrl = IoC.instance(SystemController) as SystemController;
              ctrl
                .connectVSCode()
                .then(() => {
                  Message.success(t("connection_success")!);
                })
                .catch((e) => {
                  Message.error(`${t("connection_failed")}: ${e}`);
                });
            }}
          >
            {t("connect")}
          </Button>
        </Space>
      </Card>
    </Space>
  );
}

export default Tools;
