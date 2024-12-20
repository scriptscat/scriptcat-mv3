import { Avatar, Button, Grid, Message, Space, Switch, Tag, Tooltip, Typography } from "@arco-design/web-react";
import CodeEditor from "../components/CodeEditor";
import { useEffect, useState } from "react";
import { Metadata, Script, SCRIPT_STATUS_DISABLE, SCRIPT_STATUS_ENABLE } from "@App/app/repo/scripts";
import { Subscribe } from "@App/app/repo/subscribe";
import { i18nDescription, i18nName } from "@App/locales/locales";
import { useTranslation } from "react-i18next";
import { ScriptInfo } from "@App/pkg/utils/script";

type Permission = { label: string; color?: string; value: string[] }[];

const closeWindow = () => {
  window.close();
};

function App() {
  const [permission, setPermission] = useState<Permission>([]);
  const [metadata, setMetadata] = useState<Metadata>({});
  // 脚本信息包括脚本代码、下载url，但是不包括解析代码后得到的metadata，通过background的缓存获取
  const [info, setInfo] = useState<ScriptInfo>();
  // 对脚本详细的描述
  const [description, setDescription] = useState<any>();
  // 是系统检测到脚本更新时打开的窗口会有一个倒计时
  const [countdown, setCountdown] = useState<number>(-1);
  // 是否为更新
  const [isUpdate, setIsUpdate] = useState<boolean>(false);
  // 脚本信息
  const [upsertScript, setUpsertScript] = useState<Script | Subscribe>();
  // 更新的情况下会有老版本的脚本信息
  const [oldScript, setOldScript] = useState<Script | Subscribe>();
  // 脚本开启状态
  const [enable, setEnable] = useState<boolean>(false);
  // 是否是订阅脚本
  const [isSub, setIsSub] = useState<boolean>(false);
  // 按钮文案
  const [btnText, setBtnText] = useState<string>();
  const { t } = useTranslation();

  // 不推荐的内容标签与描述
  const antifeatures: {
    [key: string]: { color: string; title: string; description: string };
  } = {
    "referral-link": {
      color: "purple",
      title: t("antifeature_referral_link_title"),
      description: t("antifeature_referral_link_description"),
    },
    ads: {
      color: "orange",
      title: t("antifeature_ads_title"),
      description: t("antifeature_ads_description"),
    },
    payment: {
      color: "magenta",
      title: t("antifeature_payment_title"),
      description: t("antifeature_payment_description"),
    },
    miner: {
      color: "orangered",
      title: t("antifeature_miner_title"),
      description: t("antifeature_miner_description"),
    },
    membership: {
      color: "blue",
      title: t("antifeature_membership_title"),
      description: t("antifeature_membership_description"),
    },
    tracking: {
      color: "pinkpurple",
      title: t("antifeature_tracking_title"),
      description: t("antifeature_tracking_description"),
    },
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const uuid = url.searchParams.get("uuid");
    if (!uuid) {
      return;
    }
  });

  return (
    <div className="h-full">
      <div className="h-full">
        <Grid.Row gutter={8}>
          <Grid.Col flex={1} className="flex-col p-8px">
            <Space direction="vertical">
              <div>
                {upsertScript?.metadata.icon && (
                  <Avatar size={32} shape="square" style={{ marginRight: "8px" }}>
                    <img src={upsertScript.metadata.icon[0]} alt={upsertScript?.name} />
                  </Avatar>
                )}
                <Typography.Text bold className="text-size-lg">
                  {upsertScript && i18nName(upsertScript)}
                  <Tooltip content={isSub ? t("subscribe_source_tooltip") : t("script_status_tooltip")}>
                    <Switch
                      style={{ marginLeft: "8px" }}
                      checked={enable}
                      onChange={(checked) => {
                        setUpsertScript((script) => {
                          if (!script) {
                            return script;
                          }
                          script.status = checked ? SCRIPT_STATUS_ENABLE : SCRIPT_STATUS_DISABLE;
                          setEnable(checked);
                          return script;
                        });
                      }}
                    />
                  </Tooltip>
                </Typography.Text>
              </div>
              <div>
                <Typography.Text bold>{upsertScript && i18nDescription(upsertScript)}</Typography.Text>
              </div>
              <div>
                <Typography.Text bold>
                  {t("author")}: {metadata.author}
                </Typography.Text>
              </div>
              <div>
                <Typography.Text
                  bold
                  style={{
                    overflowWrap: "break-word",
                    wordBreak: "break-all",
                    maxHeight: "70px",
                    display: "block",
                    overflowY: "auto",
                  }}
                >
                  {t("source")}: {info?.url}
                </Typography.Text>
              </div>
              <div className="text-end">
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => {
                      if (!upsertScript) {
                        Message.error(t("script_info_load_failed")!);
                        return;
                      }
                      if (isSub) {
                        // subscribeCtrl
                        //   .upsert(upsertScript as Subscribe)
                        //   .then(() => {
                        //     Message.success(t("subscribe_success")!);
                        //     setBtnText(t("subscribe_success")!);
                        //     setTimeout(() => {
                        //       closeWindow();
                        //     }, 200);
                        //   })
                        //   .catch((e) => {
                        //     Message.error(`${t("subscribe_failed")}: ${e}`);
                        //   });
                        return;
                      }
                      // scriptCtrl
                      //   .upsert(upsertScript as Script)
                      //   .then(() => {
                      //     if (isUpdate) {
                      //       Message.success(t("install.update_success")!);
                      //       setBtnText(t("install.update_success")!);
                      //     } else {
                      //       Message.success(t("install_success")!);
                      //       setBtnText(t("install_success")!);
                      //     }
                      //     setTimeout(() => {
                      //       closeWindow();
                      //     }, 200);
                      //   })
                      //   .catch((e) => {
                      //     Message.error(`${t("install_failed")}: ${e}`);
                      //   });
                    }}
                  >
                    {btnText}
                  </Button>
                  <Button
                    type="primary"
                    status="danger"
                    size="small"
                    onClick={() => {
                      if (countdown === -1) {
                        closeWindow();
                      } else {
                        setCountdown(-1);
                      }
                    }}
                  >
                    {countdown === -1 ? t("close") : `${t("stop")} (${countdown})`}
                  </Button>
                </Space>
              </div>
            </Space>
          </Grid.Col>
          <Grid.Col flex={1} className="p-8px">
            <Space direction="vertical">
              <div>
                <Space>
                  {oldScript && (
                    <Tooltip content={`${t("current_version")}: v${oldScript.metadata.version[0]}`}>
                      <Tag bordered>{oldScript.metadata.version[0]}</Tag>
                    </Tooltip>
                  )}
                  {metadata.version && (
                    <Tooltip color="red" content={`${t("update_version")}: v${metadata.version[0]}`}>
                      <Tag bordered color="red">
                        {metadata.version[0]}
                      </Tag>
                    </Tooltip>
                  )}
                  {(metadata.background || metadata.crontab) && (
                    <Tooltip color="green" content={t("background_script_tag")}>
                      <Tag bordered color="green">
                        {t("background_script")}
                      </Tag>
                    </Tooltip>
                  )}
                  {metadata.crontab && (
                    <Tooltip color="green" content={t("scheduled_script_tag")}>
                      <Tag bordered color="green">
                        {t("scheduled_script")}
                      </Tag>
                    </Tooltip>
                  )}
                  {metadata.antifeature &&
                    metadata.antifeature.map((antifeature) => {
                      const item = antifeature.split(" ")[0];
                      return (
                        antifeatures[item] && (
                          <Tooltip color={antifeatures[item].color} content={antifeatures[item].description}>
                            <Tag bordered color={antifeatures[item].color}>
                              {antifeatures[item].title}
                            </Tag>
                          </Tooltip>
                        )
                      );
                    })}
                </Space>
              </div>
              {description && description}
              <div>
                <Typography.Text type="error">{t("install_from_legitimate_sources_warning")}</Typography.Text>
              </div>
            </Space>
          </Grid.Col>
          <Grid.Col span={24}>
            <Grid.Row>
              {permission.map((item) => (
                <Grid.Col
                  key={item.label}
                  span={8}
                  style={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    overflowX: "auto",
                    boxSizing: "border-box",
                  }}
                  className="p-8px"
                >
                  <Typography.Text bold color={item.color}>
                    {item.label}
                  </Typography.Text>
                  {item.value.map((v) => (
                    <div key={v}>
                      <Typography.Text style={{ wordBreak: "unset", color: item.color }}>{v}</Typography.Text>
                    </div>
                  ))}
                </Grid.Col>
              ))}
            </Grid.Row>
          </Grid.Col>
        </Grid.Row>
        <CodeEditor id="show-code" code={upsertScript?.code || undefined} diffCode={oldScript?.code || ""} />
      </div>
    </div>
  );
}

export default App;
