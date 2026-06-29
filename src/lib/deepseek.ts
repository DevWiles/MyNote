import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Tauri 下走插件 fetch（绕过浏览器 CORS），浏览器调试时退回原生 fetch
const httpFetch = isTauri ? tauriFetch : fetch;

const API_URL = "https://api.deepseek.com/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 调用 DeepSeek Chat Completions，返回助手回复文本 */
export async function deepseekChat(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  if (!apiKey) throw new Error("未配置 DeepSeek API Key，请到「设置」填写。");

  const res = await httpFetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "deepseek-chat",
      messages,
      stream: false,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek 请求失败（${res.status}）：${text || res.statusText}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek 返回内容为空。");
  return content as string;
}
