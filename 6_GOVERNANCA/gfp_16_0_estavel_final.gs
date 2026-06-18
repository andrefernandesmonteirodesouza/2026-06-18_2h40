/**
 * =============================================================================
 * 🚀 GFP 16.0 — ESTÁVEL FINAL
 * =============================================================================
 *
 * Marco final da arquitetura 15.x.
 *
 * Não mexe em dados.
 * Não mexe em URL/Web App.
 * Não troca chave.
 * Não apaga arquivos.
 * =============================================================================
 */

const GFP_VERSION_16_0 = "16.0.0";
const GFP_RELEASE_LABEL_16_0 = "GFP 16.0 — ESTÁVEL FINAL";

/**
 * Compatibilidade segura.
 *
 * Esta função existe apenas para evitar quebra caso alguma rotina antiga chame
 * setupEnvironmentSecrets().
 *
 * Ela NÃO grava GEMINI_API_KEY.
 * Ela NÃO contém chave.
 * Ela NÃO substitui as Propriedades do Script.
 */
function setupEnvironmentSecrets() {
  return GFP_16_VALIDAR_SEGREDOS_();
}

/**
 * Executa a promoção final para 16.0.
 */
function GFP_16_PROMOVER_ESTAVEL_FINAL() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const startedAt = new Date();

  const report = [];
  const summary = {
    version: GFP_VERSION_16_0,
    label: GFP_RELEASE_LABEL_16_0,
    startedAt: startedAt.toISOString(),
    finishedAt: "",
    totalChecks: 0,
    ok: 0,
    atencao: 0,
    erro: 0,
    finalStatus: "EM_EXECUCAO"
  };

  GFP_16_add_(report, "INICIO", "OK", "Promoção para GFP 16.0 iniciada.", "");

  GFP_16_runCheck_(report, "Segredos / GEMINI_API_KEY", GFP_16_VALIDAR_SEGREDOS_);
  GFP_16_runCheck_(report, "Núcleo oficial 15.x/16.0", GFP_16_VALIDAR_FUNCOES_OFICIAIS_);
  GFP_16_runCheck_(report, "Funções operacionais principais", GFP_16_VALIDAR_FUNCOES_OPERACIONAIS_);
  GFP_16_runCheck_(report, "Web App / URLs preservadas", GFP_16_VALIDAR_WEBAPP_PRESERVADO_);
  GFP_16_runCheck_(report, "Abas essenciais", GFP_16_VALIDAR_ABAS_ESSENCIAIS_);
  GFP_16_runCheck_(report, "SYS_LOGS e SYS_RELATORIOS", GFP_16_VALIDAR_OBSERVABILIDADE_);
  GFP_16_runCheck_(report, "DB_TRANSACOES — filtro/validação/colunas", GFP_16_VALIDAR_DB_TRANSACOES_VISUAL_);
  GFP_16_runCheck_(report, "Legado removido/superado", GFP_16_VALIDAR_LEGADO_SUPERADO_);
  GFP_16_runCheck_(report, "Base final / pré-check", GFP_16_VALIDAR_PRECHECK_BASE_FINAL_);
  GFP_16_runCheck_(report, "Dashboard 2.0", GFP_16_VALIDAR_DASHBOARD_2_);
  GFP_16_runCheck_(report, "Painel de Revisão 2.0", GFP_16_VALIDAR_PAINEL_2_);

  summary.finishedAt = new Date().toISOString();

  report.forEach(function(row) {
    const status = row[2];

    summary.totalChecks++;

    if (status === "OK") summary.ok++;
    else if (status === "ATENCAO") summary.atencao++;
    else if (status === "ERRO") summary.erro++;
  });

  if (summary.erro > 0) {
    summary.finalStatus = "ERRO";
  } else if (summary.atencao > 0) {
    summary.finalStatus = "ATENCAO";
  } else {
    summary.finalStatus = "OK";
  }

  if (summary.finalStatus !== "ERRO") {
    GFP_16_GRAVAR_VERSAO_FINAL_(summary);
  }

  GFP_16_ESCREVER_RELATORIO_(report, summary);

  GFP_16_log_("GFP_16", "PROMOVER_ESTAVEL_FINAL", summary.finalStatus, "Promoção 16.0 finalizada.", summary);

  SpreadsheetApp.getActive().toast(
    "GFP 16.0: " + summary.finalStatus +
    " | OK: " + summary.ok +
    " | Atenção: " + summary.atencao +
    " | Erro: " + summary.erro,
    "GFP 16.0"
  );

  return {
    ok: summary.finalStatus !== "ERRO",
    summary: summary,
    report: report
  };
}


/**
 * =============================================================================
 * CHECKS
 * =============================================================================
 */

function GFP_16_VALIDAR_SEGREDOS_() {
  const props = PropertiesService.getScriptProperties();
  const key = String(props.getProperty("GEMINI_API_KEY") || "").trim();

  if (!key) {
    return {
      status: "ERRO",
      detalhe: "GEMINI_API_KEY não encontrada nas Propriedades do Script.",
      retorno: {
        geminiApiKeyExists: false
      }
    };
  }

  return {
    status: "OK",
    detalhe: "GEMINI_API_KEY encontrada nas Propriedades do Script. Chave não será exibida.",
    retorno: {
      geminiApiKeyExists: true,
      geminiApiKeyLength: key.length,
      geminiApiKeyMasked: GFP_16_maskKey_(key)
    }
  };
}

function GFP_16_VALIDAR_FUNCOES_OFICIAIS_() {
  const official = [
    "GFP_DATALAKE_GET_ACTIVE_ROWS_15_2",
    "GFP_DATALAKE_GET_EXISTING_KEYS_15_2",
    "GFP_ARQUIVAR_LINHAS_OK_15_2",
    "GFP_ARQUIVAR_LINHAS_OK_SELECIONADAS_15_2",
    "GFP_ABRIR_HISTORICO_ARQUIVADO_15_2_4",
    "GFP_PROTEGER_HISTORICO_INTEIRO_15_2_4",
    "GFP_AUTO_ARQUIVAR_LINHA_OK_15_3",
    "GFP_AUTO_ARQUIVAR_OKS_MESA_15_3",
    "GFP_AUDITAR_IMPORTADORES_ANTIDUP_15_4",
    "apiDashboardV2GetData",
    "GFP_DASHBOARD_V2_AUDITAR_15_5",
    "apiReviewPanelV2CommitSession_14_9_6",
    "GFP_REVIEW_PANEL_V2_AFTER_COMMIT_15_6_",
    "GFP_REVIEW_PANEL_V2_AUDITAR_15_6",
    "GFP_IMPORT_GUARD_CAN_APPEND_15_7",
    "GFP_PRECHECK_BASE_FINAL_15_7",
    "GFP_BASE_FINAL_CRIAR_SNAPSHOT_15_7",
    "GFP_BASE_FINAL_ZERAR_TRANSACIONAL_15_7",
    "GFP_SAUDE_RAPIDA_15_8",
    "GFP_SAUDE_GERAL_15_8"
  ];

  const missing = official.filter(function(name) {
    return !GFP_16_getFunction_(name);
  });

  if (missing.length) {
    return {
      status: "ERRO",
      detalhe: "Funções oficiais ausentes.",
      retorno: missing
    };
  }

  return {
    status: "OK",
    detalhe: "Todas as 20 funções oficiais foram encontradas.",
    retorno: official
  };
}

function GFP_16_VALIDAR_FUNCOES_OPERACIONAIS_() {
  const expected = [
    "pipelineExecute",
    "openReviewPanelV2",
    "openDashboardV2",
    "runInvoiceSummaryCheck",
    "PRO_SPLIT_openModal",
    "GFP_OBSERVABILIDADE_UNIFICAR_15_9_7",
    "GFP_PRE16_SANEAMENTO_FINAL_15_9_8"
  ];

  const missing = expected.filter(function(name) {
    return !GFP_16_getFunction_(name);
  });

  if (missing.length) {
    return {
      status: "ATENCAO",
      detalhe: "Algumas funções operacionais opcionais não foram encontradas. Verifique se são realmente usadas no menu.",
      retorno: missing
    };
  }

  return {
    status: "OK",
    detalhe: "Funções operacionais principais encontradas.",
    retorno: expected
  };
}

function GFP_16_VALIDAR_WEBAPP_PRESERVADO_() {
  const checks = {
    doGet: !!GFP_16_getFunction_("doGet"),
    renderVoiceInterface: !!GFP_16_getFunction_("renderVoiceInterface"),
    handleInput: !!GFP_16_getFunction_("handleInput"),
    processNaturalLanguage: !!GFP_16_getFunction_("processNaturalLanguage")
  };

  const missing = Object.keys(checks).filter(function(k) {
    return !checks[k];
  });

  if (missing.length) {
    return {
      status: "ATENCAO",
      detalhe: "Algumas funções ligadas às URLs não foram encontradas em runtime. Se as URLs /exec?u=Yan e /exec?u=André abrem e lançam, pode ser diferença de nomenclatura interna.",
      retorno: checks
    };
  }

  return {
    status: "OK",
    detalhe: "Funções principais do Web App/URLs preservadas. Nenhuma alteração foi feita no Web App.",
    retorno: checks
  };
}

function GFP_16_VALIDAR_ABAS_ESSENCIAIS_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const expected = [
    "DB_TRANSACOES",
    "DB_TRANSACOES_HIST",
    "SYS_LOGS",
    "SYS_RELATORIOS",
    "DRE_GERENCIAL",
    "VISAO_FUTURO",
    "DB_MEMORIA",
    "CFG_Aprendizado",
    "CFG_Categorias",
    "CFG_Contas",
    "CFG_Cartoes"
  ];

  const missing = expected.filter(function(name) {
    return !ss.getSheetByName(name);
  });

  if (missing.length) {
    return {
      status: "ERRO",
      detalhe: "Abas essenciais ausentes.",
      retorno: missing
    };
  }

  return {
    status: "OK",
    detalhe: "Todas as abas essenciais existem.",
    retorno: expected
  };
}

function GFP_16_VALIDAR_OBSERVABILIDADE_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logs = ss.getSheetByName("SYS_LOGS");
  const rel = ss.getSheetByName("SYS_RELATORIOS");

  if (!logs || !rel) {
    return {
      status: "ERRO",
      detalhe: "SYS_LOGS ou SYS_RELATORIOS ausente.",
      retorno: {
        sysLogs: !!logs,
        sysRelatorios: !!rel
      }
    };
  }

  return {
    status: "OK",
    detalhe: "Observabilidade unificada disponível.",
    retorno: {
      sysLogsRows: logs.getLastRow(),
      sysRelatoriosRows: rel.getLastRow()
    }
  };
}

function GFP_16_VALIDAR_DB_TRANSACOES_VISUAL_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh) {
    return {
      status: "ERRO",
      detalhe: "DB_TRANSACOES ausente.",
      retorno: {}
    };
  }

  const out = {
    lastRow: sh.getLastRow(),
    lastColumn: sh.getLastColumn(),
    hasFilter: !!sh.getFilter(),
    hasCategoryValidationF2: !!sh.getRange("F2").getDataValidation(),
    hiddenOtoS: []
  };

  if (sh.getMaxColumns() >= 19) {
    for (let c = 15; c <= 19; c++) {
      out.hiddenOtoS.push(sh.isColumnHiddenByUser(c));
    }
  }

  const allHidden = out.hiddenOtoS.length === 5 &&
    out.hiddenOtoS.every(function(v) { return v === true; });

  if (!out.hasFilter || !out.hasCategoryValidationF2 || !allHidden) {
    return {
      status: "ATENCAO",
      detalhe: "DB_TRANSACOES existe, mas filtro/validação/O:S podem precisar de saneamento visual.",
      retorno: out
    };
  }

  return {
    status: "OK",
    detalhe: "DB_TRANSACOES com filtro, validação F2 e O:S ocultas.",
    retorno: out
  };
}

function GFP_16_VALIDAR_LEGADO_SUPERADO_() {
  const deletedOrShouldBeAbsent = [
    "openEnterpriseDashboard",
    "apiReviewPanelV2GetDataSorted_14_9_12",
    "apiReviewPanelV2GetFilterOptionsSorted_14_9_12",
    "GFP_AUDITORIA_MESTRE_14_7",
    "GFP_RESET_LIMPEZA_SEGURA_JUN2026"
  ];

  const stillPresent = deletedOrShouldBeAbsent.filter(function(name) {
    return !!GFP_16_getFunction_(name);
  });

  if (stillPresent.length) {
    return {
      status: "ATENCAO",
      detalhe: "Alguns símbolos legados ainda existem. Não bloqueia a 16.0 se estiverem fora do menu/fluxo.",
      retorno: stillPresent
    };
  }

  return {
    status: "OK",
    detalhe: "Símbolos legados principais não encontrados em runtime.",
    retorno: deletedOrShouldBeAbsent
  };
}

function GFP_16_VALIDAR_PRECHECK_BASE_FINAL_() {
  if (!GFP_16_getFunction_("GFP_PRECHECK_BASE_FINAL_15_7")) {
    return {
      status: "ERRO",
      detalhe: "Pré-check base final não encontrado.",
      retorno: {}
    };
  }

  const result = GFP_PRECHECK_BASE_FINAL_15_7();

  if (result && result.ok === false) {
    return {
      status: "ERRO",
      detalhe: "Pré-check base final retornou falha.",
      retorno: result
    };
  }

  return {
    status: "OK",
    detalhe: "Pré-check base final executado.",
    retorno: result || {}
  };
}

function GFP_16_VALIDAR_DASHBOARD_2_() {
  if (!GFP_16_getFunction_("GFP_DASHBOARD_V2_AUDITAR_15_5")) {
    return {
      status: "ERRO",
      detalhe: "Auditoria do Dashboard 2.0 ausente.",
      retorno: {}
    };
  }

  const result = GFP_DASHBOARD_V2_AUDITAR_15_5();

  if (result && result.ok === false) {
    return {
      status: "ATENCAO",
      detalhe: "Dashboard 2.0 retornou alerta/falha controlada.",
      retorno: result
    };
  }

  return {
    status: "OK",
    detalhe: "Dashboard 2.0 auditado.",
    retorno: result || {}
  };
}

function GFP_16_VALIDAR_PAINEL_2_() {
  if (!GFP_16_getFunction_("GFP_REVIEW_PANEL_V2_AUDITAR_15_6")) {
    return {
      status: "ERRO",
      detalhe: "Auditoria do Painel 2.0 ausente.",
      retorno: {}
    };
  }

  const result = GFP_REVIEW_PANEL_V2_AUDITAR_15_6();

  if (result && result.ok === false) {
    return {
      status: "ATENCAO",
      detalhe: "Painel de Revisão 2.0 retornou alerta/falha controlada.",
      retorno: result
    };
  }

  return {
    status: "OK",
    detalhe: "Painel de Revisão 2.0 auditado.",
    retorno: result || {}
  };
}


/**
 * =============================================================================
 * RELATÓRIO / LOG / PROPRIEDADES
 * =============================================================================
 */

function GFP_16_GRAVAR_VERSAO_FINAL_(summary) {
  const props = PropertiesService.getScriptProperties();

  props.setProperty("GFP_VERSION", GFP_VERSION_16_0);
  props.setProperty("GFP_VERSION_LABEL", GFP_RELEASE_LABEL_16_0);
  props.setProperty("GFP_VERSION_STATUS", summary.finalStatus);
  props.setProperty("GFP_VERSION_PROMOTED_AT", new Date().toISOString());
}

function GFP_16_ESCREVER_RELATORIO_(rows, summary) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Não cria aba nova solta. Centraliza em SYS_RELATORIOS.
  let rel = ss.getSheetByName("SYS_RELATORIOS");

  if (!rel) {
    rel = ss.insertSheet("SYS_RELATORIOS");
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

  rel.getRange(1, 1, 1, header.length).setValues([header]);

  const payload = {
    summary: summary,
    rows: rows.map(function(row) {
      return {
        timestamp: row[0],
        etapa: row[1],
        status: row[2],
        detalhe: row[3],
        retorno: row[4]
      };
    })
  };

  rel.appendRow([
    new Date(),
    "GFP_16_0",
    "",
    "PROMOCAO_VERSAO",
    summary.finalStatus,
    "GFP_16_PROMOVER_ESTAVEL_FINAL",
    "Promoção para GFP 16.0 finalizada.",
    GFP_16_safeJson_(payload, 45000)
  ]);

  rel.getRange(1, 1, 1, header.length)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  rel.setFrozenRows(1);
}

function GFP_16_log_(modulo, acao, status, detalhe, payload) {
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
    modulo || "GFP_16",
    acao || "EVENTO",
    status || "INFO",
    String(detalhe || "") + (payload ? " | payload=" + GFP_16_safeJson_(payload, 30000) : "")
  ]);
}

function GFP_16_runCheck_(report, label, fn) {
  try {
    const result = fn();
    const status = result && result.status ? result.status : "OK";
    const detalhe = result && result.detalhe ? result.detalhe : "Check executado.";
    const retorno = result && result.retorno !== undefined ? result.retorno : result;

    GFP_16_add_(report, label, status, detalhe, GFP_16_safeJson_(retorno, 12000));
  } catch (e) {
    GFP_16_add_(
      report,
      label,
      "ERRO",
      e && e.message ? e.message : String(e),
      e && e.stack ? e.stack : ""
    );
  }
}

function GFP_16_add_(rows, etapa, status, detalhe, retorno) {
  rows.push([
    new Date(),
    etapa,
    status,
    detalhe,
    retorno || ""
  ]);
}

function GFP_16_getFunction_(name) {
  try {
    const fn = eval(name);
    return typeof fn === "function" ? fn : null;
  } catch (e) {
    return null;
  }
}

function GFP_16_safeJson_(value, maxLen) {
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

function GFP_16_maskKey_(key) {
  key = String(key || "");

  if (!key) return "";

  if (key.length <= 10) return "***";

  return key.substring(0, 4) + "..." + key.substring(key.length - 4);
}
