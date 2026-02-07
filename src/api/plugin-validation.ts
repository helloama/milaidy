/**
 * Plugin configuration validation.
 *
 * Validates plugin configuration by checking all required parameters
 * from the plugin's agentConfig.pluginParameters definition, plus
 * provider-specific API key format checks.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginValidationResult {
  /** Whether the plugin configuration is valid (no errors). */
  valid: boolean;
  /** Hard errors that prevent the plugin from working. */
  errors: Array<{ field: string; message: string }>;
  /** Soft warnings that may indicate misconfiguration. */
  warnings: Array<{ field: string; message: string }>;
}

/** Parameter definition from agentConfig.pluginParameters in package.json. */
export interface PluginParamInfo {
  key: string;
  required: boolean;
  sensitive: boolean;
  type: string;
  description: string;
  default?: string;
}

// ---------------------------------------------------------------------------
// API key prefix patterns for format validation
// ---------------------------------------------------------------------------

const KEY_PREFIX_HINTS: Readonly<Record<string, { prefix: string; label: string }>> = {
  ANTHROPIC_API_KEY: { prefix: "sk-ant-", label: "Anthropic" },
  OPENAI_API_KEY: { prefix: "sk-", label: "OpenAI" },
  GROQ_API_KEY: { prefix: "gsk_", label: "Groq" },
  XAI_API_KEY: { prefix: "xai-", label: "xAI" },
  OPENROUTER_API_KEY: { prefix: "sk-or-", label: "OpenRouter" },
};

// ---------------------------------------------------------------------------
// Validation logic
// ---------------------------------------------------------------------------

/**
 * Validate a plugin's configuration.
 *
 * Checks all required parameters (from the plugin's package.json metadata)
 * and applies format-specific warnings for known API key patterns.
 *
 * @param pluginId - The plugin identifier (e.g. "anthropic", "discord")
 * @param category - Plugin category
 * @param envKey - Primary environment variable key (legacy, used as fallback)
 * @param configKeys - All known config key names for this plugin
 * @param providedConfig - Config values being set (for PUT validation)
 * @param paramDefs - Full parameter definitions with required/sensitive metadata
 */
export function validatePluginConfig(
  pluginId: string,
  category: string,
  envKey: string | null,
  configKeys: string[],
  providedConfig?: Record<string, string>,
  paramDefs?: PluginParamInfo[],
): PluginValidationResult {
  const errors: Array<{ field: string; message: string }> = [];
  const warnings: Array<{ field: string; message: string }> = [];

  // ── Check all required parameters ─────────────────────────────────────
  if (paramDefs && paramDefs.length > 0) {
    for (const param of paramDefs) {
      if (!param.required) continue;

      // Value source: provided config > process.env > undefined
      const value = providedConfig?.[param.key] ?? process.env[param.key];

      if (!value || !value.trim()) {
        // Required param with a default is a warning, not an error
        if (param.default) {
          warnings.push({
            field: param.key,
            message: `${param.key} is not set (will use default: ${param.default})`,
          });
        } else {
          errors.push({
            field: param.key,
            message: `${param.key} is required but not set`,
          });
        }
        continue;
      }

      // Format validation for known key patterns
      const hint = KEY_PREFIX_HINTS[param.key];
      if (hint && !value.startsWith(hint.prefix)) {
        warnings.push({
          field: param.key,
          message: `${hint.label} key should start with "${hint.prefix}" — the current value may be invalid`,
        });
      }

      // Length sanity check for sensitive keys (API keys / tokens)
      if (param.sensitive && value.trim().length < 10) {
        warnings.push({
          field: param.key,
          message: `${param.key} looks too short (${value.trim().length} chars)`,
        });
      }
    }
  } else if (envKey) {
    // Fallback: no param definitions, but we know the primary env key
    const currentValue = providedConfig?.[envKey] ?? process.env[envKey];
    if (!currentValue || !currentValue.trim()) {
      errors.push({ field: envKey, message: `${envKey} is required but not set` });
    } else {
      const hint = KEY_PREFIX_HINTS[envKey];
      if (hint && !currentValue.startsWith(hint.prefix)) {
        warnings.push({
          field: envKey,
          message: `${hint.label} key should start with "${hint.prefix}" — the current value may be invalid`,
        });
      }

      // Length sanity check for keys/tokens that look suspiciously short
      if (currentValue.trim().length < 10) {
        warnings.push({
          field: envKey,
          message: `${envKey} looks too short (${currentValue.trim().length} chars)`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
