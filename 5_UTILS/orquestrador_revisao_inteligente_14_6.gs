/**
 * 📂 ARQUIVO: 5_UTILS/orquestrador_revisao_inteligente_14_6.gs
 * 🧭 MÓDULO: ORQUESTRADOR DIÁRIO DE REVISÃO INTELIGENTE
 * 🔢 VERSÃO: 14.6.1
 * 📅 DATA: 10/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Rodar a esteira de classificação/revisão em uma função única, já com
 * saneamento visual global integrado.
 * -----------------------------------------------------------------------------
 */

const GFP_ORQ_PATCH_14_6 = "14.6.1";
const GFP_ORQ_LOCK_TIMEOUT_MS_14_6 = 15000;

/**
 * DRY-RUN sem Gemini.
 */
function GFP_ROTINA_REVISAO_DIARIA_DRYRUN_14_6() {
  return GFP_ROTINA_REVISAO_DIARIA_14_6_({
    dryRun: true,
    useGemini: false,
    modeloLimit: 200,
    recalLimit: 200,
    origem: "DRYRUN_SEM_GEMINI"
  });
}

/**
 * APPLY sem Gemini.
 * Rotina recomendada para uso diário.
 */
function GFP_ROTINA_REVISAO_DIARIA_SEM_GEMINI_APPLY_14_6() {
  return GFP_ROTINA_REVISAO_DIARIA_14_6_({
    dryRun: false,
    useGemini: false,
    modeloLimit: 200,
    recalLimit: 200,
    origem: "APPLY_SEM_GEMINI"
  });
}

/**
 * DRY-RUN com Gemini.
 */
function GFP_ROTINA_REVISAO_DIARIA_COM_GEMINI_DRYRUN_14_6(geminiLimit) {
  return GFP_ROTINA_REVISAO_DIARIA_14_6_({
    dryRun: true,
    useGemini: true,
    modeloLimit: 200,
    geminiLimit: geminiLimit || 10,
    recalLimit: 200,
    origem: "DRYRUN_COM_GEMINI"
  });
}

/**
 * APPLY com Gemini.
 */
function GFP_ROTINA_REVISAO_DIARIA_COM_GEMINI_APPLY_14_6(geminiLimit) {
  return GFP_ROTINA_REVISAO_DIARIA_14_6_({
    dryRun: false,
    useGemini: true,
    modeloLimit: 200,
    geminiLimit: geminiLimit || 10,
    recalLimit: 200,
    origem: "APPLY_COM_GEMINI"
  });
}

/**
 * Alias curto para rotina diária padrão sem Gemini.
 */
function GFP_REVISAO_DIARIA_IA_14_6() {
  return GFP_ROTINA_REVISAO_DIARIA_SEM_GEMINI_APPLY_14_6();
}

/**
 * Núcleo do orquestrador.
 */
function GFP_ROTINA_REVISAO_DIARIA_14_6_(options) {
  const opt = options || {};
  const dryRun = !!opt.dryRun;
  const useGemini = !!opt.useGemini;

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(GFP_ORQ_LOCK_TIMEOUT_MS_14_6)) {
    throw new Error("Outra rotina GFP já está em execução. Tente novamente em alguns segundos.");
  }

  const startedAt = new Date();
  const steps = [];

  try {
    const before = GFP_ORQ_RESUMO_DB_TRANSACOES_14_6_();

    Logger.log(
      `[GFP_ROTINA_REVISAO_DIARIA_14_6_] Iniciando | ` +
      `dryRun=${dryRun} | useGemini=${useGemini} | origem=${opt.origem || ""}`
    );

    // 1. Modelo próprio antes do Gemini.
    GFP_ORQ_runStep_14_6_(
      steps,
      "MODELO_PRECLASSIFICADOR",
      dryRun ? "GFP_MODELO_PRECLASSIFICAR_PENDENTES_DRYRUN_14_5" : "GFP_MODELO_PRECLASSIFICAR_PENDENTES_APPLY_14_5",
      [opt.modeloLimit || 200]
    );

    // 2. Gemini fallback controlado, opcional.
    if (useGemini) {
      GFP_ORQ_runStep_14_6_(
        steps,
        "GEMINI_FALLBACK_CONTROLADO",
        dryRun ? "GFP_GEMINI_FALLBACK_DRYRUN" : "GFP_GEMINI_FALLBACK_APPLY",
        [opt.geminiLimit || 10]
      );
    } else {
      steps.push({
        step: "GEMINI_FALLBACK_CONTROLADO",
        skipped: true,
        reason: "useGemini=false"
      });
    }

    // 3. Recalibrador de sugestões pendentes.
    GFP_ORQ_runStep_14_6_(
      steps,
      "RECALIBRADOR_PENDENTES",
      dryRun ? "GFP_RECALIBRAR_SUGESTOES_PENDENTES_DRYRUN_14_4" : "GFP_RECALIBRAR_SUGESTOES_PENDENTES_APPLY_14_4",
      [opt.recalLimit || 200]
    );

    // 4. Saneamento visual global.
    // Em APPLY, compacta notas, reaplica cores, checkboxes e ordena.
    if (!dryRun) {
      if (GFP_ORQ_hasFunction_14_6_("GFP_SANEAR_VISUAL_DB_TRANSACOES_14_5_1")) {
        GFP_ORQ_runStep_14_6_(
          steps,
          "SANEAMENTO_VISUAL_GLOBAL",
          "GFP_SANEAR_VISUAL_DB_TRANSACOES_14_5_1",
          []
        );
      } else {
        // Fallback se o arquivo 14.5.1 não tiver sido criado.
        GFP_ORQ_runFallbackVisual_14_6_(steps);
      }
    } else {
      steps.push({
        step: "SANEAMENTO_VISUAL_GLOBAL",
        skipped: true,
        reason: "dryRun=true"
      });
    }

    const after = dryRun ? before : GFP_ORQ_RESUMO_DB_TRANSACOES_14_6_();

    const result = {
      patch: GFP_ORQ_PATCH_14_6,
      dryRun: dryRun,
      useGemini: useGemini,
      origem: opt.origem || "",
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      before: before,
      after: after,
      steps: steps
    };

    Logger.log("[GFP_ROTINA_REVISAO_DIARIA_14_6_] Resultado: " + JSON.stringify(result));

    if (!dryRun) {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        GFP_ORQ_toastResumo_14_6_(after),
        "GFP 14.6.1"
      );
    } else {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "Dry-run concluído. Veja o log para detalhes.",
        "GFP 14.6.1"
      );
    }

    return result;

  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

/**
 * Executa fallback visual caso o saneamento 14.5.1 não exista.
 */
function GFP_ORQ_runFallbackVisual_14_6_(steps) {
  if (GFP_ORQ_hasFunction_14_6_("GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1_1")) {
    GFP_ORQ_runStep_14_6_(steps, "CORES_VISUAIS", "GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1_1", []);
  } else {
    GFP_ORQ_runStep_14_6_(steps, "CORES_VISUAIS", "GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1", []);
  }

  GFP_ORQ_runStep_14_6_(steps, "CHECKBOX_GEMINI_MODELO", "GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1", []);
  GFP_ORQ_runStep_14_6_(steps, "CHECKBOX_PENDENCIAS_CATEGORIZADAS", "GFP_APLICAR_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1", []);
  GFP_ORQ_runStep_14_6_(steps, "ORDENADOR_DB_TRANSACOES", "GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3", []);
}

/**
 * Executa uma etapa se a função existir.
 */
function GFP_ORQ_runStep_14_6_(steps, stepName, functionName, args) {
  const started = new Date();

  try {
    if (!GFP_ORQ_hasFunction_14_6_(functionName)) {
      const skipped = {
        step: stepName,
        functionName: functionName,
        skipped: true,
        reason: "função não encontrada"
      };

      Logger.log(`[GFP 14.6.1] SKIP ${stepName}: ${functionName} não encontrada.`);
      steps.push(skipped);
      return skipped;
    }

    const fn = globalThis[functionName];
    const result = fn.apply(null, args || []);

    const out = {
      step: stepName,
      functionName: functionName,
      skipped: false,
      startedAt: started.toISOString(),
      finishedAt: new Date().toISOString(),
      result: result
    };

    Logger.log(`[GFP 14.6.1] OK ${stepName}: ${JSON.stringify(result)}`);

    steps.push(out);
    return out;

  } catch (e) {
    const out = {
      step: stepName,
      functionName: functionName,
      skipped: true,
      error: e.message,
      startedAt: started.toISOString(),
      finishedAt: new Date().toISOString()
    };

    Logger.warn(`[GFP 14.6.1] ERRO ${stepName}: ${e.message}`);

    steps.push(out);
    return out;
  }
}

/**
 * Verifica função global no Apps Script V8.
 */
function GFP_ORQ_hasFunction_14_6_(functionName) {
  return typeof globalThis !== "undefined" && typeof globalThis[functionName] === "function";
}

/**
 * Resumo operacional da DB_TRANSACOES.
 */
function GFP_ORQ_RESUMO_DB_TRANSACOES_14_6_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh) return { error: "DB_TRANSACOES não encontrada" };

  const lastRow = sh.getLastRow();

  if (lastRow < 2) return { total: 0 };

  const values = sh.getRange(2, 1, lastRow - 1, 14).getValues();

  const resumo = {
    total: values.length,
    resolvidas: 0,
    ok: 0,
    conciliado: 0,
    split: 0,
    consolidado: 0,

    geminiForte: 0,
    geminiMedio: 0,
    geminiFraco: 0,
    geminiBaixo: 0,
    geminiBloqueado: 0,

    modeloForte: 0,
    modeloMedio: 0,
    modeloFraco: 0,
    modeloBaixo: 0,
    modeloBloqueado: 0,

    pendenteCategorizada: 0,
    pendenteComCategoriaSemStatus: 0,
    pendenteSemCategoria: 0,
    categoriaGenerica: 0,
    bloqueada: 0,

    aprovaveisRapido: 0,
    precisamRevisaoManual: 0
  };

  values.forEach(row => {
    const categoria = String(row[5] || "").trim();
    const status = String(row[8] || "").trim().toUpperCase();

    const hasCategory = GFP_ORQ_isCategory_14_6_(categoria);
    const generic = GFP_ORQ_isGenericCategory_14_6_(categoria);

    if (status === "OK") resumo.ok++;
    else if (status === "CONCILIADO") resumo.conciliado++;
    else if (status === "SPLIT") resumo.split++;
    else if (status === "CONSOLIDADO" || status === "APROVADO") resumo.consolidado++;

    if (GFP_ORQ_isResolvedStatus_14_6_(status)) resumo.resolvidas++;

    if (status === "GEMINI_FORTE") resumo.geminiForte++;
    else if (status === "GEMINI_MEDIO" || status === "GEMINI_MÉDIO") resumo.geminiMedio++;
    else if (status === "GEMINI_FRACO") resumo.geminiFraco++;
    else if (status === "GEMINI_BAIXO") resumo.geminiBaixo++;
    else if (status === "GEMINI_BLOQUEADO") resumo.geminiBloqueado++;

    if (status === "MODELO_FORTE") resumo.modeloForte++;
    else if (status === "MODELO_MEDIO" || status === "MODELO_MÉDIO") resumo.modeloMedio++;
    else if (status === "MODELO_FRACO") resumo.modeloFraco++;
    else if (status === "MODELO_BAIXO") resumo.modeloBaixo++;
    else if (status === "MODELO_BLOQUEADO") resumo.modeloBloqueado++;

    if (status === "PENDENTE_CATEGORIZADA") resumo.pendenteCategorizada++;
    if (!status && hasCategory && !generic) resumo.pendenteComCategoriaSemStatus++;
    if (!GFP_ORQ_isResolvedStatus_14_6_(status) && !hasCategory) resumo.pendenteSemCategoria++;
    if (generic) resumo.categoriaGenerica++;
    if (status === "BLOQUEADA") resumo.bloqueada++;

    if (
      status === "GEMINI_FORTE" ||
      status === "GEMINI_MEDIO" ||
      status === "GEMINI_MÉDIO" ||
      status === "GEMINI_FRACO" ||
      status === "MODELO_FORTE" ||
      status === "MODELO_MEDIO" ||
      status === "MODELO_MÉDIO" ||
      status === "MODELO_FRACO" ||
      status === "PENDENTE_CATEGORIZADA"
    ) {
      resumo.aprovaveisRapido++;
    }

    if (
      !GFP_ORQ_isResolvedStatus_14_6_(status) &&
      (
        !hasCategory ||
        generic ||
        status === "GEMINI_BAIXO" ||
        status === "MODELO_BAIXO" ||
        status === "GEMINI_BLOQUEADO" ||
        status === "MODELO_BLOQUEADO" ||
        status === "BLOQUEADA"
      )
    ) {
      resumo.precisamRevisaoManual++;
    }
  });

  resumo.pendentes = resumo.total - resumo.resolvidas;

  return resumo;
}

/**
 * Função pública para ver resumo sem rodar rotina.
 */
function GFP_RESUMO_REVISAO_DB_TRANSACOES_14_6() {
  const resumo = GFP_ORQ_RESUMO_DB_TRANSACOES_14_6_();
  Logger.log("[GFP_RESUMO_REVISAO_DB_TRANSACOES_14_6] " + JSON.stringify(resumo));
  return resumo;
}

function GFP_ORQ_toastResumo_14_6_(resumo) {
  return (
    `Revisão pronta. ` +
    `Aprováveis: ${resumo.aprovaveisRapido || 0} | ` +
    `Manual: ${resumo.precisamRevisaoManual || 0} | ` +
    `Resolvidas: ${resumo.resolvidas || 0}/${resumo.total || 0}`
  );
}

function GFP_ORQ_isResolvedStatus_14_6_(status) {
  const s = String(status || "").trim().toUpperCase();

  return s === "OK" ||
         s === "CONCILIADO" ||
         s === "SPLIT" ||
         s === "CONSOLIDADO" ||
         s === "APROVADO";
}

function GFP_ORQ_isCategory_14_6_(value) {
  return /^\d{2}\.\d{2}\s+—\s+/.test(String(value || "").trim());
}

function GFP_ORQ_isGenericCategory_14_6_(category) {
  const txt = GFP_ORQ_stripAccents_14_6_(String(category || ""))
    .toUpperCase()
    .trim();

  return txt.indexOf("A IDENTIFICAR") >= 0 ||
         txt.indexOf("NAO IDENTIFICADA") >= 0 ||
         txt.indexOf("NAO IDENTIFICADO") >= 0 ||
         txt.indexOf("A CLASSIFICAR") >= 0 ||
         txt.indexOf("NAO CLASSIFICADA") >= 0 ||
         txt.indexOf("NAO CLASSIFICADO") >= 0;
}

function GFP_ORQ_stripAccents_14_6_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
