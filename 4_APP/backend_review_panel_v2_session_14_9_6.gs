/**
 * 📂 ARQUIVO: 4_APP/backend_review_panel_v2_session_14_9_6.gs
 * ⚡ MÓDULO: PAINEL DE REVISÃO 2.0 — FILA TEMPORÁRIA / COMMIT EM LOTE
 * 🔢 VERSÃO: 14.9.6
 * 📅 DATA: 10/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Receber decisões temporárias do painel e gravar tudo somente na finalização.
 * -----------------------------------------------------------------------------
 */

const GFP_PANEL_V2_SESSION_PATCH_14_9_6 = "14.9.6";

/**
 * Commit final da sessão do painel.
 *
 * Payload esperado:
 * {
 *   actions: [
 *     { action: "APPROVE", row: 2, category: "02.02 — ..." }
 *   ]
 * }
 */
function apiReviewPanelV2CommitSession_14_9_6(payload) {
  const p = payload || {};
  const actions = Array.isArray(p.actions) ? p.actions : [];

  const startedAt = new Date();

  const out = {
    patch: "16.1.18.4.2",
    requested: actions.length,
    committed: 0,
    skipped: 0,
    errors: [],
    postProcess: {
      skipped: true,
      reason: "Painel Turbo não executa pós-processamento pesado."
    },
    autoArchive: {
      skipped: true,
      reason: "Linhas OK permanecem na DB_TRANSACOES até Arquivar Linhas OK."
    },
    autoArchiveMoved: 0,
    dashboard: {
      skipped: true,
      reason: "Dashboard/DRE não atualizam a cada microdecisão."
    },
    modelLearning: null,
    startedAt: startedAt.toISOString(),
    finishedAt: null
  };

  // 🧠 GFP 16.1.18.4 — linhas efetivamente aplicadas no Painel,
  // para aprendizado pontual leve do modelo interno.
  const committedRowsForLearning = [];

  if (!actions.length) {
    out.finishedAt = new Date().toISOString();
    return out;
  }

  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(30000)) {
    throw new Error("Não foi possível obter lock para aplicar decisões. Tente novamente em alguns segundos.");
  }

  try {
    actions.forEach(function(item, idx) {
      try {
        const action = String(item.action || "APPROVE").toUpperCase();
        const row = Number(item.row || 0);
        const category = String(item.category || "").trim();

        if (!row || row < 2) {
          out.skipped++;
          out.errors.push({
            index: idx,
            row: row,
            error: "Linha inválida."
          });
          return;
        }

        if (action !== "APPROVE" && action !== "CORRECT" && action !== "MANUAL") {
          out.skipped++;
          out.errors.push({
            index: idx,
            row: row,
            action: action,
            error: "Ação não suportada no commit da sessão."
          });
          return;
        }

        if (typeof apiReviewPanelV2ApproveFast !== "function") {
          throw new Error("apiReviewPanelV2ApproveFast não encontrada.");
        }

        let result;

        if (action === "MANUAL" && typeof apiReviewPanelV2MarkManualFast === "function") {
          result = apiReviewPanelV2MarkManualFast({
            row: row,
            category: category,
            sessionCommit: true,
            source: "PAINEL_V2_TURBO_16_1_18_4_2"
          });

        } else if (action === "CORRECT" && typeof apiReviewPanelV2CorrectFast === "function") {
          result = apiReviewPanelV2CorrectFast({
            row: row,
            category: category,
            sessionCommit: true,
            source: "PAINEL_V2_TURBO_16_1_18_4_2"
          });

        } else {
          result = apiReviewPanelV2ApproveFast({
            row: row,
            category: category,
            sessionCommit: true,
            source: "PAINEL_V2_TURBO_16_1_18_4_2"
          });
        }

        if (result && result.ok) {
          out.committed++;

          // 🧠 Linha aplicada com sucesso: entra no aprendizado pontual.
          committedRowsForLearning.push(row);

        } else {
          out.skipped++;
          out.errors.push({
            index: idx,
            row: row,
            result: result || null,
            error: result && result.reason ? result.reason : "Linha ignorada no commit."
          });
        }

      } catch (eItem) {
        out.skipped++;
        out.errors.push({
          index: idx,
          row: item && item.row ? item.row : "",
          error: eItem.message
        });
      }
    });

    // 🧠 GFP 16.1.18.4 — aprendizado pontual leve.
    // Roda uma vez no final do lote aplicado, não a cada card.
    // Não chama Gemini.
    // Não ordena.
    // Não arquiva.
    // Não atualiza Dashboard/DRE.
    try {
      if (
        committedRowsForLearning.length &&
        typeof GFP_MODELO_APRENDER_DECISOES_PAINEL_16_1_18_4 === "function"
      ) {
        out.modelLearning = GFP_MODELO_APRENDER_DECISOES_PAINEL_16_1_18_4(committedRowsForLearning);
      } else {
        out.modelLearning = {
          skipped: true,
          reason: "Nenhuma linha para aprendizado ou função 16.1.18.4 ausente."
        };
      }
    } catch (eLearning) {
      out.modelLearning = {
        ok: false,
        error: eLearning.message,
        note: "A decisão foi aplicada; apenas o aprendizado pontual falhou."
      };
    }

  } finally {
    try { lock.releaseLock(); } catch (eLock) {}
  }

  out.finishedAt = new Date().toISOString();

  Logger.log("[apiReviewPanelV2CommitSession_16_1_18_4_2] " + JSON.stringify(out));

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Painel V2 Turbo: " + out.committed + " decisão(ões) aplicada(s). Linhas OK continuam na mesa.",
    "GFP 16.1.18.4.2",
    8
  );

  return out;
}


/**
 * =============================================================================
 * ✅ GFP 15.6.0 — PÓS-COMMIT SEGURO DO PAINEL DE REVISÃO 2.0
 * =============================================================================
 *
 * Deve ser chamado no final da função:
 *
 *   apiReviewPanelV2CommitSession_14_9_6(payload)
 *
 * depois de gravar as decisões e antes do return out.
 *
 * Funções:
 * - arquiva automaticamente OKs da DB_TRANSACOES;
 * - não deixa erro de arquivamento quebrar o commit;
 * - registra resumo em out.autoArchive;
 * - mantém HIST_STATUS visível.
 * =============================================================================
 */

function GFP_REVIEW_PANEL_V2_AFTER_COMMIT_15_6_(out, options) {
  out = out || {};
  out.reviewPanelFinalPatch = "16.1.18.2";
  out.autoArchive = {
    skipped: true,
    reason: "Autoarquivamento desativado. Use Arquivar Linhas OK."
  };
  out.autoArchiveMoved = 0;
  out.keepHistStatusVisible = {
    skipped: true,
    reason: "Histórico não é tocado pelo Painel Turbo."
  };
  return out;
}



/**
 * =============================================================================
 * 🧪 GFP 15.6.0 — AUDITORIA DO PAINEL DE REVISÃO 2.0
 * =============================================================================
 *
 * Gera/atualiza:
 *
 *   SYS_REVIEW_PANEL_2_AUDIT
 *
 * A auditoria foca na DB_TRANSACOES, porque o Painel NÃO deve trabalhar histórico.
 * =============================================================================
 */

function GFP_REVIEW_PANEL_V2_AUDITAR_15_6() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  const issues = [];
  const stats = {
    version: "15.6.0",
    generatedAt: new Date().toISOString(),
    workRows: 0,
    pendingReview: 0,
    okStillInWork: 0,
    missingCategory: 0,
    invalidType: 0,
    booleanStatus: 0,
    transferConfirmedNotT: 0,
    rowsWithArchiveMetaInWork: 0
  };

  if (!sh) {
    issues.push(GFP_REVIEW_PANEL_V2_AUDIT_issue_15_6_(
      "FATAL",
      "DB_TRANSACOES_AUSENTE",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Aba DB_TRANSACOES não encontrada."
    ));

    GFP_REVIEW_PANEL_V2_AUDIT_write_15_6_(ss, issues, stats);

    return { ok: false, stats: stats, issues: issues };
  }

  if (sh.getLastRow() < 2) {
    GFP_REVIEW_PANEL_V2_AUDIT_write_15_6_(ss, issues, stats);
    ss.toast("Painel V2 auditado: DB_TRANSACOES vazia.", "GFP 15.6");
    return { ok: true, stats: stats, issues: issues };
  }

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 14).getValues();
  stats.workRows = values.length;

  values.forEach(function(row, idx) {
    const rowNumber = idx + 2;

    const parsed = {
      rowNumber: rowNumber,
      date: row[0],
      description: String(row[1] || ""),
      value: row[2],
      tipo: GFP_REVIEW_PANEL_V2_norm_15_6_(row[3]),
      account: String(row[4] || ""),
      category: String(row[5] || ""),
      parcAtual: row[6],
      parcTotal: row[7],
      status: GFP_REVIEW_PANEL_V2_norm_15_6_(row[8]),
      notes: String(row[9] || ""),
      id: String(row[10] || ""),
      fileId: String(row[11] || ""),
      hash: String(row[12] || ""),
      meta: GFP_REVIEW_PANEL_V2_parseJson_15_6_(row[13])
    };

    const pending = GFP_REVIEW_PANEL_V2_isPendingForReview_15_6_(parsed.status);

    if (pending) stats.pendingReview++;

    if (parsed.status === "OK") {
      stats.okStillInWork++;
      issues.push(GFP_REVIEW_PANEL_V2_AUDIT_fromParsed_15_6_(
        "INFO",
        "OK_AINDA_NA_MESA",
        parsed,
        "Linha OK ainda está na DB_TRANSACOES. Se o arquivamento automático já estiver ativo, ela deve sair ao finalizar/validar."
      ));
    }

    if (parsed.status === "TRUE" || parsed.status === "FALSE") {
      stats.booleanStatus++;
      issues.push(GFP_REVIEW_PANEL_V2_AUDIT_fromParsed_15_6_(
        "WARN",
        "STATUS_BOOLEAN_CHECKBOX",
        parsed,
        "Status ficou TRUE/FALSE. O fluxo correto converte checkbox para OK."
      ));
    }

    if (!parsed.category && parsed.status !== "OK") {
      stats.missingCategory++;
      issues.push(GFP_REVIEW_PANEL_V2_AUDIT_fromParsed_15_6_(
        "INFO",
        "SEM_CATEGORIA_PENDENTE",
        parsed,
        "Linha sem categoria, pendente de revisão."
      ));
    }

    const validTypes = ["D", "C", "T", "S", ""];
    if (validTypes.indexOf(parsed.tipo) < 0) {
      stats.invalidType++;
      issues.push(GFP_REVIEW_PANEL_V2_AUDIT_fromParsed_15_6_(
        "WARN",
        "TIPO_INVALIDO",
        parsed,
        "Tipo inválido. Esperado: D, C, T ou S."
      ));
    }

    if (GFP_REVIEW_PANEL_V2_isConfirmed_15_6_(parsed.status) &&
        GFP_REVIEW_PANEL_V2_isTransferCategory_15_6_(parsed.category) &&
        parsed.tipo !== "T") {
      stats.transferConfirmedNotT++;
      issues.push(GFP_REVIEW_PANEL_V2_AUDIT_fromParsed_15_6_(
        "WARN",
        "TRANSFERENCIA_CONFIRMADA_NAO_T",
        parsed,
        "Linha confirmada como transferência/99.*, mas TIPO ainda não é T. O trigger deveria ajustar automaticamente."
      ));
    }

    if (parsed.meta && parsed.meta.gfp_archive && parsed.meta.gfp_archive.lastArchive) {
      stats.rowsWithArchiveMetaInWork++;
      issues.push(GFP_REVIEW_PANEL_V2_AUDIT_fromParsed_15_6_(
        "INFO",
        "LINHA_COM_META_ARQUIVO_NA_MESA",
        parsed,
        "Linha na mesa contém metadados de arquivamento anterior. Normal em linhas desarquivadas para revisão."
      ));
    }
  });

  GFP_REVIEW_PANEL_V2_AUDIT_write_15_6_(ss, issues, stats);

  try {
    if (typeof GFP_MANTER_HIST_STATUS_VISIVEL_15_6 === "function") {
      GFP_MANTER_HIST_STATUS_VISIVEL_15_6({ silent: true });
    }
  } catch (eHist) {}

  ss.toast(
    "Painel V2 auditado: " + issues.length + " apontamento(s).",
    "GFP 15.6"
  );

  return {
    ok: true,
    stats: stats,
    issues: issues
  };
}

function GFP_REVIEW_PANEL_V2_AUDIT_fromParsed_15_6_(severity, code, parsed, detail) {
  return GFP_REVIEW_PANEL_V2_AUDIT_issue_15_6_(
    severity,
    code,
    parsed.rowNumber,
    parsed.date,
    parsed.description,
    parsed.value,
    parsed.tipo,
    parsed.account,
    parsed.category,
    parsed.status,
    parsed.id || parsed.hash,
    detail
  );
}

function GFP_REVIEW_PANEL_V2_AUDIT_issue_15_6_(severity, code, rowNumber, date, description, value, tipo, account, category, status, key, detail) {
  return [
    new Date(),
    severity,
    code,
    "DB_TRANSACOES",
    rowNumber,
    date,
    description,
    value,
    tipo,
    account,
    category,
    status,
    key,
    detail
  ];
}

function GFP_REVIEW_PANEL_V2_AUDIT_write_15_6_(ss, issues, stats) {
  const name = "SYS_REVIEW_PANEL_2_AUDIT";
  let sh = ss.getSheetByName(name);

  if (!sh) sh = ss.insertSheet(name);

  sh.clear();

  const header = [
    "TIMESTAMP",
    "GRAVIDADE",
    "CODIGO",
    "ABA",
    "LINHA",
    "DATA",
    "DESCRICAO",
    "VALOR",
    "TIPO",
    "CONTA",
    "CATEGORIA",
    "STATUS",
    "ID/HASH",
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
  sh.getRange("F:F").setNumberFormat("dd/mm/yyyy");
  sh.getRange("H:H").setNumberFormat("R$ #,##0.00;[Red]-R$ #,##0.00");

  try { sh.autoResizeColumns(1, header.length); } catch (eResize) {}

  sh.getRange("P1").setValue("RESUMO");
  sh.getRange("P2").setValue(JSON.stringify(stats));
}

function GFP_REVIEW_PANEL_V2_norm_15_6_(value) {
  return String(value == null ? "" : value)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function GFP_REVIEW_PANEL_V2_parseJson_15_6_(value) {
  if (!value) return {};

  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}

function GFP_REVIEW_PANEL_V2_isPendingForReview_15_6_(status) {
  status = GFP_REVIEW_PANEL_V2_norm_15_6_(status);

  if (!status) return true;

  return status !== "OK" &&
         status !== "CONCILIADO" &&
         status !== "VALIDADO" &&
         status !== "APROVADO";
}

function GFP_REVIEW_PANEL_V2_isConfirmed_15_6_(status) {
  status = GFP_REVIEW_PANEL_V2_norm_15_6_(status);

  return status === "OK" ||
         status === "CONCILIADO" ||
         status === "VALIDADO" ||
         status === "APROVADO";
}

function GFP_REVIEW_PANEL_V2_isTransferCategory_15_6_(category) {
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
