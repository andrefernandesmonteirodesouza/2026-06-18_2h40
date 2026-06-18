/**
 * =============================================================================
 * 🧼 GFP 15.9.8 — SANEAMENTO FINAL CONSERVADOR PRÉ-16.0
 * =============================================================================
 *
 * Faz saneamentos seguros sem mexer em dados transacionais.
 * =============================================================================
 */

const GFP_PRE16_SANEAMENTO_VERSION_15_9_8 = "15.9.8";

function GFP_PRE16_SANEAMENTO_FINAL_15_9_8() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const startedAt = new Date();

  const result = {
    version: GFP_PRE16_SANEAMENTO_VERSION_15_9_8,
    startedAt: startedAt.toISOString(),
    finishedAt: "",
    validationExpanded: false,
    filterReapplied: false,
    helperColumnsHidden: false,
    accountAliasesCreated: 0,
    accountAliasesAlreadyOk: 0,
    accountAliasesUnresolved: 0,
    pendingCategories: 0,
    sysLogsRowsAdded: 0,
    sysRelatoriosRowsAdded: 0,
    manualDeletionCandidates: 0,
    errors: []
  };

  GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "INICIO", "OK", "Saneamento final pré-16.0 iniciado.", {
    version: GFP_PRE16_SANEAMENTO_VERSION_15_9_8
  });

  try {
    result.validationExpanded = GFP_PRE16_EXPANDIR_VALIDACAO_CATEGORIA_15_9_8_();
    GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "VALIDACAO_CATEGORIA", "OK", "Validação de categoria ampliada/reaplicada.", {
      validationExpanded: result.validationExpanded
    });
  } catch (eVal) {
    result.errors.push("VALIDACAO_CATEGORIA: " + eVal.message);
    GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "VALIDACAO_CATEGORIA", "ERRO", eVal.message, {
      stack: eVal.stack || ""
    });
  }

  try {
    result.filterReapplied = GFP_PRE16_REAPLICAR_FILTRO_DB_15_9_8_();
    GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "FILTRO_DB_TRANSACOES", "OK", "Filtro amplo reaplicado na DB_TRANSACOES.", {
      filterReapplied: result.filterReapplied
    });
  } catch (eFilter) {
    result.errors.push("FILTRO_DB_TRANSACOES: " + eFilter.message);
    GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "FILTRO_DB_TRANSACOES", "ERRO", eFilter.message, {
      stack: eFilter.stack || ""
    });
  }

  try {
    result.helperColumnsHidden = GFP_PRE16_OCULTAR_OS_DB_15_9_8_();
    GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "OCULTAR_O_S", "OK", "Colunas auxiliares O:S garantidas como ocultas.", {
      helperColumnsHidden: result.helperColumnsHidden
    });
  } catch (eCols) {
    result.errors.push("OCULTAR_O_S: " + eCols.message);
    GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "OCULTAR_O_S", "ERRO", eCols.message, {
      stack: eCols.stack || ""
    });
  }

  try {
    const aliasResult = GFP_PRE16_VALIDAR_CRIAR_ALIASES_CONTAS_15_9_8_();

    result.accountAliasesCreated = aliasResult.created;
    result.accountAliasesAlreadyOk = aliasResult.alreadyOk;
    result.accountAliasesUnresolved = aliasResult.unresolved.length;

    GFP_PRE16_RELATORIO_15_9_8_(
      "PRE16_SANEAMENTO",
      "ALIASES_CONTAS",
      aliasResult.unresolved.length ? "ATENCAO" : "OK",
      "Validação/criação de aliases de contas finalizada.",
      aliasResult
    );

    GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "ALIASES_CONTAS", aliasResult.unresolved.length ? "ATENCAO" : "OK", "Aliases de contas processados.", aliasResult);
  } catch (eAliases) {
    result.errors.push("ALIASES_CONTAS: " + eAliases.message);
    GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "ALIASES_CONTAS", "ERRO", eAliases.message, {
      stack: eAliases.stack || ""
    });
  }

  try {
    const pending = GFP_PRE16_RELATORIO_PENDENCIAS_CATEGORIA_15_9_8_();
    result.pendingCategories = pending.total;

    GFP_PRE16_RELATORIO_15_9_8_(
      "PRE16_SANEAMENTO",
      "PENDENCIAS_CATEGORIA",
      pending.total ? "ATENCAO" : "OK",
      "Relatório final de pendências de categoria gerado.",
      pending
    );

    GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "PENDENCIAS_CATEGORIA", pending.total ? "ATENCAO" : "OK", "Pendências de categoria identificadas.", {
      total: pending.total
    });
  } catch (ePend) {
    result.errors.push("PENDENCIAS_CATEGORIA: " + ePend.message);
    GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "PENDENCIAS_CATEGORIA", "ERRO", ePend.message, {
      stack: ePend.stack || ""
    });
  }

  try {
    const deletion = GFP_PRE16_REGISTRAR_ARQUIVOS_LEGADOS_15_9_8_();

    result.manualDeletionCandidates = deletion.totalCandidates;

    GFP_PRE16_RELATORIO_15_9_8_(
      "PRE16_SANEAMENTO",
      "ARQUIVOS_LEGADOS_APPS_SCRIPT",
      "INFO",
      "Lista de arquivos-fonte legados para remoção manual registrada. Nenhum arquivo foi apagado por script.",
      deletion
    );

    GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "ARQUIVOS_LEGADOS_APPS_SCRIPT", "INFO", "Lista de remoção manual registrada.", deletion);
  } catch (eFiles) {
    result.errors.push("ARQUIVOS_LEGADOS_APPS_SCRIPT: " + eFiles.message);
    GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "ARQUIVOS_LEGADOS_APPS_SCRIPT", "ERRO", eFiles.message, {
      stack: eFiles.stack || ""
    });
  }

  result.finishedAt = new Date().toISOString();

  GFP_PRE16_RELATORIO_15_9_8_(
    "PRE16_SANEAMENTO",
    "RESUMO_FINAL_15_9_8",
    result.errors.length ? "ATENCAO" : "OK",
    "Resumo final do saneamento pré-16.0.",
    result
  );

  GFP_PRE16_LOG_15_9_8_("PRE16_SANEAMENTO", "FIM", result.errors.length ? "ATENCAO" : "OK", "Saneamento final pré-16.0 concluído.", result);

  SpreadsheetApp.getActive().toast(
    "Saneamento 15.9.8 concluído. Erros: " + result.errors.length +
    " | Pendências categoria: " + result.pendingCategories,
    "GFP 15.9.8"
  );

  return {
    ok: result.errors.length === 0,
    result: result
  };
}


/**
 * =============================================================================
 * 1) VALIDAÇÃO DE CATEGORIA
 * =============================================================================
 */

function GFP_PRE16_EXPANDIR_VALIDACAO_CATEGORIA_15_9_8_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const targetRows = Math.max(1000, sh.getMaxRows());

  if (sh.getMaxRows() < targetRows) {
    sh.insertRowsAfter(sh.getMaxRows(), targetRows - sh.getMaxRows());
  }

  const targetRange = sh.getRange(2, 6, targetRows - 1, 1); // F2:F1000+
  let validation = sh.getRange(2, 6).getDataValidation();

  if (!validation) {
    validation = GFP_PRE16_BUILD_CATEGORY_VALIDATION_15_9_8_(ss);
  }

  if (!validation) {
    throw new Error("Não foi possível localizar ou construir validação de categoria.");
  }

  targetRange.setDataValidation(validation);

  return true;
}

function GFP_PRE16_BUILD_CATEGORY_VALIDATION_15_9_8_(ss) {
  const cfg = ss.getSheetByName("CFG_Categorias");

  if (!cfg || cfg.getLastRow() < 2) return null;

  const range = GFP_PRE16_FIND_BEST_CATEGORY_RANGE_15_9_8_(cfg);

  if (!range) return null;

  return SpreadsheetApp
    .newDataValidation()
    .requireValueInRange(range, true)
    .setAllowInvalid(true)
    .build();
}

function GFP_PRE16_FIND_BEST_CATEGORY_RANGE_15_9_8_(cfg) {
  const lastRow = cfg.getLastRow();
  const lastCol = cfg.getLastColumn();

  if (lastRow < 2 || lastCol < 1) return null;

  const values = cfg.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function(v) { return GFP_PRE16_NORM_15_9_8_(v); });

  let bestCol = 1;
  let bestScore = -1;

  for (let c = 0; c < lastCol; c++) {
    let score = 0;

    const header = headers[c] || "";

    if (header.indexOf("CATEGORIA") >= 0) score += 100;
    if (header.indexOf("NOME") >= 0) score += 50;
    if (header.indexOf("DESCRICAO") >= 0) score += 30;

    for (let r = 1; r < values.length; r++) {
      const text = String(values[r][c] || "").trim();
      if (!text) continue;

      if (text.indexOf("—") >= 0 || text.indexOf("-") >= 0) score += 3;
      if (text.length >= 8) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCol = c + 1;
    }
  }

  return cfg.getRange(2, bestCol, lastRow - 1, 1);
}


/**
 * =============================================================================
 * 2) FILTRO AMPLO DB_TRANSACOES
 * =============================================================================
 */

function GFP_PRE16_REAPLICAR_FILTRO_DB_15_9_8_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const targetRows = Math.max(1000, sh.getMaxRows());

  if (sh.getMaxRows() < targetRows) {
    sh.insertRowsAfter(sh.getMaxRows(), targetRows - sh.getMaxRows());
  }

  if (sh.getLastColumn() < 19) {
    throw new Error("DB_TRANSACOES possui menos de 19 colunas. Não vou recriar filtro A:S.");
  }

  const existing = sh.getFilter();
  if (existing) existing.remove();

  sh.getRange(1, 1, targetRows, 19).createFilter();
  sh.setFrozenRows(1);

  return true;
}


/**
 * =============================================================================
 * 3) OCULTAR COLUNAS AUXILIARES O:S
 * =============================================================================
 */

function GFP_PRE16_OCULTAR_OS_DB_15_9_8_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  if (sh.getMaxColumns() < 19) return false;

  sh.hideColumns(15, 5); // O:S

  return true;
}


/**
 * =============================================================================
 * 4) ALIASES DE CONTAS
 * =============================================================================
 *
 * Conservador:
 * - NÃO altera DB_TRANSACOES;
 * - NÃO altera DB_TRANSACOES_HIST;
 * - NÃO normaliza histórico;
 * - apenas adiciona colunas de aliases no final de CFG_Contas, se necessário.
 */

function GFP_PRE16_VALIDAR_CRIAR_ALIASES_CONTAS_15_9_8_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const cfgContas = ss.getSheetByName("CFG_Contas");
  if (!cfgContas) throw new Error("CFG_Contas não encontrada.");

  const cfgCartoes = ss.getSheetByName("CFG_Cartoes");

  const contaNameCol = GFP_PRE16_FIND_NAME_COL_15_9_8_(cfgContas, ["CONTA", "NOME", "DESCRICAO"]);
  const cartaoNameCol = cfgCartoes ? GFP_PRE16_FIND_NAME_COL_15_9_8_(cfgCartoes, ["CARTAO", "CARTÃO", "CONTA", "NOME", "DESCRICAO"]) : 1;

  const aliasCols = GFP_PRE16_ENSURE_ALIAS_COLUMNS_15_9_8_(cfgContas);

  const officialAccounts = GFP_PRE16_READ_NAMES_FROM_SHEET_15_9_8_(cfgContas, contaNameCol);
  const officialCards = cfgCartoes ? GFP_PRE16_READ_NAMES_FROM_SHEET_15_9_8_(cfgCartoes, cartaoNameCol) : [];

  const usedAccounts = GFP_PRE16_COLLECT_USED_ACCOUNTS_15_9_8_(ss);

  const officialNormSet = {};
  const cardNormSet = {};
  const accountByBase = {};

  officialAccounts.forEach(function(item) {
    officialNormSet[item.norm] = true;

    const base = GFP_PRE16_ACCOUNT_BASE_15_9_8_(item.name);
    if (!accountByBase[base]) accountByBase[base] = [];
    accountByBase[base].push(item);
  });

  officialCards.forEach(function(item) {
    cardNormSet[item.norm] = true;
  });

  const created = [];
  const alreadyOk = [];
  const unresolved = [];
  const ignoredCards = [];

  usedAccounts.forEach(function(name) {
    const norm = GFP_PRE16_NORM_15_9_8_(name);

    if (!name) return;

    if (officialNormSet[norm]) {
      alreadyOk.push({ used: name, reason: "Conta já existe em CFG_Contas." });
      return;
    }

    if (cardNormSet[norm] || /CART[AÃ]O/i.test(name)) {
      ignoredCards.push({ used: name, reason: "Conta parece cartão ou já consta em CFG_Cartoes." });
      return;
    }

    const base = GFP_PRE16_ACCOUNT_BASE_15_9_8_(name);
    const candidates = accountByBase[base] || [];

    if (candidates.length === 1) {
      const official = candidates[0];

      const action = GFP_PRE16_ADD_ALIAS_TO_CFG_CONTAS_15_9_8_(
        cfgContas,
        official.row,
        aliasCols.aliasCol,
        aliasCols.aliasNormCol,
        name
      );

      if (action.created) {
        created.push({
          used: name,
          official: official.name,
          row: official.row,
          action: "ALIAS_ADICIONADO"
        });
      } else {
        alreadyOk.push({
          used: name,
          official: official.name,
          row: official.row,
          reason: "Alias já existia."
        });
      }

      return;
    }

    unresolved.push({
      used: name,
      base: base,
      candidates: candidates.map(function(c) { return c.name; }),
      reason: candidates.length ? "Mais de um candidato possível." : "Nenhum candidato claro em CFG_Contas."
    });
  });

  return {
    created: created.length,
    alreadyOk: alreadyOk.length,
    ignoredCards: ignoredCards.length,
    unresolved: unresolved,
    createdDetails: created,
    alreadyOkDetails: alreadyOk,
    ignoredCardsDetails: ignoredCards
  };
}

function GFP_PRE16_ENSURE_ALIAS_COLUMNS_15_9_8_(sh) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(v) {
    return String(v || "").trim();
  });

  let aliasCol = 0;
  let aliasNormCol = 0;

  headers.forEach(function(h, idx) {
    const n = GFP_PRE16_NORM_15_9_8_(h);

    if (n === "ALIASES" || n === "ALIAS") aliasCol = idx + 1;
    if (n === "ALIASES_NORMALIZADOS" || n === "ALIAS_NORMALIZADO") aliasNormCol = idx + 1;
  });

  let nextCol = lastCol + 1;

  if (!aliasCol) {
    aliasCol = nextCol++;
    sh.getRange(1, aliasCol).setValue("ALIASES");
  }

  if (!aliasNormCol) {
    aliasNormCol = nextCol++;
    sh.getRange(1, aliasNormCol).setValue("ALIASES_NORMALIZADOS");
  }

  sh.getRange(1, aliasCol, 1, aliasNormCol - aliasCol + 1)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  return {
    aliasCol: aliasCol,
    aliasNormCol: aliasNormCol
  };
}

function GFP_PRE16_ADD_ALIAS_TO_CFG_CONTAS_15_9_8_(sh, row, aliasCol, aliasNormCol, alias) {
  const current = String(sh.getRange(row, aliasCol).getValue() || "").trim();
  const currentNorm = String(sh.getRange(row, aliasNormCol).getValue() || "").trim();

  const parts = current
    ? current.split(";").map(function(v) { return v.trim(); }).filter(Boolean)
    : [];

  const normParts = currentNorm
    ? currentNorm.split(";").map(function(v) { return v.trim(); }).filter(Boolean)
    : [];

  const aliasNorm = GFP_PRE16_NORM_15_9_8_(alias);

  const exists = normParts.indexOf(aliasNorm) >= 0 ||
    parts.some(function(p) { return GFP_PRE16_NORM_15_9_8_(p) === aliasNorm; });

  if (exists) {
    return { created: false };
  }

  parts.push(alias);
  normParts.push(aliasNorm);

  sh.getRange(row, aliasCol).setValue(parts.join("; "));
  sh.getRange(row, aliasNormCol).setValue(normParts.join("; "));

  return { created: true };
}

function GFP_PRE16_COLLECT_USED_ACCOUNTS_15_9_8_(ss) {
  const names = {};
  ["DB_TRANSACOES", "DB_TRANSACOES_HIST"].forEach(function(sheetName) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2) return;

    const rows = sh.getLastRow() - 1;
    const values = sh.getRange(2, 5, rows, 1).getValues(); // Coluna E = CONTA

    values.forEach(function(row) {
      const name = String(row[0] || "").trim();
      if (name) names[name] = true;
    });
  });

  return Object.keys(names).sort();
}

function GFP_PRE16_READ_NAMES_FROM_SHEET_15_9_8_(sh, col) {
  const out = [];

  if (!sh || sh.getLastRow() < 2) return out;

  const values = sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues();

  values.forEach(function(row, idx) {
    const name = String(row[0] || "").trim();

    if (!name) return;

    out.push({
      name: name,
      norm: GFP_PRE16_NORM_15_9_8_(name),
      row: idx + 2
    });
  });

  return out;
}

function GFP_PRE16_FIND_NAME_COL_15_9_8_(sh, preferredHeaders) {
  const lastCol = sh.getLastColumn();

  if (lastCol < 1) return 1;

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  const preferredNorm = preferredHeaders.map(function(h) {
    return GFP_PRE16_NORM_15_9_8_(h);
  });

  for (let c = 0; c < headers.length; c++) {
    const h = GFP_PRE16_NORM_15_9_8_(headers[c]);

    if (preferredNorm.some(function(p) { return h.indexOf(p) >= 0; })) {
      return c + 1;
    }
  }

  return 1;
}

function GFP_PRE16_ACCOUNT_BASE_15_9_8_(name) {
  return GFP_PRE16_NORM_15_9_8_(name)
    .replace(/\(CONTA\)/g, "")
    .replace(/\(CARTAO\)/g, "")
    .replace(/\(CARTÃO\)/g, "")
    .replace(/\bCONTA\b/g, "")
    .replace(/\bCARTAO\b/g, "")
    .replace(/\bCARTÃO\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


/**
 * =============================================================================
 * 5) PENDÊNCIAS DE CATEGORIA
 * =============================================================================
 */

function GFP_PRE16_RELATORIO_PENDENCIAS_CATEGORIA_15_9_8_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh) throw new Error("DB_TRANSACOES não encontrada.");

  const lastRow = sh.getLastRow();
  const pending = [];

  if (lastRow >= 2) {
    const values = sh.getRange(2, 1, lastRow - 1, Math.min(14, sh.getLastColumn())).getValues();

    values.forEach(function(row, idx) {
      const category = String(row[5] || "").trim(); // F
      const desc = String(row[1] || "").trim();

      if (desc && !category) {
        pending.push({
          row: idx + 2,
          data: GFP_PRE16_FORMAT_DATE_15_9_8_(row[0]),
          descricao: row[1],
          valor: row[2],
          tipo: row[3],
          conta: row[4],
          status: row[8],
          id: row[10],
          hash: row[12]
        });
      }
    });
  }

  return {
    total: pending.length,
    sourceSheet: "DB_TRANSACOES",
    generatedAt: new Date().toISOString(),
    pending: pending
  };
}


/**
 * =============================================================================
 * 6) LISTA DE ARQUIVOS LEGADOS DO APPS SCRIPT
 * =============================================================================
 *
 * Nenhum arquivo é apagado por script.
 * Esta função apenas documenta o que pode ser deletado manualmente.
 */

function GFP_PRE16_REGISTRAR_ARQUIVOS_LEGADOS_15_9_8_() {
  const safeDeleteNow = [
    {
      file: "4_APP/backend_dashboard.gs",
      reason: "Dashboard 1.0 antigo. Menu limpo usa Dashboard 2.0. Duplicidade apiGetBalanceAudit já foi resolvida na 15.9.2.",
      condition: "Pode deletar se o menu antigo Dashboard/Gordelício não existir mais."
    },
    {
      file: "4_UI/dashboard_main.html",
      reason: "UI do Dashboard 1.0 antigo.",
      condition: "Pode deletar junto com backend_dashboard.gs."
    },
    {
      file: "4_UI/dashboard_tree.html",
      reason: "UI do Dashboard antigo openEnterpriseDashboard.",
      condition: "Pode deletar junto com backend_dashboard.gs."
    },
    {
      file: "4_APP/backend_review_panel_v2_sort_14_9_12.gs.gs",
      reason: "Ordenador intermediário do Painel 2.0 sem chamadas detectadas; fluxo atual usa filters/session/fast.",
      condition: "Pode deletar se Painel 2.0 já foi testado após 15.9.6 OK."
    },
    {
      file: "9_TEMP/hotfix_gemini_visual_notes_14_1_1.gs.gs",
      reason: "Hotfix temporário antigo.",
      condition: "Pode deletar após 15.9.6 OK."
    },
    {
      file: "9_TEMP/install_modelo_classificacao.gs.gs",
      reason: "Instalador temporário antigo.",
      condition: "Pode deletar se o modelo já está instalado e funcional."
    },
    {
      file: "teste",
      reason: "Arquivo residual sem função.",
      condition: "Pode deletar."
    }
  ];

  const conditionalDelete = [
    {
      file: "4_APP/frontend_panel.html",
      reason: "UI do Painel de Revisão 1.0 antigo.",
      condition: "Só deletar se você NÃO usa URL antiga ?page=review. Se usa, primeiro precisamos redirecionar a rota."
    }
  ];

  const doNotDeleteNow = [
    {
      file: "4_APP/backend_server.gs",
      reason: "Contém doGet/rotas de URL. Como decidimos não mexer nas URLs, não deletar agora."
    },
    {
      file: "4_APP/vision_engine.gs",
      reason: "Pode estar ligado a rotas antigas de imagem/URL."
    },
    {
      file: "4_APP/voice_engine.gs",
      reason: "Pode estar ligado a rotas antigas de voz/URL."
    },
    {
      file: "4_APP/backend_balances.gs",
      reason: "Pode sustentar Conferir Totais de Fatura / modal de saldos."
    },
    {
      file: "4_UI/modal_balances.html",
      reason: "Pode ser usado por openBalanceAudit."
    },
    {
      file: "4_APP/backend_review_panel_v2_fast_14_9_2.gs.gs",
      reason: "Ainda é dependência do commit oficial do Painel 2.0."
    },
    {
      file: "4_APP/backend_review_panel_v2_filters_14_9_9.gs.gs",
      reason: "API usada pelo frontend atual do Painel 2.0."
    },
    {
      file: "4_APP/backend_review_panel_v2_session_14_9_6.gs.gs",
      reason: "Commit oficial do Painel 2.0."
    },
    {
      file: "4_APP/frontend_panel_v2.html.html",
      reason: "UI atual do Painel 2.0."
    },
    {
      file: "4_APP/backend_dashboard_v2.gs.gs",
      reason: "Backend oficial do Dashboard 2.0."
    },
    {
      file: "4_UI/dashboard_cockpit_v2.html.html",
      reason: "UI oficial do Dashboard 2.0."
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    totalCandidates: safeDeleteNow.length + conditionalDelete.length,
    safeDeleteNow: safeDeleteNow,
    conditionalDelete: conditionalDelete,
    doNotDeleteNow: doNotDeleteNow
  };
}


/**
 * =============================================================================
 * 7) SYS_LOGS / SYS_RELATORIOS
 * =============================================================================
 */

function GFP_PRE16_LOG_15_9_8_(modulo, acao, status, detalhe, payload) {
  if (typeof GFP_SYS_LOG_15_9_7 === "function") {
    GFP_SYS_LOG_15_9_7(modulo, acao, status, detalhe, payload);
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("SYS_LOGS");

  if (!sh) {
    sh = ss.insertSheet("SYS_LOGS");
    sh.getRange(1, 1, 1, 5).setValues([[
      "TIMESTAMP",
      "MODULO",
      "ACAO",
      "STATUS",
      "DETALHE"
    ]]);
    sh.setFrozenRows(1);
  }

  sh.appendRow([
    new Date(),
    modulo || "GERAL",
    acao || "EVENTO",
    status || "INFO",
    String(detalhe || "") + (payload ? " | payload=" + GFP_PRE16_SAFE_JSON_15_9_8_(payload, 30000) : "")
  ]);
}

function GFP_PRE16_RELATORIO_15_9_8_(tipo, etapa, status, detalhe, payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

  sh.appendRow([
    new Date(),
    "GFP_15_9_8",
    "",
    tipo || "PRE16_SANEAMENTO",
    status || "INFO",
    etapa || "",
    detalhe || "",
    GFP_PRE16_SAFE_JSON_15_9_8_(payload || {}, 35000)
  ]);

  sh.getRange(1, 1, 1, header.length)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);
}


/**
 * =============================================================================
 * HELPERS
 * =============================================================================
 */

function GFP_PRE16_FORMAT_DATE_15_9_8_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }

  return String(value || "");
}

function GFP_PRE16_SAFE_JSON_15_9_8_(value, maxLen) {
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

function GFP_PRE16_NORM_15_9_8_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}
