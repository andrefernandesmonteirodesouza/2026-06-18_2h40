/**
 * =============================================================================
 * 📷 GFP 16.0.3 — VISION ENGINE SEGURO
 * =============================================================================
 *
 * Processa foto/comprovante/canhoto via URL e grava APENAS em DB_MEMORIA.
 *
 * Regra arquitetural:
 * - input URL texto/voz/foto = memória do dia a dia;
 * - DB_TRANSACOES só recebe fatura/extrato/importador oficial;
 * - match futuro usa DB_MEMORIA como apoio.
 * =============================================================================
 */

const GFP_VISION_VERSION_16_0_3 = "16.0.3";

/**
 * Pipeline principal de foto.
 *
 * Chamado pelo backend/front da URL.
 *
 * @param {string} base64
 * @param {string} mimeType
 * @param {string} usuario
 * @returns {string} HTML/resumo para exibir na URL.
 */
function visionPipeline(base64, mimeType, usuario) {
  const functionName = "visionPipeline";

  GFP_VISION_LOG_16_0_3_(
    "INFO",
    functionName,
    "Recebendo imagem de " + usuario + ". Mime: " + mimeType
  );

  const apiKey = String(PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY") || "").trim();

  if (!apiKey) {
    throw new Error("Chave GEMINI_API_KEY não configurada nas Propriedades do Script.");
  }

  if (!base64) {
    throw new Error("Imagem vazia ou não recebida pelo servidor.");
  }

  mimeType = mimeType || "image/jpeg";

  try {
    // 1. Salva arquivo no Drive para auditoria/consulta futura.
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64),
      mimeType,
      "Comprovante_" + new Date().toISOString() + ".jpg"
    );

    const file = GFP_VISION_SAVE_FILE_16_0_3_(blob);
    const fileUrl = file.getUrl();

    GFP_VISION_LOG_16_0_3_(
      "INFO",
      functionName,
      "Arquivo salvo: " + fileUrl
    );

    // 2. Chama Gemini Vision com fallback de modelo.
    const visionResult = GFP_VISION_EXTRACT_WITH_FALLBACK_16_0_3_(
      apiKey,
      base64,
      mimeType,
      usuario
    );

    const dataExtracted = visionResult.data || {};

    if (!dataExtracted.meta) dataExtracted.meta = {};

    dataExtracted.meta.comprovanteUrl = fileUrl;
    dataExtracted.meta.source = "URL_FOTO";
    dataExtracted.meta.usuario = usuario;
    dataExtracted.meta.visionModel = visionResult.model;
    dataExtracted.meta.createdAt = new Date().toISOString();
    dataExtracted.meta.version = GFP_VISION_VERSION_16_0_3;

    // 3. REGRA CENTRAL: URL FOTO salva em DB_MEMORIA, nunca em DB_TRANSACOES.
    const response = saveDirectToMemory(dataExtracted, usuario, fileUrl);

    GFP_VISION_LOG_16_0_3_(
      "INFO",
      functionName,
      "Foto processada e salva em DB_MEMORIA usando modelo " + visionResult.model + "."
    );

    GFP_VISION_RELATORIO_16_0_3_(
      "VISION_ENGINE",
      "FOTO_PROCESSADA_DB_MEMORIA",
      "OK",
      "Foto processada e salva em DB_MEMORIA.",
      {
        usuario: usuario,
        model: visionResult.model,
        fileUrl: fileUrl,
        data: dataExtracted
      }
    );

    return response;

  } catch (e) {
    const msg = e && e.message ? e.message : String(e);

    GFP_VISION_LOG_16_0_3_(
      "ERROR",
      functionName,
      "Erro: " + msg
    );

    GFP_VISION_RELATORIO_16_0_3_(
      "VISION_ENGINE",
      "FOTO_ERRO",
      "ERRO",
      msg,
      {
        usuario: usuario,
        mimeType: mimeType,
        version: GFP_VISION_VERSION_16_0_3
      }
    );

    throw e;
  }
}

/**
 * Extrai dados da imagem tentando modelos em ordem.
 */
function GFP_VISION_EXTRACT_WITH_FALLBACK_16_0_3_(apiKey, base64, mimeType, usuario) {
  const props = PropertiesService.getScriptProperties();

  const configuredModel =
    String(props.getProperty("GEMINI_VISION_MODEL") || "").trim();

  const generalModel =
    String(props.getProperty("GEMINI_MODEL") || "").trim();

  const models = [];

  // Modelo que já funcionou anteriormente, se existir.
  if (configuredModel) models.push(configuredModel);

  // Prioridade atual: no seu log, 2.5-flash respondeu; 2.0 deu quota 0.
  [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite"
  ].forEach(function(model) {
    if (models.indexOf(model) < 0) models.push(model);
  });

  // Modelo geral só depois, porque pode estar preso em gemini-1.5-flash.
  if (generalModel && models.indexOf(generalModel) < 0) {
    models.push(generalModel);
  }

  // Fallback legado apenas para diagnóstico.
  [
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash"
  ].forEach(function(model) {
    if (models.indexOf(model) < 0) models.push(model);
  });

  const attempts = [];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];

    try {
      const data = GFP_VISION_CALL_MODEL_16_0_3_(apiKey, model, base64, mimeType, usuario);

      props.setProperty("GEMINI_VISION_MODEL", model);

      return {
        ok: true,
        model: model,
        attempts: attempts,
        data: data
      };

    } catch (e) {
      const err = e && e.message ? e.message : String(e);

      attempts.push({
        model: model,
        ok: false,
        error: err
      });

      GFP_VISION_LOG_16_0_3_(
        "WARN",
        "GFP_VISION_EXTRACT_WITH_FALLBACK_16_0_3_",
        "Modelo falhou: " + model + " | " + err
      );
    }
  }

  throw new Error(
    "Falha na API Vision: nenhum modelo funcionou. Tentativas: " +
    JSON.stringify(attempts).substring(0, 2500)
  );
}


/**
 * Chamada individual ao Gemini Vision.
 */
function GFP_VISION_CALL_MODEL_16_0_3_(apiKey, model, base64, mimeType, usuario) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  const prompt = `
Você é um extrator financeiro.

Analise a imagem de comprovante, canhoto, cupom ou despesa.

Retorne SOMENTE UM JSON VÁLIDO.
Não use markdown.
Não use crases.
Não escreva explicações.

Campos obrigatórios:
{
  "data": "DD/MM/YYYY",
  "valor": 0.00,
  "descricao": "Nome Local",
  "categoria": "Sugestão",
  "conta": "Nome Banco/Cartão ou Não identificado",
  "parcelas": 1,
  "observacao": ""
}

Regras:
- Hoje é ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy")}.
- Usuário: ${usuario}.
- Se não encontrar data, use hoje.
- Se não encontrar conta, use "Não identificado".
- Se não encontrar categoria, use "".
- Se não houver parcelamento, use 1.
- Valor deve ser número, não texto.
`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 512,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          data: { type: "string" },
          valor: { type: "number" },
          descricao: { type: "string" },
          categoria: { type: "string" },
          conta: { type: "string" },
          parcelas: { type: "integer" },
          observacao: { type: "string" }
        },
        required: ["data", "valor", "descricao", "categoria", "conta", "parcelas"]
      }
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
    const parsed = GFP_VISION_SAFE_PARSE_JSON_16_0_3_(body);
    const apiMessage = parsed && parsed.error && parsed.error.message
      ? parsed.error.message
      : body.substring(0, 800);

    throw new Error("Erro API Vision (" + code + ") modelo " + model + ": " + apiMessage);
  }

  const jsonResp = JSON.parse(body);
  const text = GFP_VISION_EXTRACT_TEXT_16_0_3_(jsonResp);

  if (!text) {
    throw new Error("A IA Vision não retornou texto.");
  }

  const data = GFP_VISION_PARSE_FINANCIAL_JSON_16_0_3_1_(text);

  return GFP_VISION_NORMALIZE_DATA_16_0_3_(data);
}


/**
 * Salva comprovante no Drive.
 */
function GFP_VISION_SAVE_FILE_16_0_3_(blob) {
  try {
    const folderId = (typeof PROJECT_CONFIG !== "undefined" && PROJECT_CONFIG.FOLDER_ID_IMPORTS)
      ? PROJECT_CONFIG.FOLDER_ID_IMPORTS
      : null;

    const folder = folderId
      ? DriveApp.getFolderById(folderId)
      : DriveApp.getRootFolder();

    return folder.createFile(blob);

  } catch (e) {
    return DriveApp.createFile(blob);
  }
}

/**
 * Salva o lançamento em DB_MEMORIA.
 *
 * REGRA:
 * - URL/FOTO nunca grava em DB_TRANSACOES.
 */
function saveDirectToMemory(json, usuario, fileUrl) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName("DB_MEMORIA");

  if (!sheet) {
    sheet = ss.insertSheet("DB_MEMORIA");
    sheet.appendRow([
      "ID",
      "DATA",
      "DESCRICAO",
      "VALOR",
      "CONTA",
      "CATEGORIA",
      "NOTA",
      "STATUS",
      "QUEM",
      "METADADOS"
    ]);
  }

  GFP_VISION_ENSURE_DB_MEMORIA_HEADER_16_0_3_(sheet);

  const id = Utilities.getUuid();
  const desc = json.descricao || "Despesa com Foto";
  const valor = GFP_VISION_TO_NUMBER_16_0_3_(json.valor);
  const nota = "📸 Foto: " + fileUrl;

  const meta = Object.assign({}, json, {
    comprovanteUrl: fileUrl,
    source: "URL_FOTO",
    usuario: usuario,
    version: GFP_VISION_VERSION_16_0_3
  });

  sheet.appendRow([
    id,
    json.data || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy"),
    desc,
    valor,
    json.conta || "Não identificado",
    json.categoria || "",
    nota,
    "PENDENTE",
    usuario || "",
    JSON.stringify(meta)
  ]);

  return (
    '📸 Foto Processada!<br>' +
    '<b>' + GFP_VISION_ESCAPE_HTML_16_0_3_(desc) + '</b><br>' +
    'R$ ' + valor + '<br>' +
    '<span style="font-size:12px;color:#666">Salvo em DB_MEMORIA para conciliação futura.</span><br>' +
    '<a href="' + fileUrl + '" target="_blank">Ver Comprovante</a>'
  );
}

function GFP_VISION_ENSURE_DB_MEMORIA_HEADER_16_0_3_(sheet) {
  const expected = [
    "ID",
    "DATA",
    "DESCRICAO",
    "VALOR",
    "CONTA",
    "CATEGORIA",
    "NOTA",
    "STATUS",
    "QUEM",
    "METADADOS"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expected);
    return;
  }

  const current = sheet.getRange(1, 1, 1, expected.length).getValues()[0];

  const emptyHeader = current.every(function(v) {
    return !String(v || "").trim();
  });

  if (emptyHeader) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
  }
}

function GFP_VISION_EXTRACT_TEXT_16_0_3_(json) {
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

function GFP_VISION_CLEAN_JSON_TEXT_16_0_3_(text) {
  return String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function GFP_VISION_NORMALIZE_DATA_16_0_3_(data) {
  data = data || {};

  if (!data.data) {
    data.data = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  }

  data.valor = GFP_VISION_TO_NUMBER_16_0_3_(data.valor);

  if (!data.descricao) data.descricao = "Despesa com Foto";
  if (!data.conta) data.conta = "Não identificado";
  if (!data.categoria) data.categoria = "";
  if (!data.parcelas) data.parcelas = 1;

  return data;
}

function GFP_VISION_TO_NUMBER_16_0_3_(value) {
  if (typeof value === "number") return value;

  let text = String(value || "0").trim();

  text = text
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const n = Number(text);

  return isNaN(n) ? 0 : n;
}

function GFP_VISION_SAFE_PARSE_JSON_16_0_3_(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function GFP_VISION_ESCAPE_HTML_16_0_3_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function GFP_VISION_LOG_16_0_3_(level, func, message) {
  try {
    Logger.log("[" + func + "] " + message);

    if (typeof GFP_SYS_LOG_15_9_7 === "function") {
      GFP_SYS_LOG_15_9_7(
        "VISION_ENGINE",
        func,
        level || "INFO",
        message || "",
        {
          version: GFP_VISION_VERSION_16_0_3
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
      func || "VISION_ENGINE",
      message || ""
    ]);
  } catch (e) {}
}

function GFP_VISION_RELATORIO_16_0_3_(tipo, etapa, status, detalhe, payload) {
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
      "GFP_16_0_3",
      "",
      tipo || "VISION_ENGINE",
      status || "INFO",
      etapa || "",
      detalhe || "",
      GFP_VISION_SAFE_JSON_STRINGIFY_16_0_3_(payload || {}, 35000)
    ]);
  } catch (e) {}
}

function GFP_VISION_SAFE_JSON_STRINGIFY_16_0_3_(value, maxLen) {
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

/**
 * Diagnóstico sem enviar imagem.
 */
function GFP_VISION_DIAGNOSTICO_16_0_3() {
  const props = PropertiesService.getScriptProperties();

  const key = String(props.getProperty("GEMINI_API_KEY") || "").trim();
  const model =
    String(props.getProperty("GEMINI_VISION_MODEL") || "").trim() ||
    String(props.getProperty("GEMINI_MODEL") || "").trim() ||
    "fallback automático";

  const result = {
    version: GFP_VISION_VERSION_16_0_3,
    geminiApiKeyExists: !!key,
    geminiApiKeyLength: key ? key.length : 0,
    geminiVisionModel: model,
    dbMemoriaExists: !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_MEMORIA"),
    neverWritesDbTransacoes: true
  };

  GFP_VISION_LOG_16_0_3_(
    result.geminiApiKeyExists ? "INFO" : "WARN",
    "GFP_VISION_DIAGNOSTICO_16_0_3",
    JSON.stringify(result)
  );

  SpreadsheetApp.getActive().toast(
    result.geminiApiKeyExists ? "Vision OK para teste real." : "Vision sem GEMINI_API_KEY.",
    "GFP 16.0.3"
  );

  return result;
}

function GFP_VISION_PARSE_FINANCIAL_JSON_16_0_3_1_(text) {
  const raw = String(text || "").trim();

  const candidates = [];

  candidates.push(raw);

  // Remove markdown se vier.
  candidates.push(
    raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim()
  );

  // Extrai entre primeira { e última }.
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");

  if (first >= 0 && last > first) {
    candidates.push(raw.substring(first, last + 1).trim());
  }

  // Normalizações leves.
  candidates.push(
    raw
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .trim()
  );

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];

    if (!c) continue;

    try {
      return JSON.parse(c);
    } catch (e) {
      // tenta próximo
    }
  }

  // Fallback por regex: útil quando o modelo devolve quase JSON com vírgula faltando.
  const byRegex = GFP_VISION_EXTRACT_FIELDS_BY_REGEX_16_0_3_1_(raw);

  if (byRegex && (byRegex.valor || byRegex.descricao)) {
    return byRegex;
  }

  throw new Error(
    "Resposta Vision não pôde ser convertida em JSON. Prévia: " +
    raw.substring(0, 1000)
  );
}

function GFP_VISION_EXTRACT_FIELDS_BY_REGEX_16_0_3_1_(text) {
  text = String(text || "");

  function strField(name) {
    const re = new RegExp('"' + name + '"\\s*:\\s*"([^"]*)"', "i");
    const m = text.match(re);
    return m ? m[1] : "";
  }

  function numField(name) {
    const re = new RegExp('"' + name + '"\\s*:\\s*"?(-?\\d+(?:[\\.,]\\d+)?)"?', "i");
    const m = text.match(re);
    if (!m) return 0;

    return GFP_VISION_TO_NUMBER_16_0_3_(m[1]);
  }

  function intField(name) {
    const re = new RegExp('"' + name + '"\\s*:\\s*"?(-?\\d+)"?', "i");
    const m = text.match(re);
    if (!m) return 1;

    const n = parseInt(m[1], 10);
    return isNaN(n) ? 1 : n;
  }

  return {
    data: strField("data") || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy"),
    valor: numField("valor"),
    descricao: strField("descricao") || strField("descrição") || "Despesa com Foto",
    categoria: strField("categoria"),
    conta: strField("conta") || "Não identificado",
    parcelas: intField("parcelas"),
    observacao: strField("observacao") || strField("observação")
  };
}
