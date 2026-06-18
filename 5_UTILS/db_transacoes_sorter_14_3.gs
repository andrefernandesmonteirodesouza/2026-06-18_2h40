/**
 * 📂 ARQUIVO: 5_UTILS/db_transacoes_sorter_14_3.gs
 * 🧭 MÓDULO: ORDENADOR INTELIGENTE DA DB_TRANSACOES
 * 🔢 VERSÃO: 14.3.0
 * 📅 DATA: 10/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Ordenar DB_TRANSACOES por prioridade operacional:
 * 1. Sugestões fortes/médias/fracas para aprovação.
 * 2. Pendências com categoria.
 * 3. Pendências sem categoria útil / baixa confiança.
 * 4. Bloqueadas.
 * 5. Consolidadas no final.
 * -----------------------------------------------------------------------------
 */

const GFP_SORT_DB_SHEET_14_3 = "DB_TRANSACOES";

// true  = pendências mais antigas primeiro.
// false = pendências mais recentes primeiro.
const GFP_SORT_PENDENCIAS_ANTIGAS_PRIMEIRO_14_3 = true;

// true = esconde colunas auxiliares O:S.
const GFP_SORT_HIDE_HELPER_COLUMNS_14_3 = true;

/**
 * ✅ EXECUTE ESTA FUNÇÃO.
 */
function GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_SORT_DB_SHEET_14_3);
  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const lastRow = sh.getLastRow();
  if (lastRow < 3) {
    return { sorted: false, reason: "poucas linhas" };
  }

  GFP_SORT_ensureHelperColumns_14_3_(sh);

  const numRows = lastRow - 1;
  const data = sh.getRange(2, 1, numRows, 14).getValues();
  const helperValues = [];

  data.forEach(row => {
    const keys = GFP_SORT_buildSortKeys_14_3_(row);
    helperValues.push([
      keys.group,
      keys.confidenceKey,
      keys.dateKey,
      keys.statusLabel,
      keys.audit
    ]);
  });

  // O:S = 15:19
  sh.getRange(2, 15, helperValues.length, 5).setValues(helperValues);

  // Ordena A:S, sem incluir o cabeçalho.
  // A linha inteira move junto: cores, notas, validações, checkbox, metadados.
  sh.getRange(2, 1, numRows, 19).sort([
    { column: 15, ascending: true }, // SYS_SORT_GRUPO
    { column: 16, ascending: true }, // SYS_SORT_CONFIANCA
    { column: 17, ascending: true }, // SYS_SORT_DATA
    { column: 2, ascending: true }   // DESCRICAO como desempate
  ]);

  try {
    if (typeof GFP_APLICAR_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1 === "function") {
      GFP_APLICAR_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1();
    }
  } catch (pendingCheckboxError) {
    Logger.warn("[GFP 14.3.1] Falha ao reaplicar checkboxes de pendências categorizadas: " + pendingCheckboxError.message);
  }

  if (GFP_SORT_HIDE_HELPER_COLUMNS_14_3) {
    try {
      sh.hideColumns(15, 5);
    } catch (e) {}
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "DB_TRANSACOES ordenada por prioridade de revisão.",
    "GFP 14.3"
  );

  Logger.log(`[GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3] Linhas ordenadas: ${numRows}`);

  return {
    sorted: true,
    rows: numRows
  };
}

/**
 * Garante colunas auxiliares O:S.
 */
function GFP_SORT_ensureHelperColumns_14_3_(sh) {
  const requiredCols = 19; // A:S
  const currentCols = sh.getMaxColumns();

  if (currentCols < requiredCols) {
    sh.insertColumnsAfter(currentCols, requiredCols - currentCols);
  }

  const headers = [
    "SYS_SORT_GRUPO",
    "SYS_SORT_CONFIANCA",
    "SYS_SORT_DATA",
    "SYS_SORT_STATUS",
    "SYS_SORT_AUDIT"
  ];

  const headerRange = sh.getRange(1, 15, 1, 5);
  headerRange.setValues([headers]);
  headerRange
    .setBackground("#111827")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  if (GFP_SORT_HIDE_HELPER_COLUMNS_14_3) {
    try {
      sh.hideColumns(15, 5);
    } catch (e) {}
  }
}

/**
 * Monta chaves de ordenação a partir da linha A:N.
 *
 * Índices:
 * A DATA        row[0]
 * B DESCRICAO   row[1]
 * C VALOR       row[2]
 * D TIPO        row[3]
 * E CONTA       row[4]
 * F CATEGORIA   row[5]
 * I STATUS      row[8]
 * J NOTAS       row[9]
 * N METADADOS   row[13]
 */
function GFP_SORT_buildSortKeys_14_3_(row) {
  const data = row[0];
  const descricao = String(row[1] || "").trim();
  const tipo = String(row[3] || "").trim().toUpperCase();
  const categoria = String(row[5] || "").trim();
  const status = String(row[8] || "").trim().toUpperCase();
  const notas = String(row[9] || "").trim();
  const meta = GFP_SORT_parseJson_14_3_(row[13]);

  const hasCategory = GFP_SORT_isCategoriaValida_14_3_(categoria);
  const confidence = GFP_SORT_extractConfidence_14_3_(status, notas, meta);
  const dateSerial = GFP_SORT_dateSerial_14_3_(data);

  const group = GFP_SORT_group_14_3_(status, tipo, hasCategory, confidence);
  const confidenceKey = GFP_SORT_confidenceKey_14_3_(group, confidence);
  const dateKey = GFP_SORT_dateKey_14_3_(group, dateSerial);

  return {
    group: group,
    confidenceKey: confidenceKey,
    dateKey: dateKey,
    statusLabel: status || "PENDENTE",
    audit: `${group}|${confidence}|${GFP_SORT_formatDateAudit_14_3_(data)}|${descricao.slice(0, 80)}`
  };
}

/**
 * Grupos de prioridade.
 *
 * Quanto menor, mais alto na planilha.
 */
function GFP_SORT_group_14_3_(status, tipo, hasCategory, confidence) {
  const s = String(status || "").toUpperCase();

  // 1. Sugestões aprováveis por confiança.
  if (s === "GEMINI_FORTE" || s === "MODELO_FORTE") return 10;
  if (s === "GEMINI_MEDIO" || s === "GEMINI_MÉDIO" || s === "MODELO_MEDIO" || s === "MODELO_MÉDIO") return 20;
  if (s === "GEMINI_FRACO" || s === "MODELO_FRACO") return 30;
  if (s === "GEMINI_SUGERIDO") return 35; // legado azul

  // 2. Pendências com categoria válida e ainda não OK.
  if (!GFP_SORT_isConsolidado_14_3_(s) && hasCategory) return 40;

  // 3. Baixa confiança / sem categoria útil.
  if (s === "GEMINI_BAIXO" || s === "MODELO_BAIXO") return 50;

  // 4. Pendências sem sugestão/categoria.
  if (!GFP_SORT_isConsolidado_14_3_(s) && !hasCategory) return 60;

  // 5. Bloqueadas, para revisão manual consciente.
  if (s === "GEMINI_BLOQUEADO" || s === "MODELO_BLOQUEADO" || s === "BLOQUEADA") return 70;

  // 6. Consolidadas no fim.
  if (GFP_SORT_isConsolidado_14_3_(s)) return 900;

  return 80;
}

function GFP_SORT_isConsolidado_14_3_(status) {
  const s = String(status || "").trim().toUpperCase();
  return s === "OK" ||
         s === "CONCILIADO" ||
         s === "SPLIT" ||
         s === "CONSOLIDADO" ||
         s === "APROVADO";
}

/**
 * Ordena confiança desc dentro dos grupos de sugestão.
 *
 * Usamos 100 - confiança para sort asc.
 */
function GFP_SORT_confidenceKey_14_3_(group, confidence) {
  const c = Number(confidence || 0);

  if (group >= 10 && group <= 35) {
    return 100 - c;
  }

  return 999;
}

/**
 * Pendências: antigas primeiro, por padrão.
 * Consolidadas: recentes primeiro dentro do bloco final.
 */
function GFP_SORT_dateKey_14_3_(group, dateSerial) {
  const serial = Number(dateSerial || 99999999);

  // Consolidadas no final, mas dentro delas o mais recente vem primeiro.
  if (group >= 900) {
    return -serial;
  }

  if (GFP_SORT_PENDENCIAS_ANTIGAS_PRIMEIRO_14_3) {
    return serial;
  }

  return -serial;
}

function GFP_SORT_extractConfidence_14_3_(status, notas, meta) {
  const cp = meta && meta.classificationParams ? meta.classificationParams : {};

  const fromMeta = Number(cp.confidence || 0);
  if (!isNaN(fromMeta) && fromMeta > 0) return Math.max(0, Math.min(100, fromMeta));

  const text = `${status || ""} ${notas || ""}`;
  const m = String(text).match(/(\d{1,3})%/);
  if (m) {
    const n = Number(m[1]);
    if (!isNaN(n)) return Math.max(0, Math.min(100, n));
  }

  const s = String(status || "").toUpperCase();
  if (s.indexOf("FORTE") >= 0) return 95;
  if (s.indexOf("MEDIO") >= 0 || s.indexOf("MÉDIO") >= 0) return 85;
  if (s.indexOf("FRACO") >= 0) return 65;
  if (s.indexOf("BAIXO") >= 0) return 50;

  return 0;
}

function GFP_SORT_isCategoriaValida_14_3_(categoria) {
  return /^\d{2}\.\d{2}\s+—\s+/.test(String(categoria || "").trim());
}

function GFP_SORT_parseJson_14_3_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}

function GFP_SORT_dateSerial_14_3_(value) {
  if (value instanceof Date && !isNaN(value)) {
    return Math.floor(value.getTime() / 86400000);
  }

  const txt = String(value || "").trim();

  // dd/mm/yyyy
  let m = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Math.floor(d.getTime() / 86400000);
  }

  // yyyy-mm-dd
  m = txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Math.floor(d.getTime() / 86400000);
  }

  return 99999999;
}

function GFP_SORT_formatDateAudit_14_3_(value) {
  if (value instanceof Date && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  return String(value || "");
}

/**
 * Liga ordenação automática depois de aprovação por checkbox/painel.
 */
function GFP_SORT_ENABLE_AUTO_AFTER_APPROVAL_14_3() {
  PropertiesService.getScriptProperties().setProperty("GFP_SORT_AUTO_AFTER_APPROVAL_14_3", "TRUE");
  SpreadsheetApp.getActiveSpreadsheet().toast("Ordenação automática após aprovação: ATIVADA", "GFP 14.3");
}

/**
 * Desliga ordenação automática depois de aprovação por checkbox/painel.
 */
function GFP_SORT_DISABLE_AUTO_AFTER_APPROVAL_14_3() {
  PropertiesService.getScriptProperties().setProperty("GFP_SORT_AUTO_AFTER_APPROVAL_14_3", "FALSE");
  SpreadsheetApp.getActiveSpreadsheet().toast("Ordenação automática após aprovação: DESATIVADA", "GFP 14.3");
}

/**
 * Chamável por outros módulos.
 */
function GFP_SORT_MAYBE_AUTO_AFTER_APPROVAL_14_3() {
  const enabled = String(
    PropertiesService.getScriptProperties().getProperty("GFP_SORT_AUTO_AFTER_APPROVAL_14_3") || "FALSE"
  ).toUpperCase() === "TRUE";

  if (!enabled) {
    return {
      skipped: true,
      reason: "auto sort after checkbox/manual approval disabled by GFP 16.1.18.1"
    };
  }

  if (typeof GFP_SORT_DB_TRANSACOES_OFICIAL_16_1_18_1 === "function") {
    return GFP_SORT_DB_TRANSACOES_OFICIAL_16_1_18_1();
  }

  return GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3();
}

