import { useMemo, useState } from "react";
import type { AppConfig, McpServerConfig, McpServerStatusView } from "@agent2026/shared";
import {
  Box,
  ChevronDown,
  ChevronUp,
  Globe,
  Pencil,
  Plus,
  Puzzle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";

type McpFormState = {
  previousName?: string;
  name: string;
  transport: "stdio" | "http";
  enabled: boolean;
  mount: boolean;
  command: string;
  argsText: string;
  envText: string;
  cwd: string;
  url: string;
  headersText: string;
  httpSubtype: "streamable" | "sse";
};

const EMPTY_FORM: McpFormState = {
  name: "",
  transport: "stdio",
  enabled: true,
  mount: true,
  command: "npx",
  argsText: "-y\n@modelcontextprotocol/server-filesystem\n/path/to/workspace",
  envText: "",
  cwd: "",
  url: "http://localhost:1933/mcp",
  headersText: "",
  httpSubtype: "streamable",
};

function statusLabel(status: McpServerStatusView["status"]): string {
  switch (status) {
    case "ready":
      return "ready";
    case "connecting":
      return "connecting";
    case "error":
      return "error";
    case "disabled":
      return "disabled";
    case "closed":
      return "closed";
    default:
      return status;
  }
}

function summarizeServer(config: McpServerConfig): string {
  if (config.transport === "stdio") {
    const args = config.args.slice(0, 2).join(" ");
    return `${config.command}${args ? ` ${args}` : ""}${config.args.length > 2 ? "…" : ""}`;
  }
  return config.url;
}

function parseArgs(text: string): string[] {
  return text
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseEnv(text: string): Record<string, string> | undefined {
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return Object.keys(env).length > 0 ? env : undefined;
}

function parseHeaders(text: string): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf(":");
    if (sep <= 0) continue;
    headers[trimmed.slice(0, sep).trim()] = trimmed.slice(sep + 1).trim();
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function headersToText(headers?: Record<string, string>): string {
  if (!headers) return "";
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function envToText(env?: Record<string, string>): string {
  if (!env) return "";
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function toServerConfig(form: McpFormState): McpServerConfig {
  if (form.transport === "stdio") {
    return {
      transport: "stdio",
      command: form.command.trim(),
      args: parseArgs(form.argsText),
      env: parseEnv(form.envText),
      cwd: form.cwd.trim() ? form.cwd.trim() : null,
      enabled: form.enabled,
    };
  }
  return {
    transport: "http",
    url: form.url.trim(),
    headers: parseHeaders(form.headersText),
    httpSubtype: form.httpSubtype,
    enabled: form.enabled,
  };
}

function formFromConfig(
  name: string,
  config: McpServerConfig,
  mount: boolean,
): McpFormState {
  if (config.transport === "stdio") {
    return {
      previousName: name,
      name,
      transport: "stdio",
      enabled: config.enabled,
      mount,
      command: config.command,
      argsText: config.args.join("\n"),
      envText: envToText(config.env),
      cwd: config.cwd ?? "",
      url: "http://localhost:1933/mcp",
      headersText: "",
      httpSubtype: "streamable",
    };
  }
  return {
    previousName: name,
    name,
    transport: "http",
    enabled: config.enabled,
    mount,
    command: "npx",
    argsText: "",
    envText: "",
    cwd: "",
    url: config.url,
    headersText: headersToText(config.headers),
    httpSubtype: config.httpSubtype ?? "streamable",
  };
}

export function McpSettingsPanel({
  baseUrl,
  config,
}: {
  baseUrl: string;
  config: AppConfig;
}) {
  const mcpStatus = useSettingsStore((s) => s.mcpStatus);
  const saving = useSettingsStore((s) => s.saving);
  const saveMcpServer = useSettingsStore((s) => s.saveMcpServer);
  const deleteMcpServer = useSettingsStore((s) => s.deleteMcpServer);
  const setMcpEnabled = useSettingsStore((s) => s.setMcpEnabled);
  const refreshMcpTools = useSettingsStore((s) => s.refreshMcpTools);
  const refreshMcpStatus = useSettingsStore((s) => s.refreshMcpStatus);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<McpFormState>(EMPTY_FORM);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const servers = useMemo(
    () => Object.entries(config.mcpServers ?? {}),
    [config.mcpServers],
  );
  const mounted = new Set(config.agents.default.tools.mcpServers);
  const statusByName = useMemo(() => {
    const map = new Map<string, McpServerStatusView>();
    for (const entry of mcpStatus) {
      map.set(entry.name, entry);
    }
    return map;
  }, [mcpStatus]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (name: string, serverConfig: McpServerConfig) => {
    setForm(formFromConfig(name, serverConfig, mounted.has(name)));
    setFormError(null);
    setFormOpen(true);
  };

  const refreshToolLists = async () => {
    const enabledNames = servers
      .filter(([, serverConfig]) => serverConfig.enabled)
      .map(([name]) => name);
    if (enabledNames.length === 0) {
      await refreshMcpStatus(baseUrl);
      return;
    }
    for (const name of enabledNames) {
      try {
        await refreshMcpTools(baseUrl, name);
      } catch {
        // Continue remaining servers; store already records the error.
      }
    }
  };

  const onSave = async () => {
    const name = form.name.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      setFormError("Name must match [a-zA-Z0-9_-]+");
      return;
    }
    if (form.transport === "stdio" && !form.command.trim()) {
      setFormError("stdio requires a command");
      return;
    }
    if (form.transport === "http" && !form.url.trim()) {
      setFormError("http requires a url");
      return;
    }
    try {
      await saveMcpServer(baseUrl, {
        previousName: form.previousName,
        name,
        config: toServerConfig(form),
        mount: form.mount,
      });
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="mcp-panel">
      <div className="mcp-toolbar">
        <p className="mcp-toolbar-hint">
          Disabled immediately — not provided to the Agent.
        </p>
        <div className="mcp-toolbar-actions">
          <button
            className="btn btn-secondary"
            type="button"
            disabled={saving || !baseUrl}
            onClick={() => void refreshToolLists()}
          >
            <RefreshCw width={14} height={14} aria-hidden />
            Refresh tool list
          </button>
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            <Plus width={14} height={14} aria-hidden />
            Add MCP
          </button>
        </div>
      </div>

      {servers.length === 0 && !formOpen ? (
        <div className="mcp-card">
          <Puzzle width={20} height={20} aria-hidden />
          <div>
            <p className="mcp-empty-text">
              No MCP Servers configured yet. Add a local stdio or remote HTTP MCP — then view connection status and discovered tools here.
            </p>
            <button type="button" className="mcp-link" onClick={openCreate}>
              Add your first MCP
            </button>
          </div>
        </div>
      ) : null}

      <ul className="mcp-server-list">
        {servers.map(([name, serverConfig]) => {
          const status = statusByName.get(name);
          const resolvedStatus = serverConfig.enabled
            ? (status?.status ?? "closed")
            : "disabled";
          const isExpanded = expanded === name;
          const TransportIcon =
            serverConfig.transport === "http" ? Globe : Box;
          const showToolCount =
            resolvedStatus === "ready" && status != null;

          return (
            <li
              key={name}
              className={`mcp-server-row${serverConfig.enabled ? "" : " is-disabled"}`}
            >
              <div className="mcp-server-main">
                <div className="mcp-server-icon" aria-hidden>
                  <TransportIcon width={18} height={18} />
                </div>
                <div className="mcp-server-meta">
                  <div className="mcp-server-title">
                    <strong>{name}</strong>
                    <span className="mcp-badge">
                      {serverConfig.transport.toUpperCase()}
                    </span>
                  </div>
                  <div className="mcp-server-summary">
                    {summarizeServer(serverConfig)}
                  </div>
                  {name === "openviking" ? (
                    <div className="mcp-managed-hint">
                      Managed by Long-term Memory
                    </div>
                  ) : null}
                  {status?.lastError && resolvedStatus === "error" ? (
                    <div className="mcp-error">{status.lastError}</div>
                  ) : null}
                </div>
                <div
                  className={`mcp-status-pill mcp-status-${resolvedStatus}`}
                >
                  <span className="mcp-status-dot" aria-hidden />
                  <span>{statusLabel(resolvedStatus)}</span>
                </div>
                {showToolCount ? (
                  <div className="mcp-tool-count">
                    {status.toolCount} tools
                  </div>
                ) : (
                  <div className="mcp-tool-count mcp-tool-count-spacer" aria-hidden />
                )}
                <div className="mcp-server-actions">
                  <label className="switch" aria-label={`Enable ${name}`}>
                    <input
                      type="checkbox"
                      checked={serverConfig.enabled}
                      disabled={saving}
                      onChange={(event) => {
                        void setMcpEnabled(baseUrl, name, event.target.checked);
                      }}
                    />
                    <span className="slider" />
                  </label>
                  <button
                    type="button"
                    className="mcp-icon-btn"
                    aria-label={`Edit ${name}`}
                    onClick={() => openEdit(name, serverConfig)}
                  >
                    <Pencil width={15} height={15} />
                  </button>
                  <button
                    type="button"
                    className="mcp-icon-btn"
                    disabled={saving}
                    aria-label={`Delete ${name}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete MCP "${name}"? The configuration will be removed and the connection will be dropped if enabled.`,
                        )
                      ) {
                        void deleteMcpServer(baseUrl, name);
                      }
                    }}
                  >
                    <Trash2 width={15} height={15} />
                  </button>
                  <button
                    type="button"
                    className="mcp-icon-btn"
                    aria-label={isExpanded ? `Collapse ${name} tools` : `Expand ${name} tools`}
                    aria-expanded={isExpanded}
                    onClick={() => setExpanded(isExpanded ? null : name)}
                  >
                    {isExpanded ? (
                      <ChevronUp width={16} height={16} />
                    ) : (
                      <ChevronDown width={16} height={16} />
                    )}
                  </button>
                </div>
              </div>
              {isExpanded ? (
                <div className="mcp-tools">
                  <div className="mcp-tools-meta">
                    {mounted.has(name) ? "Mounted to current Agent" : "Not mounted to current Agent"}
                  </div>
                  {!serverConfig.enabled ? (
                    <p className="helper-text">Disabled, not connected.</p>
                  ) : status?.status === "error" ? (
                    <p className="helper-text">
                      Connection failed: {status.lastError ?? "unknown error"}. Check the command/URL/auth and refresh the tool list.
                    </p>
                  ) : status?.tools.length ? (
                    <ul>
                      {status.tools.map((tool) => (
                        <li key={tool.name}>
                          <code>{tool.name}</code>
                          {tool.description ? (
                            <span> — {tool.description}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="helper-text">
                      {status?.status === "ready"
                        ? "Connected, no tools"
                        : "Waiting for connection…"}
                    </p>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {formOpen ? (
        <div className="mcp-form">
          <h3 className="mcp-form-title">
            {form.previousName ? `Edit ${form.previousName}` : "Add MCP"}
          </h3>
          {formError ? <p className="field-error">{formError}</p> : null}
          <div className="field-grid">
            <div className="field">
              <label className="field-label" htmlFor="mcp-name">
                Name (key)
              </label>
              <input
                id="mcp-name"
                className="input"
                value={form.name}
                disabled={Boolean(form.previousName)}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="mcp-transport">
                Transport type
              </label>
              <select
                id="mcp-transport"
                className="select"
                value={form.transport}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    transport: event.target.value as "stdio" | "http",
                  }))
                }
              >
                <option value="stdio">stdio</option>
                <option value="http">http</option>
              </select>
            </div>
          </div>

          {form.transport === "stdio" ? (
            <>
              <div className="field">
                <label className="field-label" htmlFor="mcp-command">
                  Command
                </label>
                <input
                  id="mcp-command"
                  className="input"
                  value={form.command}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, command: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="mcp-args">
                  Args (one per line)
                </label>
                <textarea
                  id="mcp-args"
                  className="textarea"
                  rows={3}
                  value={form.argsText}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, argsText: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="mcp-env">
                  Env non-secret key=value (one per line)
                </label>
                <textarea
                  id="mcp-env"
                  className="textarea"
                  rows={2}
                  value={form.envText}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, envText: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="mcp-cwd">
                  cwd (optional)
                </label>
                <input
                  id="mcp-cwd"
                  className="input"
                  value={form.cwd}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, cwd: event.target.value }))
                  }
                />
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label className="field-label" htmlFor="mcp-url">
                  URL
                </label>
                <input
                  id="mcp-url"
                  className="input"
                  value={form.url}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, url: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="mcp-headers">
                  Headers (Key: Value, one per line; sensitive values masked)
                </label>
                <textarea
                  id="mcp-headers"
                  className="textarea"
                  rows={3}
                  value={form.headersText}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      headersText: event.target.value,
                    }))
                  }
                />
                <p className="helper-text">
                  Do not store long-lived secrets in config; prefer credential references. Saving a masked string preserves the original key.
                </p>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="mcp-subtype">
                  HTTP dialect
                </label>
                <select
                  id="mcp-subtype"
                  className="select"
                  value={form.httpSubtype}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      httpSubtype: event.target.value as "streamable" | "sse",
                    }))
                  }
                >
                  <option value="streamable">Streamable HTTP (default)</option>
                  <option value="sse">SSE</option>
                </select>
              </div>
            </>
          )}

          <div className="switch-row">
            <div className="switch-label">
              <span className="switch-title">Enable</span>
              <span className="switch-desc">Disabling disconnects and removes from ToolPort</span>
            </div>
            <label className="switch" aria-label="Enable MCP">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, enabled: event.target.checked }))
                }
              />
              <span className="slider" />
            </label>
          </div>
          <div className="switch-row">
            <div className="switch-label">
              <span className="switch-title">Mount to current Agent</span>
              <span className="switch-desc">
                Writes to agents.default.tools.mcpServers
              </span>
            </div>
            <label className="switch" aria-label="Mount to Agent">
              <input
                type="checkbox"
                checked={form.mount}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, mount: event.target.checked }))
                }
              />
              <span className="slider" />
            </label>
          </div>

          <div className="action-row">
            <button
              className="btn btn-primary"
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
            >
              Save
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
