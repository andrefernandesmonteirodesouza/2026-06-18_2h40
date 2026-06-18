/**
 * =============================================================================
 * 📂 ARQUIVO: 5_UTILS/taxonomia_saneamento_jun2026.gs
 * 🧠 MÓDULO: SANEAMENTO DE TAXONOMIA E RECLASSIFICAÇÃO CONTROLADA
 * 🔢 VERSÃO: 1.0.0 — PATCH 10
 * 📅 DATA: 08/06/2026
 * 👤 RESPONSÁVEL: André Fernandes & ChatGPT
 * =============================================================================
 *
 * 🎯 OBJETIVO
 * Corrigir o gargalo pós-importação:
 * - muitas categorias vazias;
 * - categorias sugeridas fora da CFG_Categorias;
 * - regras genéricas perigosas;
 * - excesso de chamadas Gemini.
 *
 * 🛡️ FILOSOFIA
 * Este arquivo NÃO mexe em parser, AntiDup, ID, Datalake ou onEdit.
 * Ele atua apenas em:
 * - CFG_Taxonomia;
 * - CFG_Aprendizado;
 * - DB_TRANSACOES, se você rodar a reclassificação.
 *
 * ✅ FUNÇÕES PRINCIPAIS
 *
 * 1) GFP_TAXONOMIA_PREVIEW_JUN2026()
 *    Mostra o que seria alterado, sem mexer na planilha.
 *
 * 2) GFP_TAXONOMIA_APLICAR_JUN2026()
 *    Aplica regras seguras em CFG_Taxonomia e coloca regras perigosas em quarentena.
 *
 * 3) GFP_TAXONOMIA_PREVIEW_RECLASSIFICAR_DB_JUN2026()
 *    Mostra quantas linhas da DB_TRANSACOES poderiam receber categoria.
 *
 * 4) GFP_TAXONOMIA_RECLASSIFICAR_DB_JUN2026()
 *    Preenche categoria apenas onde estiver vazia ou inválida, sem marcar OK.
 *
 * 5) GFP_GEMINI_CLASSIFICACAO_DESATIVAR()
 *    Desativa classificação Gemini em massa.
 *
 * 6) GFP_GEMINI_CLASSIFICACAO_ATIVAR()
 *    Reativa classificação Gemini em massa, se você quiser.
 *
 * =============================================================================
 */


const GFP_TAX_PATCH_VERSION_ = "PATCH_10_TAXONOMIA_JUN2026";


/**
 * =============================================================================
 * MENU OPCIONAL
 * Se quiser, execute manualmente as funções pelo Apps Script.
 * =============================================================================
 */

function GFP_TAXONOMIA_PREVIEW_JUN2026() {
  return GFP_TAXONOMIA_SANEAR_JUN2026_({ dryRun: true });
}

function GFP_TAXONOMIA_APLICAR_JUN2026() {
  return GFP_TAXONOMIA_SANEAR_JUN2026_({ dryRun: false });
}

function GFP_TAXONOMIA_PREVIEW_RECLASSIFICAR_DB_JUN2026() {
  return GFP_TAXONOMIA_RECLASSIFICAR_DB_JUN2026_({ dryRun: true });
}

function GFP_TAXONOMIA_RECLASSIFICAR_DB_JUN2026() {
  return GFP_TAXONOMIA_RECLASSIFICAR_DB_JUN2026_({ dryRun: false });
}

function GFP_GEMINI_CLASSIFICACAO_DESATIVAR() {
  PropertiesService.getScriptProperties().setProperty("GFP_ENABLE_GEMINI_CLASSIFICATION", "FALSE");
  SpreadsheetApp.getActiveSpreadsheet().toast("Gemini em massa DESATIVADO para classificação.", "GFP", 6);
  Logger.log("[GFP] Gemini em massa DESATIVADO.");
}

function GFP_GEMINI_CLASSIFICACAO_ATIVAR() {
  PropertiesService.getScriptProperties().setProperty("GFP_ENABLE_GEMINI_CLASSIFICATION", "TRUE");
  SpreadsheetApp.getActiveSpreadsheet().toast("Gemini em massa ATIVADO para classificação.", "GFP", 6);
  Logger.log("[GFP] Gemini em massa ATIVADO.");
}


/**
 * =============================================================================
 * FASE 1 — SANEAMENTO DE CFG_Taxonomia / CFG_Aprendizado
 * =============================================================================
 */

function GFP_TAXONOMIA_SANEAR_JUN2026_(options) {
  const dryRun = !!(options && options.dryRun);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const report = {
    version: GFP_TAX_PATCH_VERSION_,
    startedAt: new Date(),
    dryRun,
    officialCategoriesCount: 0,
    plannedRules: 0,
    rulesResolved: 0,
    rulesSkippedNoOfficialCategory: [],
    taxonomyInserted: [],
    taxonomyUpdated: [],
    taxonomyAlreadyOk: [],
    quarantined: [],
    errors: []
  };

  try {
    const officialCategories = GFP_loadOfficialCategories_();
    report.officialCategoriesCount = officialCategories.length;

    if (officialCategories.length === 0) {
      throw new Error("Nenhuma categoria oficial encontrada em CFG_Categorias!F2:F.");
    }

    const shTax = GFP_getOrCreateSheet_("CFG_Taxonomia", ["TERMO_CHAVE", "CATEGORIA"]);
    const shApr = GFP_getOrCreateSheet_("CFG_Aprendizado", ["DATA_TREINO", "TERMO_CHAVE", "CATEGORIA_APRENDIDA", "ORIGEM"]);
    const shQuar = GFP_getOrCreateSheet_("CFG_Taxonomia_Quarentena", [
      "DATA",
      "ORIGEM_ABA",
      "LINHA_ORIGINAL",
      "TERMO_CHAVE",
      "CATEGORIA",
      "MOTIVO",
      "PATCH"
    ]);

    const planned = GFP_getPlannedTaxonomyRules_();
    report.plannedRules = planned.length;

    const existingTaxMap = GFP_readTwoColumnMap_(shTax, 1, 2);
    const rowsToAppend = [];

    planned.forEach(rule => {
      const resolvedCategory = GFP_resolveOfficialCategory_(officialCategories, rule.categoryCandidates);

      if (!resolvedCategory) {
        report.rulesSkippedNoOfficialCategory.push({
          key: rule.key,
          candidates: rule.categoryCandidates
        });
        return;
      }

      report.rulesResolved++;

      const normalizedKey = GFP_norm_(rule.key);
      const existing = existingTaxMap[normalizedKey];

      if (existing && GFP_norm_(existing.value) === GFP_norm_(resolvedCategory)) {
        report.taxonomyAlreadyOk.push({ key: rule.key, category: resolvedCategory });
        return;
      }

      if (existing) {
        report.taxonomyUpdated.push({
          row: existing.rowIndex,
          key: rule.key,
          from: existing.value,
          to: resolvedCategory
        });

        if (!dryRun) {
          shTax.getRange(existing.rowIndex, 2).setValue(resolvedCategory);
        }
      } else {
        report.taxonomyInserted.push({ key: rule.key, category: resolvedCategory });
        rowsToAppend.push([rule.key, resolvedCategory]);
      }
    });

    if (!dryRun && rowsToAppend.length > 0) {
      shTax.getRange(shTax.getLastRow() + 1, 1, rowsToAppend.length, 2).setValues(rowsToAppend);
    }

    // Quarentena de regras genéricas perigosas.
    GFP_quarantineDangerousRules_(shTax, "CFG_Taxonomia", 1, 2, shQuar, dryRun, report);
    GFP_quarantineDangerousRules_(shApr, "CFG_Aprendizado", 2, 3, shQuar, dryRun, report);

    GFP_writeTaxonomyReport_(report);

    if (!dryRun) {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `Taxonomia saneada. Inseridas: ${report.taxonomyInserted.length} | Atualizadas: ${report.taxonomyUpdated.length}`,
        "GFP — Patch 10",
        8
      );
    }

    Logger.log(JSON.stringify(report, null, 2));
    return report;

  } catch (e) {
    report.errors.push({ message: e.message, stack: e.stack });
    GFP_writeTaxonomyReport_(report);
    Logger.error(`[GFP_TAXONOMIA_SANEAR_JUN2026_] ${e.message}`);
    throw e;
  }
}


/**
 * =============================================================================
 * FASE 2 — RECLASSIFICAÇÃO CONTROLADA DA DB_TRANSACOES
 * =============================================================================
 */

function GFP_TAXONOMIA_RECLASSIFICAR_DB_JUN2026_(options) {
  const dryRun = !!(options && options.dryRun);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const report = {
    version: GFP_TAX_PATCH_VERSION_ + "_RECLASS_DB",
    startedAt: new Date(),
    dryRun,
    checkedRows: 0,
    changedRows: 0,
    skippedStatusOk: 0,
    skippedNoMatch: 0,
    fixedInvalidCategory: 0,
    filledBlankCategory: 0,
    setTypeT: 0,
    examples: [],
    errors: []
  };

  try {
    const shDb = ss.getSheetByName("DB_TRANSACOES");
    if (!shDb || shDb.getLastRow() < 2) {
      Logger.log("[GFP] DB_TRANSACOES vazia ou inexistente.");
      return report;
    }

    const officialCategories = GFP_loadOfficialCategories_();
    const officialNormSet = new Set(officialCategories.map(c => GFP_norm_(c)));

    const classifierRules = GFP_loadClassifierRules_();
    if (classifierRules.length === 0) {
      throw new Error("Nenhuma regra de classificação encontrada em CFG_Taxonomia/CFG_Aprendizado.");
    }

    const lastRow = shDb.getLastRow();
    const lastCol = shDb.getLastColumn();

    const headers = shDb.getRange(1, 1, 1, lastCol).getValues()[0].map(h => GFP_normHeader_(h));

    const col = {
      data: headers.indexOf("DATA") + 1,
      desc: headers.indexOf("DESCRICAO") + 1,
      valor: headers.indexOf("VALOR") + 1,
      tipo: headers.indexOf("TIPO") + 1,
      conta: headers.indexOf("CONTA") + 1,
      categoria: headers.indexOf("CATEGORIA") + 1,
      status: headers.indexOf("STATUS") + 1,
      notas: headers.indexOf("NOTAS") + 1
    };

    if (!col.desc || !col.categoria || !col.tipo) {
      throw new Error("DB_TRANSACOES sem colunas obrigatórias DESCRICAO, TIPO ou CATEGORIA.");
    }

    const dataRange = shDb.getRange(2, 1, lastRow - 1, lastCol);
    const values = dataRange.getValues();

    const updates = [];

    values.forEach((row, idx) => {
      const sheetRow = idx + 2;
      report.checkedRows++;

      const desc = String(row[col.desc - 1] || "");
      const currentCategory = String(row[col.categoria - 1] || "").trim();
      const status = row[col.status - 1];

      const isOk = status === true || String(status).toUpperCase().trim() === "OK";
      if (isOk) {
        report.skippedStatusOk++;
        return;
      }

      const categoryIsBlank = currentCategory === "";
      const categoryIsInvalid = currentCategory !== "" && !officialNormSet.has(GFP_norm_(currentCategory));

      if (!categoryIsBlank && !categoryIsInvalid) {
        return;
      }

      const matched = GFP_matchDescription_(desc, classifierRules);

      if (!matched) {
        report.skippedNoMatch++;
        return;
      }

      const newCategory = matched.category;

      updates.push({
        row: sheetRow,
        desc,
        oldCategory: currentCategory,
        newCategory,
        matchedKey: matched.key,
        setTypeT: GFP_isPagamentoFaturaCategory_(newCategory)
      });

      if (categoryIsBlank) report.filledBlankCategory++;
      if (categoryIsInvalid) report.fixedInvalidCategory++;
      if (GFP_isPagamentoFaturaCategory_(newCategory)) report.setTypeT++;

      if (report.examples.length < 25) {
        report.examples.push({
          row: sheetRow,
          desc,
          from: currentCategory,
          to: newCategory,
          key: matched.key
        });
      }
    });

    report.changedRows = updates.length;

    if (!dryRun && updates.length > 0) {
      updates.forEach(u => {
        shDb.getRange(u.row, col.categoria).setValue(u.newCategory);

        if (u.setTypeT) {
          shDb.getRange(u.row, col.tipo).setValue("T");
        }

        if (col.notas) {
          const oldNote = String(shDb.getRange(u.row, col.notas).getValue() || "");
          const append = `[${GFP_formatDate_(new Date())}] Patch10: categoria por regra "${u.matchedKey}".`;
          shDb.getRange(u.row, col.notas).setValue(oldNote ? oldNote + "\n" + append : append);
        }
      });

      SpreadsheetApp.getActiveSpreadsheet().toast(
        `Reclassificação concluída: ${updates.length} linhas alteradas.`,
        "GFP — Patch 10",
        8
      );
    }

    GFP_writeTaxonomyReport_(report);
    Logger.log(JSON.stringify(report, null, 2));
    return report;

  } catch (e) {
    report.errors.push({ message: e.message, stack: e.stack });
    GFP_writeTaxonomyReport_(report);
    Logger.error(`[GFP_TAXONOMIA_RECLASSIFICAR_DB_JUN2026_] ${e.message}`);
    throw e;
  }
}


/**
 * =============================================================================
 * REGRAS PLANEJADAS
 * =============================================================================
 */

function GFP_getPlannedTaxonomyRules_() {
  return [
    // -------------------------------------------------------------------------
    // FATURAS / MOVIMENTAÇÕES TÉCNICAS
    // -------------------------------------------------------------------------
    {
      key: "FATURA PICPAY CARD",
      categoryCandidates: [
        "99.02 — Movimentação — Faturas — Pagamento de Fatura",
        "Pagamento de Fatura"
      ]
    },
    {
      key: "PAGAMENTO REALIZADO - FATURA PICPAY CARD",
      categoryCandidates: [
        "99.02 — Movimentação — Faturas — Pagamento de Fatura",
        "Pagamento de Fatura"
      ]
    },

    // -------------------------------------------------------------------------
    // YAN — REGRA SEGURA APENAS DIRECIONAL
    // Não usar "YAN" isolado.
    // -------------------------------------------------------------------------
    {
      key: "PIX RECEBIDO - YAN VITOR FIGUEIRA MONTEIRO",
      categoryCandidates: [
        "01.01 — Receitas — Salariais — Salário Yan",
        "Salário Yan"
      ]
    },

    // -------------------------------------------------------------------------
    // MORADIA / CONTAS DE CONSUMO
    // -------------------------------------------------------------------------
    {
      key: "ENEL",
      categoryCandidates: [
        "02.01 — Despesas — Moradia — Energia Elétrica",
        "Energia Elétrica"
      ]
    },
    {
      key: "AMPLA",
      categoryCandidates: [
        "02.01 — Despesas — Moradia — Energia Elétrica",
        "Energia Elétrica"
      ]
    },
    {
      key: "ÁGUAS DE NITERÓI",
      categoryCandidates: [
        "02.01 — Despesas — Moradia — Água",
        "Água"
      ]
    },
    {
      key: "AGUAS DE NITEROI",
      categoryCandidates: [
        "02.01 — Despesas — Moradia — Água",
        "Água"
      ]
    },

    // -------------------------------------------------------------------------
    // ALIMENTAÇÃO — SUPERMERCADO
    // -------------------------------------------------------------------------
    {
      key: "SUPERMERCADO",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Supermercado",
        "Supermercado"
      ]
    },
    {
      key: "MUNDIAL",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Supermercado",
        "Supermercado"
      ]
    },
    {
      key: "GUANABARA",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Supermercado",
        "Supermercado"
      ]
    },
    {
      key: "ASSAI",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Supermercado",
        "Supermercado"
      ]
    },
    {
      key: "ASSAÍ",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Supermercado",
        "Supermercado"
      ]
    },
    {
      key: "ATACADAO",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Supermercado",
        "Supermercado"
      ]
    },
    {
      key: "ATACADÃO",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Supermercado",
        "Supermercado"
      ]
    },
    {
      key: "ZONA SUL",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Supermercado",
        "Supermercado"
      ]
    },
    {
      key: "SUPERMERCADO REAL",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Supermercado",
        "Supermercado"
      ]
    },

    // -------------------------------------------------------------------------
    // ALIMENTAÇÃO — RESTAURANTE / LANCHONETE / CAFÉ
    // -------------------------------------------------------------------------
    {
      key: "MCDONALD",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Lanchonete / Café / Refeições"
      ]
    },
    {
      key: "MEGAMATTE",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Lanchonete / Café / Refeições"
      ]
    },
    {
      key: "DELIRIO TROPICAL",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Lanchonete / Café / Refeições"
      ]
    },
    {
      key: "DELÍRIO TROPICAL",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Lanchonete / Café / Refeições"
      ]
    },

    // -------------------------------------------------------------------------
    // ALIMENTAÇÃO — PADARIA / DIA A DIA
    // -------------------------------------------------------------------------
    {
      key: "PADARIA",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Padaria / Dia a dia"
      ]
    },

    // -------------------------------------------------------------------------
    // DELIVERY — manter separado quando o nome do fornecedor indicar app.
    // -------------------------------------------------------------------------
    {
      key: "IFD",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Delivery",
        "Delivery"
      ]
    },
    {
      key: "IFOOD",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Delivery",
        "Delivery"
      ]
    },
    {
      key: "RAPPI",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Delivery",
        "Delivery"
      ]
    },
    {
      key: "99FOOD",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Delivery",
        "Delivery"
      ]
    },
        {
      key: "99 FOOD",
      categoryCandidates: [
        "02.02 — Despesas — Alimentação — Delivery",
        "Delivery"
      ]
    },
    // -------------------------------------------------------------------------
    // FARMÁCIA / SAÚDE
    // -------------------------------------------------------------------------
    {
      key: "DROGARIA",
      categoryCandidates: [
        "02.04 — Despesas — Saúde — Farmácia / Remédios",
        "Farmácia",
        "Medicamentos"
      ]
    },
    {
      key: "FARMACIA",
      categoryCandidates: [
        "02.04 — Despesas — Saúde — Farmácia / Remédios",
        "Farmácia",
        "Medicamentos"
      ]
    },
    {
      key: "FARMÁCIA",
      categoryCandidates: [
        "02.04 — Despesas — Saúde — Farmácia / Remédios",
        "Farmácia",
        "Medicamentos"
      ]
    },
    {
      key: "DROGARIA VENANCIO",
      categoryCandidates: [
        "02.04 — Despesas — Saúde — Farmácia / Remédios",
        "Farmácia",
        "Medicamentos"
      ]
    },
    {
      key: "VENANCIO",
      categoryCandidates: [
        "02.04 — Despesas — Saúde — Farmácia / Remédios",
        "Farmácia",
        "Medicamentos"
      ]
    },
    {
      key: "DROGASIL",
      categoryCandidates: [
        "02.04 — Despesas — Saúde — Farmácia / Remédios",
        "Farmácia",
        "Medicamentos"
      ]
    },
    {
      key: "DROGA RAIA",
      categoryCandidates: [
        "02.04 — Despesas — Saúde — Farmácia / Remédios",
        "Farmácia",
        "Medicamentos"
      ]
    },
    {
      key: "PACHECO",
      categoryCandidates: [
        "02.04 — Despesas — Saúde — Farmácia / Remédios",
        "Farmácia",
        "Medicamentos"
      ]
    },
    {
      key: "POROS PSICOLOGIA",
      categoryCandidates: [
        "02.04 — Despesas — Saúde — Terapia / Psicólogo / Fisioterapia"
      ]
    },

    // -------------------------------------------------------------------------
    // TRANSPORTE
    // -------------------------------------------------------------------------
    {
      key: "UBER",
      categoryCandidates: [
        "02.03 — Despesas — Transporte — Uber / 99 / Táxi"
      ]
    },
    {
      key: "99APP",
      categoryCandidates: [
        "02.03 — Despesas — Transporte — Uber / 99 / Táxi"
      ]
    },
    {
      key: "99 APP",
      categoryCandidates: [
        "02.03 — Despesas — Transporte — Uber / 99 / Táxi"
      ]
    },
    {
      key: "POSTO",
      categoryCandidates: [
        "02.03 — Despesas — Transporte — Combustível",
        "Combustível"
      ]
    },
    {
      key: "IPIRANGA",
      categoryCandidates: [
        "02.03 — Despesas — Transporte — Combustível",
        "Combustível"
      ]
    },
    {
      key: "SHELL",
      categoryCandidates: [
        "02.03 — Despesas — Transporte — Combustível",
        "Combustível"
      ]
    },
    {
      key: "PETROBRAS",
      categoryCandidates: [
        "02.03 — Despesas — Transporte — Combustível",
        "Combustível"
      ]
    },
    {
      key: "DETRAN",
      categoryCandidates: [
        "02.03 — Despesas — Transporte — IPVA / Licenciamento",
        "IPVA / Licenciamento"
      ]
    },

    // -------------------------------------------------------------------------
    // PETS
    // -------------------------------------------------------------------------
    {
      key: "PET CENTER",
      categoryCandidates: [
        "02.10 — Despesas — Pets (Leozinho) — Ração / Petiscos",
        "Pet",
        "Pets"
      ]
    },
    {
      key: "PETZ",
      categoryCandidates: [
        "02.10 — Despesas — Pets (Leozinho) — Ração / Petiscos",
        "Pet",
        "Pets"
      ]
    },
    {
      key: "COBASI",
      categoryCandidates: [
        "02.10 — Despesas — Pets (Leozinho) — Ração / Petiscos",
        "Pet",
        "Pets"
      ]
    },

    // -------------------------------------------------------------------------
    // ASSINATURAS / SERVIÇOS DIGITAIS
    // -------------------------------------------------------------------------
    {
      key: "OPENAI",
      categoryCandidates: [
        "02.14 — Despesas — Profissionais — Assinaturas"
      ]
    },
    {
      key: "CHATGPT",
      categoryCandidates: [
        "02.14 — Despesas — Profissionais — Assinaturas"
      ]
    },
    {
      key: "NETFLIX",
      categoryCandidates: [
        "02.05 — Despesas — Lazer — Streamings",
        "Streamings",
        "Assinaturas"
      ]
    },
    {
      key: "SPOTIFY",
      categoryCandidates: [
        "02.05 — Despesas — Lazer — Streamings",
        "Streamings",
        "Assinaturas"
      ]
    },
    {
      key: "YOUTUBE",
      categoryCandidates: [
        "02.05 — Despesas — Lazer — Streamings",
        "Streamings",
        "Assinaturas"
      ]
    },

    // -------------------------------------------------------------------------
    // IMPOSTOS / ENCARGOS
    // -------------------------------------------------------------------------
    {
      key: "IOF",
      categoryCandidates: [
        "02.16 — Despesas — Impostos — Impostos em Geral"
      ]
    },
    {
      key: "JUROS",
      categoryCandidates: [
        "02.08 — Despesas — Financeiro — Juros / Encargos",
        "Juros",
        "Encargos Financeiros"
      ]
    }

    // IMPORTANTE:
    // "TARIFA" foi propositalmente removido.
    // É amplo demais e deve ser classificado manualmente para o sistema aprender.
  ];
}



/**
 * =============================================================================
 * HELPERS — CATEGORIAS / REGRAS / MATCH
 * =============================================================================
 */

function GFP_loadOfficialCategories_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("CFG_Categorias");

  if (!sh || sh.getLastRow() < 2) return [];

  const values = sh.getRange(2, 6, sh.getLastRow() - 1, 1).getValues()
    .flat()
    .map(v => String(v || "").trim())
    .filter(Boolean);

  return [...new Set(values)];
}

function GFP_resolveOfficialCategory_(officialCategories, candidates) {
  const official = officialCategories || [];
  const normToOriginal = {};

  official.forEach(cat => {
    normToOriginal[GFP_norm_(cat)] = cat;
  });

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const candNorm = GFP_norm_(cand);

    if (normToOriginal[candNorm]) return normToOriginal[candNorm];

    const exactContains = official.find(cat => GFP_norm_(cat).includes(candNorm));
    if (exactContains) return exactContains;

    const tokens = candNorm.split(" ").filter(t => t.length >= 4);
    if (tokens.length > 0) {
      const tokenMatch = official.find(cat => {
        const catNorm = GFP_norm_(cat);
        return tokens.every(t => catNorm.includes(t));
      });

      if (tokenMatch) return tokenMatch;
    }
  }

  return "";
}

function GFP_loadClassifierRules_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const official = GFP_loadOfficialCategories_();
  const officialNormSet = new Set(official.map(c => GFP_norm_(c)));

  const rules = [];

  const addRulesFromSheet = (sheetName, keyCol, valCol) => {
    const sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2) return;

    const data = sh.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const key = String(data[i][keyCol - 1] || "").trim();
      const cat = String(data[i][valCol - 1] || "").trim();

      if (!key || !cat) continue;
      if (GFP_isDangerousGenericKey_(key)) continue;
      if (!officialNormSet.has(GFP_norm_(cat))) continue;

      rules.push({
        key,
        keyNorm: GFP_norm_(key),
        category: cat,
        source: sheetName,
        length: GFP_norm_(key).length
      });
    }
  };

  addRulesFromSheet("CFG_Taxonomia", 1, 2);
  addRulesFromSheet("CFG_Aprendizado", 2, 3);

  rules.sort((a, b) => b.length - a.length);

  return rules;
}

function GFP_matchDescription_(description, rules) {
  const descNorm = GFP_norm_(description);
  const compact = descNorm.replace(/\s+/g, "");

  const hasIfoodSignal =
    descNorm.includes("IFD ") ||
    descNorm.includes(" IFD") ||
    compact.includes("IFD") ||
    descNorm.includes("IFOOD") ||
    compact.includes("IFOOD");

  /**
   * EXCEÇÕES POR NATUREZA DO GASTO
   * Antes de jogar tudo de IFD/IFOOD para Delivery, verificamos se existe
   * uma natureza mais forte e segura na descrição.
   */

  // PET: iFood entregando produto de pet shop continua sendo despesa de PET.
  if (hasIfoodSignal) {
    const petKeys = ["PET CENTER", "PETZ", "COBASI"];

    for (let i = 0; i < petKeys.length; i++) {
      if (descNorm.includes(GFP_norm_(petKeys[i]))) {
        const petRule = rules.find(r => GFP_norm_(r.key) === GFP_norm_(petKeys[i]));
        if (petRule) return petRule;
      }
    }
  }

  /**
   * PRIORIDADE ABSOLUTA — DELIVERY DE ALIMENTAÇÃO
   *
   * Se não caiu em exceção de natureza, aí sim:
   * IFD / IFOOD / RAPPI / 99FOOD entram como Alimentação — Delivery.
   *
   * Importante:
   * - 99APP continua transporte.
   * - Só 99FOOD / 99 FOOD entra como delivery.
   * - ZE DELIVERY não entra aqui por decisão do André.
   */
  const priorityKeys = [];

  if (hasIfoodSignal) {
    priorityKeys.push("IFD", "IFOOD");
  }

  if (descNorm.includes("RAPPI") || compact.includes("RAPPI")) {
    priorityKeys.push("RAPPI");
  }

  if (
    descNorm.includes("99 FOOD") ||
    descNorm.includes("99FOOD") ||
    compact.includes("99FOOD")
  ) {
    priorityKeys.push("99FOOD", "99 FOOD");
  }

  for (let p = 0; p < priorityKeys.length; p++) {
    const target = GFP_norm_(priorityKeys[p]);
    const priorityRule = rules.find(r => GFP_norm_(r.key) === target);
    if (priorityRule) return priorityRule;
  }

  // Fluxo normal: regra mais longa/mais específica vence.
  for (let i = 0; i < rules.length; i++) {
    if (descNorm.includes(rules[i].keyNorm)) {
      return rules[i];
    }
  }

  return null;
}



function GFP_isPagamentoFaturaCategory_(category) {
  const c = GFP_norm_(category);
  return c.includes("PAGAMENTO DE FATURA") || (c.includes("FATURAS") && c.includes("PAGAMENTO"));
}


/**
 * =============================================================================
 * HELPERS — QUARENTENA
 * =============================================================================
 */

function GFP_quarantineDangerousRules_(sheet, sheetName, keyCol, categoryCol, quarantineSheet, dryRun, report) {
  if (!sheet || sheet.getLastRow() < 2) return;

  const data = sheet.getDataRange().getValues();
  const rowsToDelete = [];

  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][keyCol - 1] || "").trim();
    const category = String(data[i][categoryCol - 1] || "").trim();

    if (!key) continue;

    if (GFP_isDangerousGenericKey_(key)) {
      const item = {
        sheetName,
        row: i + 1,
        key,
        category,
        reason: "Regra genérica perigosa — pode classificar fluxos opostos ou movimentações amplas."
      };

      report.quarantined.push(item);

      if (!dryRun) {
        quarantineSheet.appendRow([
          new Date(),
          sheetName,
          i + 1,
          key,
          category,
          item.reason,
          GFP_TAX_PATCH_VERSION_
        ]);
        rowsToDelete.push(i + 1);
      }
    }
  }

  if (!dryRun) {
    rowsToDelete.sort((a, b) => b - a).forEach(row => {
      sheet.deleteRow(row);
    });
  }
}

function GFP_isDangerousGenericKey_(key) {
  const k = GFP_norm_(key);

  const dangerous = new Set([
    "YAN",
    "YAN VITOR",
    "YAN VITOR FIGUEIRA MONTEIRO",
    "ANDRE",
    "ANDRE FERNANDES",
    "ANDRE FERNANDES MONTEIRO DE SOUZA",
    "PIX",
    "PIX ENVIADO",
    "PIX RECEBIDO",
    "PAGAMENTO",
    "PAGAMENTO REALIZADO",
    "COMPRA",
    "COMPRA REALIZADA",
    "TRANSFERENCIA",
    "TRANSFERENCIA PIX",
    "TRANSFERENCIA PIX ENVIADA",
    "TRANSFERENCIA PIX RECEBIDA"
  ]);

  return dangerous.has(k);
}


/**
 * =============================================================================
 * HELPERS — PLANILHA / LOG
 * =============================================================================
 */

function GFP_getOrCreateSheet_(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(sheetName);

  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1C4587").setFontColor("#FFFFFF");
  }

  return sh;
}

function GFP_readTwoColumnMap_(sheet, keyCol, valCol) {
  const map = {};

  if (!sheet || sheet.getLastRow() < 2) return map;

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][keyCol - 1] || "").trim();
    const value = String(data[i][valCol - 1] || "").trim();

    if (key) {
      map[GFP_norm_(key)] = {
        rowIndex: i + 1,
        key,
        value
      };
    }
  }

  return map;
}

function GFP_writeTaxonomyReport_(report) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = GFP_getOrCreateSheet_("SYS_TAXONOMIA_REPORT", [
    "DATA",
    "PATCH",
    "DRY_RUN",
    "TIPO",
    "JSON"
  ]);

  sh.appendRow([
    new Date(),
    report.version || GFP_TAX_PATCH_VERSION_,
    !!report.dryRun,
    report.version || "",
    JSON.stringify(report)
  ]);
}

function GFP_norm_(value) {
  return String(value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function GFP_normHeader_(value) {
  return GFP_norm_(value)
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function GFP_formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}


/**
 * =============================================================================
 * FIM DO ARQUIVO
 * =============================================================================
 */
