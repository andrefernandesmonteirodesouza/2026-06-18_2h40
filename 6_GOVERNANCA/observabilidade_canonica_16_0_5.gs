/**
 * =============================================================================
 * GFP 16.0.5 — OBSERVABILIDADE CANÔNICA
 * =============================================================================
 *
 * Abas oficiais:
 *
 * SYS_LOGS       = eventos operacionais.
 * SYS_RELATORIOS = journal técnico / payload completo.
 * SYS_AUDITORIA  = leitura humana tabular, uma linha por checagem/issue.
 * =============================================================================
 */

const GFP_OBS_VERSION_16_0_5 = "16.0.5";

const GFP_OBS_LOG_SOURCES_16_0_5 = [
  "LOG_REVISAO_IA",
  "LOG_ARQUIVAMENTO",
  "SYS_RESET_LOG"
];

const GFP_OBS_AUDIT_REPORT_SOURCES_16_0_5 = [
  "SYS_RELATORIOS",
  "REL_PRE16_FINAL_GFP",
  "REL_ORGANIZACAO_ABAS_GFP",
  "REL_CLASSIFICACAO_ABAS_GFP",
  "SYS_AUDITORIA_GFP",
  "SYS_DASHBOARD_2_AUDIT",
  "SYS_REVIEW_PANEL_2_AUDIT",
  "SYS_PRECHECK_BASE_FINAL",
  "SYS_SAUDE_GFP",
  "SYS_LIMPEZA_TECNICA_GFP",
  "SYS_TAXONOMIA_REPORT",
  "AUDITORIA_GFP",
  "SYS_AUDIT_REPORT"
];

const GFP_OBS_LEGACY_SHEETS_DELETABLE_16_0_5 = [
  "LOG_REVISAO_IA",
  "LOG_ARQUIVAMENTO",
  "SYS_RESET_LOG",
  "REL_PRE16_FINAL_GFP",
  "REL_ORGANIZACAO_ABAS_GFP",
  "REL_CLASSIFICACAO_ABAS_GFP",
  "SYS_AUDITORIA_GFP",
  "SYS_DASHBOARD_2_AUDIT",
  "SYS_REVIEW_PANEL_2_AUDIT",
  "SYS_PRECHECK_BASE_FINAL",
  "SYS_SAUDE_GFP",
  "SYS_LIMPEZA_TECNICA_GFP",
  "SYS_TAXONOMIA_REPORT",
  "AUDITORIA_GFP",
  "SYS_AUDIT_REPORT"
];

function GFP_OBS_CANONIZAR_TUDO_16_0_5() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const result = {
    version: GFP_OBS_VERSION_16_0_5,
    startedAt: new Date().toISOString(),
    finishedAt: "",
    logsImported: 0,
    auditoriaRows: 0,
    relatoriosRows: 0,
    hiddenSheets: 0,
    errors: []
  };

  try {
    result.logsImported = GFP_OBS_IMPORTAR_LOGS_LEGADOS_16_0_5_();
  } catch (e) {
    result.errors.push("IMPORTAR_LOGS: " + e.message);
  }

  try {
    result.auditoriaRows = GFP_OBS_RECONSTRUIR_SYS_AUDITORIA_16_0_5_();
  } catch (e2) {
    result.errors.push("RECONSTRUIR_SYS_AUDITORIA: " + e2.message);
  }

  try {
    result.relatoriosRows = GFP_OBS_GARANTIR_SYS_RELATORIOS_16_0_5_();
  } catch (e3) {
    result.errors.push("GARANTIR_SYS_RELATORIOS: " + e3.message);
  }

  try {
    GFP_OBS_SORT_CANONICAS_16_0_5();
  } catch (e4) {
    result.errors.push("SORT_CANONICAS: " + e4.message);
  }

  try {
    result.hiddenSheets = GFP_OBS_OCULTAR_ABAS_LEGADAS_16_0_5();
  } catch (e5) {
    result.errors.push("OCULTAR_LEGADAS: " + e5.message);
  }

  try {
    GFP_OBS_ORDENAR_ABAS_VISIVEIS_16_0_5_();
  } catch (e6) {
    result.errors.push("ORDENAR_VISIVEIS: " + e6.message);
  }

  result.finishedAt = new Date().toISOString();

  GFP_OBS_SYS_LOG_16_0_5_(
    "OBS_CANONICA",
    "CANONIZAR_TUDO",
    result.errors.length ? "ATENCAO" : "OK",
    "Centralização de logs/relatórios/auditorias concluída.",
    result
  );

  GFP_OBS_APPEND_SYS_RELATORIOS_16_0_5_(
    "OBS_CANONICA",
    result.errors.length ? "ATENCAO" : "OK",
    "GFP_OBS_CANONIZAR_TUDO_16_0_5",
    "Centralização de observabilidade concluída.",
    result
  );

  SpreadsheetApp.getActive().toast(
    "Observabilidade: logs +" + result.logsImported +
    " | auditoria " + result.auditoriaRows +
    " | ocultas " + result.hiddenSheets +
    " | erros " + result.errors.length,
    "GFP 16.0.5"
  );

  return {
    ok: result.errors.length === 0,
    result: result
  };
}

/**
 * Importa LOG_* e SYS_RESET_LOG para SYS_LOGS, sem duplicar.
 */
function GFP_OBS_IMPORTAR_LOGS_LEGADOS_16_0_5_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const target = GFP_OBS_ENSURE_SYS_LOGS_16_0_5_();
  const existing = GFP_OBS_EXISTING_SIGNATURES_16_0_5_(target, 4);
  const rows = [];

  GFP_OBS_LOG_SOURCES_16_0_5.forEach(function(sourceName) {
    const sh = ss.getSheetByName(sourceName);
    if (!sh || sh.getLastRow() < 2) return;

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();

    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

    values.forEach(function(row, idx) {
      if (GFP_OBS_ROW_EMPTY_16_0_5_(row)) return;

      const sourceRow = idx + 2;
      const signature = "OBS16_LOG|" + sourceName + "|" + sourceRow;

      if (existing[signature]) return;

      const ts = GFP_OBS_FIND_DATE_16_0_5_(headers, row) || new Date();
      const level = GFP_OBS_FIND_STATUS_16_0_5_(headers, row) || "INFO";
      const action = GFP_OBS_FIND_ACTION_16_0_5_(headers, row) || "IMPORT_LOG";
      const payload = {
        sourceSheet: sourceName,
        sourceRow: sourceRow,
        headers: headers,
        values: row
      };

      rows.push([
        ts,
        level,
        "IMPORTADO_" + sourceName + "_" + action,
        signature + " | " + GFP_OBS_SAFE_JSON_16_0_5_(payload, 40000),
        ""
      ]);

      existing[signature] = true;
    });
  });

  if (rows.length) {
    target.getRange(target.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  }

  return rows.length;
}

/**
 * Recria SYS_AUDITORIA lendo todas as fontes de auditoria/relatório.
 */
function GFP_OBS_RECONSTRUIR_SYS_AUDITORIA_16_0_5_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const target = GFP_OBS_ENSURE_SYS_AUDITORIA_16_0_5_();

  target.clear();
  GFP_OBS_WRITE_AUDITORIA_HEADER_16_0_5_(target);

  const rows = [];

  GFP_OBS_AUDIT_REPORT_SOURCES_16_0_5.forEach(function(sourceName) {
    const sh = ss.getSheetByName(sourceName);
    if (!sh || sh.getLastRow() < 2) return;

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();

    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

    values.forEach(function(row, idx) {
      if (GFP_OBS_ROW_EMPTY_16_0_5_(row)) return;

      const sourceRow = idx + 2;

      const base = GFP_OBS_MAKE_AUDIT_ROW_16_0_5_(sourceName, sourceRow, headers, row);
      rows.push(base);

      const payloadText = String(base[9] || "");
      const payload = GFP_OBS_SAFE_PARSE_16_0_5_(payloadText);

      // Explode payload.rows[] da promoção 16.0 ou de relatórios similares.
      if (payload && payload.rows && Array.isArray(payload.rows)) {
        payload.rows.forEach(function(r) {
          rows.push([
            GFP_OBS_AS_DATE_16_0_5_(r.timestamp),
            String(r.status || base[1] || "INFO").toUpperCase(),
            sourceName,
            String(r.etapa || base[3] || ""),
            String(r.status || base[4] || ""),
            String(r.detalhe || ""),
            "",
            sourceName,
            sourceRow,
            String(r.retorno || "")
          ]);
        });
      }

      // Explode payload.issues[] de Dashboard/Painel.
      if (payload && payload.issues && Array.isArray(payload.issues)) {
        payload.issues.forEach(function(issue) {
          if (Array.isArray(issue)) {
            rows.push([
              GFP_OBS_AS_DATE_16_0_5_(issue[0]),
              String(issue[1] || "INFO").toUpperCase(),
              String(issue[3] || sourceName),
              String(issue[2] || ""),
              String(issue[1] || ""),
              issue.slice(4).map(function(v) { return String(v || ""); }).join(" | "),
              "",
              sourceName,
              sourceRow,
              GFP_OBS_SAFE_JSON_16_0_5_(issue, 40000)
            ]);
          } else if (issue && typeof issue === "object") {
            rows.push([
              GFP_OBS_AS_DATE_16_0_5_(issue.timestamp || issue.data),
              String(issue.status || issue.severity || "INFO").toUpperCase(),
              String(issue.area || sourceName),
              String(issue.check || issue.codigo || issue.code || ""),
              String(issue.resultado || issue.status || ""),
              String(issue.message || issue.detalhe || issue.mensagem || ""),
              String(issue.acao || issue.action || ""),
              sourceName,
              sourceRow,
              GFP_OBS_SAFE_JSON_16_0_5_(issue, 40000)
            ]);
          }
        });
      }
    });
  });

  if (rows.length) {
    target.getRange(2, 1, rows.length, 10).setValues(rows);
  }

  GFP_OBS_FORMAT_AUDITORIA_16_0_5_(target);
  return rows.length;
}

function GFP_OBS_GARANTIR_SYS_RELATORIOS_16_0_5_() {
  const sh = GFP_OBS_ENSURE_SYS_RELATORIOS_16_0_5_();
  return Math.max(0, sh.getLastRow() - 1);
}

function GFP_OBS_SORT_CANONICAS_16_0_5() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  [
    { name: "SYS_LOGS", col: 1 },
    { name: "SYS_RELATORIOS", col: 1 },
    { name: "SYS_AUDITORIA", col: 1 }
  ].forEach(function(cfg) {
    const sh = ss.getSheetByName(cfg.name);
    if (!sh || sh.getLastRow() < 3) return;

    sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn())
      .sort([{ column: cfg.col, ascending: false }]);

    if (sh.getFilter()) sh.getFilter().remove();
    sh.getDataRange().createFilter();
    sh.setFrozenRows(1);
  });

  SpreadsheetApp.getActive().toast("SYS_LOGS, SYS_RELATORIOS e SYS_AUDITORIA ordenadas.", "GFP 16.0.5");
}

/**
 * Oculta fontes legadas após consolidar.
 */
function GFP_OBS_OCULTAR_ABAS_LEGADAS_16_0_5() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hidden = 0;

  GFP_OBS_LEGACY_SHEETS_DELETABLE_16_0_5.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    if (sh.isSheetHidden()) return;

    if (ss.getSheets().filter(function(s) { return !s.isSheetHidden(); }).length <= 1) return;

    sh.hideSheet();
    hidden++;
  });

  return hidden;
}

/**
 * Exclui fisicamente as abas legadas.
 *
 * Use somente depois de:
 * 1. Rodar GFP_OBS_CANONIZAR_TUDO_16_0_5()
 * 2. Conferir SYS_LOGS/SYS_RELATORIOS/SYS_AUDITORIA
 * 3. Fazer snapshot/backup se desejar.
 */
function GFP_OBS_EXCLUIR_ABAS_LEGADAS_16_0_5(confirmacao) {
  if (confirmacao !== "EXCLUIR_ABAS_LEGADAS_16_0_5") {
    throw new Error('Confirmação inválida. Use exatamente: EXCLUIR_ABAS_LEGADAS_16_0_5');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Consolida antes de excluir.
  GFP_OBS_CANONIZAR_TUDO_16_0_5();

  const first = ss.getSheetByName("DB_TRANSACOES") ||
    ss.getSheetByName("SYS_AUDITORIA") ||
    ss.getSheets()[0];

  if (first) ss.setActiveSheet(first);

  const deleted = [];

  GFP_OBS_LEGACY_SHEETS_DELETABLE_16_0_5.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;

    ss.deleteSheet(sh);
    deleted.push(name);
  });

  GFP_OBS_SYS_LOG_16_0_5_(
    "OBS_CANONICA",
    "EXCLUIR_ABAS_LEGADAS",
    "OK",
    "Abas legadas excluídas após consolidação.",
    { deleted: deleted }
  );

  SpreadsheetApp.getActive().toast("Abas legadas excluídas: " + deleted.length, "GFP 16.0.5");

  return { ok: true, deleted: deleted };
}

/**
 * Rodar auditoria final e depois canonizar tudo.
 */
function GFP_OBS_AUDITORIA_FINAL_CANONICA_16_0_5() {
  let result = null;

  if (typeof GFP_AUDITORIA_FINAL_16_0_4 === "function") {
    result = GFP_AUDITORIA_FINAL_16_0_4();
  } else if (typeof GFP_16_PROMOVER_ESTAVEL_FINAL === "function") {
    result = GFP_16_PROMOVER_ESTAVEL_FINAL();
  }

  const canon = GFP_OBS_CANONIZAR_TUDO_16_0_5();

  return {
    ok: canon.ok !== false,
    auditoria: result,
    canonizacao: canon
  };
}

/**
 * =============================================================================
 * HELPERS
 * =============================================================================
 */

function GFP_OBS_ENSURE_SYS_LOGS_16_0_5_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("SYS_LOGS");

  if (!sh) sh = ss.insertSheet("SYS_LOGS");

  const header = ["Timestamp", "Level", "Function", "Message", "Stack Trace"];
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#1f4e78").setFontColor("#ffffff");
  return sh;
}

function GFP_OBS_ENSURE_SYS_RELATORIOS_16_0_5_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("SYS_RELATORIOS");

  if (!sh) sh = ss.insertSheet("SYS_RELATORIOS");

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
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#1f4e78").setFontColor("#ffffff");
  return sh;
}

function GFP_OBS_ENSURE_SYS_AUDITORIA_16_0_5_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("SYS_AUDITORIA");

  if (!sh) sh = ss.insertSheet("SYS_AUDITORIA");

  GFP_OBS_WRITE_AUDITORIA_HEADER_16_0_5_(sh);
  return sh;
}

function GFP_OBS_WRITE_AUDITORIA_HEADER_16_0_5_(sh) {
  const header = [
    "TIMESTAMP",
    "SEVERIDADE",
    "ÁREA",
    "CHECAGEM",
    "RESULTADO",
    "DETALHE",
    "AÇÃO SUGERIDA",
    "ORIGEM",
    "ORIGEM_LINHA",
    "PAYLOAD_JSON"
  ];

  sh.getRange(1, 1, 1, header.length).setValues([header]);
  GFP_OBS_FORMAT_AUDITORIA_16_0_5_(sh);
}

function GFP_OBS_FORMAT_AUDITORIA_16_0_5_(sh) {
  sh.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#1f4e78").setFontColor("#ffffff");
  sh.setFrozenRows(1);

  if (sh.getFilter()) sh.getFilter().remove();
  sh.getDataRange().createFilter();

  try { sh.autoResizeColumns(1, 10); } catch (e) {}
  try { sh.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss"); } catch (e2) {}
  try { sh.getRange("F:J").setWrap(true); } catch (e3) {}
}

function GFP_OBS_MAKE_AUDIT_ROW_16_0_5_(sourceName, sourceRow, headers, row) {
  const ts = GFP_OBS_FIND_DATE_16_0_5_(headers, row) || new Date();
  const sev = GFP_OBS_FIND_STATUS_16_0_5_(headers, row) || "INFO";
  const area = GFP_OBS_FIND_BY_HEADERS_16_0_5_(headers, row, ["ÁREA", "AREA", "TIPO", "MODULO", "ORIGEM_ABA", "ABA"]) || sourceName;
  const check = GFP_OBS_FIND_ACTION_16_0_5_(headers, row) || sourceName;
  const result = GFP_OBS_FIND_BY_HEADERS_16_0_5_(headers, row, ["RESULTADO", "STATUS"]) || sev;
  const detail = GFP_OBS_FIND_BY_HEADERS_16_0_5_(headers, row, ["DETALHE", "MESSAGE", "MENSAGEM", "OBSERVACAO", "OBSERVAÇÃO", "RETORNO"]) ||
    row.map(function(v) { return String(v || ""); }).filter(Boolean).join(" | ").substring(0, 5000);
  const action = GFP_OBS_FIND_BY_HEADERS_16_0_5_(headers, row, ["AÇÃO SUGERIDA", "ACAO_SUGERIDA", "ACTION", "ACAO", "AÇÃO"]) || "";

  const payload = {
    sourceSheet: sourceName,
    sourceRow: sourceRow,
    headers: headers,
    values: row
  };

  return [
    GFP_OBS_AS_DATE_16_0_5_(ts),
    String(sev || "INFO").toUpperCase(),
    String(area || ""),
    String(check || ""),
    String(result || ""),
    String(detail || ""),
    String(action || ""),
    sourceName,
    sourceRow,
    GFP_OBS_SAFE_JSON_16_0_5_(payload, 40000)
  ];
}

function GFP_OBS_FIND_DATE_16_0_5_(headers, row) {
  const candidates = ["TIMESTAMP", "TIMESTAMP_CONSOLIDACAO", "DATA", "DATA_EXECUCAO", "INICIO"];

  for (let i = 0; i < headers.length; i++) {
    const h = GFP_OBS_NORM_16_0_5_(headers[i]);
    if (candidates.map(GFP_OBS_NORM_16_0_5_).indexOf(h) >= 0) {
      const v = row[i];
      if (v instanceof Date && !isNaN(v.getTime())) return v;
      if (typeof v === "string" && v.trim()) {
        const d = new Date(v);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }

  return null;
}

function GFP_OBS_FIND_STATUS_16_0_5_(headers, row) {
  return GFP_OBS_FIND_BY_HEADERS_16_0_5_(headers, row, ["SEVERIDADE", "GRAVIDADE", "STATUS", "LEVEL"]) || "";
}

function GFP_OBS_FIND_ACTION_16_0_5_(headers, row) {
  return GFP_OBS_FIND_BY_HEADERS_16_0_5_(headers, row, [
    "CHECAGEM",
    "CHECK",
    "CODIGO",
    "CÓDIGO",
    "ETAPA_CODIGO",
    "FUNCAO_WRAPPER",
    "FUNCTION",
    "ACAO",
    "AÇÃO",
    "TIPO"
  ]) || "";
}

function GFP_OBS_FIND_BY_HEADERS_16_0_5_(headers, row, names) {
  const wanted = names.map(GFP_OBS_NORM_16_0_5_);

  for (let i = 0; i < headers.length; i++) {
    const h = GFP_OBS_NORM_16_0_5_(headers[i]);
    if (wanted.indexOf(h) >= 0) return row[i];
  }

  return "";
}

function GFP_OBS_ROW_EMPTY_16_0_5_(row) {
  return row.every(function(v) {
    return v === null || v === undefined || String(v).trim() === "";
  });
}

function GFP_OBS_AS_DATE_16_0_5_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;

  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date();
}

function GFP_OBS_SAFE_PARSE_16_0_5_(text) {
  try {
    if (!text) return null;
    return JSON.parse(String(text));
  } catch (e) {
    return null;
  }
}

function GFP_OBS_SAFE_JSON_16_0_5_(value, maxLen) {
  maxLen = maxLen || 30000;

  try {
    const str = JSON.stringify(value, function(key, val) {
      if (val instanceof Date) return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
      return val;
    });

    if (!str) return "";

    return str.length > maxLen ? str.substring(0, maxLen) + "...[cortado]" : str;
  } catch (e) {
    const fallback = String(value || "");
    return fallback.length > maxLen ? fallback.substring(0, maxLen) + "...[cortado]" : fallback;
  }
}

function GFP_OBS_NORM_16_0_5_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function GFP_OBS_EXISTING_SIGNATURES_16_0_5_(sheet, columnIndex) {
  const out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;

  const values = sheet.getRange(2, columnIndex, sheet.getLastRow() - 1, 1).getValues();

  values.forEach(function(row) {
    const text = String(row[0] || "");
    const match = text.match(/OBS16_LOG\|[^|]+\|\d+/);
    if (match) out[match[0]] = true;
  });

  return out;
}

function GFP_OBS_APPEND_SYS_RELATORIOS_16_0_5_(tipo, status, etapa, detalhe, payload) {
  const sh = GFP_OBS_ENSURE_SYS_RELATORIOS_16_0_5_();

  sh.appendRow([
    new Date(),
    "GFP_16_0_5",
    "",
    tipo || "OBS_CANONICA",
    status || "INFO",
    etapa || "",
    detalhe || "",
    GFP_OBS_SAFE_JSON_16_0_5_(payload || {}, 40000)
  ]);
}

function GFP_OBS_SYS_LOG_16_0_5_(modulo, acao, status, detalhe, payload) {
  const sh = GFP_OBS_ENSURE_SYS_LOGS_16_0_5_();

  sh.appendRow([
    new Date(),
    status || "INFO",
    modulo + "." + acao,
    String(detalhe || "") + (payload ? " | payload=" + GFP_OBS_SAFE_JSON_16_0_5_(payload, 40000) : ""),
    ""
  ]);
}

function GFP_OBS_ORDENAR_ABAS_VISIVEIS_16_0_5_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const order = [
    "DB_TRANSACOES",
    "DB_TRANSACOES_HIST",
    "DB_MEMORIA",
    "SYS_LOGS",
    "SYS_AUDITORIA",
    "SYS_RELATORIOS",
    "DRE_GERENCIAL",
    "VISAO_FUTURO",
    "CFG_Aprendizado",
    "CFG_Categorias",
    "CFG_Contas",
    "CFG_Cartoes"
  ];

  let pos = 1;

  order.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;

    try {
      if (sh.isSheetHidden()) sh.showSheet();
      ss.setActiveSheet(sh);
      ss.moveActiveSheet(pos++);
    } catch (e) {}
  });

  try {
    const first = ss.getSheetByName("DB_TRANSACOES");
    if (first) ss.setActiveSheet(first);
  } catch (e2) {}
}

/**
 * =============================================================================
 * GFP 16.0.5.1 — Executor confirmado para excluir abas legadas
 * =============================================================================
 *
 * Use esta função no dropdown do Apps Script.
 *
 * Ela chama a função protegida original passando a confirmação correta.
 */
function GFP_OBS_EXCLUIR_ABAS_LEGADAS_CONFIRMADO_16_0_5() {
  return GFP_OBS_EXCLUIR_ABAS_LEGADAS_16_0_5("EXCLUIR_ABAS_LEGADAS_16_0_5");
}

/**
 * Alias mais explícito, caso prefira ver o nome completo no dropdown.
 */
function GFP_OBS_EXECUTAR_EXCLUSAO_ABAS_LEGADAS_16_0_5() {
  return GFP_OBS_EXCLUIR_ABAS_LEGADAS_CONFIRMADO_16_0_5();
}
