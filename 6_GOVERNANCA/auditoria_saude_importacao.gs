/**
 * =============================================================================
 * 📂 ARQUIVO: 6_GOVERNANCA/auditoria_saude_importacao.gs
 * 🛡️ MÓDULO: AUDITORIA DE IMPORTADORES, PRECHECK/IMPORT GUARD, SAÚDE GERAL/RÁPIDA,
 *            LIMPEZA TÉCNICA E CLASSIFICAÇÃO/ORGANIZAÇÃO DE ABAS
 * 🔢 VERSÃO: 1.0 (CRIAÇÃO POR EXTRAÇÃO — CONTEÚDO ORIGINADO EM core_antidup.gs)
 * 📅 DATA: 18/06/2026
 * 👤 RESPONSÁVEL: André Fernandes & Claude (extração) / André Fernandes & ChatGPT (origem)
 * =============================================================================
 *
 * 🎯 OBJETIVO
 * Reunir, em um único arquivo de governança, todas as ferramentas de diagnóstico e
 * manutenção que originalmente foram se acumulando dentro de 1_CORE/core_antidup.gs e que
 * NÃO fazem parte do motor real de anti-duplicidade. Em sua grande maioria são auditorias/
 * relatórios que NÃO alteram dados transacionais por conta própria.
 *
 * 📦 CONTEÚDO (6 subsistemas pré-existentes, 46 funções, 5 constantes — zero código novo)
 *
 *  1. 🧪 AUDITORIA DE IMPORTADORES / ANTI-DUP / HISTÓRICO (GFP 15.4.0 / 15.4.1)
 *     GFP_AUDITAR_IMPORTADORES_ANTIDUP_15_4 (função principal) +
 *     GFP_AUDIT_parseRow_15_4_, GFP_AUDIT_validateCommonRow_15_4_, GFP_AUDIT_isCardRow_15_4_,
 *     GFP_AUDIT_getCashMonth_15_4_, GFP_AUDIT_pushActiveKey_15_4_,
 *     GFP_AUDIT_addParsedIssue_15_4_, GFP_AUDIT_addIssue_15_4_, GFP_AUDIT_writeReport_15_4_,
 *     GFP_AUDIT_parseJson_15_4_, GFP_AUDIT_norm_15_4_, GFP_MANTER_HIST_STATUS_VISIVEL_15_4,
 *     GFP_AUDIT_isConfirmedStatus_15_4_1_, GFP_AUDIT_isTransferCategory_15_4_1_,
 *     GFP_AUDIT_metadataLooksInconsistent_15_4_1_, GFP_CORRIGIR_CASHMONTH_LINHA_15_4_1,
 *     GFP_CORRIGIR_CASHMONTH_LINHA_12_2026_02.
 *     Cria/atualiza a aba SYS_AUDITORIA_GFP. Não altera dados transacionais.
 *
 *  2. 🛂 PRECHECK BASE FINAL / IMPORT GUARD (GFP 15.7.0)
 *     GFP_PRECHECK_BASE_FINAL_15_7 (função principal) + GFP_IMPORT_GUARD_CAN_APPEND_15_7 +
 *     GFP_IMPORT_GUARD_APPEND_ROWS_15_7 + GFP_IMPORT_GUARD_normalizeRow_15_7_ +
 *     GFP_IMPORT_GUARD_ensureLog_15_7_ + GFP_PRECHECK_checkHeader_15_7_ +
 *     GFP_PRECHECK_parseBaseRow_15_7_ + GFP_PRECHECK_pushKey_15_7_ +
 *     GFP_PRECHECK_addParsedIssue_15_7_ + GFP_PRECHECK_addIssue_15_7_ +
 *     GFP_PRECHECK_writeReport_15_7_ + GFP_PRECHECK_norm_15_7_.
 *     Constante: GFP_IMPORT_GUARD_VERSION_15_7. Função oficial usada na validação de
 *     promoção de versão (gfp_16_0_estavel_final.gs).
 *
 *  3. 🩺 SAÚDE GERAL / SAÚDE RÁPIDA (GFP 15.8.0)
 *     GFP_SAUDE_GERAL_15_8 + GFP_SAUDE_RAPIDA_15_8 (ambas funções oficiais usadas na
 *     homologação 16.0) + GFP_SAUDE_extractIssueCount_15_8_ +
 *     GFP_SAUDE_extractSeverity_15_8_ + GFP_SAUDE_writeReport_15_8_.
 *     Constante: GFP_SAUDE_GERAL_VERSION_15_8.
 *
 *  4. 🧹 LIMPEZA TÉCNICA (GFP 15.9.0)
 *     GFP_LIMPEZA_TECNICA_15_9 (função principal) + GFP_LIMPEZA_TECNICA_officialFunctions_15_9_
 *     + GFP_LIMPEZA_TECNICA_legacyCandidates_15_9_ + GFP_LIMPEZA_TECNICA_recommendedMenu_15_9_
 *     + GFP_LIMPEZA_TECNICA_writeReport_15_9_. Constante: GFP_LIMPEZA_TECNICA_VERSION_15_9.
 *
 *  5. 🗂️ CLASSIFICAÇÃO DE ABAS (GFP 15.9.3.1)
 *     GFP_PLANILHA_CLASSIFICAR_ABAS_15_9_3_1 (função principal) +
 *     GFP_CLASS_ABAS_classify_15_9_3_1_ + GFP_CLASS_ABAS_countFormulaReferences_15_9_3_1_ +
 *     GFP_CLASS_ABAS_escapeRegex_15_9_3_1_ + GFP_CLASS_ABAS_writeReport_15_9_3_1_.
 *     Constante: GFP_CLASSIFICADOR_ABAS_VERSION_15_9_3_1.
 *
 *  6. 🗄️ ORGANIZAÇÃO DE ABAS (GFP 15.9.4.1)
 *     GFP_PLANILHA_ORGANIZAR_ABAS_15_9_4_1 (função principal) +
 *     GFP_PLANILHA_ORGANIZAR_ABAS_writeReport_15_9_4_1_.
 *     Constante: GFP_ORGANIZACAO_ABAS_VERSION_15_9_4_1.
 *
 * 📝 RESUMO/HISTÓRICO
 * - v1.0 (18/06/2026) — CRIAÇÃO POR EXTRAÇÃO, autoria André Fernandes & Claude. Todo o
 *   conteúdo deste arquivo já existia antes, dentro de 1_CORE/core_antidup.gs v15.2
 *   (autoria original André Fernandes & ChatGPT), onde havia se acumulado ao longo das
 *   sucessivas evoluções GFP 15.4 → 15.9.4.1.
 *   MOTIVO DA EXTRAÇÃO: pela filosofia modular (Lego) do projeto — "um arquivo, uma
 *   responsabilidade" — core_antidup.gs deveria conter somente o motor de anti-
 *   duplicidade. André identificou esse desvio e autorizou explicitamente, em 18/06/2026,
 *   mover as 6 ferramentas acima para um arquivo próprio único.
 *   NATUREZA DA MUDANÇA: 100% reposicionamento de código. NENHUMA linha de lógica dentro
 *   de qualquer função foi reescrita, simplificada ou alterada — apenas o arquivo em que o
 *   código vive mudou. Nomes de função, nomes de constante, comentários internos e
 *   formatação originais foram preservados integralmente.
 *   VERIFICAÇÃO DE INTEGRIDADE: diff de nomes de função e de constante entre o
 *   core_antidup.gs v15.2 original (53 funções / 5 constantes) e a soma de
 *   core_antidup.gs v15.3 (7 funções / 0 constantes) + este arquivo (46 funções / 5
 *   constantes) confirmou equivalência 100% — sem perda, duplicação ou renomeação de
 *   nenhum símbolo.
 * =============================================================================
 */

/**
 * =============================================================================
 * 🧪 GFP 15.4.0 — AUDITORIA DE IMPORTADORES / ANTI-DUP / HISTÓRICO
 * =============================================================================
 *
 * Cria/atualiza a aba:
 *
 *   SYS_AUDITORIA_GFP
 *
 * A auditoria não altera dados transacionais.
 * Ela apenas aponta problemas e mantém T/HIST_STATUS visível.
 * =============================================================================
 */

function GFP_AUDITAR_IMPORTADORES_ANTIDUP_15_4() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const workName = typeof GFP_DATALAKE_WORK_SHEET_15_2 !== "undefined"
    ? GFP_DATALAKE_WORK_SHEET_15_2
    : "DB_TRANSACOES";

  const histName = typeof GFP_DATALAKE_HIST_SHEET_15_2 !== "undefined"
    ? GFP_DATALAKE_HIST_SHEET_15_2
    : "DB_TRANSACOES_HIST";

  const work = ss.getSheetByName(workName);
  const hist = ss.getSheetByName(histName);

  const issues = [];
  const activeIndex = {};
  const stats = {
    version: "15.4.0",
    startedAt: new Date(),
    workRows: 0,
    histRows: 0,
    histArchivedRows: 0,
    histDesarchivedRows: 0,
    issues: 0,
    fatal: 0,
    warn: 0,
    info: 0,
    activeDuplicateGroups: 0
  };

  if (!work) {
    GFP_AUDIT_addIssue_15_4_(issues, "FATAL", "ABA_AUSENTE", workName, "", "", "", "", "", "", "", "", "", "", "Aba DB_TRANSACOES não encontrada.");
  }

  if (!hist) {
    GFP_AUDIT_addIssue_15_4_(issues, "FATAL", "ABA_AUSENTE", histName, "", "", "", "", "", "", "", "", "", "", "Aba DB_TRANSACOES_HIST não encontrada.");
  }

  if (work && work.getLastRow() >= 2) {
    const values = work.getRange(2, 1, work.getLastRow() - 1, 14).getValues();
    stats.workRows = values.length;

    values.forEach(function(row, idx) {
      const sheetRow = idx + 2;
      const parsed = GFP_AUDIT_parseRow_15_4_(row, workName, sheetRow, false);

      GFP_AUDIT_validateCommonRow_15_4_(issues, parsed, "WORK");

      if (!parsed.key) {
        GFP_AUDIT_addParsedIssue_15_4_(issues, "WARN", "SEM_ID_E_HASH", parsed, "Linha na mesa de trabalho sem ID_TRANSACAO e sem HASH_LINHA. Anti-duplicidade fica frágil.");
      } else {
        GFP_AUDIT_pushActiveKey_15_4_(activeIndex, parsed.key, parsed);
      }

      if (parsed.status === "OK") {
        GFP_AUDIT_addParsedIssue_15_4_(issues, "INFO", "OK_AINDA_NA_MESA", parsed, "Linha OK ainda está na DB_TRANSACOES. Se o arquivamento automático estiver ativo, ela deveria sair após validação.");
      }

      if (parsed.status === "TRUE" || parsed.status === "FALSE") {
        GFP_AUDIT_addParsedIssue_15_4_(issues, "WARN", "STATUS_BOOLEAN_CHECKBOX", parsed, "Status ficou como TRUE/FALSE. O fluxo correto é converter para OK antes de arquivar.");
      }
    });
  }

  if (hist && hist.getLastRow() >= 2) {
    const values = hist.getRange(2, 1, hist.getLastRow() - 1, 20).getValues();
    stats.histRows = values.length;

    values.forEach(function(row, idx) {
      const sheetRow = idx + 2;
      const parsed = GFP_AUDIT_parseRow_15_4_(row.slice(0, 14), histName, sheetRow, true);
      parsed.histStatus = GFP_AUDIT_norm_15_4_(row[19]);

      if (parsed.histStatus === "ARQUIVADO") stats.histArchivedRows++;
      else if (parsed.histStatus === "DESARQUIVADO") stats.histDesarchivedRows++;

      if (parsed.histStatus !== "ARQUIVADO" && parsed.histStatus !== "DESARQUIVADO") {
        GFP_AUDIT_addParsedIssue_15_4_(issues, "WARN", "HIST_STATUS_INVALIDO", parsed, "HIST_STATUS deve ser ARQUIVADO ou DESARQUIVADO. Valor atual: " + parsed.histStatus);
      }

      GFP_AUDIT_validateCommonRow_15_4_(issues, parsed, "HIST");

      if (!parsed.key) {
        GFP_AUDIT_addParsedIssue_15_4_(issues, "WARN", "HIST_SEM_ID_E_HASH", parsed, "Linha histórica sem ID_TRANSACAO e sem HASH_LINHA.");
      } else if (parsed.histStatus === "ARQUIVADO") {
        GFP_AUDIT_pushActiveKey_15_4_(activeIndex, parsed.key, parsed);
      }
    });
  }

  Object.keys(activeIndex).forEach(function(key) {
    const list = activeIndex[key];

    if (list.length <= 1) return;

    stats.activeDuplicateGroups++;

    const detail = list.map(function(x) {
      return x.sheetName + "!" + x.rowNumber;
    }).join(" | ");

    list.forEach(function(parsed) {
      GFP_AUDIT_addParsedIssue_15_4_(
        issues,
        "FATAL",
        "DUPLICIDADE_ATIVA_ID_HASH",
        parsed,
        "Mesmo ID/HASH ativo em mais de uma linha: " + detail
      );
    });
  });

  stats.issues = issues.length;
  stats.fatal = issues.filter(function(x) { return x.severity === "FATAL"; }).length;
  stats.warn = issues.filter(function(x) { return x.severity === "WARN"; }).length;
  stats.info = issues.filter(function(x) { return x.severity === "INFO"; }).length;

  GFP_AUDIT_writeReport_15_4_(ss, issues, stats);

  if (typeof GFP_MANTER_HIST_STATUS_VISIVEL_15_4 === "function") {
    GFP_MANTER_HIST_STATUS_VISIVEL_15_4({ silent: true });
  }

  ss.toast(
    "Auditoria GFP: " + stats.fatal + " fatal(is), " + stats.warn + " alerta(s), " + stats.info + " info.",
    "GFP 15.4"
  );

  return {
    ok: true,
    stats: stats,
    issues: issues
  };
}

function GFP_AUDIT_parseRow_15_4_(row, sheetName, rowNumber, isHist) {
  const meta = GFP_AUDIT_parseJson_15_4_(row[13]);

  const id = String(row[10] || "").trim();
  const hash = String(row[12] || "").trim();

  return {
    sheetName: sheetName,
    rowNumber: rowNumber,
    isHist: !!isHist,
    date: row[0],
    description: String(row[1] || ""),
    value: row[2],
    type: GFP_AUDIT_norm_15_4_(row[3]),
    account: String(row[4] || ""),
    category: String(row[5] || ""),
    status: GFP_AUDIT_norm_15_4_(row[8]),
    notes: String(row[9] || ""),
    id: id,
    hash: hash,
    key: id || hash,
    metadata: meta,
    rawMetadata: String(row[13] || "")
  };
}

function GFP_AUDIT_validateCommonRow_15_4_(issues, parsed, origin) {
  const validTypes = ["D", "C", "T", "S", ""];

  if (validTypes.indexOf(parsed.type) < 0) {
    GFP_AUDIT_addParsedIssue_15_4_(issues, "WARN", "TIPO_INVALIDO", parsed, "Tipo inválido: " + parsed.type + ". Esperado: D, C, T ou S.");
  }

  if (parsed.status === "OK" && !parsed.category) {
    GFP_AUDIT_addParsedIssue_15_4_(issues, "WARN", "OK_SEM_CATEGORIA", parsed, "Linha marcada como OK sem categoria.");
  }

  if (GFP_AUDIT_isCardRow_15_4_(parsed) && !GFP_AUDIT_getCashMonth_15_4_(parsed)) {
    GFP_AUDIT_addParsedIssue_15_4_(issues, "WARN", "CARTAO_SEM_CASHMONTH", parsed, "Transação de cartão sem cashMonth no METADADOS. Pode afetar DRE em regime de caixa.");
  }

  // GFP 15.4.1:
  // Categoria 99.* só é problema de tipo se a linha já foi confirmada.
  // Se ainda está GEMINI_FORTE/GEMINI_MEDIO/GEMINI_BAIXO, é apenas sugestão pendente.
  if (GFP_AUDIT_isTransferCategory_15_4_1_(parsed.category) && parsed.type !== "T") {
    if (GFP_AUDIT_isConfirmedStatus_15_4_1_(parsed.status)) {
      GFP_AUDIT_addParsedIssue_15_4_(issues, "WARN", "TRANSFERENCIA_CONFIRMADA_NAO_T", parsed, "Linha confirmada como transferência/99.*, mas TIPO ainda não é T. O trigger deveria corrigir automaticamente.");
    }
  }

  // Metadados aparentemente incongruentes:
  // Ex.: descrição de cartão PARCxx/xx, conta cartão, mas metadata de CSV de conta comum.
  if (GFP_AUDIT_metadataLooksInconsistent_15_4_1_(parsed)) {
    GFP_AUDIT_addParsedIssue_15_4_(issues, "WARN", "METADADOS_INCONGRUENTES", parsed, "A linha parece ser de cartão/fatura, mas os METADADOS parecem vir de outra origem. Verifique ou aplique ajuste manual seguro.");
  }

  if (!parsed.rawMetadata) {
    GFP_AUDIT_addParsedIssue_15_4_(issues, "INFO", "SEM_METADADOS", parsed, "Linha sem METADADOS. Não é necessariamente erro, mas reduz rastreabilidade.");
  }
}


function GFP_AUDIT_isCardRow_15_4_(parsed) {
  const account = String(parsed.account || "").toLowerCase();
  const meta = parsed.metadata || {};
  const origin = String(meta.origin || "").toLowerCase();
  const policy = String(meta.dreDatePolicy || "").toLowerCase();
  const fileName = String(meta.fileName || meta.invoiceFileName || "").toLowerCase();

  if (account.indexOf("cartão") >= 0 || account.indexOf("cartao") >= 0) return true;
  if (origin.indexOf("fatura") >= 0 || origin.indexOf("invoice") >= 0) return true;
  if (policy.indexOf("invoice") >= 0 || policy.indexOf("fatura") >= 0) return true;
  if (fileName.indexOf("fatura") >= 0) return true;

  return false;
}

function GFP_AUDIT_getCashMonth_15_4_(parsed) {
  const meta = parsed.metadata || {};

  return String(
    meta.cashMonth ||
    meta.invoiceReference ||
    meta.competenciaCaixa ||
    ""
  ).trim();
}

function GFP_AUDIT_pushActiveKey_15_4_(index, key, parsed) {
  if (!key) return;

  if (!index[key]) index[key] = [];

  index[key].push(parsed);
}

function GFP_AUDIT_addParsedIssue_15_4_(issues, severity, code, parsed, detail) {
  GFP_AUDIT_addIssue_15_4_(
    issues,
    severity,
    code,
    parsed.sheetName,
    parsed.rowNumber,
    parsed.id,
    parsed.hash,
    parsed.date,
    parsed.description,
    parsed.value,
    parsed.type,
    parsed.account,
    parsed.category,
    parsed.status,
    detail
  );
}

function GFP_AUDIT_addIssue_15_4_(issues, severity, code, sheetName, rowNumber, id, hash, date, description, value, type, account, category, status, detail) {
  issues.push({
    timestamp: new Date(),
    severity: severity,
    code: code,
    sheetName: sheetName,
    rowNumber: rowNumber,
    id: id,
    hash: hash,
    date: date,
    description: description,
    value: value,
    type: type,
    account: account,
    category: category,
    status: status,
    detail: detail
  });
}

function GFP_AUDIT_writeReport_15_4_(ss, issues, stats) {
  const name = "SYS_AUDITORIA_GFP";
  let sheet = ss.getSheetByName(name);

  if (!sheet) sheet = ss.insertSheet(name);

  sheet.clear();

  const header = [
    "TIMESTAMP",
    "GRAVIDADE",
    "CODIGO",
    "ABA",
    "LINHA",
    "ID_TRANSACAO",
    "HASH_LINHA",
    "DATA",
    "DESCRICAO",
    "VALOR",
    "TIPO",
    "CONTA",
    "CATEGORIA",
    "STATUS",
    "DETALHE"
  ];

  const rows = issues.map(function(x) {
    return [
      x.timestamp,
      x.severity,
      x.code,
      x.sheetName,
      x.rowNumber,
      x.id,
      x.hash,
      x.date,
      x.description,
      x.value,
      x.type,
      x.account,
      x.category,
      x.status,
      x.detail
    ];
  });

  sheet.getRange(1, 1, 1, header.length).setValues([header]);

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  }

  sheet.getRange(1, 1, 1, header.length)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  sheet.setFrozenRows(1);

  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getDataRange().createFilter();

  sheet.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sheet.getRange("H:H").setNumberFormat("dd/mm/yyyy");
  sheet.getRange("J:J").setNumberFormat("R$ #,##0.00;[Red]-R$ #,##0.00");

  try { sheet.autoResizeColumns(1, header.length); } catch (eResize) {}

  sheet.getRange("Q1").setValue("RESUMO");
  sheet.getRange("Q2").setValue(JSON.stringify(stats));
}

function GFP_AUDIT_parseJson_15_4_(value) {
  if (!value) return {};

  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}

function GFP_AUDIT_norm_15_4_(value) {
  return String(value == null ? "" : value)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Correção simples solicitada:
 * K:S ocultas, T/HIST_STATUS sempre visível.
 */
function GFP_MANTER_HIST_STATUS_VISIVEL_15_4(options) {
  options = options || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const histName = typeof GFP_DATALAKE_HIST_SHEET_15_2 !== "undefined"
    ? GFP_DATALAKE_HIST_SHEET_15_2
    : "DB_TRANSACOES_HIST";

  const hist = ss.getSheetByName(histName);

  if (!hist) {
    if (!options.silent) {
      ss.toast("DB_TRANSACOES_HIST não encontrada.", "GFP Histórico");
    }

    return { ok: false, error: "DB_TRANSACOES_HIST não encontrada." };
  }

  try { hist.hideColumns(11, 9); } catch (eHide) {}
  try { hist.showColumns(20); } catch (eShow) {}
  try { hist.setColumnWidth(20, 120); } catch (eWidth) {}

  if (!options.silent) {
    ss.toast("K:S ocultas e T/HIST_STATUS visível.", "GFP Histórico");
  }

  return { ok: true };
}

/**
 * =============================================================================
 * GFP 15.4.1 — HELPERS DE AUDITORIA MAIS INTELIGENTES
 * =============================================================================
 */

function GFP_AUDIT_isConfirmedStatus_15_4_1_(status) {
  status = String(status || "").trim().toUpperCase();

  return status === "OK" ||
         status === "CONCILIADO" ||
         status === "VALIDADO" ||
         status === "APROVADO";
}

function GFP_AUDIT_isTransferCategory_15_4_1_(category) {
  const c = String(category || "").trim();
  const n = c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (/^99(?:\.| —| -|$)/.test(c)) return true;

  return n.indexOf("transferencia") >= 0 ||
         n.indexOf("movimentacao interna") >= 0 ||
         n.indexOf("movimentacao entre contas") >= 0 ||
         n.indexOf("pagamento de fatura") >= 0 ||
         n.indexOf("fatura") >= 0 ||
         n.indexOf("aplicacao") >= 0 ||
         n.indexOf("resgate") >= 0 ||
         n.indexOf("saldo inicial") >= 0 ||
         n.indexOf("ajuste de saldo") >= 0;
}

function GFP_AUDIT_metadataLooksInconsistent_15_4_1_(parsed) {
  const meta = parsed.metadata || {};

  // Se já houve override manual de cashMonth, não martela esse alerta.
  if (meta.cashMonthSource === "AJUSTE_MANUAL_15.4.1" || meta.dreDatePolicy === "MANUAL_CASH_MONTH") {
    return false;
  }

  const desc = String(parsed.description || "").toLowerCase();
  const account = String(parsed.account || "").toLowerCase();
  const fileName = String(meta.fileName || meta.invoiceFileName || "").toLowerCase();
  const origin = String(meta.origin || "").toLowerCase();
  const bankName = String(meta.bankName || meta.invoiceBankName || "").toLowerCase();

  const looksCardLine =
    account.indexOf("cartão") >= 0 ||
    account.indexOf("cartao") >= 0 ||
    /parc\d{2}\/\d{2}/i.test(desc) ||
    /parc\d+\/\d+/i.test(desc);

  const metadataLooksAccountCsv =
    fileName.indexOf(".csv") >= 0 &&
    (
      origin.indexOf("conta") >= 0 ||
      bankName.indexOf("conta") >= 0 ||
      origin.indexOf("csv_import") >= 0
    );

  return looksCardLine && metadataLooksAccountCsv;
}

/**
 * Ajusta cashMonth de uma linha específica da DB_TRANSACOES sem apagar os
 * metadados existentes.
 *
 * Exemplo para a linha 12:
 *
 *   GFP_CORRIGIR_CASHMONTH_LINHA_15_4_1(12, "2026-02")
 */
function GFP_CORRIGIR_CASHMONTH_LINHA_15_4_1(rowNumber, cashMonth) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("DB_TRANSACOES");

  if (!sheet) {
    ss.toast("DB_TRANSACOES não encontrada.", "GFP 15.4.1");
    return { ok: false, error: "DB_TRANSACOES não encontrada." };
  }

  rowNumber = Number(rowNumber || 0);
  cashMonth = String(cashMonth || "").trim();

  if (!rowNumber || rowNumber < 2) {
    ss.toast("Linha inválida.", "GFP 15.4.1");
    return { ok: false, error: "Linha inválida." };
  }

  if (!/^\d{4}-\d{2}$/.test(cashMonth)) {
    ss.toast("cashMonth inválido. Use AAAA-MM, ex.: 2026-02.", "GFP 15.4.1");
    return { ok: false, error: "cashMonth inválido." };
  }

  const row = sheet.getRange(rowNumber, 1, 1, 14).getValues()[0];
  const oldMetaText = String(row[13] || "");
  const meta = GFP_AUDIT_parseJson_15_4_(oldMetaText);

  meta.cashMonth = cashMonth;
  meta.dreDatePolicy = "MANUAL_CASH_MONTH";
  meta.cashMonthSource = "AJUSTE_MANUAL_15.4.1";
  meta.cashMonthAdjustedAt = new Date().toISOString();
  meta.cashMonthNote = "Ajuste manual seguro: lançamento pertence ao caixa " + cashMonth + ".";

  meta.cashMonthAdjustedFromRow = {
    sheet: "DB_TRANSACOES",
    row: rowNumber,
    data: row[0],
    descricao: row[1],
    valor: row[2],
    tipo: row[3],
    conta: row[4],
    categoria: row[5],
    parcAtual: row[6],
    parcTotal: row[7],
    status: row[8],
    idTransacao: row[10],
    hashLinha: row[12],
    patch: "15.4.1"
  };

  sheet.getRange(rowNumber, 14).setValue(JSON.stringify(meta));

  ss.toast("cashMonth ajustado para " + cashMonth + " na linha " + rowNumber + ".", "GFP 15.4.1");

  return {
    ok: true,
    rowNumber: rowNumber,
    cashMonth: cashMonth,
    oldMetadata: oldMetaText,
    newMetadata: meta
  };
}

/**
 * Atalho específico para o caso informado:
 * Linha 12 → caixa 2026-02.
 */
function GFP_CORRIGIR_CASHMONTH_LINHA_12_2026_02() {
  return GFP_CORRIGIR_CASHMONTH_LINHA_15_4_1(12, "2026-02");
}

/**
 * =============================================================================
 * 🛡️ GFP 15.7.0 — IMPORT GUARD / PRÉ-CHECK DA BASE FINAL
 * =============================================================================
 *
 * Contrato oficial para importadores:
 *
 * - toda linha nova deve ter 14 colunas A:N;
 * - deve ter ID_TRANSACAO e/ou HASH_LINHA;
 * - deve verificar duplicidade contra DB_TRANSACOES + DB_TRANSACOES_HIST;
 * - histórico DESARQUIVADO não bloqueia reimportação, mas histórico ARQUIVADO bloqueia;
 * - gera relatório de pré-check em SYS_PRECHECK_BASE_FINAL.
 * =============================================================================
 */

const GFP_IMPORT_GUARD_VERSION_15_7 = "15.7.0";

function GFP_PRECHECK_BASE_FINAL_15_7() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const issues = [];
  const stats = {
    version: GFP_IMPORT_GUARD_VERSION_15_7,
    generatedAt: new Date().toISOString(),
    sheetsOk: 0,
    sheetsMissing: 0,
    workRows: 0,
    histRows: 0,
    activeDuplicateGroups: 0,
    missingKeysWork: 0,
    missingKeysHist: 0,
    invalidHistStatus: 0,
    importGuardReady: false,
    datalakeReady: false,
    autoArchiveReady: false,
    dashboardReady: false,
    reviewPanelReady: false
  };

  const work = ss.getSheetByName("DB_TRANSACOES");
  const hist = ss.getSheetByName("DB_TRANSACOES_HIST");
  const log = ss.getSheetByName("LOG_ARQUIVAMENTO");

  if (!work) {
    stats.sheetsMissing++;
    GFP_PRECHECK_addIssue_15_7_(issues, "FATAL", "ABA_AUSENTE", "DB_TRANSACOES", "", "", "", "", "Aba DB_TRANSACOES ausente.");
  } else {
    stats.sheetsOk++;
    GFP_PRECHECK_checkHeader_15_7_(issues, work, "WORK");
  }

  if (!hist) {
    stats.sheetsMissing++;
    GFP_PRECHECK_addIssue_15_7_(issues, "FATAL", "ABA_AUSENTE", "DB_TRANSACOES_HIST", "", "", "", "", "Aba DB_TRANSACOES_HIST ausente.");
  } else {
    stats.sheetsOk++;
    GFP_PRECHECK_checkHeader_15_7_(issues, hist, "HIST");
  }

  if (!log) {
    GFP_PRECHECK_addIssue_15_7_(issues, "WARN", "ABA_LOG_AUSENTE", "LOG_ARQUIVAMENTO", "", "", "", "", "Aba LOG_ARQUIVAMENTO ausente. Ela será recriada pelas rotinas de histórico quando necessário.");
  }

  stats.importGuardReady = typeof GFP_IMPORT_GUARD_CAN_APPEND_15_7 === "function";
  stats.datalakeReady = typeof GFP_DATALAKE_GET_ACTIVE_ROWS_15_2 === "function" &&
                        typeof GFP_DATALAKE_GET_EXISTING_KEYS_15_2 === "function";
  stats.autoArchiveReady = typeof GFP_AUTO_ARQUIVAR_OKS_MESA_15_3 === "function";
  stats.dashboardReady = typeof apiDashboardV2GetData === "function";
  stats.reviewPanelReady = typeof GFP_REVIEW_PANEL_V2_AUDITAR_15_6 === "function";

  if (!stats.datalakeReady) {
    GFP_PRECHECK_addIssue_15_7_(issues, "FATAL", "DATALAKE_INCOMPLETO", "", "", "", "", "", "Helpers do datalake não encontrados.");
  }

  if (!stats.autoArchiveReady) {
    GFP_PRECHECK_addIssue_15_7_(issues, "WARN", "AUTO_ARQUIVAMENTO_AUSENTE", "", "", "", "", "", "GFP_AUTO_ARQUIVAR_OKS_MESA_15_3 não encontrada.");
  }

  if (!stats.dashboardReady) {
    GFP_PRECHECK_addIssue_15_7_(issues, "WARN", "DASHBOARD_API_AUSENTE", "", "", "", "", "", "apiDashboardV2GetData não encontrada.");
  }

  const activeIndex = {};

  if (work && work.getLastRow() >= 2) {
    const values = work.getRange(2, 1, work.getLastRow() - 1, 14).getValues();
    stats.workRows = values.length;

    values.forEach(function(row, idx) {
      const rowNumber = idx + 2;
      const parsed = GFP_PRECHECK_parseBaseRow_15_7_(row, "DB_TRANSACOES", rowNumber, false);

      if (!parsed.key) {
        stats.missingKeysWork++;
        GFP_PRECHECK_addParsedIssue_15_7_(issues, "WARN", "WORK_SEM_ID_HASH", parsed, "Linha na mesa sem ID_TRANSACAO e sem HASH_LINHA.");
      } else {
        GFP_PRECHECK_pushKey_15_7_(activeIndex, parsed.key, parsed);
      }
    });
  }

  if (hist && hist.getLastRow() >= 2) {
    const values = hist.getRange(2, 1, hist.getLastRow() - 1, 20).getValues();
    stats.histRows = values.length;

    values.forEach(function(fullRow, idx) {
      const rowNumber = idx + 2;
      const parsed = GFP_PRECHECK_parseBaseRow_15_7_(fullRow.slice(0, 14), "DB_TRANSACOES_HIST", rowNumber, true);
      parsed.histStatus = GFP_PRECHECK_norm_15_7_(fullRow[19]);

      if (parsed.histStatus !== "ARQUIVADO" && parsed.histStatus !== "DESARQUIVADO") {
        stats.invalidHistStatus++;
        GFP_PRECHECK_addParsedIssue_15_7_(issues, "WARN", "HIST_STATUS_INVALIDO", parsed, "HIST_STATUS deve ser ARQUIVADO ou DESARQUIVADO. Atual: " + parsed.histStatus);
      }

      if (!parsed.key) {
        stats.missingKeysHist++;
        GFP_PRECHECK_addParsedIssue_15_7_(issues, "WARN", "HIST_SEM_ID_HASH", parsed, "Linha no histórico sem ID_TRANSACAO e sem HASH_LINHA.");
      } else if (parsed.histStatus === "ARQUIVADO") {
        GFP_PRECHECK_pushKey_15_7_(activeIndex, parsed.key, parsed);
      }
    });
  }

  Object.keys(activeIndex).forEach(function(key) {
    const list = activeIndex[key];

    if (list.length <= 1) return;

    stats.activeDuplicateGroups++;

    const detail = list.map(function(x) {
      return x.sheetName + "!" + x.rowNumber;
    }).join(" | ");

    list.forEach(function(parsed) {
      GFP_PRECHECK_addParsedIssue_15_7_(
        issues,
        "FATAL",
        "DUPLICIDADE_ATIVA",
        parsed,
        "Mesmo ID/HASH ativo em mais de uma origem: " + detail
      );
    });
  });

  GFP_PRECHECK_writeReport_15_7_(ss, issues, stats);

  if (typeof GFP_MANTER_HIST_STATUS_VISIVEL_15_7 === "function") {
    GFP_MANTER_HIST_STATUS_VISIVEL_15_7({ silent: true });
  } else if (typeof GFP_MANTER_HIST_STATUS_VISIVEL_15_6 === "function") {
    GFP_MANTER_HIST_STATUS_VISIVEL_15_6({ silent: true });
  }

  ss.toast(
    "Pré-check 15.7: " + issues.length + " apontamento(s), duplicidades ativas: " + stats.activeDuplicateGroups + ".",
    "GFP 15.7"
  );

  return {
    ok: stats.activeDuplicateGroups === 0 && stats.sheetsMissing === 0,
    stats: stats,
    issues: issues
  };
}

/**
 * Guard oficial para importadores.
 *
 * Uso recomendado dentro dos importadores ANTES de appendRow:
 *
 *   const guard = GFP_IMPORT_GUARD_CAN_APPEND_15_7(row);
 *   if (!guard.ok) { ...não importa... }
 *
 * A linha deve ter pelo menos A:N.
 */
function GFP_IMPORT_GUARD_CAN_APPEND_15_7(row, options) {
  options = options || {};
  row = GFP_IMPORT_GUARD_normalizeRow_15_7_(row);

  const id = String(row[10] || "").trim();
  const hash = String(row[12] || "").trim();

  const result = {
    ok: true,
    version: GFP_IMPORT_GUARD_VERSION_15_7,
    action: "APPEND_ALLOWED",
    id: id,
    hash: hash,
    reason: ""
  };

  if (!id && !hash && !options.allowMissingKey) {
    result.ok = false;
    result.action = "BLOCK";
    result.reason = "Linha sem ID_TRANSACAO e sem HASH_LINHA.";
    return result;
  }

  let existing = null;

  try {
    if (typeof GFP_DATALAKE_GET_EXISTING_KEYS_15_2 === "function") {
      existing = GFP_DATALAKE_GET_EXISTING_KEYS_15_2({
        includeWork: true,
        includeHist: true
      });
    }
  } catch (e) {
    existing = null;
  }

  if (!existing) {
    result.ok = true;
    result.action = "APPEND_ALLOWED_WITHOUT_FULL_GUARD";
    result.reason = "Não foi possível consultar as chaves existentes. Importador deve registrar alerta.";
    return result;
  }

  const keys = [];
  if (id) {
    keys.push(id);
    keys.push("ID:" + id);
  }
  if (hash) {
    keys.push(hash);
    keys.push("HASH:" + hash);
  }

  const duplicated = keys.some(function(k) {
    return existing.has(k);
  });

  if (duplicated) {
    result.ok = false;
    result.action = "BLOCK_DUPLICATE";
    result.reason = "ID/HASH já existe em DB_TRANSACOES ou DB_TRANSACOES_HIST ativo.";
  }

  return result;
}

/**
 * Append seguro para importadores futuros.
 *
 * Não substitui os importadores agora, mas vira contrato oficial para a fase final.
 */
function GFP_IMPORT_GUARD_APPEND_ROWS_15_7(rows, options) {
  options = options || {};
  rows = rows || [];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const work = ss.getSheetByName("DB_TRANSACOES") || ss.insertSheet("DB_TRANSACOES");
  const log = GFP_IMPORT_GUARD_ensureLog_15_7_();

  const result = {
    ok: true,
    version: GFP_IMPORT_GUARD_VERSION_15_7,
    source: options.source || "IMPORT_GUARD_APPEND",
    requested: rows.length,
    appended: 0,
    skipped: 0,
    blocked: [],
    startedAt: new Date().toISOString()
  };

  rows.forEach(function(inputRow) {
    const row = GFP_IMPORT_GUARD_normalizeRow_15_7_(inputRow);
    const guard = GFP_IMPORT_GUARD_CAN_APPEND_15_7(row, options);

    if (!guard.ok) {
      result.skipped++;
      result.blocked.push({
        id: guard.id,
        hash: guard.hash,
        reason: guard.reason,
        row: row
      });
      return;
    }

    work.appendRow(row);
    result.appended++;
  });

  result.finishedAt = new Date().toISOString();

  log.appendRow([
    new Date(),
    result.source,
    result.requested,
    result.appended,
    result.skipped,
    JSON.stringify(result)
  ]);

  return result;
}

function GFP_IMPORT_GUARD_normalizeRow_15_7_(row) {
  row = Array.isArray(row) ? row.slice() : [];

  while (row.length < 14) row.push("");

  if (row.length > 14) row = row.slice(0, 14);

  return row;
}

function GFP_IMPORT_GUARD_ensureLog_15_7_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("LOG_IMPORT_GUARD");

  if (!sh) {
    sh = ss.insertSheet("LOG_IMPORT_GUARD");
    sh.getRange(1, 1, 1, 6).setValues([[
      "TIMESTAMP",
      "SOURCE",
      "REQUESTED",
      "APPENDED",
      "SKIPPED",
      "DETAILS_JSON"
    ]]);

    sh.getRange(1, 1, 1, 6)
      .setFontWeight("bold")
      .setBackground("#1f4e78")
      .setFontColor("#ffffff");

    sh.setFrozenRows(1);
  }

  return sh;
}

function GFP_PRECHECK_checkHeader_15_7_(issues, sheet, mode) {
  const expectedBase = [
    "DATA",
    "DESCRICAO",
    "VALOR",
    "TIPO",
    "CONTA",
    "CATEGORIA",
    "PARC_ATUAL",
    "PARC_TOTAL",
    "STATUS",
    "NOTAS",
    "ID_TRANSACAO",
    "ID_ARQUIVO",
    "HASH_LINHA",
    "METADADOS"
  ];

  const expectedHistExtra = [
    "ARCHIVED_AT",
    "ARCHIVED_BY",
    "ARCHIVE_BATCH_ID",
    "SOURCE_SHEET",
    "SOURCE_ROW",
    "HIST_STATUS"
  ];

  const expected = mode === "HIST"
    ? expectedBase.concat(expectedHistExtra)
    : expectedBase;

  const width = expected.length;
  const actual = sheet.getRange(1, 1, 1, width).getValues()[0].map(function(v) {
    return String(v || "").trim().toUpperCase();
  });

  expected.forEach(function(name, idx) {
    if (actual[idx] !== name) {
      GFP_PRECHECK_addIssue_15_7_(
        issues,
        "WARN",
        "CABECALHO_DIVERGENTE",
        sheet.getName(),
        1,
        "",
        "",
        "",
        "Coluna " + (idx + 1) + " esperada: " + name + " | atual: " + actual[idx]
      );
    }
  });
}

function GFP_PRECHECK_parseBaseRow_15_7_(row, sheetName, rowNumber, archived) {
  const id = String(row[10] || "").trim();
  const hash = String(row[12] || "").trim();

  return {
    sheetName: sheetName,
    rowNumber: rowNumber,
    archived: !!archived,
    date: row[0],
    description: String(row[1] || ""),
    value: row[2],
    type: GFP_PRECHECK_norm_15_7_(row[3]),
    account: String(row[4] || ""),
    category: String(row[5] || ""),
    status: GFP_PRECHECK_norm_15_7_(row[8]),
    id: id,
    hash: hash,
    key: id || hash
  };
}

function GFP_PRECHECK_pushKey_15_7_(index, key, parsed) {
  if (!key) return;

  if (!index[key]) index[key] = [];

  index[key].push(parsed);
}

function GFP_PRECHECK_addParsedIssue_15_7_(issues, severity, code, parsed, detail) {
  GFP_PRECHECK_addIssue_15_7_(
    issues,
    severity,
    code,
    parsed.sheetName,
    parsed.rowNumber,
    parsed.id,
    parsed.hash,
    parsed.description,
    detail
  );
}

function GFP_PRECHECK_addIssue_15_7_(issues, severity, code, sheetName, rowNumber, id, hash, description, detail) {
  issues.push([
    new Date(),
    severity,
    code,
    sheetName,
    rowNumber,
    id,
    hash,
    description,
    detail
  ]);
}

function GFP_PRECHECK_writeReport_15_7_(ss, issues, stats) {
  const name = "SYS_PRECHECK_BASE_FINAL";
  let sh = ss.getSheetByName(name);

  if (!sh) sh = ss.insertSheet(name);

  sh.clear();

  const header = [
    "TIMESTAMP",
    "GRAVIDADE",
    "CODIGO",
    "ABA",
    "LINHA",
    "ID_TRANSACAO",
    "HASH_LINHA",
    "DESCRICAO",
    "DETALHE"
  ];

  sh.getRange(1, 1, 1, header.length).setValues([header]);

  if (issues.length) {
    sh.getRange(2, 1, issues.length, header.length).setValues(issues);
  }

  sh.getRange(1, 1, 1, header.length)
    .setFontWeight("bold")
    .setBackground("#1f4e78")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);

  if (sh.getFilter()) sh.getFilter().remove();
  sh.getDataRange().createFilter();

  sh.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss");

  try { sh.autoResizeColumns(1, header.length); } catch (eResize) {}

  sh.getRange("K1").setValue("RESUMO");
  sh.getRange("K2").setValue(JSON.stringify(stats));
}

function GFP_PRECHECK_norm_15_7_(value) {
  return String(value == null ? "" : value)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * =============================================================================
 * 🩺 GFP 15.8.0 — SAÚDE GERAL DO SISTEMA
 * =============================================================================
 *
 * Rotina central de manutenção.
 *
 * Não altera lançamentos transacionais.
 * Não zera base.
 * Não importa dados.
 *
 * Cria/atualiza:
 *
 *   SYS_SAUDE_GFP
 * =============================================================================
 */

const GFP_SAUDE_GERAL_VERSION_15_8 = "15.8.0";

function GFP_SAUDE_GERAL_15_8(options) {
  options = options || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const startedAt = new Date();
  const rows = [];
  const details = [];

  const summary = {
    version: GFP_SAUDE_GERAL_VERSION_15_8,
    startedAt: startedAt.toISOString(),
    finishedAt: "",
    status: "OK",
    totalChecks: 0,
    ok: 0,
    warn: 0,
    fatal: 0,
    errors: 0
  };

  function pushRow(area, check, severity, status, message, extra) {
    severity = String(severity || "INFO").toUpperCase();

    rows.push([
      new Date(),
      area,
      check,
      severity,
      status,
      message,
      extra ? JSON.stringify(extra) : ""
    ]);

    summary.totalChecks++;

    if (severity === "FATAL") summary.fatal++;
    else if (severity === "WARN") summary.warn++;
    else if (severity === "ERROR") summary.errors++;
    else summary.ok++;
  }

  // ---------------------------------------------------------------------------
  // 1. Dependências principais
  // ---------------------------------------------------------------------------
  const dependencies = [
    ["DATALAKE_ACTIVE_ROWS", "GFP_DATALAKE_GET_ACTIVE_ROWS_15_2"],
    ["DATALAKE_EXISTING_KEYS", "GFP_DATALAKE_GET_EXISTING_KEYS_15_2"],
    ["AUTO_ARCHIVE", "GFP_AUTO_ARQUIVAR_OKS_MESA_15_3"],
    ["AUDIT_IMPORTADORES", "GFP_AUDITAR_IMPORTADORES_ANTIDUP_15_4"],
    ["AUDIT_DASHBOARD", "GFP_DASHBOARD_V2_AUDITAR_15_5"],
    ["AUDIT_REVIEW_PANEL", "GFP_REVIEW_PANEL_V2_AUDITAR_15_6"],
    ["PRECHECK_BASE_FINAL", "GFP_PRECHECK_BASE_FINAL_15_7"],
    ["SNAPSHOT_BASE_FINAL", "GFP_BASE_FINAL_CRIAR_SNAPSHOT_15_7"],
    ["HIST_STATUS_VISIBLE", "GFP_MANTER_HIST_STATUS_VISIVEL_15_8"],
    ["HIST_PROTECTION", "GFP_PROTEGER_HISTORICO_INTEIRO_15_2_4"]
  ];

  dependencies.forEach(function(dep) {
    const label = dep[0];
    const fn = dep[1];

    if (typeof globalThis[fn] === "function") {
      pushRow("DEPENDENCIAS", label, "INFO", "OK", "Função disponível: " + fn, {});
    } else {
      pushRow("DEPENDENCIAS", label, "WARN", "AUSENTE", "Função não encontrada: " + fn, {});
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Estrutura de abas principais
  // ---------------------------------------------------------------------------
  const requiredSheets = [
    "DB_TRANSACOES",
    "DB_TRANSACOES_HIST"
  ];

  requiredSheets.forEach(function(name) {
    const sh = ss.getSheetByName(name);

    if (sh) {
      pushRow("ESTRUTURA", name, "INFO", "OK", "Aba encontrada. Linhas: " + sh.getLastRow(), {
        lastRow: sh.getLastRow(),
        lastColumn: sh.getLastColumn()
      });
    } else {
      pushRow("ESTRUTURA", name, "FATAL", "AUSENTE", "Aba obrigatória não encontrada.", {});
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Auditorias existentes
  // ---------------------------------------------------------------------------
  const auditCalls = [
    ["AUDITORIA_IMPORTADORES_ANTIDUP", "GFP_AUDITAR_IMPORTADORES_ANTIDUP_15_4"],
    ["AUDITORIA_DASHBOARD_2", "GFP_DASHBOARD_V2_AUDITAR_15_5"],
    ["AUDITORIA_PAINEL_REVISAO_2", "GFP_REVIEW_PANEL_V2_AUDITAR_15_6"],
    ["PRECHECK_BASE_FINAL", "GFP_PRECHECK_BASE_FINAL_15_7"]
  ];

  auditCalls.forEach(function(call) {
    const label = call[0];
    const fnName = call[1];

    if (typeof globalThis[fnName] !== "function") {
      pushRow("AUDITORIAS", label, "WARN", "PULADO", "Função ausente: " + fnName, {});
      return;
    }

    try {
      const result = globalThis[fnName]();

      const issueCount = GFP_SAUDE_extractIssueCount_15_8_(result);
      const severity = GFP_SAUDE_extractSeverity_15_8_(result, issueCount);

      pushRow(
        "AUDITORIAS",
        label,
        severity,
        result && result.ok === false ? "COM_ALERTA" : "EXECUTADO",
        "Auditoria executada. Apontamentos: " + issueCount,
        result && result.stats ? result.stats : result
      );

      details.push({
        label: label,
        result: result
      });

    } catch (e) {
      pushRow("AUDITORIAS", label, "ERROR", "ERRO", e.message, {
        stack: e.stack || ""
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Histórico: T visível + proteção
  // ---------------------------------------------------------------------------
  try {
    if (typeof GFP_MANTER_HIST_STATUS_VISIVEL_15_8 === "function") {
      const r = GFP_MANTER_HIST_STATUS_VISIVEL_15_8({ silent: true });
      pushRow("HISTORICO", "HIST_STATUS_VISIVEL", r && r.ok ? "INFO" : "WARN", r && r.ok ? "OK" : "ALERTA", "K:S ocultas e T visível.", r);
    } else if (typeof GFP_MANTER_HIST_STATUS_VISIVEL_15_7 === "function") {
      const r = GFP_MANTER_HIST_STATUS_VISIVEL_15_7({ silent: true });
      pushRow("HISTORICO", "HIST_STATUS_VISIVEL", r && r.ok ? "INFO" : "WARN", r && r.ok ? "OK" : "ALERTA", "K:S ocultas e T visível via 15.7.", r);
    } else {
      pushRow("HISTORICO", "HIST_STATUS_VISIVEL", "WARN", "PULADO", "Nenhuma função de visibilidade encontrada.", {});
    }
  } catch (eHistVis) {
    pushRow("HISTORICO", "HIST_STATUS_VISIVEL", "ERROR", "ERRO", eHistVis.message, {
      stack: eHistVis.stack || ""
    });
  }

  try {
    if (typeof GFP_PROTEGER_HISTORICO_INTEIRO_15_2_4 === "function") {
      const r = GFP_PROTEGER_HISTORICO_INTEIRO_15_2_4();
      pushRow("HISTORICO", "PROTECAO_WARNING_ONLY", "INFO", "EXECUTADO", "Proteção warning-only reaplicada no histórico.", r);
    } else {
      pushRow("HISTORICO", "PROTECAO_WARNING_ONLY", "WARN", "PULADO", "Função GFP_PROTEGER_HISTORICO_INTEIRO_15_2_4 não encontrada.", {});
    }
  } catch (eProt) {
    pushRow("HISTORICO", "PROTECAO_WARNING_ONLY", "ERROR", "ERRO", eProt.message, {
      stack: eProt.stack || ""
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Resultado final
  // ---------------------------------------------------------------------------
  summary.finishedAt = new Date().toISOString();

  if (summary.fatal > 0 || summary.errors > 0) {
    summary.status = "CRITICO";
  } else if (summary.warn > 0) {
    summary.status = "ATENCAO";
  } else {
    summary.status = "OK";
  }

  GFP_SAUDE_writeReport_15_8_(ss, rows, summary, details);

  ss.toast(
    "Saúde GFP: " + summary.status + " | checks: " + summary.totalChecks + " | alertas: " + summary.warn + " | críticos: " + summary.fatal,
    "GFP 15.8"
  );

  return {
    ok: summary.status !== "CRITICO",
    summary: summary,
    details: details
  };
}

/**
 * Versão rápida: não roda auditorias completas, só estrutura, visibilidade e módulos.
 */
function GFP_SAUDE_RAPIDA_15_8() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = [];

  const checks = [
    ["DB_TRANSACOES", !!ss.getSheetByName("DB_TRANSACOES")],
    ["DB_TRANSACOES_HIST", !!ss.getSheetByName("DB_TRANSACOES_HIST")],
    ["DATALAKE", typeof GFP_DATALAKE_GET_ACTIVE_ROWS_15_2 === "function"],
    ["AUTO_ARCHIVE", typeof GFP_AUTO_ARQUIVAR_OKS_MESA_15_3 === "function"],
    ["DASHBOARD", typeof apiDashboardV2GetData === "function"],
    ["REVIEW_PANEL_AUDIT", typeof GFP_REVIEW_PANEL_V2_AUDITAR_15_6 === "function"],
    ["IMPORT_GUARD", typeof GFP_IMPORT_GUARD_CAN_APPEND_15_7 === "function"]
  ];

  checks.forEach(function(c) {
    rows.push([
      new Date(),
      "SAUDE_RAPIDA",
      c[0],
      c[1] ? "INFO" : "WARN",
      c[1] ? "OK" : "AUSENTE",
      c[1] ? "Disponível." : "Não encontrado.",
      ""
    ]);
  });

  try {
    if (typeof GFP_MANTER_HIST_STATUS_VISIVEL_15_8 === "function") {
      GFP_MANTER_HIST_STATUS_VISIVEL_15_8({ silent: true });
    } else if (typeof GFP_MANTER_HIST_STATUS_VISIVEL_15_7 === "function") {
      GFP_MANTER_HIST_STATUS_VISIVEL_15_7({ silent: true });
    }
  } catch (e) {}

  const summary = {
    version: GFP_SAUDE_GERAL_VERSION_15_8,
    mode: "RAPIDA",
    generatedAt: new Date().toISOString(),
    totalChecks: checks.length,
    missing: checks.filter(function(c) { return !c[1]; }).length
  };

  GFP_SAUDE_writeReport_15_8_(ss, rows, summary, []);

  ss.toast(
    "Saúde rápida GFP: " + (summary.missing ? summary.missing + " ausência(s)" : "OK"),
    "GFP 15.8"
  );

  return {
    ok: summary.missing === 0,
    summary: summary
  };
}

function GFP_SAUDE_extractIssueCount_15_8_(result) {
  if (!result) return 0;

  if (Array.isArray(result.issues)) return result.issues.length;

  if (result.stats) {
    if (result.stats.issues != null) return Number(result.stats.issues || 0);
    if (result.stats.fatal != null || result.stats.warn != null || result.stats.info != null) {
      return Number(result.stats.fatal || 0) + Number(result.stats.warn || 0) + Number(result.stats.info || 0);
    }
  }

  return 0;
}

function GFP_SAUDE_extractSeverity_15_8_(result, issueCount) {
  if (!result) return "WARN";

  if (result.ok === false) return "WARN";

  const stats = result.stats || {};

  if (Number(stats.fatal || 0) > 0 || Number(stats.activeDuplicateGroups || 0) > 0) return "FATAL";

  if (Number(stats.warn || 0) > 0 || Number(stats.missingCashMonthCard || 0) > 0 || Number(stats.okStillInWork || 0) > 0) return "WARN";

  if (issueCount > 0) return "WARN";

  return "INFO";
}

function GFP_SAUDE_writeReport_15_8_(ss, rows, summary, details) {
  const name = "SYS_SAUDE_GFP";
  let sh = ss.getSheetByName(name);

  if (!sh) sh = ss.insertSheet(name);

  sh.clear();

  const header = [
    "TIMESTAMP",
    "AREA",
    "CHECK",
    "GRAVIDADE",
    "STATUS",
    "MENSAGEM",
    "DETALHE_JSON"
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

  try { sh.autoResizeColumns(1, header.length); } catch (eResize) {}

  sh.getRange("I1").setValue("RESUMO");
  sh.getRange("I2").setValue(JSON.stringify(summary));

  sh.getRange("J1").setValue("DETALHES");
  sh.getRange("J2").setValue(JSON.stringify(details || []));
}

/**
 * =============================================================================
 * 🧹 GFP 15.9.0 — LIMPEZA TÉCNICA / MAPA OFICIAL DO PROJETO
 * =============================================================================
 *
 * Não deleta nada.
 * Não altera lançamentos.
 * Não altera histórico.
 *
 * Gera:
 *
 *   SYS_LIMPEZA_TECNICA_GFP
 * =============================================================================
 */

const GFP_LIMPEZA_TECNICA_VERSION_15_9 = "15.9.0";

function GFP_LIMPEZA_TECNICA_15_9() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const rows = [];
  const summary = {
    version: GFP_LIMPEZA_TECNICA_VERSION_15_9,
    generatedAt: new Date().toISOString(),
    officialTotal: 0,
    officialFound: 0,
    officialMissing: 0,
    legacyCandidatesChecked: 0,
    legacyCandidatesFound: 0,
    recommendedAction: "Mapear primeiro. Não remover nada automaticamente."
  };

  const official = GFP_LIMPEZA_TECNICA_officialFunctions_15_9_();
  const legacy = GFP_LIMPEZA_TECNICA_legacyCandidates_15_9_();
  const menu = GFP_LIMPEZA_TECNICA_recommendedMenu_15_9_();

  official.forEach(function(item) {
    const exists = typeof globalThis[item.fn] === "function";

    summary.officialTotal++;

    if (exists) summary.officialFound++;
    else summary.officialMissing++;

    rows.push([
      new Date(),
      "FUNCAO_OFICIAL",
      item.phase,
      item.module,
      item.file,
      item.fn,
      exists ? "OK" : "AUSENTE",
      item.note || ""
    ]);
  });

  legacy.forEach(function(item) {
    const exists = typeof globalThis[item.fn] === "function";

    summary.legacyCandidatesChecked++;

    if (exists) summary.legacyCandidatesFound++;

    rows.push([
      new Date(),
      "CANDIDATA_LEGADO",
      item.phase || "",
      item.module || "",
      item.file || "",
      item.fn,
      exists ? "ENCONTRADA" : "NÃO ENCONTRADA",
      item.note || "Candidata a avaliação manual, não remover automaticamente."
    ]);
  });

  menu.forEach(function(item) {
    rows.push([
      new Date(),
      "MENU_RECOMENDADO",
      "",
      item.group,
      "0_MAIN/menu.gs",
      item.wrapper || "",
      "REFERENCIA",
      item.label
    ]);
  });

  GFP_LIMPEZA_TECNICA_writeReport_15_9_(ss, rows, summary);

  ss.toast(
    "Limpeza técnica 15.9: oficiais OK " + summary.officialFound + "/" + summary.officialTotal + ". Legados encontrados: " + summary.legacyCandidatesFound + ".",
    "GFP 15.9"
  );

  return {
    ok: summary.officialMissing === 0,
    summary: summary,
    official: official,
    legacyCandidates: legacy,
    recommendedMenu: menu
  };
}

function GFP_LIMPEZA_TECNICA_officialFunctions_15_9_() {
  return [
    // -------------------------------------------------------------------------
    // 15.2 — Mesa + histórico protegido
    // -------------------------------------------------------------------------
    {
      phase: "15.2",
      module: "DATALAKE",
      file: "1_CORE/core_datalake.gs",
      fn: "GFP_DATALAKE_GET_ACTIVE_ROWS_15_2",
      note: "Fonte oficial para ler DB_TRANSACOES + DB_TRANSACOES_HIST."
    },
    {
      phase: "15.2",
      module: "DATALAKE",
      file: "1_CORE/core_datalake.gs",
      fn: "GFP_DATALAKE_GET_EXISTING_KEYS_15_2",
      note: "Chaves oficiais para anti-duplicidade contra mesa + histórico."
    },
    {
      phase: "15.2",
      module: "HISTORICO",
      file: "1_CORE/core_datalake.gs",
      fn: "GFP_ARQUIVAR_LINHAS_OK_15_2",
      note: "Arquivamento manual de linhas OK."
    },
    {
      phase: "15.2",
      module: "HISTORICO",
      file: "1_CORE/core_datalake.gs",
      fn: "GFP_ARQUIVAR_LINHAS_OK_SELECIONADAS_15_2",
      note: "Arquivamento manual de seleção."
    },
    {
      phase: "15.2",
      module: "HISTORICO",
      file: "1_CORE/core_datalake.gs",
      fn: "GFP_ABRIR_HISTORICO_ARQUIVADO_15_2_4",
      note: "Tela oficial de histórico/desarquivamento."
    },
    {
      phase: "15.2",
      module: "HISTORICO",
      file: "1_CORE/core_datalake.gs",
      fn: "GFP_PROTEGER_HISTORICO_INTEIRO_15_2_4",
      note: "Proteção warning-only do histórico."
    },

    // -------------------------------------------------------------------------
    // 15.3 — Arquivamento automático
    // -------------------------------------------------------------------------
    {
      phase: "15.3",
      module: "AUTO_ARCHIVE",
      file: "1_CORE/core_datalake.gs",
      fn: "GFP_AUTO_ARQUIVAR_LINHA_OK_15_3",
      note: "Arquivamento automático unitário."
    },
    {
      phase: "15.3",
      module: "AUTO_ARCHIVE",
      file: "1_CORE/core_datalake.gs",
      fn: "GFP_AUTO_ARQUIVAR_OKS_MESA_15_3",
      note: "Arquivamento automático em lote."
    },

    // -------------------------------------------------------------------------
    // 15.4 — Auditoria importadores / anti-dup
    // -------------------------------------------------------------------------
    {
      phase: "15.4",
      module: "AUDITORIA",
      file: "1_CORE/core_antidup.gs",
      fn: "GFP_AUDITAR_IMPORTADORES_ANTIDUP_15_4",
      note: "Auditoria oficial de importadores e anti-duplicidade."
    },

    // -------------------------------------------------------------------------
    // 15.5 — Dashboard 2.0
    // -------------------------------------------------------------------------
    {
      phase: "15.5",
      module: "DASHBOARD",
      file: "4_APP/backend_dashboard_v2.gs",
      fn: "apiDashboardV2GetData",
      note: "API oficial do Dashboard 2.0."
    },
    {
      phase: "15.5",
      module: "DASHBOARD",
      file: "4_APP/backend_dashboard_v2.gs",
      fn: "GFP_DASHBOARD_V2_AUDITAR_15_5",
      note: "Auditoria oficial do Dashboard 2.0."
    },

    // -------------------------------------------------------------------------
    // 15.6 — Painel de Revisão 2.0
    // -------------------------------------------------------------------------
    {
      phase: "15.6",
      module: "REVIEW_PANEL",
      file: "4_APP/backend_review_panel_v2_session_14_9_6.gs",
      fn: "apiReviewPanelV2CommitSession_14_9_6",
      note: "Commit oficial da fila temporária do Painel 2.0."
    },
    {
      phase: "15.6",
      module: "REVIEW_PANEL",
      file: "4_APP/backend_review_panel_v2_session_14_9_6.gs",
      fn: "GFP_REVIEW_PANEL_V2_AFTER_COMMIT_15_6_",
      note: "Pós-commit seguro com autoarquivamento."
    },
    {
      phase: "15.6",
      module: "REVIEW_PANEL",
      file: "4_APP/backend_review_panel_v2_session_14_9_6.gs",
      fn: "GFP_REVIEW_PANEL_V2_AUDITAR_15_6",
      note: "Auditoria oficial do Painel 2.0."
    },

    // -------------------------------------------------------------------------
    // 15.7 — Base final / import guard
    // -------------------------------------------------------------------------
    {
      phase: "15.7",
      module: "IMPORT_GUARD",
      file: "1_CORE/core_antidup.gs",
      fn: "GFP_IMPORT_GUARD_CAN_APPEND_15_7",
      note: "Contrato oficial para importadores."
    },
    {
      phase: "15.7",
      module: "BASE_FINAL",
      file: "1_CORE/core_antidup.gs",
      fn: "GFP_PRECHECK_BASE_FINAL_15_7",
      note: "Pré-check oficial da base final."
    },
    {
      phase: "15.7",
      module: "BASE_FINAL",
      file: "1_CORE/core_datalake.gs",
      fn: "GFP_BASE_FINAL_CRIAR_SNAPSHOT_15_7",
      note: "Snapshot interno antes da virada."
    },
    {
      phase: "15.7",
      module: "BASE_FINAL",
      file: "1_CORE/core_datalake.gs",
      fn: "GFP_BASE_FINAL_ZERAR_TRANSACIONAL_15_7",
      note: "Zeragem segura com código de confirmação."
    },

    // -------------------------------------------------------------------------
    // 15.8 — Saúde geral
    // -------------------------------------------------------------------------
    {
      phase: "15.8",
      module: "SAUDE",
      file: "1_CORE/core_antidup.gs",
      fn: "GFP_SAUDE_RAPIDA_15_8",
      note: "Check rápido do sistema."
    },
    {
      phase: "15.8",
      module: "SAUDE",
      file: "1_CORE/core_antidup.gs",
      fn: "GFP_SAUDE_GERAL_15_8",
      note: "Saúde geral do sistema."
    }
  ];
}

/**
 * Lista conservadora.
 *
 * Não significa "apagar".
 * Significa "se estiverem presentes, avaliar depois".
 */
function GFP_LIMPEZA_TECNICA_legacyCandidates_15_9_() {
  return [
    {
      phase: "14.9.2",
      module: "REVIEW_PANEL",
      file: "4_APP/backend_review_panel_v2_fast_14_9_2.gs",
      fn: "apiReviewPanelV2FastLoad_14_9_2",
      note: "Versão fast antiga. Verificar se ainda é chamada pelo HTML antes de remover."
    },
    {
      phase: "14.9.3",
      module: "REVIEW_PANEL",
      file: "4_APP/backend_review_panel_v2_fast_14_9_3.gs",
      fn: "apiReviewPanelV2FastCommit_14_9_3",
      note: "Versão fast antiga. Pode ainda existir como base do painel."
    },
    {
      phase: "14.9.6",
      module: "REVIEW_PANEL",
      file: "4_APP/backend_review_panel_v2_session_14_9_6.gs",
      fn: "apiReviewPanelV2CommitSession_14_9_6",
      note: "Apesar de 14.9.6, esta função está OFICIAL por enquanto. Não remover."
    },
    {
      phase: "15.2.1",
      module: "HISTORICO",
      file: "1_CORE/core_datalake.gs",
      fn: "GFP_ABRIR_HISTORICO_ARQUIVADO_15_2_1",
      note: "Alias antigo. Pode manter por compatibilidade; avaliar depois."
    },
    {
      phase: "15.4.1",
      module: "AJUSTE_MANUAL",
      file: "1_CORE/core_antidup.gs",
      fn: "GFP_CORRIGIR_CASHMONTH_LINHA_12_2026_02",
      note: "Atalho específico de base de teste. Candidato forte a remoção antes da 16.0."
    }
  ];
}

function GFP_LIMPEZA_TECNICA_recommendedMenu_15_9_() {
  return [
    {
      group: "Operação diária",
      label: "📥 Importar Extratos",
      wrapper: "importarExtratosWrapper"
    },
    {
      group: "Operação diária",
      label: "🧠 Painel de Revisão 2.0",
      wrapper: "abrirPainelRevisaoV2Wrapper"
    },
    {
      group: "Operação diária",
      label: "📊 Dashboard 2.0",
      wrapper: "abrirDashboardV2Wrapper"
    },
    {
      group: "Histórico",
      label: "🗃️ Histórico Arquivado / Desarquivar",
      wrapper: "openHistoricoArquivadoWrapper"
    },
    {
      group: "Histórico",
      label: "📦 Arquivar Linhas OK",
      wrapper: "archiveOkRowsWrapper"
    },
    {
      group: "Saúde",
      label: "⚡ Saúde rápida GFP",
      wrapper: "saudeRapidaGfpWrapper"
    },
    {
      group: "Saúde",
      label: "🩺 Saúde geral GFP",
      wrapper: "saudeGeralGfpWrapper"
    },
    {
      group: "Saúde",
      label: "🧪 Pré-check base final",
      wrapper: "precheckBaseFinalWrapper"
    },
    {
      group: "Backup",
      label: "💾 Criar snapshot GFP",
      wrapper: "criarSnapshotGfpWrapper"
    }
  ];
}

function GFP_LIMPEZA_TECNICA_writeReport_15_9_(ss, rows, summary) {
  const name = "SYS_LIMPEZA_TECNICA_GFP";
  let sh = ss.getSheetByName(name);

  if (!sh) sh = ss.insertSheet(name);

  sh.clear();

  const header = [
    "TIMESTAMP",
    "TIPO",
    "FASE",
    "MODULO",
    "ARQUIVO_SUGERIDO",
    "FUNCAO_WRAPPER",
    "STATUS",
    "OBSERVACAO"
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

  try { sh.autoResizeColumns(1, header.length); } catch (eResize) {}

  sh.getRange("J1").setValue("RESUMO");
  sh.getRange("J2").setValue(JSON.stringify(summary));
}

/**
 * =============================================================================
 * 🗂️ GFP 15.9.3.1 — CLASSIFICADOR DE ABAS DA PLANILHA
 * =============================================================================
 *
 * Não oculta.
 * Não apaga.
 * Não altera dados.
 *
 * Apenas classifica as abas e gera relatório:
 *
 *   REL_CLASSIFICACAO_ABAS_GFP
 * =============================================================================
 */

const GFP_CLASSIFICADOR_ABAS_VERSION_15_9_3_1 = "15.9.3.1";

function GFP_PLANILHA_CLASSIFICAR_ABAS_15_9_3_1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const now = new Date();

  const formulaReferences = GFP_CLASS_ABAS_countFormulaReferences_15_9_3_1_(ss);

  const rows = [];
  const summary = {
    version: GFP_CLASSIFICADOR_ABAS_VERSION_15_9_3_1,
    generatedAt: now.toISOString(),
    totalSheets: sheets.length,
    manterVisivel: 0,
    naoMexer: 0,
    podeOcultarFuturo: 0,
    podeLimparFuturo: 0,
    candidataExcluirFuturo: 0,
    revisar: 0,
    automaticChanges: 0
  };

  sheets.forEach(function(sh) {
    const name = sh.getName();
    const classification = GFP_CLASS_ABAS_classify_15_9_3_1_(name, sh, formulaReferences[name] || 0);

    if (classification.recomendacao === "MANTER_VISIVEL") summary.manterVisivel++;
    else if (classification.recomendacao === "NAO_MEXER") summary.naoMexer++;
    else if (classification.recomendacao === "PODE_OCULTAR_FUTURO") summary.podeOcultarFuturo++;
    else if (classification.recomendacao === "PODE_LIMPAR_FUTURO") summary.podeLimparFuturo++;
    else if (classification.recomendacao === "CANDIDATA_EXCLUIR_FUTURO") summary.candidataExcluirFuturo++;
    else summary.revisar++;

    rows.push([
      now,
      name,
      sh.isSheetHidden() ? "OCULTA" : "VISIVEL",
      sh.getLastRow(),
      sh.getLastColumn(),
      formulaReferences[name] || 0,
      classification.grupo,
      classification.recomendacao,
      classification.motivo,
      "NENHUMA"
    ]);
  });

  GFP_CLASS_ABAS_writeReport_15_9_3_1_(ss, rows, summary);

  ss.toast(
    "Classificação de abas concluída: " + sheets.length + " aba(s) analisada(s). Nenhuma alteração automática.",
    "GFP 15.9.3.1"
  );

  return {
    ok: true,
    summary: summary,
    rows: rows
  };
}

function GFP_CLASS_ABAS_classify_15_9_3_1_(name, sheet, referenceCount) {
  const n = String(name || "").trim();
  const upper = n.toUpperCase();

  // ---------------------------------------------------------------------------
  // Núcleo operacional — não mexer
  // ---------------------------------------------------------------------------
  if (upper === "DB_TRANSACOES") {
    return {
      grupo: "NUCLEO_OPERACIONAL",
      recomendacao: "NAO_MEXER",
      motivo: "Mesa operacional principal do sistema. Deve permanecer visível."
    };
  }

  if (upper === "DB_TRANSACOES_HIST") {
    return {
      grupo: "NUCLEO_HISTORICO",
      recomendacao: "NAO_MEXER",
      motivo: "Histórico transacional oficial. Deve permanecer visível neste momento."
    };
  }

  // ---------------------------------------------------------------------------
  // Configurações — não mexer
  // ---------------------------------------------------------------------------
  if (/^CFG_/i.test(n) ||
      upper.indexOf("PLANO") >= 0 ||
      upper.indexOf("CONTA") >= 0 ||
      upper.indexOf("CATEGORIA") >= 0 ||
      upper.indexOf("RUBRICA") >= 0 ||
      upper.indexOf("TAXONOMIA") >= 0) {
    return {
      grupo: "CONFIGURACAO",
      recomendacao: "NAO_MEXER",
      motivo: "Aba de configuração, contas, plano, categorias, aprendizado ou taxonomia. Não excluir nem ocultar automaticamente."
    };
  }

  // ---------------------------------------------------------------------------
  // Logs — manter visível por enquanto
  // ---------------------------------------------------------------------------
  if (upper === "SYS_LOGS" || /^LOG_/i.test(n)) {
    return {
      grupo: "LOGS",
      recomendacao: "MANTER_VISIVEL",
      motivo: "Log operacional/técnico. Pode ser limpo futuramente com snapshot, mas não deve ser ocultado/excluído agora."
    };
  }

  // ---------------------------------------------------------------------------
  // Abas que André pediu expressamente para manter visíveis
  // ---------------------------------------------------------------------------
  if (upper === "DRE_GERENCIAL") {
    return {
      grupo: "ANALITICO_LEGADO_VISIVEL",
      recomendacao: "MANTER_VISIVEL",
      motivo: "DRE antiga/analítica. Não usar como fonte oficial se o Dashboard 2.0 estiver validado, mas manter visível até decisão final."
    };
  }

  if (upper === "VISAO_FUTURO") {
    return {
      grupo: "ANALITICO_LEGADO_VISIVEL",
      recomendacao: "MANTER_VISIVEL",
      motivo: "Visão futura legada/analítica. Manter visível até avaliarmos dependências e utilidade real."
    };
  }

  if (upper === "DB_MEMORIA") {
    return {
      grupo: "MEMORIA_LEGADA_VISIVEL",
      recomendacao: "MANTER_VISIVEL",
      motivo: "Base de memória legada. Manter visível até confirmar se nenhuma rotina/fórmula depende dela."
    };
  }

  // ---------------------------------------------------------------------------
  // Relatórios técnicos regeneráveis
  // ---------------------------------------------------------------------------
  if (/^SYS_/i.test(n)) {
    return {
      grupo: "RELATORIO_TECNICO_REGENERAVEL",
      recomendacao: "PODE_OCULTAR_FUTURO",
      motivo: "Aba técnica SYS_ aparentemente regenerável. Não excluir agora; pode ser ocultada ou limpa no futuro após snapshot."
    };
  }

  if (/^REL_/i.test(n)) {
    return {
      grupo: "RELATORIO",
      recomendacao: "PODE_OCULTAR_FUTURO",
      motivo: "Relatório gerado. Pode ser ocultado ou recriado futuramente, mas não apagar agora."
    };
  }

  // ---------------------------------------------------------------------------
  // Snapshots / backups
  // ---------------------------------------------------------------------------
  if (/^BK_/i.test(n)) {
    return {
      grupo: "BACKUP_SNAPSHOT",
      recomendacao: "PODE_OCULTAR_FUTURO",
      motivo: "Aba de snapshot/backup. Pode ser ocultada; exclusão só após confirmar que não é mais necessária."
    };
  }

  // ---------------------------------------------------------------------------
  // Abas totalmente vazias
  // ---------------------------------------------------------------------------
  if (sheet.getLastRow() <= 1 && sheet.getLastColumn() <= 1 && referenceCount === 0) {
    return {
      grupo: "VAZIA",
      recomendacao: "CANDIDATA_EXCLUIR_FUTURO",
      motivo: "Aba aparentemente vazia e sem referência por fórmula. Ainda assim, excluir só após snapshot e confirmação manual."
    };
  }

  // ---------------------------------------------------------------------------
  // Demais abas
  // ---------------------------------------------------------------------------
  return {
    grupo: "OUTRA_REVISAR",
    recomendacao: "REVISAR",
    motivo: "Aba não classificada automaticamente. Analisar manualmente antes de qualquer ocultação ou exclusão."
  };
}

function GFP_CLASS_ABAS_countFormulaReferences_15_9_3_1_(ss) {
  const sheets = ss.getSheets();
  const names = sheets.map(function(sh) { return sh.getName(); });

  const counts = {};
  names.forEach(function(name) { counts[name] = 0; });

  sheets.forEach(function(sh) {
    let formulas = [];

    try {
      const range = sh.getDataRange();
      formulas = range.getFormulas();
    } catch (e) {
      formulas = [];
    }

    formulas.forEach(function(row) {
      row.forEach(function(formula) {
        if (!formula) return;

        names.forEach(function(name) {
          const escaped = GFP_CLASS_ABAS_escapeRegex_15_9_3_1_(name);

          const quoted = new RegExp("'" + escaped + "'!", "i");
          const unquoted = new RegExp("(^|[^A-Za-z0-9_])" + escaped + "!", "i");

          if (quoted.test(formula) || unquoted.test(formula)) {
            counts[name]++;
          }
        });
      });
    });
  });

  return counts;
}

function GFP_CLASS_ABAS_escapeRegex_15_9_3_1_(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function GFP_CLASS_ABAS_writeReport_15_9_3_1_(ss, rows, summary) {
  const name = "REL_CLASSIFICACAO_ABAS_GFP";
  let sh = ss.getSheetByName(name);

  if (!sh) sh = ss.insertSheet(name);

  sh.clear();

  const header = [
    "TIMESTAMP",
    "ABA",
    "VISIBILIDADE_ATUAL",
    "LINHAS",
    "COLUNAS",
    "REFERENCIAS_FORMULAS",
    "GRUPO",
    "RECOMENDACAO",
    "MOTIVO",
    "ACAO_AUTOMATICA"
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

  try { sh.autoResizeColumns(1, header.length); } catch (eResize) {}

  sh.getRange("L1").setValue("RESUMO");
  sh.getRange("L2").setValue(JSON.stringify(summary));
}

/**
 * =============================================================================
 * 🧭 GFP 15.9.4.1 — ORGANIZAÇÃO AUTOMÁTICA DAS ABAS / VERSÃO ENXUTA
 * =============================================================================
 *
 * Reorganiza a planilha conforme decisão final:
 *
 * Visíveis:
 * - DB_TRANSACOES
 * - DB_TRANSACOES_HIST
 * - SYS_LOGS
 * - DRE_GERENCIAL
 * - VISAO_FUTURO
 * - DB_MEMORIA
 * - LOG_REVISAO_IA
 * - CFG_Aprendizado
 * - CFG_Categorias
 * - CFG_Contas
 * - CFG_Cartoes
 *
 * Ocultas:
 * - relatórios SYS_ regeneráveis;
 * - relatórios REL_;
 * - LOG_ARQUIVAMENTO;
 * - AUDITORIA_GFP;
 * - CFG_Modelo_Classificacao;
 * - CFG_Taxonomia_Quarentena;
 * - SYS_TAXONOMIA_REPORT;
 * - CFG_Taxonomia;
 * - BK_* snapshots/backups, se existirem.
 *
 * Não apaga nada.
 * =============================================================================
 */

const GFP_ORGANIZACAO_ABAS_VERSION_15_9_4_1 = "15.9.4.1";

function GFP_PLANILHA_ORGANIZAR_ABAS_15_9_4_1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date();

  const visibleOrder = [
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

  const explicitHide = [
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

  const keepVisibleSet = {};
  visibleOrder.forEach(function(name) {
    keepVisibleSet[name] = true;
  });

  const log = [];
  const summary = {
    version: GFP_ORGANIZACAO_ABAS_VERSION_15_9_4_1,
    generatedAt: now.toISOString(),
    visibleRequested: visibleOrder.length,
    visibleFound: 0,
    visibleMissing: 0,
    sheetsHidden: 0,
    sheetsAlreadyHidden: 0,
    hideMissing: 0,
    movedSheets: 0,
    helperColumnsHidden: false,
    backupsHidden: 0,
    errors: 0
  };

  // 1) Garante que as abas escolhidas estejam visíveis.
  visibleOrder.forEach(function(name) {
    const sh = ss.getSheetByName(name);

    if (!sh) {
      summary.visibleMissing++;
      log.push([now, name, "SHOW", "NAO_ENCONTRADA", "", "Aba visível solicitada não existe neste arquivo."]);
      return;
    }

    summary.visibleFound++;

    try {
      if (sh.isSheetHidden()) {
        sh.showSheet();
        log.push([now, name, "SHOW", "OK", "", "Aba reexibida porque está na lista oficial de visíveis."]);
      } else {
        log.push([now, name, "SHOW", "JA_VISIVEL", "", "Aba já estava visível."]);
      }
    } catch (eShow) {
      summary.errors++;
      log.push([now, name, "SHOW", "ERRO", eShow.message, "Falha ao garantir visibilidade."]);
    }
  });

  // 2) Ativa DB_TRANSACOES antes de ocultar qualquer aba.
  try {
    const first = ss.getSheetByName("DB_TRANSACOES");
    if (first) {
      first.showSheet();
      ss.setActiveSheet(first);
    }
  } catch (eActive) {
    summary.errors++;
    log.push([now, "DB_TRANSACOES", "ATIVAR", "ERRO", eActive.message, "Falha ao ativar aba inicial."]);
  }

  // 3) Monta lista final de ocultação.
  const hideSet = {};
  explicitHide.forEach(function(name) {
    if (!keepVisibleSet[name]) hideSet[name] = true;
  });

  // Oculta snapshots/backups BK_* automaticamente, se existirem.
  ss.getSheets().forEach(function(sh) {
    const name = sh.getName();
    if (/^BK_/i.test(name) && !keepVisibleSet[name]) {
      hideSet[name] = true;
    }
  });

  // 4) Oculta as abas aprovadas.
  Object.keys(hideSet).forEach(function(name) {
    const sh = ss.getSheetByName(name);

    if (!sh) {
      summary.hideMissing++;
      log.push([now, name, "HIDE", "NAO_ENCONTRADA", "", "Aba de ocultação solicitada não encontrada."]);
      return;
    }

    if (keepVisibleSet[name]) {
      log.push([now, name, "HIDE", "IGNORADA_KEEP_VISIBLE", "", "Aba protegida por lista oficial de visíveis."]);
      return;
    }

    try {
      if (sh.isSheetHidden()) {
        summary.sheetsAlreadyHidden++;
        log.push([now, name, "HIDE", "JA_OCULTA", "", "Aba já estava oculta."]);
      } else {
        const visibleSheetsCount = ss.getSheets().filter(function(s) { return !s.isSheetHidden(); }).length;

        if (visibleSheetsCount <= 1) {
          summary.errors++;
          log.push([now, name, "HIDE", "ERRO", "Última aba visível", "Ocultação bloqueada por segurança."]);
          return;
        }

        sh.hideSheet();
        summary.sheetsHidden++;

        if (/^BK_/i.test(name)) summary.backupsHidden++;

        log.push([now, name, "HIDE", "OK", "", "Aba ocultada conforme lista aprovada."]);
      }
    } catch (eHide) {
      summary.errors++;
      log.push([now, name, "HIDE", "ERRO", eHide.message, "Falha ao ocultar aba."]);
    }
  });

  // 5) Reordena as abas visíveis principais na ordem oficial.
  let targetPosition = 1;

  visibleOrder.forEach(function(name) {
    const sh = ss.getSheetByName(name);

    if (!sh) return;
    if (sh.isSheetHidden()) return;

    try {
      ss.setActiveSheet(sh);
      ss.moveActiveSheet(targetPosition);
      summary.movedSheets++;
      log.push([now, name, "MOVE", "OK", String(targetPosition), "Aba posicionada conforme ordem oficial."]);
      targetPosition++;
    } catch (eMove) {
      summary.errors++;
      log.push([now, name, "MOVE", "ERRO", eMove.message, "Falha ao mover aba."]);
    }
  });

  // 6) Oculta colunas auxiliares O:S da DB_TRANSACOES.
  try {
    const work = ss.getSheetByName("DB_TRANSACOES");

    if (work && work.getLastColumn() >= 19) {
      work.hideColumns(15, 5); // O:S
      summary.helperColumnsHidden = true;
      log.push([now, "DB_TRANSACOES!O:S", "HIDE_COLUMNS", "OK", "", "Colunas auxiliares O:S ocultadas."]);
    } else {
      log.push([now, "DB_TRANSACOES!O:S", "HIDE_COLUMNS", "IGNORADO", "", "DB_TRANSACOES não existe ou não tem colunas até S."]);
    }
  } catch (eCols) {
    summary.errors++;
    log.push([now, "DB_TRANSACOES!O:S", "HIDE_COLUMNS", "ERRO", eCols.message, "Falha ao ocultar colunas auxiliares."]);
  }

  // 7) Gera relatório e deixa oculto, conforme decisão do usuário.
  GFP_PLANILHA_ORGANIZAR_ABAS_writeReport_15_9_4_1_(ss, log, summary);

  // 8) Volta para DB_TRANSACOES.
  try {
    const firstAgain = ss.getSheetByName("DB_TRANSACOES");
    if (firstAgain) ss.setActiveSheet(firstAgain);
  } catch (eFinal) {}

  ss.toast(
    "Abas organizadas: " + summary.sheetsHidden + " ocultada(s), " + summary.movedSheets + " reposicionada(s).",
    "GFP 15.9.4.1"
  );

  return {
    ok: summary.errors === 0,
    summary: summary,
    log: log
  };
}

function GFP_PLANILHA_ORGANIZAR_ABAS_writeReport_15_9_4_1_(ss, rows, summary) {
  const name = "REL_ORGANIZACAO_ABAS_GFP";
  let sh = ss.getSheetByName(name);

  if (!sh) sh = ss.insertSheet(name);

  sh.clear();

  const header = [
    "TIMESTAMP",
    "ALVO",
    "ACAO",
    "STATUS",
    "DETALHE",
    "OBSERVACAO"
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

  try { sh.autoResizeColumns(1, header.length); } catch (eResize) {}

  sh.getRange("H1").setValue("RESUMO");
  sh.getRange("H2").setValue(JSON.stringify(summary));

  // Relatório fica oculto por decisão final do usuário.
  try {
    sh.hideSheet();
  } catch (eHide) {}
}