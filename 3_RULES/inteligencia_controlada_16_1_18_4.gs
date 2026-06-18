/**
 * 📂 ARQUIVO: 3_RULES/inteligencia_controlada_16_1_18_4.gs
 * 🧠 MÓDULO: INTELIGÊNCIA CONTROLADA
 * 🔢 VERSÃO: 16.1.18.4.3
 * 📅 DATA: 2026-06-18
 *
 * 📝 HISTÓRICO:
 * - 16.1.18.4   (original): Repescagem por Modelo Interno + Re-Gemini Controlado.
 * - 16.1.18.4.1: Menu de inteligência (arquivo separado).
 * - 16.1.18.4.2: Configuração de cota do Re-Gemini.
 * - 16.1.18.4.3: CORREÇÃO (André + Claude, 2026-06-18) — Bug do checkbox/validação
 *   "Inválido: o conteúdo desta célula viola a regra de validação" na coluna I
 *   (STATUS) após "Repescagem com modelo interno" e após Re-Gemini Controlado.
 *
 *   CAUSA RAIZ: GFP_REAVALIAR_DB_MODELO_INTERNO_APPLY_16_1_18_4_ e
 *   GFP_REGEMINI_CONTROLADO_APPLY_16_1_18_4_ escreviam o novo status (ex.:
 *   "MODELO_FORTE") direto na célula via setValue(), sem atualizar a regra de
 *   data validation (checkbox) instalada por GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1.
 *   Essa regra usa o status ANTIGO como "valor desmarcado"; ao trocar o texto da
 *   célula sem trocar a regra, o conteúdo deixa de corresponder a "OK" ou ao valor
 *   antigo aceito pela validação → Sheets exibe o aviso vermelho de inválido
 *   (setAllowInvalid(true) permite salvar, mas mantém o aviso visual).
 *
 *   CORREÇÃO: nova função privada GFP_INTEL_SYNC_CHECKBOX_STATUS_16_1_18_4_,
 *   chamada nos dois pontos onde a coluna I é escrita (antes linhas 310 e 537),
 *   que reaplica o checkbox com o status NOVO como valor desmarcado quando ainda
 *   elegível, ou remove a validação quando deixou de ser elegível — mantendo a
 *   célula sempre coerente com seu próprio conteúdo. Reaproveita as funções já
 *   existentes GFP_statusAprovavelPorCheckbox_14_2_1_ e GFP_isCategoriaValida_14_2_1_
 *   de aprovacao_checkbox_gemini_14_2_1.gs (nenhuma lógica duplicada).
 */

const GFP_INTEL_PATCH_16_1_18_4 = "16.1.18.4";
const GFP_INTEL_DB_16_1_18_4 = "DB_TRANSACOES";
const GFP_INTEL_MODEL_16_1_18_4 = "CFG_Modelo_Classificacao";

const GFP_REGEMINI_USED_DATE_PROP_16_1_18_4 = "GFP_REGEMINI_USED_DATE_16_1_18_4";
const GFP_REGEMINI_USED_COUNT_PROP_16_1_18_4 = "GFP_REGEMINI_USED_COUNT_16_1_18_4";
const GFP_REGEMINI_MAX_DAY_PROP_16_1_18_4 = "GFP_REGEMINI_MAX_DAY_16_1_18_4";
const GFP_REGEMINI_MAX_RUN_PROP_16_1_18_4 = "GFP_REGEMINI_MAX_RUN_16_1_18_4";


function GFP_INTELIGENCIA_STATUS_16_1_18_4() {
  const props = PropertiesService.getScriptProperties();

  return {
    ok: true,
    patch: GFP_INTEL_PATCH_16_1_18_4,
    modeloAntesGemini: String(props.getProperty("GFP_ENABLE_MODELO_PRECLASSIFICADOR_14_5") || "").toUpperCase() === "TRUE",
    geminiFallback: String(props.getProperty("GFP_ENABLE_GEMINI_FALLBACK_CONTROLADO") || "").toUpperCase() === "TRUE",
    geminiApiKeyConfigurada: !!props.getProperty("GEMINI_API_KEY"),
    reGeminiCota: GFP_REGEMINI_STATUS_COTA_16_1_18_4(),
    comandos: [
      "GFP_ATIVAR_MODELO_ANTES_GEMINI_16_1_18_4",
      "GFP_REAVALIAR_DB_MODELO_INTERNO_16_1_18_4",
      "GFP_REGEMINI_CONTROLADO_16_1_18_4",
      "GFP_REPESCAGEM_MODELO_E_GEMINI_16_1_18_4"
    ]
  };
}


function GFP_ATIVAR_MODELO_ANTES_GEMINI_16_1_18_4() {
  const props = PropertiesService.getScriptProperties();

  props.setProperty("GFP_ENABLE_MODELO_PRECLASSIFICADOR_14_5", "TRUE");

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Modelo interno antes do Gemini ativado.",
    "GFP 16.1.18.4",
    8
  );

  return GFP_INTELIGENCIA_STATUS_16_1_18_4();
}


function GFP_REGEMINI_CONFIGURAR_COTA_16_1_18_4(maxDia, maxRodada) {
  const props = PropertiesService.getScriptProperties();

  // Padrão oficial forte:
  // 99 por dia / 33 por rodada.
  // Teto defensivo:
  // até 300 por dia / 99 por rodada.
  const day = Math.max(1, Math.min(Number(maxDia) || 99, 300));
  const run = Math.max(1, Math.min(Number(maxRodada) || 33, 99));

  props.setProperty(GFP_REGEMINI_MAX_DAY_PROP_16_1_18_4, String(day));
  props.setProperty(GFP_REGEMINI_MAX_RUN_PROP_16_1_18_4, String(run));

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Re-Gemini configurado: " + run + " por rodada / " + day + " por dia.",
    "GFP 16.1.18.4.2",
    8
  );

  return GFP_REGEMINI_STATUS_COTA_16_1_18_4();
}



function GFP_REGEMINI_STATUS_COTA_16_1_18_4() {
  const props = PropertiesService.getScriptProperties();
  const today = GFP_INTEL_TODAY_KEY_16_1_18_4_();

  const storedDate = props.getProperty(GFP_REGEMINI_USED_DATE_PROP_16_1_18_4) || "";
  const used = storedDate === today
    ? Number(props.getProperty(GFP_REGEMINI_USED_COUNT_PROP_16_1_18_4) || 0)
    : 0;

  // Padrão oficial:
  // 99 por dia / 33 por rodada.
  const maxDay = Number(props.getProperty(GFP_REGEMINI_MAX_DAY_PROP_16_1_18_4) || 99);
  const maxRun = Number(props.getProperty(GFP_REGEMINI_MAX_RUN_PROP_16_1_18_4) || 33);

  return {
    date: today,
    usedToday: used,
    maxPerDay: maxDay,
    maxPerRun: maxRun,
    remainingToday: Math.max(0, maxDay - used),
    patch: "16.1.18.4.2"
  };
}



function GFP_MODELO_APRENDER_DECISOES_PAINEL_16_1_18_4(rows) {
  const rowNums = (Array.isArray(rows) ? rows : [rows])
    .map(Number)
    .filter(n => n && n >= 2);

  if (!rowNums.length) {
    return {
      ok: true,
      patch: GFP_INTEL_PATCH_16_1_18_4,
      learned: 0,
      reason: "nenhuma linha"
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const db = ss.getSheetByName(GFP_INTEL_DB_16_1_18_4);
  const model = ss.getSheetByName(GFP_INTEL_MODEL_16_1_18_4);

  if (!db) throw new Error("DB_TRANSACOES não encontrada.");
  if (!model) throw new Error("CFG_Modelo_Classificacao não encontrada.");

  if (
    typeof GFP_FEEDBACK_loadModelMap_14_2_ !== "function" ||
    typeof GFP_FEEDBACK_applyEventToModelMap_14_2_ !== "function" ||
    typeof GFP_FEEDBACK_writeModelMap_14_2_ !== "function"
  ) {
    throw new Error("Módulo modelo_feedback_14_2 não encontrado. Aplique/garanta a Fase 14.2.");
  }

  const modelMap = GFP_FEEDBACK_loadModelMap_14_2_(model);
  const events = [];
  const learnedRows = [];

  rowNums.forEach(rowNumber => {
    const row = db.getRange(rowNumber, 1, 1, 14).getValues()[0];

    const descricao = String(row[1] || "").trim();
    const tipo = String(row[3] || "").trim().toUpperCase() || "*";
    const conta = String(row[4] || "").trim() || "*";
    const categoriaFinal = String(row[5] || "").trim();
    const status = String(row[8] || "").trim().toUpperCase();
    const metaCell = db.getRange(rowNumber, 14);
    const meta = GFP_INTEL_PARSE_JSON_16_1_18_4_(metaCell.getValue());

    if (!descricao) return;
    if (status !== "OK" && status !== "CONCILIADO") return;
    if (!GFP_INTEL_IS_CATEGORY_16_1_18_4_(categoriaFinal)) return;
    if (!meta.classificationParams) meta.classificationParams = {};

    const cp = meta.classificationParams;
    if (cp.modelLearningProcessedAt) return;

    const suggested = String(cp.suggestedCategory || cp.finalCategory || "").trim();
    const same = suggested && GFP_INTEL_SAME_CATEGORY_16_1_18_4_(suggested, categoriaFinal);

    if (suggested && GFP_INTEL_IS_CATEGORY_16_1_18_4_(suggested) && !same) {
      events.push({
        type: "ERRO",
        sheetRow: rowNumber,
        descricao: descricao,
        conta: conta,
        tipo: tipo,
        categoria: suggested,
        categoriaNegada: categoriaFinal,
        origem: "PAINEL_TURBO_ERRO_16_1_18_4",
        peso: 1
      });

      events.push({
        type: "ACERTO_CORRECAO",
        sheetRow: rowNumber,
        descricao: descricao,
        conta: conta,
        tipo: tipo,
        categoria: categoriaFinal,
        categoriaNegada: suggested,
        origem: "PAINEL_TURBO_CORRECAO_16_1_18_4",
        peso: 3
      });

    } else {
      events.push({
        type: "ACERTO",
        sheetRow: rowNumber,
        descricao: descricao,
        conta: conta,
        tipo: tipo,
        categoria: categoriaFinal,
        categoriaNegada: "",
        origem: "PAINEL_TURBO_ACERTO_16_1_18_4",
        peso: suggested ? 2 : 1
      });
    }

    cp.modelLearningProcessedAt = new Date().toISOString();
    cp.modelLearningPatch = GFP_INTEL_PATCH_16_1_18_4;
    cp.modelLearningSource = "PAINEL_TURBO";
    metaCell.setValue(JSON.stringify(meta));

    learnedRows.push(rowNumber);
  });

  events.forEach(ev => GFP_FEEDBACK_applyEventToModelMap_14_2_(modelMap, ev));

  if (events.length) {
    GFP_FEEDBACK_writeModelMap_14_2_(model, modelMap);
  }

  return {
    ok: true,
    patch: GFP_INTEL_PATCH_16_1_18_4,
    inputRows: rowNums.length,
    learnedRows: learnedRows.length,
    events: events.length,
    rows: learnedRows
  };
}


function GFP_REAVALIAR_DB_MODELO_INTERNO_16_1_18_4(limit) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const db = ss.getSheetByName(GFP_INTEL_DB_16_1_18_4);
  const modelSheet = ss.getSheetByName(GFP_INTEL_MODEL_16_1_18_4);

  if (!db) throw new Error("DB_TRANSACOES não encontrada.");
  if (!modelSheet) throw new Error("CFG_Modelo_Classificacao não encontrada.");

  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(30000)) {
    throw new Error("Não foi possível obter lock para repescagem do modelo.");
  }

  try {
    return GFP_REAVALIAR_DB_MODELO_INTERNO_APPLY_16_1_18_4_(db, modelSheet, limit || 500);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


function GFP_REAVALIAR_DB_MODELO_INTERNO_APPLY_16_1_18_4_(db, modelSheet, limit) {
  if (
    typeof GFP_PREMODEL_loadModel_14_5_ !== "function" ||
    typeof GFP_PREMODEL_findBestModelMatch_14_5_ !== "function"
  ) {
    throw new Error("Módulo modelo_preclassificador_14_5 não encontrado.");
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 2000));
  const model = GFP_PREMODEL_loadModel_14_5_(modelSheet);
  const lastRow = db.getLastRow();

  if (lastRow < 2) {
    return {
      ok: true,
      patch: GFP_INTEL_PATCH_16_1_18_4,
      scanned: 0,
      updated: 0
    };
  }

  const values = db.getRange(2, 1, lastRow - 1, 14).getValues();

  let scanned = 0;
  let updated = 0;
  let skippedBetter = 0;
  const examples = [];

  for (let i = 0; i < values.length; i++) {
    if (updated >= safeLimit) break;

    const row = values[i];
    const sheetRow = i + 2;

    const descricao = String(row[1] || "").trim();
    const tipo = String(row[3] || "").trim().toUpperCase();
    const conta = String(row[4] || "").trim();
    const categoriaAtual = String(row[5] || "").trim();
    const statusAtual = String(row[8] || "").trim().toUpperCase();

    if (!GFP_INTEL_IS_REEVALUATION_CANDIDATE_16_1_18_4_(row)) continue;

    scanned++;

    const match = GFP_PREMODEL_findBestModelMatch_14_5_(model, descricao, conta, tipo);
    if (!match) continue;

    const decision = GFP_INTEL_BUILD_MODEL_DECISION_16_1_18_4_(row, sheetRow, match);

    if (!decision.shouldApply) continue;

    const oldRank = GFP_INTEL_STATUS_RANK_16_1_18_4_(statusAtual);
    const newRank = GFP_INTEL_STATUS_RANK_16_1_18_4_(decision.statusNovo);

    const shouldOverride =
      !categoriaAtual ||
      GFP_INTEL_IS_GENERIC_CATEGORY_16_1_18_4_(categoriaAtual) ||
      oldRank >= 500 ||
      newRank < oldRank ||
      (newRank <= 30 && decision.categoriaNova !== categoriaAtual);

    if (!shouldOverride) {
      skippedBetter++;
      continue;
    }

    db.getRange(sheetRow, 6).setValue(decision.categoriaNova);
    GFP_INTEL_SYNC_CHECKBOX_STATUS_16_1_18_4_(db, sheetRow, decision.statusNovo, decision.categoriaNova, tipo);
    db.getRange(sheetRow, 10).setValue(decision.noteShort).setNote(decision.noteFull);
    db.getRange(sheetRow, 14).setValue(JSON.stringify(decision.metaNova));

    updated++;

    if (examples.length < 20) {
      examples.push({
        row: sheetRow,
        oldStatus: statusAtual,
        newStatus: decision.statusNovo,
        oldCategory: categoriaAtual,
        newCategory: decision.categoriaNova,
        score: decision.score,
        matchScore: decision.matchScore
      });
    }
  }

  SpreadsheetApp.flush();

  try {
    if (typeof GFP_REORGANIZAR_MESA_DB_TRANSACOES_APPLY_16_1_18_3_ === "function") {
      GFP_REORGANIZAR_MESA_DB_TRANSACOES_APPLY_16_1_18_3_(db, {
        normalizeVisibleNotes: true,
        sort: true
      });
    }
  } catch (eSort) {
    Logger.warn("[16.1.18.4] Falha ao reorganizar mesa após modelo: " + eSort.message);
  }

  return {
    ok: true,
    patch: GFP_INTEL_PATCH_16_1_18_4,
    mode: "MODELO_INTERNO_FULL_DB",
    scanned: scanned,
    updated: updated,
    skippedBecauseExistingWasBetter: skippedBetter,
    examples: examples
  };
}


/**
 * 🛡️ CORREÇÃO 16.1.18.4.3
 *
 * Sincroniza a validação de checkbox da coluna I (STATUS) toda vez que este
 * módulo escreve um novo status diretamente. Sem isto, a regra de validação
 * instalada por GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1 continua presa ao
 * status ANTIGO e a célula passa a exibir "Inválido: o conteúdo desta célula
 * viola a regra de validação" (red border), pois o texto novo não corresponde
 * nem a "OK" nem ao valor antigo aceito pela regra.
 *
 * Comportamento:
 * - Se o novo status ainda é elegível para checkbox (GFP_statusAprovavelPorCheckbox_14_2_1_)
 *   e a categoria/tipo da linha continuam válidos, reaplica o checkbox com o
 *   status NOVO como valor desmarcado — exatamente o padrão usado em
 *   aprovacao_checkbox_gemini_14_2_1.gs, só que linha a linha.
 * - Se deixou de ser elegível, remove a validação antiga (clearDataValidations)
 *   para não deixar uma regra divergente travada na célula.
 * - Erros de validação (cosmético) nunca impedem a escrita do status real.
 *
 * @param {Sheet} sh - aba DB_TRANSACOES
 * @param {number} sheetRow - linha (1-indexed)
 * @param {string} novoStatus - novo valor de STATUS já decidido
 * @param {string} categoriaParaElegibilidade - categoria efetivamente gravada na linha
 * @param {string} tipo - tipo da transação (coluna D)
 */
function GFP_INTEL_SYNC_CHECKBOX_STATUS_16_1_18_4_(sh, sheetRow, novoStatus, categoriaParaElegibilidade, tipo) {
  try {
    const cell = sh.getRange(sheetRow, 9); // I = STATUS
    const tipoUpper = String(tipo || "").trim().toUpperCase();

    const elegivel =
      typeof GFP_statusAprovavelPorCheckbox_14_2_1_ === "function" &&
      typeof GFP_isCategoriaValida_14_2_1_ === "function" &&
      GFP_statusAprovavelPorCheckbox_14_2_1_(novoStatus) &&
      tipoUpper !== "T" &&
      tipoUpper !== "S" &&
      GFP_isCategoriaValida_14_2_1_(categoriaParaElegibilidade);

    if (elegivel) {
      const validation = SpreadsheetApp.newDataValidation()
        .requireCheckbox("OK", novoStatus)
        .setAllowInvalid(true)
        .build();

      cell.setDataValidation(validation);
      cell.setValue(novoStatus);
    } else {
      cell.clearDataValidations();
      cell.setValue(novoStatus);
    }
  } catch (eCheckbox) {
    Logger.log("[16.1.18.4.3] Falha ao sincronizar checkbox da linha " + sheetRow + ": " + eCheckbox.message);
    try { sh.getRange(sheetRow, 9).setValue(novoStatus); } catch (eFallback) {}
  }
}


function GFP_REGEMINI_CONTROLADO_16_1_18_4(limit) {
  const quota = GFP_REGEMINI_STATUS_COTA_16_1_18_4();

  if (quota.remainingToday <= 0) {
    return {
      ok: false,
      patch: GFP_INTEL_PATCH_16_1_18_4,
      skipped: true,
      reason: "Cota diária do Re-Gemini esgotada.",
      quota: quota
    };
  }

  const max = Math.min(
    Number(limit) || quota.maxPerRun || 10,
    quota.maxPerRun || 10,
    quota.remainingToday
  );

  const props = PropertiesService.getScriptProperties();

  const enabled = String(props.getProperty("GFP_ENABLE_GEMINI_FALLBACK_CONTROLADO") || "").toUpperCase() === "TRUE";
  if (!enabled) {
    throw new Error("Gemini fallback controlado está DESATIVADO. Execute GFP_ENABLE_GEMINI_FALLBACK_CONTROLADO() antes.");
  }

  const apiKey = props.getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const db = ss.getSheetByName(GFP_INTEL_DB_16_1_18_4);

  if (!db) throw new Error("DB_TRANSACOES não encontrada.");

  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(30000)) {
    throw new Error("Não foi possível obter lock para Re-Gemini controlado.");
  }

  try {
    return GFP_REGEMINI_CONTROLADO_APPLY_16_1_18_4_(db, apiKey, max);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


function GFP_REGEMINI_CONTROLADO_APPLY_16_1_18_4_(db, apiKey, safeLimit) {
  if (
    typeof GFP_getOfficialCategoriesForGemini_ !== "function" ||
    typeof GFP_callGeminiForCategorySuggestions_ !== "function" ||
    typeof GFP_getGeminiConfidenceBand_ !== "function"
  ) {
    throw new Error("Funções do gemini_fallback_controlado.gs não encontradas.");
  }

  const categories = GFP_getOfficialCategoriesForGemini_();
  if (!categories.length) throw new Error("Nenhuma categoria oficial encontrada em CFG_Categorias.");

  const lastRow = db.getLastRow();
  if (lastRow < 2) {
    return { ok: true, patch: GFP_INTEL_PATCH_16_1_18_4, candidates: 0, suggestions: 0 };
  }

  // Modelo tenta antes. Isso costuma reduzir consumo de Gemini.
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const modelSheet = ss.getSheetByName(GFP_INTEL_MODEL_16_1_18_4);
    if (modelSheet) {
      GFP_REAVALIAR_DB_MODELO_INTERNO_APPLY_16_1_18_4_(db, modelSheet, Math.max(100, safeLimit * 5));
    }
  } catch (eModelo) {
    Logger.warn("[16.1.18.4] Modelo antes do Re-Gemini falhou; seguindo controlado: " + eModelo.message);
  }

  const values = db.getRange(2, 1, lastRow - 1, 14).getValues();
  const candidates = [];

  for (let i = 0; i < values.length; i++) {
    if (candidates.length >= safeLimit) break;

    const row = values[i];
    const sheetRow = i + 2;

    if (!GFP_INTEL_IS_REGEMINI_CANDIDATE_16_1_18_4_(row)) continue;

    candidates.push({
      row: sheetRow,
      data: GFP_INTEL_FORMAT_DATE_BR_16_1_18_4_(row[0]),
      descricao: String(row[1] || "").trim(),
      valor: Number(row[2] || 0),
      tipo: String(row[3] || "").trim().toUpperCase(),
      conta: String(row[4] || "").trim(),
      categoriaAtual: String(row[5] || "").trim(),
      statusAtual: String(row[8] || "").trim().toUpperCase()
    });
  }

  if (!candidates.length) {
    return {
      ok: true,
      patch: GFP_INTEL_PATCH_16_1_18_4,
      candidates: 0,
      suggestions: 0,
      quota: GFP_REGEMINI_STATUS_COTA_16_1_18_4()
    };
  }

  const suggestions = GFP_callGeminiForCategorySuggestions_(apiKey, candidates, categories);

  const validSet = {};
  categories.forEach(c => validSet[c] = true);

  let applied = 0;
  const examples = [];

  suggestions.forEach(sug => {
    const rowNumber = Number(sug.row);
    const category = String(sug.categoria || "").trim();
    let confidence = Number(sug.confidence || 0);
    const reason = String(sug.reason || "").trim();

    if (!rowNumber || !category || !validSet[category]) return;

    const input = candidates.find(c => c.row === rowNumber);
    if (!input) return;

    if (typeof GFP_isGeminiLowInformationCategory_ === "function" && GFP_isGeminiLowInformationCategory_(category)) {
      confidence = Math.min(confidence, 59);
    }

    if (typeof GFP_isGeminiLowInformationDescription_ === "function" && GFP_isGeminiLowInformationDescription_(input.descricao)) {
      confidence = Math.min(confidence, 59);
    }

    const band = GFP_getGeminiConfidenceBand_(confidence, false);
    const newStatus = String(band.status || "").toUpperCase();
    const oldStatus = input.statusAtual;
    const oldRank = GFP_INTEL_STATUS_RANK_16_1_18_4_(oldStatus);
    const newRank = GFP_INTEL_STATUS_RANK_16_1_18_4_(newStatus);

    const oldCategory = input.categoriaAtual;

    // Modelo forte/médio não é substituído por Gemini. A casa manda.
    if (oldStatus === "MODELO_FORTE" || oldStatus === "MODELO_MEDIO") return;

    const shouldApply =
      !oldCategory ||
      GFP_INTEL_IS_GENERIC_CATEGORY_16_1_18_4_(oldCategory) ||
      oldRank >= 500 ||
      newRank < oldRank ||
      (oldStatus.indexOf("GEMINI_") === 0 && newRank <= oldRank);

    if (!shouldApply) return;

    const metaCell = db.getRange(rowNumber, 14);
    const meta = GFP_INTEL_PARSE_JSON_16_1_18_4_(metaCell.getValue());
    if (!meta.classificationParams) meta.classificationParams = {};

    const previousCp = Object.assign({}, meta.classificationParams);

    meta.classificationParams = Object.assign({}, meta.classificationParams, {
      source: "REGEMINI_CONTROLADO_16_1_18_4",
      confidence: confidence,
      faixa: band.faixa,
      status: newStatus,
      suggestedCategory: category,
      categoryWritten: !!band.shouldWriteCategory,
      reason: reason,
      suggestedAt: new Date().toISOString(),
      model: typeof GFP_GEMINI_FALLBACK_MODEL !== "undefined" ? GFP_GEMINI_FALLBACK_MODEL : "gemini",
      patch: GFP_INTEL_PATCH_16_1_18_4,
      previousBeforeReGemini: previousCp,
      reGeminiAt: new Date().toISOString()
    });

    if (band.shouldWriteCategory) {
      db.getRange(rowNumber, 6).setValue(category);
    }

    GFP_INTEL_SYNC_CHECKBOX_STATUS_16_1_18_4_(
      db,
      rowNumber,
      newStatus,
      band.shouldWriteCategory ? category : oldCategory,
      input.tipo
    );

    const note = GFP_INTEL_NOTE_SHORT_16_1_18_4_("GEMINI", newStatus, confidence);
    const noteFull = [
      "GFP — Re-Gemini Controlado",
      "",
      "Patch: " + GFP_INTEL_PATCH_16_1_18_4,
      "Status anterior: " + oldStatus,
      "Categoria anterior: " + oldCategory,
      "Status novo: " + newStatus,
      "Categoria sugerida: " + category,
      "Confiança: " + confidence + "%",
      "",
      "Motivo: " + reason,
      "",
      "Regra: Re-Gemini não substitui MODELO_FORTE/MODELO_MEDIO e respeita cota diária."
    ].join("\n");

    db.getRange(rowNumber, 10).setValue(note).setNote(noteFull);
    metaCell.setValue(JSON.stringify(meta));

    applied++;

    if (examples.length < 20) {
      examples.push({
        row: rowNumber,
        oldStatus: oldStatus,
        newStatus: newStatus,
        oldCategory: oldCategory,
        newCategory: category,
        confidence: confidence
      });
    }
  });

  GFP_REGEMINI_CONSUME_COTA_16_1_18_4_(candidates.length);

  SpreadsheetApp.flush();

  try {
    if (typeof GFP_REORGANIZAR_MESA_DB_TRANSACOES_APPLY_16_1_18_3_ === "function") {
      GFP_REORGANIZAR_MESA_DB_TRANSACOES_APPLY_16_1_18_3_(db, {
        normalizeVisibleNotes: true,
        sort: true
      });
    }
  } catch (eSort) {
    Logger.warn("[16.1.18.4] Falha ao reorganizar mesa após Re-Gemini: " + eSort.message);
  }

  return {
    ok: true,
    patch: GFP_INTEL_PATCH_16_1_18_4,
    mode: "REGEMINI_CONTROLADO",
    candidates: candidates.length,
    suggestionsReceived: Array.isArray(suggestions) ? suggestions.length : 0,
    applied: applied,
    examples: examples,
    quota: GFP_REGEMINI_STATUS_COTA_16_1_18_4()
  };
}


function GFP_REPESCAGEM_MODELO_E_GEMINI_16_1_18_4(modelLimit, geminiLimit) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const db = ss.getSheetByName(GFP_INTEL_DB_16_1_18_4);
  const modelSheet = ss.getSheetByName(GFP_INTEL_MODEL_16_1_18_4);

  if (!db) throw new Error("DB_TRANSACOES não encontrada.");
  if (!modelSheet) throw new Error("CFG_Modelo_Classificacao não encontrada.");

  const out = {
    ok: true,
    patch: GFP_INTEL_PATCH_16_1_18_4,
    model: null,
    gemini: null
  };

  out.model = GFP_REAVALIAR_DB_MODELO_INTERNO_APPLY_16_1_18_4_(
    db,
    modelSheet,
    modelLimit || 500
  );

  out.gemini = GFP_REGEMINI_CONTROLADO_16_1_18_4(geminiLimit || 10);

  return out;
}


function GFP_INTEL_BUILD_MODEL_DECISION_16_1_18_4_(row, sheetRow, match) {
  const descricao = String(row[1] || "").trim();
  const tipo = String(row[3] || "").trim().toUpperCase();
  const conta = String(row[4] || "").trim();
  const categoriaAtual = String(row[5] || "").trim();
  const statusAtual = String(row[8] || "").trim().toUpperCase();
  const meta = GFP_INTEL_PARSE_JSON_16_1_18_4_(row[13]);

  const categoriaModelo = String(match.categoria || "").trim();
  const score = Number(match.score || 0);
  const acertos = Number(match.acertos || 0);
  const erros = Number(match.erros || 0);
  const faixa = String(match.faixa || "").toUpperCase();

  if (!GFP_INTEL_IS_CATEGORY_16_1_18_4_(categoriaModelo)) {
    return { shouldApply: false, reason: "categoria modelo inválida" };
  }

  let statusNovo = "MODELO_BAIXO";

  if (score >= 95 && acertos >= 1) statusNovo = "MODELO_FORTE";
  else if (score >= 80 && acertos >= 1) statusNovo = "MODELO_MEDIO";
  else if (score >= 60 && acertos >= 1) statusNovo = "MODELO_FRACO";
  else statusNovo = "MODELO_BAIXO";

  if (statusNovo === "MODELO_BAIXO") {
    return { shouldApply: false, reason: "modelo baixo" };
  }

  if (!meta.classificationParams) meta.classificationParams = {};
  const previousCp = Object.assign({}, meta.classificationParams);

  meta.classificationParams = Object.assign({}, meta.classificationParams, {
    source: "MODELO_REPESCAGEM_16_1_18_4",
    status: statusNovo,
    confidence: score,
    faixa: faixa || GFP_INTEL_FAIXA_FROM_STATUS_16_1_18_4_(statusNovo),
    suggestedCategory: categoriaModelo,
    categoryWritten: true,
    modelKey: match.chave,
    modelScore: score,
    modelAcertos: acertos,
    modelErros: erros,
    modelMatchScore: Number(match._matchScore || 0),
    modelStatus: match.statusModelo,
    reason: "Repescagem com modelo interno. Match=" + Number(match._matchScore || 0),
    suggestedAt: new Date().toISOString(),
    patch: GFP_INTEL_PATCH_16_1_18_4,
    previousBeforeModelRecheck: previousCp
  });

  const noteShort = GFP_INTEL_NOTE_SHORT_16_1_18_4_("MODELO", statusNovo, score);

  const noteFull = [
    "GFP — Repescagem pelo Modelo Interno",
    "",
    "Patch: " + GFP_INTEL_PATCH_16_1_18_4,
    "Linha: " + sheetRow,
    "Descrição: " + descricao,
    "Conta: " + conta,
    "Tipo: " + tipo,
    "",
    "Status anterior: " + statusAtual,
    "Categoria anterior: " + categoriaAtual,
    "Status novo: " + statusNovo,
    "Categoria modelo: " + categoriaModelo,
    "Score: " + score,
    "Acertos: " + acertos,
    "Erros: " + erros,
    "Match score: " + Number(match._matchScore || 0),
    "",
    "Regra: modelo interno pode reavaliar linhas ainda não OK, inclusive já categorizadas."
  ].join("\n");

  return {
    shouldApply: true,
    row: sheetRow,
    categoriaNova: categoriaModelo,
    statusNovo: statusNovo,
    score: score,
    matchScore: Number(match._matchScore || 0),
    metaNova: meta,
    noteShort: noteShort,
    noteFull: noteFull
  };
}


function GFP_INTEL_IS_REEVALUATION_CANDIDATE_16_1_18_4_(row) {
  const descricao = String(row[1] || "").trim();
  const tipo = String(row[3] || "").trim().toUpperCase();
  const categoria = String(row[5] || "").trim();
  const status = String(row[8] || "").trim().toUpperCase();

  if (!descricao) return false;
  if (tipo === "T" || tipo === "S") return false;
  if (/^99\./.test(categoria)) return false;

  if (status === "OK" || status === "CONCILIADO" || status === "ARQUIVADO" || status === "SPLIT") return false;

  return true;
}


function GFP_INTEL_IS_REGEMINI_CANDIDATE_16_1_18_4_(row) {
  if (!GFP_INTEL_IS_REEVALUATION_CANDIDATE_16_1_18_4_(row)) return false;

  const status = String(row[8] || "").trim().toUpperCase();
  const categoria = String(row[5] || "").trim();
  const desc = String(row[1] || "").trim().toUpperCase();
  const meta = GFP_INTEL_PARSE_JSON_16_1_18_4_(row[13]);
  const cp = meta.classificationParams || {};

  if (status === "MODELO_FORTE" || status === "MODELO_MEDIO") return false;
  if (/^99\./.test(categoria)) return false;

  if (desc.indexOf("PAGAMENTO DE FATURA") >= 0) return false;
  if (desc.indexOf("FATURA PICPAY CARD") >= 0) return false;

  // Evita ficar chamando Gemini de novo na mesma linha toda hora.
  if (cp.reGeminiAt) {
    const days = GFP_INTEL_DAYS_SINCE_16_1_18_4_(cp.reGeminiAt);
    if (days !== null && days < 7) return false;
  }

  return true;
}


function GFP_INTEL_STATUS_RANK_16_1_18_4_(status) {
  const s = String(status || "").toUpperCase();

  if (s === "MODELO_FORTE") return 10;
  if (s === "GEMINI_FORTE") return 20;
  if (s === "MODELO_MEDIO") return 30;
  if (s === "GEMINI_MEDIO") return 40;
  if (s === "MODELO_FRACO") return 50;
  if (s === "GEMINI_FRACO") return 60;
  if (s === "MODELO_BAIXO" || s === "GEMINI_BAIXO" || s.indexOf("BLOQUE") >= 0) return 70;
  if (s === "PENDENTE_CATEGORIZADA") return 500;
  if (!s || s === "PENDENTE" || s === "REVISAR") return 600;
  if (s === "OK" || s === "CONCILIADO" || s === "ARQUIVADO") return 900;

  return 650;
}


function GFP_INTEL_NOTE_SHORT_16_1_18_4_(prefix, status, confidence) {
  const p = String(prefix || "").toUpperCase() === "MODELO" ? "Modelo" : "Gemini";
  const s = String(status || "").toUpperCase();
  const c = Number(confidence || 0);

  if (s.indexOf("FORTE") >= 0) return p + " FORTE " + c + "% — ver nota";
  if (s.indexOf("MEDIO") >= 0 || s.indexOf("MÉDIO") >= 0) return p + " MÉDIO " + c + "% — ver nota";
  if (s.indexOf("FRACO") >= 0) return p + " FRACO " + c + "% — ver nota";
  if (s.indexOf("BAIXO") >= 0) return p + " BAIXO — ver nota";

  return p + " — ver nota";
}


function GFP_INTEL_FAIXA_FROM_STATUS_16_1_18_4_(status) {
  const s = String(status || "").toUpperCase();

  if (s.indexOf("FORTE") >= 0) return "FORTE";
  if (s.indexOf("MEDIO") >= 0 || s.indexOf("MÉDIO") >= 0) return "MEDIA";
  if (s.indexOf("FRACO") >= 0) return "FRACA";
  return "BAIXA_NAO_PREENCHER";
}


function GFP_INTEL_IS_CATEGORY_16_1_18_4_(value) {
  return /^\d{2}\.\d{2}\s+—\s+/.test(String(value || "").trim());
}


function GFP_INTEL_IS_GENERIC_CATEGORY_16_1_18_4_(value) {
  const t = GFP_INTEL_STRIP_ACCENTS_16_1_18_4_(String(value || "")).toUpperCase();

  return t.indexOf("A IDENTIFICAR") >= 0 ||
         t.indexOf("NAO IDENTIFICADA") >= 0 ||
         t.indexOf("NAO IDENTIFICADO") >= 0;
}


function GFP_INTEL_SAME_CATEGORY_16_1_18_4_(a, b) {
  return String(a || "").trim() === String(b || "").trim();
}


function GFP_INTEL_PARSE_JSON_16_1_18_4_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}


function GFP_INTEL_STRIP_ACCENTS_16_1_18_4_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}


function GFP_INTEL_FORMAT_DATE_BR_16_1_18_4_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    const d = String(value.getDate()).padStart(2, "0");
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const y = value.getFullYear();

    return d + "/" + m + "/" + y;
  }

  return String(value || "");
}


function GFP_INTEL_TODAY_KEY_16_1_18_4_() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return y + "-" + m + "-" + day;
}


function GFP_REGEMINI_CONSUME_COTA_16_1_18_4_(qty) {
  const props = PropertiesService.getScriptProperties();
  const today = GFP_INTEL_TODAY_KEY_16_1_18_4_();

  const storedDate = props.getProperty(GFP_REGEMINI_USED_DATE_PROP_16_1_18_4) || "";
  const oldUsed = storedDate === today
    ? Number(props.getProperty(GFP_REGEMINI_USED_COUNT_PROP_16_1_18_4) || 0)
    : 0;

  props.setProperty(GFP_REGEMINI_USED_DATE_PROP_16_1_18_4, today);
  props.setProperty(GFP_REGEMINI_USED_COUNT_PROP_16_1_18_4, String(oldUsed + Math.max(0, Number(qty || 0))));
}


function GFP_INTEL_DAYS_SINCE_16_1_18_4_(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;

    return Math.floor((new Date().getTime() - d.getTime()) / 86400000);
  } catch (e) {
    return null;
  }
}