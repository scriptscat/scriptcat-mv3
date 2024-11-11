import * as path from "path";
import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { version } from "./package.json";

const isDev = process.env.NODE_ENV === "development";
const isBeta = version.includes("-");

// Target browsers, see: https://github.com/browserslist/browserslist
const targets = ["chrome >= 87", "edge >= 88", "firefox >= 78", "safari >= 14"];

const src = `${__dirname}/src`;
const dist = `${__dirname}/dist`;
const assets = `${src}/assets`;

export default defineConfig({
  ...(isDev
    ? {
        watch: true,
        mode: "development",
        devtool: "inline-source-map",
      }
    : {}),
  context: __dirname,
  entry: {
    service_worker: `${src}/service_worker.ts`,
    offscreen: `${src}/offscreen.ts`,
    sandbox: `${src}/sandbox.ts`,
    popup: `${src}/pages/popup/main.tsx`,
  },
  output: {
    path: `${dist}/ext/src`,
    filename: "[name].js",
    clean: true,
  },
  resolve: {
    extensions: ["...", ".ts", ".tsx", ".jsx"],
    alias: {
      "@App": path.resolve(__dirname, "src/"),
      "@Packages": path.resolve(__dirname, "packages/"),
    },
  },
  module: {
    rules: [
      {
        test: /\.(svg|png)$/,
        type: "asset",
      },
      {
        test: /\.(jsx?|tsx?)$/,
        use: [
          {
            loader: "builtin:swc-loader",
            options: {
              jsc: {
                parser: {
                  syntax: "typescript",
                  tsx: true,
                },
                transform: {
                  react: {
                    runtime: "automatic",
                    development: isDev,
                  },
                },
              },
              env: { targets },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new rspack.CopyRspackPlugin({
      patterns: [
        {
          from: `${src}/manifest.json`,
          to: `${dist}/ext`,
          // 将manifest.json内版本号替换为package.json中版本号
          transform(content: Buffer) {
            const manifest = JSON.parse(content.toString());
            if (isDev) {
              manifest.name = "ScriptCat - Dev";
              // manifest.content_security_policy = "script-src 'self' https://cdn.crowdin.com; object-src 'self'";
            }
            return JSON.stringify(manifest);
          },
        },
        {
          from: `${assets}/logo${isDev ? "-beta" : ""}.png`,
          to: `${dist}/ext/assets/logo.png`,
        },
        { from: `${assets}/logo`, to: `${dist}/ext/assets/logo` },
        {
          from: `${assets}/_locales`,
          to: `${dist}/ext/_locales`,
        },
      ],
    }),
    new rspack.HtmlRspackPlugin({
      filename: `${dist}/ext/src/popup.html`,
      template: `${src}/pages/popup/index.html`,
      inject: "head",
      title: "Home - ScriptCat",
      minify: true,
      chunks: ["popup"],
    }),
    new rspack.HtmlRspackPlugin({
      filename: `${dist}/ext/src/offscreen.html`,
      template: `${src}/pages/offscreen.html`,
      inject: "head",
      minify: true,
      chunks: ["offscreen"],
    }),
    new rspack.HtmlRspackPlugin({
      filename: `${dist}/ext/src/sandbox.html`,
      template: `${src}/pages/sandbox.html`,
      inject: "head",
      minify: true,
      chunks: ["sandbox"],
    }),
  ].filter(Boolean),
  optimization: {
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin(),
      new rspack.LightningCssMinimizerRspackPlugin({
        minimizerOptions: { targets },
      }),
    ],
  },
  experiments: {
    css: true,
  },
});
