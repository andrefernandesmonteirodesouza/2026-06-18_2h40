/**
 * =============================================================================
 * GFP 16.0.6 — MODO DOMÉSTICO
 * =============================================================================
 *
 * Objetivo:
 * - tirar a cara de sistema corporativo/auditoria;
 * - devolver o SYS_LOGS ao padrão limpo antigo;
 * - esconder/remover abas técnicas que não servem ao uso diário;
 * - manter checagem técnica apenas como ferramenta rara.
 * =============================================================================
 */

const GFP_DOMESTICO_VERSION_16_0_6 = "16.0.6";

const GFP_DOMESTICO_VISIBLE_ORDER_16_0_6 = [
  "DB_TRANSACOES",
  "DB_TRANSACOES_HIST",
  "DB_MEMORIA",
  "SYS_LOGS",
  "DRE_GERENCIAL",
  "VISAO_FUTURO",
  "CFG_Aprendizado",
  "CFG_Categorias",
  "CFG_Contas",
  "CFG_Cartoes"
];

const GFP_DOMESTICO_TECH_SHEETS_16_0_6 = [
  "SYS_AUDITORIA",
  "SYS_AUDITORIA_GFP",
  "SYS_DASHBOARD_2_AUDIT",
  "SYS_REVIEW_PANEL_2_AUDIT",
  "SYS_PRECHECK_BASE_FINAL",
  "SYS_SAUDE_GFP",
  "SYS_LIMPEZA_TECNICA_GFP",
  "SYS_TAXONOMIA_REPORT",
  "SYS_AUDIT_REPORT",
  "SYS_RELATORIOS",
  "REL_PRE16_FINAL_GFP",
  "REL_ORGANIZACAO_ABAS_GFP",
  "REL_CLASSIFICACAO_ABAS_GFP",
  "LOG_REVISAO_IA",
  "LOG_ARQUIVAMENTO",
  "SYS_RESET_LOG"
];

const GFP_DOMESTICO_HIDDEN_KEEP_SHEETS_16_0_6 = [
  "SYS_TECNICO",
  "CFG_Modelo_Classificacao",
  "CFG_Taxonomia_Quarentena",
  "CFG_Taxonomia"
];

/**
 * Função principal do Modo Doméstico.
 *
 * Use depois de aplicar o patch:
 *
 *   GFP_DOMESTICO_APLICAR_16_0_6()
 */
function GFP_DOMESTICO_APLICAR_16_0_6() {
  const result = {
    version: GFP_DOMESTICO_VERSION_16_0_6,
    startedAt: new Date().toISOString(),
    sysLogs: null,
    hiddenTechSheets: 0,
    hiddenKeepSheets: 0,
    ordered: false,
    finishedAt: "",
    ok: true,
    errors: []
  };

  try {
    result.sysLogs = GFP_DOMESTICO_REPARAR_SYS_LOGS_16_0_6();
  } catch (e) {
    result.errors.push("REPARAR_SYS_LOGS: " + e.message);
  }

  try {
    result.hiddenTechSheets = GFP_DOMESTICO_OCULTAR_ABAS_TECNICAS_16_0_6();
  } catch (e2) {
    result.errors.push("OCULTAR_TECNICAS: " + e2.message);
  }

  try {
    result.hiddenKeepSheets = GFP_DOMESTICO_OCULTAR_ABAS_TECNICAS_MANTIDAS_16_0_6();
  } catch (e3) {
    result.errors.push("OCULTAR_MANTIDAS: " + e3.message);
  }

  try {
    GFP_DOMESTICO_ORDENAR_ABAS_VISIVEIS_16_0_6();
    result.ordered = true;
  } catch (e4) {
    result.errors.push("ORDENAR_ABAS: " + e4.message);
  }

  result.finishedAt = new Date().toISOString();
  result.ok = result.errors.length === 0;

  GFP_DOMESTICO_LOG_16_0_6_(
    result.ok ? "OK" : "WARN",
    "GFP_DOMESTICO_APLICAR_16_0_6",
    result.ok
      ? "Modo doméstico aplicado. SYS_LOGS limpo, abas técnicas ocultas e menu enxuto."
      : "Modo doméstico aplicado com alertas: " + result.errors.join(" | ")
  );

  SpreadsheetApp.getActive().toast(
    result.ok
      ? "Modo doméstico aplicado. SYS_LOGS limpo."
      : "Modo doméstico aplicado com alertas.",
    "GFP 16.0.6"
  );

  return result;
}

/**
 * =============================================================================
 * SYS_LOGS — VOLTA AO PADRÃO ANTIGO
 * =============================================================================
 *
 * Regras:
 * - Remove linhas importadas de LOG_ARQUIVAMENTO/LOG_REVISAO_IA que trouxeram JSON gigante.
 * - Remove trecho " | payload=..." das mensagens.
 * - Não quebra linhas.
 * - Altura padrão.
 * - Mais recente no topo.
 */
function GFP_DOMESTICO_REPARAR_SYS_LOGS_16_0_6() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("SYS_LOGS");

  if (!sh) {
    sh = ss.insertSheet("SYS_LOGS");
  }

  GFP_DOMESTICO_ENSURE_SYS_LOGS_HEADER_16_0_6_(sh);

  const lastRow = sh.getLastRow();
  const lastCol = Math.max(5, sh.getLastColumn());

  if (lastRow < 2) {
    GFP_DOMESTICO_FORMAT_SYS_LOGS_16_0_6_(sh);
    return { ok: true, kept: 0, removed: 0 };
  }

  const values = sh.getRange(2, 1, lastRow - 1, Math.min(lastCol, 5)).getValues();

  const cleaned = [];
  let removed = 0;

  values.forEach(function(row) {
    const normalized = GFP_DOMESTICO_NORMALIZAR_LOG_ROW_16_0_6_(row);

    if (!normalized) {
      removed++;
      return;
    }

    cleaned.push(normalized);
  });

  cleaned.sort(function(a, b) {
    return GFP_DOMESTICO_DATE_VALUE_16_0_6_(b[0]) - GFP_DOMESTICO_DATE_VALUE_16_0_6_(a[0]);
  });

  if (lastRow > 1) {
    sh.getRange(2, 1, lastRow - 1, Math.max(5, lastCol)).clearContent();
  }

  if (cleaned.length) {
    sh.getRange(2, 1, cleaned.length, 5).setValues(cleaned);
  }

  GFP_DOMESTICO_FORMAT_SYS_LOGS_16_0_6_(sh);

  return {
    ok: true,
    kept: cleaned.length,
    removed: removed
  };
}

/**
 * Remove JSON/payloads e linhas técnicas importadas.
 */
function GFP_DOMESTICO_NORMALIZAR_LOG_ROW_16_0_6_(row) {
  let timestamp = row[0];
  let level = String(row[1] || "INFO").trim().toUpperCase();
  let func = String(row[2] || "").trim();
  let message = String(row[3] || "").trim();
  let stack = String(row[4] || "").trim();

  const joined = row.map(function(v) { return String(v || ""); }).join(" | ").trim();

  if (!joined) return null;

  // Remove separadores visuais antigos, porque atrapalham ordenação.
  if (String(timestamp || "").indexOf("---") === 0 || message.indexOf("---") === 0) {
    return null;
  }

  // Remove importações técnicas legadas que só trouxeram JSON gigante para o SYS_LOGS.
  if (
    func.indexOf("IMPORTADO_") === 0 ||
    message.indexOf("OBS_FINAL_LOG|") >= 0 ||
    message.indexOf("OBS16_LOG|") >= 0 ||
    message.indexOf('"sourceSheet":"LOG_ARQUIVAMENTO"') >= 0 ||
    message.indexOf('"sourceSheet":"LOG_REVISAO_IA"') >= 0
  ) {
    return null;
  }

  // Se a linha veio no formato técnico novo com payload, mantém só a frase humana.
  message = GFP_DOMESTICO_REMOVER_PAYLOAD_16_0_6_(message);
  stack = GFP_DOMESTICO_REMOVER_PAYLOAD_16_0_6_(stack);

  // Stack gigante não é útil para leitura diária.
  if (stack.length > 500) {
    stack = stack.substring(0, 500) + " ...[cortado]";
  }

  // Mensagem gigante também não é útil no dia a dia.
  if (message.length > 1200) {
    message = message.substring(0, 1200) + " ...[cortado]";
  }

  if (!level) level = "INFO";

  if (level === "ERROR") level = "ERRO";
  if (level === "WARNING") level = "WARN";
  if (level === "CRITICAL") level = "ERRO";

  // Se a timestamp não for data válida, mantém como está, mas a ordenação jogará para baixo.
  return [
    timestamp || GFP_DOMESTICO_FORMAT_DATE_16_0_6_(new Date()),
    level,
    func,
    message || joined.substring(0, 1200),
    stack
  ];
}

function GFP_DOMESTICO_REMOVER_PAYLOAD_16_0_6_(text) {
  text = String(text || "");

  const markers = [
    " | payload=",
    " payload={",
    " | {\"version\"",
    " | {\"ok\"",
    " | {\"patch\""
  ];

  for (let i = 0; i < markers.length; i++) {
    const idx = text.indexOf(markers[i]);
    if (idx >= 0) {
      return text.substring(0, idx).trim();
    }
  }

  return text.trim();
}

function GFP_DOMESTICO_ENSURE_SYS_LOGS_HEADER_16_0_6_(sh) {
  sh.getRange(1, 1, 1, 5).setValues([[
    "Timestamp",
    "Level",
    "Function",
    "Message",
    "Stack Trace"
  ]]);
}

function GFP_DOMESTICO_FORMAT_SYS_LOGS_16_0_6_(sh) {
  const maxRows = Math.max(1, sh.getMaxRows());
  const lastRow = Math.max(1, sh.getLastRow());

  sh.getRange(1, 1, 1, 5)
    .setFontWeight("bold")
    .setBackground("#000000")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);

  if (sh.getFilter()) sh.getFilter().remove();
  sh.getDataRange().createFilter();

  try { sh.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss"); } catch (e) {}

  // Essencial: sem wrap para não explodir altura de linha.
  try { sh.getRange(1, 1, Math.max(lastRow, 1), 5).setWrap(false); } catch (e2) {}

  try {
    if (lastRow >= 2) {
      sh.setRowHeights(2, lastRow - 1, 21);
    }
  } catch (e3) {}

  try { sh.setColumnWidth(1, 145); } catch (e4) {}
  try { sh.setColumnWidth(2, 70); } catch (e5) {}
  try { sh.setColumnWidth(3, 260); } catch (e6) {}
  try { sh.setColumnWidth(4, 720); } catch (e7) {}
  try { sh.setColumnWidth(5, 180); } catch (e8) {}
}

/**
 * Logger simplificado para o modo doméstico.
 * Insere no topo, igual ao logger antigo.
 */
function GFP_DOMESTICO_LOG_16_0_6_(level, funcName, message) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName("SYS_LOGS");

    if (!sh) {
      sh = ss.insertSheet("SYS_LOGS");
    }

    GFP_DOMESTICO_ENSURE_SYS_LOGS_HEADER_16_0_6_(sh);

    const cleanMessage = GFP_DOMESTICO_REMOVER_PAYLOAD_16_0_6_(String(message || ""));

    sh.insertRowBefore(2);
    sh.getRange(2, 1, 1, 5).setValues([[
      GFP_DOMESTICO_FORMAT_DATE_16_0_6_(new Date()),
      String(level || "INFO").toUpperCase(),
      String(funcName || ""),
      cleanMessage.length > 1200 ? cleanMessage.substring(0, 1200) + " ...[cortado]" : cleanMessage,
      ""
    ]]);

    GFP_DOMESTICO_FORMAT_SYS_LOGS_16_0_6_(sh);

  } catch (e) {
    console.error("Falha no logger doméstico: " + e.message);
  }
}

/**
 * =============================================================================
 * ABAS TÉCNICAS
 * =============================================================================
 */

function GFP_DOMESTICO_OCULTAR_ABAS_TECNICAS_16_0_6() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hidden = 0;

  GFP_DOMESTICO_TECH_SHEETS_16_0_6.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    if (sh.isSheetHidden()) return;

    const visibleCount = ss.getSheets().filter(function(s) { return !s.isSheetHidden(); }).length;
    if (visibleCount <= 1) return;

    sh.hideSheet();
    hidden++;
  });

  return hidden;
}

function GFP_DOMESTICO_OCULTAR_ABAS_TECNICAS_MANTIDAS_16_0_6() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hidden = 0;

  GFP_DOMESTICO_HIDDEN_KEEP_SHEETS_16_0_6.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    if (sh.isSheetHidden()) return;

    const visibleCount = ss.getSheets().filter(function(s) { return !s.isSheetHidden(); }).length;
    if (visibleCount <= 1) return;

    sh.hideSheet();
    hidden++;
  });

  return hidden;
}

/**
 * Exclui fisicamente abas técnicas antigas.
 * Use só após conferir que o sistema está OK.
 */
function GFP_DOMESTICO_EXCLUIR_ABAS_TECNICAS_16_0_6(confirmacao) {
  if (confirmacao !== "EXCLUIR_ABAS_TECNICAS_16_0_6") {
    throw new Error("Confirmação inválida. Use exatamente: EXCLUIR_ABAS_TECNICAS_16_0_6");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Antes de excluir, limpa o SYS_LOGS.
  GFP_DOMESTICO_REPARAR_SYS_LOGS_16_0_6();

  const active = ss.getSheetByName("DB_TRANSACOES") ||
    ss.getSheetByName("SYS_LOGS") ||
    ss.getSheets()[0];

  if (active) ss.setActiveSheet(active);

  const deleted = [];

  GFP_DOMESTICO_TECH_SHEETS_16_0_6.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;

    // Nunca deletar SYS_LOGS aqui.
    if (name === "SYS_LOGS") return;

    ss.deleteSheet(sh);
    deleted.push(name);
  });

  GFP_DOMESTICO_OCULTAR_ABAS_TECNICAS_MANTIDAS_16_0_6();

  GFP_DOMESTICO_LOG_16_0_6_(
    "OK",
    "GFP_DOMESTICO_EXCLUIR_ABAS_TECNICAS_16_0_6",
    "Abas técnicas antigas excluídas: " + deleted.length
  );

  SpreadsheetApp.getActive().toast("Abas técnicas excluídas: " + deleted.length, "GFP 16.0.6");

  return { ok: true, deleted: deleted };
}

function GFP_DOMESTICO_EXCLUIR_ABAS_TECNICAS_CONFIRMADO_16_0_6() {
  return GFP_DOMESTICO_EXCLUIR_ABAS_TECNICAS_16_0_6("EXCLUIR_ABAS_TECNICAS_16_0_6");
}

function GFP_DOMESTICO_MOSTRAR_SYS_TECNICO_16_0_6() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("SYS_TECNICO");

  if (!sh) {
    SpreadsheetApp.getActive().toast("SYS_TECNICO não existe.", "GFP 16.0.6");
    return false;
  }

  sh.showSheet();
  ss.setActiveSheet(sh);

  return true;
}

function GFP_DOMESTICO_OCULTAR_SYS_TECNICO_16_0_6() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("SYS_TECNICO");

  if (!sh) return false;

  const visibleCount = ss.getSheets().filter(function(s) { return !s.isSheetHidden(); }).length;
  if (visibleCount <= 1) return false;

  sh.hideSheet();
  return true;
}

/**
 * =============================================================================
 * CHECK-UP TÉCNICO SIMPLES
 * =============================================================================
 *
 * Não cria abas.
 * Não escreve JSON.
 * Só joga um resumo simples no SYS_LOGS.
 */
function GFP_DOMESTICO_CHECKUP_TECNICO_16_0_6() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const requiredSheets = [
    "DB_TRANSACOES",
    "DB_TRANSACOES_HIST",
    "DB_MEMORIA",
    "SYS_LOGS",
    "DRE_GERENCIAL",
    "VISAO_FUTURO",
    "CFG_Categorias",
    "CFG_Contas",
    "CFG_Cartoes"
  ];

  const requiredFunctions = [
    "pipelineExecute",
    "openReviewPanelV2",
    "openDashboardV2",
    "GFP_ARQUIVAR_LINHAS_OK_15_2",
    "GFP_ABRIR_HISTORICO_ARQUIVADO_15_2_4"
  ];

  const missingSheets = requiredSheets.filter(function(name) {
    return !ss.getSheetByName(name);
  });

  const missingFunctions = requiredFunctions.filter(function(name) {
    try {
      return typeof globalThis[name] !== "function";
    } catch (e) {
      return true;
    }
  });

  const db = ss.getSheetByName("DB_TRANSACOES");
  const workRows = db ? Math.max(0, db.getLastRow() - 1) : 0;

  const msg = missingSheets.length || missingFunctions.length
    ? "Check-up técnico: atenção. Abas faltando: " + (missingSheets.join(", ") || "nenhuma") +
      " | Funções faltando: " + (missingFunctions.join(", ") || "nenhuma") +
      " | Linhas ativas: " + workRows
    : "Check-up técnico OK. Abas essenciais e funções principais encontradas. Linhas ativas: " + workRows;

  GFP_DOMESTICO_LOG_16_0_6_(
    missingSheets.length || missingFunctions.length ? "WARN" : "OK",
    "GFP_DOMESTICO_CHECKUP_TECNICO_16_0_6",
    msg
  );

  SpreadsheetApp.getActive().toast(
    missingSheets.length || missingFunctions.length ? "Check-up com alertas." : "Check-up técnico OK.",
    "GFP 16.0.6"
  );

  return {
    ok: !(missingSheets.length || missingFunctions.length),
    missingSheets: missingSheets,
    missingFunctions: missingFunctions,
    workRows: workRows
  };
}

/**
 * =============================================================================
 * ORGANIZAÇÃO VISUAL
 * =============================================================================
 */

function GFP_DOMESTICO_ORDENAR_ABAS_VISIVEIS_16_0_6() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let pos = 1;

  GFP_DOMESTICO_VISIBLE_ORDER_16_0_6.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;

    try {
      if (sh.isSheetHidden()) sh.showSheet();
      ss.setActiveSheet(sh);
      ss.moveActiveSheet(pos++);
    } catch (e) {}
  });

  // Mantidas ocultas por padrão.
  GFP_DOMESTICO_OCULTAR_ABAS_TECNICAS_16_0_6();
  GFP_DOMESTICO_OCULTAR_ABAS_TECNICAS_MANTIDAS_16_0_6();

  const first = ss.getSheetByName("DB_TRANSACOES");
  if (first) ss.setActiveSheet(first);

  return { ok: true };
}

/**
 * =============================================================================
 * HELPERS DE DATA
 * =============================================================================
 */

function GFP_DOMESTICO_DATE_VALUE_16_0_6_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.getTime();
  }

  if (typeof value === "number" && !isNaN(value)) {
    return new Date(Math.round((value - 25569) * 86400 * 1000)).getTime();
  }

  const text = String(value || "").trim();
  if (!text) return 0;

  const native = new Date(text);
  if (!isNaN(native.getTime())) return native.getTime();

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (br) {
    return new Date(
      Number(br[3]),
      Number(br[2]) - 1,
      Number(br[1]),
      Number(br[4] || 0),
      Number(br[5] || 0),
      Number(br[6] || 0)
    ).getTime();
  }

  return 0;
}

function GFP_DOMESTICO_FORMAT_DATE_16_0_6_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
}
