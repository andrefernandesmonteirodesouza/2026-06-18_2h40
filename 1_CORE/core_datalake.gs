/**
 * 📂 ARQUIVO: 1_CORE/core_datalake.gs
 * 💾 MÓDULO: PERSISTÊNCIA & BANCO DE DADOS
 * 🔢 VERSÃO: 15.2.0 (MESA DE TRABALHO + HISTÓRICO)
 * 📅 DATA: 10/06/2026
 * 👤 AUTOR: André Fernandes (Sócio) & Gemini (Arquiteto)
 * -----------------------------------------------------------------------------
 * 📝 RESUMO:
 * Módulo responsável pela gravação de trabalho e pelo arquivo histórico protegido.
 *
 * 🔄 HISTÓRICO COMPLETO DE VERSÕES:
 * - V1.0 a V5.6: Evolução de MVP até Ordenação.
 * - V5.7: Suporte a Notas de Conciliação.
 * - V5.8 (ATUAL - AUTO-CHECKBOX):
 * > IMPLEMENTAÇÃO GORDELÍCIA: Agora, no mesmo momento que define a cor amarela
 * para sugestões, o script cria a validação de dados (Checkbox) na coluna STATUS.
 * > RESULTADO: A linha já nasce com o quadrado pronto para validar.
 * -----------------------------------------------------------------------------
 */

function coreDatalakePersistence(payload) {
  const functionName = "coreDatalakePersistence";
  const txPatch = "16.1.18";

  Logger.log("[START] Salvando " + ((payload && payload.normalized && payload.normalized.length) || 0) + " itens.", functionName);

  if (!payload) payload = {};
  if (!payload.meta) payload.meta = {};
  if (!payload.normalized || payload.normalized.length === 0) return payload;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("DB_TRANSACOES");

  if (!sheet) {
    sheet = ss.insertSheet("DB_TRANSACOES");
  }

  // Se a aba for nova, cria o cabeçalho base A:N.
  if (sheet.getLastRow() === 0) {
    const headers = [
      "DATA", "DESCRICAO", "VALOR", "TIPO",
      "CONTA", "CATEGORIA", "PARC_ATUAL", "PARC_TOTAL",
      "STATUS", "NOTAS", "ID_TRANSACAO", "ID_ARQUIVO", "HASH_LINHA", "METADADOS"
    ];

    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    sheet.setFrozenRows(1);
    headerRange
      .setBackground("#1C4587")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");

    sheet.setRowHeight(1, 35);
    sheet.setColumnWidth(2, 400);
    sheet.setColumnWidth(6, 250);
    sheet.setColumnWidth(10, 250);
    sheet.hideColumns(11, 4);
  }

  // Garante A:S antes da gravação.
  if (typeof GFP_DATALAKE_ensureWorkAS_16_1_12_ === "function") {
    GFP_DATALAKE_ensureWorkAS_16_1_12_(sheet);
  } else {
    GFP_DATALAKE_ENSURE_WORK_AS_FALLBACK_16_1_18_(sheet);
  }

  // Formatações gerais.
  sheet.getRange("A:A").setNumberFormat("dd/mm/yyyy").setHorizontalAlignment("center");
  sheet.getRange("C:C").setNumberFormat("R$ #,##0.00;[Red]-R$ #,##0.00");
  sheet.getRange("D:D").setHorizontalAlignment("center");
  sheet.getRange("I:I").setHorizontalAlignment("center");

  const newRows = [];
  const backgrounds = [];
  const statusValidations = [];

  const checkboxRule = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .setAllowInvalid(false)
    .build();

  payload.normalized.forEach(function(item) {
    let showCurrent = (item.installments && item.installments.total > 1) ? item.installments.current : "";
    let showTotal = (item.installments && item.installments.total > 1) ? item.installments.total : "";

    let finalValue = Math.abs(item.amount);
    if (item.type === "D") finalValue = finalValue * -1;

    let dateObj = item.date;
    if (typeof item.date === "string") {
      const parts = item.date.split("-");
      dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    }

    const noteToSave = item.userNote || "";
    const statusToSave = "";

    newRows.push([
      dateObj,
      item.description,
      finalValue,
      item.type,
      item.account,
      item.category,
      showCurrent,
      showTotal,
      statusToSave,
      noteToSave,
      item.id,
      item.meta && item.meta.fileId || "",
      item.id || "",
      JSON.stringify(item.meta || {})
    ]);

    const rowColor = new Array(14).fill("#ffffff");

    if (item.category && item.category !== "") {
      rowColor[5] = "#fff9c4";
      statusValidations.push([checkboxRule]);
    } else {
      statusValidations.push([null]);
    }

    backgrounds.push(rowColor);
  });

  if (newRows.length === 0) return payload;

  const beforeLastRow = sheet.getLastRow();
  const beforeMaxRows = sheet.getMaxRows();
  const startRow = beforeLastRow + 1;
  const numRows = newRows.length;

  const tx = {
    patch: txPatch,
    startedAt: new Date().toISOString(),
    beforeLastRow: beforeLastRow,
    beforeMaxRows: beforeMaxRows,
    startRow: startRow,
    expectedRows: numRows,
    writeVerified: null,
    sort: null,
    sortWarning: null,
    postSortVerified: null,
    rollback: null
  };

  let canRollbackAppendBlock = true;

  try {
    // 1. Grava valores oficiais A:N.
    const range = sheet.getRange(startRow, 1, numRows, 14);
    range.setValues(newRows);

    // 2. Grava cores A:N.
    range.setBackgrounds(backgrounds);

    // 3. Garante O:S em branco para novas linhas.
    sheet.getRange(startRow, 15, numRows, 5).clearContent().clearNote();

    // 4. Checkboxes/status.
    sheet.getRange(startRow, 9, numRows, 1).setDataValidations(statusValidations);

    // 5. Bordas A:S para reforçar a linha inteira.
    sheet.getRange(startRow, 1, numRows, 19)
      .setBorder(true, true, true, true, true, true, "#D3D3D3", SpreadsheetApp.BorderStyle.SOLID);

    // 6. Validação da categoria.
    try {
      const catSheet = ss.getSheetByName("CFG_Categorias");
      if (catSheet) {
        const rule = SpreadsheetApp.newDataValidation()
          .requireValueInRange(catSheet.getRange("F2:F"))
          .setAllowInvalid(false)
          .setHelpText("Por favor, selecione uma categoria válida da lista.")
          .build();

        sheet.getRange(startRow, 6, numRows, 1).setDataValidation(rule);
      }
    } catch (eCat) {
      tx.categoryValidationWarning = eCat.message;
    }

    SpreadsheetApp.flush();

    // 7. Verificação 1: o bloco recém-gravado precisa estar preenchido.
    tx.writeVerified = GFP_DATALAKE_VERIFY_INSERT_BLOCK_16_1_18_(sheet, startRow, newRows);

    if (!tx.writeVerified.ok) {
      throw new Error("Persistência não verificada no bloco recém-gravado: " + JSON.stringify(tx.writeVerified));
    }

    // A partir daqui, os dados existem. Se o sort falhar, NÃO deletamos as linhas válidas.
    canRollbackAppendBlock = false;

    // 8. Ordenação A:S defensiva.
    try {
      if (typeof GFP_DATALAKE_sortWorkAS_16_1_12_ === "function") {
        tx.sort = GFP_DATALAKE_sortWorkAS_16_1_12_(sheet);
      } else {
        tx.sort = GFP_DATALAKE_SORT_AS_FALLBACK_16_1_18_(sheet);
      }
    } catch (eSort) {
      tx.sortWarning = eSort.message;
      Logger.log("[GFP 16.1.18] Ordenação pós-gravação falhou, mas as linhas foram gravadas e verificadas: " + eSort.message);
    }

    SpreadsheetApp.flush();

    // 9. Verificação 2: depois da ordenação, os IDs/HASH precisam continuar existindo em algum lugar da DB.
    tx.postSortVerified = GFP_DATALAKE_VERIFY_IDS_EXIST_ANYWHERE_16_1_18_(sheet, newRows);

    if (!tx.postSortVerified.ok) {
      throw new Error("Persistência perdeu IDs/HASH após ordenação: " + JSON.stringify(tx.postSortVerified));
    }

    // 10. Filtro.
    try {
      if (sheet.getFilter()) sheet.getFilter().remove();
      sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), 19).createFilter();
    } catch (eFilter) {
      tx.filterWarning = eFilter.message;
    }

    payload.meta.coreDatalake = {
      rowsInserted: newRows.length,
      persistence: "VERIFICADA_16_1_18",
      fullRowPolicy: "A:S_INDIVISIVEL",
      transaction: tx
    };

    Logger.log("[SUCCESS][VERIFICADO] " + newRows.length + " linhas gravadas em DB_TRANSACOES.", functionName);

    try {
      if (typeof GFP_LOG_16_1_13_ === "function") {
        GFP_LOG_16_1_13_(
          "[SUCCESS][VERIFICADO] " + newRows.length + " linhas gravadas em DB_TRANSACOES.",
          "Importação",
          "OK",
          "Persistência 16.1.18"
        );
      }
    } catch (eLog) {}

    return payload;

  } catch (e) {
    tx.error = e.message;

    if (canRollbackAppendBlock) {
      try {
        tx.rollback = GFP_DATALAKE_ROLLBACK_APPEND_BLOCK_16_1_18_(sheet, startRow, numRows, beforeMaxRows);
      } catch (eRollback) {
        tx.rollback = { ok: false, error: eRollback.message };
      }
    } else {
      tx.rollback = {
        ok: false,
        skipped: true,
        reason: "Dados já haviam sido verificados; rollback automático seria inseguro."
      };
    }

    payload.meta.coreDatalake = {
      rowsInserted: 0,
      persistence: "FALHOU_16_1_18",
      fullRowPolicy: "A:S_INDIVISIVEL",
      transaction: tx
    };

    Logger.log("[ERRO][PERSISTENCIA_NAO_VERIFICADA] " + e.message, functionName);

    try {
      if (typeof GFP_LOG_16_1_13_ === "function") {
        GFP_LOG_16_1_13_(
          "[ERRO][PERSISTENCIA_NAO_VERIFICADA] " + e.message,
          "Importação",
          "WARN",
          "Persistência 16.1.18"
        );
      }
    } catch (eLog2) {}

    throw new Error("GFP 16.1.18 — Persistência não verificada. A importação foi bloqueada para evitar linhas vazias/falso sucesso. Detalhe: " + e.message);
  }
}



/**
 * =============================================================================
 * 🗂️ GFP 15.2.0 — MESA DE TRABALHO + HISTÓRICO PROTEGIDO
 * =============================================================================
 *
 * DECISÃO DE ARQUITETURA
 * - DB_TRANSACOES deixa de ser o depósito eterno.
 * - DB_TRANSACOES vira a mesa de trabalho: pendentes, recentes, em revisão.
 * - DB_TRANSACOES_HIST vira o arquivo histórico: linhas OK/CONCILIADAS arquivadas.
 *
 * VANTAGENS
 * - Não cria milhares de proteções por linha.
 * - Mantém a planilha leve.
 * - Painel de Revisão trabalha só com pendências.
 * - Dashboard/DRE/Relatórios leem DB_TRANSACOES + DB_TRANSACOES_HIST.
 * - Anti-duplicidade passa a consultar as duas bases.
 *
 * TERMOS
 * - "datalake" no sentido amplo até faz sentido, mas aqui o nome técnico melhor é:
 *   "histórico transacional" ou "ledger histórico".
 * =============================================================================
 */

const GFP_DATALAKE_VERSION_15_2 = "15.2.0";
const GFP_DATALAKE_WORK_SHEET_15_2 = "DB_TRANSACOES";
const GFP_DATALAKE_HIST_SHEET_15_2 = "DB_TRANSACOES_HIST";
const GFP_DATALAKE_LOG_SHEET_15_2 = "LOG_ARQUIVAMENTO";
const GFP_DATALAKE_BASE_COLS_15_2 = 14;

const GFP_DATALAKE_OK_STATUSES_15_2 = [
  "OK",
  "CONCILIADO",
  "VALIDADO",
  "APROVADO",
  "SPLIT"
];

/**
 * Arquiva todas as linhas OK/CONCILIADAS da DB_TRANSACOES.
 *
 * Esta é a rotina principal da nova arquitetura:
 * mesa de trabalho + histórico protegido.
 */
function GFP_ARQUIVAR_LINHAS_OK_15_2(options) {
  options = options || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const work = ss.getSheetByName(GFP_DATALAKE_WORK_SHEET_15_2);

  if (!work) {
    ss.toast("DB_TRANSACOES não encontrada.", "GFP Arquivamento");
    return { ok: false, error: "DB_TRANSACOES não encontrada." };
  }

  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(30000)) {
    ss.toast("Outro processo está em execução. Tente novamente.", "GFP Arquivamento");
    return { ok: false, error: "Lock não obtido." };
  }

  try {
    const result = GFP_DATALAKE_archiveRowsFromWork_15_2_(work, null, options);

    if (!options.silent) {
      ss.toast(
        "📦 Arquivadas: " + result.archived + " | ignoradas: " + result.skipped,
        "GFP Histórico"
      );
    }

    return result;

  } finally {
    lock.releaseLock();
  }
}

/**
 * Arquiva apenas as linhas OK selecionadas na DB_TRANSACOES.
 */
function GFP_ARQUIVAR_LINHAS_OK_SELECIONADAS_15_2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();

  if (!sh || sh.getName() !== GFP_DATALAKE_WORK_SHEET_15_2) {
    ss.toast("Selecione linhas na DB_TRANSACOES.", "GFP Arquivamento");
    return { ok: false, error: "Aba ativa não é DB_TRANSACOES." };
  }

  const range = sh.getActiveRange();

  if (!range) {
    ss.toast("Nenhuma linha selecionada.", "GFP Arquivamento");
    return { ok: false, error: "Nenhuma linha selecionada." };
  }

  const rowStart = Math.max(2, range.getRow());
  const rowEnd = range.getRow() + range.getNumRows() - 1;

  const selectedRows = [];

  for (let r = rowStart; r <= rowEnd; r++) {
    if (r >= 2) selectedRows.push(r);
  }

  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(30000)) {
    ss.toast("Outro processo está em execução. Tente novamente.", "GFP Arquivamento");
    return { ok: false, error: "Lock não obtido." };
  }

  try {
    const result = GFP_DATALAKE_archiveRowsFromWork_15_2_(sh, selectedRows, {
      source: "ARQUIVAR_SELECIONADAS"
    });

    ss.toast(
      "📦 Selecionadas arquivadas: " + result.archived + " | ignoradas: " + result.skipped,
      "GFP Histórico"
    );

    return result;

  } finally {
    lock.releaseLock();
  }
}

/**
 * Motor de arquivamento.
 *
 * selectedRows:
 * - null: analisa a DB inteira.
 * - array: analisa apenas as linhas informadas.
 */

function GFP_DATALAKE_archiveRowsFromWork_15_2_(work, selectedRows, options) {
  options = options || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hist = GFP_DATALAKE_ensureHistSheet_15_2_();
  const log = GFP_DATALAKE_ensureLogSheet_15_2_();

  const lastRow = work.getLastRow();

  const result = {
    ok: true,
    version: "15.2.8",
    batchId: "ARCH-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss"),
    source: options.source || "ARQUIVAR_LINHAS_OK",
    scanned: 0,
    archived: 0,
    reactivated: 0,
    skipped: 0,
    duplicateInHist: 0,
    notOk: 0,
    errors: [],
    rowsArchived: [],
    rowsReactivated: []
  };

  if (lastRow < 2) {
    return result;
  }

  // Chaves ativas: DB_TRANSACOES_HIST com HIST_STATUS != DESARQUIVADO.
  const existingKeys = GFP_DATALAKE_GET_EXISTING_KEYS_15_2({
    includeWork: false,
    includeHist: true
  });

  // Índice das linhas DESARQUIVADAS que podem ser reativadas em vez de duplicadas.
  const desarchivedIndex = GFP_DATALAKE_buildDesarchivedHistIndex_15_2_8_(hist);

  const rowsToEvaluate = [];

  if (selectedRows && selectedRows.length) {
    selectedRows.forEach(function(rowNumber) {
      if (rowNumber >= 2 && rowNumber <= lastRow) rowsToEvaluate.push(rowNumber);
    });
  } else {
    for (let r = 2; r <= lastRow; r++) rowsToEvaluate.push(r);
  }
  GFP_DATALAKE_expandSplitParents_16_0_4_(work, rowsToEvaluate);

  const appendRows = [];
  const appendNotes = [];
  const updateRows = [];
  const deleteRows = [];
  const archivedAt = new Date().toISOString();
  const archivedBy = Session.getActiveUser().getEmail() || "";

  rowsToEvaluate.forEach(function(rowNumber) {
    result.scanned++;

    try {
      const rowRange = work.getRange(rowNumber, 1, 1, GFP_DATALAKE_BASE_COLS_15_2);
      const row = rowRange.getValues()[0];
      const rowNotes = rowRange.getNotes()[0];

      const status = GFP_DATALAKE_norm_15_2_(row[8]);

      if (GFP_DATALAKE_OK_STATUSES_15_2.indexOf(status) < 0) {
        result.notOk++;
        result.skipped++;
        return;
      }

      const id = String(row[10] || "").trim();
      const hash = String(row[12] || "").trim();

      const rowKeys = GFP_DATALAKE_keysFromIdHash_15_2_8_(id, hash);

      const alreadyArchived = rowKeys.some(function(k) {
        return existingKeys.has(k);
      });

      // Se já existe uma versão ativa no histórico, não cria outra.
      if (alreadyArchived) {
        result.duplicateInHist++;
        result.skipped++;
        deleteRows.push(rowNumber);
        return;
      }

      const meta = GFP_DATALAKE_parseJson_15_2_(row[13]);

      const reactivationRow = GFP_DATALAKE_findReactivationHistRow_15_2_8_(
        hist,
        desarchivedIndex,
        rowKeys,
        meta
      );

      const histFullRow = GFP_DATALAKE_buildHistFullRow_15_2_8_({
        row: row,
        meta: meta,
        archivedAt: archivedAt,
        archivedBy: archivedBy,
        batchId: result.batchId,
        sourceRow: rowNumber,
        source: result.source
      });

      const histFullNotes = GFP_DATALAKE_notesNormalize_15_2_4_(rowNotes, GFP_DATALAKE_BASE_COLS_15_2)
        .concat(GFP_DATALAKE_blankNotes_15_2_4_(6));

      if (reactivationRow) {
        updateRows.push({
          histRow: reactivationRow,
          values: histFullRow,
          notes: histFullNotes,
          workRow: rowNumber,
          id: id,
          hash: hash,
          description: String(row[1] || ""),
          value: row[2]
        });

        result.reactivated++;
        result.rowsReactivated.push({
          histRow: reactivationRow,
          rowNumber: rowNumber,
          id: id,
          hash: hash,
          description: String(row[1] || ""),
          value: row[2]
        });

      } else {
        appendRows.push(histFullRow);
        appendNotes.push(histFullNotes);

        result.archived++;
        result.rowsArchived.push({
          rowNumber: rowNumber,
          id: id,
          hash: hash,
          description: String(row[1] || ""),
          value: row[2]
        });
      }

      deleteRows.push(rowNumber);
      rowKeys.forEach(function(k) { existingKeys.add(k); });

    } catch (e) {
      result.errors.push({
        rowNumber: rowNumber,
        error: e.message
      });
      result.skipped++;
    }
  });

  // Atualiza linhas históricas DESARQUIVADAS em vez de criar duplicidade.
  updateRows.forEach(function(upd) {
    try {
      const range = hist.getRange(upd.histRow, 1, 1, upd.values.length);
      range.setValues([upd.values]);

      try {
        range.setNotes([upd.notes]);
      } catch (eNotesUpd) {
        result.errors.push({
          rowNumber: upd.histRow,
          error: "Falha ao reaplicar notas na reativação: " + eNotesUpd.message
        });
      }

      hist.getRange(upd.histRow, 20).setValue("ARQUIVADO");

    } catch (eUpd) {
      result.errors.push({
        rowNumber: upd.histRow,
        error: "Falha ao reativar histórico: " + eUpd.message
      });
    }
  });

  // Arquiva linhas novas.
  if (appendRows.length) {
    const startHistRow = hist.getLastRow() + 1;
    const histRange = hist.getRange(startHistRow, 1, appendRows.length, appendRows[0].length);

    histRange.setValues(appendRows);

    if (appendNotes.length === appendRows.length) {
      try {
        histRange.setNotes(appendNotes);
      } catch (eNotes) {
        result.errors.push({
          rowNumber: 0,
          error: "Falha ao aplicar notas no histórico: " + eNotes.message
        });
      }
    }

    hist.getRange(startHistRow, 20, appendRows.length, 1)
      .setValues(appendRows.map(function() { return ["ARQUIVADO"]; }));
  }

  // Remove da mesa de trabalho de baixo para cima.
  deleteRows
    .filter(function(v, i, arr) { return arr.indexOf(v) === i; })
    .sort(function(a, b) { return b - a; })
    .forEach(function(rowNumber) {
      work.deleteRow(rowNumber);
    });

  GFP_DATALAKE_formatSheets_15_2_(work, hist);
  GFP_DATALAKE_protectHistSheet_15_2_(hist);

  log.appendRow([
    new Date(),
    result.batchId,
    result.source,
    result.scanned,
    result.archived + result.reactivated,
    result.skipped,
    result.duplicateInHist,
    result.notOk,
    result.errors.length,
    JSON.stringify(result)
  ]);

  return result;
}


/**
 * Desarquiva uma linha histórica por ID_TRANSACAO ou HASH_LINHA.
 *
 * Uso direto:
 * GFP_DESARQUIVAR_HISTORICO_POR_ID_15_2("ID_OU_HASH_AQUI")
 */
function GFP_DESARQUIVAR_HISTORICO_POR_ID_15_2(idOrHash) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const work = ss.getSheetByName(GFP_DATALAKE_WORK_SHEET_15_2) || ss.insertSheet(GFP_DATALAKE_WORK_SHEET_15_2);
  const hist = GFP_DATALAKE_ensureHistSheet_15_2_();
  const log = GFP_DATALAKE_ensureLogSheet_15_2_();

  const key = String(idOrHash || "").trim();

  if (!key) {
    ss.toast("Informe um ID_TRANSACAO ou HASH_LINHA.", "GFP Histórico");
    return { ok: false, error: "ID/HASH vazio." };
  }

  const lastRow = hist.getLastRow();

  if (lastRow < 2) {
    ss.toast("Histórico vazio.", "GFP Histórico");
    return { ok: false, error: "Histórico vazio." };
  }

  const data = hist.getRange(2, 1, lastRow - 1, 20).getValues();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2;

    const id = String(row[10] || "").trim();
    const hash = String(row[12] || "").trim();
    const histStatus = GFP_DATALAKE_norm_15_2_(row[19]);

    if (histStatus === "DESARQUIVADO") continue;

    if (id === key || hash === key || ("ID:" + id) === key || ("HASH:" + hash) === key) {
      const baseRow = row.slice(0, GFP_DATALAKE_BASE_COLS_15_2);

      // Ao desarquivar, volta para revisão consciente.
      baseRow[8] = "PENDENTE";

      const meta = GFP_DATALAKE_parseJson_15_2_(baseRow[13]);

      if (!meta.gfp_archive) meta.gfp_archive = {};

      meta.gfp_archive.lastUnarchive = {
        unarchivedAt: new Date().toISOString(),
        unarchivedBy: Session.getActiveUser().getEmail() || "",
        sourceHistRow: rowNumber,
        reason: "Desarquivado para revisão manual.",
        version: GFP_DATALAKE_VERSION_15_2
      };

      baseRow[13] = JSON.stringify(meta);

        const newWorkRow = GFP_DATALAKE_appendWorkRowAS_16_1_12_(work, baseRow);
        try {
          if (typeof GFP_DATALAKE_applyWorkRowUX_15_2_6_ === "function") {
            GFP_DATALAKE_applyWorkRowUX_15_2_6_(work, newWorkRow);
          }
        } catch (eUx) {}

      hist.getRange(rowNumber, 20).setValue("DESARQUIVADO");

      log.appendRow([
        new Date(),
        "UNARCH-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss"),
        "DESARQUIVAR_POR_ID",
        1,
        0,
        0,
        0,
        0,
        0,
        JSON.stringify({ idOrHash: key, histRow: rowNumber })
      ]);

      ss.toast("🔓 Linha desarquivada para DB_TRANSACOES como PENDENTE.", "GFP Histórico");

      return {
        ok: true,
        unarchived: true,
        histRow: rowNumber,
        id: id,
        hash: hash
      };
    }
  }

  ss.toast("ID/HASH não encontrado no histórico ativo.", "GFP Histórico");

  return {
    ok: false,
    error: "ID/HASH não encontrado no histórico ativo."
  };
}

/**
 * Retorna linhas transacionais unificadas para dashboards, relatórios e DRE.
 * Inclui:
 * - DB_TRANSACOES
 * - DB_TRANSACOES_HIST com HIST_STATUS diferente de DESARQUIVADO.
 */
function GFP_DATALAKE_GET_ACTIVE_ROWS_15_2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const out = [];

  const work = ss.getSheetByName(GFP_DATALAKE_WORK_SHEET_15_2);
  const hist = ss.getSheetByName(GFP_DATALAKE_HIST_SHEET_15_2);

  if (work && work.getLastRow() >= 2) {
    const values = work.getRange(2, 1, work.getLastRow() - 1, GFP_DATALAKE_BASE_COLS_15_2).getValues();

    values.forEach(function(row, idx) {
      out.push({
        row: row,
        sheetName: GFP_DATALAKE_WORK_SHEET_15_2,
        rowNumber: idx + 2,
        archived: false
      });
    });
  }

  if (hist && hist.getLastRow() >= 2) {
    const values = hist.getRange(2, 1, hist.getLastRow() - 1, 20).getValues();

    values.forEach(function(row, idx) {
      const histStatus = GFP_DATALAKE_norm_15_2_(row[19]);

      // Só ARQUIVADO entra no Dashboard/DRE.
      if (histStatus !== "ARQUIVADO") return;

      out.push({
        row: row.slice(0, GFP_DATALAKE_BASE_COLS_15_2),
        sheetName: GFP_DATALAKE_HIST_SHEET_15_2,
        rowNumber: idx + 2,
        archived: true
      });
    });
  }

  return out;
}


/**
 * Retorna chaves existentes para anti-duplicidade.
 *
 * options:
 * {
 *   includeWork: true/false,
 *   includeHist: true/false
 * }
 */
function GFP_DATALAKE_GET_EXISTING_KEYS_15_2(options) {
  options = options || {};

  const includeWork = options.includeWork !== false;
  const includeHist = options.includeHist !== false;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const keys = new Set();

  if (includeWork) {
    const work = ss.getSheetByName(GFP_DATALAKE_WORK_SHEET_15_2);

    if (work && work.getLastRow() >= 2) {
      const rows = work.getRange(2, 1, work.getLastRow() - 1, GFP_DATALAKE_BASE_COLS_15_2).getValues();

      rows.forEach(function(row) {
        const id = String(row[10] || "").trim();
        const hash = String(row[12] || "").trim();

        if (id) {
          keys.add(id);
          keys.add("ID:" + id);
        }

        if (hash) {
          keys.add(hash);
          keys.add("HASH:" + hash);
        }
      });
    }
  }

  if (includeHist) {
    const hist = ss.getSheetByName(GFP_DATALAKE_HIST_SHEET_15_2);

    if (hist && hist.getLastRow() >= 2) {
      const rows = hist.getRange(2, 1, hist.getLastRow() - 1, 20).getValues();

      rows.forEach(function(row) {
        const histStatus = GFP_DATALAKE_norm_15_2_(row[19]);

        if (histStatus === "DESARQUIVADO") return;

        const id = String(row[10] || "").trim();
        const hash = String(row[12] || "").trim();

        if (id) {
          keys.add(id);
          keys.add("ID:" + id);
        }

        if (hash) {
          keys.add(hash);
          keys.add("HASH:" + hash);
        }
      });
    }
  }

  return keys;
}

/**
 * Garante aba histórica.
 */
function GFP_DATALAKE_ensureHistSheet_15_2_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hist = ss.getSheetByName(GFP_DATALAKE_HIST_SHEET_15_2);

  if (!hist) {
    hist = ss.insertSheet(GFP_DATALAKE_HIST_SHEET_15_2);
  }

  const headers = [
    "DATA", "DESCRICAO", "VALOR", "TIPO",
    "CONTA", "CATEGORIA", "PARC_ATUAL", "PARC_TOTAL",
    "STATUS", "NOTAS", "ID_TRANSACAO", "ID_ARQUIVO", "HASH_LINHA", "METADADOS",
    "ARCHIVED_AT", "ARCHIVED_BY", "ARCHIVE_BATCH_ID", "SOURCE_SHEET", "SOURCE_ROW", "HIST_STATUS"
  ];

  if (String(hist.getRange(1, 1).getValue() || "") !== "DATA" || hist.getLastColumn() < 20) {
    hist.clear();
    hist.getRange(1, 1, 1, headers.length).setValues([headers]);
    hist.setFrozenRows(1);
  }

  return hist;
}

/**
 * Garante log de arquivamento.
 *
 * GFP 16.1.3 — MODO DOMÉSTICO
 *
 * Antes:
 * - criava/recriava a aba LOG_ARQUIVAMENTO;
 * - gravava uma linha técnica com DETAIL_JSON gigante.
 *
 * Agora:
 * - NÃO cria LOG_ARQUIVAMENTO;
 * - devolve um "proxy" com appendRow();
 * - qualquer appendRow de arquivamento vira uma linha simples no SYS_LOGS;
 * - não aparece JSON para o usuário.
 */
function GFP_DATALAKE_ensureLogSheet_15_2_() {
  return {
    appendRow: function(row) {
      return GFP_DATALAKE_LOG_ARQUIVAMENTO_TO_SYS_LOGS_16_1_3_(row);
    },
    getName: function() {
      return "SYS_LOGS";
    }
  };
}

/**
 * Converte a antiga linha técnica de LOG_ARQUIVAMENTO em mensagem simples no SYS_LOGS.
 *
 * Formato antigo recebido:
 * [
 *   TIMESTAMP,
 *   BATCH_ID,
 *   SOURCE,
 *   SCANNED,
 *   ARCHIVED,
 *   SKIPPED,
 *   DUPLICATE_IN_HIST,
 *   NOT_OK,
 *   ERRORS,
 *   DETAIL_JSON
 * ]
 */
function GFP_DATALAKE_LOG_ARQUIVAMENTO_TO_SYS_LOGS_16_1_3_(row) {
  row = row || [];

  const timestamp = row[0] || new Date();
  const batchId = String(row[1] || "").trim();
  const source = String(row[2] || "").trim();
  const scanned = Number(row[3] || 0);
  const archived = Number(row[4] || 0);
  const skipped = Number(row[5] || 0);
  const duplicateInHist = Number(row[6] || 0);
  const notOk = Number(row[7] || 0);
  const errors = Number(row[8] || 0);

  let level = errors > 0 ? "WARN" : "OK";

  let action = "Histórico atualizado";

  if (batchId.indexOf("ARCH-") === 0) {
    action = "Arquivamento concluído";
  } else if (batchId.indexOf("UNARCH-") === 0) {
    action = "Desarquivamento concluído";
  } else if (batchId.indexOf("FIXDUP-") === 0) {
    action = "Reparo de duplicidades no histórico concluído";
  }

  const parts = [
    action,
    source ? "origem: " + source : "",
    scanned ? "verificados: " + scanned : "",
    archived ? "movidos: " + archived : "",
    skipped ? "ignorados: " + skipped : "",
    duplicateInHist ? "já estavam no histórico: " + duplicateInHist : "",
    notOk ? "não OK: " + notOk : "",
    errors ? "erros: " + errors : "",
    batchId ? "lote: " + batchId : ""
  ].filter(function(x) {
    return !!x;
  });

  GFP_DATALAKE_APPEND_SYS_LOG_LIMPO_16_1_3_(
    timestamp,
    level,
    "GFP_DATALAKE",
    parts.join(" | "),
    ""
  );
  try {
    if (typeof GFP_DRE_VISAO_RECONSTRUIR_16_1_5 === "function") {
      GFP_DRE_VISAO_RECONSTRUIR_16_1_5();
    }
  } catch (e) {
    // Não interrompe arquivamento/desarquivamento por falha de atualização visual.
  }
  return true;
}

/**
 * Escreve no SYS_LOGS no padrão antigo:
 *
 * Timestamp | Level | Function | Message | Stack Trace
 *
 * Sem JSON, sem wrap e com linha normal.
 */
function GFP_DATALAKE_APPEND_SYS_LOG_LIMPO_16_1_3_(timestamp, level, funcName, message, stack) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("SYS_LOGS");

  if (!sh) {
    sh = ss.insertSheet("SYS_LOGS");
  }

  GFP_DATALAKE_ENSURE_SYS_LOGS_HEADER_16_1_3_(sh);

  sh.insertRowBefore(2);

  sh.getRange(2, 1, 1, 5).setValues([[
    timestamp || new Date(),
    GFP_DATALAKE_ONE_LINE_16_1_3_(level || "INFO").toUpperCase(),
    GFP_DATALAKE_ONE_LINE_16_1_3_(funcName || ""),
    GFP_DATALAKE_TRUNC_16_1_3_(message || "", 1000),
    GFP_DATALAKE_TRUNC_16_1_3_(stack || "", 500)
  ]]);

  GFP_DATALAKE_FORMAT_SYS_LOGS_16_1_3_(sh);
}

function GFP_DATALAKE_ENSURE_SYS_LOGS_HEADER_16_1_3_(sh) {
  sh.getRange(1, 1, 1, 5).setValues([[
    "Timestamp",
    "Level",
    "Function",
    "Message",
    "Stack Trace"
  ]]);
}

function GFP_DATALAKE_FORMAT_SYS_LOGS_16_1_3_(sh) {
  const lastRow = Math.max(1, sh.getLastRow());

  sh.getRange(1, 1, 1, 5)
    .setFontWeight("bold")
    .setBackground("#000000")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);

  if (sh.getFilter()) {
    sh.getFilter().remove();
  }

  sh.getDataRange().createFilter();

  try {
    sh.getRange("A:A").setNumberFormat("dd/mm/yyyy hh:mm:ss");
  } catch (e) {}

  try {
    sh.getRange(1, 1, lastRow, 5).setWrap(false);
  } catch (e2) {}

  try {
    if (lastRow >= 2) {
      sh.setRowHeights(2, lastRow - 1, 21);
    }
  } catch (e3) {}

  try { sh.setColumnWidth(1, 145); } catch (e4) {}
  try { sh.setColumnWidth(2, 70); } catch (e5) {}
  try { sh.setColumnWidth(3, 260); } catch (e6) {}
  try { sh.setColumnWidth(4, 720); } catch (e7) {}
  try { sh.setColumnWidth(5, 180); } catch (e8) {}
}

function GFP_DATALAKE_ONE_LINE_16_1_3_(value) {
  return String(value || "")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function GFP_DATALAKE_TRUNC_16_1_3_(value, max) {
  const text = GFP_DATALAKE_ONE_LINE_16_1_3_(value);

  if (text.length <= max) {
    return text;
  }

  return text.substring(0, max) + " ...[cortado]";
}

/**
 * Remove a aba LOG_ARQUIVAMENTO existente.
 *
 * Rode UMA VEZ depois de aplicar o hotfix.
 */
function GFP_DATALAKE_REMOVER_LOG_ARQUIVAMENTO_16_1_3() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("LOG_ARQUIVAMENTO");

  if (!sh) {
    SpreadsheetApp.getActive().toast("LOG_ARQUIVAMENTO não existe. Nada a remover.", "GFP 16.1.3");
    return {
      ok: true,
      removed: false,
      reason: "LOG_ARQUIVAMENTO não existia."
    };
  }

  const lastRow = sh.getLastRow();

  if (lastRow >= 2) {
    try {
      const values = sh.getRange(2, 1, lastRow - 1, 10).getValues();

      values.forEach(function(row) {
        const batchId = String(row[1] || "").trim();

        if (!batchId) return;

        GFP_DATALAKE_LOG_ARQUIVAMENTO_TO_SYS_LOGS_16_1_3_(row);
      });
    } catch (e) {
      // Mesmo se falhar a migração do resumo, a aba será removida.
    }
  }

  const fallback = ss.getSheetByName("DB_TRANSACOES") ||
    ss.getSheetByName("SYS_LOGS") ||
    ss.getSheets()[0];

  if (fallback) {
    ss.setActiveSheet(fallback);
  }

  ss.deleteSheet(sh);

  GFP_DATALAKE_APPEND_SYS_LOG_LIMPO_16_1_3_(
    new Date(),
    "OK",
    "GFP_DATALAKE_REMOVER_LOG_ARQUIVAMENTO_16_1_3",
    "Aba LOG_ARQUIVAMENTO removida. Novos eventos de arquivamento serão registrados somente no SYS_LOGS.",
    ""
  );

  SpreadsheetApp.getActive().toast(
    "LOG_ARQUIVAMENTO removida. Próximos registros irão para SYS_LOGS.",
    "GFP 16.1.3"
  );

  return {
    ok: true,
    removed: true
  };
}



/**
 * Formatação.
 */
function GFP_DATALAKE_formatSheets_15_2_(work, hist) {
  try {
    if (work) {
      work.getRange("A:A").setNumberFormat("dd/mm/yyyy");
      work.getRange("C:C").setNumberFormat("R$ #,##0.00;[Red]-R$ #,##0.00");

      if (work.getFilter()) work.getFilter().remove();
      work.getDataRange().createFilter();
    }

    if (hist) {
      hist.getRange("A:A").setNumberFormat("dd/mm/yyyy");
      hist.getRange("C:C").setNumberFormat("R$ #,##0.00;[Red]-R$ #,##0.00");

      hist.getRange(1, 1, 1, 20)
        .setFontWeight("bold")
        .setBackground("#1f4e78")
        .setFontColor("#ffffff");

      if (hist.getFilter()) hist.getFilter().remove();
      hist.getDataRange().createFilter();

      // GFP 15.8 — K:S ocultas; T/HIST_STATUS sempre visível.
      try { hist.hideColumns(11, 9); } catch (eHideMeta) {}
      try { hist.showColumns(20); } catch (eShowT) {}
      try { hist.setColumnWidth(20, 120); } catch (eWidthT) {}
    }
  } catch (e) {}
}


/**
 * Correção simples fixa — K:S ocultas; T/HIST_STATUS visível.
 */
function GFP_MANTER_HIST_STATUS_VISIVEL_15_6(options) {
  options = options || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hist = ss.getSheetByName("DB_TRANSACOES_HIST");

  if (!hist) {
    if (!options.silent) {
      ss.toast("DB_TRANSACOES_HIST não encontrada.", "GFP 15.6");
    }

    return { ok: false, error: "DB_TRANSACOES_HIST não encontrada." };
  }

  try { hist.hideColumns(11, 9); } catch (eHide) {}
  try { hist.showColumns(20); } catch (eShow) {}
  try { hist.setColumnWidth(20, 120); } catch (eWidth) {}

  if (!options.silent) {
    ss.toast("K:S ocultas e T/HIST_STATUS visível.", "GFP 15.6");
  }

  return { ok: true };
}


/**
 * Correção simples fixa — K:S ocultas; T visível.
 */
function GFP_MANTER_HIST_STATUS_VISIVEL_15_5(options) {
  options = options || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hist = ss.getSheetByName("DB_TRANSACOES_HIST");

  if (!hist) {
    if (!options.silent) {
      ss.toast("DB_TRANSACOES_HIST não encontrada.", "GFP 15.5");
    }

    return { ok: false };
  }

  try { hist.hideColumns(11, 9); } catch (eHide) {}
  try { hist.showColumns(20); } catch (eShow) {}
  try { hist.setColumnWidth(20, 120); } catch (eWidth) {}

  if (!options.silent) {
    ss.toast("K:S ocultas e T/HIST_STATUS visível.", "GFP 15.5");
  }

  return { ok: true };
}





/**
 * Protege a aba histórica inteira com uma única proteção.
 */
function GFP_DATALAKE_protectHistSheet_15_2_(hist) {
  if (!hist) hist = GFP_DATALAKE_ensureHistSheet_15_2_();

  try {
    const protections = hist.getProtections(SpreadsheetApp.ProtectionType.SHEET);

    protections.forEach(function(p) {
      try {
        if (p.canEdit() && String(p.getDescription() || "").indexOf("GFP_HIST_PROTEGIDO") >= 0) {
          p.remove();
        }
      } catch (e) {}
    });

    const protection = hist.protect();
    protection.setDescription("GFP_HIST_PROTEGIDO_WARNING_15_2_4");

    // Modo correto para uso pessoal: mostra o aviso "Pense bem!" antes de editar.
    // Isso evita alteração acidental sem travar o proprietário em burocracia.
    protection.setWarningOnly(true);

    try {
      if (protection.canDomainEdit()) protection.setDomainEdit(false);
    } catch (eDomain) {}

    try {
      hist.setTabColor("#1d4ed8");
    } catch (eColor) {}

    return {
      ok: true,
      mode: "WARNING_ONLY_FULL_SHEET",
      description: "GFP_HIST_PROTEGIDO_WARNING_15_2_4"
    };

  } catch (e) {
    return {
      ok: false,
      mode: "FAILED",
      error: e.message
    };
  }
}

/**
 * Instala/garante as abas da arquitetura histórica.
 */
function GFP_DATALAKE_INSTALAR_HISTORICO_15_2() {
  const hist = GFP_DATALAKE_ensureHistSheet_15_2_();
  GFP_DATALAKE_ensureLogSheet_15_2_();
  GFP_DATALAKE_formatSheets_15_2_(
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GFP_DATALAKE_WORK_SHEET_15_2),
    hist
  );
  GFP_DATALAKE_protectHistSheet_15_2_(hist);

  SpreadsheetApp.getActive().toast(
    "Histórico instalado: DB_TRANSACOES_HIST + LOG_ARQUIVAMENTO.",
    "GFP Histórico"
  );

  return {
    ok: true,
    histSheet: GFP_DATALAKE_HIST_SHEET_15_2,
    logSheet: GFP_DATALAKE_LOG_SHEET_15_2
  };
}

function GFP_DATALAKE_parseJson_15_2_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}

function GFP_DATALAKE_norm_15_2_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

/**
 * =============================================================================
 * 🗃️ GFP 15.2.4 — HISTÓRICO PROTEGIDO CONSOLIDADO
 * =============================================================================
 *
 * Consolida, de uma vez só, os pontos que estavam espalhados nos hotfixes:
 * - 15.2.1: tela visual de histórico/desarquivamento;
 * - 15.2.2: proteção do histórico;
 * - 15.2.3: preservação de notas de célula.
 *
 * Decisão final:
 * - Sem auto-restauração pesada por onEdit;
 * - Sem fechamento mensal;
 * - Sem proteção linha a linha;
 * - DB_TRANSACOES = mesa de trabalho;
 * - DB_TRANSACOES_HIST = histórico protegido por aba inteira em warning-only;
 * - notas de célula são preservadas via getNotes/setNotes.
 * =============================================================================
 */

const GFP_HIST_UI_VERSION_15_2_4 = "15.2.4";

/**
 * Reaplica proteção nativa de aba inteira no histórico.
 * Esse é o comportamento desejado: aviso "Pense bem!" antes de editar.
 */
function GFP_PROTEGER_HISTORICO_INTEIRO_15_2_4() {
  const hist = GFP_DATALAKE_ensureHistSheet_15_2_();
  const result = GFP_DATALAKE_protectHistSheet_15_2_(hist);

  SpreadsheetApp.getActive().toast(
    result && result.ok
      ? "🔐 Histórico protegido com aviso nativo do Google Sheets."
      : "⚠️ Não foi possível proteger o histórico.",
    "GFP Histórico"
  );

  return result;
}

/**
 * Abre a tela visual de histórico/desarquivamento.
 */
function GFP_ABRIR_HISTORICO_ARQUIVADO_15_2_4() {
  const html = HtmlService
    .createHtmlOutput(GFP_HISTORICO_UI_HTML_15_2_4_())
    .setTitle("GFP — Histórico Arquivado")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setWidth(1320)
    .setHeight(860);

  SpreadsheetApp.getUi().showModalDialog(html, "GFP — Histórico Arquivado");
}

/**
 * Compatibilidade com menu antigo 15.2.1, se já tiver sido colado.
 */
function GFP_ABRIR_HISTORICO_ARQUIVADO_15_2_1() {
  return GFP_ABRIR_HISTORICO_ARQUIVADO_15_2_4();
}

/**
 * Lista histórico ativo.
 */
function apiGfpHistoricoList_15_2_4(filters) {
  filters = filters || {};

  const q = GFP_DATALAKE_norm_15_2_(filters.q || "");
  const monthKey = String(filters.monthKey || "Tudo");
  const account = String(filters.account || "Tudo");
  const limit = Math.max(50, Math.min(Number(filters.limit || 500), 3000));

  const hist = GFP_DATALAKE_ensureHistSheet_15_2_();

  const result = {
    ok: true,
    version: GFP_HIST_UI_VERSION_15_2_4,
    totalActive: 0,
    totalFiltered: 0,
    returned: 0,
    accounts: [],
    months: [],
    items: []
  };

  if (!hist || hist.getLastRow() < 2) return result;

  const values = hist.getRange(2, 1, hist.getLastRow() - 1, 20).getValues();

  const accountSet = {};
  const monthSet = {};
  const filtered = [];

  values.forEach(function(row, idx) {
    const rowNumber = idx + 2;
    const histStatus = GFP_DATALAKE_norm_15_2_(row[19]);

    if (histStatus === "DESARQUIVADO") return;

    const meta = GFP_DATALAKE_parseJson_15_2_(row[13]);
    const dateKey = GFP_DATALAKE_dateKey_15_2_4_(row[0]);
    const cashMonth = GFP_DATALAKE_extractCashMonthUI_15_2_4_(meta);
    const effectiveMonth = cashMonth || (dateKey ? dateKey.slice(0, 7) : "");

    const item = {
      rowNumber: rowNumber,
      date: GFP_DATALAKE_dateBr_15_2_4_(dateKey),
      dateKey: dateKey,
      cashMonth: effectiveMonth,
      description: String(row[1] || ""),
      value: GFP_DATALAKE_number_15_2_4_(row[2]),
      tipo: String(row[3] || ""),
      account: String(row[4] || ""),
      category: String(row[5] || ""),
      status: String(row[8] || ""),
      notesText: String(row[9] || ""),
      id: String(row[10] || ""),
      hash: String(row[12] || ""),
      archivedAt: String(row[14] || ""),
      archivedBy: String(row[15] || ""),
      batchId: String(row[16] || ""),
      histStatus: String(row[19] || "ARQUIVADO")
    };

    result.totalActive++;

    if (item.account) accountSet[item.account] = true;
    if (item.cashMonth) monthSet[item.cashMonth] = true;

    if (account !== "Tudo" && item.account !== account) return;
    if (monthKey !== "Tudo" && item.cashMonth !== monthKey) return;

    if (q) {
      const hay = GFP_DATALAKE_norm_15_2_([
        item.date,
        item.cashMonth,
        item.description,
        item.value,
        item.tipo,
        item.account,
        item.category,
        item.status,
        item.notesText,
        item.id,
        item.hash,
        item.batchId
      ].join(" "));

      if (hay.indexOf(q) < 0) return;
    }

    filtered.push(item);
  });

  filtered.sort(function(a, b) {
    if (a.cashMonth !== b.cashMonth) return String(b.cashMonth).localeCompare(String(a.cashMonth));
    return Number(b.rowNumber || 0) - Number(a.rowNumber || 0);
  });

  result.accounts = Object.keys(accountSet).sort();
  result.months = Object.keys(monthSet).sort().reverse();
  result.totalFiltered = filtered.length;
  result.items = filtered.slice(0, limit);
  result.returned = result.items.length;

  return result;
}

/**
 * Compatibilidade com chamada antiga 15.2.1.
 */
function apiGfpHistoricoList_15_2_1(filters) {
  return apiGfpHistoricoList_15_2_4(filters);
}

/**
 * Desarquiva selecionados.
 */
function apiGfpHistoricoUnarchiveSelected_15_2_4(payload) {
  payload = payload || {};

  const rowNumbers = Array.isArray(payload.rowNumbers)
    ? payload.rowNumbers.map(Number).filter(function(n) { return n >= 2; })
    : [];

  if (!rowNumbers.length) {
    return {
      ok: false,
      message: "Nenhuma linha selecionada.",
      unarchived: 0
    };
  }

  return GFP_DATALAKE_unarchiveRows_15_2_4_(rowNumbers, {
    source: "UI_DESARQUIVAR_SELECIONADAS"
  });
}

function apiGfpHistoricoUnarchiveSelected_15_2_1(payload) {
  return apiGfpHistoricoUnarchiveSelected_15_2_4(payload);
}

/**
 * Desarquiva todos os itens filtrados, não apenas os exibidos no limite.
 */
function apiGfpHistoricoUnarchiveFiltered_15_2_4(payload) {
  payload = payload || {};

  const rowNumbers = GFP_DATALAKE_getFilteredHistRowNumbers_15_2_4_(payload.filters || {});

  if (!rowNumbers.length) {
    return {
      ok: false,
      message: "Nenhuma linha filtrada para desarquivar.",
      unarchived: 0
    };
  }

  const result = GFP_DATALAKE_unarchiveRows_15_2_4_(rowNumbers, {
    source: "UI_DESARQUIVAR_FILTRADOS"
  });

  result.filteredTotal = rowNumbers.length;

  return result;
}

function apiGfpHistoricoUnarchiveFiltered_15_2_1(payload) {
  return apiGfpHistoricoUnarchiveFiltered_15_2_4(payload);
}

/**
 * Motor de desarquivamento preservando notas de célula.
 */

function GFP_DATALAKE_unarchiveRows_15_2_4_(rowNumbers, options) {
  options = options || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const work = ss.getSheetByName(GFP_DATALAKE_WORK_SHEET_15_2) || ss.insertSheet(GFP_DATALAKE_WORK_SHEET_15_2);
  const hist = GFP_DATALAKE_ensureHistSheet_15_2_();
  const log = GFP_DATALAKE_ensureLogSheet_15_2_();

  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(30000)) {
    return {
      ok: false,
      message: "Outro processo está em execução. Tente novamente.",
      unarchived: 0
    };
  }

  const result = {
    ok: true,
    version: "15.2.6",
    batchId: "UNARCH-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss"),
    source: options.source || "UI_DESARQUIVAR",
    requested: rowNumbers.length,
    unarchived: 0,
    skipped: 0,
    errors: [],
    rows: []
  };

  try {
    const uniqueRows = rowNumbers
      .filter(function(v, i, arr) { return arr.indexOf(v) === i; })
      .sort(function(a, b) { return a - b; });

    uniqueRows.forEach(function(rowNumber) {
      try {
        if (rowNumber < 2 || rowNumber > hist.getLastRow()) {
          result.skipped++;
          return;
        }

        const histFullRange = hist.getRange(rowNumber, 1, 1, 20);
        const row = histFullRange.getValues()[0];
        const rowNotes = hist
          .getRange(rowNumber, 1, 1, GFP_DATALAKE_BASE_COLS_15_2)
          .getNotes()[0];

        const histStatus = GFP_DATALAKE_norm_15_2_(row[19]);

        if (histStatus === "DESARQUIVADO") {
          result.skipped++;
          return;
        }

        const baseRow = row.slice(0, GFP_DATALAKE_BASE_COLS_15_2);
        const meta = GFP_DATALAKE_parseJson_15_2_(baseRow[13]);

        if (!meta.gfp_archive) meta.gfp_archive = {};

        meta.gfp_archive.lastUnarchive = {
          unarchivedAt: new Date().toISOString(),
          unarchivedBy: Session.getActiveUser().getEmail() || "",
          sourceHistRow: rowNumber,
          source: result.source,
          batchId: result.batchId,
          reason: "Desarquivado pela tela Histórico Arquivado.",
          version: "15.2.6"
        };

        // Retorna para mesa de trabalho em estado revisável.
        baseRow[8] = "PENDENTE";
        baseRow[13] = JSON.stringify(meta);

        const newWorkRow = GFP_DATALAKE_appendWorkRowAS_16_1_12_(work, baseRow);
        const newWorkRange = work.getRange(newWorkRow, 1, 1, GFP_DATALAKE_BASE_COLS_15_2);

        newWorkRange.setBackground("#fff7cc");
        newWorkRange.setNotes([
          GFP_DATALAKE_notesNormalize_15_2_4_(rowNotes, GFP_DATALAKE_BASE_COLS_15_2)
        ]);

        // GFP 15.2.6 — devolve a linha com validações/listas/checkbox de mesa de trabalho.
        GFP_DATALAKE_applyWorkRowUX_15_2_6_(work, newWorkRow);

        try {
          const statusNoteCell = work.getRange(newWorkRow, 9);
          const oldStatusNote = String(statusNoteCell.getNote() || "");
          statusNoteCell.setNote(
            GFP_DATALAKE_appendNote_15_2_4_(
              oldStatusNote,
              "🔓 Linha desarquivada do histórico. Revise e valide novamente."
            )
          );
        } catch (eNote) {}

        hist.getRange(rowNumber, 20).setValue("DESARQUIVADO");

        result.unarchived++;
        result.rows.push({
          histRow: rowNumber,
          workRow: newWorkRow,
          id: String(baseRow[10] || ""),
          hash: String(baseRow[12] || ""),
          description: String(baseRow[1] || ""),
          value: baseRow[2]
        });

      } catch (eItem) {
        result.skipped++;
        result.errors.push({
          rowNumber: rowNumber,
          error: eItem.message
        });
      }
    });

    GFP_DATALAKE_formatSheets_15_2_(work, hist);
    GFP_DATALAKE_protectHistSheet_15_2_(hist);

    log.appendRow([
      new Date(),
      result.batchId,
      result.source,
      result.requested,
      0,
      result.skipped,
      0,
      0,
      result.errors.length,
      JSON.stringify(result)
    ]);

    result.message = "Linhas desarquivadas: " + result.unarchived + " | ignoradas: " + result.skipped;

    return result;

  } finally {
    lock.releaseLock();
  }
}


/**
 * Retorna rowNumbers de todos os históricos ativos filtrados.
 */
function GFP_DATALAKE_getFilteredHistRowNumbers_15_2_4_(filters) {
  filters = filters || {};

  const q = GFP_DATALAKE_norm_15_2_(filters.q || "");
  const monthKey = String(filters.monthKey || "Tudo");
  const account = String(filters.account || "Tudo");

  const hist = GFP_DATALAKE_ensureHistSheet_15_2_();

  if (!hist || hist.getLastRow() < 2) return [];

  const values = hist.getRange(2, 1, hist.getLastRow() - 1, 20).getValues();
  const out = [];

  values.forEach(function(row, idx) {
    const rowNumber = idx + 2;
    const histStatus = GFP_DATALAKE_norm_15_2_(row[19]);

    if (histStatus === "DESARQUIVADO") return;

    const meta = GFP_DATALAKE_parseJson_15_2_(row[13]);
    const dateKey = GFP_DATALAKE_dateKey_15_2_4_(row[0]);
    const cashMonth = GFP_DATALAKE_extractCashMonthUI_15_2_4_(meta) || (dateKey ? dateKey.slice(0, 7) : "");
    const acc = String(row[4] || "");

    if (account !== "Tudo" && acc !== account) return;
    if (monthKey !== "Tudo" && cashMonth !== monthKey) return;

    if (q) {
      const hay = GFP_DATALAKE_norm_15_2_([
        GFP_DATALAKE_dateBr_15_2_4_(dateKey),
        cashMonth,
        row[1],
        row[2],
        row[3],
        row[4],
        row[5],
        row[8],
        row[9],
        row[10],
        row[12],
        row[16]
      ].join(" "));

      if (hay.indexOf(q) < 0) return;
    }

    out.push(rowNumber);
  });

  return out;
}

/**
 * Repara parcialmente notas já perdidas usando a coluna J/NOTAS.
 * Só funciona se a coluna J tiver texto.
 */
function GFP_REPARAR_NOTAS_HISTORICO_A_PARTIR_COLUNA_J_15_2_4() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hist = ss.getSheetByName(GFP_DATALAKE_HIST_SHEET_15_2);

  if (!hist || hist.getLastRow() < 2) {
    ss.toast("Histórico vazio ou inexistente.", "GFP Notas");
    return { ok: true, repaired: 0 };
  }

  const lastRow = hist.getLastRow();
  const values = hist.getRange(2, 10, lastRow - 1, 1).getValues();
  const notes = hist.getRange(2, 10, lastRow - 1, 1).getNotes();

  let repaired = 0;

  for (let i = 0; i < values.length; i++) {
    const text = String(values[i][0] || "").trim();
    const note = String(notes[i][0] || "").trim();

    if (text && !note) {
      notes[i][0] = text;
      repaired++;
    }
  }

  if (repaired) {
    hist.getRange(2, 10, lastRow - 1, 1).setNotes(notes);
  }

  ss.toast("Notas reparadas parcialmente: " + repaired, "GFP Notas");

  return {
    ok: true,
    repaired: repaired
  };
}

function GFP_REPARAR_NOTAS_HISTORICO_A_PARTIR_COLUNA_J_15_2_3() {
  return GFP_REPARAR_NOTAS_HISTORICO_A_PARTIR_COLUNA_J_15_2_4();
}

function GFP_DATALAKE_notesNormalize_15_2_4_(arr, width) {
  arr = Array.isArray(arr) ? arr.slice(0, width) : [];
  while (arr.length < width) arr.push("");
  return arr;
}

function GFP_DATALAKE_blankNotes_15_2_4_(width) {
  return Array.from({ length: width }, function() { return ""; });
}

function GFP_DATALAKE_appendNote_15_2_4_(oldNote, newNote) {
  oldNote = String(oldNote || "").trim();
  newNote = String(newNote || "").trim();

  if (!oldNote) return newNote;
  if (!newNote) return oldNote;
  if (oldNote.indexOf(newNote) >= 0) return oldNote;

  return oldNote + "\n\n" + newNote;
}

function GFP_DATALAKE_extractCashMonthUI_15_2_4_(meta) {
  if (!meta || typeof meta !== "object") return "";

  const candidates = [
    meta.cashMonth,
    meta.cash_month,
    meta.competencia_fatura,
    meta.competenciaFatura,
    meta.invoiceCashMonth,
    meta.invoiceMonth,
    meta.faturaMonth,
    meta.mesCaixa,
    meta.cardCashMonth,
    meta.cardInvoiceCashMonth,
    meta.invoice && meta.invoice.cashMonth,
    meta.invoice && meta.invoice.month,
    meta.fatura && meta.fatura.cashMonth,
    meta.fatura && meta.fatura.competencia,
    meta.cardInvoice && meta.cardInvoice.cashMonth
  ];

  for (let i = 0; i < candidates.length; i++) {
    const cm = GFP_DATALAKE_normalizeMonthUI_15_2_4_(candidates[i]);
    if (cm) return cm;
  }

  const raw = JSON.stringify(meta);
  const m = raw.match(/20\d{2}-\d{2}/);

  return m ? GFP_DATALAKE_normalizeMonthUI_15_2_4_(m[0]) : "";
}

function GFP_DATALAKE_normalizeMonthUI_15_2_4_(value) {
  const s = String(value || "").trim();

  if (!s) return "";

  let m = s.match(/^(20\d{2})-(\d{2})$/);
  if (m) return m[1] + "-" + m[2];

  m = s.match(/^(\d{2})\/(20\d{2})$/);
  if (m) return m[2] + "-" + m[1];

  m = s.match(/^(20\d{2})\/(\d{2})$/);
  if (m) return m[1] + "-" + m[2];

  m = s.match(/^(20\d{2})-(\d{2})-\d{2}$/);
  if (m) return m[1] + "-" + m[2];

  return "";
}

function GFP_DATALAKE_dateKey_15_2_4_(value) {
  if (!value) return "";

  let d;

  if (value instanceof Date && !isNaN(value.getTime())) {
    d = value;
  } else {
    const s = String(value || "").trim();

    let m = s.match(/^(\d{2})\/(\d{2})\/(20\d{2})$/);
    if (m) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

    if (!d) {
      m = s.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
      if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }

    if (!d) d = new Date(s);
  }

  if (!d || isNaN(d.getTime())) return "";

  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function GFP_DATALAKE_dateBr_15_2_4_(key) {
  const m = String(key || "").match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
}

function GFP_DATALAKE_number_15_2_4_(value) {
  if (typeof value === "number") return isNaN(value) ? 0 : value;

  const s = String(value || "0")
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

/**
 * HTML embutido da tela Histórico Arquivado.
 */
function GFP_HISTORICO_UI_HTML_15_2_4_() {
  return `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --line: #e2e8f0;
      --line2: #cbd5e1;
      --text: #334155;
      --strong: #0f172a;
      --muted: #64748b;
      --blue: #2563eb;
      --blue-soft: #eff6ff;
      --green: #00994d;
      --red: #dc2626;
      --orange: #d97706;
      --row-hover: #f8fbff;
      --row-selected: #eff6ff;
    }

    * {
      box-sizing: border-box;
      font-family: 'Inter', sans-serif !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      overflow: hidden;
    }

    .topbar {
      background: rgba(255,255,255,.99);
      border-bottom: 1px solid var(--line);
      padding: 8px 12px 7px;
    }

    .command {
      display: grid;
      grid-template-columns: minmax(250px, 1fr) 126px minmax(210px, 270px) 74px auto;
      gap: 7px;
      align-items: end;
    }

    label {
      display: block;
      font-size: 9px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .04em;
      margin-bottom: 3px;
    }

    input, select, button {
      width: 100%;
      height: 32px;
      border-radius: 7px;
      border: 1px solid var(--line2);
      background: #fff;
      color: var(--text);
      font-size: 13px;
      font-weight: 600;
      padding: 5px 9px;
      outline: none;
    }

    button {
      cursor: pointer;
      white-space: nowrap;
    }

    .actions {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
      align-items: end;
    }

    .btn-blue {
      background: var(--blue-soft);
      color: var(--blue);
      border-color: #93c5fd;
    }

    .btn-green {
      background: #ecfdf5;
      color: var(--green);
      border-color: #86efac;
    }

    .btn-orange {
      background: #fff7ed;
      color: var(--orange);
      border-color: #fed7aa;
    }

    .meta {
      margin-top: 5px;
      font-size: 11px;
      color: var(--muted);
      font-weight: 500;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
    }

    .wrap {
      height: calc(100vh - 74px);
      padding: 10px 12px 12px;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: 0 1px 2px rgba(15,23,42,.04);
      overflow: hidden;
      width: 100%;
    }

    .list {
      width: 100%;
      overflow-x: hidden;
    }

    .list-head,
    .hist-row {
      display: grid;
      grid-template-columns: 36px 88px minmax(260px, 1.65fr) minmax(165px, .72fr) minmax(300px, 1.55fr) 72px 104px;
      column-gap: 10px;
      align-items: center;
      width: 100%;
    }

    .list-head {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #f8fafc;
      border-bottom: 1px solid var(--line);
      padding: 8px 10px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .03em;
      font-size: 10px;
      font-weight: 700;
    }

    .head-cell {
      cursor: pointer;
      user-select: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
      white-space: nowrap;
    }

    .head-cell:hover {
      color: var(--blue);
    }

    .sort-mark {
      font-size: 9px;
      color: var(--blue);
      min-width: 10px;
    }

    .hist-row {
      min-height: 58px;
      padding: 7px 10px;
      border-bottom: 1px solid var(--line);
      cursor: pointer;
      transition: background .12s ease;
    }

    .hist-row:hover {
      background: var(--row-hover);
    }

    .hist-row.selected {
      background: var(--row-selected);
      box-shadow: inset 3px 0 0 var(--blue);
    }

    .check-cell {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .rowcheck {
      width: 15px;
      height: 15px;
      accent-color: var(--blue);
      cursor: pointer;
    }

    .date-main {
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
    }

    .desc {
      min-width: 0;
      font-weight: 700;
      color: var(--strong);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sub {
      margin-top: 2px;
      color: var(--muted);
      font-size: 10.5px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .account {
      min-width: 0;
      color: #1e3a5f;
      font-weight: 600;
      line-height: 1.18;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .category {
      min-width: 0;
      color: #111827;
      font-weight: 650;
      line-height: 1.22;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .status-pill {
      justify-self: start;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--line);
      border-radius: 999px;
      min-width: 34px;
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 600;
      color: #334155;
      background: #fff;
    }

    .money {
      text-align: right;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .green { color: var(--green) !important; }
    .red { color: var(--red) !important; }

    .feedback {
      display: none;
      margin-top: 7px;
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.35;
      border: 1px solid var(--line);
      background: #f8fafc;
      color: #334155;
    }

    .feedback.ok {
      display: block;
      background: #ecfdf5;
      border-color: #86efac;
      color: #166534;
    }

    .feedback.warn {
      display: block;
      background: #fff7ed;
      border-color: #fed7aa;
      color: #9a3412;
    }

    .feedback.err {
      display: block;
      background: #fef2f2;
      border-color: #fecaca;
      color: #991b1b;
    }

    .mass-box {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
      margin-left: auto;
    }

    .mass-box input {
      width: 14px;
      height: 14px;
      accent-color: var(--orange);
    }

    .empty {
      padding: 26px;
      text-align: center;
      color: var(--muted);
      font-weight: 600;
    }

    @media (max-width: 1160px) {
      .command {
        grid-template-columns: 1fr 120px 180px 72px;
      }

      .actions {
        grid-column: 1 / -1;
        justify-content: flex-end;
      }

      .list-head,
      .hist-row {
        grid-template-columns: 34px 82px minmax(230px, 1.4fr) minmax(130px, .7fr) minmax(260px, 1.2fr) 64px 96px;
        column-gap: 8px;
      }
    }
  </style>
</head>

<body>
  <div class="topbar">
    <div class="command">
      <div>
        <label>Buscar</label>
        <input id="q" placeholder="Descrição, conta, categoria, ID, hash..." onkeydown="if(event.key==='Enter') loadData()" />
      </div>

      <div>
        <label>Mês-caixa</label>
        <select id="monthKey"></select>
      </div>

      <div>
        <label>Conta/Cartão</label>
        <select id="account"></select>
      </div>

      <div>
        <label>Limite</label>
        <select id="limit">
          <option value="200">200</option>
          <option value="500" selected>500</option>
          <option value="1000">1000</option>
          <option value="3000">3000</option>
        </select>
      </div>

      <div class="actions">
        <button class="btn-blue" onclick="loadData()">Atualizar</button>
        <button class="btn-blue" onclick="toggleAll(true)">Selecionar</button>
        <button class="btn-blue" onclick="toggleAll(false)">Limpar</button>
        <button class="btn-green" onclick="unarchiveSelected()">Desarquivar selecionados</button>
        <button class="btn-orange" onclick="unarchiveFiltered()">Desarquivar filtrados</button>
      </div>
    </div>

    <div class="meta">
      <span class="pill" id="countPill">Carregando...</span>
      <span class="pill" id="selectedPill">Selecionados: 0</span>
      <span class="pill">Clique no título para ordenar · clique na linha para selecionar</span>
      <label class="mass-box">
        <input type="checkbox" id="allowMass">
        permitir ação em massa filtrada
      </label>
    </div>

    <div id="feedback" class="feedback"></div>
  </div>

  <div class="wrap">
    <div class="card">
      <div class="list">
        <div class="list-head">
          <div class="check-cell">✓</div>
          <div class="head-cell" onclick="sortBy('dateKey')">Data <span class="sort-mark" id="sort-dateKey"></span></div>
          <div class="head-cell" onclick="sortBy('description')">Descrição <span class="sort-mark" id="sort-description"></span></div>
          <div class="head-cell" onclick="sortBy('account')">Conta <span class="sort-mark" id="sort-account"></span></div>
          <div class="head-cell" onclick="sortBy('category')">Categoria <span class="sort-mark" id="sort-category"></span></div>
          <div class="head-cell" onclick="sortBy('status')">Status <span class="sort-mark" id="sort-status"></span></div>
          <div class="head-cell" style="justify-content:flex-end;" onclick="sortBy('value')">Valor <span class="sort-mark" id="sort-value"></span></div>
        </div>
        <div id="listBody">
          <div class="empty">Carregando histórico...</div>
        </div>
      </div>
    </div>
  </div>

<script>
  let STATE = {
    items: [],
    selected: new Set(),
    firstLoad: true,
    sort: { key: 'dateKey', dir: 'desc' }
  };

  window.onload = function() {
    loadData();
  };

  function getFilters() {
    return {
      q: document.getElementById('q').value || '',
      monthKey: document.getElementById('monthKey').value || 'Tudo',
      account: document.getElementById('account').value || 'Tudo',
      limit: Number(document.getElementById('limit').value || 500)
    };
  }

  function loadData() {
    setFeedback('Carregando histórico arquivado...', 'warn');

    google.script.run
      .withSuccessHandler(function(res) {
        STATE.items = (res && res.items) || [];
        STATE.selected = new Set();

        hydrateFilters(res);
        applySort();
        renderList();
        renderMeta(res);

        setFeedback('Histórico carregado.', 'ok');
        setTimeout(function(){ setFeedback('', ''); }, 1400);
      })
      .withFailureHandler(function(err) {
        setFeedback(err && err.message ? err.message : String(err || 'Erro ao carregar histórico.'), 'err');
      })
      .apiGfpHistoricoList_15_2_4(getFilters());
  }

  function hydrateFilters(res) {
    const month = document.getElementById('monthKey');
    const acc = document.getElementById('account');

    const currentMonth = month.value || 'Tudo';
    const currentAcc = acc.value || 'Tudo';

    month.innerHTML = '<option value="Tudo">Tudo</option>';
    (res.months || []).forEach(function(mk) {
      const opt = document.createElement('option');
      opt.value = mk;
      opt.textContent = monthLabel(mk);
      month.appendChild(opt);
    });
    month.value = currentMonth && Array.from(month.options).some(o => o.value === currentMonth) ? currentMonth : 'Tudo';

    acc.innerHTML = '<option value="Tudo">Tudo</option>';
    (res.accounts || []).forEach(function(a) {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      acc.appendChild(opt);
    });
    acc.value = currentAcc && Array.from(acc.options).some(o => o.value === currentAcc) ? currentAcc : 'Tudo';

    if (STATE.firstLoad) {
      month.addEventListener('change', loadData);
      acc.addEventListener('change', loadData);
      document.getElementById('limit').addEventListener('change', loadData);
      STATE.firstLoad = false;
    }
  }

  function renderMeta(res) {
    document.getElementById('countPill').textContent =
      'Ativos: ' + (res.totalActive || 0) +
      ' · Filtrados: ' + (res.totalFiltered || 0) +
      ' · Exibidos: ' + (res.returned || 0);

    updateSelected();
  }

  function sortBy(key) {
    if (STATE.sort.key === key) {
      STATE.sort.dir = STATE.sort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      STATE.sort.key = key;
      STATE.sort.dir = 'asc';
    }

    applySort();
    renderList();
  }

  function applySort() {
    const key = STATE.sort.key;
    const dir = STATE.sort.dir === 'desc' ? -1 : 1;

    STATE.items.sort(function(a, b) {
      let av = getSortValue(a, key);
      let bv = getSortValue(b, key);

      if (key === 'value') {
        av = Number(av || 0);
        bv = Number(bv || 0);
        return (av - bv) * dir;
      }

      av = String(av == null ? '' : av).toUpperCase();
      bv = String(bv == null ? '' : bv).toUpperCase();

      return av.localeCompare(bv, 'pt-BR', { numeric: true, sensitivity: 'base' }) * dir;
    });

    updateSortMarks();
  }

  function getSortValue(item, key) {
    if (key === 'dateKey') return item.dateKey || item.date || '';
    if (key === 'description') return item.description || '';
    if (key === 'account') return item.account || '';
    if (key === 'category') return item.category || '';
    if (key === 'status') return item.status || '';
    if (key === 'value') return item.value || 0;
    return item[key] || '';
  }

  function updateSortMarks() {
    ['dateKey', 'description', 'account', 'category', 'status', 'value'].forEach(function(k) {
      const el = document.getElementById('sort-' + k);
      if (!el) return;
      el.textContent = STATE.sort.key === k ? (STATE.sort.dir === 'asc' ? '▲' : '▼') : '';
    });
  }

  function renderList() {
    const body = document.getElementById('listBody');
    updateSortMarks();

    if (!STATE.items.length) {
      body.innerHTML = '<div class="empty">Nenhum item arquivado ativo encontrado.</div>';
      return;
    }

    body.innerHTML = STATE.items.map(function(item) {
      const checked = STATE.selected.has(item.rowNumber) ? 'checked' : '';
      const selected = STATE.selected.has(item.rowNumber) ? ' selected' : '';

      return '<div class="hist-row' + selected + '" data-row="' + item.rowNumber + '" onclick="toggleRowClick(event, this)">' +
        '<div class="check-cell"><input class="rowcheck" type="checkbox" data-row="' + item.rowNumber + '" onclick="event.stopPropagation()" onchange="toggleOne(this)" ' + checked + '></div>' +
        '<div><div class="date-main">' + esc(item.date || '') + '</div><div class="sub">' + esc(item.cashMonth || '') + '</div></div>' +
        '<div style="min-width:0;"><div class="desc" title="' + esc(item.description || '') + '">' + esc(item.description || '') + '</div><div class="sub">ID: ' + esc(item.id || '') + ' · ' + esc(shortDateTime(item.archivedAt || '')) + '</div></div>' +
        '<div class="account" title="' + esc(item.account || '') + '">' + esc(item.account || '') + '</div>' +
        '<div class="category" title="' + esc(item.category || '') + '">' + esc(item.category || '') + '</div>' +
        '<div><span class="status-pill">' + esc(item.status || '') + '</span></div>' +
        '<div class="money ' + moneyClass(item.value) + '">' + fmt(item.value) + '</div>' +
      '</div>';
    }).join('');
  }

  function toggleRowClick(event, rowEl) {
    const checkbox = rowEl.querySelector('.rowcheck');
    if (!checkbox) return;

    checkbox.checked = !checkbox.checked;
    toggleOne(checkbox);
  }

  function toggleOne(el) {
    const row = Number(el.dataset.row || 0);

    if (el.checked) STATE.selected.add(row);
    else STATE.selected.delete(row);

    const rowEl = document.querySelector('.hist-row[data-row="' + row + '"]');
    if (rowEl) rowEl.classList.toggle('selected', el.checked);

    updateSelected();
  }

  function toggleAll(on) {
    STATE.selected = new Set();

    if (on) {
      STATE.items.forEach(function(item) {
        STATE.selected.add(item.rowNumber);
      });
    }

    document.querySelectorAll('.rowcheck').forEach(function(cb) {
      cb.checked = on === true;
      const rowEl = document.querySelector('.hist-row[data-row="' + cb.dataset.row + '"]');
      if (rowEl) rowEl.classList.toggle('selected', on === true);
    });

    updateSelected();
  }

  function updateSelected() {
    document.getElementById('selectedPill').textContent = 'Selecionados: ' + STATE.selected.size;
  }

  function unarchiveSelected() {
    const rows = Array.from(STATE.selected);

    if (!rows.length) {
      setFeedback('Nenhuma linha selecionada.', 'err');
      return;
    }

    setFeedback('Desarquivando selecionados...', 'warn');

    google.script.run
      .withSuccessHandler(function(res) {
        setFeedback(res.message || ('Linhas desarquivadas: ' + (res.unarchived || 0)), res.ok ? 'ok' : 'err');
        loadData();
      })
      .withFailureHandler(function(err) {
        setFeedback(err && err.message ? err.message : String(err || 'Erro ao desarquivar.'), 'err');
      })
      .apiGfpHistoricoUnarchiveSelected_15_2_4({ rowNumbers: rows });
  }

  function unarchiveFiltered() {
    if (!document.getElementById('allowMass').checked) {
      setFeedback('Para desarquivar todos os filtrados, marque "permitir ação em massa filtrada".', 'err');
      return;
    }

    setFeedback('Desarquivando todos os itens filtrados...', 'warn');

    google.script.run
      .withSuccessHandler(function(res) {
        setFeedback(res.message || ('Linhas desarquivadas: ' + (res.unarchived || 0)), res.ok ? 'ok' : 'err');
        document.getElementById('allowMass').checked = false;
        loadData();
      })
      .withFailureHandler(function(err) {
        setFeedback(err && err.message ? err.message : String(err || 'Erro ao desarquivar filtrados.'), 'err');
      })
      .apiGfpHistoricoUnarchiveFiltered_15_2_4({ filters: getFilters() });
  }

  function setFeedback(msg, tone) {
    const el = document.getElementById('feedback');
    el.className = 'feedback ' + (tone || '');
    el.textContent = msg || '';
  }

  function fmt(value) {
    const n = Number(value || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function moneyClass(value) {
    return Number(value || 0) >= 0 ? 'green' : 'red';
  }

  function monthLabel(mk) {
    const names = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
    const m = String(mk || '').match(/^(20\\d{2})-(\\d{2})$/);
    return m ? names[Number(m[2]) - 1] + '/' + m[1] : mk;
  }

  function shortDateTime(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(0, 19);
    return d.toLocaleString('pt-BR');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
</script>
</body>
</html>
`;
}

/**
 * =============================================================================
 * ✅ GFP 15.2.6 — UX DA LINHA DESARQUIVADA NA MESA DE TRABALHO
 * =============================================================================
 *
 * Ao desarquivar, a linha volta para DB_TRANSACOES como item trabalhável:
 * - copia validações de uma linha-modelo;
 * - preserva dropdown de categoria quando houver;
 * - insere checkbox no STATUS quando a linha já tem categoria;
 * - deixa PENDENTE textual quando ainda falta categoria;
 * - mantém destaque visual amarelo claro.
 * =============================================================================
 */

function GFP_DATALAKE_applyWorkRowUX_15_2_6_(work, rowNumber) {
  if (!work || !rowNumber || rowNumber < 2) return;

  const baseCols = GFP_DATALAKE_BASE_COLS_15_2 || 14;
  const rowRange = work.getRange(rowNumber, 1, 1, baseCols);

  // 1) Copia validações de uma linha-modelo da própria DB_TRANSACOES.
  const templateRow = GFP_DATALAKE_findValidationTemplateRow_15_2_6_(work, rowNumber);

  if (templateRow) {
    try {
      const validations = work.getRange(templateRow, 1, 1, baseCols).getDataValidations();
      rowRange.setDataValidations(validations);
    } catch (eVal) {}
  }

  // 2) Destaque visual: voltou do histórico para revisão.
  try {
    rowRange.setBackground("#fff7cc");
  } catch (eBg) {}

  // 3) STATUS: checkbox para revalidar quando já há categoria.
  const category = String(work.getRange(rowNumber, 6).getValue() || "").trim();
  const statusCell = work.getRange(rowNumber, 9);

  try {
    statusCell.clearDataValidations();

    if (category) {
      statusCell.clearContent();
      statusCell.insertCheckboxes();
      statusCell.setValue(false);
    } else {
      statusCell.setValue("PENDENTE");
    }
  } catch (eStatus) {
    // Fallback: se checkbox falhar, mantém pendente.
    try {
      statusCell.setValue("PENDENTE");
    } catch (eFallback) {}
  }
}

/**
 * Procura uma linha-modelo com validação de Categoria ou Status.
 * Isso evita hardcode de ranges da taxonomia e reaproveita o que já funciona na DB.
 */
function GFP_DATALAKE_findValidationTemplateRow_15_2_6_(work, targetRow) {
  if (!work) return 0;

  const lastRow = Math.max(2, work.getLastRow());
  const maxScan = Math.min(lastRow, 1000);

  // Prioridade: linhas anteriores, porque tendem a carregar a validação correta.
  for (let r = 2; r <= maxScan; r++) {
    if (r === targetRow) continue;

    try {
      const validations = work.getRange(r, 1, 1, GFP_DATALAKE_BASE_COLS_15_2 || 14).getDataValidations()[0];

      // F = categoria, I = status.
      if (validations[5] || validations[8]) {
        return r;
      }
    } catch (e) {}
  }

  return 0;
}


/**
 * =============================================================================
 * 🧹 GFP 15.2.8 — REARQUIVAMENTO SEM DUPLICIDADE VISUAL
 * =============================================================================
 */

function GFP_DATALAKE_buildDesarchivedHistIndex_15_2_8_(hist) {
  const index = {};

  if (!hist || hist.getLastRow() < 2) return index;

  const values = hist.getRange(2, 1, hist.getLastRow() - 1, 20).getValues();

  values.forEach(function(row, idx) {
    const sheetRow = idx + 2;
    const histStatus = GFP_DATALAKE_norm_15_2_(row[19]);

    if (histStatus !== "DESARQUIVADO") return;

    const id = String(row[10] || "").trim();
    const hash = String(row[12] || "").trim();
    const keys = GFP_DATALAKE_keysFromIdHash_15_2_8_(id, hash);

    keys.forEach(function(k) {
      // Se houver mais de uma, a mais baixa será sobrescrita pela mais recente.
      index[k] = sheetRow;
    });
  });

  return index;
}

function GFP_DATALAKE_findReactivationHistRow_15_2_8_(hist, index, rowKeys, meta) {
  meta = meta || {};

  // Prioridade 1: sourceHistRow gravado no lastUnarchive.
  try {
    const sourceHistRow = Number(
      meta.gfp_archive &&
      meta.gfp_archive.lastUnarchive &&
      meta.gfp_archive.lastUnarchive.sourceHistRow
    );

    if (sourceHistRow && sourceHistRow >= 2 && sourceHistRow <= hist.getLastRow()) {
      const status = GFP_DATALAKE_norm_15_2_(hist.getRange(sourceHistRow, 20).getValue());

      if (status === "DESARQUIVADO") {
        return sourceHistRow;
      }
    }
  } catch (e) {}

  // Prioridade 2: ID/HASH.
  for (let i = 0; i < rowKeys.length; i++) {
    const k = rowKeys[i];

    if (index[k]) return index[k];
  }

  return 0;
}

function GFP_DATALAKE_buildHistFullRow_15_2_8_(payload) {
  const row = (payload.row || []).slice(0, GFP_DATALAKE_BASE_COLS_15_2);
  const meta = payload.meta || {};

  if (!meta.gfp_archive) meta.gfp_archive = {};

  // Mantém lastUnarchive, quando existir, para rastrear o ciclo completo.
  meta.gfp_archive.lastArchive = {
    archivedAt: payload.archivedAt,
    archivedBy: payload.archivedBy,
    batchId: payload.batchId,
    sourceRow: payload.sourceRow,
    source: payload.source,
    version: "15.2.8",
    statusFinal: "ARQUIVADO"
  };

  row[13] = JSON.stringify(meta);

  return row.concat([
    payload.archivedAt,
    payload.archivedBy,
    payload.batchId,
    GFP_DATALAKE_WORK_SHEET_15_2,
    payload.sourceRow,
    "ARQUIVADO"
  ]);
}

function GFP_DATALAKE_keysFromIdHash_15_2_8_(id, hash) {
  const keys = [];

  id = String(id || "").trim();
  hash = String(hash || "").trim();

  if (id) {
    keys.push(id);
    keys.push("ID:" + id);
  }

  if (hash) {
    keys.push(hash);
    keys.push("HASH:" + hash);
  }

  return keys;
}

/**
 * Repara as duplicidades já criadas pelo fluxo anterior.
 *
 * Regra:
 * - para cada ID/HASH, mantém uma única linha ARQUIVADO;
 * - remove linhas DESARQUIVADO quando já existir ARQUIVADO equivalente;
 * - se houver mais de um ARQUIVADO para a mesma chave, mantém o mais recente.
 */
function GFP_REPARAR_DUPLICADOS_REARQUIVADOS_15_2_8() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hist = ss.getSheetByName(GFP_DATALAKE_HIST_SHEET_15_2);
  const log = GFP_DATALAKE_ensureLogSheet_15_2_();

  const result = {
    ok: true,
    version: "15.2.8",
    groups: 0,
    deletedDesarchived: 0,
    deletedActiveDuplicates: 0,
    rowsDeleted: [],
    rowsKept: []
  };

  if (!hist || hist.getLastRow() < 2) {
    ss.toast("Histórico vazio ou inexistente.", "GFP Histórico");
    return result;
  }

  const lastRow = hist.getLastRow();
  const values = hist.getRange(2, 1, lastRow - 1, 20).getValues();

  const groups = {};

  values.forEach(function(row, idx) {
    const sheetRow = idx + 2;
    const id = String(row[10] || "").trim();
    const hash = String(row[12] || "").trim();

    const key = id || hash;
    if (!key) return;

    if (!groups[key]) groups[key] = [];

    groups[key].push({
      rowNumber: sheetRow,
      row: row,
      status: GFP_DATALAKE_norm_15_2_(row[19]),
      archivedAt: String(row[14] || "")
    });
  });

  const rowsToDelete = [];
  const logDetails = [];

  Object.keys(groups).forEach(function(key) {
    const list = groups[key];

    if (list.length < 2) return;

    const archived = list.filter(function(x) { return x.status === "ARQUIVADO"; });
    const desarchived = list.filter(function(x) { return x.status === "DESARQUIVADO"; });

    if (!archived.length) return;

    result.groups++;

    archived.sort(function(a, b) {
      const da = new Date(a.archivedAt).getTime();
      const db = new Date(b.archivedAt).getTime();

      if (!isNaN(da) && !isNaN(db) && da !== db) return db - da;

      return b.rowNumber - a.rowNumber;
    });

    const keep = archived[0];
    result.rowsKept.push(keep.rowNumber);

    // Mescla notas das linhas que serão removidas para a linha mantida,
    // quando a linha mantida estiver sem nota em alguma célula.
    const doomed = desarchived.concat(archived.slice(1));

    doomed.forEach(function(item) {
      GFP_DATALAKE_mergeNotesBeforeDeletingHistRow_15_2_8_(hist, keep.rowNumber, item.rowNumber);

      rowsToDelete.push(item.rowNumber);
      result.rowsDeleted.push(item.rowNumber);

      if (item.status === "DESARQUIVADO") result.deletedDesarchived++;
      else result.deletedActiveDuplicates++;

      logDetails.push({
        key: key,
        keptRow: keep.rowNumber,
        deletedRow: item.rowNumber,
        deletedStatus: item.status,
        deletedId: String(item.row[10] || ""),
        deletedHash: String(item.row[12] || ""),
        deletedDescription: String(item.row[1] || ""),
        deletedValue: item.row[2],
        deletedMetadata: item.row[13]
      });
    });
  });

  rowsToDelete
    .filter(function(v, i, arr) { return arr.indexOf(v) === i; })
    .sort(function(a, b) { return b - a; })
    .forEach(function(rowNumber) {
      hist.deleteRow(rowNumber);
    });

  GFP_DATALAKE_formatSheets_15_2_(null, hist);
  GFP_DATALAKE_protectHistSheet_15_2_(hist);

  log.appendRow([
    new Date(),
    "FIXDUP-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss"),
    "REPARAR_DUPLICADOS_REARQUIVADOS_15_2_8",
    Object.keys(groups).length,
    0,
    rowsToDelete.length,
    0,
    0,
    0,
    JSON.stringify({
      result: result,
      details: logDetails
    })
  ]);

  ss.toast(
    "Duplicidades reparadas. Removidas: " + rowsToDelete.length,
    "GFP Histórico"
  );

  return result;
}

function GFP_DATALAKE_mergeNotesBeforeDeletingHistRow_15_2_8_(hist, keepRow, deleteRow) {
  try {
    const keepRange = hist.getRange(keepRow, 1, 1, 20);
    const delRange = hist.getRange(deleteRow, 1, 1, 20);

    const keepNotes = keepRange.getNotes()[0];
    const delNotes = delRange.getNotes()[0];

    let changed = false;

    for (let c = 0; c < keepNotes.length; c++) {
      const k = String(keepNotes[c] || "").trim();
      const d = String(delNotes[c] || "").trim();

      if (!k && d) {
        keepNotes[c] = d;
        changed = true;
      }
    }

    if (changed) {
      keepRange.setNotes([keepNotes]);
    }
  } catch (e) {}
}

/**
 * =============================================================================
 * 🤖 GFP 15.3.0 — ARQUIVAMENTO AUTOMÁTICO INTELIGENTE
 * =============================================================================
 *
 * Regras:
 * - Marcou OK na DB_TRANSACOES → arquiva a linha automaticamente.
 * - Finalizou revisão em lote → arquiva OKs automaticamente.
 * - Histórico mantém T/HIST_STATUS visível.
 * =============================================================================
 */

const GFP_AUTO_ARCHIVE_VERSION_15_3 = "15.3.0";

/**
 * Arquiva automaticamente uma única linha OK da DB_TRANSACOES.
 *
 * Uso típico:
 * - chamada pelo onEdit depois que o checkbox/status virar OK.
 */
function GFP_AUTO_ARQUIVAR_LINHA_OK_15_3(sheet, rowNumber, options) {
  options = options || {};

  if (!sheet || sheet.getName() !== GFP_DATALAKE_WORK_SHEET_15_2) {
    return { ok: true, skipped: true, reason: "Aba não é DB_TRANSACOES." };
  }

  rowNumber = Number(rowNumber || 0);

  if (!rowNumber || rowNumber < 2) {
    return { ok: true, skipped: true, reason: "Linha inválida." };
  }

  SpreadsheetApp.flush();

  const row = sheet.getRange(rowNumber, 1, 1, GFP_DATALAKE_BASE_COLS_15_2).getValues()[0];
  const status = GFP_DATALAKE_norm_15_2_(row[8]);
  const category = String(row[5] || "").trim();

  if (GFP_DATALAKE_OK_STATUSES_15_2.indexOf(status) < 0) {
    return { ok: true, skipped: true, reason: "Status ainda não é OK.", status: status };
  }

  if (!category) {
    return { ok: true, skipped: true, reason: "Sem categoria. Não arquiva automaticamente." };
  }

  const cacheKey = GFP_AUTO_ARCHIVE_cacheKey_15_3_(row, rowNumber);
  const cache = CacheService.getDocumentCache();

  if (cache && cache.get(cacheKey)) {
    return { ok: true, skipped: true, reason: "Linha já em processo de arquivamento." };
  }

  if (cache) cache.put(cacheKey, "1", 30);

  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(12000)) {
    return { ok: false, skipped: true, reason: "Lock não obtido. Tente novamente." };
  }

  try {
    const result = GFP_DATALAKE_archiveRowsFromWork_15_2_(sheet, [rowNumber], {
      source: options.source || "AUTO_ON_EDIT_OK",
      silent: true
    });

    const moved = Number(result.archived || 0) + Number(result.reactivated || 0);

    if (moved > 0 && !options.silentToast) {
      try {
        SpreadsheetApp.getActive().toast(
          "📦 Linha OK arquivada automaticamente.",
          "GFP Histórico"
        );
      } catch (eToast) {}
    }

    return result;

  } finally {
    lock.releaseLock();
  }
}

/**
 * Arquiva automaticamente todas as linhas OK restantes na mesa de trabalho.
 *
 * Uso típico:
 * - chamada ao finalizar fila/lote no Painel de Revisão 2.0.
 */
function GFP_AUTO_ARQUIVAR_OKS_MESA_15_3(options) {
  options = options || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const work = ss.getSheetByName(GFP_DATALAKE_WORK_SHEET_15_2);

  if (!work) {
    return { ok: false, error: "DB_TRANSACOES não encontrada." };
  }

  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(30000)) {
    return { ok: false, error: "Lock não obtido para arquivamento automático." };
  }

  try {
    const result = GFP_DATALAKE_archiveRowsFromWork_15_2_(work, null, {
      source: options.source || "AUTO_BATCH_OK",
      silent: true
    });

    const moved = Number(result.archived || 0) + Number(result.reactivated || 0);

    if (!options.silentToast && moved > 0) {
      try {
        ss.toast(
          "📦 Arquivamento automático: " + moved + " linha(s).",
          "GFP Histórico"
        );
      } catch (eToast) {}
    }

    return result;

  } finally {
    lock.releaseLock();
  }
}

/**
 * Hook para onEdit.
 *
 * Chame este helper DEPOIS da lógica que transforma checkbox em OK.
 */
function GFP_AUTO_ARQUIVAR_ON_EDIT_15_3(e) {
  if (!e || !e.range) return false;

  const sheet = e.range.getSheet();

  if (!sheet || sheet.getName() !== GFP_DATALAKE_WORK_SHEET_15_2) return false;

  const row = e.range.getRow();
  const col = e.range.getColumn();

  if (row < 2) return false;

  // Só tenta quando a edição envolve STATUS, CATEGORIA ou uma linha recém-validada.
  // I = 9 STATUS; F = 6 CATEGORIA.
  if (col !== 9 && col !== 6) {
    return false;
  }

  const result = GFP_AUTO_ARQUIVAR_LINHA_OK_15_3(sheet, row, {
    source: "ON_EDIT_OK",
    silentToast: false
  });

  return !!(result && (Number(result.archived || 0) + Number(result.reactivated || 0)) > 0);
}

function GFP_AUTO_ARCHIVE_cacheKey_15_3_(row, rowNumber) {
  const id = String(row[10] || "").trim();
  const hash = String(row[12] || "").trim();

  if (id) return "GFP_AUTO_ARCHIVE_ID_" + id;
  if (hash) return "GFP_AUTO_ARCHIVE_HASH_" + hash;

  return "GFP_AUTO_ARCHIVE_ROW_" + rowNumber;
}

/**
 * Correção fixa: manter T/HIST_STATUS sempre visível.
 *
 * Pode ser chamada manualmente se algum fluxo voltar a ocultar a coluna T.
 */
function GFP_MANTER_HIST_STATUS_VISIVEL_15_3() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hist = ss.getSheetByName(GFP_DATALAKE_HIST_SHEET_15_2);

  if (!hist) {
    ss.toast("DB_TRANSACOES_HIST não encontrada.", "GFP Histórico");
    return { ok: false, error: "DB_TRANSACOES_HIST não encontrada." };
  }

  try { hist.hideColumns(11, 9); } catch (eHide) {}
  try { hist.showColumns(20); } catch (eShow) {}
  try { hist.setColumnWidth(20, 120); } catch (eWidth) {}

  ss.toast("Colunas K:S ocultas e T/HIST_STATUS visível.", "GFP Histórico");

  return { ok: true };
}


/**
 * =============================================================================
 * 🧰 GFP 15.7.0 — BASE FINAL / SNAPSHOT / ZERAGEM SEGURA
 * =============================================================================
 *
 * Não zera nada automaticamente.
 *
 * Para zerar a base transacional, chamar expressamente:
 *
 *   GFP_BASE_FINAL_ZERAR_TRANSACIONAL_15_7("ZERAR_BASE_GFP_15_7")
 *
 * Antes disso, rode:
 *
 *   GFP_PRECHECK_BASE_FINAL_15_7()
 *   GFP_BASE_FINAL_CRIAR_SNAPSHOT_15_7()
 * =============================================================================
 */

const GFP_BASE_FINAL_VERSION_15_7 = "15.7.0";

function GFP_BASE_FINAL_CRIAR_SNAPSHOT_15_7(options) {
  options = options || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");

  const sheetNames = [
    "DB_TRANSACOES",
    "DB_TRANSACOES_HIST",
    "LOG_ARQUIVAMENTO",
    "LOG_IMPORT_GUARD",
    "SYS_AUDITORIA_GFP",
    "SYS_DASHBOARD_2_AUDIT",
    "SYS_REVIEW_PANEL_2_AUDIT"
  ];

  const result = {
    ok: true,
    version: GFP_BASE_FINAL_VERSION_15_7,
    stamp: stamp,
    copied: [],
    skipped: []
  };

  sheetNames.forEach(function(name) {
    const sh = ss.getSheetByName(name);

    if (!sh) {
      result.skipped.push(name);
      return;
    }

    let backupName = "BK_" + stamp + "_" + name;

    if (backupName.length > 95) {
      backupName = "BK_" + stamp + "_" + name.substring(0, 95 - ("BK_" + stamp + "_").length);
    }

    try {
      const copy = sh.copyTo(ss);
      copy.setName(GFP_BASE_FINAL_uniqueSheetName_15_7_(ss, backupName));
      result.copied.push(copy.getName());
    } catch (e) {
      result.skipped.push(name + " | ERRO: " + e.message);
    }
  });

  if (!options.silent) {
    ss.toast(
      "Snapshot criado: " + result.copied.length + " aba(s).",
      "GFP 15.7"
    );
  }

  return result;
}

/**
 * Zera apenas a base transacional mantendo cabeçalhos e estrutura.
 *
 * Código obrigatório:
 *
 *   ZERAR_BASE_GFP_15_7
 *
 * Não rode agora se ainda estivermos em teste.
 */
function GFP_BASE_FINAL_ZERAR_TRANSACIONAL_15_7(confirmCode, options) {
  options = options || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (confirmCode !== "ZERAR_BASE_GFP_15_7") {
    ss.toast("Código de confirmação inválido. Nada foi zerado.", "GFP 15.7");
    return {
      ok: false,
      error: "Código de confirmação inválido.",
      required: "ZERAR_BASE_GFP_15_7"
    };
  }

  const snapshot = options.skipSnapshot
    ? { ok: true, skippedByOption: true }
    : GFP_BASE_FINAL_CRIAR_SNAPSHOT_15_7({ silent: true });

  const targets = [
    "DB_TRANSACOES",
    "DB_TRANSACOES_HIST",
    "LOG_ARQUIVAMENTO",
    "LOG_IMPORT_GUARD"
  ];

  const result = {
    ok: true,
    version: GFP_BASE_FINAL_VERSION_15_7,
    snapshot: snapshot,
    cleared: [],
    skipped: [],
    clearedAt: new Date().toISOString()
  };

  targets.forEach(function(name) {
    const sh = ss.getSheetByName(name);

    if (!sh) {
      result.skipped.push(name);
      return;
    }

    const lastRow = sh.getLastRow();
    const lastCol = Math.max(1, sh.getLastColumn());

    if (lastRow >= 2) {
      sh.getRange(2, 1, lastRow - 1, lastCol)
        .clearContent()
        .clearNote()
        .setBackground(null);
    }

    result.cleared.push(name);
  });

  const hist = ss.getSheetByName("DB_TRANSACOES_HIST");

  if (hist) {
    if (typeof GFP_DATALAKE_formatSheets_15_2_ === "function") {
      GFP_DATALAKE_formatSheets_15_2_(ss.getSheetByName("DB_TRANSACOES"), hist);
    }

    if (typeof GFP_DATALAKE_protectHistSheet_15_2_ === "function") {
      GFP_DATALAKE_protectHistSheet_15_2_(hist);
    }
  }

  if (typeof GFP_MANTER_HIST_STATUS_VISIVEL_15_7 === "function") {
    GFP_MANTER_HIST_STATUS_VISIVEL_15_7({ silent: true });
  }

  ss.toast(
    "Base transacional zerada com snapshot prévio.",
    "GFP 15.7"
  );

  return result;
}

/**
 * Recria/garante cabeçalhos básicos das abas principais.
 * Não apaga dados.
 */
function GFP_BASE_FINAL_GARANTIR_ESTRUTURA_15_7() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const work = ss.getSheetByName("DB_TRANSACOES") || ss.insertSheet("DB_TRANSACOES");

  const baseHeader = [
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

  work.getRange(1, 1, 1, baseHeader.length).setValues([baseHeader]);

  if (typeof GFP_DATALAKE_ensureHistSheet_15_2_ === "function") {
    GFP_DATALAKE_ensureHistSheet_15_2_();
  } else {
    const hist = ss.getSheetByName("DB_TRANSACOES_HIST") || ss.insertSheet("DB_TRANSACOES_HIST");

    hist.getRange(1, 1, 1, 20).setValues([baseHeader.concat([
      "ARCHIVED_AT",
      "ARCHIVED_BY",
      "ARCHIVE_BATCH_ID",
      "SOURCE_SHEET",
      "SOURCE_ROW",
      "HIST_STATUS"
    ])]);
  }

  if (typeof GFP_DATALAKE_ensureLogSheet_15_2_ === "function") {
    GFP_DATALAKE_ensureLogSheet_15_2_();
  }

  if (typeof GFP_DATALAKE_formatSheets_15_2_ === "function") {
    GFP_DATALAKE_formatSheets_15_2_(
      ss.getSheetByName("DB_TRANSACOES"),
      ss.getSheetByName("DB_TRANSACOES_HIST")
    );
  }

  if (typeof GFP_MANTER_HIST_STATUS_VISIVEL_15_7 === "function") {
    GFP_MANTER_HIST_STATUS_VISIVEL_15_7({ silent: true });
  }

  ss.toast("Estrutura base garantida.", "GFP 15.7");

  return { ok: true };
}

/**
 * Correção simples fixa:
 * K:S ocultas; T/HIST_STATUS sempre visível.
 */
function GFP_MANTER_HIST_STATUS_VISIVEL_15_7(options) {
  options = options || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hist = ss.getSheetByName("DB_TRANSACOES_HIST");

  if (!hist) {
    if (!options.silent) {
      ss.toast("DB_TRANSACOES_HIST não encontrada.", "GFP 15.7");
    }

    return { ok: false, error: "DB_TRANSACOES_HIST não encontrada." };
  }

  try { hist.hideColumns(11, 9); } catch (eHide) {}
  try { hist.showColumns(20); } catch (eShow) {}
  try { hist.setColumnWidth(20, 120); } catch (eWidth) {}

  if (!options.silent) {
    ss.toast("K:S ocultas e T/HIST_STATUS visível.", "GFP 15.7");
  }

  return { ok: true };
}

function GFP_BASE_FINAL_uniqueSheetName_15_7_(ss, desiredName) {
  desiredName = String(desiredName || "BK_GFP").substring(0, 95);

  let name = desiredName;
  let i = 2;

  while (ss.getSheetByName(name)) {
    const suffix = "_" + i;
    name = desiredName.substring(0, 95 - suffix.length) + suffix;
    i++;
  }

  return name;
}


/**
 * =============================================================================
 * 👁️ GFP 15.8.0 — HIST_STATUS SEMPRE VISÍVEL
 * =============================================================================
 *
 * Correção simples fixa:
 * - K:S ocultas;
 * - T/HIST_STATUS visível.
 * =============================================================================
 */

function GFP_MANTER_HIST_STATUS_VISIVEL_15_8(options) {
  options = options || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hist = ss.getSheetByName("DB_TRANSACOES_HIST");

  if (!hist) {
    if (!options.silent) {
      ss.toast("DB_TRANSACOES_HIST não encontrada.", "GFP 15.8");
    }

    return { ok: false, error: "DB_TRANSACOES_HIST não encontrada." };
  }

  try { hist.hideColumns(11, 9); } catch (eHide) {}
  try { hist.showColumns(20); } catch (eShow) {}
  try { hist.setColumnWidth(20, 120); } catch (eWidth) {}

  if (!options.silent) {
    ss.toast("K:S ocultas e T/HIST_STATUS visível.", "GFP 15.8");
  }

  return { ok: true };
}

/**
 * =============================================================================
 * GFP 16.0.4 — Arquivamento da linha-mãe de split
 * =============================================================================
 *
 * Garante que, ao arquivar linhas filhas de um split, a linha-mãe SPLIT também
 * seja avaliada e arquivada.
 *
 * Regras:
 * - filhas têm ID no formato IDPAI-1, IDPAI-2...
 * - mãe tem ID original e STATUS=SPLIT ou TIPO=S;
 * - a mãe deve sair da DB_TRANSACOES junto com as filhas e ir para HIST.
 */
function GFP_DATALAKE_expandSplitParents_16_0_4_(work, rowsToEvaluate) {
  if (!work || !rowsToEvaluate || !rowsToEvaluate.length) return rowsToEvaluate;

  const lastRow = work.getLastRow();
  if (lastRow < 2) return rowsToEvaluate;

  const values = work.getRange(2, 1, lastRow - 1, GFP_DATALAKE_BASE_COLS_15_2).getValues();

  const idToRow = {};
  const selectedSet = {};

  rowsToEvaluate.forEach(function(rowNumber) {
    selectedSet[rowNumber] = true;
  });

  values.forEach(function(row, idx) {
    const id = String(row[10] || "").trim();
    if (id) idToRow[id] = idx + 2;
  });

  rowsToEvaluate.slice().forEach(function(rowNumber) {
    const row = values[rowNumber - 2];
    if (!row) return;

    const id = String(row[10] || "").trim();
    const parentId = GFP_DATALAKE_getSplitParentId_16_0_4_(id);

    if (!parentId) return;

    const parentRow = idToRow[parentId];
    if (!parentRow || selectedSet[parentRow]) return;

    const parentData = values[parentRow - 2];
    if (!parentData) return;

    const parentStatus = GFP_DATALAKE_norm_15_2_(parentData[8]);
    const parentTipo = GFP_DATALAKE_norm_15_2_(parentData[3]);

    if (parentStatus === "SPLIT" || parentTipo === "S") {
      rowsToEvaluate.push(parentRow);
      selectedSet[parentRow] = true;
    }
  });

  return rowsToEvaluate;
}

function GFP_DATALAKE_getSplitParentId_16_0_4_(id) {
  id = String(id || "").trim();

  if (!id) return "";

  // Filhas do split são criadas como IDPAI-1, IDPAI-2 etc.
  if (!/-\d+$/.test(id)) return "";

  return id.replace(/-\d+$/, "");
}

/**
 * =============================================================================
 * GFP 16.1.12 — BLINDAGEM A:S INDIVISÍVEL
 * =============================================================================
 *
 * Regra:
 * - DB_TRANSACOES deve ser tratada como A:S indivisível em qualquer
 *   movimentação/ordenação física de linhas.
 * - O:S são colunas auxiliares, mas pertencem à linha.
 * - Se não viajarem junto, precisam ser recalculadas antes/depois do sort.
 * =============================================================================
 */

const GFP_DATALAKE_WORK_FULL_COLS_16_1_12 = 19;


/**
 * Garante que DB_TRANSACOES tenha colunas A:S e cabeçalhos auxiliares O:S.
 * Não cria aba nova.
 * Não altera A:N.
 */
function GFP_DATALAKE_ensureWorkAS_16_1_12_(sh) {
  if (!sh) return;

  const requiredCols = GFP_DATALAKE_WORK_FULL_COLS_16_1_12;
  const currentCols = sh.getMaxColumns();

  if (currentCols < requiredCols) {
    sh.insertColumnsAfter(currentCols, requiredCols - currentCols);
  }

  const headers = [
    "SYS_SORT_GRUPO",
    "SYS_SORT_CONFIANCA",
    "SYS_SORT_DATA",
    "SYS_SORT_STATUS",
    "SYS_SORT_AUDIT"
  ];

  const headerRange = sh.getRange(1, 15, 1, 5);
  const currentHeaders = headerRange.getValues()[0].map(function(v) {
    return String(v || "").trim();
  });

  let needsHeader = false;
  for (let i = 0; i < headers.length; i++) {
    if (currentHeaders[i] !== headers[i]) {
      needsHeader = true;
      break;
    }
  }

  if (needsHeader) {
    headerRange.setValues([headers]);
    headerRange
      .setBackground("#111827")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
  }
}


/**
 * Normaliza uma linha da mesa de trabalho para A:S.
 * A:N são a transação oficial.
 * O:S são auxiliares e podem ficar em branco para recálculo posterior.
 */
function GFP_DATALAKE_toWorkRowAS_16_1_12_(row) {
  const out = Array.isArray(row) ? row.slice(0, GFP_DATALAKE_WORK_FULL_COLS_16_1_12) : [];

  while (out.length < GFP_DATALAKE_WORK_FULL_COLS_16_1_12) {
    out.push("");
  }

  return out;
}


/**
 * Escreve uma linha na DB_TRANSACOES sempre como A:S.
 * Retorna o número da nova linha.
 */
function GFP_DATALAKE_appendWorkRowAS_16_1_12_(work, row) {
  if (!work) {
    throw new Error("DB_TRANSACOES não encontrada para append A:S.");
  }

  GFP_DATALAKE_ensureWorkAS_16_1_12_(work);

  const targetRow = work.getLastRow() + 1;
  const rowAS = GFP_DATALAKE_toWorkRowAS_16_1_12_(row);

  work.getRange(targetRow, 1, 1, GFP_DATALAKE_WORK_FULL_COLS_16_1_12)
    .setValues([rowAS]);

  return targetRow;
}


/**
 * Ordena DB_TRANSACOES de forma segura.
 *
 * Preferência:
 * - Usa o sorter oficial 14.3, que recalcula O:S e ordena A:S.
 *
 * Fallback:
 * - Se o sorter oficial não existir, ordena A:S por conta e data.
 * - Nunca ordena A:N ou A:J.
 */
function GFP_DATALAKE_sortWorkAS_16_1_12_(sh) {
  if (typeof GFP_REORGANIZAR_MESA_DB_TRANSACOES_APPLY_16_1_18_3_ === "function") {
    return GFP_REORGANIZAR_MESA_DB_TRANSACOES_APPLY_16_1_18_3_(sh, {
      normalizeVisibleNotes: true,
      sort: true
    });
  }

  const lastRow = sh.getLastRow();
  if (lastRow < 3) {
    return { sorted: false, reason: "poucas linhas" };
  }

  sh.getRange(2, 1, lastRow - 1, 19).sort([
    { column: 15, ascending: true },
    { column: 16, ascending: true },
    { column: 17, ascending: true },
    { column: 5,  ascending: true },
    { column: 2,  ascending: true },
    { column: 3,  ascending: true }
  ]);

  return {
    sorted: true,
    mode: "fallback_A:S_16_1_18_3",
    rows: lastRow - 1
  };
}





/**
 * Auditoria leve: procura sinais de desalinhamento provável entre A:J e N/METADADOS.
 *
 * Não corrige nada.
 * Não altera nada.
 *
 * Serve apenas para diagnóstico antes/depois de rotinas de sort.
 */
function GFP_AUDITAR_ALINHAMENTO_METADADOS_DB_16_1_12() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh) {
    ss.toast("DB_TRANSACOES não encontrada.", "GFP 16.1.12");
    return { ok: false, error: "DB_TRANSACOES não encontrada." };
  }

  const lastRow = sh.getLastRow();

  if (lastRow < 2) {
    return { ok: true, scanned: 0, alerts: [] };
  }

  const values = sh.getRange(2, 1, lastRow - 1, 19).getValues();
  const alerts = [];

  values.forEach(function(row, idx) {
    const sheetRow = idx + 2;

    const conta = String(row[4] || "").toUpperCase();
    const desc = String(row[1] || "").toUpperCase();
    const idArquivo = String(row[11] || "").trim();
    const metaRaw = String(row[13] || "").trim();

    if (!metaRaw) return;

    let meta = {};
    try {
      meta = JSON.parse(metaRaw);
    } catch (e) {
      alerts.push({
        row: sheetRow,
        type: "METADADOS_JSON_INVALIDO",
        description: row[1],
        account: row[4]
      });
      return;
    }

    const fileName = String(meta.fileName || meta.invoiceFileName || "").toUpperCase();
    const origin = String(meta.origin || "").toUpperCase();
    const fonte = String(meta.fonte || "").toUpperCase();
    const tipoFonte = String(meta.tipoFonte || "").toUpperCase();

    const looksAccount = conta.indexOf("PICPAY ANDRÉ") >= 0 || conta.indexOf("PICPAY ANDRE") >= 0 || conta.indexOf("PICPAY YAN") >= 0;
    const looksCard = conta.indexOf("CARTÃO") >= 0 || conta.indexOf("CARTAO") >= 0;

    const metaLooksInvoice =
      fileName.indexOf("FATURA") >= 0 ||
      origin.indexOf("REGEX_PICPAY") >= 0 ||
      fonte.indexOf("FATURA_CARTAO") >= 0 ||
      tipoFonte.indexOf("CARTAO_CREDITO") >= 0;

    const metaLooksCsv =
      fileName.indexOf(".CSV") >= 0 ||
      origin.indexOf("CSV_IMPORT") >= 0 ||
      fonte.indexOf("EXTRATO") >= 0 ||
      tipoFonte.indexOf("CONTA") >= 0;

    if (looksAccount && !looksCard && metaLooksInvoice) {
      alerts.push({
        row: sheetRow,
        type: "CONTA_COM_METADADO_DE_FATURA",
        description: row[1],
        account: row[4],
        fileName: meta.fileName || meta.invoiceFileName || "",
        origin: meta.origin || "",
        idArquivo: idArquivo
      });
    }

    if (looksCard && metaLooksCsv) {
      alerts.push({
        row: sheetRow,
        type: "CARTAO_COM_METADADO_DE_EXTRATO",
        description: row[1],
        account: row[4],
        fileName: meta.fileName || meta.invoiceFileName || "",
        origin: meta.origin || "",
        idArquivo: idArquivo
      });
    }

    if (desc.indexOf("[") === 0 && looksCard && metaLooksCsv) {
      alerts.push({
        row: sheetRow,
        type: "DESCRICAO_CARTAO_COM_META_CSV",
        description: row[1],
        account: row[4],
        fileName: meta.fileName || meta.invoiceFileName || "",
        origin: meta.origin || "",
        idArquivo: idArquivo
      });
    }
  });

  if (alerts.length) {
    ss.toast(
      "Atenção: " + alerts.length + " possível(is) desalinhamento(s) de metadados encontrados.",
      "GFP 16.1.12",
      10
    );
  } else {
    ss.toast(
      "Auditoria A:S concluída: nenhum desalinhamento óbvio encontrado.",
      "GFP 16.1.12",
      8
    );
  }

  Logger.log("[GFP_AUDITAR_ALINHAMENTO_METADADOS_DB_16_1_12] " + JSON.stringify({
    scanned: values.length,
    alerts: alerts
  }));

  return {
    ok: true,
    scanned: values.length,
    alerts: alerts
  };
}

/**
 * GFP 16.1.12.1 — Modal visual da auditoria A:S / metadados
 *
 * Não altera dados.
 * Não corrige nada.
 * Não cria aba.
 * Apenas exibe em janela HTML os possíveis desalinhamentos encontrados.
 */
function GFP_AUDITAR_ALINHAMENTO_METADADOS_DB_MODAL_16_1_12_1() {
  const result = GFP_AUDITAR_ALINHAMENTO_METADADOS_DB_16_1_12();

  const alerts = result && Array.isArray(result.alerts) ? result.alerts : [];
  const scanned = result && result.scanned ? result.scanned : 0;

  const rowsHtml = alerts.length
    ? alerts.map(function(a) {
        return `
          <tr>
            <td class="row">${GFP_HTML_ESCAPE_16_1_12_1_(a.row || "")}</td>
            <td><span class="badge">${GFP_HTML_ESCAPE_16_1_12_1_(a.type || "")}</span></td>
            <td>${GFP_HTML_ESCAPE_16_1_12_1_(a.description || "")}</td>
            <td>${GFP_HTML_ESCAPE_16_1_12_1_(a.account || "")}</td>
            <td>${GFP_HTML_ESCAPE_16_1_12_1_(a.fileName || "")}</td>
            <td>${GFP_HTML_ESCAPE_16_1_12_1_(a.origin || "")}</td>
          </tr>
        `;
      }).join("")
    : `
      <tr>
        <td colspan="6" class="empty">
          Nenhum desalinhamento óbvio encontrado.
        </td>
      </tr>
    `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f8fafc;
            color: #0f172a;
          }

          .header {
            background: #0b2d4d;
            color: #fff;
            padding: 18px 22px;
          }

          .header h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
          }

          .header p {
            margin: 6px 0 0;
            font-size: 12px;
            opacity: .85;
          }

          .content {
            padding: 18px 22px 22px;
          }

          .summary {
            background: #eef6ff;
            border: 1px solid #bfdbfe;
            border-radius: 10px;
            padding: 12px 14px;
            margin-bottom: 16px;
            font-size: 13px;
          }

          .summary strong {
            color: #0b2d4d;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            overflow: hidden;
            font-size: 12px;
          }

          th {
            background: #e5e7eb;
            text-align: left;
            padding: 9px;
            color: #111827;
            border-bottom: 1px solid #cbd5e1;
          }

          td {
            padding: 9px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: top;
          }

          tr:last-child td {
            border-bottom: none;
          }

          .row {
            font-weight: 700;
            color: #0b2d4d;
            white-space: nowrap;
          }

          .badge {
            display: inline-block;
            padding: 3px 7px;
            border-radius: 999px;
            background: #fee2e2;
            color: #991b1b;
            font-weight: 700;
            font-size: 10px;
            white-space: nowrap;
          }

          .empty {
            text-align: center;
            color: #166534;
            background: #f0fdf4;
            font-weight: 700;
            padding: 18px;
          }

          .footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 16px;
          }

          button {
            border: 0;
            background: #0b2d4d;
            color: #fff;
            font-weight: 700;
            border-radius: 8px;
            padding: 10px 16px;
            cursor: pointer;
          }

          .note {
            margin-top: 12px;
            font-size: 11px;
            color: #475569;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>GFP — Auditoria A:S / Metadados</h1>
          <p>Verificação de possíveis linhas com dados principais e metadados desalinhados.</p>
        </div>

        <div class="content">
          <div class="summary">
            Linhas analisadas: <strong>${scanned}</strong><br>
            Possíveis desalinhamentos encontrados: <strong>${alerts.length}</strong>
          </div>

          <table>
            <thead>
              <tr>
                <th>Linha</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Conta</th>
                <th>Arquivo nos metadados</th>
                <th>Origem nos metadados</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="note">
            Esta auditoria é somente diagnóstica. Ela não altera, não corrige, não apaga e não reorganiza nenhuma linha.
            Se houver suspeitas, a correção deve ser feita em patch próprio, com base em ID_TRANSACAO, HASH, arquivo original e origem correta.
          </div>

          <div class="footer">
            <button onclick="google.script.host.close()">OK, fechar</button>
          </div>
        </div>
      </body>
    </html>
  `;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(1100).setHeight(620),
    "GFP — Auditoria A:S / Metadados"
  );

  return result;
}


function GFP_HTML_ESCAPE_16_1_12_1_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function GFP_REPARAR_METADADOS_DESALINHADOS_PREVIEW_16_1_12_2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();

  if (!sh || sh.getName() !== "DB_TRANSACOES") {
    ss.toast("Abra a aba DB_TRANSACOES e selecione as linhas suspeitas.", "GFP 16.1.12.2", 8);
    return { ok: false, error: "Aba ativa não é DB_TRANSACOES." };
  }

  const rows = GFP_REPARO_META_GET_SELECTED_ROWS_16_1_12_2_(sh);

  if (!rows.length) {
    ss.toast("Selecione ao menos uma linha da DB_TRANSACOES.", "GFP 16.1.12.2", 8);
    return { ok: false, error: "Nenhuma linha selecionada." };
  }

  const previews = rows.map(function(rowNumber) {
    return GFP_REPARO_META_BUILD_16_1_12_2_(sh, rowNumber);
  });

  const rowCsv = rows.join(",");
  const anyBlocked = previews.some(function(p) { return !p.ok; });

  const rowsHtml = previews.map(function(p) {
    const statusClass = p.ok ? "ok" : "warn";
    return `
      <tr>
        <td class="row">${GFP_REPARO_META_ESCAPE_16_1_12_2_(p.row)}</td>
        <td><span class="badge ${statusClass}">${GFP_REPARO_META_ESCAPE_16_1_12_2_(p.ok ? "PRONTO" : "ALERTA")}</span></td>
        <td>${GFP_REPARO_META_ESCAPE_16_1_12_2_(p.description || "")}</td>
        <td>${GFP_REPARO_META_ESCAPE_16_1_12_2_(p.account || "")}</td>
        <td>${GFP_REPARO_META_ESCAPE_16_1_12_2_(p.expectedType || "")}</td>
        <td>${GFP_REPARO_META_ESCAPE_16_1_12_2_(p.oldFileName || "")}<br><small>${GFP_REPARO_META_ESCAPE_16_1_12_2_(p.oldOrigin || "")}</small></td>
        <td>${GFP_REPARO_META_ESCAPE_16_1_12_2_(p.newFileName || "")}<br><small>${GFP_REPARO_META_ESCAPE_16_1_12_2_(p.newOrigin || "")}</small></td>
        <td>${GFP_REPARO_META_ESCAPE_16_1_12_2_(p.message || "")}</td>
      </tr>
    `;
  }).join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { margin:0; font-family:Arial,sans-serif; background:#f8fafc; color:#0f172a; }
          .header { background:#0b2d4d; color:#fff; padding:18px 22px; }
          .header h1 { margin:0; font-size:18px; font-weight:700; }
          .header p { margin:6px 0 0; font-size:12px; opacity:.86; }
          .content { padding:18px 22px 22px; }
          .summary { background:#eef6ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px 14px; margin-bottom:16px; font-size:13px; }
          .summary strong { color:#0b2d4d; }
          table { width:100%; border-collapse:collapse; background:#fff; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; font-size:12px; }
          th { background:#e5e7eb; text-align:left; padding:9px; color:#111827; border-bottom:1px solid #cbd5e1; }
          td { padding:9px; border-bottom:1px solid #e5e7eb; vertical-align:top; }
          .row { font-weight:700; color:#0b2d4d; white-space:nowrap; }
          .badge { display:inline-block; padding:3px 7px; border-radius:999px; font-weight:700; font-size:10px; white-space:nowrap; }
          .badge.ok { background:#dcfce7; color:#166534; }
          .badge.warn { background:#fee2e2; color:#991b1b; }
          small { color:#64748b; }
          .note { margin-top:12px; font-size:11px; color:#475569; line-height:1.45; }
          .footer { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
          button { border:0; font-weight:700; border-radius:8px; padding:10px 16px; cursor:pointer; }
          .btn-primary { background:#0b2d4d; color:#fff; }
          .btn-secondary { background:#e0f2fe; color:#0b2d4d; }
          .btn-danger { background:#fee2e2; color:#991b1b; cursor:not-allowed; }
          #result { display:none; margin-top:14px; padding:12px 14px; border-radius:10px; font-size:13px; }
          #result.ok { display:block; background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; }
          #result.warn { display:block; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>GFP — Reparo assistido de metadados</h1>
          <p>Corrige somente a coluna METADADOS das linhas selecionadas. Não move, não ordena e não recalibra.</p>
        </div>

        <div class="content">
          <div class="summary">
            Linhas selecionadas: <strong>${GFP_REPARO_META_ESCAPE_16_1_12_2_(rowCsv)}</strong><br>
            Total: <strong>${rows.length}</strong><br>
            Status: <strong>${anyBlocked ? "há alerta — revise antes" : "pronto para aplicar"}</strong>
          </div>

          <table>
            <thead>
              <tr>
                <th>Linha</th>
                <th>Status</th>
                <th>Descrição</th>
                <th>Conta</th>
                <th>Tipo esperado</th>
                <th>Metadado atual</th>
                <th>Metadado novo</th>
                <th>Mensagem</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div id="result"></div>

          <div class="note">
            O reparo usa o ID_ARQUIVO da própria linha como âncora e procura uma linha modelo coerente na DB_TRANSACOES/DB_TRANSACOES_HIST.
            Os metadados antigos ficam resumidos dentro de <strong>metadataRepair.previous</strong>.
          </div>

          <div class="footer">
            <button class="btn-secondary" onclick="google.script.host.close()">Cancelar</button>
            ${
              anyBlocked
                ? `<button class="btn-danger" disabled>Aplicar bloqueado</button>`
                : `<button id="applyBtn" class="btn-primary" onclick="applyRepair()">Aplicar reparo</button>`
            }
          </div>
        </div>

        <script>
          function applyRepair() {
            var btn = document.getElementById('applyBtn');
            var result = document.getElementById('result');

            if (btn) {
              btn.disabled = true;
              btn.textContent = 'Aplicando...';
            }

            google.script.run
              .withSuccessHandler(function(res) {
                result.className = res && res.ok ? 'ok' : 'warn';
                result.innerHTML = res && res.ok
                  ? '<strong>Reparo aplicado.</strong><br>' + (res.repaired || 0) + ' linha(s) corrigida(s). Rode a auditoria novamente.'
                  : '<strong>Reparo não concluído.</strong><br>' + ((res && res.error) || 'Erro não informado.');

                if (btn) btn.textContent = 'Aplicado';
              })
              .withFailureHandler(function(err) {
                result.className = 'warn';
                result.innerHTML = '<strong>Erro ao aplicar.</strong><br>' + (err && err.message ? err.message : err);

                if (btn) {
                  btn.disabled = false;
                  btn.textContent = 'Aplicar reparo';
                }
              })
              .GFP_REPARAR_METADADOS_DESALINHADOS_APPLY_16_1_12_2('${GFP_REPARO_META_ESCAPE_JS_16_1_12_2_(rowCsv)}');
          }
        </script>
      </body>
    </html>
  `;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(1280).setHeight(650),
    "GFP — Reparo assistido de metadados"
  );

  return { ok: !anyBlocked, rows: rows, previews: previews };
}


function GFP_REPARAR_METADADOS_DESALINHADOS_APPLY_16_1_12_2(rowCsv) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");

  if (!sh) return { ok: false, error: "DB_TRANSACOES não encontrada." };

  const rows = String(rowCsv || "")
    .split(",")
    .map(function(v) { return Number(String(v).trim()); })
    .filter(function(v, i, arr) { return v >= 2 && arr.indexOf(v) === i; });

  if (!rows.length) return { ok: false, error: "Nenhuma linha válida recebida." };

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) return { ok: false, error: "Não foi possível obter lock. Tente novamente." };

  const out = { ok: true, patch: "16.1.12.2", requested: rows.length, repaired: 0, skipped: 0, errors: [] };

  try {
    rows.forEach(function(rowNumber) {
      try {
        const built = GFP_REPARO_META_BUILD_16_1_12_2_(sh, rowNumber);

        if (!built.ok || !built.newMeta) {
          out.skipped++;
          out.errors.push({ row: rowNumber, error: built.message || "Não foi possível construir metadados novos." });
          return;
        }

        sh.getRange(rowNumber, 14).setValue(JSON.stringify(built.newMeta));
        sh.getRange(rowNumber, 14).setNote(
          "GFP 16.1.12.2 — metadados reparados em " +
          Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss")
        );

        out.repaired++;
      } catch (eRow) {
        out.skipped++;
        out.errors.push({ row: rowNumber, error: eRow.message });
      }
    });

    if (out.errors.length) out.ok = false;
  } finally {
    try { lock.releaseLock(); } catch (eLock) {}
  }

  try {
    ss.toast("Reparo de metadados: " + out.repaired + " linha(s) corrigida(s).", "GFP 16.1.12.2", 8);
  } catch (eToast) {}

  return out;
}


function GFP_REPARO_META_GET_SELECTED_ROWS_16_1_12_2_(sh) {
  const rangeList = sh.getActiveRangeList();
  const rows = [];

  if (rangeList) {
    rangeList.getRanges().forEach(function(r) {
      for (let row = r.getRow(); row < r.getRow() + r.getNumRows(); row++) {
        if (row >= 2 && rows.indexOf(row) === -1) rows.push(row);
      }
    });
  } else {
    const r = sh.getActiveRange();
    if (r) {
      for (let row = r.getRow(); row < r.getRow() + r.getNumRows(); row++) {
        if (row >= 2 && rows.indexOf(row) === -1) rows.push(row);
      }
    }
  }

  return rows.sort(function(a, b) { return a - b; });
}


function GFP_REPARO_META_BUILD_16_1_12_2_(sh, rowNumber) {
  const row = sh.getRange(rowNumber, 1, 1, 19).getValues()[0];

  const data = row[0];
  const descricao = String(row[1] || "").trim();
  const valor = row[2];
  const tipo = String(row[3] || "").trim();
  const conta = String(row[4] || "").trim();
  const categoria = String(row[5] || "").trim();
  const status = String(row[8] || "").trim();
  const idTransacao = String(row[10] || "").trim();
  const idArquivo = String(row[11] || "").trim();
  const hashLinha = String(row[12] || "").trim();
  const oldMetaRaw = String(row[13] || "").trim();

  const oldMeta = GFP_REPARO_META_PARSE_JSON_16_1_12_2_(oldMetaRaw);
  const expectedType = GFP_REPARO_META_EXPECTED_TYPE_16_1_12_2_(conta);
  const template = GFP_REPARO_META_FIND_TEMPLATE_16_1_12_2_(idArquivo, expectedType, rowNumber);

  if (!expectedType) {
    return {
      ok: false,
      row: rowNumber,
      description: descricao,
      account: conta,
      expectedType: "",
      oldFileName: GFP_REPARO_META_FILENAME_16_1_12_2_(oldMeta),
      oldOrigin: oldMeta.origin || "",
      newFileName: "",
      newOrigin: "",
      message: "Não foi possível inferir se a linha é de conta ou cartão."
    };
  }

  if (!template) {
    return {
      ok: false,
      row: rowNumber,
      description: descricao,
      account: conta,
      expectedType: expectedType,
      oldFileName: GFP_REPARO_META_FILENAME_16_1_12_2_(oldMeta),
      oldOrigin: oldMeta.origin || "",
      newFileName: "",
      newOrigin: "",
      message: "Não encontrei linha modelo coerente com o mesmo ID_ARQUIVO."
    };
  }

  const newMeta = GFP_REPARO_META_MAKE_NEW_16_1_12_2_({
    rowNumber: rowNumber,
    visible: {
      data: data,
      descricao: descricao,
      valor: valor,
      tipo: tipo,
      conta: conta,
      categoria: categoria,
      status: status,
      idTransacao: idTransacao,
      idArquivo: idArquivo,
      hashLinha: hashLinha
    },
    expectedType: expectedType,
    oldMeta: oldMeta,
    templateMeta: template.meta
  });

  return {
    ok: true,
    row: rowNumber,
    description: descricao,
    account: conta,
    expectedType: expectedType,
    oldFileName: GFP_REPARO_META_FILENAME_16_1_12_2_(oldMeta),
    oldOrigin: oldMeta.origin || "",
    newFileName: GFP_REPARO_META_FILENAME_16_1_12_2_(newMeta),
    newOrigin: newMeta.origin || "",
    message: "Metadados serão reconstruídos preservando origem coerente e rastro do anterior.",
    newMeta: newMeta
  };
}


function GFP_REPARO_META_EXPECTED_TYPE_16_1_12_2_(conta) {
  const c = String(conta || "").toUpperCase();

  if (c.indexOf("CARTÃO") >= 0 || c.indexOf("CARTAO") >= 0) return "FATURA_CARTAO";
  if (c.indexOf("PICPAY") >= 0) return "EXTRATO_CONTA";

  return "";
}


function GFP_REPARO_META_FIND_TEMPLATE_16_1_12_2_(idArquivo, expectedType, currentRow) {
  if (!idArquivo || !expectedType) return null;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ["DB_TRANSACOES", "DB_TRANSACOES_HIST"];

  for (let s = 0; s < sheets.length; s++) {
    const sh = ss.getSheetByName(sheets[s]);
    if (!sh) continue;

    const lastRow = sh.getLastRow();
    if (lastRow < 2) continue;

    const width = Math.min(Math.max(sh.getLastColumn(), 14), 20);
    const values = sh.getRange(2, 1, lastRow - 1, width).getValues();

    for (let i = 0; i < values.length; i++) {
      const rowNumber = i + 2;
      if (sheets[s] === "DB_TRANSACOES" && rowNumber === currentRow) continue;

      const row = values[i];
      const rowFileId = String(row[11] || "").trim();
      const meta = GFP_REPARO_META_PARSE_JSON_16_1_12_2_(String(row[13] || "").trim());
      const metaFileId = String(meta.fileId || "").trim();

      if (rowFileId !== idArquivo && metaFileId !== idArquivo) continue;

      if (GFP_REPARO_META_MATCHES_TYPE_16_1_12_2_(meta, expectedType)) {
        return { sheet: sheets[s], row: rowNumber, meta: meta };
      }
    }
  }

  return null;
}


function GFP_REPARO_META_MATCHES_TYPE_16_1_12_2_(meta, expectedType) {
  if (!meta || typeof meta !== "object") return false;

  const fileName = String(meta.fileName || meta.invoiceFileName || "").toUpperCase();
  const origin = String(meta.origin || "").toUpperCase();
  const fonte = String(meta.fonte || "").toUpperCase();
  const tipoFonte = String(meta.tipoFonte || "").toUpperCase();
  const bankName = String(meta.bankName || meta.invoiceBankName || "").toUpperCase();

  if (expectedType === "FATURA_CARTAO") {
    return (
      fileName.indexOf("FATURA") >= 0 ||
      origin.indexOf("REGEX_PICPAY") >= 0 ||
      fonte.indexOf("FATURA_CARTAO") >= 0 ||
      tipoFonte.indexOf("CARTAO_CREDITO") >= 0
    );
  }

  if (expectedType === "EXTRATO_CONTA") {
    return (
      fileName.indexOf(".CSV") >= 0 ||
      origin.indexOf("CSV_IMPORT") >= 0 ||
      bankName.indexOf("PICPAY_CONTA") >= 0 ||
      fonte.indexOf("EXTRATO") >= 0 ||
      tipoFonte.indexOf("CONTA") >= 0
    );
  }

  return false;
}


function GFP_REPARO_META_MAKE_NEW_16_1_12_2_(ctx) {
  const oldMeta = ctx.oldMeta || {};
  const template = ctx.templateMeta || {};
  const visible = ctx.visible || {};
  const expectedType = ctx.expectedType || "";

  const newMeta = {};

  const copyKeys = [
    "banco", "fonte", "tipoFonte", "bankName", "fileId", "fileName", "origin",
    "cashMonth", "competencia_fatura", "invoiceDueDate", "invoiceClosingDate",
    "invoiceReference", "invoiceDateSource", "dreDatePolicy", "invoiceFileName",
    "invoiceBankName", "invoiceParserVersion"
  ];

  copyKeys.forEach(function(k) {
    if (template[k] !== undefined && template[k] !== null && template[k] !== "") newMeta[k] = template[k];
  });

  // A âncora principal é sempre a própria linha.
  newMeta.fileId = visible.idArquivo || newMeta.fileId || "";

  if (expectedType === "EXTRATO_CONTA") {
    newMeta.bankName = newMeta.bankName || "PICPAY_CONTA";
    newMeta.origin = newMeta.origin || template.origin || "CSV_IMPORT_RECONSTRUIDO";
    newMeta.fileName = newMeta.fileName || template.fileName || "";
    newMeta.fonte = "EXTRATO_CONTA";
    newMeta.tipoFonte = "conta_corrente";
  }

  if (expectedType === "FATURA_CARTAO") {
    newMeta.fonte = "FATURA_CARTAO";
    newMeta.tipoFonte = "cartao_credito";
    newMeta.origin = newMeta.origin || template.origin || "FATURA_RECONSTRUIDA";
    newMeta.fileName = newMeta.fileName || template.fileName || template.invoiceFileName || "";
    newMeta.invoiceFileName = newMeta.invoiceFileName || template.invoiceFileName || template.fileName || "";
  }

  newMeta.visibleRowSnapshot = {
    data: GFP_REPARO_META_DATE_ISO_16_1_12_2_(visible.data),
    descricao: visible.descricao || "",
    valor: visible.valor,
    tipo: visible.tipo || "",
    conta: visible.conta || "",
    categoria: visible.categoria || "",
    status: visible.status || "",
    idTransacao: visible.idTransacao || "",
    hashLinha: visible.hashLinha || ""
  };

  newMeta.classificationParams = {
    source: "METADATA_REPAIR_KEEP_VISIBLE_CLASSIFICATION",
    status: visible.status || "",
    suggestedCategory: visible.categoria || "",
    categoryWritten: !!visible.categoria,
    confidence: 0,
    reason: "Metadados reconstruídos por desalinhamento A:S. Categoria/status visíveis foram preservados.",
    repairedAt: new Date().toISOString(),
    patch: "16.1.12.2"
  };

  newMeta.metadataRepair = {
    version: "16.1.12.2",
    repairedAt: new Date().toISOString(),
    source: "GFP_REPARAR_METADADOS_DESALINHADOS_APPLY_16_1_12_2",
    expectedType: expectedType,
    row: ctx.rowNumber,
    templateUsed: {
      fileName: GFP_REPARO_META_FILENAME_16_1_12_2_(template),
      origin: template.origin || "",
      bankName: template.bankName || template.invoiceBankName || "",
      cashMonth: template.cashMonth || template.competencia_fatura || ""
    },
    previous: {
      fileName: GFP_REPARO_META_FILENAME_16_1_12_2_(oldMeta),
      origin: oldMeta.origin || "",
      banco: oldMeta.banco || "",
      bankName: oldMeta.bankName || oldMeta.invoiceBankName || "",
      fonte: oldMeta.fonte || "",
      tipoFonte: oldMeta.tipoFonte || "",
      cashMonth: oldMeta.cashMonth || oldMeta.competencia_fatura || "",
      classificationSource: oldMeta.classificationParams && oldMeta.classificationParams.source || "",
      classificationSuggestedCategory: oldMeta.classificationParams && oldMeta.classificationParams.suggestedCategory || ""
    }
  };

  return newMeta;
}


function GFP_REPARO_META_PARSE_JSON_16_1_12_2_(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(String(raw)); } catch (e) { return {}; }
}


function GFP_REPARO_META_FILENAME_16_1_12_2_(meta) {
  if (!meta || typeof meta !== "object") return "";
  return String(meta.fileName || meta.invoiceFileName || "");
}


function GFP_REPARO_META_DATE_ISO_16_1_12_2_(value) {
  try {
    if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
      return Utilities.formatDate(value, Session.getScriptTimeZone() || "America/Sao_Paulo", "yyyy-MM-dd");
    }
  } catch (e) {}

  return String(value || "");
}


function GFP_REPARO_META_ESCAPE_16_1_12_2_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function GFP_REPARO_META_ESCAPE_JS_16_1_12_2_(value) {
  return String(value == null ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

/**
 * =============================================================================
 * GFP 16.1.13 — CATEGORIAS LEGADAS + ORDENAÇÃO A:S DEFENSIVA
 * =============================================================================
 */

const GFP_PATCH_16_1_13 = "16.1.13";

function GFP_CATEGORIAS_MIGRATION_MAP_16_1_13_() {
  return {
    "01.05 — Receitas — Maria Brasileira — Reembolsos":
      "99.12 — Transitórias — Reembolsos — FERMONT",

    "02.17 — Despesas — Maria Brasileira — Maria Brasileira":
      "99.10 — Transitórias — Despesas Reembolsáveis — FERMONT",

    "02.02 — Despesas — Alimentação — Restaurante / Lanchonete / Café":
      "02.02 — Despesas — Alimentação — Lanchonete / Café / Refeições",

    "02.05 — Despesas — Lazer — Restaurantes / Bar / Balada":
      "02.05 — Despesas — Lazer — Bar / Balada / Festas",

    "02.05 — Despesas — Lazer — Confraternizações / Festas":
      "02.05 — Despesas — Lazer — Restaurantes / Confraternizações",

    "02.07 — Despesas — Educação — Cursos / Livros":
      "02.07 — Despesas — Educação — Cursos / Livros / Papelaria"
  };
}

/**
 * Simula ou aplica a migração de categorias legadas.
 *
 * dryRun=true  -> só informa o que seria alterado.
 * dryRun=false -> aplica.
 */
function GFP_MIGRAR_CATEGORIAS_LEGADAS_16_1_13(dryRun) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const map = GFP_CATEGORIAS_MIGRATION_MAP_16_1_13_();

  const out = {
    ok: true,
    patch: GFP_PATCH_16_1_13,
    dryRun: dryRun !== false,
    sheets: {},
    totalCellsChanged: 0,
    totalRowsTouched: 0,
    errors: []
  };

  ["DB_TRANSACOES", "DB_TRANSACOES_HIST"].forEach(function(sheetName) {
    try {
      const sh = ss.getSheetByName(sheetName);

      if (!sh) {
        out.sheets[sheetName] = { skipped: true, reason: "aba não encontrada" };
        return;
      }

      const result = GFP_MIGRAR_CATEGORIAS_LEGADAS_SHEET_16_1_13_(sh, map, out.dryRun);

      out.sheets[sheetName] = result;
      out.totalCellsChanged += result.cellsChanged || 0;
      out.totalRowsTouched += result.rowsTouched || 0;

    } catch (e) {
      out.ok = false;
      out.errors.push({ sheet: sheetName, error: e.message });
    }
  });

  GFP_LOG_16_1_13_(
    out.dryRun ? "Simulação de migração de categorias concluída." : "Migração de categorias aplicada.",
    "Categorias",
    out.ok ? "OK" : "WARN",
    "Células alteradas: " + out.totalCellsChanged + " | Linhas tocadas: " + out.totalRowsTouched
  );

  SpreadsheetApp.getActiveSpreadsheet().toast(
    (out.dryRun ? "Simulação" : "Migração") +
      " concluída: " +
      out.totalCellsChanged +
      " célula(s), " +
      out.totalRowsTouched +
      " linha(s).",
    "GFP 16.1.13",
    8
  );

  return out;
}

function GFP_MIGRAR_CATEGORIAS_LEGADAS_SHEET_16_1_13_(sh, map, dryRun) {
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  const result = {
    sheet: sh.getName(),
    rows: Math.max(0, lastRow - 1),
    cols: lastCol,
    cellsChanged: 0,
    rowsTouched: 0,
    examples: []
  };

  if (lastRow < 2 || lastCol < 1) return result;

  const maxCol = Math.min(
    Math.max(lastCol, 19),
    sh.getName() === "DB_TRANSACOES_HIST" ? 20 : 19
  );

  const range = sh.getRange(2, 1, lastRow - 1, maxCol);
  const values = range.getValues();
  const rowsTouched = {};

  for (let r = 0; r < values.length; r++) {
    for (let c = 0; c < values[r].length; c++) {
      const original = values[r][c];
      if (original === null || original === undefined || original === "") continue;

      let current = String(original);
      let changed = current;

      Object.keys(map).forEach(function(oldCat) {
        const newCat = map[oldCat];
        if (changed.indexOf(oldCat) >= 0) {
          changed = changed.split(oldCat).join(newCat);
        }
      });

      if (changed !== current) {
        values[r][c] = changed;
        result.cellsChanged++;
        rowsTouched[r + 2] = true;

        if (result.examples.length < 12) {
          result.examples.push({
            row: r + 2,
            col: c + 1,
            from: current.substring(0, 180),
            to: changed.substring(0, 180)
          });
        }
      }
    }
  }

  result.rowsTouched = Object.keys(rowsTouched).length;

  if (!dryRun && result.cellsChanged > 0) {
    range.setValues(values);
  }

  return result;
}

/**
 * Audita categorias fora da CFG_Categorias.
 * Não altera dados.
 */
function GFP_AUDITAR_CATEGORIAS_INVALIDAS_16_1_13() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const valid = GFP_CATEGORIAS_OFICIAIS_SET_16_1_13_();

  const out = {
    ok: true,
    patch: GFP_PATCH_16_1_13,
    sheets: {},
    totalInvalid: 0,
    invalids: []
  };

  ["DB_TRANSACOES", "DB_TRANSACOES_HIST"].forEach(function(sheetName) {
    const sh = ss.getSheetByName(sheetName);

    if (!sh) {
      out.sheets[sheetName] = { skipped: true };
      return;
    }

    const lastRow = sh.getLastRow();

    if (lastRow < 2) {
      out.sheets[sheetName] = { scanned: 0, invalid: 0 };
      return;
    }

    const vals = sh.getRange(2, 6, lastRow - 1, 1).getValues();
    const invalid = [];

    vals.forEach(function(row, idx) {
      const cat = String(row[0] || "").trim();
      if (!cat) return;
      if (valid[cat]) return;

      invalid.push({
        sheet: sheetName,
        row: idx + 2,
        category: cat
      });
    });

    out.sheets[sheetName] = {
      scanned: vals.length,
      invalid: invalid.length
    };

    out.totalInvalid += invalid.length;
    out.invalids = out.invalids.concat(invalid.slice(0, 100));
  });

  SpreadsheetApp.getActiveSpreadsheet().toast(
    out.totalInvalid
      ? "Categorias inválidas encontradas: " + out.totalInvalid + ". Veja retorno/log."
      : "Categorias OK: nenhuma categoria inválida encontrada.",
    "GFP 16.1.13",
    8
  );

  GFP_LOG_16_1_13_(
    out.totalInvalid
      ? "Categorias inválidas encontradas."
      : "Auditoria de categorias concluída sem inválidas.",
    "Categorias",
    out.totalInvalid ? "WARN" : "OK",
    "Total inválidas: " + out.totalInvalid
  );

  return out;
}

function GFP_CATEGORIAS_OFICIAIS_SET_16_1_13_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("CFG_Categorias");
  if (!sh) throw new Error("CFG_Categorias não encontrada.");

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return {};

  const values = sh.getRange(2, 6, lastRow - 1, 1).getValues();
  const set = {};

  values.forEach(function(row) {
    const cat = String(row[0] || "").trim();
    if (cat) set[cat] = true;
  });

  return set;
}

/**
 * Ordenação defensiva da DB_TRANSACOES.
 *
 * Remove temporariamente a validação da coluna F para impedir que categoria
 * inválida derrube a ordenação; depois reaplica a validação.
 */
function GFP_SORT_DB_TRANSACOES_DEFENSIVO_16_1_13() {
  return GFP_REORGANIZAR_MESA_DB_TRANSACOES_16_1_18_3();
}



function GFP_CATEGORIA_VALIDATION_RULE_16_1_13_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const catSheet = ss.getSheetByName("CFG_Categorias");
  if (!catSheet) return null;

  return SpreadsheetApp.newDataValidation()
    .requireValueInRange(catSheet.getRange("F2:F"))
    .setAllowInvalid(false)
    .setHelpText("Por favor, selecione uma categoria válida da lista.")
    .build();
}

function GFP_NORMALIZAR_CATEGORIA_STRING_16_1_13_(value) {
  const map = GFP_CATEGORIAS_MIGRATION_MAP_16_1_13_();
  let out = String(value == null ? "" : value);

  Object.keys(map).forEach(function(oldCat) {
    out = out.split(oldCat).join(map[oldCat]);
  });

  return out;
}

function GFP_LOG_16_1_13_(message, area, type, obs) {
  try {
    if (typeof Logger === "function") {
      Logger.log(message, area || "GFP", null, type || "INFO");
      return;
    }
  } catch (e) {}

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName("SYS_LOGS");
    if (!sh) return;

    sh.insertRowBefore(2);
    sh.getRange(2, 1, 1, 5).setValues([[
      Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss"),
      type || "INFO",
      area || "GFP",
      message || "",
      obs || ""
    ]]);
  } catch (e2) {}
}

function GFP_APLICAR_MIGRACAO_CATEGORIAS_LEGADAS_16_1_13() {
  return GFP_MIGRAR_CATEGORIAS_LEGADAS_16_1_13(false);
}

/**
 * =============================================================================
 * GFP 16.1.18 — AUXILIARES DE PERSISTÊNCIA VERIFICADA
 * =============================================================================
 */


function GFP_DATALAKE_VERIFY_INSERT_BLOCK_16_1_18_(sheet, startRow, expectedRows) {
  const numRows = expectedRows.length;
  const actual = sheet.getRange(startRow, 1, numRows, 14).getValues();

  const missing = [];
  const mismatches = [];

  for (let i = 0; i < expectedRows.length; i++) {
    const expectedId = String(expectedRows[i][10] || "").trim();
    const expectedHash = String(expectedRows[i][12] || "").trim();

    const actualId = String(actual[i][10] || "").trim();
    const actualHash = String(actual[i][12] || "").trim();

    const visibleAny = actual[i].some(function(v) {
      return v !== "" && v !== null && v !== undefined;
    });

    if (!visibleAny) {
      missing.push({
        row: startRow + i,
        expectedId: expectedId
      });
      continue;
    }

    if (expectedId !== actualId || expectedHash !== actualHash) {
      mismatches.push({
        row: startRow + i,
        expectedId: expectedId,
        actualId: actualId,
        expectedHash: expectedHash,
        actualHash: actualHash
      });
    }
  }

  return {
    ok: missing.length === 0 && mismatches.length === 0,
    checked: numRows,
    missing: missing,
    mismatches: mismatches
  };
}


function GFP_DATALAKE_VERIFY_IDS_EXIST_ANYWHERE_16_1_18_(sheet, expectedRows) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      ok: false,
      reason: "DB_TRANSACOES vazia após gravação.",
      missingIds: expectedRows.map(function(r) { return r[10]; }).slice(0, 20)
    };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 14).getValues();

  const foundIds = {};
  const foundHashes = {};

  values.forEach(function(row) {
    const id = String(row[10] || "").trim();
    const hash = String(row[12] || "").trim();

    if (id) foundIds[id] = true;
    if (hash) foundHashes[hash] = true;
  });

  const missing = [];

  expectedRows.forEach(function(row) {
    const id = String(row[10] || "").trim();
    const hash = String(row[12] || "").trim();

    if (!foundIds[id] || !foundHashes[hash]) {
      missing.push({
        id: id,
        hash: hash,
        foundId: !!foundIds[id],
        foundHash: !!foundHashes[hash]
      });
    }
  });

  return {
    ok: missing.length === 0,
    checked: expectedRows.length,
    missing: missing.slice(0, 30),
    missingCount: missing.length
  };
}


function GFP_DATALAKE_ROLLBACK_APPEND_BLOCK_16_1_18_(sheet, startRow, numRows, beforeMaxRows) {
  const out = {
    ok: true,
    cleared: false,
    deletedExtraRows: 0,
    startRow: startRow,
    numRows: numRows,
    beforeMaxRows: beforeMaxRows,
    afterMaxRows: sheet.getMaxRows()
  };

  // Limpa qualquer conteúdo/validação/nota/borda gerada no bloco esperado.
  try {
    const safeRows = Math.min(numRows, Math.max(0, sheet.getMaxRows() - startRow + 1));
    if (safeRows > 0) {
      sheet.getRange(startRow, 1, safeRows, Math.min(19, sheet.getMaxColumns()))
        .clearContent()
        .clearDataValidations()
        .clearNote()
        .setBackground(null);
      out.cleared = true;
    }
  } catch (eClear) {
    out.clearError = eClear.message;
    out.ok = false;
  }

  // Se a tentativa de gravação expandiu fisicamente a planilha, remove apenas o excedente.
  try {
    const currentMax = sheet.getMaxRows();

    if (currentMax > beforeMaxRows) {
      sheet.deleteRows(beforeMaxRows + 1, currentMax - beforeMaxRows);
      out.deletedExtraRows = currentMax - beforeMaxRows;
    }
  } catch (eDelete) {
    out.deleteError = eDelete.message;
    out.ok = false;
  }

  return out;
}


function GFP_DATALAKE_ENSURE_WORK_AS_FALLBACK_16_1_18_(sheet) {
  const requiredCols = 19;

  if (sheet.getMaxColumns() < requiredCols) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredCols - sheet.getMaxColumns());
  }

  const headers = [
    "SYS_SORT_GRUPO",
    "SYS_SORT_CONFIANCA",
    "SYS_SORT_DATA",
    "SYS_SORT_STATUS",
    "SYS_SORT_AUDIT"
  ];

  sheet.getRange(1, 15, 1, 5).setValues([headers]);
}


function GFP_DATALAKE_SORT_AS_FALLBACK_16_1_18_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 3) {
    return {
      sorted: false,
      reason: "poucas linhas"
    };
  }

  sheet.getRange(2, 1, lastRow - 1, 19)
    .sort([
      { column: 5, ascending: true },
      { column: 1, ascending: false }
    ]);

  return {
    sorted: true,
    mode: "fallback_A:S_16_1_18",
    rows: lastRow - 1
  };
}
