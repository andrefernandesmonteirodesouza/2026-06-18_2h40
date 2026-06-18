/**
 * 📂 ARQUIVO: 3_RULES/recalibrador_auto_pos_feedback_14_4_1.gs
 * 🧠 MÓDULO: AUTOMAÇÃO DO RECALIBRADOR PÓS-FEEDBACK
 * 🔢 VERSÃO: 14.4.1
 * 📅 DATA: 10/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Acionar automaticamente o recalibrador 14.4 depois que o modelo aprende
 * com aprovações/correções.
 * -----------------------------------------------------------------------------
 */

const GFP_RECAL_AUTO_PROP_14_4_1 = "GFP_RECALIBRADOR_AUTO_POS_FEEDBACK_14_4_1";
const GFP_RECAL_AUTO_LAST_RUN_PROP_14_4_1 = "GFP_RECALIBRADOR_AUTO_LAST_RUN_14_4_1";

// Limite padrão de linhas recalibradas por ciclo automático.
const GFP_RECAL_AUTO_DEFAULT_LIMIT_14_4_1 = 100;

// Evita recalibrar muitas vezes em sequência quando o usuário está clicando rápido.
// Valor em segundos.
const GFP_RECAL_AUTO_MIN_INTERVAL_SECONDS_14_4_1 = 10;


/**
 * Liga o recalibrador automático pós-feedback.
 */
function GFP_ENABLE_RECALIBRADOR_AUTO_POS_FEEDBACK_14_4_1() {
  PropertiesService.getScriptProperties().setProperty(GFP_RECAL_AUTO_PROP_14_4_1, "TRUE");

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Recalibrador automático pós-feedback ATIVADO.",
    "GFP 14.4.1"
  );

  Logger.log("[GFP_ENABLE_RECALIBRADOR_AUTO_POS_FEEDBACK_14_4_1] Ativado.");

  return {
    enabled: true,
    property: GFP_RECAL_AUTO_PROP_14_4_1
  };
}


/**
 * Desliga o recalibrador automático pós-feedback.
 */
function GFP_DISABLE_RECALIBRADOR_AUTO_POS_FEEDBACK_14_4_1() {
  PropertiesService.getScriptProperties().setProperty(GFP_RECAL_AUTO_PROP_14_4_1, "FALSE");

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Recalibrador automático pós-feedback DESATIVADO.",
    "GFP 14.4.1"
  );

  Logger.log("[GFP_DISABLE_RECALIBRADOR_AUTO_POS_FEEDBACK_14_4_1] Desativado.");

  return {
    enabled: false,
    property: GFP_RECAL_AUTO_PROP_14_4_1
  };
}


/**
 * Consulta status do automático.
 */
function GFP_STATUS_RECALIBRADOR_AUTO_POS_FEEDBACK_14_4_1() {
  const props = PropertiesService.getScriptProperties();

  const enabled = String(props.getProperty(GFP_RECAL_AUTO_PROP_14_4_1) || "").toUpperCase() === "TRUE";
  const lastRun = props.getProperty(GFP_RECAL_AUTO_LAST_RUN_PROP_14_4_1) || "";

  return {
    enabled: enabled,
    property: GFP_RECAL_AUTO_PROP_14_4_1,
    lastRun: lastRun,
    minIntervalSeconds: GFP_RECAL_AUTO_MIN_INTERVAL_SECONDS_14_4_1
  };
}


/**
 * Chamável pelo Patch 14.2 após feedback.
 *
 * @param {number=} limit Quantidade máxima de mudanças no recalibrador.
 * @param {string=} origem Origem do chamado.
 */
function GFP_RECALIBRAR_MAYBE_AUTO_POS_FEEDBACK_14_4_1(limit, origem) {
  const fn = "GFP_RECALIBRAR_MAYBE_AUTO_POS_FEEDBACK_14_4_1";
  const props = PropertiesService.getScriptProperties();

  const enabled = String(props.getProperty(GFP_RECAL_AUTO_PROP_14_4_1) || "").toUpperCase() === "TRUE";

  if (!enabled) {
    Logger.log(`[${fn}] Automático desativado. Origem=${origem || ""}`);
    return {
      skipped: true,
      reason: "disabled",
      origem: origem || ""
    };
  }

  if (typeof GFP_RECALIBRAR_SUGESTOES_PENDENTES_APPLY_14_4 !== "function") {
    Logger.warn(`[${fn}] Recalibrador 14.4 não encontrado.`);
    return {
      skipped: true,
      reason: "GFP_RECALIBRAR_SUGESTOES_PENDENTES_APPLY_14_4 não encontrada",
      origem: origem || ""
    };
  }

  const now = Date.now();
  const lastRunRaw = props.getProperty(GFP_RECAL_AUTO_LAST_RUN_PROP_14_4_1);
  const lastRun = lastRunRaw ? Number(lastRunRaw) : 0;

  if (lastRun && (now - lastRun) < GFP_RECAL_AUTO_MIN_INTERVAL_SECONDS_14_4_1 * 1000) {
    Logger.log(
      `[${fn}] Pulado por throttle. ` +
      `Origem=${origem || ""} | segundosDesdeUltima=${Math.round((now - lastRun) / 1000)}`
    );

    return {
      skipped: true,
      reason: "throttle",
      origem: origem || "",
      secondsSinceLastRun: Math.round((now - lastRun) / 1000)
    };
  }

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(5000)) {
    Logger.warn(`[${fn}] Pulado: outro recalibrador já está rodando.`);
    return {
      skipped: true,
      reason: "lock_busy",
      origem: origem || ""
    };
  }

  try {
    props.setProperty(GFP_RECAL_AUTO_LAST_RUN_PROP_14_4_1, String(now));

    const safeLimit = Math.max(1, Math.min(Number(limit) || GFP_RECAL_AUTO_DEFAULT_LIMIT_14_4_1, 500));

    Logger.log(`[${fn}] Rodando recalibrador automático | limite=${safeLimit} | origem=${origem || ""}`);

    const result = GFP_RECALIBRAR_SUGESTOES_PENDENTES_APPLY_14_4(safeLimit);

    Logger.log(`[${fn}] Resultado: ${JSON.stringify(result)}`);

    return {
      skipped: false,
      origem: origem || "",
      result: result
    };

  } catch (e) {
    Logger.warn(`[${fn}] Falha no recalibrador automático: ${e.message}`);

    return {
      skipped: true,
      reason: "error",
      error: e.message,
      origem: origem || ""
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}
