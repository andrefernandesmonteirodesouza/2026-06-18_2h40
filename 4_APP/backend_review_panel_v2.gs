/**
 * 📂 ARQUIVO: 4_APP/backend_review_panel_v2.gs
 * 📝 MÓDULO: PAINEL DE REVISÃO 2.0 — BACKEND BASE
 * 🔢 VERSÃO: 14.9.3
 * 📅 DATA: 10/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Backend base do Painel de Revisão 2.0.
 * O modo turbo fica no arquivo backend_review_panel_v2_fast_14_9_2.gs.
 * -----------------------------------------------------------------------------
 */

const GFP_PANEL_V2_PATCH = "14.9.3";
const GFP_PANEL_V2_DB = "DB_TRANSACOES";
const GFP_PANEL_V2_CATEGORIES = "CFG_Categorias";
const GFP_PANEL_V2_MODEL = "CFG_Modelo_Classificacao";

/**
 * Abre o novo painel.
 */
function openReviewPanelV2() {
  const html = HtmlService
    .createHtmlOutputFromFile("4_APP/frontend_panel_v2.html")
    .setWidth(1280)
    .setHeight(820);

  SpreadsheetApp.getUi().showModalDialog(html, "Painel de Revisão 2.0 — GFP");
}

/**
 * API principal do painel.
 *
 * @param {Object=} filters
 */
function apiReviewPanelV2GetData(filters) {
  const f = filters || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_PANEL_V2_DB);

  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const categories = GFP_PANEL_V2_loadCategories_();
  const lastRow = sh.getLastRow();

  if (lastRow < 2) {
    return {
      patch: GFP_PANEL_V2_PATCH,
      stats: GFP_PANEL_V2_emptyStats_(),
      categories: categories,
      items: []
    };
  }

  const limit = Math.max(1, Math.min(Number(f.limit || 80), 300));
  const query = GFP_PANEL_V2_normText_(f.query || "");
  const group = String(f.group || "ALL").toUpperCase();
  const minConfidence = Number(f.minConfidence || 0);
  const includeResolved = !!f.includeResolved;

  const values = sh.getRange(2, 1, lastRow - 1, 14).getValues();
  const notes = sh.getRange(2, 10, lastRow - 1, 1).getNotes();

  const allItems = [];
  const stats = GFP_PANEL_V2_emptyStats_();

  values.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const item = GFP_PANEL_V2_buildItem_(row, notes[idx][0], rowNumber);

    GFP_PANEL_V2_accumulateStats_(stats, item);

    if (!includeResolved && item.resolved) return;

    if (group !== "ALL" && item.group !== group) return;

    if (minConfidence && Number(item.confidence || 0) < minConfidence) return;

    if (query) {
      const haystack = GFP_PANEL_V2_normText_([
        item.descricao,
        item.conta,
        item.categoria,
        item.status,
        item.notas,
        item.reason,
        item.modelKey
      ].join(" "));

      if (haystack.indexOf(query) < 0) return;
    }

    allItems.push(item);
  });

  allItems.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;

    if (Number(b.confidence || 0) !== Number(a.confidence || 0)) {
      return Number(b.confidence || 0) - Number(a.confidence || 0);
    }

    return a.row - b.row;
  });

  const items = allItems.slice(0, limit);

  return {
    patch: GFP_PANEL_V2_PATCH,
    generatedAt: new Date().toISOString(),
    stats: stats,
    categories: categories,
    items: items,
    returned: items.length,
    totalMatched: allItems.length
  };
}

/**
 * APIs antigas/compatíveis, mantidas para fallback.
 */
function apiReviewPanelV2Approve(payload) {
  if (typeof apiReviewPanelV2ApproveFast === "function") {
    return apiReviewPanelV2ApproveFast(payload);
  }

  return GFP_PANEL_V2_saveDecision_("APPROVE", payload || {});
}

function apiReviewPanelV2Correct(payload) {
  if (typeof apiReviewPanelV2CorrectFast === "function") {
    return apiReviewPanelV2CorrectFast(payload);
  }

  return GFP_PANEL_V2_saveDecision_("CORRECT", payload || {});
}

function apiReviewPanelV2MarkManual(payload) {
  if (typeof apiReviewPanelV2MarkManualFast === "function") {
    return apiReviewPanelV2MarkManualFast(payload);
  }

  return GFP_PANEL_V2_saveDecision_("MANUAL", payload || {});
}

function apiReviewPanelV2BatchApprove(payload) {
  if (typeof apiReviewPanelV2BatchApproveFast === "function") {
    return apiReviewPanelV2BatchApproveFast(payload);
  }

  const p = payload || {};
  const rows = Array.isArray(p.rows) ? p.rows : [];

  const out = {
    requested: rows.length,
    approved: 0,
    skipped: 0,
    errors: []
  };

  rows.forEach(row => {
    try {
      const r = GFP_PANEL_V2_saveDecision_("APPROVE", {
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

  GFP_PANEL_V2_afterSave_();

  return out;
}

/**
 * Detalhes do modelo por descrição.
 */
function apiReviewPanelV2ModelDetails(payload) {
  const p = payload || {};
  const descricao = String(p.descricao || "").trim();
  const conta = String(p.conta || "").trim();
  const tipo = String(p.tipo || "").trim().toUpperCase();

  if (!descricao) return { matches: [] };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_PANEL_V2_MODEL);
  if (!sh || sh.getLastRow() < 2) return { matches: [] };

  const model = GFP_PANEL_V2_loadModel_(sh);
  const key = GFP_PANEL_V2_normalizeKey_(descricao);

  const matches = [];

  model.forEach(m => {
    let matchScore = 0;

    if (m.chave === key) matchScore += 100;
    else if (key.indexOf(m.chave) >= 0 && m.chave.length >= 8) matchScore += 75;
    else if (m.chave.indexOf(key) >= 0 && key.length >= 8) matchScore += 65;
    else return;

    if (m.conta === conta) matchScore += 15;
    else if (m.conta === "*") matchScore += 5;
    else matchScore -= 10;

    if (m.tipo === tipo) matchScore += 15;
    else if (m.tipo === "*") matchScore += 5;
    else matchScore -= 10;

    matchScore += Math.min(20, Number(m.acertos || 0) * 2);
    matchScore -= Math.min(20, Number(m.erros || 0) * 3);

    matches.push({
      chave: m.chave,
      categoria: m.categoria,
      conta: m.conta,
      tipo: m.tipo,
      score: m.score,
      faixa: m.faixa,
      statusModelo: m.statusModelo,
      acertos: m.acertos,
      erros: m.erros,
      negadas: m.negadas,
      origemPrincipal: m.origemPrincipal,
      observacoes: m.observacoes,
      matchScore: matchScore
    });
  });

  matches.sort((a, b) => b.matchScore - a.matchScore);

  return {
    key: key,
    matches: matches.slice(0, 10)
  };
}

/**
 * Fallback antigo de gravação completa.
 * O painel final usa as funções Fast do BLOCO 2.
 */
function GFP_PANEL_V2_saveDecision_(action, payload) {
  const p = payload || {};
  const rowNumber = Number(p.row || 0);

  if (!rowNumber || rowNumber < 2) {
    throw new Error("Linha inválida para revisão.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_PANEL_V2_DB);
  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const row = sh.getRange(rowNumber, 1, 1, 14).getValues()[0];
  const oldItem = GFP_PANEL_V2_buildItem_(row, sh.getRange(rowNumber, 10).getNote(), rowNumber);

  if (oldItem.resolved && action !== "MANUAL") {
    return {
      ok: false,
      skipped: true,
      reason: "Linha já resolvida.",
      row: rowNumber
    };
  }

  const now = new Date();
  const oldMeta = GFP_PANEL_V2_parseJson_(row[13]);
  const meta = oldMeta && typeof oldMeta === "object" ? oldMeta : {};
  if (!meta.reviewPanelV2) meta.reviewPanelV2 = {};

  const currentCategory = String(row[5] || "").trim();
  const newCategory = String(p.category || currentCategory || "").trim();

  let statusToWrite = "OK";
  let categoryToWrite = newCategory;
  let noteVisible = "";
  let noteFull = "";

  if (action === "MANUAL") {
    statusToWrite = "REVISAR";
    categoryToWrite = currentCategory;
    noteVisible = "Revisão manual solicitada — ver nota";
    noteFull = GFP_PANEL_V2_buildDecisionNote_("MANUAL", oldItem, categoryToWrite, p.comment || "");
  } else {
    if (!GFP_PANEL_V2_isCategory_(categoryToWrite)) {
      throw new Error("Para aprovar/corrigir, selecione uma categoria válida.");
    }

    statusToWrite = "OK";
    noteVisible = action === "CORRECT" ? "Corrigido Painel V2 — ver nota" : "Aprovado Painel V2 — ver nota";
    noteFull = GFP_PANEL_V2_buildDecisionNote_(action, oldItem, categoryToWrite, p.comment || "");
  }

  meta.reviewPanelV2.lastDecision = {
    action: action,
    row: rowNumber,
    oldStatus: oldItem.status,
    oldCategory: oldItem.categoria,
    newStatus: statusToWrite,
    newCategory: categoryToWrite,
    decidedAt: now.toISOString(),
    patch: GFP_PANEL_V2_PATCH,
    comment: String(p.comment || "")
  };

  if (!meta.classificationParams) meta.classificationParams = {};
  meta.classificationParams.reviewedByPanelV2At = now.toISOString();
  meta.classificationParams.reviewedByPanelV2Action = action;
  meta.classificationParams.finalCategory = categoryToWrite;

  if (action !== "MANUAL") {
    sh.getRange(rowNumber, 6).setValue(categoryToWrite);
  }

  const statusCell = sh.getRange(rowNumber, 9);
  statusCell.clearDataValidations();
  statusCell.setValue(statusToWrite);

  sh.getRange(rowNumber, 10)
    .setValue(noteVisible)
    .setNote(noteFull);

  sh.getRange(rowNumber, 14).setValue(JSON.stringify(meta));

  try {
    if (action !== "MANUAL" && typeof applyTypeLogic_ServerSide === "function") {
      applyTypeLogic_ServerSide(sh, rowNumber, categoryToWrite);
    } else if (action !== "MANUAL" && typeof GFP_NORMALIZAR_TIPO_APROVACAO_14_3_2 === "function") {
      GFP_NORMALIZAR_TIPO_APROVACAO_14_3_2(sh, rowNumber, categoryToWrite);
    }
  } catch (e) {
    Logger.warn("[Painel V2] Falha ao normalizar TIPO: " + e.message);
  }

  try {
    if (action !== "MANUAL" && typeof trainMemory === "function") {
      trainMemory(String(row[1] || ""), categoryToWrite, "PAINEL_REVISAO_V2");
    }
  } catch (e) {
    Logger.warn("[Painel V2] Falha no trainMemory: " + e.message);
  }

  try {
    if (action !== "MANUAL" && typeof GFP_MODELO_FEEDBACK_PROCESSAR_LINHA_APPLY_14_2 === "function") {
      GFP_MODELO_FEEDBACK_PROCESSAR_LINHA_APPLY_14_2(rowNumber);
    }
  } catch (e) {
    Logger.warn("[Painel V2] Falha no feedback 14.2: " + e.message);
  }

  try {
    if (action !== "MANUAL" && typeof GFP_RECALIBRAR_MAYBE_AUTO_POS_FEEDBACK_14_4_1 === "function") {
      GFP_RECALIBRAR_MAYBE_AUTO_POS_FEEDBACK_14_4_1(100, "PAINEL_REVISAO_V2");
    }
  } catch (e) {
    Logger.warn("[Painel V2] Falha no recalibrador auto: " + e.message);
  }

  GFP_PANEL_V2_afterSave_();

  return {
    ok: true,
    action: action,
    row: rowNumber,
    status: statusToWrite,
    category: categoryToWrite
  };
}

function GFP_PANEL_V2_afterSave_() {
  try {
    if (typeof GFP_SANEAR_VISUAL_DB_TRANSACOES_14_5_1 === "function") {
      GFP_SANEAR_VISUAL_DB_TRANSACOES_14_5_1();
      return;
    }
  } catch (e) {
    Logger.warn("[Painel V2] Falha saneamento visual: " + e.message);
  }

  try {
    if (typeof GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3 === "function") {
      GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3();
    }
  } catch (e) {
    Logger.warn("[Painel V2] Falha sorter: " + e.message);
  }
}

/**
 * Constrói item do painel.
 */
function GFP_PANEL_V2_buildItem_(row, cellNote, rowNumber) {
  const data = row[0];
  const descricao = String(row[1] || "").trim();
  const valor = Number(row[2] || 0);
  const tipo = String(row[3] || "").trim();
  const conta = String(row[4] || "").trim();
  const categoria = String(row[5] || "").trim();
  const parcAtual = row[6] || "";
  const parcTotal = row[7] || "";
  const status = String(row[8] || "").trim();
  const statusUpper = status.toUpperCase();
  const notas = String(row[9] || "").trim();
  const idTransacao = String(row[10] || "").trim();
  const meta = GFP_PANEL_V2_parseJson_(row[13]);

  const cp = meta && meta.classificationParams ? meta.classificationParams : {};

  const source = GFP_PANEL_V2_detectSource_(statusUpper, notas, cp);
  const confidence = GFP_PANEL_V2_detectConfidence_16_1_18_2_(notas, cp);
  const faixa = GFP_PANEL_V2_detectFaixa_16_1_18_2_(statusUpper, notas, cp, confidence);
  const effectiveStatus = GFP_PANEL_V2_effectiveStatus_16_1_18_2_(statusUpper, source, faixa);

  const suggestedCategory = String(cp.suggestedCategory || cp.finalCategory || categoria || "").trim();
  const reason = String(cp.reason || "").trim();

  const resolved = GFP_PANEL_V2_isResolvedStatus_(statusUpper);
  const hasCategory = GFP_PANEL_V2_isCategory_(categoria);
  const generic = GFP_PANEL_V2_isGenericCategory_(categoria);

  const group = GFP_PANEL_V2_group_(effectiveStatus, hasCategory, generic);
  const priority = GFP_PANEL_V2_priority_(group, confidence);

  return {
    row: rowNumber,
    data: GFP_PANEL_V2_formatDate_(data),
    descricao: descricao,
    valor: valor,
    valorFmt: GFP_PANEL_V2_formatMoney_(valor),
    tipo: tipo,
    conta: conta,
    categoria: categoria,
    parcAtual: parcAtual,
    parcTotal: parcTotal,
    status: status,
    effectiveStatus: effectiveStatus,
    notas: notas,
    cellNote: String(cellNote || ""),
    idTransacao: idTransacao,
    source: source,
    faixa: faixa,
    confidence: confidence,
    suggestedCategory: suggestedCategory,
    reason: reason,
    modelKey: String(cp.modelKey || ""),
    modelScore: cp.modelScore || cp.confidence || "",
    modelAcertos: cp.modelAcertos || "",
    modelErros: cp.modelErros || "",
    resolved: resolved,
    hasCategory: hasCategory,
    genericCategory: generic,
    group: group,
    priority: priority,
    safeToBatchApprove: !resolved && hasCategory && !generic && (
      effectiveStatus.indexOf("GEMINI_") === 0 ||
      effectiveStatus.indexOf("MODELO_") === 0 ||
      effectiveStatus === "PENDENTE_CATEGORIZADA" ||
      statusUpper === "PENDENTE_CATEGORIZADA"
    ),
    meta: {
      cashMonth: meta.cashMonth || "",
      invoiceDueDate: meta.invoiceDueDate || "",
      origin: meta.origin || "",
      fileName: meta.fileName || meta.invoiceFileName || ""
    }
  };
}
function GFP_PANEL_V2_detectConfidence_16_1_18_2_(note, cp) {
  const direct = Number(cp && cp.confidence);
  if (!isNaN(direct) && direct > 0) return Math.max(0, Math.min(100, direct));

  const modelScore = Number(cp && cp.modelScore);
  if (!isNaN(modelScore) && modelScore > 0) return Math.max(0, Math.min(100, modelScore));

  const n = String(note || "").toUpperCase();

  const m = n.match(/(\d{1,3})%/);
  if (m) {
    const pct = Number(m[1]);
    if (!isNaN(pct)) return Math.max(0, Math.min(100, pct));
  }

  if (n.indexOf("100%") >= 0) return 100;
  if (n.indexOf("FORTE") >= 0) return 95;
  if (n.indexOf("MÉDIO") >= 0 || n.indexOf("MEDIO") >= 0 || n.indexOf("MEDIA") >= 0 || n.indexOf("MÉDIA") >= 0) return 85;
  if (n.indexOf("FRACO") >= 0 || n.indexOf("FRACA") >= 0) return 65;

  return "";
}


function GFP_PANEL_V2_detectFaixa_16_1_18_2_(statusUpper, note, cp, confidence) {
  const cpFaixa = String(cp && cp.faixa || "").toUpperCase();
  const n = String(note || "").toUpperCase();
  const s = String(statusUpper || "").toUpperCase();

  // Ordem proposital:
  // 1) faixa explícita do metadata;
  // 2) texto visível/nota;
  // 3) status;
  // 4) confiança numérica.
  const rawPrimary = cpFaixa || "";

  if (rawPrimary.indexOf("BLOQUE") >= 0) return "BLOQUEADO";
  if (rawPrimary.indexOf("FORTE") >= 0) return "FORTE";
  if (rawPrimary.indexOf("MEDIO") >= 0 || rawPrimary.indexOf("MÉDIO") >= 0 || rawPrimary.indexOf("MEDIA") >= 0 || rawPrimary.indexOf("MÉDIA") >= 0) return "MÉDIO";
  if (rawPrimary.indexOf("FRACO") >= 0 || rawPrimary.indexOf("FRACA") >= 0) return "FRACO";
  if (rawPrimary.indexOf("BAIXO") >= 0 || rawPrimary.indexOf("BAIXA") >= 0) return "BAIXO";

  if (n.indexOf("BLOQUE") >= 0) return "BLOQUEADO";
  if (n.indexOf("FORTE") >= 0) return "FORTE";
  if (n.indexOf("MEDIO") >= 0 || n.indexOf("MÉDIO") >= 0 || n.indexOf("MEDIA") >= 0 || n.indexOf("MÉDIA") >= 0) return "MÉDIO";
  if (n.indexOf("FRACO") >= 0 || n.indexOf("FRACA") >= 0) return "FRACO";
  if (n.indexOf("BAIXO") >= 0 || n.indexOf("BAIXA") >= 0) return "BAIXO";

  if (s.indexOf("FORTE") >= 0) return "FORTE";
  if (s.indexOf("MEDIO") >= 0 || s.indexOf("MÉDIO") >= 0) return "MÉDIO";
  if (s.indexOf("FRACO") >= 0) return "FRACO";
  if (s.indexOf("BAIXO") >= 0) return "BAIXO";

  const c = Number(confidence || 0);
  if (c >= 95) return "FORTE";
  if (c >= 80) return "MÉDIO";
  if (c > 0) return "FRACO";

  return "";
}


function GFP_PANEL_V2_effectiveStatus_16_1_18_2_(statusUpper, source, faixa) {
  const s = String(statusUpper || "").toUpperCase();

  if (GFP_PANEL_V2_isResolvedStatus_(s)) return s;
  if (s === "PENDENTE_CATEGORIZADA") return s;
  if (s.indexOf("BLOQUE") >= 0) return s;

  const src = String(source || "").toUpperCase();
  const f = String(faixa || "").toUpperCase();

  const prefix = src.indexOf("MODELO") >= 0 ? "MODELO" :
                 src.indexOf("GEMINI") >= 0 ? "GEMINI" :
                 s.indexOf("MODELO_") === 0 ? "MODELO" :
                 s.indexOf("GEMINI_") === 0 ? "GEMINI" :
                 "";

  if (!prefix) return s || "PENDENTE_CATEGORIZADA";

  if (f.indexOf("FORTE") >= 0) return prefix + "_FORTE";
  if (f.indexOf("MEDIO") >= 0 || f.indexOf("MÉDIO") >= 0) return prefix + "_MEDIO";
  if (f.indexOf("FRACO") >= 0) return prefix + "_FRACO";
  if (f.indexOf("BAIXO") >= 0) return prefix + "_BAIXO";

  return s || prefix + "_FRACO";
}


function GFP_PANEL_V2_emptyStats_() {
  return {
    total: 0,
    resolved: 0,
    pending: 0,
    autoSuggestions: 0,
    manual: 0,
    readyBatch: 0,
    geminiForte: 0,
    geminiMedio: 0,
    geminiFraco: 0,
    geminiBaixo: 0,
    modeloForte: 0,
    modeloMedio: 0,
    modeloFraco: 0,
    modeloBaixo: 0,
    pendenteCategorizada: 0,
    generic: 0
  };
}

function GFP_PANEL_V2_accumulateStats_(stats, item) {
  stats.total++;

  if (item.resolved) stats.resolved++;
  else stats.pending++;

  if (item.source === "Gemini" || item.source === "Modelo") stats.autoSuggestions++;
  if (item.group === "MANUAL") stats.manual++;
  if (item.safeToBatchApprove) stats.readyBatch++;
  if (item.genericCategory) stats.generic++;

  const source = String(item.source || "").toUpperCase();
  const group = String(item.group || "").toUpperCase();

  if (source === "GEMINI" && group === "FORTE") stats.geminiForte++;
  if (source === "GEMINI" && group === "MEDIO") stats.geminiMedio++;
  if (source === "GEMINI" && group === "FRACO") stats.geminiFraco++;
  if (source === "GEMINI" && group === "BAIXO") stats.geminiBaixo++;

  if (source === "MODELO" && group === "FORTE") stats.modeloForte++;
  if (source === "MODELO" && group === "MEDIO") stats.modeloMedio++;
  if (source === "MODELO" && group === "FRACO") stats.modeloFraco++;
  if (source === "MODELO" && group === "BAIXO") stats.modeloBaixo++;

  const s = String(item.effectiveStatus || item.status || "").toUpperCase();
  if (s === "PENDENTE_CATEGORIZADA") stats.pendenteCategorizada++;
}


function GFP_PANEL_V2_loadCategories_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(GFP_PANEL_V2_CATEGORIES);
  if (!sh) return [];

  const values = sh.getDataRange().getValues();
  const set = {};

  values.forEach(row => {
    row.forEach(cell => {
      const txt = String(cell || "").trim();
      if (GFP_PANEL_V2_isCategory_(txt)) {
        set[txt] = true;
      }
    });
  });

  return Object.keys(set).sort();
}

function GFP_PANEL_V2_loadModel_(sh) {
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 20).getValues();

  return values.map(row => ({
    chave: String(row[0] || "").trim(),
    padraoOriginal: String(row[1] || "").trim(),
    conta: String(row[2] || "*").trim() || "*",
    tipo: String(row[3] || "*").trim().toUpperCase() || "*",
    categoria: String(row[4] || "").trim(),
    negadas: String(row[5] || "").split(";").map(s => s.trim()).filter(Boolean),
    acertos: Number(row[6] || 0),
    erros: Number(row[7] || 0),
    score: Number(row[8] || 0),
    faixa: String(row[9] || "").trim(),
    statusModelo: String(row[10] || "").trim(),
    origemPrincipal: String(row[11] || "").trim(),
    observacoes: String(row[18] || "").trim()
  })).filter(m => m.chave);
}

function GFP_PANEL_V2_buildDecisionNote_(action, oldItem, newCategory, comment) {
  return [
    "GFP — Painel de Revisão 2.0",
    "",
    `Ação: ${action}`,
    `Linha: ${oldItem.row}`,
    `Data: ${new Date().toISOString()}`,
    "",
    `Descrição: ${oldItem.descricao}`,
    `Valor: ${oldItem.valorFmt}`,
    `Conta: ${oldItem.conta}`,
    "",
    `Status anterior: ${oldItem.status || "(vazio)"}`,
    `Categoria anterior: ${oldItem.categoria || "(vazia)"}`,
    `Categoria final: ${newCategory || "(vazia)"}`,
    "",
    `Origem da sugestão: ${oldItem.source || ""}`,
    `Faixa: ${oldItem.faixa || ""}`,
    `Confiança: ${oldItem.confidence || ""}`,
    `Motivo: ${oldItem.reason || ""}`,
    "",
    `Comentário: ${comment || "(sem comentário)"}`
  ].join("\n");
}

function GFP_PANEL_V2_group_(statusUpper, hasCategory, generic) {
  const s = String(statusUpper || "").toUpperCase();

  if (GFP_PANEL_V2_isResolvedStatus_(s)) return "RESOLVED";

  if (s === "GEMINI_FORTE" || s === "MODELO_FORTE") return "FORTE";
  if (s === "GEMINI_MEDIO" || s === "GEMINI_MÉDIO" || s === "MODELO_MEDIO" || s === "MODELO_MÉDIO") return "MEDIO";
  if (s === "GEMINI_FRACO" || s === "MODELO_FRACO") return "FRACO";
  if (s === "GEMINI_BAIXO" || s === "MODELO_BAIXO") return "BAIXO";
  if (s.indexOf("BLOQUE") >= 0) return "BLOQUEADO";
  if (s === "PENDENTE_CATEGORIZADA") return "CATEGORIZADA";
  if (hasCategory && !generic) return "CATEGORIZADA";

  return "MANUAL";
}

function GFP_PANEL_V2_priority_(group, confidence) {
  const g = String(group || "").toUpperCase();

  if (g === "FORTE") return 10;
  if (g === "MEDIO") return 20;
  if (g === "FRACO") return 30;
  if (g === "CATEGORIZADA") return 40;
  if (g === "BAIXO") return 50;
  if (g === "BLOQUEADO") return 60;
  if (g === "MANUAL") return 70;
  if (g === "RESOLVED") return 90;

  return 99;
}

function GFP_PANEL_V2_detectSource_(statusUpper, note, cp) {
  const source = String(cp.source || "").toUpperCase();
  const s = String(statusUpper || "").toUpperCase();
  const n = String(note || "").toUpperCase();

  if (source.indexOf("MODELO") >= 0 || s.indexOf("MODELO_") === 0 || n.indexOf("MODELO") >= 0) return "Modelo";
  if (source.indexOf("GEMINI") >= 0 || s.indexOf("GEMINI_") === 0 || n.indexOf("GEMINI") >= 0) return "Gemini";
  if (s === "PENDENTE_CATEGORIZADA") return "Pendência categorizada";
  if (GFP_PANEL_V2_isResolvedStatus_(s)) return "Resolvida";

  return "Manual";
}

function GFP_PANEL_V2_detectFaixa_(statusUpper, note, cp) {
  const raw = [cp.faixa || "", statusUpper || "", note || ""].join(" ").toUpperCase();

  if (raw.indexOf("BLOQUE") >= 0) return "BLOQUEADO";
  if (raw.indexOf("FORTE") >= 0) return "FORTE";
  if (raw.indexOf("MEDIO") >= 0 || raw.indexOf("MÉDIO") >= 0 || raw.indexOf("MEDIA") >= 0 || raw.indexOf("MÉDIA") >= 0) return "MÉDIO";
  if (raw.indexOf("FRACO") >= 0 || raw.indexOf("FRACA") >= 0) return "FRACO";
  if (raw.indexOf("BAIXO") >= 0 || raw.indexOf("BAIXA") >= 0) return "BAIXO";

  return "";
}

function GFP_PANEL_V2_detectConfidence_(note, cp) {
  const fromMeta = Number(cp.confidence || cp.modelScore || 0);
  if (!isNaN(fromMeta) && fromMeta > 0) return Math.max(0, Math.min(100, fromMeta));

  const m = String(note || "").match(/(\d{1,3})%/);
  if (!m) return "";

  const n = Number(m[1]);
  if (isNaN(n)) return "";

  return Math.max(0, Math.min(100, n));
}

function GFP_PANEL_V2_isResolvedStatus_(status) {
  const s = String(status || "").trim().toUpperCase();
  return s === "OK" || s === "CONCILIADO" || s === "SPLIT" || s === "CONSOLIDADO" || s === "APROVADO";
}

function GFP_PANEL_V2_isCategory_(value) {
  return /^\d{2}\.\d{2}\s+—\s+/.test(String(value || "").trim());
}

function GFP_PANEL_V2_isGenericCategory_(category) {
  const txt = GFP_PANEL_V2_stripAccents_(String(category || "")).toUpperCase();
  return txt.indexOf("A IDENTIFICAR") >= 0 ||
         txt.indexOf("NAO IDENTIFICADA") >= 0 ||
         txt.indexOf("NAO IDENTIFICADO") >= 0 ||
         txt.indexOf("A CLASSIFICAR") >= 0 ||
         txt.indexOf("NAO CLASSIFICADA") >= 0 ||
         txt.indexOf("NAO CLASSIFICADO") >= 0;
}

function GFP_PANEL_V2_parseJson_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}

function GFP_PANEL_V2_formatDate_(value) {
  if (!value) return "";

  try {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
  } catch (e) {
    return String(value);
  }
}

function GFP_PANEL_V2_formatMoney_(value) {
  const n = Number(value || 0);
  const sign = n < 0 ? "-R$ " : "R$ ";
  return sign + Math.abs(n).toFixed(2).replace(".", ",");
}

function GFP_PANEL_V2_normText_(value) {
  return GFP_PANEL_V2_stripAccents_(String(value || "")).toUpperCase().trim();
}

function GFP_PANEL_V2_stripAccents_(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function GFP_PANEL_V2_normalizeKey_(value) {
  let txt = GFP_PANEL_V2_stripAccents_(String(value || "")).toUpperCase().trim();

  txt = txt
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]+\)/g, " ")
    .replace(/\bCOM SALDO\b/g, " ")
    .replace(/\bCOM CARTAO\b/g, " ")
    .replace(/\bCOM CARTÃO\b/g, " ")
    .replace(/\bPIX ENVIADO\s*-\s*/g, "")
    .replace(/\bPIX RECEBIDO\s*-\s*/g, "")
    .replace(/\bCOMPRA REALIZADA\s*-\s*/g, "")
    .replace(/\bCOMPRA REALIZADA\b/g, "")
    .replace(/\bPAGAMENTO REALIZADO\s*-\s*/g, "")
    .replace(/\bPAGAMENTO REALIZADO\b/g, "")
    .replace(/\bPARC\s*\d+\s*\/\s*\d+\b/g, " ")
    .replace(/\bPARCELA\s*\d+\s*\/\s*\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  txt = txt.replace(/^[\s\-–—:;.]+|[\s\-–—:;.]+$/g, "").trim();

  if (txt.length > 120) txt = txt.slice(0, 120).trim();

  return txt;
}
