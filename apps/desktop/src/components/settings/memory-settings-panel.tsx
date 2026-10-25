import { useEffect, useState } from "react";
import type {
  AppConfig,
  DistillStatusView,
  OpenVikingStatus,
} from "@agent2026/shared";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";

const OPENVIKING_RUNTIME_README_URL =
  "https://github.com/rainbowchenx/ai-agent/blob/main/packages/openviking-runtime/README.md";
const OPENVIKING_MCP_URL_DISPLAY = "http://127.0.0.1:1933/mcp";
const DEFAULT_EMBEDDING_API_KEY_ENV = "OPENVIKING_EMBEDDING_API_KEY";

function statusPillClass(status: OpenVikingStatus): string {
  switch (status) {
    case "ready":
      return "mcp-status-ready";
    case "starting":
      return "mcp-status-connecting";
    case "error":
    case "needs_config":
      return "mcp-status-error";
    case "stopped":
    default:
      return "mcp-status-closed";
  }
}

function statusDetailText(
  status: OpenVikingStatus,
  ownedProcess: boolean,
  lastError?: string,
): string | null {
  if (status === "ready") {
    return ownedProcess ? "Launched by this process" : "Reusing existing service";
  }
  if (lastError) {
    return lastError;
  }
  if (status === "needs_config") {
    return "Requires a separate Embedding endpoint and Provider API Key";
  }
  if (status === "starting") {
    return "Starting…";
  }
  return null;
}

function distillStatusText(status: DistillStatusView): string | null {
  if (status.lastStatus === "idle") {
    return null;
  }
  const parts: string[] = [`Last distill: ${status.lastStatus}`];
  if (status.lastWritten != null) {
    parts.push(`written ${status.lastWritten}`);
  }
  if (status.lastMessage) {
    parts.push(status.lastMessage);
  }
  return parts.join(" · ");
}

export function MemorySettingsPanel({
  baseUrl,
  config,
  onScrollToModels,
}: {
  baseUrl: string;
  config: AppConfig;
  onScrollToModels: () => void;
}) {
  const openVikingStatus = useSettingsStore((s) => s.openVikingStatus);
  const distillStatus = useSettingsStore((s) => s.distillStatus);
  const credentials = useSettingsStore((s) => s.credentials);
  const saving = useSettingsStore((s) => s.saving);
  const setOpenVikingEnabled = useSettingsStore((s) => s.setOpenVikingEnabled);
  const setAutoDistill = useSettingsStore((s) => s.setAutoDistill);
  const setAutoRecall = useSettingsStore((s) => s.setAutoRecall);
  const saveOpenVikingEmbedding = useSettingsStore(
    (s) => s.saveOpenVikingEmbedding,
  );
  const saveOpenVikingOverrides = useSettingsStore(
    (s) => s.saveOpenVikingOverrides,
  );
  const refreshOpenVikingStatus = useSettingsStore(
    (s) => s.refreshOpenVikingStatus,
  );
  const retryOpenVikingStatus = useSettingsStore(
    (s) => s.retryOpenVikingStatus,
  );

  const enabled =
    openVikingStatus?.enabled ??
    config.mcpServers?.openviking?.enabled === true;
  const autoDistill = config.openviking?.autoDistill !== false;
  const autoRecall = config.openviking?.autoRecall !== false;

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [embBaseUrl, setEmbBaseUrl] = useState(
    config.openviking?.embedding?.baseUrl ?? "",
  );
  const [embModel, setEmbModel] = useState(
    config.openviking?.embedding?.model ??
      config.openviking?.embeddingModel ??
      "",
  );
  const [embApiKeyEnv, setEmbApiKeyEnv] = useState(
    config.openviking?.embedding?.apiKeyEnv ?? DEFAULT_EMBEDDING_API_KEY_ENV,
  );
  const [embDimension, setEmbDimension] = useState(
    config.openviking?.embedding?.dimension != null
      ? String(config.openviking.embedding.dimension)
      : config.openviking?.embeddingDimension != null
        ? String(config.openviking.embeddingDimension)
        : "",
  );
  const [embApiKeyDraft, setEmbApiKeyDraft] = useState("");
  const [vlmModel, setVlmModel] = useState(config.openviking?.vlmModel ?? "");

  useEffect(() => {
    setEmbBaseUrl(config.openviking?.embedding?.baseUrl ?? "");
    setEmbModel(
      config.openviking?.embedding?.model ??
        config.openviking?.embeddingModel ??
        "",
    );
    setEmbApiKeyEnv(
      config.openviking?.embedding?.apiKeyEnv ?? DEFAULT_EMBEDDING_API_KEY_ENV,
    );
    setEmbDimension(
      config.openviking?.embedding?.dimension != null
        ? String(config.openviking.embedding.dimension)
        : config.openviking?.embeddingDimension != null
          ? String(config.openviking.embeddingDimension)
          : "",
    );
    setVlmModel(config.openviking?.vlmModel ?? "");
  }, [
    config.openviking?.embedding?.baseUrl,
    config.openviking?.embedding?.model,
    config.openviking?.embedding?.apiKeyEnv,
    config.openviking?.embedding?.dimension,
    config.openviking?.embeddingModel,
    config.openviking?.embeddingDimension,
    config.openviking?.vlmModel,
  ]);

  useEffect(() => {
    if (!baseUrl || openVikingStatus?.status !== "starting") {
      return;
    }
    const id = window.setInterval(() => {
      void refreshOpenVikingStatus(baseUrl);
    }, 2000);
    return () => window.clearInterval(id);
  }, [baseUrl, openVikingStatus?.status, refreshOpenVikingStatus]);

  const status = openVikingStatus?.status ?? "stopped";
  const ovReady = status === "ready";
  const detail = openVikingStatus
    ? statusDetailText(
        openVikingStatus.status,
        openVikingStatus.ownedProcess,
        openVikingStatus.lastError,
      )
    : null;
  const mcpUrl = openVikingStatus?.mcpUrl ?? OPENVIKING_MCP_URL_DISPLAY;
  const lastDistill = distillStatus ? distillStatusText(distillStatus) : null;
  const embCredential = credentials[embApiKeyEnv.trim()];
  const embKeyFromEnv = embCredential?.source === "env";

  return (
    <div className="memory-panel" data-settings-memory-panel>
      <div className="switch-row">
        <div className="switch-label">
          <span className="switch-title">Enable OpenViking</span>
          <span className="switch-desc">
            When enabled, the Agent can read and write memories across sessions via openviking__* tools
          </span>
        </div>
        <label className="switch" aria-label="Enable OpenViking">
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving || !baseUrl}
            onChange={(event) => {
              void setOpenVikingEnabled(baseUrl, event.target.checked);
            }}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="switch-row">
        <div className="switch-label">
          <span className="switch-title">Auto-distill after run</span>
          <span className="switch-desc">
            Write key points from this conversation to OpenViking (requires service to be ready)
          </span>
          {!ovReady ? (
            <span className="switch-desc memory-distill-inactive">
              Currently inactive: OpenViking not ready
            </span>
          ) : null}
          {lastDistill ? (
            <span className="switch-desc memory-distill-last">{lastDistill}</span>
          ) : null}
        </div>
        <label className="switch" aria-label="Auto-distill after run">
          <input
            type="checkbox"
            checked={autoDistill}
            disabled={saving || !baseUrl}
            onChange={(event) => {
              void setAutoDistill(baseUrl, event.target.checked);
            }}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="switch-row">
        <div className="switch-label">
          <span className="switch-title">Auto-recall long-term memory</span>
          <span className="switch-desc">
            Retrieve relevant frozen memories at the start of a new session and inject them; reused within the same session, trigger phrases can refresh
          </span>
          {!ovReady ? (
            <span className="switch-desc memory-distill-inactive">
              Currently inactive: OpenViking not ready
            </span>
          ) : null}
        </div>
        <label className="switch" aria-label="Auto-recall long-term memory">
          <input
            type="checkbox"
            checked={autoRecall}
            disabled={saving || !baseUrl}
            onChange={(event) => {
              void setAutoRecall(baseUrl, event.target.checked);
            }}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="memory-embedding-block">
        <div className="switch-label">
          <span className="switch-title">Embedding (dedicated endpoint)</span>
          <span className="switch-desc">
            For semantic search only; do not use a chat model API (e.g. DeepSeek). Credentials via credentials / env vars.
          </span>
        </div>
        <div className="field-group input-medium">
          <label className="field-label" htmlFor="ov-emb-base-url">
            Base URL
          </label>
          <input
            className="text-input"
            id="ov-emb-base-url"
            value={embBaseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(event) => setEmbBaseUrl(event.target.value)}
          />
        </div>
        <div className="field-group input-medium">
          <label className="field-label" htmlFor="ov-emb-model">
            Model name
          </label>
          <input
            className="text-input"
            id="ov-emb-model"
            value={embModel}
            placeholder="text-embedding-3-small"
            onChange={(event) => setEmbModel(event.target.value)}
          />
        </div>
        <div className="field-group input-medium">
          <label className="field-label" htmlFor="ov-emb-api-key-env">
            API Key env var
          </label>
          <input
            className="text-input"
            id="ov-emb-api-key-env"
            value={embApiKeyEnv}
            placeholder={DEFAULT_EMBEDDING_API_KEY_ENV}
            onChange={(event) => setEmbApiKeyEnv(event.target.value)}
          />
        </div>
        <div className="field-group input-medium">
          <label className="field-label" htmlFor="ov-emb-api-key">
            API Key
          </label>
          <input
            className="text-input"
            id="ov-emb-api-key"
            type="password"
            value={embApiKeyDraft}
            placeholder={
              embKeyFromEnv
                ? "Provided by env var (read-only)"
                : embCredential?.configured
                  ? "Saved — leave blank to keep unchanged"
                  : "Paste Embedding API Key"
            }
            disabled={embKeyFromEnv || saving || !baseUrl}
            onChange={(event) => setEmbApiKeyDraft(event.target.value)}
          />
          {embKeyFromEnv ? (
            <span className="field-hint">
              Currently provided by env var {embApiKeyEnv}
            </span>
          ) : null}
        </div>
        <div className="field-group input-medium">
          <label className="field-label" htmlFor="ov-emb-dimension">
            Dimension (optional)
          </label>
          <input
            className="text-input"
            id="ov-emb-dimension"
            value={embDimension}
            placeholder="1536"
            inputMode="numeric"
            onChange={(event) => setEmbDimension(event.target.value)}
          />
        </div>
        <div className="action-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !baseUrl}
            onClick={() => {
              const dimRaw = embDimension.trim();
              const dimension =
                dimRaw === "" ? undefined : Number.parseInt(dimRaw, 10);
              void saveOpenVikingEmbedding(baseUrl, {
                baseUrl: embBaseUrl,
                model: embModel,
                apiKeyEnv: embApiKeyEnv,
                dimension:
                  dimension != null && Number.isFinite(dimension)
                    ? dimension
                    : undefined,
                apiKey: embApiKeyDraft || undefined,
              }).then(() => setEmbApiKeyDraft(""));
            }}
          >
            {saving ? "Saving…" : "Save Embedding"}
          </button>
        </div>
      </div>

      <div className="memory-status-row">
        <div className="memory-status-left">
          <div className={`mcp-status-pill ${statusPillClass(status)}`}>
            <span className="mcp-status-dot" aria-hidden />
            <span className="memory-status-badge">{status}</span>
          </div>
          {detail ? <span className="memory-status-detail">{detail}</span> : null}
        </div>
        <div className="memory-status-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving || !baseUrl}
            onClick={() => void retryOpenVikingStatus(baseUrl)}
          >
            <RefreshCw width={14} height={14} aria-hidden />
            Retry
          </button>
          <button
            type="button"
            className="mcp-link"
            onClick={onScrollToModels}
          >
            Configure models & provider
          </button>
        </div>
      </div>

      <div className="memory-advanced">
        <button
          type="button"
          className="memory-advanced-summary"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <span className="memory-advanced-title">Advanced</span>
          <span className="memory-advanced-hint">
            VLM model override & MCP URL
          </span>
          {advancedOpen ? (
            <ChevronUp width={16} height={16} aria-hidden />
          ) : (
            <ChevronDown width={16} height={16} aria-hidden />
          )}
        </button>
        {advancedOpen ? (
          <div className="memory-advanced-body">
            <div className="field-group input-medium">
              <label className="field-label" htmlFor="ov-vlm-model">
                VLM model override
              </label>
              <input
                className="text-input"
                id="ov-vlm-model"
                value={vlmModel}
                placeholder="Leave blank to use the Agent's default model"
                onChange={(event) => setVlmModel(event.target.value)}
              />
            </div>
            <div className="field-group input-medium">
              <label className="field-label" htmlFor="ov-mcp-url">
                MCP URL
              </label>
              <input
                className="text-input"
                id="ov-mcp-url"
                value={mcpUrl}
                readOnly
              />
              <span className="field-hint">Read-only; local OpenViking HTTP MCP address</span>
            </div>
            <div className="action-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || !baseUrl}
                onClick={() => {
                  void saveOpenVikingOverrides(baseUrl, { vlmModel });
                }}
              >
                {saving ? "Saving…" : "Save VLM override"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="memory-footer">
        <span className="helper-text">
          OpenViking is provided under AGPLv3. See P2.5 / P2.5b · Distill P3 · Recall P4
        </span>
        <a
          className="mcp-link"
          href={OPENVIKING_RUNTIME_README_URL}
          target="_blank"
          rel="noreferrer"
          title="openviking-runtime README in repo (AGPLv3)"
        >
          View docs
        </a>
      </div>
    </div>
  );
}
