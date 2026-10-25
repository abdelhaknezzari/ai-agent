import { useEffect, useState } from "react";
import type { AppConfig, CredentialInfo } from "@agent2026/shared";
import {
  Bot,
  Brain,
  Check,
  Cpu,
  Info,
  Monitor,
  Moon,
  Palette,
  Puzzle,
  Shield,
  SlidersHorizontal,
  Sun,
  User,
} from "lucide-react";
import { useSessionStore } from "@/stores/session-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { McpSettingsPanel } from "./mcp-settings-panel";
import { MemorySettingsPanel } from "./memory-settings-panel";

const SECTIONS = [
  { id: "section-models", label: "Models & Provider", icon: Cpu },
  { id: "section-agent", label: "Agent", icon: Bot },
  { id: "section-permissions", label: "Permissions", icon: Shield },
  { id: "section-appearance", label: "Appearance", icon: Palette },
  { id: "section-mcp", label: "MCP", icon: Puzzle },
  { id: "section-memory", label: "Long-term Memory", icon: Brain },
  { id: "section-advanced", label: "Advanced", icon: SlidersHorizontal },
  { id: "section-about", label: "About", icon: Info },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

type ProviderId = "openai" | "anthropic" | "custom";

const PROVIDER_PRESETS: Record<
  ProviderId,
  {
    label: string;
    format: "openai_compatible" | "anthropic";
    baseUrl: string;
    apiKeyEnv: string;
    models: string[];
  }
> = {
  openai: {
    label: "OpenAI",
    format: "openai_compatible",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    models: ["gpt-4.1", "gpt-4o"],
  },
  anthropic: {
    label: "Anthropic",
    format: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    models: ["claude-sonnet-4-5", "claude-3-5-haiku-latest"],
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    format: "openai_compatible",
    baseUrl: "http://127.0.0.1:11434/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    models: ["local-model"],
  },
};

function resolveProviderId(config: AppConfig): ProviderId {
  const id = config.providers.default;
  if (id === "openai" || id === "anthropic" || id === "custom") {
    return id;
  }
  return "openai";
}

function entryBaseUrl(config: AppConfig, providerId: string): string {
  const entry = config.providers.entries[providerId];
  if (entry && "baseUrl" in entry && typeof entry.baseUrl === "string") {
    return entry.baseUrl;
  }
  return PROVIDER_PRESETS[providerId as ProviderId]?.baseUrl ?? "";
}

function entryApiKeyEnv(config: AppConfig, providerId: string): string {
  const entry = config.providers.entries[providerId];
  return (
    entry?.apiKeyEnv ??
    PROVIDER_PRESETS[providerId as ProviderId]?.apiKeyEnv ??
    "OPENAI_API_KEY"
  );
}

function entryModels(config: AppConfig, providerId: string): string[] {
  const entry = config.providers.entries[providerId];
  if (entry?.models && entry.models.length > 0) {
    return entry.models;
  }
  return PROVIDER_PRESETS[providerId as ProviderId]?.models ?? [];
}

function isProviderConfigured(
  config: AppConfig,
  credentials: Record<string, CredentialInfo>,
  providerId: string,
): boolean {
  const entry = config.providers.entries[providerId];
  if (!entry) {
    return false;
  }
  const cred = credentials[entry.apiKeyEnv];
  return Boolean(cred?.configured);
}

export function SettingsPage() {
  const baseUrl = useSessionStore((s) => s.baseUrl);
  const health = useSessionStore((s) => s.health);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const config = useSettingsStore((s) => s.config);
  const credentials = useSettingsStore((s) => s.credentials);
  const system = useSettingsStore((s) => s.system);
  const loading = useSettingsStore((s) => s.loading);
  const saving = useSettingsStore((s) => s.saving);
  const error = useSettingsStore((s) => s.error);
  const saveHint = useSettingsStore((s) => s.saveHint);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const saveProvider = useSettingsStore((s) => s.saveProvider);
  const saveAgent = useSettingsStore((s) => s.saveAgent);
  const savePermissions = useSettingsStore((s) => s.savePermissions);
  const clearHints = useSettingsStore((s) => s.clearHints);

  const [active, setActive] = useState<SectionId>("section-models");
  const [appearanceHint, setAppearanceHint] = useState<string | null>(null);

  // Provider form
  const [providerId, setProviderId] = useState<ProviderId>("openai");
  const [providerBaseUrl, setProviderBaseUrl] = useState(
    PROVIDER_PRESETS.openai.baseUrl,
  );
  const [apiKeyEnv, setApiKeyEnv] = useState(PROVIDER_PRESETS.openai.apiKeyEnv);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [modelName, setModelName] = useState("gpt-4.1");

  // Agent form
  const [systemPrompt, setSystemPrompt] = useState("");
  const [httpFetch, setHttpFetch] = useState(true);
  const [readFile, setReadFile] = useState(true);
  const [maxTurns, setMaxTurns] = useState(10);
  const [maxToolCalls, setMaxToolCalls] = useState("");

  // Permissions form
  const [permMode, setPermMode] = useState<"default" | "ask_all" | "allowlist">(
    "default",
  );
  const [allowlistText, setAllowlistText] = useState("");

  useEffect(() => {
    if (!baseUrl) {
      return;
    }
    void hydrate(baseUrl);
  }, [baseUrl, hydrate]);

  useEffect(() => {
    if (!config) {
      return;
    }
    const id = resolveProviderId(config);
    setProviderId(id);
    setProviderBaseUrl(entryBaseUrl(config, id));
    setApiKeyEnv(entryApiKeyEnv(config, id));
    const modelRef = config.agents.default.model;
    const slash = modelRef.indexOf("/");
    setModelName(slash > 0 ? modelRef.slice(slash + 1) : modelRef);
    setApiKeyDraft("");

    setSystemPrompt(config.agents.default.systemPrompt);
    setHttpFetch(config.agents.default.tools.builtin.includes("http_fetch"));
    setReadFile(config.agents.default.tools.builtin.includes("read_file"));
    setMaxTurns(config.agents.default.maxTurns ?? 10);
    setMaxToolCalls(
      config.agents.default.maxToolCalls == null
        ? ""
        : String(config.agents.default.maxToolCalls),
    );

    setPermMode(config.permissions.mode);
    setAllowlistText(config.permissions.allowlist.join("\n"));
  }, [config]);

  const scrollTo = (id: SectionId) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const applyProviderPreset = (id: ProviderId) => {
    const preset = PROVIDER_PRESETS[id];
    setProviderId(id);
    setProviderBaseUrl(
      config ? entryBaseUrl(config, id) || preset.baseUrl : preset.baseUrl,
    );
    setApiKeyEnv(
      config ? entryApiKeyEnv(config, id) || preset.apiKeyEnv : preset.apiKeyEnv,
    );
    const models = config ? entryModels(config, id) : preset.models;
    setModelName(models[0] ?? preset.models[0] ?? "");
    setApiKeyDraft("");
    clearHints();
  };

  const credential = credentials[apiKeyEnv];
  const keyFromEnv = credential?.source === "env";
  const keyConfigured = Boolean(credential?.configured);

  const statusLine = error ?? saveHint ?? appearanceHint;

  return (
    <div data-settings-page className="flex h-full min-h-0 flex-col">
      <header className="topbar">
        <span className="topbar-title">Settings</span>
        <button type="button" className="avatar" aria-label="User menu">
          <User />
        </button>
      </header>

      <div className="content">
        <div className="settings-shell">
          <nav className="settings-sidebar" aria-label="Settings categories">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  className={`settings-sidebar-item${active === section.id ? " active" : ""}`}
                  data-settings-nav={section.id}
                  onClick={() => scrollTo(section.id)}
                >
                  <Icon aria-hidden />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="settings-content">
            {loading && !config ? (
              <p className="helper-text">Loading configuration…</p>
            ) : null}
            {statusLine ? (
              <p
                className="helper-text"
                data-settings-hint
                data-settings-error={error ? "true" : undefined}
              >
                {statusLine}
              </p>
            ) : null}

            <section className="settings-section" id="section-models">
              <div className="section-card">
                <div className="section-header">
                  <h2 className="section-title">Models & Provider</h2>
                  <p className="section-subtitle">
                    Set the Base URL, model name, and token. Supports OpenAI-compatible and Anthropic — takes effect on the next conversation. Use "Custom" for gateways like DeepSeek.
                  </p>
                </div>
                <div className="section-body">
                  <div className="field-group">
                    <span className="field-label">Default Provider</span>
                    <div className="provider-segment" role="radiogroup">
                      {(
                        [
                          ["openai", "OpenAI"],
                          ["anthropic", "Anthropic"],
                          ["custom", "Custom"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={providerId === id}
                          className={`provider-chip${providerId === id ? " active" : ""}`}
                          onClick={() => applyProviderPreset(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="provider-list">
                    <ProviderCard
                      name="OpenAI"
                      meta={
                        config
                          ? entryBaseUrl(config, "openai") ||
                            PROVIDER_PRESETS.openai.baseUrl
                          : PROVIDER_PRESETS.openai.baseUrl
                      }
                      configured={
                        config
                          ? isProviderConfigured(config, credentials, "openai")
                          : false
                      }
                      onEdit={() => applyProviderPreset("openai")}
                    />
                    <ProviderCard
                      name="Anthropic"
                      meta={
                        config
                          ? entryBaseUrl(config, "anthropic") ||
                            PROVIDER_PRESETS.anthropic.baseUrl
                          : PROVIDER_PRESETS.anthropic.baseUrl
                      }
                      configured={
                        config
                          ? isProviderConfigured(config, credentials, "anthropic")
                          : false
                      }
                      onEdit={() => applyProviderPreset("anthropic")}
                    />
                    <ProviderCard
                      name="Custom"
                      meta={
                        config
                          ? entryBaseUrl(config, "custom") || "Not set"
                          : "Not set"
                      }
                      configured={
                        config
                          ? isProviderConfigured(config, credentials, "custom")
                          : false
                      }
                      onEdit={() => applyProviderPreset("custom")}
                    />
                  </div>

                  <div className="field-group input-medium">
                    <label className="field-label" htmlFor="api-base-url">
                      API Base URL
                    </label>
                    <input
                      className="text-input"
                      id="api-base-url"
                      value={providerBaseUrl}
                      onChange={(e) => {
                        setProviderBaseUrl(e.target.value);
                        clearHints();
                      }}
                      autoComplete="off"
                    />
                  </div>

                  <div className="field-group input-medium">
                    <label className="field-label" htmlFor="api-key">
                      API Key (write-only)
                    </label>
                    <input
                      className="text-input"
                      id="api-key"
                      type="password"
                      value={apiKeyDraft}
                      disabled={keyFromEnv}
                      placeholder={
                        keyFromEnv
                          ? "Provided by environment variable (read-only)"
                          : keyConfigured
                            ? "Configured — enter a new value to replace"
                            : "Enter API Key"
                      }
                      autoComplete="off"
                      onChange={(e) => {
                        setApiKeyDraft(e.target.value);
                        clearHints();
                      }}
                    />
                    {keyConfigured ? (
                      <span className="badge badge-success" style={{ marginTop: 8 }}>
                        <Check width={12} height={12} aria-hidden />
                        {keyFromEnv ? "Configured (env var)" : "Configured"}
                      </span>
                    ) : (
                      <span className="badge badge-muted" style={{ marginTop: 8 }}>
                        Not configured
                      </span>
                    )}
                  </div>

                  <div className="field-group input-short">
                    <label className="field-label" htmlFor="api-key-env">
                      Env var name
                    </label>
                    <input
                      className="text-input"
                      id="api-key-env"
                      value={apiKeyEnv}
                      onChange={(e) => {
                        setApiKeyEnv(e.target.value);
                        setApiKeyDraft("");
                        clearHints();
                      }}
                    />
                    <span className="field-hint">
                      The environment variable name used to read credentials at runtime.
                    </span>
                  </div>

                  <div className="field-group input-medium">
                    <label className="field-label" htmlFor="model-name">
                      Model name
                    </label>
                    <input
                      className="text-input"
                      id="model-name"
                      value={modelName}
                      onChange={(e) => {
                        setModelName(e.target.value);
                        clearHints();
                      }}
                      autoComplete="off"
                      placeholder="gpt-4.1"
                    />
                    <span className="field-hint">
                      Saved as {providerId}/{modelName.trim() || "…"} — switch between saved models in the workbench.
                    </span>
                  </div>

                  <div className="action-row">
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={saving || !providerBaseUrl.trim() || !apiKeyEnv.trim() || !modelName.trim()}
                      data-settings-save-provider
                      onClick={() => {
                        if (!baseUrl) {
                          return;
                        }
                        setAppearanceHint(null);
                        const preset = PROVIDER_PRESETS[providerId];
                        const existing = config
                          ? entryModels(config, providerId)
                          : [];
                        void saveProvider(baseUrl, {
                          providerId,
                          format: preset.format,
                          baseUrl: providerBaseUrl.trim(),
                          apiKeyEnv: apiKeyEnv.trim(),
                          model: `${providerId}/${modelName.trim()}`,
                          models:
                            existing.length > 0
                              ? existing.includes(modelName.trim())
                                ? existing
                                : [...existing, modelName.trim()]
                              : [modelName.trim()],
                          apiKey: keyFromEnv ? undefined : apiKeyDraft || undefined,
                        }).then(() => setApiKeyDraft(""));
                      }}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <span className="helper-text">Saved — takes effect on the next conversation</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="settings-section" id="section-agent">
              <div className="section-card">
                <div className="section-header">
                  <h2 className="section-title">Agent</h2>
                  <p className="section-subtitle">
                    Adjust system prompt, built-in tool toggles, and call limits.
                  </p>
                </div>
                <div className="section-body">
                  <div className="field-group">
                    <label className="field-label" htmlFor="system-prompt">
                      System prompt
                    </label>
                    <textarea
                      className="textarea"
                      id="system-prompt"
                      value={systemPrompt}
                      onChange={(e) => {
                        setSystemPrompt(e.target.value);
                        clearHints();
                      }}
                    />
                  </div>

                  <div className="field-group">
                    <span className="field-label">Built-in tools</span>
                    <div className="switch-row">
                      <div className="switch-label">
                        <span className="switch-title">http_fetch</span>
                        <span className="switch-desc">
                          Allow the Agent to make HTTP requests to fetch web content
                        </span>
                      </div>
                      <label className="switch" aria-label="Enable http_fetch">
                        <input
                          type="checkbox"
                          checked={httpFetch}
                          onChange={(e) => {
                            setHttpFetch(e.target.checked);
                            clearHints();
                          }}
                        />
                        <span className="slider" />
                      </label>
                    </div>
                    <div className="switch-row">
                      <div className="switch-label">
                        <span className="switch-title">read_file</span>
                        <span className="switch-desc">
                          Allow the Agent to read local file contents
                        </span>
                      </div>
                      <label className="switch" aria-label="Enable read_file">
                        <input
                          type="checkbox"
                          checked={readFile}
                          onChange={(e) => {
                            setReadFile(e.target.checked);
                            clearHints();
                          }}
                        />
                        <span className="slider" />
                      </label>
                    </div>
                  </div>

                  <div className="field-row">
                    <div className="field-group input-short">
                      <label className="field-label" htmlFor="max-turns">
                        maxTurns
                      </label>
                      <input
                        className="text-input"
                        id="max-turns"
                        type="number"
                        value={maxTurns}
                        min={1}
                        max={50}
                        onChange={(e) => {
                          setMaxTurns(Number(e.target.value) || 1);
                          clearHints();
                        }}
                      />
                    </div>
                    <div className="field-group input-short">
                      <label className="field-label" htmlFor="max-tool-calls">
                        maxToolCalls
                      </label>
                      <input
                        className="text-input"
                        id="max-tool-calls"
                        type="number"
                        placeholder="No limit"
                        value={maxToolCalls}
                        onChange={(e) => {
                          setMaxToolCalls(e.target.value);
                          clearHints();
                        }}
                      />
                    </div>
                  </div>

                  <div className="action-row">
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={saving}
                      data-settings-save-agent
                      onClick={() => {
                        if (!baseUrl) {
                          return;
                        }
                        setAppearanceHint(null);
                        const builtin: Array<"http_fetch" | "read_file"> = [];
                        if (httpFetch) {
                          builtin.push("http_fetch");
                        }
                        if (readFile) {
                          builtin.push("read_file");
                        }
                        const parsedCalls = maxToolCalls.trim()
                          ? Number(maxToolCalls)
                          : null;
                        void saveAgent(baseUrl, {
                          systemPrompt,
                          builtin,
                          maxTurns,
                          maxToolCalls:
                            parsedCalls != null && Number.isFinite(parsedCalls)
                              ? parsedCalls
                              : null,
                        });
                      }}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="settings-section" id="section-permissions">
              <div className="section-card">
                <div className="section-header">
                  <h2 className="section-title">Permissions</h2>
                  <p className="section-subtitle">
                    Control the confirmation policy when the Agent executes sensitive operations.
                  </p>
                </div>
                <div className="section-body">
                  <div className="field-group input-medium">
                    <label className="field-label" htmlFor="perm-mode">
                      Permission mode
                    </label>
                    <select
                      className="select"
                      id="perm-mode"
                      value={permMode}
                      onChange={(e) => {
                        setPermMode(
                          e.target.value as "default" | "ask_all" | "allowlist",
                        );
                        clearHints();
                      }}
                    >
                      <option value="default">default</option>
                      <option value="ask_all">ask_all</option>
                      <option value="allowlist">allowlist</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="allowlist">
                      Allowlist
                    </label>
                    <textarea
                      className="textarea"
                      id="allowlist"
                      placeholder={"http_fetch\nread_file"}
                      value={allowlistText}
                      onChange={(e) => {
                        setAllowlistText(e.target.value);
                        clearHints();
                      }}
                    />
                    <span className="field-hint">
                      One tool name per line; only active in allowlist mode.
                    </span>
                  </div>
                  <div className="action-row">
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={saving}
                      data-settings-save-permissions
                      onClick={() => {
                        if (!baseUrl) {
                          return;
                        }
                        setAppearanceHint(null);
                        void savePermissions(baseUrl, {
                          mode: permMode,
                          allowlist: allowlistText
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean),
                        });
                      }}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="settings-section" id="section-appearance">
              <div className="section-card">
                <div className="section-header">
                  <h2 className="section-title">Appearance</h2>
                  <p className="section-subtitle">Theme preference is saved locally and takes effect immediately.</p>
                </div>
                <div className="section-body">
                  <div className="field-group">
                    <span className="field-label">Theme</span>
                    <div className="theme-grid">
                      {(
                        [
                          ["light", "Light", Sun],
                          ["dark", "Dark", Moon],
                          ["system", "System", Monitor],
                        ] as const
                      ).map(([id, label, Icon]) => (
                        <button
                          key={id}
                          type="button"
                          className={`theme-card${theme === id ? " active" : ""}`}
                          data-theme-option={id}
                          onClick={() => {
                            setTheme(id);
                            setAppearanceHint("Theme applied");
                            clearHints();
                          }}
                        >
                          <Icon aria-hidden />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field-group input-short">
                    <label className="field-label" htmlFor="font">
                      Font
                    </label>
                    <select className="select" id="font" defaultValue="system" disabled>
                      <option value="system">System default</option>
                    </select>
                  </div>
                  <div className="action-row">
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => setAppearanceHint("Theme applied")}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="settings-section" id="section-mcp">
              <div className="section-card">
                <div className="section-header">
                  <h2 className="section-title">MCP</h2>
                  <p className="section-subtitle">
                    Model Context Protocol server configuration.
                  </p>
                </div>
                <div className="section-body">
                  {config && baseUrl ? (
                    <McpSettingsPanel baseUrl={baseUrl} config={config} />
                  ) : (
                    <p className="helper-text">Loading configuration…</p>
                  )}
                </div>
              </div>
            </section>

            <section className="settings-section" id="section-memory">
              <div className="section-card">
                <div className="section-header">
                  <h2 className="section-title">Long-term Memory</h2>
                  <p className="section-subtitle">
                    Cross-session retrieval / write via OpenViking (AGPLv3, optional)
                  </p>
                </div>
                <div className="section-body">
                  {config && baseUrl ? (
                    <MemorySettingsPanel
                      baseUrl={baseUrl}
                      config={config}
                      onScrollToModels={() => scrollTo("section-models")}
                    />
                  ) : (
                    <p className="helper-text">Loading configuration…</p>
                  )}
                </div>
              </div>
            </section>

            <section className="settings-section" id="section-advanced">
              <div className="section-card">
                <div className="section-header">
                  <h2 className="section-title">Advanced</h2>
                  <p className="section-subtitle">Toggles for debugging and experimental features.</p>
                </div>
                <div className="section-body">
                  <div className="switch-row">
                    <div className="switch-label">
                      <span className="switch-title">Developer mode</span>
                      <span className="switch-desc">Restricted · available later</span>
                    </div>
                    <label className="switch" aria-label="Developer mode">
                      <input type="checkbox" disabled />
                      <span className="slider" />
                    </label>
                  </div>
                  <div className="advanced-box">
                    <span className="helper-text">
                      A2A, Hooks, and more advanced options will be added here.
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="settings-section" id="section-about">
              <div className="section-card">
                <div className="section-header">
                  <h2 className="section-title">About</h2>
                  <p className="section-subtitle">Runtime and local configuration paths.</p>
                </div>
                <div className="section-body">
                  <dl className="about-list">
                    <div className="about-row">
                      <dt>Version</dt>
                      <dd>{system?.version ?? "0.0.0"}</dd>
                    </div>
                    <div className="about-row">
                      <dt>Server base URL</dt>
                      <dd>{baseUrl || "—"}</dd>
                    </div>
                    <div className="about-row">
                      <dt>health</dt>
                      <dd>{health}</dd>
                    </div>
                    <div className="about-row">
                      <dt>Config path</dt>
                      <dd>{system?.configPath ?? "~/.agent2026/config.yaml"}</dd>
                    </div>
                    <div className="about-row">
                      <dt>Credentials path</dt>
                      <dd>
                        {system?.credentialsPath ?? "~/.agent2026/credentials.yaml"}
                      </dd>
                    </div>
                  </dl>
                  <div className="action-row">
                    <button className="btn btn-primary" type="button" disabled>
                      <Check width={16} height={16} aria-hidden />
                      Check for updates
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderCard({
  name,
  meta,
  configured,
  onEdit,
}: {
  name: string;
  meta: string;
  configured: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="provider-card">
      <div className="provider-info">
        <span className="provider-name">{name}</span>
        <span className="provider-meta">{meta}</span>
      </div>
      <div className="action-row">
        {configured ? (
          <span className="badge badge-success">
            <Check width={12} height={12} aria-hidden />
            Configured
          </span>
        ) : (
          <span className="badge badge-muted">Not configured</span>
        )}
        <button className="btn btn-secondary btn-sm" type="button" onClick={onEdit}>
          Edit
        </button>
      </div>
    </div>
  );
}
