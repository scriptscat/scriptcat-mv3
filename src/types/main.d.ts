declare module "@App/types/scriptcat.d.ts";
declare module "*.tpl";
declare module "*.json";
declare module "*.yaml";

declare const sandbox: Window;

declare const self: ServiceWorkerGlobalScope;

declare namespace GMSend {
  interface XHRDetails {
    method?: "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";
    url: string;
    headers?: { [key: string]: string };
    data?: string | Array<XHRFormData>;
    cookie?: string;
    binary?: boolean;
    timeout?: number;
    context?: CONTEXT_TYPE;
    responseType?: "text" | "arraybuffer" | "blob" | "json" | "document" | "stream";
    overrideMimeType?: string;
    anonymous?: boolean;
    fetch?: boolean;
    user?: string;
    password?: string;
    nocache?: boolean;
    dataType?: "FormData" | "Blob";
    maxRedirects?: number;
  }

  interface XHRFormData {
    type?: "file" | "text";
    key: string;
    val: string;
    filename?: string;
  }
}
