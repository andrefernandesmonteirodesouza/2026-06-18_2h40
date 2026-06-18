/**
 * 📂 ARQUIVO: 3_RULES/sync_aprendizado_modelo_16_1_18_23.gs
 * 🧠 MÓDULO: SINCRONIZADOR CFG_APRENDIZADO → CFG_MODELO_CLASSIFICACAO
 * 🔢 VERSÃO: 16.1.18.23
 * 📅 DATA: 18/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Fazer a ponte segura entre:
 *
 *   CFG_Aprendizado
 *        ↓
 *   CFG_Modelo_Classificacao
 *
 * PRINCÍPIO:
 * - NÃO mexe na DB_TRANSACOES.
 * - NÃO mexe na DB_TRANSACOES_HIST.
 * - NÃO mexe em importação.
 * - NÃO mexe em Gemini.
 * - NÃO mexe em DRE/Dashboard.
 * - NÃO mexe no Painel de Revisão.
 *
 * O módulo apenas lê aprendizados já registrados e transforma em eventos de
 * ACERTO para o modelo interno, usando a mesma estrutura do módulo
 * modelo_feedback_14_2.gs.
 *
 * USO:
 *   1) GFP_SYNC_APRENDIZADO_MODELO_DRYRUN_16_1_18_23()
 *   2) Conferir retorno/log.
 *   3) GFP_SYNC_APRENDIZADO_MODELO_APPLY_16_1_18_23()
 * -----------------------------------------------------------------------------
 */

const GFP_SYNC_AM_VERSION_16_1_18_23 = "16.1.18.23";
const GFP_SYNC_AM_LEARN_SHEET_16_1_18_23 = "CFG_Aprendizado";
const GFP_SYNC_AM_MODEL_SHEET_16_1_18_23 = "CFG_Modelo_Classificacao";
const GFP_SYNC_AM_CATEGORIES_SHEET_16_1_18_23 = "CFG_Categorias";
const GFP_SYNC_AM_SOURCE_16_1_18_23 = "CFG_APRENDIZADO_SYNC_16_1_18_23";

/**
 * DRY-RUN: simula a sincronização sem gravar nada.
 *
 * @param {number=} limit Limite de linhas da CFG_Aprendizado a examinar. Padrão: 500.
 */
function GFP_SYNC_APRENDIZADO_MODELO_DRYRUN_16_1_18_23(limit) {
  return GFP_SYNC_APRENDIZADO_MODELO_RUN_16_1_18_23_(limit || 500, true);
}

/**
 * APPLY: grava os aprendizados elegíveis na CFG_Modelo_Classificacao.
 *
 * @param {number=} limit Limite de linhas da CFG_Aprendizado a examinar. Padrão: 500.
 */
function GFP_SYNC_APRENDIZADO_MODELO_APPLY_16_1_18_23(limit) {
  return GFP_SYNC_APRENDIZADO_MODELO_RUN_16_1_18_23_(limit || 500, false);
}

/**
 * Runner principal.
 */
function GFP_SYNC_APRENDIZADO_MODELO_RUN_16_1_18_23_(limit, dryRun) {
  const fn = "GFP_SYNC_APRENDIZADO_MODELO_RUN_16_1_18_23_";

  GFP_SYNC_AM_REQUIRE_DEPENDENCIES_16_1_18_23_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const learn = ss.getSheetByName(GFP_SYNC_AM_LEARN_SHEET_16_1_18_23);
  if (!learn) throw new Error("Aba CFG_Aprendizado não encontrada.");

  const model = ss.getSheetByName(GFP_SYNC_AM_MODEL_SHEET_16_1_18_23);
  if (!model) throw new Error("Aba CFG_Modelo_Classificacao não encontrada.");

  const validCategories = GFP_SYNC_AM_LOAD_VALID_CATEGORIES_16_1_18_23_(ss);

  const lastRow = learn.getLastRow();
  if (lastRow < 2) {
    return {
      ok: true,
      dryRun: !!dryRun,
      scanned: 0,
      eligible: 0,
      actions: 0,
      appliedEvents: 0,
      message: "CFG_Aprendizado sem dados."
    };
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 5000));
  const width = Math.max(4, learn.getLastColumn());
  const values = learn.getRange(1, 1, Math.min(lastRow, safeLimit + 1), width).getValues();

  const headers = GFP_SYNC_AM_MAP_HEADERS_16_1_18_23_(values[0]);
  const dataRows = values.slice(1);

  const modelMap = GFP_FEEDBACK_loadModelMap_14_2_(model);

  const groups = {};
  const skipped = {
    empty: 0,
    invalidCategory: 0,
    categoryNotInCfg: 0,
    badKey: 0,
    alreadySynced: 0
  };

  let scanned = 0;
  let eligible = 0;

  dataRows.forEach(function(row, idx) {
    scanned++;

    const sheetRow = idx + 2;

    const termoOriginal = String(row[headers.termo] || "").trim();
    const categoria = String(row[headers.categoria] || "").trim();
    const origem = String(row[headers.origem] || "").trim();
    const dataTreino = row[headers.data] || "";

    if (!termoOriginal || !categoria) {
      skipped.empty++;
      return;
    }

    if (!GFP_FEEDBACK_isCategory_14_2_(categoria)) {
      skipped.invalidCategory++;
      return;
    }

    if (validCategories.size && !validCategories.has(categoria)) {
      skipped.categoryNotInCfg++;
      return;
    }

    const chave = GFP_SYNC_AM_SMART_KEY_16_1_18_23_(termoOriginal);

    if (!chave || !GFP_SYNC_AM_IS_GOOD_KEY_16_1_18_23_(chave)) {
      skipped.badKey++;
      return;
    }

    // A CFG_Aprendizado não guarda conta/tipo de forma confiável.
    // Usamos "*" para criar uma regra geral, compatível com o preclassificador.
    const conta = "*";
    const tipo = "*";

    const modelKey = GFP_FEEDBACK_buildModelKey_14_2_(chave, conta, tipo, categoria);

    if (!groups[modelKey]) {
      groups[modelKey] = {
        modelKey: modelKey,
        chave: chave,
        conta: conta,
        tipo: tipo,
        categoria: categoria,
        count: 0,
        rows: [],
        examples: [],
        origins: {},
        firstDate: dataTreino || "",
        lastDate: dataTreino || ""
      };
    }

    const g = groups[modelKey];

    g.count++;
    g.rows.push(sheetRow);

    if (termoOriginal && g.examples.indexOf(termoOriginal) < 0) {
      g.examples.push(termoOriginal);
    }

    if (origem) {
      g.origins[origem] = (g.origins[origem] || 0) + 1;
    }

    g.lastDate = dataTreino || g.lastDate;

    eligible++;
  });

  const actions = [];

  Object.keys(groups).forEach(function(modelKey) {
    const g = groups[modelKey];
    const existing = modelMap[modelKey];

    const alreadySynced = existing && existing.origens
      ? Number(existing.origens[GFP_SYNC_AM_SOURCE_16_1_18_23] || 0)
      : 0;

    const pending = Math.max(0, Number(g.count || 0) - alreadySynced);

    if (pending <= 0) {
      skipped.alreadySynced++;
      return;
    }

    actions.push({
      action: existing ? "UPDATE" : "CREATE",
      chave: g.chave,
      conta: g.conta,
      tipo: g.tipo,
      categoria: g.categoria,
      ocorrenciasNaCfgAprendizado: g.count,
      jaSincronizadas: alreadySynced,
      eventosParaAplicar: pending,
      linhasCfgAprendizado: g.rows.slice(0, 20),
      exemplos: g.examples.slice(0, 5),
      origensCfgAprendizado: GFP_SYNC_AM_OBJECT_TO_TEXT_16_1_18_23_(g.origins)
    });
  });

  actions.sort(function(a, b) {
    if (b.eventosParaAplicar !== a.eventosParaAplicar) {
      return b.eventosParaAplicar - a.eventosParaAplicar;
    }

    return String(a.chave || "").localeCompare(String(b.chave || ""));
  });

  let appliedEvents = 0;

  if (!dryRun && actions.length) {
    actions.forEach(function(a) {
      for (let i = 0; i < a.eventosParaAplicar; i++) {
        const rowRef = a.linhasCfgAprendizado[i] || a.linhasCfgAprendizado[0] || 0;

        GFP_FEEDBACK_applyEventToModelMap_14_2_(modelMap, {
          type: "ACERTO",
          sheetRow: "CFG_Aprendizado!" + rowRef,
          descricao: a.chave,
          conta: a.conta,
          tipo: a.tipo,
          categoria: a.categoria,
          categoriaNegada: "",
          origem: GFP_SYNC_AM_SOURCE_16_1_18_23,
          peso: 1
        });

        appliedEvents++;
      }
    });

    GFP_FEEDBACK_writeModelMap_14_2_(model, modelMap);
  }

  const out = {
    ok: true,
    dryRun: !!dryRun,
    version: GFP_SYNC_AM_VERSION_16_1_18_23,
    scanned: scanned,
    eligible: eligible,
    groups: Object.keys(groups).length,
    actions: actions.length,
    appliedEvents: appliedEvents,
    skipped: skipped,
    examples: actions.slice(0, 30)
  };

  const logMsg =
    "Sync CFG_Aprendizado → CFG_Modelo_Classificacao " +
    (dryRun ? "DRYRUN" : "APPLY") +
    " | lidas=" + scanned +
    " | elegiveis=" + eligible +
    " | grupos=" + Object.keys(groups).length +
    " | acoes=" + actions.length +
    " | eventosAplicados=" + appliedEvents;

  // GFP 16.1.18.23B — relatório visual:
  // cria/atualiza uma aba temporária de conferência para o DRYRUN/APPLY.
  // Não mexe em DB_TRANSACOES, HIST, DRE, Dashboard, importação ou modelo além do APPLY.
  GFP_SYNC_AM_WRITE_REPORT_16_1_18_23_(ss, out);

  GFP_SYNC_AM_LOG_16_1_18_23_(dryRun ? "INFO" : "OK", "Aprendizado", logMsg);

  Logger.log(JSON.stringify(out, null, 2));

  return out;
}

/**
 * Verifica dependências do módulo de feedback/modelo.
 */
function GFP_SYNC_AM_REQUIRE_DEPENDENCIES_16_1_18_23_() {
  const required = [
    "GFP_FEEDBACK_loadModelMap_14_2_",
    "GFP_FEEDBACK_applyEventToModelMap_14_2_",
    "GFP_FEEDBACK_writeModelMap_14_2_",
    "GFP_FEEDBACK_buildModelKey_14_2_",
    "GFP_FEEDBACK_isCategory_14_2_",
    "GFP_FEEDBACK_normalizeKey_14_2_"
  ];

  const missing = required.filter(function(name) {
    return typeof this[name] !== "function";
  }, this);

  if (missing.length) {
    throw new Error(
      "Dependências do modelo não encontradas: " + missing.join(", ") +
      ". Verifique se 3_RULES/modelo_feedback_14_2.gs está no projeto."
    );
  }
}

/**
 * Mapeia cabeçalhos da CFG_Aprendizado.
 */
function GFP_SYNC_AM_MAP_HEADERS_16_1_18_23_(headerRow) {
  const normalized = headerRow.map(function(h) {
    return GFP_SYNC_AM_STRIP_ACCENTS_16_1_18_23_(String(h || ""))
      .toUpperCase()
      .trim();
  });

  function find(names, fallback) {
    for (let i = 0; i < normalized.length; i++) {
      if (names.indexOf(normalized[i]) >= 0) return i;
    }

    return fallback;
  }

  return {
    data: find(["DATA_TREINO", "DATA", "CRIADO_EM"], 0),
    termo: find(["TERMO_CHAVE", "PADRAO_ORIGINAL", "DESCRICAO", "DESCRICAO_ORIGINAL"], 1),
    categoria: find(["CATEGORIA_APRENDIDA", "CATEGORIA", "CATEGORIA_SUGERIDA"], 2),
    origem: find(["ORIGEM", "FONTE"], 3)
  };
}

/**
 * Carrega categorias válidas da CFG_Categorias.
 *
 * Faz varredura ampla porque algumas versões da aba podem ter colunas auxiliares.
 */
function GFP_SYNC_AM_LOAD_VALID_CATEGORIES_16_1_18_23_(ss) {
  const set = new Set();

  const sh = ss.getSheetByName(GFP_SYNC_AM_CATEGORIES_SHEET_16_1_18_23);
  if (!sh) return set;

  const values = sh.getDataRange().getValues();

  values.forEach(function(row) {
    row.forEach(function(cell) {
      const txt = String(cell || "").trim();

      if (GFP_FEEDBACK_isCategory_14_2_(txt)) {
        set.add(txt);
      }
    });
  });

  return set;
}

/**
 * Normalização inteligente, mas conservadora.
 *
 * Importante:
 * - usa a normalização oficial do modelo 14.2;
 * - remove ruídos que atrapalham generalização;
 * - NÃO tenta inventar regex/padrão avançado que o preclassificador atual não entende.
 */
function GFP_SYNC_AM_SMART_KEY_16_1_18_23_(value) {
  let txt = GFP_FEEDBACK_normalizeKey_14_2_(value);

  txt = GFP_SYNC_AM_STRIP_ACCENTS_16_1_18_23_(txt)
    .toUpperCase()
    .trim();

  if (!txt) return "";

  txt = txt
    // Ruído comum de iFood/Intermediadores. Mantemos o lojista.
    .replace(/^IFD[\s\*]+/g, "")
    .replace(/^IFOOD[\s\*]+/g, "")

    // Parcelamento colado no nome, ex.: DROGARIA TAMOIPARC01/03.
    .replace(/PARC\s*\d{1,2}\s*\/\s*\d{1,2}/g, " ")
    .replace(/PARC\d{1,2}\s*\/\s*\d{1,2}/g, " ")

    // Parcelamento textual residual.
    .replace(/PARCELA\s*\d{1,2}\s*\/\s*\d{1,2}/g, " ")

    // Limpeza visual.
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:;.]+|[\s\-–—:;.]+$/g, "")
    .trim();

  if (txt.length > 120) txt = txt.slice(0, 120).trim();

  return txt;
}

/**
 * Evita mandar lixo/genérico demais para o modelo.
 */
function GFP_SYNC_AM_IS_GOOD_KEY_16_1_18_23_(key) {
  const txt = String(key || "").trim().toUpperCase();

  if (!txt) return false;
  if (txt.length < 4) return false;
  if (/^\d+$/.test(txt)) return false;

  const blacklist = [
    "PIX",
    "PAGAMENTO",
    "COMPRA",
    "CARTAO",
    "CARTÃO",
    "COM SALDO",
    "COM CARTAO",
    "COM CARTÃO",
    "LANÇAMENTO",
    "LANCAMENTO"
  ];

  if (blacklist.indexOf(txt) >= 0) return false;

  // Muito genérico para classificar sozinho.
  const tooGeneric = [
    "DROGARIA",
    "FARMACIA",
    "FARMÁCIA",
    "SUPERMERCADO",
    "PADARIA",
    "UBER",
    "IFOOD",
    "IFD",
    "PIX ENVIADO",
    "PIX RECEBIDO",
    "FATURA"
  ];

  if (tooGeneric.indexOf(txt) >= 0) return false;

  return true;
}

function GFP_SYNC_AM_OBJECT_TO_TEXT_16_1_18_23_(obj) {
  obj = obj || {};

  return Object.keys(obj)
    .sort(function(a, b) {
      return Number(obj[b] || 0) - Number(obj[a] || 0);
    })
    .map(function(k) {
      return k + " (" + obj[k] + ")";
    })
    .join("; ");
}

function GFP_SYNC_AM_STRIP_ACCENTS_16_1_18_23_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function GFP_SYNC_AM_LOG_16_1_18_23_(level, area, message) {
  try {
    if (typeof GFP_LOG_HUMANO_APPEND_16_1_4_ === "function") {
      GFP_LOG_HUMANO_APPEND_16_1_4_(level, area, message, "");
      return;
    }
  } catch (e) {}

  try {
    Logger.log("[" + level + "] " + area + " — " + message);
  } catch (ignore) {}
}

/**
 * GFP 16.1.18.23B — Relatório visual do sync.
 *
 * Cria/atualiza a aba SYS_SYNC_APRENDIZADO_MODELO para permitir conferência
 * humana antes de aplicar a sincronização.
 */
/**
 * GFP 16.1.18.23C — Relatório visual do sync.
 *
 * Cria/atualiza a aba SYS_SYNC_APRENDIZADO_MODELO para permitir conferência
 * humana antes de aplicar a sincronização.
 *
 * Correção 23C:
 * Todas as linhas do relatório são normalizadas para 11 colunas antes do
 * setValues(), evitando erro quando o cabeçalho/resumo tem menos colunas
 * que a tabela de detalhes.
 */
function GFP_SYNC_AM_WRITE_REPORT_16_1_18_23_(ss, out) {
  const sheetName = "SYS_SYNC_APRENDIZADO_MODELO";
  const totalCols = 11;

  let sh = ss.getSheetByName(sheetName);

  if (!sh) {
    sh = ss.insertSheet(sheetName);
  }

  sh.clear();

  const rows = [];

  rows.push(["RELATÓRIO", "Sync CFG_Aprendizado → CFG_Modelo_Classificacao"]);
  rows.push(["Versão", out.version || GFP_SYNC_AM_VERSION_16_1_18_23]);
  rows.push(["Modo", out.dryRun ? "DRYRUN / SIMULAÇÃO" : "APPLY / GRAVAÇÃO"]);
  rows.push(["Executado em", new Date()]);
  rows.push(["Lidas", out.scanned || 0]);
  rows.push(["Elegíveis", out.eligible || 0]);
  rows.push(["Grupos", out.groups || 0]);
  rows.push(["Ações", out.actions || 0]);
  rows.push(["Eventos aplicados", out.appliedEvents || 0]);
  rows.push(["Ignoradas vazias", out.skipped && out.skipped.empty || 0]);
  rows.push(["Ignoradas categoria inválida", out.skipped && out.skipped.invalidCategory || 0]);
  rows.push(["Ignoradas fora CFG_Categorias", out.skipped && out.skipped.categoryNotInCfg || 0]);
  rows.push(["Ignoradas chave ruim/genérica", out.skipped && out.skipped.badKey || 0]);
  rows.push(["Ignoradas já sincronizadas", out.skipped && out.skipped.alreadySynced || 0]);
  rows.push(["", ""]);

  rows.push([
    "AÇÃO",
    "CHAVE_NORMALIZADA",
    "CONTA",
    "TIPO",
    "CATEGORIA",
    "OCORRÊNCIAS CFG_APRENDIZADO",
    "JÁ SINCRONIZADAS",
    "EVENTOS A APLICAR",
    "LINHAS CFG_APRENDIZADO",
    "EXEMPLOS",
    "ORIGENS"
  ]);

  const examples = out.examples || [];

  examples.forEach(function(a) {
    rows.push([
      a.action || "",
      a.chave || "",
      a.conta || "",
      a.tipo || "",
      a.categoria || "",
      a.ocorrenciasNaCfgAprendizado || 0,
      a.jaSincronizadas || 0,
      a.eventosParaAplicar || 0,
      (a.linhasCfgAprendizado || []).join(", "),
      (a.exemplos || []).join(" | "),
      a.origensCfgAprendizado || ""
    ]);
  });

  // GFP 16.1.18.23C — normaliza todas as linhas para 11 colunas.
  // Isso permite misturar linhas de resumo com tabela detalhada no mesmo setValues().
  const normalizedRows = rows.map(function(row) {
    const safe = (row || []).slice(0, totalCols);

    while (safe.length < totalCols) {
      safe.push("");
    }

    return safe;
  });

  sh.getRange(1, 1, normalizedRows.length, totalCols).setValues(normalizedRows);

  sh.getRange(1, 1, 1, totalCols).setFontWeight("bold");
  sh.getRange(16, 1, 1, totalCols).setFontWeight("bold");
  sh.setFrozenRows(16);
  sh.autoResizeColumns(1, totalCols);

  try {
    sh.getRange("A:A").setWrap(true);
    sh.getRange("B:B").setWrap(true);
    sh.getRange("E:E").setWrap(true);
    sh.getRange("I:I").setWrap(true);
    sh.getRange("J:J").setWrap(true);
    sh.getRange("K:K").setWrap(true);
  } catch (eWrap) {}

  try {
    sh.activate();
  } catch (eActivate) {}
}