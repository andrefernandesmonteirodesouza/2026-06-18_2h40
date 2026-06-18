/**
 * 📂 ARQUIVO: 4_APP/backend_review_panel_v2_filters_14_9_9.gs
 * 🔎 MÓDULO: PAINEL DE REVISÃO 2.0 — FILTROS AVANÇADOS
 * 🔢 VERSÃO: 14.9.9
 * 📅 DATA: 10/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Backend filtrado do Painel 2.0:
 * - contas/cartões múltiplos;
 * - intervalo de datas;
 * - exclusão visual de categorias 99.*;
 * - scan completo da DB_TRANSACOES, sem ficar preso ao limite do backend base.
 * -----------------------------------------------------------------------------
 */

const GFP_PANEL_V2_FILTER_PATCH_14_9_9 = "14.9.9";

/**
 * API principal filtrada do Painel V2.
 *
 * @param {Object=} filters
 */
function apiReviewPanelV2GetDataFiltered_14_9_9(filters) {
  const f = filters || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const dbName = (typeof GFP_PANEL_V2_DB !== "undefined") ? GFP_PANEL_V2_DB : "DB_TRANSACOES";
  const sh = ss.getSheetByName(dbName);

  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  if (typeof GFP_PANEL_V2_buildItem_ !== "function") {
    throw new Error("Função GFP_PANEL_V2_buildItem_ não encontrada. Mantenha o backend base do Painel V2 aplicado.");
  }

  const lastRow = sh.getLastRow();
  const categories = GFP_PANEL_V2_FILTER_loadCategories_14_9_9_();

  if (lastRow < 2) {
    return {
      patch: GFP_PANEL_V2_FILTER_PATCH_14_9_9,
      generatedAt: new Date().toISOString(),
      stats: GFP_PANEL_V2_FILTER_emptyStats_14_9_9_(),
      categories: categories,
      accounts: [],
      items: [],
      returned: 0,
      totalMatched: 0,
      hidden99: 0
    };
  }

  const query = GFP_PANEL_V2_FILTER_norm_14_9_9_(f.query || "");
  const group = String(f.group || "ALL").toUpperCase();
  const minConfidence = Number(f.minConfidence || 0);
  const limit = Math.max(1, Math.min(Number(f.limit || 80), 500));

  const accountsFilter = GFP_PANEL_V2_FILTER_normalizeAccounts_14_9_9_(f.accounts);
  const startKey = GFP_PANEL_V2_FILTER_cleanDateKey_14_9_9_(f.dateStart || "");
  const endKey = GFP_PANEL_V2_FILTER_cleanDateKey_14_9_9_(f.dateEnd || "");

  const values = sh.getRange(2, 1, lastRow - 1, 14).getValues();
  const notes = sh.getRange(2, 10, lastRow - 1, 1).getNotes();

  const allAccounts = {};
  const matched = [];
  const stats = GFP_PANEL_V2_FILTER_emptyStats_14_9_9_();

  let hidden99 = 0;

  values.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const item = GFP_PANEL_V2_buildItem_(row, notes[idx][0], rowNumber);

    item.dateKey = GFP_PANEL_V2_FILTER_dateKey_14_9_9_(row[0]);

    const resolved = GFP_PANEL_V2_FILTER_isResolved_14_9_9_(item.status);
    const movement99 = GFP_PANEL_V2_FILTER_isMovement99_14_9_9_(item);

    if (!resolved && item.conta && !movement99) {
      allAccounts[String(item.conta).trim()] = true;
    }

    if (resolved) {
      stats.resolved++;
      return;
    }

    if (movement99) {
      hidden99++;
      return;
    }

    stats.pending++;

    if (item.safeToBatchApprove) stats.readyBatch++;
    if (item.source === "Gemini" || item.source === "Modelo") stats.autoSuggestions++;
    if (item.group === "MANUAL") stats.manual++;

    if (!GFP_PANEL_V2_FILTER_matchGroup_14_9_9_(item, group)) return;
    if (!GFP_PANEL_V2_FILTER_matchConfidence_14_9_9_(item, minConfidence)) return;
    if (!GFP_PANEL_V2_FILTER_matchAccounts_14_9_9_(item, accountsFilter)) return;
    if (!GFP_PANEL_V2_FILTER_matchDate_14_9_9_(item.dateKey, startKey, endKey)) return;
    if (!GFP_PANEL_V2_FILTER_matchQuery_14_9_9_(item, query)) return;

    matched.push(item);
  });

  matched.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;

    const cb = Number(b.confidence || 0);
    const ca = Number(a.confidence || 0);

    if (cb !== ca) return cb - ca;

    if (a.dateKey !== b.dateKey) return String(a.dateKey || "").localeCompare(String(b.dateKey || ""));

    return a.row - b.row;
  });

  const accounts = Object.keys(allAccounts).sort();
  const items = matched.slice(0, limit);

  stats.total = values.length;
  stats.hidden99 = hidden99;
  stats.matched = matched.length;
  stats.returned = items.length;
  stats.accounts = accounts.length;

  return {
    patch: GFP_PANEL_V2_FILTER_PATCH_14_9_9,
    generatedAt: new Date().toISOString(),
    stats: stats,
    categories: categories,
    accounts: accounts,
    items: items,
    returned: items.length,
    totalMatched: matched.length,
    hidden99: hidden99,
    filtersEcho: {
      query: f.query || "",
      group: group,
      minConfidence: minConfidence,
      limit: limit,
      accounts: accountsFilter,
      dateStart: startKey,
      dateEnd: endKey
    }
  };
}

/**
 * Opções de filtro.
 */
function apiReviewPanelV2GetFilterOptions_14_9_9() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbName = (typeof GFP_PANEL_V2_DB !== "undefined") ? GFP_PANEL_V2_DB : "DB_TRANSACOES";
  const sh = ss.getSheetByName(dbName);

  if (!sh || sh.getLastRow() < 2) {
    return {
      patch: GFP_PANEL_V2_FILTER_PATCH_14_9_9,
      accounts: [],
      categories: GFP_PANEL_V2_FILTER_loadCategories_14_9_9_()
    };
  }

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 14).getValues();
  const notes = sh.getRange(2, 10, sh.getLastRow() - 1, 1).getNotes();
  const accounts = {};

  values.forEach((row, idx) => {
    const item = GFP_PANEL_V2_buildItem_(row, notes[idx][0], idx + 2);

    if (GFP_PANEL_V2_FILTER_isResolved_14_9_9_(item.status)) return;
    if (GFP_PANEL_V2_FILTER_isMovement99_14_9_9_(item)) return;

    const conta = String(item.conta || "").trim();
    if (conta) accounts[conta] = true;
  });

  return {
    patch: GFP_PANEL_V2_FILTER_PATCH_14_9_9,
    accounts: Object.keys(accounts).sort(),
    categories: GFP_PANEL_V2_FILTER_loadCategories_14_9_9_()
  };
}

function GFP_PANEL_V2_FILTER_emptyStats_14_9_9_() {
  return {
    total: 0,
    resolved: 0,
    pending: 0,
    matched: 0,
    returned: 0,
    readyBatch: 0,
    autoSuggestions: 0,
    manual: 0,
    hidden99: 0,
    accounts: 0
  };
}

function GFP_PANEL_V2_FILTER_loadCategories_14_9_9_() {
  if (typeof GFP_PANEL_V2_loadCategories_ === "function") {
    return GFP_PANEL_V2_loadCategories_();
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("CFG_Categorias");
  if (!sh) return [];

  const values = sh.getDataRange().getValues();
  const set = {};

  values.forEach(row => {
    row.forEach(cell => {
      const txt = String(cell || "").trim();
      if (/^\d{2}\.\d{2}\s+—\s+/.test(txt)) set[txt] = true;
    });
  });

  return Object.keys(set).sort();
}

function GFP_PANEL_V2_FILTER_normalizeAccounts_14_9_9_(accounts) {
  if (!accounts) return ["__ALL__"];

  if (typeof accounts === "string") {
    if (!accounts || accounts === "__ALL__" || accounts.toUpperCase() === "ALL") return ["__ALL__"];
    return [accounts];
  }

  if (!Array.isArray(accounts)) return ["__ALL__"];

  const cleaned = accounts.map(x => String(x || "").trim()).filter(Boolean);

  if (!cleaned.length) return ["__ALL__"];
  if (cleaned.indexOf("__ALL__") >= 0) return ["__ALL__"];

  return cleaned;
}

function GFP_PANEL_V2_FILTER_matchAccounts_14_9_9_(item, accounts) {
  if (!accounts || accounts.indexOf("__ALL__") >= 0) return true;

  const conta = String(item.conta || "").trim();

  return accounts.indexOf(conta) >= 0;
}

function GFP_PANEL_V2_FILTER_matchDate_14_9_9_(dateKey, startKey, endKey) {
  if (!startKey && !endKey) return true;

  const d = String(dateKey || "");
  if (!d) return false;

  if (startKey && d < startKey) return false;
  if (endKey && d > endKey) return false;

  return true;
}

function GFP_PANEL_V2_FILTER_matchQuery_14_9_9_(item, query) {
  if (!query) return true;

  const haystack = GFP_PANEL_V2_FILTER_norm_14_9_9_([
    item.descricao,
    item.conta,
    item.categoria,
    item.suggestedCategory,
    item.status,
    item.notas,
    item.reason,
    item.modelKey
  ].join(" "));

  return haystack.indexOf(query) >= 0;
}

function GFP_PANEL_V2_FILTER_matchGroup_14_9_9_(item, group) {
  if (!group || group === "ALL") return true;
  return String(item.group || "").toUpperCase() === group;
}

function GFP_PANEL_V2_FILTER_matchConfidence_14_9_9_(item, minConfidence) {
  if (!minConfidence) return true;

  const c = Number(item.confidence || 0);
  return c >= minConfidence;
}

function GFP_PANEL_V2_FILTER_isResolved_14_9_9_(status) {
  const s = String(status || "").trim().toUpperCase();
  return s === "OK" || s === "CONCILIADO" || s === "SPLIT" || s === "CONSOLIDADO" || s === "APROVADO";
}

function GFP_PANEL_V2_FILTER_isMovement99_14_9_9_(item) {
  const categoria = String((item && item.categoria) || "").trim();
  const sugerida = String((item && item.suggestedCategory) || "").trim();

  return /^99\./.test(categoria) || /^99\./.test(sugerida);
}

function GFP_PANEL_V2_FILTER_dateKey_14_9_9_(value) {
  if (!value) return "";

  let d;

  if (value instanceof Date) {
    d = value;
  } else {
    const s = String(value || "").trim();

    const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m1) {
      d = new Date(Number(m1[3]), Number(m1[2]) - 1, Number(m1[1]));
    } else {
      d = new Date(s);
    }
  }

  if (!d || isNaN(d.getTime())) return "";

  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function GFP_PANEL_V2_FILTER_cleanDateKey_14_9_9_(value) {
  const s = String(value || "").trim();
  if (!s) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  return GFP_PANEL_V2_FILTER_dateKey_14_9_9_(s);
}

function GFP_PANEL_V2_FILTER_norm_14_9_9_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}
