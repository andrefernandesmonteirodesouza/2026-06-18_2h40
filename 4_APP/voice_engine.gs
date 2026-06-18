/**
 * =============================================================================
 * 🎙️ GFP 16.0.2.1 — MOTOR DE VOZ SEGURO COM FALLBACK DE MODELO
 * =============================================================================
 *
 * Processa áudio da URL:
 *
 *   URL voz
 *       ↓
 *   transcrição Gemini
 *       ↓
 *   handleInput(textoTranscrito, usuario)
 *       ↓
 *   DB_MEMORIA
 *
 * Regra central:
 * - input via URL não grava diretamente em DB_TRANSACOES.
 * =============================================================================
 */

const GFP_VOICE_VERSION_16_0_2_1 = "16.0.2.1";

/**
 * Função chamada pelo frontend da URL.
 *
 * @param {string} base64
 * @param {string} mime
 * @param {string} usuario
 * @returns {string}
 */
function processAudioLegacy(base64, mime, usuario) {
  const functionName = "processAudioLegacy";

  GFP_VOICE_LOG_16_0_2_1_(
    "INFO",
    functionName,
    "Iniciando pipeline de transcrição para usuário: " + usuario
  );

  try {
    if (!base64) {
      throw new Error("Áudio vazio ou não recebido pelo servidor.");
    }

    mime = mime || "audio/webm";

    const bytes = Utilities.base64Decode(base64);
    const blob = Utilities.newBlob(bytes, mime, "audio");

    GFP_VOICE_LOG_16_0_2_1_(
      "INFO",
      functionName,
      "Blob de áudio criado. Tamanho: " + blob.getBytes().length + " bytes. MIME: " + mime
    );

    const textoTranscrito = transcreverAudioLegacy(blob);

    GFP_VOICE_LOG_16_0_2_1_(
      "INFO",
      functionName,
      'Transcrição concluída: "' + textoTranscrito + '"'
    );

    if (!textoTranscrito || !String(textoTranscrito).trim()) {
      throw new Error("A transcrição retornou texto vazio.");
    }

    if (typeof handleInput === "function") {
      return handleInput(textoTranscrito, usuario);
    }

    throw new Error("Erro de dependência: função handleInput não encontrada.");

  } catch (e) {
    const msg = e && e.message ? e.message : String(e);

    GFP_VOICE_LOG_16_0_2_1_(
      "ERROR",
      functionName,
      "Falha no processamento de áudio: " + msg
    );

    throw new Error("Erro no processamento de Áudio: " + msg);
  }
}

/**
 * Mantém o nome antigo para compatibilidade.
 * Agora chama transcrição com fallback de modelo.
 *
 * @param {Blob} blob
 * @returns {string}
 */
function transcreverAudioLegacy(blob) {
  return GFP_VOICE_TRANSCRIBE_WITH_FALLBACK_16_0_2_1_(blob);
}

/**
 * Transcreve tentando modelos em cascata.
 */
function GFP_VOICE_TRANSCRIBE_WITH_FALLBACK_16_0_2_1_(blob) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty("GEMINI_API_KEY") || "").trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não encontrada nas Propriedades do Script.");
  }

  const configuredVoiceModel = String(props.getProperty("GEMINI_VOICE_MODEL") || "").trim();
  const configuredGeneralModel = String(props.getProperty("GEMINI_MODEL") || "").trim();

  const models = [];

  // Se existir modelo específico da voz, tenta primeiro.
  if (configuredVoiceModel) models.push(configuredVoiceModel);

  // Depois tenta modelos atuais mais prováveis.
  [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-latest"
  ].forEach(function(model) {
    if (models.indexOf(model) < 0) models.push(model);
  });

  // Só depois tenta o modelo geral, porque pode estar preso em gemini-1.5-flash.
  if (configuredGeneralModel && models.indexOf(configuredGeneralModel) < 0) {
    models.push(configuredGeneralModel);
  }

  // Último fallback legado, apenas para diagnóstico.
  if (models.indexOf("gemini-1.5-flash") < 0) {
    models.push("gemini-1.5-flash");
  }

  const attempts = [];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];

    try {
      const text = GFP_VOICE_CALL_TRANSCRIBE_MODEL_16_0_2_1_(apiKey, model, blob);

      props.setProperty("GEMINI_VOICE_MODEL", model);

      GFP_VOICE_LOG_16_0_2_1_(
        "INFO",
        "GFP_VOICE_TRANSCRIBE_WITH_FALLBACK_16_0_2_1_",
        "Transcrição OK usando modelo " + model
      );

      GFP_VOICE_RELATORIO_16_0_2_1_(
        "VOICE_ENGINE",
        "TRANSCRICAO_OK",
        "OK",
        "Transcrição de áudio concluída com fallback de modelo.",
        {
          model: model,
          attempts: attempts,
          version: GFP_VOICE_VERSION_16_0_2_1
        }
      );

      return text;

    } catch (e) {
      const err = e && e.message ? e.message : String(e);

      attempts.push({
        model: model,
        ok: false,
        error: err
      });

      GFP_VOICE_LOG_16_0_2_1_(
        "WARN",
        "GFP_VOICE_TRANSCRIBE_WITH_FALLBACK_16_0_2_1_",
        "Modelo falhou: " + model + " | " + err
      );
    }
  }

  GFP_VOICE_RELATORIO_16_0_2_1_(
    "VOICE_ENGINE",
    "TRANSCRICAO_ERRO_MODELOS",
    "ERRO",
    "Nenhum modelo conseguiu transcrever o áudio.",
    {
      attempts: attempts,
      version: GFP_VOICE_VERSION_16_0_2_1
    }
  );

  throw new Error(
    "Erro de conexão na transcrição: nenhum modelo funcionou. Tentativas: " +
    JSON.stringify(attempts).substring(0, 1500)
  );
}

/**
 * Chamada individual ao Gemini para transcrição.
 */
function GFP_VOICE_CALL_TRANSCRIBE_MODEL_16_0_2_1_(apiKey, model, blob) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inline_data: {
              mime_type: blob.getContentType() || "audio/webm",
              data: Utilities.base64Encode(blob.getBytes())
            }
          },
          {
            text: "Transcreva este áudio em português do Brasil exatamente como falado. Retorne apenas o texto transcrito, sem explicações, sem aspas e sem comentários."
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256
    }
  };

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const body = res.getContentText() || "";

  if (code < 200 || code >= 300) {
    const parsed = GFP_VOICE_SAFE_PARSE_JSON_16_0_2_1_(body);
    const apiMessage = parsed && parsed.error && parsed.error.message
      ? parsed.error.message
      : body.substring(0, 800);

    throw new Error(
      "Falha na API de Transcrição (" + code + ") usando modelo " + model + ": " + apiMessage
    );
  }

  const json = JSON.parse(body);
  const text = GFP_VOICE_EXTRACT_TEXT_16_0_2_1_(json);

  if (!text) {
    throw new Error("Gemini respondeu sem texto transcrito.");
  }

  return text.trim();
}

/**
 * Diagnóstico seguro da voz.
 */
function GFP_VOICE_DIAGNOSTICO_16_0_2_1() {
  const props = PropertiesService.getScriptProperties();

  const apiKey = String(props.getProperty("GEMINI_API_KEY") || "").trim();

  const result = {
    version: GFP_VOICE_VERSION_16_0_2_1,
    generatedAt: new Date().toISOString(),
    geminiApiKeyExists: !!apiKey,
    geminiApiKeyLength: apiKey ? apiKey.length : 0,
    geminiApiKeyMasked: GFP_VOICE_MASK_KEY_16_0_2_1_(apiKey),
    geminiVoiceModel: String(props.getProperty("GEMINI_VOICE_MODEL") || "").trim(),
    geminiGeneralModel: String(props.getProperty("GEMINI_MODEL") || "").trim(),
    processAudioLegacyExists: typeof processAudioLegacy === "function",
    transcreverAudioLegacyExists: typeof transcreverAudioLegacy === "function",
    handleInputExists: typeof handleInput === "function",
    neverWritesDbTransacoes: true
  };

  const status = result.geminiApiKeyExists && result.handleInputExists
    ? "OK"
    : "ATENCAO";

  GFP_VOICE_LOG_16_0_2_1_(
    status === "OK" ? "INFO" : "WARN",
    "GFP_VOICE_DIAGNOSTICO_16_0_2_1",
    JSON.stringify(result)
  );

  GFP_VOICE_RELATORIO_16_0_2_1_(
    "VOICE_ENGINE",
    "DIAGNOSTICO_VOZ_16_0_2_1",
    status,
    "Diagnóstico seguro da voz.",
    result
  );

  SpreadsheetApp.getActive().toast(
    "Voz " + status + " | fallback de modelo ativo.",
    "GFP 16.0.2.1"
  );

  return result;
}

function GFP_VOICE_EXTRACT_TEXT_16_0_2_1_(json) {
  try {
    const candidates = json.candidates || [];

    if (!candidates.length) return "";

    const parts = candidates[0].content && candidates[0].content.parts
      ? candidates[0].content.parts
      : [];

    return parts.map(function(part) {
      return part.text || "";
    }).join("").trim();
  } catch (e) {
    return "";
  }
}

function GFP_VOICE_SAFE_PARSE_JSON_16_0_2_1_(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function GFP_VOICE_MASK_KEY_16_0_2_1_(key) {
  key = String(key || "");

  if (!key) return "";

  if (key.length <= 10) return "***";

  return key.substring(0, 4) + "..." + key.substring(key.length - 4);
}

function GFP_VOICE_SAFE_JSON_STRINGIFY_16_0_2_1_(value, maxLen) {
  maxLen = maxLen || 30000;

  try {
    const str = JSON.stringify(value);

    if (!str) return "";

    return str.length > maxLen ? str.substring(0, maxLen) + "...[cortado]" : str;
  } catch (e) {
    const fallback = String(value || "");
    return fallback.length > maxLen ? fallback.substring(0, maxLen) + "...[cortado]" : fallback;
  }
}

function GFP_VOICE_LOG_16_0_2_1_(level, func, message) {
  try {
    Logger.log("[" + func + "] " + message);

    if (typeof GFP_SYS_LOG_15_9_7 === "function") {
      GFP_SYS_LOG_15_9_7(
        "VOICE_ENGINE",
        func,
        level || "INFO",
        message || "",
        {
          version: GFP_VOICE_VERSION_16_0_2_1
        }
      );
      return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("SYS_LOGS");

    if (!sh) return;

    sh.appendRow([
      new Date(),
      level || "INFO",
      func || "VOICE_ENGINE",
      message || ""
    ]);

  } catch (e) {
    // Nunca quebrar fluxo por falha de log.
  }
}

function GFP_VOICE_RELATORIO_16_0_2_1_(tipo, etapa, status, detalhe, payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("SYS_RELATORIOS");

    if (!sh) return;

    const header = [
      "TIMESTAMP_CONSOLIDACAO",
      "ORIGEM_ABA",
      "ORIGEM_LINHA",
      "TIPO",
      "STATUS",
      "ETAPA_CODIGO",
      "DETALHE",
      "PAYLOAD_JSON"
    ];

    sh.getRange(1, 1, 1, header.length).setValues([header]);

    sh.appendRow([
      new Date(),
      "GFP_16_0_2_1",
      "",
      tipo || "VOICE_ENGINE",
      status || "INFO",
      etapa || "",
      detalhe || "",
      GFP_VOICE_SAFE_JSON_STRINGIFY_16_0_2_1_(payload || {}, 35000)
    ]);

  } catch (e) {
    // Nunca quebrar fluxo por falha de relatório.
  }
}

function GFP_VOICE_LIMPAR_MODELO_VOZ_ANTIGO_16_0_2_1() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty("GEMINI_VOICE_MODEL");

  SpreadsheetApp.getActive().toast(
    "GEMINI_VOICE_MODEL removido. A próxima gravação descobrirá o modelo válido.",
    "GFP 16.0.2.1"
  );
}
