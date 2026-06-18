/**
 * 📂 ARQUIVO: 5_UTILS/ordenacao_oficial_db_16_1_18_1.gs
 * 🧭 MÓDULO: ORDENAÇÃO OFICIAL DA DB_TRANSACOES
 * 🔢 VERSÃO: 16.1.18.1
 *
 * Regra:
 * - A:S indivisível.
 * - Importação pode ordenar automaticamente por esta regra.
 * - Checkbox/categoria NÃO devem acionar sort automático.
 */


const GFP_SORT_OFICIAL_PATCH_16_1_18_1 = "16.1.18.1";
const GFP_SORT_OFICIAL_SHEET_16_1_18_1 = "DB_TRANSACOES";
const GFP_SORT_OFICIAL_FULL_COLS_16_1_18_1 = 19;


/**
 * Ordena DB_TRANSACOES pela ordem oficial da mesa.
 */
function GFP_SORT_DB_TRANSACOES_OFICIAL_16_1_18_1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_SORT_OFICIAL_SHEET_16_1_18_1);

  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  GFP_SORT_OFICIAL_ENSURE_AS_16_1_18_1_(sh);

  const lastRow = sh.getLastRow();

  if (lastRow < 3) {
    return {
      ok: true,
      sorted: false,
      reason: "poucas linhas",
      patch: GFP_SORT_OFICIAL_PATCH_16_1_18_1
    };
  }

  const numRows = lastRow - 1;
  const data = sh.getRange(2, 1, numRows, GFP_SORT_OFICIAL_FULL_COLS_16_1_18_1).getValues();

  const helperValues = data.map(function(row) {
    const keys = GFP_SORT_OFICIAL_KEYS_16_1_18_1_(row);

    return [
      keys.group,
      keys.subPriority,
      keys.dateKey,
      keys.statusLabel,
      keys.audit
    ];
  });

  // O:S
  sh.getRange(2, 15, helperValues.length, 5).setValues(helperValues);

  // A:S inteiro. Nunca ordenar A:N ou A:J.
  sh.getRange(2, 1, numRows, GFP_SORT_OFICIAL_FULL_COLS_16_1_18_1)
    .sort([
      { column: 15, ascending: true },  // grupo
      { column: 16, ascending: true },  // subprioridade/confiança
      { column: 17, ascending: true },  // data desc por serial negativo
      { column: 5,  ascending: true },  // conta
      { column: 2,  ascending: true },  // descrição
      { column: 3,  ascending: true }   // valor
    ]);

  try {
    sh.hideColumns(15, 5);
  } catch (eHide) {}

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "DB_TRANSACOES ordenada pela ordem oficial.",
    "GFP 16.1.18.1",
    6
  );

  GFP_SORT_OFICIAL_LOG_16_1_18_1_(
    "OK",
    "DB_TRANSACOES ordenada pela ordem oficial.",
    "Linhas: " + numRows
  );

  return {
    ok: true,
    sorted: true,
    rows: numRows,
    patch: GFP_SORT_OFICIAL_PATCH_16_1_18_1,
    order: "REVISAO > CATEGORIZADAS > SEM_CATEGORIA > OK/99 | DATA_DESC | CONTA | DESCRICAO | VALOR"
  };
}


/**
 * Monta as chaves oficiais da linha.
 *
 * Colunas:
 * A DATA = row[0]
 * B DESC = row[1]
 * C VALOR = row[2]
 * D TIPO = row[3]
 * E CONTA = row[4]
 * F CATEGORIA = row[5]
 * I STATUS = row[8]
 * N METADADOS = row[13]
 */
function GFP_SORT_OFICIAL_KEYS_16_1_18_1_(row) {
  const data = row[0];
  const descricao = String(row[1] || "").trim();
  const valor = Number(row[2] || 0);
  const tipo = String(row[3] || "").trim().toUpperCase();
  const conta = String(row[4] || "").trim();
  const categoria = String(row[5] || "").trim();
  const status = String(row[8] || "").trim().toUpperCase();
  const meta = GFP_SORT_OFICIAL_PARSE_JSON_16_1_18_1_(row[13]);

  const hasCategory = !!categoria;
  const isOk = GFP_SORT_OFICIAL_IS_OK_16_1_18_1_(status);
  const isNeutral99 = /^99\./.test(categoria);
  const confidence = GFP_SORT_OFICIAL_CONFIDENCE_16_1_18_1_(status, meta);

  let group = 30;

  // 90 — OK e/ou neutras vão para baixo. Elas só saem da mesa ao arquivar.
  if (isOk || isNeutral99) {
    group = 90;
  }
  // 10 — sugestões/linhas que exigem revisão ativa.
  else if (GFP_SORT_OFICIAL_IS_REVIEW_STATUS_16_1_18_1_(status)) {
    group = 10;
  }
  // 20 — tem categoria, mas ainda não está OK.
  else if (hasCategory) {
    group = 20;
  }
  // 30 — sem categoria.
  else {
    group = 30;
  }

  // Menor subPriority aparece primeiro.
  // Para sugestões, confiança maior sobe.
  // Para categorizadas pendentes, prioridade neutra.
  let subPriority = 999;

  if (group === 10) {
    subPriority = 100 - confidence;
  } else if (group === 20) {
    subPriority = 500;
  } else if (group === 30) {
    subPriority = 700;
  } else {
    subPriority = 999;
  }

  const serial = GFP_SORT_OFICIAL_DATE_SERIAL_16_1_18_1_(data);
  const dateKey = -serial; // negativo para data mais recente primeiro em sort asc

  return {
    group: group,
    subPriority: subPriority,
    dateKey: dateKey,
    statusLabel: status || "PENDENTE",
    audit: [
      group,
      subPriority,
      GFP_SORT_OFICIAL_FORMAT_DATE_16_1_18_1_(data),
      conta,
      descricao.slice(0, 80),
      valor
    ].join("|")
  };
}


function GFP_SORT_OFICIAL_IS_OK_16_1_18_1_(status) {
  const s = String(status || "").trim().toUpperCase();

  return s === "OK" ||
    s === "CONCILIADO" ||
    s === "SPLIT" ||
    s === "CONSOLIDADO" ||
    s === "APROVADO";
}


function GFP_SORT_OFICIAL_IS_REVIEW_STATUS_16_1_18_1_(status) {
  const s = String(status || "").trim().toUpperCase();

  return s === "GEMINI_FORTE" ||
    s === "GEMINI_MEDIO" ||
    s === "GEMINI_MÉDIO" ||
    s === "GEMINI_FRACO" ||
    s === "GEMINI_SUGERIDO" ||
    s === "MODELO_FORTE" ||
    s === "MODELO_MEDIO" ||
    s === "MODELO_MÉDIO" ||
    s === "MODELO_FRACO" ||
    s === "REVISAR" ||
    s === "REVISAO" ||
    s === "REVISÃO" ||
    s === "PENDENTE_REVISAO" ||
    s === "PENDENTE_REVISÃO" ||
    s === "GEMINI_BLOQUEADO" ||
    s === "MODELO_BLOQUEADO" ||
    s === "BLOQUEADA";
}


function GFP_SORT_OFICIAL_CONFIDENCE_16_1_18_1_(status, meta) {
  const s = String(status || "").toUpperCase();

  if (meta && meta.classificationParams && meta.classificationParams.confidence !== undefined) {
    const n = Number(meta.classificationParams.confidence);
    if (!isNaN(n)) return Math.max(0, Math.min(100, n));
  }

  if (s.indexOf("FORTE") >= 0) return 95;
  if (s.indexOf("MEDIO") >= 0 || s.indexOf("MÉDIO") >= 0) return 75;
  if (s.indexOf("FRACO") >= 0) return 40;

  return 0;
}


function GFP_SORT_OFICIAL_DATE_SERIAL_16_1_18_1_(value) {
  if (value instanceof Date && !isNaN(value)) {
    return Math.floor(value.getTime() / 86400000);
  }

  const s = String(value || "").trim();

  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Math.floor(d.getTime() / 86400000);
  }

  // yyyy-mm-dd
  const y = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (y) {
    const d = new Date(Number(y[1]), Number(y[2]) - 1, Number(y[3]));
    return Math.floor(d.getTime() / 86400000);
  }

  return 0;
}


function GFP_SORT_OFICIAL_FORMAT_DATE_16_1_18_1_(value) {
  if (value instanceof Date && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || "America/Sao_Paulo", "yyyy-MM-dd");
  }

  return String(value || "");
}


function GFP_SORT_OFICIAL_PARSE_JSON_16_1_18_1_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}


function GFP_SORT_OFICIAL_ENSURE_AS_16_1_18_1_(sh) {
  const requiredCols = GFP_SORT_OFICIAL_FULL_COLS_16_1_18_1;

  if (sh.getMaxColumns() < requiredCols) {
    sh.insertColumnsAfter(sh.getMaxColumns(), requiredCols - sh.getMaxColumns());
  }

  const headers = [
    "SYS_SORT_GRUPO",
    "SYS_SORT_SUBPRIORIDADE",
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
}


function GFP_SORT_OFICIAL_LOG_16_1_18_1_(type, message, obs) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("SYS_LOGS");

    if (!sh) return;

    sh.insertRowBefore(2);
    sh.getRange(2, 1, 1, 5).setValues([[
      Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss"),
      type || "INFO",
      "Ordenação",
      message || "",
      obs || ""
    ]]);
  } catch (e) {}
}


/**
 * Executar uma vez após aplicar o patch.
 */
function GFP_DESATIVAR_AUTO_REORDENACAO_E_AUTOARQUIVO_ONEDIT_16_1_18_1() {
  PropertiesService.getScriptProperties().setProperty("GFP_SORT_AUTO_AFTER_APPROVAL_14_3", "FALSE");
  PropertiesService.getScriptProperties().setProperty("GFP_ONEDIT_AUTO_ARCHIVE_OK", "FALSE");

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Auto-reordenação/autoarquivamento por edição manual desativados.",
    "GFP 16.1.18.1",
    8
  );

  return {
    ok: true,
    sortAutoAfterApproval: false,
    onEditAutoArchiveOk: false,
    patch: GFP_SORT_OFICIAL_PATCH_16_1_18_1
  };
}
