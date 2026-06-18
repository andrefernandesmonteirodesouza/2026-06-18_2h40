/**
 * 📂 ARQUIVO: 3_RULES/menu_inteligencia_16_1_18_4_1.gs
 * 🧠 MÓDULO: MENU — INTELIGÊNCIA CONTROLADA ENXUTA
 * 🔢 VERSÃO: 16.1.18.4.2
 *
 * Menu principal só tem dois botões:
 *
 *   🚀 Repescagem inteligente
 *   🧠 Repescar só com modelo interno
 *
 * As funções técnicas continuam existindo, mas não precisam ficar no menu do dia a dia.
 */


function GFP_MENU_REPESCAGEM_INTELIGENTE_16_1_18_4_2() {
  /**
   * BOTÃO: 🤖 Inteligência Gemini
   *
   * Usa o Re-Gemini Controlado nativo.
   * Não cria fluxo paralelo.
   * Não chama o sync CFG_Aprendizado → Modelo.
   *
   * Observação importante:
   * O próprio Re-Gemini nativo já tenta uma passada defensiva do modelo interno
   * antes do Gemini para economizar cota e respeitar MODELO_FORTE/MODELO_MEDIO.
   * Isso é comportamento nativo do módulo 16.1.18.4, não sobreposição nova.
   */

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const result = {
    patch: "16.1.18.25",
    action: "INTELIGENCIA_GEMINI",
    startedAt: new Date().toISOString(),
    backup: null,
    enableGemini: null,
    cota: null,
    gemini: null,
    reorganizacao: null,
    afterAction: null,
    finishedAt: null
  };

  result.backup = GFP_MENU_INTEL_BACKUP_16_1_18_25_("Inteligência Gemini");

  result.enableGemini = GFP_MENU_INTEL_CALL_16_1_18_25_(
    "GFP_ENABLE_GEMINI_FALLBACK_CONTROLADO",
    [],
    false
  );

  result.cota = GFP_MENU_INTEL_CALL_16_1_18_25_(
    "GFP_REGEMINI_CONFIGURAR_COTA_16_1_18_4",
    [99, 33],
    false
  );

  try {
    result.gemini = GFP_MENU_INTEL_CALL_16_1_18_25_(
      "GFP_REGEMINI_CONTROLADO_16_1_18_4",
      [33],
      false
    );

  } catch (eGemini) {
    result.gemini = {
      ok: false,
      error: eGemini.message
    };

    GFP_MENU_INTEL_LOG_16_1_18_25_(
      "WARN",
      "Gemini",
      "Inteligência Gemini interrompida: " + eGemini.message
    );

    SpreadsheetApp.getUi().alert(
      "Gemini indisponível",
      "O Gemini falhou durante a execução:\n\n" + eGemini.message +
      "\n\nA limpeza final será executada agora para reorganizar a planilha e ocultar abas técnicas.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  // GFP 16.1.18.27 — limpeza final garantida mesmo se o Gemini falhar.
  result.reorganizacao = GFP_MENU_INTEL_REORGANIZAR_16_1_18_25_();
  result.afterAction = GFP_MENU_INTEL_AFTER_ACTION_16_1_18_25_();

  result.finishedAt = new Date().toISOString();

  const applied = result.gemini ? Number(result.gemini.applied || 0) : 0;
  const candidates = result.gemini ? Number(result.gemini.candidates || 0) : 0;
  const restante = result.gemini && result.gemini.quota
    ? result.gemini.quota.remainingToday
    : "?";

  GFP_MENU_INTEL_LOG_16_1_18_25_(
    "OK",
    "Gemini",
    "Inteligência Gemini concluída | candidatos=" + candidates +
    " | aplicados=" + applied +
    " | restanteHoje=" + restante
  );

  ss.toast(
    "Inteligência Gemini concluída. Candidatos: " + candidates +
    " | Aplicados: " + applied +
    " | Restante hoje: " + restante,
    "GFP — Inteligência",
    10
  );

  return result;
}


function GFP_MENU_REPESCAR_SO_MODELO_INTERNO_16_1_18_4_2() {
  /**
   * BOTÃO: 🧠 Inteligência Interna
   *
   * Este botão mantém o núcleo nativo antigo:
   *   GFP_REAVALIAR_DB_MODELO_INTERNO_16_1_18_4(2000)
   *
   * A novidade é apenas preparar melhor o modelo antes:
   *   CFG_Aprendizado → CFG_Modelo_Classificacao
   *
   * Não chama Gemini.
   * Não consome cota.
   */

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const result = {
    patch: "16.1.18.25",
    action: "INTELIGENCIA_INTERNA",
    startedAt: new Date().toISOString(),
    backup: null,
    syncAprendizadoModelo: null,
    ativarModelo: null,
    modeloNativo: null,
    reorganizacao: null,
    afterAction: null,
    finishedAt: null
  };

  result.backup = GFP_MENU_INTEL_BACKUP_16_1_18_25_("Inteligência Interna");

  result.syncAprendizadoModelo = GFP_MENU_INTEL_CALL_16_1_18_25_(
    "GFP_SYNC_APRENDIZADO_MODELO_APPLY_16_1_18_23",
    [500],
    true
  );

  result.ativarModelo = GFP_MENU_INTEL_CALL_16_1_18_25_(
    "GFP_ATIVAR_MODELO_ANTES_GEMINI_16_1_18_4",
    [],
    true
  );

  // Núcleo nativo do botão antigo.
  // Não substituir por outra rotina, para não criar conflito.
  result.modeloNativo = GFP_MENU_INTEL_CALL_16_1_18_25_(
    "GFP_REAVALIAR_DB_MODELO_INTERNO_16_1_18_4",
    [2000],
    false
  );

  result.reorganizacao = GFP_MENU_INTEL_REORGANIZAR_16_1_18_25_();
  result.afterAction = GFP_MENU_INTEL_AFTER_ACTION_16_1_18_25_();

  result.finishedAt = new Date().toISOString();

  const syncEvents = result.syncAprendizadoModelo
    ? Number(result.syncAprendizadoModelo.appliedEvents || 0)
    : 0;

  const updated = result.modeloNativo
    ? Number(result.modeloNativo.updated || 0)
    : 0;

  GFP_MENU_INTEL_LOG_16_1_18_25_(
    "OK",
    "Modelo Interno",
    "Inteligência Interna concluída | eventosSync=" + syncEvents +
    " | linhasMelhoradas=" + updated
  );

  ss.toast(
    "Inteligência Interna concluída. Sync: " + syncEvents +
    " | Linhas melhoradas: " + updated,
    "GFP — Inteligência",
    10
  );

  return result;
}
function GFP_MENU_INTELIGENCIA_INTERNA_E_GEMINI_16_1_18_25() {
  /**
   * BOTÃO: 🧠🤖 Inteligência Interna + Gemini
   *
   * Roda, em sequência:
   * 1. Sync CFG_Aprendizado → CFG_Modelo_Classificacao
   * 2. Modelo Interno nativo antigo
   * 3. Re-Gemini Controlado nativo
   *
   * É o botão mais completo.
   */

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const result = {
    patch: "16.1.18.25",
    action: "INTELIGENCIA_INTERNA_E_GEMINI",
    startedAt: new Date().toISOString(),
    backup: null,
    syncAprendizadoModelo: null,
    ativarModelo: null,
    modeloNativo: null,
    enableGemini: null,
    cota: null,
    gemini: null,
    reorganizacao: null,
    afterAction: null,
    finishedAt: null
  };

  result.backup = GFP_MENU_INTEL_BACKUP_16_1_18_25_("Inteligência Interna + Gemini");

  result.syncAprendizadoModelo = GFP_MENU_INTEL_CALL_16_1_18_25_(
    "GFP_SYNC_APRENDIZADO_MODELO_APPLY_16_1_18_23",
    [500],
    true
  );

  result.ativarModelo = GFP_MENU_INTEL_CALL_16_1_18_25_(
    "GFP_ATIVAR_MODELO_ANTES_GEMINI_16_1_18_4",
    [],
    true
  );

  // Núcleo nativo do antigo botão "Repescar só com modelo interno".
  result.modeloNativo = GFP_MENU_INTEL_CALL_16_1_18_25_(
    "GFP_REAVALIAR_DB_MODELO_INTERNO_16_1_18_4",
    [2000],
    false
  );

  result.enableGemini = GFP_MENU_INTEL_CALL_16_1_18_25_(
    "GFP_ENABLE_GEMINI_FALLBACK_CONTROLADO",
    [],
    false
  );

  result.cota = GFP_MENU_INTEL_CALL_16_1_18_25_(
    "GFP_REGEMINI_CONFIGURAR_COTA_16_1_18_4",
    [99, 33],
    false
  );

  // Núcleo nativo do Re-Gemini Controlado.
  try {
    result.gemini = GFP_MENU_INTEL_CALL_16_1_18_25_(
      "GFP_REGEMINI_CONTROLADO_16_1_18_4",
      [33],
      false
    );

  } catch (eGemini) {
    result.gemini = {
      ok: false,
      error: eGemini.message
    };

    GFP_MENU_INTEL_LOG_16_1_18_25_(
      "WARN",
      "Gemini",
      "Inteligência Interna + Gemini interrompida no Gemini: " + eGemini.message
    );

    SpreadsheetApp.getUi().alert(
      "Gemini indisponível",
      "A Inteligência Interna rodou, mas o Gemini falhou durante a execução:\n\n" + eGemini.message +
      "\n\nA limpeza final será executada agora para reorganizar a planilha e ocultar abas técnicas.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  // GFP 16.1.18.27 — limpeza final garantida mesmo se o Gemini falhar.
  result.reorganizacao = GFP_MENU_INTEL_REORGANIZAR_16_1_18_25_();
  result.afterAction = GFP_MENU_INTEL_AFTER_ACTION_16_1_18_25_();

  result.finishedAt = new Date().toISOString();

  const syncEvents = result.syncAprendizadoModelo
    ? Number(result.syncAprendizadoModelo.appliedEvents || 0)
    : 0;

  const updated = result.modeloNativo
    ? Number(result.modeloNativo.updated || 0)
    : 0;

  const applied = result.gemini
    ? Number(result.gemini.applied || 0)
    : 0;

  const restante = result.gemini && result.gemini.quota
    ? result.gemini.quota.remainingToday
    : "?";

  GFP_MENU_INTEL_LOG_16_1_18_25_(
    "OK",
    "Inteligência",
    "Inteligência Interna + Gemini concluída | sync=" + syncEvents +
    " | modelo=" + updated +
    " | gemini=" + applied +
    " | restanteHoje=" + restante
  );

  ss.toast(
    "Interna + Gemini concluída. Sync: " + syncEvents +
    " | Modelo: " + updated +
    " | Gemini: " + applied +
    " | Restante: " + restante,
    "GFP — Inteligência",
    10
  );

  return result;
}

// Função técnica opcional.
// Não precisa estar no menu principal.
function GFP_MENU_INTELIGENCIA_STATUS_16_1_18_4_2() {
  if (typeof GFP_INTELIGENCIA_STATUS_16_1_18_4 !== "function") {
    throw new Error("Função GFP_INTELIGENCIA_STATUS_16_1_18_4 não encontrada.");
  }

  const out = GFP_INTELIGENCIA_STATUS_16_1_18_4();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Modelo antes do Gemini: " + (out.modeloAntesGemini ? "SIM" : "NÃO") +
    " | Re-Gemini restante hoje: " + out.reGeminiCota.remainingToday +
    "/" + out.reGeminiCota.maxPerDay,
    "GFP — Inteligência",
    10
  );

  return out;
}

// =============================================================================
// HELPERS — PATCH 16.1.18.25
// =============================================================================

function GFP_MENU_INTEL_GET_FN_16_1_18_25_(name) {
  try {
    const root = typeof globalThis !== "undefined" ? globalThis : this;
    return root && typeof root[name] === "function" ? root[name] : null;
  } catch (e) {
    return null;
  }
}

function GFP_MENU_INTEL_CALL_16_1_18_25_(name, args, optional) {
  const fn = GFP_MENU_INTEL_GET_FN_16_1_18_25_(name);

  if (!fn) {
    const msg = "Função não encontrada: " + name;

    if (optional) {
      return {
        ok: false,
        skipped: true,
        reason: msg
      };
    }

    throw new Error(msg);
  }

  return fn.apply(null, args || []);
}

function GFP_MENU_INTEL_BACKUP_16_1_18_25_(label) {
  const fn = GFP_MENU_INTEL_GET_FN_16_1_18_25_(
    "GFP_BACKUP_ANTES_ACAO_SENSIVEL_16_1_16_"
  );

  if (!fn) {
    return {
      ok: false,
      skipped: true,
      reason: "Função de backup sensível não encontrada."
    };
  }

  try {
    return fn(label || "Ação de inteligência");
  } catch (e) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "Backup falhou. Ação bloqueada por segurança.",
      "GFP — Inteligência",
      10
    );

    throw e;
  }
}

function GFP_MENU_INTEL_REORGANIZAR_16_1_18_25_() {
  return GFP_MENU_INTEL_CALL_16_1_18_25_(
    "GFP_REORGANIZAR_MESA_DB_TRANSACOES_16_1_18_3",
    [],
    true
  );
}

function GFP_MENU_INTEL_AFTER_ACTION_16_1_18_25_() {
  const result = {
    logs: null,
    dre: null,
    hiddenTechSheets: null
  };

  result.logs = GFP_MENU_INTEL_CALL_16_1_18_25_(
    "GFP_SYS_LOGS_RESTAURAR_PADRAO_ANTIGO_16_1_2",
    [],
    true
  );

  result.dre = GFP_MENU_INTEL_CALL_16_1_18_25_(
    "GFP_DRE_VISAO_RECONSTRUIR_16_1_5",
    [],
    true
  );

  result.hiddenTechSheets = GFP_MENU_INTEL_OCULTAR_ABAS_TECNICAS_16_1_18_27_();

  return result;
}

function GFP_MENU_INTEL_LOG_16_1_18_25_(level, area, message) {
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
 * GFP 16.1.18.27 — Oculta abas técnicas/temporárias de homologação.
 *
 * Essas abas podem ser recriadas por funções de relatório visual.
 * Elas não são base operacional e não precisam ficar aparentes no uso diário.
 */
function GFP_MENU_INTEL_OCULTAR_ABAS_TECNICAS_16_1_18_27_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const names = [
    "SYS_SYNC_APRENDIZADO_MODELO",
    "SYS_MODELO_PRECLASSIFICADOR"
  ];

  const hidden = [];
  const skipped = [];

  names.forEach(function(name) {
    try {
      const sh = ss.getSheetByName(name);

      if (!sh) {
        skipped.push(name);
        return;
      }

      sh.hideSheet();
      hidden.push(name);

    } catch (e) {
      skipped.push(name + " — " + e.message);
    }
  });

  return {
    ok: true,
    hidden: hidden,
    skipped: skipped
  };
}