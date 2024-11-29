import {
  Button,
  ConfigProvider,
  Dropdown,
  Empty,
  Input,
  Layout,
  Menu,
  Modal,
  Space,
  Typography,
} from "@arco-design/web-react";
import { RefInputType } from "@arco-design/web-react/es/Input/interface";
import { IconDesktop, IconMoonFill, IconSunFill } from "@arco-design/web-react/icon";
import React, { ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.css";

const MainLayout: React.FC<{
  children: ReactNode;
  className: string;
}> = ({ children, className }) => {
  const [lightMode, setLightMode] = useState(localStorage.lightMode || "auto");
  const importRef = useRef<RefInputType>(null);
  const [importVisible, setImportVisible] = useState(false);
  const { t } = useTranslation();

  return (
    <ConfigProvider
      renderEmpty={() => {
        return <Empty description={t("no_data")} />;
      }}
    >
      <Layout>
        <Layout.Header
          style={{
            height: "50px",
            borderBottom: "1px solid var(--color-neutral-3)",
          }}
          className="flex items-center justify-between px-4"
        >
          <Modal
            title={t("import_link")}
            visible={importVisible}
            onOk={async () => {
              setImportVisible(false);
            }}
            onCancel={() => {
              setImportVisible(false);
            }}
          >
            <Input ref={importRef} defaultValue="" />
          </Modal>
          <div className="flex row items-center">
            <img style={{ height: "40px" }} src="/assets/logo.png" alt="ScriptCat" />
            <Typography.Title heading={4} className="!m-0">
              ScriptCat
            </Typography.Title>
          </div>
          <Space size="small" className="action-tools">
            <Dropdown
              droplist={
                <Menu
                  onClickMenuItem={(key) => {
                    setLightMode(key);
                    localStorage.lightMode = key;
                  }}
                  selectedKeys={[lightMode]}
                >
                  <Menu.Item key="light">
                    <IconSunFill /> Light
                  </Menu.Item>
                  <Menu.Item key="dark">
                    <IconMoonFill /> Dark
                  </Menu.Item>
                  <Menu.Item key="auto">
                    <IconDesktop /> {t("system_follow")}
                  </Menu.Item>
                </Menu>
              }
              position="bl"
            >
              <Button
                type="text"
                size="small"
                icon={
                  <>
                    {lightMode === "auto" && <IconDesktop />}
                    {lightMode === "light" && <IconSunFill />}
                    {lightMode === "dark" && <IconMoonFill />}
                  </>
                }
                style={{
                  color: "var(--color-text-1)",
                }}
                className="!text-lg"
              />
            </Dropdown>
          </Space>
        </Layout.Header>
        <Layout
          className={`absolute top-50px bottom-0 w-full ${className}`}
          style={{
            background: "var(--color-fill-2)",
          }}
        >
          {children}
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default MainLayout;
