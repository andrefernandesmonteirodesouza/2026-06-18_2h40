/**
 * 📂 ARQUIVO: 5_UTILS/normalizador_tipo_aprovacoes_14_3_2.gs
 * 🧾 MÓDULO: NORMALIZAÇÃO UNIVERSAL DE TIPO NAS APROVAÇÕES
 * 🔢 VERSÃO: 14.3.2
 * 📅 DATA: 10/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Garantir que categorias de movimentação, fatura, transferência, aplicação,
 * resgate e similares sejam convertidas para TIPO = T quando aprovadas.
 * -----------------------------------------------------------------------------
 */

/**
 * Normaliza o TIPO de uma linha aprovada.
 *
 * Preferência:
 * 1. Usa applyTypeLogic_ServerSide(sheet, rowIndex, category), se existir.
 * 2. Caso contrário, usa fallback local seguro.
 */
function GFP_NORMALIZAR_TIPO_APROVACAO_14_3_2(sheet, rowIndex, category) {
  if (!sheet) throw new Error("Sheet não informado.");
  if (!rowIndex || rowIndex < 2) throw new Error("rowIndex inválido.");

  const categoria = String(category || sheet.getRange(rowIndex, 6).getValue() || "").trim();

  if (!categoria) {
    return {
      rowIndex: rowIndex,
      changed: false,
      reason: "categoria vazia"
    };
  }

  // Se existir a função oficial do backend, usa ela.
  try {
    if (typeof applyTypeLogic_ServerSide === "function") {
      const before = String(sheet.getRange(rowIndex, 4).getValue() || "").trim();
      applyTypeLogic_ServerSide(sheet, rowIndex, categoria);
      const after = String(sheet.getRange(rowIndex, 4).getValue() || "").trim();

      return {
        rowIndex: rowIndex,
        changed: before !== after,
        before: before,
        after: after,
        engine: "applyTypeLogic_ServerSide"
      };
    }
  } catch (e) {
    Logger.warn("[GFP 14.3.2] applyTypeLogic_ServerSide falhou; usando fallback local: " + e.message);
  }

  return GFP_NORMALIZAR_TIPO_APROVACAO_FALLBACK_14_3_2_(sheet, rowIndex, categoria);
}


/**
 * Fallback local de normalização.
 */
function GFP_NORMALIZAR_TIPO_APROVACAO_FALLBACK_14_3_2_(sheet, rowIndex, category) {
  const tipoCell = sheet.getRange(rowIndex, 4); // D
  const valor = sheet.getRange(rowIndex, 3).getValue(); // C

  const tipoAtual = String(tipoCell.getValue() || "").trim().toUpperCase();

  // Split nunca deve ser alterado por este normalizador.
  if (tipoAtual === "S") {
    return {
      rowIndex: rowIndex,
      changed: false,
      before: tipoAtual,
      after: tipoAtual,
      reason: "TIPO S preservado",
      engine: "fallback"
    };
  }

  const categoria = String(category || "").trim();
  let novoTipo = tipoAtual || "";

  if (GFP_CATEGORIA_EH_MOVIMENTACAO_T_14_3_2_(categoria)) {
    novoTipo = "T";
  } else if (typeof valor === "number") {
    novoTipo = valor >= 0 ? "C" : "D";
  }

  if (!novoTipo) {
    return {
      rowIndex: rowIndex,
      changed: false,
      before: tipoAtual,
      after: tipoAtual,
      reason: "não foi possível inferir tipo",
      engine: "fallback"
    };
  }

  if (novoTipo !== tipoAtual) {
    tipoCell.setValue(novoTipo);
  }

  return {
    rowIndex: rowIndex,
    changed: novoTipo !== tipoAtual,
    before: tipoAtual,
    after: novoTipo,
    engine: "fallback"
  };
}


/**
 * Detecta categorias que devem ser TIPO = T.
 */
function GFP_CATEGORIA_EH_MOVIMENTACAO_T_14_3_2_(category) {
  const txt = GFP_NORMALIZAR_TIPO_stripAccents_14_3_2_(String(category || ""))
    .toUpperCase();

  const termos = [
    "99.",
    "MOVIMENTACAO",
    "MOVIMENTAÇÃO",
    "PAGAMENTO DE FATURA",
    "FATURAS",
    "TRANSFERENCIA",
    "TRANSFERÊNCIA",
    "TRANSFERENCIA ENTRE CONTAS",
    "TRANSFERÊNCIA ENTRE CONTAS",
    "CARTAO DE CREDITO",
    "CARTÃO DE CRÉDITO",
    "RESGATE",
    "APLICACAO",
    "APLICAÇÃO",
    "INVESTIMENTO",
    "SALDO INICIAL",
    "AJUSTE DE SALDO",
    "MOVIMENTACAO ENTRE CONTAS",
    "MOVIMENTAÇÃO ENTRE CONTAS"
  ];

  return termos.some(t => txt.indexOf(GFP_NORMALIZAR_TIPO_stripAccents_14_3_2_(t).toUpperCase()) >= 0);
}


/**
 * DRY-RUN para verificar linhas OK/CONCILIADO que deveriam ser T.
 */
function GFP_NORMALIZAR_TIPOS_OK_DRYRUN_14_3_2() {
  return GFP_NORMALIZAR_TIPOS_OK_14_3_2_(true);
}


/**
 * APPLY para corrigir linhas OK/CONCILIADO que deveriam ser T.
 */
function GFP_NORMALIZAR_TIPOS_OK_APPLY_14_3_2() {
  return GFP_NORMALIZAR_TIPOS_OK_14_3_2_(false);
}


/**
 * Scanner de saneamento.
 *
 * Procura linhas já aprovadas/consolidadas que:
 * - têm categoria de movimentação/fatura/transferência;
 * - não estão como T;
 * - não são S.
 */
function GFP_NORMALIZAR_TIPOS_OK_14_3_2_(dryRun) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");
  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    return { dryRun: !!dryRun, scanned: 0, candidates: 0, changed: 0 };
  }

  const values = sh.getRange(2, 1, lastRow - 1, 14).getValues();

  const candidates = [];

  values.forEach((row, idx) => {
    const sheetRow = idx + 2;

    const tipo = String(row[3] || "").trim().toUpperCase();
    const categoria = String(row[5] || "").trim();
    const status = String(row[8] || "").trim().toUpperCase();

    if (!GFP_STATUS_CONSOLIDADO_NORMALIZAVEL_14_3_2_(status)) return;
    if (!categoria) return;
    if (tipo === "S") return;
    if (!GFP_CATEGORIA_EH_MOVIMENTACAO_T_14_3_2_(categoria)) return;
    if (tipo === "T") return;

    candidates.push({
      row: sheetRow,
      tipoAtual: tipo,
      tipoNovo: "T",
      categoria: categoria,
      status: status
    });
  });

  Logger.log(`[GFP_NORMALIZAR_TIPOS_OK_14_3_2_] ${dryRun ? "DRY-RUN" : "APPLY"} | candidatos=${candidates.length}`);

  candidates.forEach(c => {
    Logger.log(
      `[GFP_NORMALIZAR_TIPOS_OK_14_3_2_] ${dryRun ? "[DRY]" : "[APPLY]"} ` +
      `linha=${c.row} | ${c.tipoAtual} → T | status=${c.status} | categoria='${c.categoria}'`
    );
  });

  if (!dryRun) {
    candidates.forEach(c => {
      sh.getRange(c.row, 4).setValue("T");
    });
  }

  return {
    dryRun: !!dryRun,
    scanned: values.length,
    candidates: candidates.length,
    changed: dryRun ? 0 : candidates.length,
    examples: candidates.slice(0, 50)
  };
}


function GFP_STATUS_CONSOLIDADO_NORMALIZAVEL_14_3_2_(status) {
  const s = String(status || "").trim().toUpperCase();

  return s === "OK" ||
         s === "CONCILIADO" ||
         s === "APROVADO" ||
         s === "CONSOLIDADO";
}


function GFP_NORMALIZAR_TIPO_stripAccents_14_3_2_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
