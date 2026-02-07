import { WebPlugin } from "@capacitor/core";
import type { AgentPlugin, AgentStatus, ChatResult } from "./definitions";

/**
 * Web fallback implementation.
 *
 * On non-Electron platforms (iOS, Android, web), the agent runtime runs
 * on a server. This implementation delegates to the HTTP API.
 *
 * In Electron the Capacitor plugin bridge calls the native (main-process)
 * implementation via IPC instead — this web fallback is only used when
 * no native plugin is available.  If the page is served from a non-HTTP
 * origin (e.g. capacitor-electron://), relative fetches would hit the
 * app shell HTML, so we bail early.
 */
export class AgentWeb extends WebPlugin implements AgentPlugin {
  private apiBase(): string {
    const global = typeof window !== "undefined"
      ? (window as unknown as Record<string, unknown>).__MILAIDY_API_BASE__
      : undefined;
    return typeof global === "string" ? global : "";
  }

  /** True when we can reach the API via HTTP. */
  private canReachApi(): boolean {
    const base = this.apiBase();
    if (base) return true;
    // No explicit base — relative fetches only work on http(s) origins.
    if (typeof window === "undefined") return false;
    const proto = window.location.protocol;
    return proto === "http:" || proto === "https:";
  }

  async start(): Promise<AgentStatus> {
    if (!this.canReachApi()) {
      return { state: "not_started", agentName: null, port: null, startedAt: null, error: "No API endpoint" };
    }
    const res = await fetch(`${this.apiBase()}/api/agent/start`, { method: "POST" });
    const data = await res.json();
    return data.status ?? data;
  }

  async stop(): Promise<{ ok: boolean }> {
    if (!this.canReachApi()) {
      return { ok: false };
    }
    const res = await fetch(`${this.apiBase()}/api/agent/stop`, { method: "POST" });
    return res.json();
  }

  async getStatus(): Promise<AgentStatus> {
    if (!this.canReachApi()) {
      return { state: "not_started", agentName: null, port: null, startedAt: null, error: "No API endpoint" };
    }
    const res = await fetch(`${this.apiBase()}/api/status`);
    return res.json();
  }

  async chat(options: { text: string }): Promise<ChatResult> {
    if (!this.canReachApi()) {
      return { text: "Agent API not available", agentName: "System" };
    }
    const res = await fetch(`${this.apiBase()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: options.text }),
    });
    return res.json();
  }
}
