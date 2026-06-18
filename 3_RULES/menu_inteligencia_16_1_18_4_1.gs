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
  // Botão principal.
  // Faz tudo que é necessário, com segurança:
  // 1. ativa modelo antes do Gemini;
  // 2. configura cota 99/33;
  // 3. roda modelo interno;
  // 4. roda Re-Gemini controlado em até 33 linhas;
  // 5. reorganiza a mesa se a função existir.

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const result = {
    patch: "16.1.18.4.2",
    action: "REPESCAGEM_INTELIGENTE",
    startedAt: new Date().toISOString(),
    ativarModelo: null,
    cota: null,
    repescagem: null,
    reorganizacao: null,
    finishedAt: null
  };

  if (typeof GFP_ATIVAR_MODELO_ANTES_GEMINI_16_1_18_4 === "function") {
    result.ativarModelo = GFP_ATIVAR_MODELO_ANTES_GEMINI_16_1_18_4();
  } else {
    result.ativarModelo = {
      skipped: true,
      reason: "Função GFP_ATIVAR_MODELO_ANTES_GEMINI_16_1_18_4 não encontrada."
    };
  }

  if (typeof GFP_REGEMINI_CONFIGURAR_COTA_16_1_18_4 === "function") {
    result.cota = GFP_REGEMINI_CONFIGURAR_COTA_16_1_18_4(99, 33);
  } else {
    result.cota = {
      skipped: true,
      reason: "Função GFP_REGEMINI_CONFIGURAR_COTA_16_1_18_4 não encontrada."
    };
  }

  if (typeof GFP_REPESCAGEM_MODELO_E_GEMINI_16_1_18_4 === "function") {
    result.repescagem = GFP_REPESCAGEM_MODELO_E_GEMINI_16_1_18_4(2000, 33);
  } else {
    throw new Error("Função GFP_REPESCAGEM_MODELO_E_GEMINI_16_1_18_4 não encontrada. Aplique primeiro o PATCH 16.1.18.4.");
  }

  try {
    if (typeof GFP_REORGANIZAR_MESA_DB_TRANSACOES_16_1_18_3 === "function") {
      result.reorganizacao = GFP_REORGANIZAR_MESA_DB_TRANSACOES_16_1_18_3();
    } else {
      result.reorganizacao = {
        skipped: true,
        reason: "Função de reorganização 16.1.18.3 ausente."
      };
    }
  } catch (eSort) {
    result.reorganizacao = {
      ok: false,
      error: eSort.message
    };
  }

  result.finishedAt = new Date().toISOString();

  const modelo = result.repescagem && result.repescagem.model
    ? Number(result.repescagem.model.updated || 0)
    : 0;

  const gemini = result.repescagem && result.repescagem.gemini
    ? Number(result.repescagem.gemini.applied || 0)
    : 0;

  const restante = result.repescagem &&
                   result.repescagem.gemini &&
                   result.repescagem.gemini.quota
    ? result.repescagem.gemini.quota.remainingToday
    : "?";

  ss.toast(
    "Repescagem inteligente concluída. Modelo: " + modelo +
    " | Re-Gemini: " + gemini +
    " | Restante hoje: " + restante,
    "GFP — Inteligência",
    10
  );

  return result;
}


function GFP_MENU_REPESCAR_SO_MODELO_INTERNO_16_1_18_4_2() {
  // Botão econômico.
  // Não chama Gemini.
  // Não consome cota.
  // Reavalia a DB_TRANSACOES inteira com o modelo interno.

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const result = {
    patch: "16.1.18.4.2",
    action: "REPESCAR_SO_MODELO_INTERNO",
    startedAt: new Date().toISOString(),
    ativarModelo: null,
    modelo: null,
    reorganizacao: null,
    finishedAt: null
  };

  if (typeof GFP_ATIVAR_MODELO_ANTES_GEMINI_16_1_18_4 === "function") {
    result.ativarModelo = GFP_ATIVAR_MODELO_ANTES_GEMINI_16_1_18_4();
  } else {
    result.ativarModelo = {
      skipped: true,
      reason: "Função GFP_ATIVAR_MODELO_ANTES_GEMINI_16_1_18_4 não encontrada."
    };
  }

  if (typeof GFP_REAVALIAR_DB_MODELO_INTERNO_16_1_18_4 === "function") {
    result.modelo = GFP_REAVALIAR_DB_MODELO_INTERNO_16_1_18_4(2000);
  } else {
    throw new Error("Função GFP_REAVALIAR_DB_MODELO_INTERNO_16_1_18_4 não encontrada. Aplique primeiro o PATCH 16.1.18.4.");
  }

  try {
    if (typeof GFP_REORGANIZAR_MESA_DB_TRANSACOES_16_1_18_3 === "function") {
      result.reorganizacao = GFP_REORGANIZAR_MESA_DB_TRANSACOES_16_1_18_3();
    } else {
      result.reorganizacao = {
        skipped: true,
        reason: "Função de reorganização 16.1.18.3 ausente."
      };
    }
  } catch (eSort) {
    result.reorganizacao = {
      ok: false,
      error: eSort.message
    };
  }

  result.finishedAt = new Date().toISOString();

  const updated = result.modelo ? Number(result.modelo.updated || 0) : 0;

  ss.toast(
    "Repescagem com modelo interno concluída. Linhas melhoradas: " + updated + ".",
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