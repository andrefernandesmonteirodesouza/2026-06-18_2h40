/**
 * ✅ FUNÇÃO PRINCIPAL — execute esta uma vez.
 *
 * Aplica checkboxes nas pendências categorizadas e instala trigger onEdit.
 */
function GFP_INSTALL_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1() {
  const applied = GFP_APLICAR_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1();
  const trigger = GFP_INSTALAR_TRIGGER_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Checkbox de pendências categorizadas instalado. Aplicados: ${applied.applied}`,
    "GFP 14.3.1"
  );

  Logger.log(`[GFP_INSTALL_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1] ${JSON.stringify({ applied, trigger })}`);

  return { applied, trigger };
}


/**
 * Aplica checkbox customizado nas pendências que já têm categoria válida.
 *
 * Valor marcado   = OK
 * Valor desmarcado = PENDENTE_CATEGORIZADA
 *
 * Assim a célula aparece como checkbox, mas a linha continua pendente até André aprovar.
 */
function GFP_APLICAR_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");
  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { scanned: 0, applied: 0, skipped: 0 };

  const values = sh.getRange(2, 1, lastRow - 1, 14).getValues();

  let applied = 0;
  let skipped = 0;

  values.forEach((row, idx) => {
    const sheetRow = idx + 2;

    const tipo = String(row[3] || "").trim().toUpperCase();       // D
    const categoria = String(row[5] || "").trim();                // F
    const status = String(row[8] || "").trim().toUpperCase();     // I

    if (!GFP_deveReceberCheckboxPendenciaCategorizada_14_3_1_(status, tipo, categoria)) {
      skipped++;
      return;
    }

    const cell = sh.getRange(sheetRow, 9); // STATUS

    const validation = SpreadsheetApp.newDataValidation()
      .requireCheckbox("OK", "PENDENTE_CATEGORIZADA")
      .setAllowInvalid(true)
      .build();

    cell.setDataValidation(validation);

    // Se estava vazio/FALSE/PENDENTE/REVISAR, padroniza como pendência categorizada.
    // Visualmente aparece apenas o checkbox desmarcado.
    cell.setValue("PENDENTE_CATEGORIZADA");

    applied++;
  });

  Logger.log(`[GFP_APLICAR_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1] scanned=${values.length} | applied=${applied} | skipped=${skipped}`);

  return {
    scanned: values.length,
    applied: applied,
    skipped: skipped
  };
}


/**
 * Instala trigger onEdit específico para aprovação de pendências categorizadas.
 */
function GFP_INSTALAR_TRIGGER_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const handler = "GFP_ON_EDIT_APROVAR_PENDENCIA_CATEGORIZADA_14_3_1";

  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(t => {
    if (t.getHandlerFunction && t.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger(handler)
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log(`[GFP_INSTALAR_TRIGGER_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1] Trigger instalado: ${handler}`);

  return {
    handler: handler,
    installed: true
  };
}


/**
 * Handler onEdit.
 *
 * Quando André marca o checkbox:
 *   oldValue = PENDENTE_CATEGORIZADA
 *   value    = OK
 */
function GFP_ON_EDIT_APROVAR_PENDENCIA_CATEGORIZADA_14_3_1(e) {
  try {
    if (!e || !e.range) return;

    const range = e.range;
    const sh = range.getSheet();

    if (!sh || sh.getName() !== "DB_TRANSACOES") return;
    if (range.getRow() < 2) return;
    if (range.getColumn() !== 9) return; // STATUS

    const newValue = String(e.value || range.getValue() || "").trim().toUpperCase();
    const oldValue = String(e.oldValue || "").trim().toUpperCase();

    if (newValue !== "OK") return;

    // Só este patch cuida de PENDENTE_CATEGORIZADA.
    // Sugestões GEMINI/MODELO continuam cuidadas pelo patch 14.2.1.
    if (oldValue !== "PENDENTE_CATEGORIZADA") return;

    const rowNumber = range.getRow();
    const row = sh.getRange(rowNumber, 1, 1, 14).getValues()[0];

    const descricao = String(row[1] || "").trim();
    const tipo = String(row[3] || "").trim().toUpperCase();
    const categoria = String(row[5] || "").trim();

    if (!GFP_isCategoriaValidaPendencia14_3_1_(categoria) || GFP_isCategoriaGenerica14_3_1_(categoria)) {
      range.setValue("PENDENTE_CATEGORIZADA");
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "Não é possível aprovar: categoria genérica ou inválida.",
        "GFP 14.3.1"
      );
      return;
    }

    if (tipo === "T" || tipo === "S") {
      range.setValue("PENDENTE_CATEGORIZADA");
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "Não é possível aprovar por este fluxo: linha de transferência/split.",
        "GFP 14.3.1"
      );
      return;
    }

    // Remove checkbox e consolida OK.
    range.clearDataValidations();
    range.setValue("OK");

    // Normaliza tipo usando a lógica oficial do servidor, se existir.
    try {
      if (typeof applyTypeLogic_ServerSide === "function") {
        applyTypeLogic_ServerSide(sh, rowNumber, categoria);
      }
    } catch (typeError) {
      Logger.warn("[GFP 14.3.1] Falha ao aplicar lógica de tipo: " + typeError.message);
    }

    // Registra metadados.
    GFP_marcarAprovacaoPendenciaCategorizadaMetadata_14_3_1_(sh, rowNumber);

    // Alimenta CFG_Aprendizado simples.
    GFP_appendCfgAprendizadoPendenciaCategorizada_14_3_1_(descricao, categoria);

    // Feedback 14.2, se houver metadados Gemini/Modelo.
    try {
      if (typeof GFP_MODELO_FEEDBACK_PROCESSAR_LINHA_APPLY_14_2 === "function") {
        GFP_MODELO_FEEDBACK_PROCESSAR_LINHA_APPLY_14_2(rowNumber);
      }
    } catch (feedbackError) {
      Logger.warn("[GFP 14.3.1] Falha ao processar feedback 14.2: " + feedbackError.message);
    }

    // Reordena DB_TRANSACOES, se sorter 14.3 estiver instalado.
    try {
      if (typeof GFP_SORT_MAYBE_AUTO_AFTER_APPROVAL_14_3 === "function") {
        GFP_SORT_MAYBE_AUTO_AFTER_APPROVAL_14_3();
      }
    } catch (sortError) {
      Logger.warn("[GFP 14.3.1] Falha ao ordenar após aprovação de pendência categorizada: " + sortError.message);
    }

    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Pendência categorizada aprovada: linha ${rowNumber}`,
      "GFP 14.3.1"
    );

    Logger.log(
      `[GFP_ON_EDIT_APROVAR_PENDENCIA_CATEGORIZADA_14_3_1] linha=${rowNumber} | categoria='${categoria}' | OK`
    );

  } catch (err) {
    Logger.warn("[GFP_ON_EDIT_APROVAR_PENDENCIA_CATEGORIZADA_14_3_1] " + err.message);
  }
}


/**
 * Registra aprovação no METADADOS.
 */
function GFP_marcarAprovacaoPendenciaCategorizadaMetadata_14_3_1_(sh, rowNumber) {
  const metaCell = sh.getRange(rowNumber, 14); // N
  const meta = GFP_parseJsonPendencia14_3_1_(metaCell.getValue());

  if (!meta.approvals) meta.approvals = {};

  meta.approvals.pendingCategoryCheckbox = {
    approvedAt: new Date().toISOString(),
    patch: "14.3.1",
    source: "CHECKBOX_PENDENCIA_CATEGORIZADA",
    finalStatus: "OK"
  };

  metaCell.setValue(JSON.stringify(meta));
}


/**
 * Alimenta CFG_Aprendizado com origem específica.
 */
function GFP_appendCfgAprendizadoPendenciaCategorizada_14_3_1_(descricao, categoria) {
  if (!descricao || !categoria) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("CFG_Aprendizado");

  if (!sh) return;

  sh.appendRow([
    new Date(),
    String(descricao || "").toUpperCase(),
    String(categoria || "").trim(),
    "VALIDACAO_CHECKBOX_CATEGORIZADA"
  ]);
}


/**
 * Remove checkboxes deste fluxo, sem mexer em OK.
 */
function GFP_REMOVER_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");
  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { scanned: 0, removed: 0 };

  const values = sh.getRange(2, 1, lastRow - 1, 14).getValues();

  let removed = 0;

  values.forEach((row, idx) => {
    const sheetRow = idx + 2;
    const status = String(row[8] || "").trim().toUpperCase();

    if (status !== "PENDENTE_CATEGORIZADA") return;

    const cell = sh.getRange(sheetRow, 9);
    cell.clearDataValidations();
    cell.clearContent();

    removed++;
  });

  Logger.log(`[GFP_REMOVER_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1] removed=${removed}`);

  return {
    scanned: values.length,
    removed: removed
  };
}


/**
 * Remove trigger deste patch.
 */
function GFP_REMOVER_TRIGGER_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1() {
  const handler = "GFP_ON_EDIT_APROVAR_PENDENCIA_CATEGORIZADA_14_3_1";
  const triggers = ScriptApp.getProjectTriggers();

  let removed = 0;

  triggers.forEach(t => {
    if (t.getHandlerFunction && t.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });

  Logger.log(`[GFP_REMOVER_TRIGGER_CHECKBOX_PENDENCIAS_CATEGORIZADAS_14_3_1] removed=${removed}`);

  return {
    handler: handler,
    removed: removed
  };
}


/**
 * Critério para aplicar checkbox em pendências categorizadas.
 */
function GFP_deveReceberCheckboxPendenciaCategorizada_14_3_1_(status, tipo, categoria) {
  const s = String(status || "").trim().toUpperCase();
  const t = String(tipo || "").trim().toUpperCase();
  const c = String(categoria || "").trim();

  if (t === "T" || t === "S") return false;

  if (!GFP_isCategoriaValidaPendencia14_3_1_(c)) return false;
  if (GFP_isCategoriaGenerica14_3_1_(c)) return false;

  // Já resolvidas.
  if (s === "OK" || s === "CONCILIADO" || s === "SPLIT" || s === "CONSOLIDADO" || s === "APROVADO") return false;

  // Sugestões Gemini/Modelo têm fluxo próprio no patch 14.2.1.
  if (s.indexOf("GEMINI_") === 0 || s.indexOf("MODELO_") === 0) return false;

  // Bloqueadas nunca recebem aprovação rápida.
  if (s === "BLOQUEADA") return false;

  // Status elegíveis.
  if (!s) return true;
  if (s === "FALSE") return true;
  if (s === "PENDENTE") return true;
  if (s === "REVISAR") return true;
  if (s === "PENDENTE_CATEGORIZADA") return true;
  if (s === "A REVISAR") return true;
  if (s === "EM REVISAO" || s === "EM REVISÃO") return true;

  return false;
}


function GFP_isCategoriaValidaPendencia14_3_1_(categoria) {
  return /^\d{2}\.\d{2}\s+—\s+/.test(String(categoria || "").trim());
}


function GFP_isCategoriaGenerica14_3_1_(categoria) {
  const txt = GFP_stripAccentsPendencia14_3_1_(String(categoria || ""))
    .toUpperCase()
    .trim();

  return txt.indexOf("A IDENTIFICAR") >= 0 ||
         txt.indexOf("NAO IDENTIFICADA") >= 0 ||
         txt.indexOf("NAO IDENTIFICADO") >= 0 ||
         txt.indexOf("A CLASSIFICAR") >= 0 ||
         txt.indexOf("NAO CLASSIFICADA") >= 0 ||
         txt.indexOf("NAO CLASSIFICADO") >= 0;
}


function GFP_parseJsonPendencia14_3_1_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}


function GFP_stripAccentsPendencia14_3_1_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
