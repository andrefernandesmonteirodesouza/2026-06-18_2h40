/**
 * ✅ FUNÇÃO PRINCIPAL — execute esta uma vez.
 *
 * Ela:
 * 1. aplica checkbox nas sugestões Gemini/Modelo aprováveis;
 * 2. instala trigger onEdit específico para capturar aprovação.
 */
function GFP_INSTALL_APROVACAO_CHECKBOX_GEMINI_14_2_1() {
  const applied = GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1();
  const trigger = GFP_INSTALAR_TRIGGER_APROVACAO_GEMINI_14_2_1();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Aprovação por checkbox instalada. Checkboxes aplicados: ${applied.applied}`,
    "GFP 14.2.1"
  );

  Logger.log(`[GFP_INSTALL_APROVACAO_CHECKBOX_GEMINI_14_2_1] ${JSON.stringify({ applied, trigger })}`);

  return { applied, trigger };
}


/**
 * Aplica checkbox customizado nas linhas GEMINI_/MODELO_ que podem ser aprovadas.
 *
 * A célula fica assim:
 * - se desmarcada, o valor interno continua GEMINI_MEDIO etc.
 * - se marcada, o valor vira OK.
 */
function GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1() {
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

    const categoria = String(row[5] || "").trim(); // F
    const status = String(row[8] || "").trim().toUpperCase(); // I
    const tipo = String(row[3] || "").trim().toUpperCase(); // D

    if (!GFP_statusAprovavelPorCheckbox_14_2_1_(status)) {
      skipped++;
      return;
    }

    if (tipo === "T" || tipo === "S") {
      skipped++;
      return;
    }

    // Não permitir aprovação automática por checkbox se não houver categoria.
    // Ex.: GEMINI_BAIXO geralmente vem sem categoria.
    if (!GFP_isCategoriaValida_14_2_1_(categoria)) {
      skipped++;
      return;
    }

    const cell = sh.getRange(sheetRow, 9); // I

    const validation = SpreadsheetApp.newDataValidation()
      .requireCheckbox("OK", status)
      .setAllowInvalid(true)
      .build();

    cell.setDataValidation(validation);

    // Garante que o valor desmarcado continue sendo o próprio status.
    // Isso preserva as cores por regra condicional.
    cell.setValue(status);

    applied++;
  });

  Logger.log(`[GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1] scanned=${values.length} | applied=${applied} | skipped=${skipped}`);

  return {
    scanned: values.length,
    applied: applied,
    skipped: skipped
  };
}


/**
 * Instala trigger onEdit específico.
 *
 * Usamos trigger instalável para não depender de editar/substituir o onEdit antigo.
 */
function GFP_INSTALAR_TRIGGER_APROVACAO_GEMINI_14_2_1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const handler = "GFP_ON_EDIT_APROVAR_SUGESTAO_CHECKBOX_14_2_1";

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

  Logger.log(`[GFP_INSTALAR_TRIGGER_APROVACAO_GEMINI_14_2_1] Trigger instalado: ${handler}`);

  return {
    handler: handler,
    installed: true
  };
}


/**
 * Handler onEdit instalável.
 *
 * Quando usuário marca checkbox customizado:
 *   oldValue = GEMINI_MEDIO / MODELO_FORTE / etc.
 *   value    = OK
 *
 * Aí:
 *   - remove validação;
 *   - mantém OK;
 *   - registra metadados;
 *   - registra CFG_Aprendizado;
 *   - processa feedback 14.2, se disponível.
 */
function GFP_ON_EDIT_APROVAR_SUGESTAO_CHECKBOX_14_2_1(e) {
  try {
    if (!e || !e.range) return;

    const range = e.range;
    const sh = range.getSheet();

    if (!sh || sh.getName() !== "DB_TRANSACOES") return;
    if (range.getRow() < 2) return;
    if (range.getColumn() !== 9) return; // STATUS

    const newValue = String(e.value || range.getValue() || "").trim().toUpperCase();
    const oldValue = String(e.oldValue || "").trim().toUpperCase();

    // Só interessa quando o checkbox customizado vira OK.
    if (newValue !== "OK") return;

    // Se oldValue não veio no evento, tentamos inferir pelo metadata.
    let previousStatus = oldValue;

    const rowNumber = range.getRow();
    const row = sh.getRange(rowNumber, 1, 1, 14).getValues()[0];

    if (!previousStatus) {
      const meta = GFP_parseJson_14_2_1_(row[13]);
      const cp = meta && meta.classificationParams ? meta.classificationParams : {};
      previousStatus = String(cp.status || "").trim().toUpperCase();
    }

    if (!GFP_statusAprovavelPorCheckbox_14_2_1_(previousStatus)) {
      // Se o usuário marcou um checkbox comum antigo, deixamos o onEdit antigo cuidar.
      return;
    }

    const descricao = String(row[1] || "").trim();
    const categoria = String(row[5] || "").trim();

    if (!GFP_isCategoriaValida_14_2_1_(categoria)) {
      range.setValue(previousStatus);
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "Não é possível aprovar: categoria vazia ou inválida.",
        "GFP 14.2.1"
      );
      return;
    }

    // Remove checkbox e consolida OK visualmente.
    range.clearDataValidations();
    range.setValue("OK");

    // Normaliza TIPO conforme a categoria aprovada.
    // Ex.: 99.02 — Pagamento de Fatura precisa virar T.
    try {
      if (typeof GFP_NORMALIZAR_TIPO_APROVACAO_14_3_2 === "function") {
        GFP_NORMALIZAR_TIPO_APROVACAO_14_3_2(sh, rowNumber, categoria);
      } else if (typeof applyTypeLogic_ServerSide === "function") {
        applyTypeLogic_ServerSide(sh, rowNumber, categoria);
      }
    } catch (typeError) {
      Logger.warn("[GFP 14.3.2] Falha ao normalizar TIPO após aprovação Gemini/Modelo: " + typeError.message);
    }

    // Atualiza metadados.
    GFP_marcarAprovacaoCheckboxMetadata_14_2_1_(sh, rowNumber, previousStatus);


    // Registra no aprendizado simples também.
    GFP_appendCfgAprendizadoCheckboxGemini_14_2_1_(descricao, categoria);

    // Processa feedback do modelo, se o patch 14.2 estiver instalado.
    try {
      if (typeof GFP_MODELO_FEEDBACK_PROCESSAR_LINHA_APPLY_14_2 === "function") {
        GFP_MODELO_FEEDBACK_PROCESSAR_LINHA_APPLY_14_2(rowNumber);
      }
    } catch (feedbackError) {
      Logger.warn("[GFP 14.2.1] Falha ao processar feedback 14.2: " + feedbackError.message);
    }

    // Compacta nota visual, se a função do hotfix 14.1.1 estiver instalada.
    try {
      if (typeof GFP_COMPACTAR_NOTAS_GEMINI_PARA_NOTAS_DE_CELULA_14_1_1 === "function") {
        GFP_COMPACTAR_NOTAS_GEMINI_PARA_NOTAS_DE_CELULA_14_1_1();
      }
    } catch (noteError) {
      Logger.warn("[GFP 14.2.1] Falha ao compactar notas: " + noteError.message);
    }

    try {
      if (typeof GFP_SORT_MAYBE_AUTO_AFTER_APPROVAL_14_3 === "function") {
        GFP_SORT_MAYBE_AUTO_AFTER_APPROVAL_14_3();
      }
    } catch (sortError) {
      Logger.warn("[GFP 14.3] Falha ao ordenar após aprovação por checkbox: " + sortError.message);
    }

    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Sugestão aprovada por checkbox: linha ${rowNumber}`,
      "GFP 14.2.1"
    );

    Logger.log(
      `[GFP_ON_EDIT_APROVAR_SUGESTAO_CHECKBOX_14_2_1] linha=${rowNumber} | ` +
      `status_anterior=${previousStatus} | categoria='${categoria}' | OK`
    );

  } catch (err) {
    Logger.warn("[GFP_ON_EDIT_APROVAR_SUGESTAO_CHECKBOX_14_2_1] " + err.message);
  }
}


/**
 * Atualiza metadados da linha aprovada.
 */
function GFP_marcarAprovacaoCheckboxMetadata_14_2_1_(sh, rowNumber, previousStatus) {
  const metaCell = sh.getRange(rowNumber, 14); // N
  const meta = GFP_parseJson_14_2_1_(metaCell.getValue());

  if (!meta.classificationParams) meta.classificationParams = {};

  meta.classificationParams.approvedByCheckboxAt = new Date().toISOString();
  meta.classificationParams.approvedByCheckboxPatch = "14.2.1";
  meta.classificationParams.previousStatusBeforeCheckboxApproval = previousStatus;
  meta.classificationParams.finalStatus = "OK";

  metaCell.setValue(JSON.stringify(meta));
}


/**
 * Alimenta CFG_Aprendizado com origem específica.
 *
 * Isso mantém compatibilidade com o aprendizado antigo.
 */
function GFP_appendCfgAprendizadoCheckboxGemini_14_2_1_(descricao, categoria) {
  if (!descricao || !categoria) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("CFG_Aprendizado");

  if (!sh) return;

  sh.appendRow([
    new Date(),
    String(descricao || "").toUpperCase(),
    String(categoria || "").trim(),
    "VALIDACAO_CHECKBOX_GEMINI"
  ]);
}


/**
 * Reverte checkboxes customizados para texto, se você quiser desfazer a instalação visual.
 *
 * Não mexe em OK.
 */
function GFP_REMOVER_CHECKBOX_APROVACAO_GEMINI_14_2_1() {
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

    if (!GFP_isSugestaoStatus_14_2_1_(status)) return;

    const cell = sh.getRange(sheetRow, 9);
    cell.clearDataValidations();
    cell.setValue(status);
    removed++;
  });

  Logger.log(`[GFP_REMOVER_CHECKBOX_APROVACAO_GEMINI_14_2_1] removed=${removed}`);

  return {
    scanned: values.length,
    removed: removed
  };
}


/**
 * Remove o trigger instalável deste patch.
 */
function GFP_REMOVER_TRIGGER_APROVACAO_GEMINI_14_2_1() {
  const handler = "GFP_ON_EDIT_APROVAR_SUGESTAO_CHECKBOX_14_2_1";
  const triggers = ScriptApp.getProjectTriggers();

  let removed = 0;

  triggers.forEach(t => {
    if (t.getHandlerFunction && t.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });

  Logger.log(`[GFP_REMOVER_TRIGGER_APROVACAO_GEMINI_14_2_1] removed=${removed}`);

  return {
    handler: handler,
    removed: removed
  };
}


function GFP_statusAprovavelPorCheckbox_14_2_1_(status) {
  const s = String(status || "").trim().toUpperCase();

  // Aprováveis.
  return s === "GEMINI_FORTE" ||
         s === "GEMINI_MEDIO" ||
         s === "GEMINI_MÉDIO" ||
         s === "GEMINI_FRACO" ||
         s === "MODELO_FORTE" ||
         s === "MODELO_MEDIO" ||
         s === "MODELO_MÉDIO" ||
         s === "MODELO_FRACO" ||
         s === "GEMINI_SUGERIDO"; // legado azul
}


function GFP_isSugestaoStatus_14_2_1_(status) {
  const s = String(status || "").trim().toUpperCase();
  return s.indexOf("GEMINI_") === 0 || s.indexOf("MODELO_") === 0;
}


function GFP_isCategoriaValida_14_2_1_(categoria) {
  return /^\d{2}\.\d{2}\s+—\s+/.test(String(categoria || "").trim());
}


function GFP_parseJson_14_2_1_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}
