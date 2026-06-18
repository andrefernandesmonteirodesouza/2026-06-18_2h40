/**
 * =============================================================================
 * 🧾 GFP 15.9.7 — OBSERVABILIDADE UNIFICADA
 * =============================================================================
 *
 * Centraliza logs e relatórios:
 *
 * - SYS_LOGS: histórico único de ações/eventos;
 * - SYS_RELATORIOS: histórico único de relatórios/auditorias;
 *
 * Não apaga nada.
 * =============================================================================
 */

const GFP_OBS_VERSION_15_9_7 = "15.9.7";

/**
 * Orquestrador principal.
 */
function GFP_OBSERVABILIDADE_UNIFICAR_15_9_7() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const startedAt = new Date();

  const result = {
    version: GFP_OBS_VERSION_15_9_7,
    startedAt: startedAt.toISOString(),
    finishedAt: "",
    sysLogsReady: false,
    sysRelatoriosReady: false,
    logRowsImported: 0,
    reportRowsImported: 0,
    sheetsHidden: 0,
    sheetsAlreadyHidden: 0,
    sheetsMoved: 0,
    helperColumnsHidden: false,
    errors: []
  };

  try {
    GFP_SYS_LOGS_ENSURE_15_9_7_(ss);
    result.sysLogsReady = true;

    GFP_SYS_LOG_15_9_7("OBSERVABILIDADE", "INICIO", "OK", "Iniciando unificação de logs e relatórios.", {
      version: GFP_OBS_VERSION_15_9_7
    });
  } catch (eLogs) {
    result.errors.push("Erro ao preparar SYS_LOGS: " + eLogs.message);
  }

  try {
    GFP_SYS_RELATORIOS_ENSURE_15_9_7_(ss);
    result.sysRelatoriosReady = true;
  } catch (eRel) {
    result.errors.push("Erro ao preparar SYS_RELATORIOS: " + eRel.message);
  }

  try {
    result.logRowsImported = GFP_OBS_CONSOLIDAR_LOGS_15_9_7_(ss);
  } catch (eImpLogs) {
    result.errors.push("Erro ao consolidar logs: " + eImpLogs.message);
  }

  try {
    result.reportRowsImported = GFP_OBS_CONSOLIDAR_RELATORIOS_15_9_7_(ss);
  } catch (eImpRel) {
    result.errors.push("Erro ao consolidar relatórios: " + eImpRel.message);
  }

  try {
    const hideResult = GFP_OBS_OCULTAR_ABAS_CONSOLIDADAS_15_9_7_(ss);
    result.sheetsHidden = hideResult.hidden;
    result.sheetsAlreadyHidden = hideResult.alreadyHidden;
  } catch (eHide) {
    result.errors.push("Erro ao ocultar abas consolidadas: " + eHide.message);
  }

  try {
    result.sheetsMoved = GFP_OBS_REORDENAR_ABAS_VISIVEIS_15_9_7_(ss);
  } catch (eMove) {
    result.errors.push("Erro ao reordenar abas: " + eMove.message);
  }

  try {
    result.helperColumnsHidden = GFP_OBS_OCULTAR_COLUNAS_AUXILIARES_15_9_7_(ss);
  } catch (eCols) {
    result.errors.push("Erro ao ocultar colunas auxiliares O:S: " + eCols.message);
  }

  result.finishedAt = new Date().toISOString();

  GFP_SYS_LOG_15_9_7(
    "OBSERVABILIDADE",
    "FIM",
    result.errors.length ? "ATENCAO" : "OK",
    "Unificação de logs e relatórios finalizada.",
    result
  );

  SpreadsheetApp.getActive().toast(
    "Observabilidade unificada: logs +" + result.logRowsImported +
    " | relatórios +" + result.reportRowsImported +
    " | erros " + result.errors.length,
    "GFP 15.9.7"
  );

  return {
    ok: result.errors.length === 0,
    result: result
  };
}


/**
 * =============================================================================
 * SYS_LOGS — CENTRAL ÚNICA DE LOGS
 * =============================================================================
 */

/**
 * GFP 16.1.4 — compatibilidade com chamadas antigas de observabilidade.
 *
 * Mantém a função porque voz/imagem e módulos antigos ainda podem chamá-la,
 * mas grava no SYS_LOGS em linguagem simples, sem payload JSON visível.
 */
function GFP_SYS_LOG_15_9_7(modulo, acao, status, detalhe, payload) {
  try {
    const area = GFP_LOG_HUMANO_AREA_16_1_4_(modulo || acao || "", detalhe || "");
    const classified = GFP_LOG_HUMANO_CLASSIFICAR_16_1_4_(
      detalhe || acao || modulo || "Evento registrado.",
      area,
      status || "INFO",
      null
    );

    if (!classified || classified.keep === false) {
      return;
    }

    GFP_LOG_HUMANO_APPEND_16_1_4_(
      classified.level || status || "INFO",
      classified.area || area,
      classified.message || detalhe || acao || modulo || "Evento registrado.",
      ""
    );

  } catch (e) {
    try {
      Logger(String(detalhe || acao || modulo || "Evento registrado."), "Sistema", null, status || "INFO");
    } catch (ignore) {}
  }
}


function GFP_SYS_LOGS_ENSURE_15_9_7_(ss) {
  let sh = ss.getSheetByName("SYS_LOGS");

  if (!sh) {
    sh = ss.insertSheet("SYS_LOGS");
  }

  const expected = [
    "TIMESTAMP",
    "MODULO",
    "ACAO",
    "STATUS",
    "DETALHE"
  ];

  const lastCol = Math.max(sh.getLastColumn(), expected.length);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, expected.length).setValues([expected]);
  } else {
    const current = sh.getRange(1, 1, 1, expected.length).getValues()[0]
      .map(function(v) { return String(v || "").trim(); });

    const needsHeader = expected.some(function(h, i) {
      return current[i] !== h;
    });

    if (needsHeader && sh.getLastRow() === 1) {
      sh.getRange(1, 1, 1, expected.length).setValues([expected]);
    } else if (needsHeader && sh.getLastRow() > 1) {
      // Não sobrescreve logs antigos agressivamente.
      // Apenas garante cabeçalho se a linha 1 estiver vazia.
      const headerEmpty = current.every(function(v) { return !v; });
      if (headerEmpty) sh.getRange(1, 1, 1, expected.length).setValues([expected]);
    }
  }

  sh.getRange(1, 1, 1, expected.length)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);

  try { sh.autoResizeColumns(1, expected.length); } catch (eResize) {}

  return sh;
}


/**
 * Importa logs antigos para SYS_LOGS.
 *
 * Fontes:
 * - LOG_ARQUIVAMENTO
 * - LOG_REVISAO_IA
 *
 * Evita duplicar usando assinatura no DETALHE.
 */
function GFP_OBS_CONSOLIDAR_LOGS_15_9_7_(ss) {
  const sysLogs = GFP_SYS_LOGS_ENSURE_15_9_7_(ss);
  const sources = [
    "LOG_ARQUIVAMENTO",
    "LOG_REVISAO_IA"
  ];

  const existingSignatures = GFP_OBS_GET_EXISTING_LOG_SIGNATURES_15_9_7_(sysLogs);
  const rowsToAppend = [];

  sources.forEach(function(sheetName) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2) return;

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

    values.forEach(function(row, idx) {
      const sourceRow = idx + 2;
      const signature = "IMPORT_LOG_15_9_7|" + sheetName + "|" + sourceRow;

      if (existingSignatures[signature]) return;

      const payload = {
        sourceSheet: sheetName,
        sourceRow: sourceRow,
        headers: headers,
        values: row
      };

      const ts = GFP_OBS_PICK_DATE_15_9_7_(row[0]) || new Date();
      const status = GFP_OBS_INFER_STATUS_15_9_7_(headers, row) || "INFO";
      const acao = GFP_OBS_INFER_ACTION_15_9_7_(headers, row) || "IMPORT_LOG";

      rowsToAppend.push([
        ts,
        "IMPORTADO_" + sheetName,
        acao,
        status,
        signature + " | " + GFP_OBS_SAFE_JSON_15_9_7_(payload, 35000)
      ]);

      existingSignatures[signature] = true;
    });
  });

  if (rowsToAppend.length) {
    sysLogs.getRange(sysLogs.getLastRow() + 1, 1, rowsToAppend.length, 5).setValues(rowsToAppend);
  }

  return rowsToAppend.length;
}

function GFP_OBS_GET_EXISTING_LOG_SIGNATURES_15_9_7_(sysLogs) {
  const out = {};

  if (!sysLogs || sysLogs.getLastRow() < 2) return out;

  const values = sysLogs.getRange(2, 5, sysLogs.getLastRow() - 1, 1).getValues();

  values.forEach(function(row) {
    const text = String(row[0] || "");
    const match = text.match(/IMPORT_LOG_15_9_7\|[^|]+\|\d+/);
    if (match) out[match[0]] = true;
  });

  return out;
}


/**
 * =============================================================================
 * SYS_RELATORIOS — CENTRAL ÚNICA DE RELATÓRIOS / AUDITORIAS
 * =============================================================================
 */

function GFP_SYS_RELATORIOS_ENSURE_15_9_7_(ss) {
  let sh = ss.getSheetByName("SYS_RELATORIOS");

  if (!sh) {
    sh = ss.insertSheet("SYS_RELATORIOS");
  }

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

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  } else {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }

  sh.getRange(1, 1, 1, header.length)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);

  if (sh.getFilter()) sh.getFilter().remove();
  sh.getDataRange().createFilter();

  sh.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sh.getRange("G:H").setWrap(true);

  try { sh.autoResizeColumns(1, header.length); } catch (eResize) {}

  return sh;
}

/**
 * Consolida relatórios em SYS_RELATORIOS.
 *
 * Estratégia:
 * - limpa e reconstrói SYS_RELATORIOS a cada execução;
 * - não apaga as abas originais;
 * - depois o orquestrador oculta as abas originais.
 */
function GFP_OBS_CONSOLIDAR_RELATORIOS_15_9_7_(ss) {
  const target = GFP_SYS_RELATORIOS_ENSURE_15_9_7_(ss);

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

  target.clear();
  target.getRange(1, 1, 1, header.length).setValues([header]);

  const reportSheets = [
    "SYS_AUDITORIA_GFP",
    "SYS_DASHBOARD_2_AUDIT",
    "SYS_REVIEW_PANEL_2_AUDIT",
    "SYS_PRECHECK_BASE_FINAL",
    "SYS_SAUDE_GFP",
    "SYS_LIMPEZA_TECNICA_GFP",
    "SYS_AUDIT_REPORT",
    "SYS_RESET_LOG",
    "AUDITORIA_GFP",
    "SYS_TAXONOMIA_REPORT",
    "REL_CLASSIFICACAO_ABAS_GFP",
    "REL_ORGANIZACAO_ABAS_GFP",
    "REL_PRE16_FINAL_GFP"
  ];

  const now = new Date();
  const rows = [];

  reportSheets.forEach(function(sheetName) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 1) return;

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();

    if (lastRow < 2) {
      const payloadEmpty = {
        sourceSheet: sheetName,
        note: "Aba sem linhas de dados além do cabeçalho.",
        lastRow: lastRow,
        lastCol: lastCol
      };

      rows.push([
        now,
        sheetName,
        "",
        GFP_OBS_REPORT_TYPE_15_9_7_(sheetName),
        "INFO",
        "SEM_DADOS",
        "Aba de relatório sem dados detalhados.",
        GFP_OBS_SAFE_JSON_15_9_7_(payloadEmpty, 35000)
      ]);

      return;
    }

    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

    values.forEach(function(row, idx) {
      if (GFP_OBS_ROW_EMPTY_15_9_7_(row)) return;

      const sourceRow = idx + 2;
      const status = GFP_OBS_INFER_STATUS_15_9_7_(headers, row);
      const etapa = GFP_OBS_INFER_ACTION_15_9_7_(headers, row);
      const detalhe = GFP_OBS_INFER_DETAIL_15_9_7_(headers, row);

      const payload = {
        sourceSheet: sheetName,
        sourceRow: sourceRow,
        headers: headers,
        values: row
      };

      rows.push([
        now,
        sheetName,
        sourceRow,
        GFP_OBS_REPORT_TYPE_15_9_7_(sheetName),
        status || "INFO",
        etapa || "",
        detalhe || "",
        GFP_OBS_SAFE_JSON_15_9_7_(payload, 35000)
      ]);
    });
  });

  if (rows.length) {
    target.getRange(2, 1, rows.length, header.length).setValues(rows);
  }

  target.getRange(1, 1, 1, header.length)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  target.setFrozenRows(1);

  if (target.getFilter()) target.getFilter().remove();
  target.getDataRange().createFilter();

  target.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss");
  target.getRange("G:H").setWrap(true);

  try { target.autoResizeColumns(1, header.length); } catch (eResize) {}

  return rows.length;
}


/**
 * =============================================================================
 * OCULTAÇÃO / ORDEM VISUAL
 * =============================================================================
 */

function GFP_OBS_OCULTAR_ABAS_CONSOLIDADAS_15_9_7_(ss) {
  const hideNames = [
    "LOG_ARQUIVAMENTO",
    "LOG_REVISAO_IA",

    "SYS_AUDITORIA_GFP",
    "SYS_DASHBOARD_2_AUDIT",
    "SYS_REVIEW_PANEL_2_AUDIT",
    "SYS_PRECHECK_BASE_FINAL",
    "SYS_SAUDE_GFP",
    "SYS_LIMPEZA_TECNICA_GFP",
    "SYS_AUDIT_REPORT",
    "SYS_RESET_LOG",

    "AUDITORIA_GFP",
    "SYS_TAXONOMIA_REPORT",
    "CFG_Modelo_Classificacao",
    "CFG_Taxonomia_Quarentena",
    "CFG_Taxonomia",

    "REL_CLASSIFICACAO_ABAS_GFP",
    "REL_ORGANIZACAO_ABAS_GFP",
    "REL_PRE16_FINAL_GFP"
  ];

  const keepVisible = {
    "DB_TRANSACOES": true,
    "DB_TRANSACOES_HIST": true,
    "SYS_LOGS": true,
    "SYS_RELATORIOS": true,
    "DRE_GERENCIAL": true,
    "VISAO_FUTURO": true,
    "DB_MEMORIA": true,
    "CFG_Aprendizado": true,
    "CFG_Categorias": true,
    "CFG_Contas": true,
    "CFG_Cartoes": true
  };

  // Inclui BK_* automaticamente.
  ss.getSheets().forEach(function(sh) {
    const name = sh.getName();
    if (/^BK_/i.test(name)) hideNames.push(name);
  });

  let hidden = 0;
  let alreadyHidden = 0;

  hideNames.forEach(function(name) {
    if (keepVisible[name]) return;

    const sh = ss.getSheetByName(name);
    if (!sh) return;

    if (sh.isSheetHidden()) {
      alreadyHidden++;
      return;
    }

    const visibleCount = ss.getSheets().filter(function(s) { return !s.isSheetHidden(); }).length;

    if (visibleCount <= 1) return;

    sh.hideSheet();
    hidden++;
  });

  return {
    hidden: hidden,
    alreadyHidden: alreadyHidden
  };
}

function GFP_OBS_REORDENAR_ABAS_VISIVEIS_15_9_7_(ss) {
  const visibleOrder = [
    "DB_TRANSACOES",
    "DB_TRANSACOES_HIST",
    "SYS_LOGS",
    "SYS_RELATORIOS",
    "DRE_GERENCIAL",
    "VISAO_FUTURO",
    "DB_MEMORIA",
    "CFG_Aprendizado",
    "CFG_Categorias",
    "CFG_Contas",
    "CFG_Cartoes"
  ];

  let moved = 0;

  visibleOrder.forEach(function(name, idx) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;

    try {
      if (sh.isSheetHidden()) sh.showSheet();

      ss.setActiveSheet(sh);
      ss.moveActiveSheet(idx + 1);
      moved++;
    } catch (e) {
      // O orquestrador registra em nível superior se necessário.
    }
  });

  try {
    const first = ss.getSheetByName("DB_TRANSACOES");
    if (first) ss.setActiveSheet(first);
  } catch (eActive) {}

  return moved;
}

function GFP_OBS_OCULTAR_COLUNAS_AUXILIARES_15_9_7_(ss) {
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh || sh.getLastColumn() < 19) return false;

  sh.hideColumns(15, 5); // O:S
  return true;
}


/**
 * =============================================================================
 * HELPERS
 * =============================================================================
 */

function GFP_OBS_REPORT_TYPE_15_9_7_(sheetName) {
  const n = String(sheetName || "").toUpperCase();

  if (n.indexOf("DASHBOARD") >= 0) return "DASHBOARD";
  if (n.indexOf("REVIEW") >= 0 || n.indexOf("REVISAO") >= 0) return "PAINEL_REVISAO";
  if (n.indexOf("PRECHECK") >= 0) return "PRECHECK";
  if (n.indexOf("SAUDE") >= 0) return "SAUDE";
  if (n.indexOf("LIMPEZA") >= 0) return "LIMPEZA_TECNICA";
  if (n.indexOf("TAXONOMIA") >= 0) return "TAXONOMIA";
  if (n.indexOf("RESET") >= 0) return "RESET";
  if (n.indexOf("AUDIT") >= 0 || n.indexOf("AUDITORIA") >= 0) return "AUDITORIA";
  if (n.indexOf("REL_") === 0) return "RELATORIO";
  return "RELATORIO";
}

function GFP_OBS_INFER_STATUS_15_9_7_(headers, row) {
  const direct = GFP_OBS_VALUE_BY_HEADER_15_9_7_(headers, row, [
    "STATUS",
    "SEVERITY",
    "GRAVIDADE",
    "NIVEL"
  ]);

  const directText = String(direct || "").trim();

  if (directText) return directText.toUpperCase();

  const joined = row.map(function(v) { return String(v || "").toUpperCase(); }).join(" | ");

  if (joined.indexOf("FATAL") >= 0) return "FATAL";
  if (joined.indexOf("ERRO") >= 0 || joined.indexOf("ERROR") >= 0) return "ERRO";
  if (joined.indexOf("ATENCAO") >= 0 || joined.indexOf("WARN") >= 0) return "WARN";
  if (joined.indexOf("OK") >= 0) return "OK";

  return "INFO";
}

function GFP_OBS_INFER_ACTION_15_9_7_(headers, row) {
  const direct = GFP_OBS_VALUE_BY_HEADER_15_9_7_(headers, row, [
    "ETAPA",
    "ACAO",
    "AÇÃO",
    "CODE",
    "CODIGO",
    "CÓDIGO",
    "CHECK",
    "ITEM",
    "ALVO",
    "ABA",
    "FUNCAO",
    "FUNÇÃO"
  ]);

  if (direct !== null && direct !== undefined && String(direct).trim()) {
    return String(direct).trim();
  }

  for (let i = 0; i < row.length; i++) {
    const v = row[i];
    if (v instanceof Date) continue;

    const text = String(v || "").trim();
    if (text) return text.substring(0, 200);
  }

  return "";
}

function GFP_OBS_INFER_DETAIL_15_9_7_(headers, row) {
  const direct = GFP_OBS_VALUE_BY_HEADER_15_9_7_(headers, row, [
    "DETALHE",
    "DETAIL",
    "MOTIVO",
    "OBSERVACAO",
    "OBSERVAÇÃO",
    "RETORNO",
    "NOTA",
    "MENSAGEM"
  ]);

  if (direct !== null && direct !== undefined && String(direct).trim()) {
    return String(direct).trim().substring(0, 5000);
  }

  const nonEmpty = row
    .map(function(v) {
      if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
      return String(v || "").trim();
    })
    .filter(function(v) { return !!v; });

  return nonEmpty.join(" | ").substring(0, 5000);
}

function GFP_OBS_VALUE_BY_HEADER_15_9_7_(headers, row, names) {
  const normalizedNames = names.map(function(n) {
    return GFP_OBS_NORM_15_9_7_(n);
  });

  for (let i = 0; i < headers.length; i++) {
    const h = GFP_OBS_NORM_15_9_7_(headers[i]);

    if (normalizedNames.indexOf(h) >= 0) {
      return row[i];
    }
  }

  return null;
}

function GFP_OBS_ROW_EMPTY_15_9_7_(row) {
  return row.every(function(v) {
    return v === "" || v === null || v === undefined;
  });
}

function GFP_OBS_PICK_DATE_15_9_7_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  return null;
}

function GFP_OBS_SAFE_JSON_15_9_7_(value, maxLen) {
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

function GFP_OBS_NORM_15_9_7_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

