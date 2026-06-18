/**
 * =============================================================================
 * GFP 16.0.5.4 — OBSERVABILIDADE FINAL CONSOLIDADA
 * =============================================================================
 *
 * Abas canônicas:
 *
 * SYS_LOGS       = eventos operacionais.
 * SYS_AUDITORIA  = auditoria humana, limpa e filtrável.
 * SYS_TECNICO    = payloads/JSON/rastreabilidade bruta — OCULTA por padrão.
 *
 * SYS_RELATORIOS = legado/descontinuado. Migrar para SYS_TECNICO.
 * =============================================================================
 */

const GFP_OBS_FINAL_VERSION_16_0_5_4 = "16.0.5.4";

const GFP_OBS_FINAL_SHEET_LOGS_16_0_5_4 = "SYS_LOGS";
const GFP_OBS_FINAL_SHEET_AUDIT_16_0_5_4 = "SYS_AUDITORIA";
const GFP_OBS_FINAL_SHEET_TECNICO_16_0_5_4 = "SYS_TECNICO";
const GFP_OBS_FINAL_SHEET_RELATORIOS_LEGACY_16_0_5_4 = "SYS_RELATORIOS";

const GFP_OBS_FINAL_AUDIT_HEADERS_16_0_5_4 = [
  "TIMESTAMP",
  "SEVERIDADE",
  "ÁREA",
  "CHECAGEM",
  "RESULTADO",
  "DETALHE",
  "AÇÃO SUGERIDA"
];

const GFP_OBS_FINAL_TECNICO_HEADERS_16_0_5_4 = [
  "TIMESTAMP_CONSOLIDACAO",
  "ORIGEM_ABA",
  "ORIGEM_LINHA",
  "TIPO",
  "STATUS",
  "ETAPA_CODIGO",
  "DETALHE",
  "PAYLOAD_JSON"
];

const GFP_OBS_FINAL_LOG_HEADERS_16_0_5_4 = [
  "Timestamp",
  "Level",
  "Function",
  "Message",
  "Stack Trace"
];

/**
 * Fontes antigas de log operacional.
 */
const GFP_OBS_FINAL_LOG_SOURCES_16_0_5_4 = [
  "LOG_REVISAO_IA",
  "LOG_ARQUIVAMENTO",
  "SYS_RESET_LOG"
];

/**
 * Fontes antigas de auditoria/relatório a consolidar.
 */
const GFP_OBS_FINAL_AUDIT_SOURCES_16_0_5_4 = [
  "AUDITORIA_GFP",
  "SYS_AUDITORIA_GFP",
  "SYS_DASHBOARD_2_AUDIT",
  "SYS_REVIEW_PANEL_2_AUDIT",
  "SYS_PRECHECK_BASE_FINAL",
  "SYS_SAUDE_GFP",
  "SYS_LIMPEZA_TECNICA_GFP",
  "SYS_TAXONOMIA_REPORT",
  "SYS_AUDIT_REPORT",
  "REL_PRE16_FINAL_GFP",
  "REL_ORGANIZACAO_ABAS_GFP",
  "REL_CLASSIFICACAO_ABAS_GFP",
  "SYS_RELATORIOS",
  "SYS_TECNICO"
];

/**
 * Abas legadas que podem ser ocultadas depois de consolidadas.
 * SYS_RELATORIOS é removida/migrada para SYS_TECNICO.
 */
const GFP_OBS_FINAL_LEGACY_SHEETS_16_0_5_4 = [
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

/**
 * =============================================================================
 * FUNÇÃO PRINCIPAL
 * =============================================================================
 *
 * Execute esta função após aplicar o patch.
 */
function GFP_OBS_FINAL_CANONIZAR_16_0_5_4() {
  const result = {
    version: GFP_OBS_FINAL_VERSION_16_0_5_4,
    startedAt: new Date().toISOString(),
    logsImported: 0,
    tecnicoMigrated: null,
    tecnicoRows: 0,
    auditoriaRows: 0,
    hiddenLegacySheets: 0,
    sysTecnicoHidden: false,
    sysRelatoriosRemoved: false,
    sorted: false,
    finishedAt: "",
    ok: true,
    errors: []
  };

  try {
    result.logsImported = GFP_OBS_FINAL_IMPORTAR_LOGS_LEGADOS_16_0_5_4_();
  } catch (e) {
    result.errors.push("IMPORTAR_LOGS: " + e.message);
  }

  try {
    result.tecnicoMigrated = GFP_OBS_FINAL_MIGRAR_SYS_RELATORIOS_PARA_TECNICO_16_0_5_4_();
    result.sysRelatoriosRemoved = !!(result.tecnicoMigrated && result.tecnicoMigrated.removedLegacy);
  } catch (e2) {
    result.errors.push("MIGRAR_SYS_RELATORIOS: " + e2.message);
  }

  try {
    result.tecnicoRows = GFP_OBS_FINAL_CONSOLIDAR_TECNICO_16_0_5_4_();
  } catch (e3) {
    result.errors.push("CONSOLIDAR_TECNICO: " + e3.message);
  }

  try {
    result.auditoriaRows = GFP_OBS_FINAL_RECONSTRUIR_SYS_AUDITORIA_16_0_5_4_();
  } catch (e4) {
    result.errors.push("RECONSTRUIR_SYS_AUDITORIA: " + e4.message);
  }

  try {
    GFP_OBS_FINAL_SORT_CANONICAS_16_0_5_4();
    result.sorted = true;
  } catch (e5) {
    result.errors.push("SORT_CANONICAS: " + e5.message);
  }

  try {
    result.hiddenLegacySheets = GFP_OBS_FINAL_OCULTAR_ABAS_LEGADAS_16_0_5_4_();
  } catch (e6) {
    result.errors.push("OCULTAR_LEGADAS: " + e6.message);
  }

  try {
    result.sysTecnicoHidden = GFP_OBS_FINAL_OCULTAR_SYS_TECNICO_16_0_5_4();
  } catch (e7) {
    result.errors.push("OCULTAR_SYS_TECNICO: " + e7.message);
  }

  try {
    GFP_OBS_FINAL_ORDENAR_ABAS_VISIVEIS_16_0_5_4_();
  } catch (e8) {
    result.errors.push("ORDENAR_ABAS_VISIVEIS: " + e8.message);
  }

  result.finishedAt = new Date().toISOString();
  result.ok = result.errors.length === 0;

  // Registro técnico em SYS_TECNICO.
  GFP_OBS_FINAL_APPEND_TECNICO_16_0_5_4_(
    "OBS_FINAL",
    result.ok ? "OK" : "ATENCAO",
    "GFP_OBS_FINAL_CANONIZAR_16_0_5_4",
    "Canonização final de observabilidade concluída.",
    result
  );

  // Registro operacional em SYS_LOGS.
  GFP_OBS_FINAL_SYS_LOG_16_0_5_4_(
    "OBS_FINAL",
    "CANONIZAR",
    result.ok ? "OK" : "ATENCAO",
    "Canonização final de observabilidade concluída.",
    result
  );

  // Garante de novo que SYS_TECNICO fique oculta depois do próprio registro.
  GFP_OBS_FINAL_OCULTAR_SYS_TECNICO_16_0_5_4();

  SpreadsheetApp.getActive().toast(
    "Observabilidade final: auditoria " + result.auditoriaRows +
    " | técnico " + result.tecnicoRows +
    " | logs +" + result.logsImported +
    " | erros " + result.errors.length,
    "GFP 16.0.5.4"
  );

  return result;
}

/**
 * Alias mais curto.
 */
function GFP_OBS_FINAL_16_0_5_4() {
  return GFP_OBS_FINAL_CANONIZAR_16_0_5_4();
}

/**
 * =============================================================================
 * SYS_LOGS
 * =============================================================================
 */

function GFP_OBS_FINAL_IMPORTAR_LOGS_LEGADOS_16_0_5_4_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const target = GFP_OBS_FINAL_ENSURE_LOGS_16_0_5_4_();
  const existing = GFP_OBS_FINAL_EXISTING_LOG_SIGNATURES_16_0_5_4_(target);

  const rows = [];

  GFP_OBS_FINAL_LOG_SOURCES_16_0_5_4.forEach(function(sourceName) {
    const sh = ss.getSheetByName(sourceName);
    if (!sh || sh.getLastRow() < 2) return;

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();

    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

    values.forEach(function(row, idx) {
      if (GFP_OBS_FINAL_ROW_EMPTY_16_0_5_4_(row)) return;

      const sourceRow = idx + 2;
      const signature = "OBS_FINAL_LOG|" + sourceName + "|" + sourceRow;

      if (existing[signature]) return;

      const timestamp = GFP_OBS_FINAL_FIND_DATE_16_0_5_4_(headers, row) || new Date();
      const level = GFP_OBS_FINAL_FIND_STATUS_16_0_5_4_(headers, row) || "INFO";
      const fn = "IMPORTADO_" + sourceName;
      const message = signature + " | " + GFP_OBS_FINAL_SAFE_JSON_16_0_5_4_({
        sourceSheet: sourceName,
        sourceRow: sourceRow,
        headers: headers,
        values: row
      }, 40000);

      rows.push([
        GFP_OBS_FINAL_AS_DATE_16_0_5_4_(timestamp),
        String(level || "INFO").toUpperCase(),
        fn,
        message,
        ""
      ]);

      existing[signature] = true;
    });
  });

  if (rows.length) {
    target.getRange(target.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  }

  GFP_OBS_FINAL_FORMAT_LOGS_16_0_5_4_(target);

  return rows.length;
}

/**
 * =============================================================================
 * SYS_TECNICO
 * =============================================================================
 */

function GFP_OBS_FINAL_MIGRAR_SYS_RELATORIOS_PARA_TECNICO_16_0_5_4_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let tecnico = ss.getSheetByName(GFP_OBS_FINAL_SHEET_TECNICO_16_0_5_4);
  let relatorios = ss.getSheetByName(GFP_OBS_FINAL_SHEET_RELATORIOS_LEGACY_16_0_5_4);

  const result = {
    action: "",
    rowsMigrated: 0,
    removedLegacy: false
  };

  if (relatorios && !tecnico) {
    relatorios.setName(GFP_OBS_FINAL_SHEET_TECNICO_16_0_5_4);
    tecnico = relatorios;
    relatorios = null;

    GFP_OBS_FINAL_ENSURE_TECNICO_HEADER_16_0_5_4_(tecnico);
    result.action = "RENAMED_SYS_RELATORIOS_TO_SYS_TECNICO";
    result.rowsMigrated = Math.max(0, tecnico.getLastRow() - 1);
    result.removedLegacy = true;
    return result;
  }

  if (!tecnico) {
    tecnico = ss.insertSheet(GFP_OBS_FINAL_SHEET_TECNICO_16_0_5_4);
    GFP_OBS_FINAL_ENSURE_TECNICO_HEADER_16_0_5_4_(tecnico);
    result.action = "CREATED_SYS_TECNICO";
  }

  if (relatorios && tecnico && relatorios.getSheetId() !== tecnico.getSheetId()) {
    result.rowsMigrated = GFP_OBS_FINAL_COPY_UNIQUE_TO_TECNICO_16_0_5_4_(relatorios, tecnico);

    const active = ss.getSheetByName("DB_TRANSACOES") || tecnico;
    ss.setActiveSheet(active);
    ss.deleteSheet(relatorios);

    result.action = "MERGED_AND_DELETED_SYS_RELATORIOS";
    result.removedLegacy = true;
  }

  GFP_OBS_FINAL_FORMAT_TECNICO_16_0_5_4_(tecnico);

  return result;
}

function GFP_OBS_FINAL_CONSOLIDAR_TECNICO_16_0_5_4_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const target = GFP_OBS_FINAL_ENSURE_TECNICO_16_0_5_4_();

  const existing = GFP_OBS_FINAL_EXISTING_TECNICO_SIGNATURES_16_0_5_4_(target);
  const rowsToAppend = [];

  GFP_OBS_FINAL_AUDIT_SOURCES_16_0_5_4.forEach(function(sourceName) {
    const sh = ss.getSheetByName(sourceName);
    if (!sh) return;
    if (sh.getSheetId() === target.getSheetId()) return;
    if (sourceName === GFP_OBS_FINAL_SHEET_RELATORIOS_LEGACY_16_0_5_4) return;
    if (sh.getLastRow() < 2) return;

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();

    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

    values.forEach(function(row, idx) {
      if (GFP_OBS_FINAL_ROW_EMPTY_16_0_5_4_(row)) return;

      const normalized = GFP_OBS_FINAL_NORMALIZE_TECNICO_ROW_16_0_5_4_(
        sourceName,
        idx + 2,
        headers,
        row
      );

      const sig = normalized.map(function(v) {
        return String(v || "");
      }).join("|");

      if (existing[sig]) return;

      rowsToAppend.push(normalized);
      existing[sig] = true;
    });
  });

  if (rowsToAppend.length) {
    target.getRange(target.getLastRow() + 1, 1, rowsToAppend.length, 8).setValues(rowsToAppend);
  }

  GFP_OBS_FINAL_FORMAT_TECNICO_16_0_5_4_(target);

  return Math.max(0, target.getLastRow() - 1);
}

function GFP_OBS_FINAL_NORMALIZE_TECNICO_ROW_16_0_5_4_(sourceName, sourceRow, headers, row) {
  const idx = GFP_OBS_FINAL_HEADER_INDEX_16_0_5_4_(headers);

  const timestamp =
    row[idx["TIMESTAMP_CONSOLIDACAO"]] ||
    row[idx["TIMESTAMP"]] ||
    row[idx["DATA"]] ||
    new Date();

  const origemAba =
    row[idx["ORIGEM_ABA"]] ||
    sourceName;

  const origemLinha =
    row[idx["ORIGEM_LINHA"]] ||
    sourceRow;

  const tipo =
    row[idx["TIPO"]] ||
    row[idx["AREA"]] ||
    row[idx["ÁREA"]] ||
    sourceName;

  const status =
    row[idx["STATUS"]] ||
    row[idx["SEVERIDADE"]] ||
    row[idx["LEVEL"]] ||
    "INFO";

  const etapa =
    row[idx["ETAPA_CODIGO"]] ||
    row[idx["CHECAGEM"]] ||
    row[idx["FUNCTION"]] ||
    row[idx["ACAO"]] ||
    row[idx["AÇÃO"]] ||
    "";

  const detalhe =
    row[idx["DETALHE"]] ||
    row[idx["MESSAGE"]] ||
    row[idx["MENSAGEM"]] ||
    "";

  const payload =
    row[idx["PAYLOAD_JSON"]] ||
    GFP_OBS_FINAL_SAFE_JSON_16_0_5_4_({
      sourceSheet: sourceName,
      sourceRow: sourceRow,
      headers: headers,
      values: row
    }, 40000);

  return [
    GFP_OBS_FINAL_AS_DATE_16_0_5_4_(timestamp),
    origemAba,
    origemLinha,
    tipo,
    String(status || "INFO").toUpperCase(),
    etapa,
    detalhe,
    String(payload || "")
  ];
}

function GFP_OBS_FINAL_APPEND_TECNICO_16_0_5_4_(tipo, status, etapa, detalhe, payload) {
  const sh = GFP_OBS_FINAL_ENSURE_TECNICO_16_0_5_4_();

  sh.appendRow([
    new Date(),
    "GFP_16_0_5_4",
    "",
    tipo || "TECNICO",
    status || "INFO",
    etapa || "",
    detalhe || "",
    GFP_OBS_FINAL_SAFE_JSON_16_0_5_4_(payload || {}, 40000)
  ]);

  return true;
}

/**
 * =============================================================================
 * SYS_AUDITORIA — LAYOUT HUMANO
 * =============================================================================
 */

function GFP_OBS_FINAL_RECONSTRUIR_SYS_AUDITORIA_16_0_5_4_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = GFP_OBS_FINAL_ENSURE_AUDITORIA_16_0_5_4_();

  sh.clear();
  GFP_OBS_FINAL_ENSURE_AUDITORIA_7_COLS_16_0_5_4_(sh);
  GFP_OBS_FINAL_WRITE_AUDITORIA_HEADER_16_0_5_4_(sh);

  const rows = [];
  const seen = {};

  GFP_OBS_FINAL_AUDIT_SOURCES_16_0_5_4.forEach(function(sourceName) {
    const source = ss.getSheetByName(sourceName);
    if (!source || source.getLastRow() < 2) return;

    const lastRow = source.getLastRow();
    const lastCol = source.getLastColumn();

    const headers = source.getRange(1, 1, 1, lastCol).getValues()[0].map(function(v) {
      return String(v || "").trim();
    });

    const values = source.getRange(2, 1, lastRow - 1, lastCol).getValues();

    values.forEach(function(row, idx) {
      if (GFP_OBS_FINAL_ROW_EMPTY_16_0_5_4_(row)) return;

      const extracted = GFP_OBS_FINAL_EXTRACT_HUMAN_AUDIT_ROWS_16_0_5_4_(
        sourceName,
        idx + 2,
        headers,
        row
      );

      extracted.forEach(function(r) {
        const normalized = GFP_OBS_FINAL_NORMALIZE_AUDITORIA_ROW_16_0_5_4_(r);

        const signature = normalized.map(function(v) {
          return String(v || "").trim();
        }).join("|");

        if (!signature || seen[signature]) return;

        seen[signature] = true;
        rows.push(normalized);
      });
    });
  });

  rows.sort(function(a, b) {
    return GFP_OBS_FINAL_DATE_VALUE_16_0_5_4_(b[0]) -
           GFP_OBS_FINAL_DATE_VALUE_16_0_5_4_(a[0]);
  });

  if (rows.length) {
    sh.getRange(2, 1, rows.length, 7).setValues(rows);
  }

  GFP_OBS_FINAL_FORMAT_AUDITORIA_16_0_5_4_(sh);

  return rows.length;
}

function GFP_OBS_FINAL_EXTRACT_HUMAN_AUDIT_ROWS_16_0_5_4_(sourceName, sourceRow, headers, row) {
  const out = [];

  const direct = GFP_OBS_FINAL_DIRECT_AUDITORIA_ROW_16_0_5_4_(headers, row);
  if (direct) out.push(direct);

  if (sourceName === "SYS_AUDIT_REPORT") {
    const positional = GFP_OBS_FINAL_FROM_SYS_AUDIT_REPORT_16_0_5_4_(row);
    if (positional) out.push(positional);
  }

  const payloadText = GFP_OBS_FINAL_FIND_PAYLOAD_16_0_5_4_(headers, row);
  const payload = GFP_OBS_FINAL_SAFE_PARSE_16_0_5_4_(payloadText);

  if (payload) {
    if (payload.rows && Array.isArray(payload.rows)) {
      payload.rows.forEach(function(r) {
        out.push([
          GFP_OBS_FINAL_AS_DATE_16_0_5_4_(r.timestamp),
          String(r.status || "INFO").toUpperCase(),
          "PROMOÇÃO 16.0",
          String(r.etapa || ""),
          String(r.status || ""),
          String(r.detalhe || ""),
          GFP_OBS_FINAL_ACTION_FOR_16_0_5_4_(r.status, r.etapa, r.detalhe)
        ]);
      });
    }

    if (payload.issues && Array.isArray(payload.issues)) {
      payload.issues.forEach(function(issue) {
        out.push(GFP_OBS_FINAL_FROM_ISSUE_16_0_5_4_(issue, sourceName));
      });
    }

    if (!payload.rows && !payload.issues && (payload.status || payload.ok !== undefined || payload.message)) {
      out.push([
        new Date(),
        payload.ok === false ? "WARN" : "INFO",
        sourceName,
        payload.code || payload.etapa || payload.tipo || "Payload técnico",
        payload.status || (payload.ok === false ? "ATENÇÃO" : "OK"),
        payload.message || payload.detalhe || "",
        payload.action || payload.acao || ""
      ]);
    }
  }

  if (!out.length) {
    const fallback = GFP_OBS_FINAL_FALLBACK_AUDITORIA_ROW_16_0_5_4_(sourceName, headers, row);
    if (fallback) out.push(fallback);
  }

  return out.filter(Boolean);
}

function GFP_OBS_FINAL_DIRECT_AUDITORIA_ROW_16_0_5_4_(headers, row) {
  const idx = GFP_OBS_FINAL_HEADER_INDEX_16_0_5_4_(headers);

  const required = [
    "TIMESTAMP",
    "SEVERIDADE",
    "AREA",
    "CHECAGEM",
    "RESULTADO",
    "DETALHE",
    "ACAO SUGERIDA"
  ];

  const hasAll = required.every(function(h) {
    return idx[h] !== undefined;
  });

  if (!hasAll) return null;

  return [
    row[idx["TIMESTAMP"]],
    row[idx["SEVERIDADE"]],
    row[idx["AREA"]],
    row[idx["CHECAGEM"]],
    row[idx["RESULTADO"]],
    row[idx["DETALHE"]],
    row[idx["ACAO SUGERIDA"]]
  ];
}

function GFP_OBS_FINAL_FROM_SYS_AUDIT_REPORT_16_0_5_4_(row) {
  const sev = String(row[1] || "").toUpperCase();

  if (["OK", "INFO", "WARN", "WARNING", "ERRO", "ERROR", "ATENCAO", "ATENÇÃO"].indexOf(sev) < 0) {
    return null;
  }

  return [
    GFP_OBS_FINAL_AS_DATE_16_0_5_4_(row[0]),
    GFP_OBS_FINAL_SEVERITY_16_0_5_4_(sev),
    row[3] || "AUDITORIA",
    row[2] ? ("Linha " + row[2]) : "Checagem",
    row[4] || sev,
    row[5] || "",
    row[6] || ""
  ];
}

function GFP_OBS_FINAL_FROM_ISSUE_16_0_5_4_(issue, sourceName) {
  if (Array.isArray(issue)) {
    const ts = issue[0];
    const sev = issue[1] || "INFO";
    const code = issue[2] || "ISSUE";
    const area = issue[3] || sourceName;
    const result = issue[1] || "";
    const detail = issue.length ? String(issue[issue.length - 1] || "") : "";
    const action = GFP_OBS_FINAL_ACTION_FOR_16_0_5_4_(sev, code, detail);

    return [
      GFP_OBS_FINAL_AS_DATE_16_0_5_4_(ts),
      GFP_OBS_FINAL_SEVERITY_16_0_5_4_(sev),
      String(area || ""),
      String(code || ""),
      String(result || ""),
      String(detail || ""),
      String(action || "")
    ];
  }

  if (issue && typeof issue === "object") {
    const sev = issue.status || issue.severity || "INFO";
    const check = issue.check || issue.codigo || issue.code || issue.etapa || "ISSUE";
    const detail = issue.message || issue.detalhe || issue.mensagem || "";

    return [
      GFP_OBS_FINAL_AS_DATE_16_0_5_4_(issue.timestamp || issue.data),
      GFP_OBS_FINAL_SEVERITY_16_0_5_4_(sev),
      issue.area || sourceName,
      check,
      issue.resultado || issue.status || "",
      detail,
      issue.acao || issue.action || GFP_OBS_FINAL_ACTION_FOR_16_0_5_4_(sev, check, detail)
    ];
  }

  return [
    new Date(),
    "INFO",
    sourceName,
    "ISSUE",
    "",
    String(issue || ""),
    ""
  ];
}

function GFP_OBS_FINAL_FALLBACK_AUDITORIA_ROW_16_0_5_4_(sourceName, headers, row) {
  const idx = GFP_OBS_FINAL_HEADER_INDEX_16_0_5_4_(headers);

  const timestamp =
    row[idx["TIMESTAMP"]] ||
    row[idx["TIMESTAMP_CONSOLIDACAO"]] ||
    row[idx["DATA"]] ||
    new Date();

  const sev =
    row[idx["SEVERIDADE"]] ||
    row[idx["STATUS"]] ||
    row[idx["LEVEL"]] ||
    "INFO";

  const area =
    row[idx["AREA"]] ||
    row[idx["TIPO"]] ||
    row[idx["MODULO"]] ||
    sourceName;

  const check =
    row[idx["CHECAGEM"]] ||
    row[idx["ETAPA_CODIGO"]] ||
    row[idx["FUNCTION"]] ||
    row[idx["ACAO"]] ||
    row[idx["AÇÃO"]] ||
    sourceName;

  const result =
    row[idx["RESULTADO"]] ||
    row[idx["STATUS"]] ||
    sev;

  const detail =
    row[idx["DETALHE"]] ||
    row[idx["MESSAGE"]] ||
    row[idx["MENSAGEM"]] ||
    row.filter(function(v) { return String(v || "").trim(); }).join(" | ").substring(0, 1200);

  const action =
    row[idx["ACAO SUGERIDA"]] ||
    row[idx["ACTION"]] ||
    "";

  return [
    GFP_OBS_FINAL_AS_DATE_16_0_5_4_(timestamp),
    GFP_OBS_FINAL_SEVERITY_16_0_5_4_(sev),
    area,
    check,
    result,
    detail,
    action
  ];
}

/**
 * =============================================================================
 * ORDENAÇÃO / OCULTAÇÃO / EXCLUSÃO
 * =============================================================================
 */

function GFP_OBS_FINAL_SORT_CANONICAS_16_0_5_4() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  [
    GFP_OBS_FINAL_SHEET_LOGS_16_0_5_4,
    GFP_OBS_FINAL_SHEET_AUDIT_16_0_5_4,
    GFP_OBS_FINAL_SHEET_TECNICO_16_0_5_4
  ].forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 3) return;

    sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn())
      .sort([{ column: 1, ascending: false }]);

    if (sh.getFilter()) sh.getFilter().remove();
    sh.getDataRange().createFilter();
    sh.setFrozenRows(1);
  });

  GFP_OBS_FINAL_OCULTAR_SYS_TECNICO_16_0_5_4();

  SpreadsheetApp.getActive().toast("SYS_LOGS, SYS_AUDITORIA e SYS_TECNICO ordenadas.", "GFP 16.0.5.4");
}

function GFP_OBS_FINAL_OCULTAR_SYS_TECNICO_16_0_5_4() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_OBS_FINAL_SHEET_TECNICO_16_0_5_4);

  if (!sh) return false;

  const visibleSheets = ss.getSheets().filter(function(s) {
    return !s.isSheetHidden();
  });

  if (visibleSheets.length <= 1) return false;

  if (!sh.isSheetHidden()) sh.hideSheet();

  return true;
}

function GFP_OBS_FINAL_MOSTRAR_SYS_TECNICO_16_0_5_4() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_OBS_FINAL_SHEET_TECNICO_16_0_5_4);

  if (!sh) {
    SpreadsheetApp.getActive().toast("SYS_TECNICO não encontrada.", "GFP 16.0.5.4");
    return false;
  }

  sh.showSheet();
  ss.setActiveSheet(sh);

  SpreadsheetApp.getActive().toast("SYS_TECNICO exibida.", "GFP 16.0.5.4");
  return true;
}

function GFP_OBS_FINAL_OCULTAR_ABAS_LEGADAS_16_0_5_4_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hidden = 0;

  GFP_OBS_FINAL_LEGACY_SHEETS_16_0_5_4.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    if (sh.isSheetHidden()) return;

    const visibleSheets = ss.getSheets().filter(function(s) {
      return !s.isSheetHidden();
    });

    if (visibleSheets.length <= 1) return;

    sh.hideSheet();
    hidden++;
  });

  return hidden;
}

function GFP_OBS_FINAL_EXCLUIR_ABAS_LEGADAS_16_0_5_4(confirmacao) {
  if (confirmacao !== "EXCLUIR_ABAS_LEGADAS_16_0_5_4") {
    throw new Error("Confirmação inválida. Use exatamente: EXCLUIR_ABAS_LEGADAS_16_0_5_4");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Consolida antes de excluir.
  GFP_OBS_FINAL_CANONIZAR_16_0_5_4();

  const first = ss.getSheetByName("DB_TRANSACOES") ||
    ss.getSheetByName(GFP_OBS_FINAL_SHEET_AUDIT_16_0_5_4) ||
    ss.getSheets()[0];

  if (first) ss.setActiveSheet(first);

  const deleted = [];

  GFP_OBS_FINAL_LEGACY_SHEETS_16_0_5_4.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;

    ss.deleteSheet(sh);
    deleted.push(name);
  });

  // Se SYS_RELATORIOS reapareceu, remove após migração.
  GFP_OBS_FINAL_MIGRAR_SYS_RELATORIOS_PARA_TECNICO_16_0_5_4_();

  GFP_OBS_FINAL_SYS_LOG_16_0_5_4_(
    "OBS_FINAL",
    "EXCLUIR_ABAS_LEGADAS",
    "OK",
    "Abas legadas excluídas após consolidação.",
    { deleted: deleted }
  );

  GFP_OBS_FINAL_OCULTAR_SYS_TECNICO_16_0_5_4();

  SpreadsheetApp.getActive().toast("Abas legadas excluídas: " + deleted.length, "GFP 16.0.5.4");

  return { ok: true, deleted: deleted };
}

function GFP_OBS_FINAL_EXCLUIR_ABAS_LEGADAS_CONFIRMADO_16_0_5_4() {
  return GFP_OBS_FINAL_EXCLUIR_ABAS_LEGADAS_16_0_5_4("EXCLUIR_ABAS_LEGADAS_16_0_5_4");
}

/**
 * =============================================================================
 * ENSURE / FORMAT
 * =============================================================================
 */

function GFP_OBS_FINAL_ENSURE_LOGS_16_0_5_4_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(GFP_OBS_FINAL_SHEET_LOGS_16_0_5_4);

  if (!sh) sh = ss.insertSheet(GFP_OBS_FINAL_SHEET_LOGS_16_0_5_4);

  sh.getRange(1, 1, 1, GFP_OBS_FINAL_LOG_HEADERS_16_0_5_4.length)
    .setValues([GFP_OBS_FINAL_LOG_HEADERS_16_0_5_4]);

  GFP_OBS_FINAL_FORMAT_LOGS_16_0_5_4_(sh);
  return sh;
}

function GFP_OBS_FINAL_FORMAT_LOGS_16_0_5_4_(sh) {
  sh.getRange(1, 1, 1, 5)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);

  if (sh.getFilter()) sh.getFilter().remove();
  sh.getDataRange().createFilter();

  try { sh.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss"); } catch (e) {}
  try { sh.getRange("D:E").setWrap(true); } catch (e2) {}
}

function GFP_OBS_FINAL_ENSURE_TECNICO_16_0_5_4_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(GFP_OBS_FINAL_SHEET_TECNICO_16_0_5_4);

  if (!sh) sh = ss.insertSheet(GFP_OBS_FINAL_SHEET_TECNICO_16_0_5_4);

  GFP_OBS_FINAL_ENSURE_TECNICO_HEADER_16_0_5_4_(sh);
  return sh;
}

function GFP_OBS_FINAL_ENSURE_TECNICO_HEADER_16_0_5_4_(sh) {
  sh.getRange(1, 1, 1, GFP_OBS_FINAL_TECNICO_HEADERS_16_0_5_4.length)
    .setValues([GFP_OBS_FINAL_TECNICO_HEADERS_16_0_5_4]);

  GFP_OBS_FINAL_FORMAT_TECNICO_16_0_5_4_(sh);
}

function GFP_OBS_FINAL_FORMAT_TECNICO_16_0_5_4_(sh) {
  sh.getRange(1, 1, 1, 8)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);

  if (sh.getFilter()) sh.getFilter().remove();
  sh.getDataRange().createFilter();

  try { sh.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss"); } catch (e) {}
  try { sh.getRange("G:H").setWrap(true); } catch (e2) {}
}

function GFP_OBS_FINAL_ENSURE_AUDITORIA_16_0_5_4_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(GFP_OBS_FINAL_SHEET_AUDIT_16_0_5_4);

  if (!sh) sh = ss.insertSheet(GFP_OBS_FINAL_SHEET_AUDIT_16_0_5_4);

  return sh;
}

function GFP_OBS_FINAL_ENSURE_AUDITORIA_7_COLS_16_0_5_4_(sh) {
  const maxCols = sh.getMaxColumns();

  if (maxCols < 7) {
    sh.insertColumnsAfter(maxCols, 7 - maxCols);
  } else if (maxCols > 7) {
    sh.deleteColumns(8, maxCols - 7);
  }
}

function GFP_OBS_FINAL_WRITE_AUDITORIA_HEADER_16_0_5_4_(sh) {
  sh.getRange(1, 1, 1, 7).setValues([GFP_OBS_FINAL_AUDIT_HEADERS_16_0_5_4]);
  GFP_OBS_FINAL_FORMAT_AUDITORIA_16_0_5_4_(sh);
}

function GFP_OBS_FINAL_FORMAT_AUDITORIA_16_0_5_4_(sh) {
  sh.getRange(1, 1, 1, 7)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);

  if (sh.getFilter()) sh.getFilter().remove();
  sh.getDataRange().createFilter();

  try { sh.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss"); } catch (e) {}
  try { sh.getRange("F:G").setWrap(true); } catch (e2) {}
  try { sh.autoResizeColumns(1, 7); } catch (e3) {}
}

/**
 * =============================================================================
 * HELPERS
 * =============================================================================
 */

function GFP_OBS_FINAL_COPY_UNIQUE_TO_TECNICO_16_0_5_4_(source, target) {
  if (!source || source.getLastRow() < 2) return 0;

  GFP_OBS_FINAL_ENSURE_TECNICO_HEADER_16_0_5_4_(target);

  const sourceLastRow = source.getLastRow();
  const sourceLastCol = source.getLastColumn();

  const sourceHeaders = source.getRange(1, 1, 1, sourceLastCol).getValues()[0];
  const sourceRows = source.getRange(2, 1, sourceLastRow - 1, sourceLastCol).getValues();

  const existing = GFP_OBS_FINAL_EXISTING_TECNICO_SIGNATURES_16_0_5_4_(target);
  const rows = [];

  sourceRows.forEach(function(row, idx) {
    if (GFP_OBS_FINAL_ROW_EMPTY_16_0_5_4_(row)) return;

    const normalized = GFP_OBS_FINAL_NORMALIZE_TECNICO_ROW_16_0_5_4_(
      source.getName(),
      idx + 2,
      sourceHeaders,
      row
    );

    const sig = normalized.map(function(v) { return String(v || ""); }).join("|");

    if (existing[sig]) return;

    rows.push(normalized);
    existing[sig] = true;
  });

  if (rows.length) {
    target.getRange(target.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  }

  return rows.length;
}

function GFP_OBS_FINAL_NORMALIZE_AUDITORIA_ROW_16_0_5_4_(r) {
  return [
    GFP_OBS_FINAL_AS_DATE_16_0_5_4_(r[0]),
    GFP_OBS_FINAL_SEVERITY_16_0_5_4_(r[1]),
    String(r[2] || ""),
    String(r[3] || ""),
    String(r[4] || ""),
    String(r[5] || ""),
    String(r[6] || "")
  ];
}

function GFP_OBS_FINAL_SEVERITY_16_0_5_4_(v) {
  let s = String(v || "INFO").trim().toUpperCase();

  if (s === "ERROR") s = "ERRO";
  if (s === "WARNING") s = "WARN";
  if (s === "ATENÇÃO") s = "ATENCAO";

  if (["OK", "INFO", "WARN", "ERRO", "ATENCAO"].indexOf(s) < 0) {
    s = "INFO";
  }

  return s;
}

function GFP_OBS_FINAL_ACTION_FOR_16_0_5_4_(status, check, detail) {
  const text = [status, check, detail].join(" ").toUpperCase();

  if (text.indexOf("SEM_CATEGORIA") >= 0 || text.indexOf("CATEGORIA VAZIA") >= 0) {
    return "Classificar manualmente ou rodar revisão.";
  }

  if (text.indexOf("CASHMONTH") >= 0) {
    return "Corrigir metadados/cashMonth se a linha permanecer na base real.";
  }

  if (text.indexOf("DUPLIC") >= 0) {
    return "Revisar duplicidade antes de consolidar.";
  }

  if (text.indexOf("ERRO") >= 0 || text.indexOf("ERROR") >= 0) {
    return "Investigar e corrigir antes da homologação final.";
  }

  return "";
}

function GFP_OBS_FINAL_SYS_LOG_16_0_5_4_(modulo, acao, status, detalhe, payload) {
  const sh = GFP_OBS_FINAL_ENSURE_LOGS_16_0_5_4_();

  sh.appendRow([
    new Date(),
    status || "INFO",
    modulo + "." + acao,
    String(detalhe || "") + (payload ? " | payload=" + GFP_OBS_FINAL_SAFE_JSON_16_0_5_4_(payload, 40000) : ""),
    ""
  ]);
}

function GFP_OBS_FINAL_FIND_PAYLOAD_16_0_5_4_(headers, row) {
  const idx = GFP_OBS_FINAL_HEADER_INDEX_16_0_5_4_(headers);

  if (idx["PAYLOAD_JSON"] !== undefined) return row[idx["PAYLOAD_JSON"]];

  for (let i = row.length - 1; i >= 0; i--) {
    const text = String(row[i] || "").trim();
    if (text.charAt(0) === "{" || text.charAt(0) === "[") return text;
  }

  return "";
}

function GFP_OBS_FINAL_FIND_DATE_16_0_5_4_(headers, row) {
  const idx = GFP_OBS_FINAL_HEADER_INDEX_16_0_5_4_(headers);

  return row[idx["TIMESTAMP"]] ||
    row[idx["TIMESTAMP_CONSOLIDACAO"]] ||
    row[idx["DATA"]] ||
    row[idx["DATA_EXECUCAO"]] ||
    "";
}

function GFP_OBS_FINAL_FIND_STATUS_16_0_5_4_(headers, row) {
  const idx = GFP_OBS_FINAL_HEADER_INDEX_16_0_5_4_(headers);

  return row[idx["SEVERIDADE"]] ||
    row[idx["STATUS"]] ||
    row[idx["LEVEL"]] ||
    "INFO";
}

function GFP_OBS_FINAL_HEADER_INDEX_16_0_5_4_(headers) {
  const idx = {};

  headers.forEach(function(h, i) {
    idx[GFP_OBS_FINAL_NORM_16_0_5_4_(h)] = i;
  });

  return idx;
}

function GFP_OBS_FINAL_NORM_16_0_5_4_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function GFP_OBS_FINAL_ROW_EMPTY_16_0_5_4_(row) {
  return row.every(function(v) {
    return v === null || v === undefined || String(v).trim() === "";
  });
}

function GFP_OBS_FINAL_AS_DATE_16_0_5_4_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;

  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date();
}

function GFP_OBS_FINAL_DATE_VALUE_16_0_5_4_(v) {
  return GFP_OBS_FINAL_AS_DATE_16_0_5_4_(v).getTime();
}

function GFP_OBS_FINAL_SAFE_PARSE_16_0_5_4_(text) {
  try {
    if (!text) return null;
    return JSON.parse(String(text));
  } catch (e) {
    return null;
  }
}

function GFP_OBS_FINAL_SAFE_JSON_16_0_5_4_(value, maxLen) {
  maxLen = maxLen || 30000;

  try {
    const str = JSON.stringify(value, function(key, val) {
      if (val instanceof Date) {
        return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
      }
      return val;
    });

    if (!str) return "";

    return str.length > maxLen ? str.substring(0, maxLen) + "...[cortado]" : str;
  } catch (e) {
    const fallback = String(value || "");
    return fallback.length > maxLen ? fallback.substring(0, maxLen) + "...[cortado]" : fallback;
  }
}

function GFP_OBS_FINAL_EXISTING_LOG_SIGNATURES_16_0_5_4_(sheet) {
  const out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;

  const values = sheet.getRange(2, 4, sheet.getLastRow() - 1, 1).getValues();

  values.forEach(function(row) {
    const text = String(row[0] || "");
    const match = text.match(/OBS_FINAL_LOG\|[^|]+\|\d+/);
    if (match) out[match[0]] = true;
  });

  return out;
}

function GFP_OBS_FINAL_EXISTING_TECNICO_SIGNATURES_16_0_5_4_(sheet) {
  const out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.min(8, sheet.getLastColumn())).getValues();

  values.forEach(function(row) {
    const sig = row.map(function(v) { return String(v || ""); }).join("|");
    if (sig) out[sig] = true;
  });

  return out;
}

function GFP_OBS_FINAL_ORDENAR_ABAS_VISIVEIS_16_0_5_4_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const order = [
    "DB_TRANSACOES",
    "DB_TRANSACOES_HIST",
    "DB_MEMORIA",
    "SYS_LOGS",
    "SYS_AUDITORIA",
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

  // SYS_TECNICO fica oculta por padrão e não entra na ordem visível.
  GFP_OBS_FINAL_OCULTAR_SYS_TECNICO_16_0_5_4();

  const first = ss.getSheetByName("DB_TRANSACOES");
  if (first) ss.setActiveSheet(first);
}

