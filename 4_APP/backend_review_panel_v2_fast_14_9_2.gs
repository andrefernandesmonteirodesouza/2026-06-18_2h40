/**
 * 📂 ARQUIVO: 4_APP/backend_review_panel_v2_fast_14_9_2.gs
 * ⚡ MÓDULO: PAINEL DE REVISÃO 2.0 — MODO TURBO
 * 🔢 VERSÃO: 14.9.3
 * 📅 DATA: 10/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Aprovação rápida sem travar o painel.
 * O pós-processamento pesado é feito no botão "Finalizar revisão".
 * -----------------------------------------------------------------------------
 */

const GFP_PANEL_V2_FAST_PATCH_14_9_2 = "14.9.3";
const GFP_PANEL_V2_FAST_DB_14_9_2 = "DB_TRANSACOES";

/**
 * Aprovação rápida.
 */
function apiReviewPanelV2ApproveFast(payload) {
  return GFP_PANEL_V2_FAST_saveDecision_14_9_2_("APPROVE", payload || {});
}

/**
 * Correção rápida.
 */
function apiReviewPanelV2CorrectFast(payload) {
  return GFP_PANEL_V2_FAST_saveDecision_14_9_2_("CORRECT", payload || {});
}

/**
 * Revisão manual rápida.
 */
function apiReviewPanelV2MarkManualFast(payload) {
  return GFP_PANEL_V2_FAST_saveDecision_14_9_2_("MANUAL", payload || {});
}

/**
 * Aprovação em lote rápida.
 */
function apiReviewPanelV2BatchApproveFast(payload) {
  const p = payload || {};
  const rows = Array.isArray(p.rows) ? p.rows.map(Number).filter(n => n >= 2) : [];

  const out = {
    patch: GFP_PANEL_V2_FAST_PATCH_14_9_2,
    requested: rows.length,
    approved: 0,
    skipped: 0,
    errors: []
  };

  rows.forEach(row => {
    try {
      const r = GFP_PANEL_V2_FAST_saveDecision_14_9_2_("APPROVE", {
        row: row,
        batch: true
      });

      if (r && r.ok) out.approved++;
      else out.skipped++;

    } catch (e) {
      out.errors.push({
        row: row,
        error: e.message
      });
      out.skipped++;
    }
  });

  return out;
}

/**
 * Botão do painel: finaliza a sessão rápida.
 */
function apiReviewPanelV2FinalizeFastSession(payload) {
  const p = payload || {};
  const limit = Number(p.limit || 300);

  return GFP_PANEL_V2_PROCESSAR_PENDENCIAS_FAST_14_9_2(limit);
}

/**
 * Processa pendências do modo turbo:
 * - trainMemory;
 * - feedback 14.2;
 * - recalibrador uma vez;
 * - saneamento visual uma vez.
 */
function GFP_PANEL_V2_PROCESSAR_PENDENCIAS_FAST_14_9_2(limit) {
  return {
    ok: true,
    patch: "16.1.18.2",
    mode: "NOOP_TURBO",
    scanned: 0,
    processed: 0,
    trained: 0,
    feedback: 0,
    recalibrator: {
      skipped: true,
      reason: "Painel Turbo 16.1.18.2 não executa recalibração/pós-processamento pesado."
    },
    visual: {
      skipped: true,
      reason: "Painel Turbo 16.1.18.2 não executa saneamento visual global."
    },
    message: "Nenhum pós-processamento pesado foi executado."
  };
}


/**
 * Grava uma linha rapidamente.
 */
function GFP_PANEL_V2_FAST_saveDecision_14_9_2_(action, payload) {
  const p = payload || {};
  const rowNumber = Number(p.row || 0);

  if (!rowNumber || rowNumber < 2) {
    throw new Error("Linha inválida.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_PANEL_V2_FAST_DB_14_9_2);

  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const range = sh.getRange(rowNumber, 1, 1, 14);
  const row = range.getValues()[0];

  const oldTipo = String(row[3] || "").trim().toUpperCase();
  const oldCategory = String(row[5] || "").trim();
  const oldStatus = String(row[8] || "").trim();
  const oldStatusUpper = oldStatus.toUpperCase();

  if (GFP_PANEL_V2_FAST_isResolvedStatus_14_9_2_(oldStatusUpper) && action !== "MANUAL") {
    return {
      ok: false,
      skipped: true,
      row: rowNumber,
      reason: "Linha já resolvida."
    };
  }

  const meta = GFP_PANEL_V2_FAST_parseJson_14_9_2_(row[13]);

  if (!meta.reviewPanelV2Fast) meta.reviewPanelV2Fast = {};
  if (!meta.classificationParams) meta.classificationParams = {};

  const cp = meta.classificationParams;
  const currentSuggested = String(cp.suggestedCategory || cp.finalCategory || oldCategory || "").trim();
  const categoryFromPayload = String(p.category || "").trim();

  const finalCategory = categoryFromPayload || oldCategory || currentSuggested;

  let statusToWrite = "OK";
  let categoryToWrite = finalCategory;
  let visibleNote = "";
  let fullNote = "";

  if (action === "MANUAL") {
    statusToWrite = "REVISAR";
    categoryToWrite = oldCategory;
    visibleNote = "Revisão manual — Painel V2";
    fullNote = GFP_PANEL_V2_FAST_buildNote_14_9_2_(
      action,
      rowNumber,
      row,
      oldStatus,
      oldCategory,
      categoryToWrite,
      p.comment || ""
    );
  } else {
    if (!GFP_PANEL_V2_FAST_isCategory_14_9_2_(categoryToWrite)) {
      throw new Error("Categoria inválida ou vazia. Selecione uma categoria válida.");
    }

    statusToWrite = "OK";
    visibleNote = action === "CORRECT"
      ? "Corrigido Painel V2"
      : "Aprovado Painel V2";

    fullNote = GFP_PANEL_V2_FAST_buildNote_14_9_2_(
      action,
      rowNumber,
      row,
      oldStatus,
      oldCategory,
      categoryToWrite,
      p.comment || ""
    );
  }

  const now = new Date();

  meta.reviewPanelV2Fast = {
    pendingPostProcess: false,
    action: action,
    row: rowNumber,
    oldStatus: oldStatus,
    oldCategory: oldCategory,
    newStatus: statusToWrite,
    newCategory: categoryToWrite,
    decidedAt: now.toISOString(),
    patch: "16.1.18.2",
    comment: String(p.comment || ""),
    mode: "TURBO_ONE_STEP",
    note: "Linha confirmada na mesa. Não houve sort, autoarquivo, saneamento global, recalibração nem atualização DRE/Dashboard."
  };

  cp.reviewedByPanelV2FastAt = now.toISOString();
  cp.reviewedByPanelV2FastAction = action;
  cp.finalCategory = categoryToWrite;
  cp.fastPostProcessPending = false;
  cp.pendingPostProcess = false;

  // Feedback mínimo operacional: registra decisão sem disparar rotina pesada.
  cp.userDecision = {
    source: "PAINEL_REVISAO_2_TURBO",
    action: action,
    oldStatus: oldStatus,
    oldCategory: oldCategory,
    finalStatus: statusToWrite,
    finalCategory: categoryToWrite,
    decidedAt: now.toISOString(),
    patch: "16.1.18.2"
  };
  // 🧠 GFP 16.1.18.4 — marca para aprendizado pontual leve do modelo interno.
  // Não roda Gemini.
  // Não reordena.
  // Não arquiva.
  // Não atualiza Dashboard/DRE.
  cp.modelLearningPending = true;
  cp.modelLearningPatch = "16.1.18.4";
  cp.modelLearningReason = "Decisão aplicada pelo Painel Turbo; aprendizado será processado em lote leve ao final do commit.";

  if (action !== "MANUAL") {
    sh.getRange(rowNumber, 6).setValue(categoryToWrite);
  }

  const statusCell = sh.getRange(rowNumber, 9);
  statusCell.clearDataValidations();
  statusCell.setValue(statusToWrite);

  sh.getRange(rowNumber, 10)
    .setValue(visibleNote)
    .setNote(fullNote);

  sh.getRange(rowNumber, 14).setValue(JSON.stringify(meta));

  // Normaliza TIPO somente da linha tocada. Isso é contábil e precisa ser imediato.
  try {
    if (action !== "MANUAL" && typeof applyTypeLogic_ServerSide === "function") {
      applyTypeLogic_ServerSide(sh, rowNumber, categoryToWrite);
    } else if (action !== "MANUAL" && typeof GFP_NORMALIZAR_TIPO_APROVACAO_14_3_2 === "function") {
      GFP_NORMALIZAR_TIPO_APROVACAO_14_3_2(sh, rowNumber, categoryToWrite);
    }
  } catch (eTipo) {
    Logger.warn("[Painel V2 Turbo 16.1.18.2] Falha ao normalizar TIPO: " + eTipo.message);
  }

  return {
    ok: true,
    patch: "16.1.18.2",
    mode: "TURBO_ONE_STEP",
    row: rowNumber,
    action: action,
    oldStatus: oldStatus,
    newStatus: statusToWrite,
    oldCategory: oldCategory,
    newCategory: categoryToWrite,
    pendingPostProcess: false,
    oldTipo: oldTipo,
    message: "Decisão aplicada. Linha permanece na DB_TRANSACOES até Arquivar Linhas OK."
  };
}


function GFP_PANEL_V2_FAST_buildNote_14_9_2_(action, rowNumber, row, oldStatus, oldCategory, newCategory, comment) {
  const descricao = String(row[1] || "").trim();
  const valor = Number(row[2] || 0);
  const conta = String(row[4] || "").trim();

  return [
    "GFP — Painel de Revisão 2.0 Turbo",
    "",
    "Ação: " + action,
    "Linha: " + rowNumber,
    "Data: " + new Date().toISOString(),
    "Patch: 16.1.18.2",
    "",
    "Descrição: " + descricao,
    "Valor: " + valor,
    "Conta: " + conta,
    "",
    "Status anterior: " + (oldStatus || "(vazio)"),
    "Categoria anterior: " + (oldCategory || "(vazia)"),
    "Categoria final: " + (newCategory || "(vazia)"),
    "",
    "Pós-processamento:",
    "Não executado. O Painel Turbo grava a decisão e mantém a linha na DB_TRANSACOES.",
    "",
    "Não houve:",
    "- ordenação automática;",
    "- arquivamento automático;",
    "- saneamento global;",
    "- recalibração;",
    "- atualização DRE/Dashboard.",
    "",
    "A linha só sairá da mesa ao executar Arquivar Linhas OK.",
    "",
    "Comentário: " + (comment || "(sem comentário)")
  ].join("\n");
}


function GFP_PANEL_V2_FAST_isResolvedStatus_14_9_2_(status) {
  const s = String(status || "").trim().toUpperCase();
  return s === "OK" || s === "CONCILIADO" || s === "SPLIT" || s === "CONSOLIDADO" || s === "APROVADO";
}

function GFP_PANEL_V2_FAST_isCategory_14_9_2_(value) {
  return /^\d{2}\.\d{2}\s+—\s+/.test(String(value || "").trim());
}

function GFP_PANEL_V2_FAST_parseJson_14_9_2_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}
