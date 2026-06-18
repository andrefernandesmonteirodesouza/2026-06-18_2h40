/**
 * =============================================================================
 * 🚦 GFP 15.9.6 — PACOTE FINAL PRÉ-16.0
 * =============================================================================
 *
 * Orquestrador consolidado para validar o sistema antes de promover a versão 16.0.
 *
 * Não mexe no Web App / URLs.
 * Não apaga dados.
 * Não zera base.
 * Não importa extratos.
 * =============================================================================
 */

const GFP_PRE16_VERSION_15_9_6 = "15.9.6";

function GFP_PRE16_EXECUTAR_PACOTE_FINAL_15_9_6() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const startedAt = new Date();

  const report = [];
  const summary = {
    version: GFP_PRE16_VERSION_15_9_6,
    startedAt: startedAt.toISOString(),
    finishedAt: "",
    totalSteps: 0,
    ok: 0,
    atencao: 0,
    erro: 0,
    pulado: 0,
    webAppPolicy: "PULADO_POR_DECISAO_OPERACIONAL_NAO_MEXER_URLS",
    finalStatus: "EM_EXECUCAO"
  };

  GFP_PRE16_add_15_9_6_(report, "INICIO", "OK", "Pacote final pré-16.0 iniciado.", "");

  // ---------------------------------------------------------------------------
  // 1) Rotinas já existentes — executa se existirem, sem quebrar o pacote.
  // ---------------------------------------------------------------------------

  GFP_PRE16_runOptional_15_9_6_(
    report,
    "Classificar abas da planilha",
    "GFP_PLANILHA_CLASSIFICAR_ABAS_15_9_3_1"
  );

  GFP_PRE16_runOptional_15_9_6_(
    report,
    "Limpeza técnica / mapa oficial",
    "GFP_LIMPEZA_TECNICA_15_9"
  );

  GFP_PRE16_runOptional_15_9_6_(
    report,
    "Saúde rápida GFP",
    "GFP_SAUDE_RAPIDA_15_8"
  );

  GFP_PRE16_runOptional_15_9_6_(
    report,
    "Saúde geral GFP",
    "GFP_SAUDE_GERAL_15_8"
  );

  GFP_PRE16_runOptional_15_9_6_(
    report,
    "Pré-check base final",
    "GFP_PRECHECK_BASE_FINAL_15_7"
  );

  GFP_PRE16_runOptional_15_9_6_(
    report,
    "Auditoria importadores / anti-dup",
    "GFP_AUDITAR_IMPORTADORES_ANTIDUP_15_4"
  );

  GFP_PRE16_runOptional_15_9_6_(
    report,
    "Auditoria Dashboard 2.0",
    "GFP_DASHBOARD_V2_AUDITAR_15_5"
  );

  GFP_PRE16_runOptional_15_9_6_(
    report,
    "Auditoria Painel de Revisão 2.0",
    "GFP_REVIEW_PANEL_V2_AUDITAR_15_6"
  );

  // Organização visual deve vir perto do fim, para deixar a planilha arrumada.
  GFP_PRE16_runOptional_15_9_6_(
    report,
    "Organizar abas automaticamente",
    "GFP_PLANILHA_ORGANIZAR_ABAS_15_9_4_1"
  );

  // ---------------------------------------------------------------------------
  // 2) Checagens próprias do pacote pré-16.0
  // ---------------------------------------------------------------------------

  GFP_PRE16_checkOfficialFunctions_15_9_6_(report);
  GFP_PRE16_checkEssentialSheets_15_9_6_(report);
  GFP_PRE16_checkVisibleOrder_15_9_6_(report);
  GFP_PRE16_checkHiddenSheets_15_9_6_(report);
  GFP_PRE16_checkForbiddenRestaurarVisual_15_9_6_(report);
  GFP_PRE16_checkDuplicateResolutionMarkers_15_9_6_(report);
  GFP_PRE16_checkDbTransacoesHelpers_15_9_6_(report);

  // Web App deliberadamente não mexido.
  GFP_PRE16_add_15_9_6_(
    report,
    "Web App / URLs",
    "PULADO",
    "Nenhuma alteração feita. URLs preservadas conforme decisão operacional.",
    "Fase 15.9.5 bloqueadora cancelada."
  );

  // ---------------------------------------------------------------------------
  // 3) Finaliza relatório
  // ---------------------------------------------------------------------------

  summary.finishedAt = new Date().toISOString();

  report.forEach(function(row) {
    const status = row[2];

    summary.totalSteps++;

    if (status === "OK") summary.ok++;
    else if (status === "ATENCAO") summary.atencao++;
    else if (status === "ERRO") summary.erro++;
    else if (status === "PULADO") summary.pulado++;
  });

  if (summary.erro > 0) {
    summary.finalStatus = "ERRO";
  } else if (summary.atencao > 0) {
    summary.finalStatus = "ATENCAO";
  } else {
    summary.finalStatus = "OK";
  }

  GFP_PRE16_writeReport_15_9_6_(ss, report, summary);

  ss.toast(
    "Pré-16.0 finalizado: " + summary.finalStatus +
    " | OK: " + summary.ok +
    " | Atenção: " + summary.atencao +
    " | Erro: " + summary.erro,
    "GFP 15.9.6"
  );

  return {
    ok: summary.finalStatus !== "ERRO",
    summary: summary,
    report: report
  };
}

function GFP_PRE16_runOptional_15_9_6_(report, label, functionName) {
  const fn = GFP_PRE16_getFunction_15_9_6_(functionName);

  if (!fn) {
    GFP_PRE16_add_15_9_6_(
      report,
      label,
      "PULADO",
      "Função não encontrada: " + functionName,
      "Sem interrupção do pacote."
    );
    return;
  }

  const started = new Date();

  try {
    const result = fn();
    const elapsedMs = new Date().getTime() - started.getTime();

    GFP_PRE16_add_15_9_6_(
      report,
      label,
      "OK",
      "Executado com sucesso: " + functionName + " (" + elapsedMs + " ms).",
      GFP_PRE16_safeJson_15_9_6_(result, 1500)
    );
  } catch (e) {
    GFP_PRE16_add_15_9_6_(
      report,
      label,
      "ERRO",
      "Erro ao executar: " + functionName,
      e && e.stack ? e.stack : String(e)
    );
  }
}

function GFP_PRE16_checkOfficialFunctions_15_9_6_(report) {
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

  const missing = [];

  official.forEach(function(name) {
    if (!GFP_PRE16_getFunction_15_9_6_(name)) missing.push(name);
  });

  if (missing.length) {
    GFP_PRE16_add_15_9_6_(
      report,
      "Funções oficiais 15.x",
      "ERRO",
      "Há funções oficiais ausentes.",
      missing.join(", ")
    );
  } else {
    GFP_PRE16_add_15_9_6_(
      report,
      "Funções oficiais 15.x",
      "OK",
      "Todas as 20 funções oficiais foram encontradas em runtime.",
      official.join(", ")
    );
  }
}

function GFP_PRE16_checkEssentialSheets_15_9_6_(report) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const essential = [
    "DB_TRANSACOES",
    "DB_TRANSACOES_HIST",
    "SYS_LOGS",
    "DRE_GERENCIAL",
    "VISAO_FUTURO",
    "DB_MEMORIA",
    "LOG_REVISAO_IA",
    "CFG_Aprendizado",
    "CFG_Categorias",
    "CFG_Contas",
    "CFG_Cartoes"
  ];

  const missing = [];

  essential.forEach(function(name) {
    if (!ss.getSheetByName(name)) missing.push(name);
  });

  if (missing.length) {
    GFP_PRE16_add_15_9_6_(
      report,
      "Abas essenciais visíveis",
      "ERRO",
      "Abas essenciais ausentes.",
      missing.join(", ")
    );
  } else {
    GFP_PRE16_add_15_9_6_(
      report,
      "Abas essenciais visíveis",
      "OK",
      "Todas as abas essenciais existem.",
      essential.join(", ")
    );
  }
}

function GFP_PRE16_checkVisibleOrder_15_9_6_(report) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const expected = [
    "DB_TRANSACOES",
    "DB_TRANSACOES_HIST",
    "SYS_LOGS",
    "DRE_GERENCIAL",
    "VISAO_FUTURO",
    "DB_MEMORIA",
    "LOG_REVISAO_IA",
    "CFG_Aprendizado",
    "CFG_Categorias",
    "CFG_Contas",
    "CFG_Cartoes"
  ];

  const visible = ss.getSheets()
    .filter(function(sh) { return !sh.isSheetHidden(); })
    .map(function(sh) { return sh.getName(); });

  const first = visible.slice(0, expected.length);
  const mismatches = [];

  expected.forEach(function(name, i) {
    if (first[i] !== name) {
      mismatches.push((i + 1) + ": esperado " + name + ", encontrado " + (first[i] || "(vazio)"));
    }
  });

  if (mismatches.length) {
    GFP_PRE16_add_15_9_6_(
      report,
      "Ordem das abas visíveis",
      "ATENCAO",
      "A ordem inicial das abas visíveis não está exatamente como esperado.",
      mismatches.join(" | ")
    );
  } else {
    GFP_PRE16_add_15_9_6_(
      report,
      "Ordem das abas visíveis",
      "OK",
      "As primeiras abas visíveis estão na ordem oficial.",
      expected.join(" > ")
    );
  }
}

function GFP_PRE16_checkHiddenSheets_15_9_6_(report) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const shouldBeHidden = [
    "SYS_AUDITORIA_GFP",
    "SYS_DASHBOARD_2_AUDIT",
    "SYS_REVIEW_PANEL_2_AUDIT",
    "SYS_PRECHECK_BASE_FINAL",
    "SYS_SAUDE_GFP",
    "SYS_LIMPEZA_TECNICA_GFP",
    "SYS_AUDIT_REPORT",
    "SYS_RESET_LOG",
    "LOG_ARQUIVAMENTO",
    "AUDITORIA_GFP",
    "CFG_Modelo_Classificacao",
    "CFG_Taxonomia_Quarentena",
    "SYS_TAXONOMIA_REPORT",
    "CFG_Taxonomia",
    "REL_CLASSIFICACAO_ABAS_GFP",
    "REL_ORGANIZACAO_ABAS_GFP"
  ];

  const visibleButShouldHide = [];

  shouldBeHidden.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (sh && !sh.isSheetHidden()) visibleButShouldHide.push(name);
  });

  if (visibleButShouldHide.length) {
    GFP_PRE16_add_15_9_6_(
      report,
      "Abas técnicas ocultas",
      "ATENCAO",
      "Há abas que deveriam estar ocultas, mas continuam visíveis.",
      visibleButShouldHide.join(", ")
    );
  } else {
    GFP_PRE16_add_15_9_6_(
      report,
      "Abas técnicas ocultas",
      "OK",
      "As abas técnicas/legadas definidas estão ocultas ou não existem.",
      shouldBeHidden.join(", ")
    );
  }
}

function GFP_PRE16_checkForbiddenRestaurarVisual_15_9_6_(report) {
  const forbidden = [
    "GFP_PLANILHA_RESTAURAR_VISUAL_15_9_3",
    "restaurarVisualPlanilhaWrapper"
  ];

  const found = forbidden.filter(function(name) {
    return !!GFP_PRE16_getFunction_15_9_6_(name);
  });

  if (found.length) {
    GFP_PRE16_add_15_9_6_(
      report,
      "Funções proibidas de restauração visual",
      "ATENCAO",
      "Ainda há função/comando de restauração visual no código, contra a diretriz do usuário.",
      found.join(", ")
    );
  } else {
    GFP_PRE16_add_15_9_6_(
      report,
      "Funções proibidas de restauração visual",
      "OK",
      "Nenhuma função de restauração visual proibida foi encontrada em runtime.",
      forbidden.join(", ")
    );
  }
}

function GFP_PRE16_checkDuplicateResolutionMarkers_15_9_6_(report) {
  const publicGeneric = GFP_PRE16_getFunction_15_9_6_("processModuleGeneric");
  const bridgeFallback = GFP_PRE16_getFunction_15_9_6_("processModuleGenericPdfBridgeFallback_15_9_2_");

  const publicBalance = GFP_PRE16_getFunction_15_9_6_("apiGetBalanceAudit");
  const legacyBalance = GFP_PRE16_getFunction_15_9_6_("apiGetBalanceAuditDashboardLegacy_15_9_2");

  const issues = [];

  if (!publicGeneric) issues.push("processModuleGeneric público ausente");
  if (!bridgeFallback) issues.push("fallback renomeado do PDF Bridge ausente");
  if (!publicBalance) issues.push("apiGetBalanceAudit público ausente");
  if (!legacyBalance) issues.push("apiGetBalanceAuditDashboardLegacy_15_9_2 ausente");

  if (issues.length) {
    GFP_PRE16_add_15_9_6_(
      report,
      "Marcadores de resolução de duplicidades",
      "ATENCAO",
      "Não foi possível confirmar todos os marcadores esperados da fase 15.9.2.",
      issues.join(" | ")
    );
  } else {
    GFP_PRE16_add_15_9_6_(
      report,
      "Marcadores de resolução de duplicidades",
      "OK",
      "Marcadores esperados da resolução de duplicidades encontrados.",
      "processModuleGeneric + fallback renomeado; apiGetBalanceAudit + legacy dashboard renomeado."
    );
  }
}

function GFP_PRE16_checkDbTransacoesHelpers_15_9_6_(report) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh) {
    GFP_PRE16_add_15_9_6_(
      report,
      "DB_TRANSACOES O:S",
      "ERRO",
      "DB_TRANSACOES não encontrada.",
      ""
    );
    return;
  }

  if (sh.getLastColumn() < 19) {
    GFP_PRE16_add_15_9_6_(
      report,
      "DB_TRANSACOES O:S",
      "OK",
      "DB_TRANSACOES não possui colunas auxiliares até S.",
      "lastColumn=" + sh.getLastColumn()
    );
    return;
  }

  const hidden = [];

  for (let c = 15; c <= 19; c++) {
    try {
      hidden.push(sh.isColumnHiddenByUser(c));
    } catch (e) {
      hidden.push(false);
    }
  }

  const allHidden = hidden.every(function(v) { return v === true; });

  if (allHidden) {
    GFP_PRE16_add_15_9_6_(
      report,
      "DB_TRANSACOES O:S",
      "OK",
      "Colunas auxiliares O:S estão ocultas.",
      hidden.join(", ")
    );
  } else {
    GFP_PRE16_add_15_9_6_(
      report,
      "DB_TRANSACOES O:S",
      "ATENCAO",
      "Nem todas as colunas auxiliares O:S estão ocultas.",
      hidden.join(", ")
    );
  }
}

function GFP_PRE16_writeReport_15_9_6_(ss, rows, summary) {
  const name = "REL_PRE16_FINAL_GFP";
  let sh = ss.getSheetByName(name);

  if (!sh) sh = ss.insertSheet(name);

  sh.clear();

  const header = [
    "TIMESTAMP",
    "ETAPA",
    "STATUS",
    "DETALHE",
    "RETORNO"
  ];

  sh.getRange(1, 1, 1, header.length).setValues([header]);

  if (rows.length) {
    sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  }

  sh.getRange(1, 1, 1, header.length)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);

  if (sh.getFilter()) sh.getFilter().remove();
  sh.getDataRange().createFilter();

  sh.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sh.getRange("D:E").setWrap(true);

  try { sh.autoResizeColumns(1, header.length); } catch (eResize) {}

  sh.getRange("G1").setValue("RESUMO");
  sh.getRange("G2").setValue(JSON.stringify(summary));

  // O relatório final fica visível para conferência da pré-16.0.
  try { sh.showSheet(); } catch (eShow) {}

  try {
    ss.setActiveSheet(sh);
  } catch (eActive) {}
}

function GFP_PRE16_add_15_9_6_(rows, step, status, detail, output) {
  rows.push([
    new Date(),
    step,
    status,
    detail,
    output || ""
  ]);
}

function GFP_PRE16_getFunction_15_9_6_(functionName) {
  try {
    const fn = eval(functionName);
    return typeof fn === "function" ? fn : null;
  } catch (e) {
    return null;
  }
}

function GFP_PRE16_safeJson_15_9_6_(value, maxLen) {
  maxLen = maxLen || 1000;

  try {
    if (value === undefined) return "";

    const str = JSON.stringify(value);

    if (!str) return "";

    return str.length > maxLen ? str.substring(0, maxLen) + "...[cortado]" : str;
  } catch (e) {
    const fallback = String(value || "");

    return fallback.length > maxLen ? fallback.substring(0, maxLen) + "...[cortado]" : fallback;
  }
}
