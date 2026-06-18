/**
 * 📂 ARQUIVO: 5_UTILS/triggers.gs
 * ⚡ MÓDULO: GATILHOS DE EVENTOS (REAL-TIME LEARNING, CHECKBOX & TYPE CASTER)
 * 🔢 VERSÃO: 1.6 (FIXED TYPES: D, C, T, S)
 * 📅 DATA: 26/12/2025
 * 👤 AUTOR: André Fernandes (Sócio) & Gemini (Arquiteto)
 * -----------------------------------------------------------------------------
 * 📝 RESUMO:
 * Gerencia a interatividade da aba 'DB_TRANSACOES' via evento onEdit.
 * * 🛡️ PRINCÍPIOS DESTA VERSÃO:
 * 1. APRENDIZADO: Captura correções manuais e treina a IA.
 * 2. VALIDAÇÃO RÁPIDA: Checkbox na Coluna STATUS vira "OK" e valida a linha.
 * 3. DEFINIÇÃO TARDIA DE TIPO: O Tipo "T" só entra após confirmação.
 * * 🔄 HISTÓRICO:
 * - V1.5: Checkbox Destruction.
 * - V1.6 (ATUAL - STRICT TYPES FIX):
 * > CORREÇÃO CRÍTICA: Removido o tipo "R" (inexistente).
 * > PADRÃO FORÇADO: 
 * - D (Débito/Saída)
 * - C (Crédito/Entrada)
 * - T (Transferência/Fatura)
 * - S (Split - Preservado, nunca alterado pelo script)
 * -----------------------------------------------------------------------------
 */

function onEdit(e) {
  // 🛡️ Fail-safe: Validação de contexto de execução
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== "DB_TRANSACOES") return;

  const row = e.range.getRow();
  const col = e.range.getColumn();

  if (row < 2) return;

  // ===========================================================================
  // ⚡ CENÁRIO A: EDIÇÃO MANUAL DA CATEGORIA (COLUNA 6)
  // ===========================================================================
  if (col === 6) {
    const newCategory = e.value;
    if (!newCategory || newCategory === "") return;

    const description = sheet.getRange(row, 2).getValue();

    if (description && description !== "") {
      executarTreinamento(e, description, newCategory, "EDICAO_CELULA");
    }

    return;
  }

  // ===========================================================================
  // ⚡ CENÁRIO B: VALIDAÇÃO VIA CHECKBOX OU OK MANUAL (COLUNA 9 - STATUS)
  // ===========================================================================
  if (col === 9) {
    const statusValue = String(e.value || e.range.getValue() || "").toUpperCase();

    // Aceita TRUE do checkbox ou OK digitado manualmente
    if (statusValue === "TRUE" || statusValue === "OK") {
      const description = sheet.getRange(row, 2).getValue();
      const currentCategory = sheet.getRange(row, 6).getValue();

      if (description && currentCategory && description !== "") {
        // 1. Remove o checkbox antes de escrever o texto final
        e.range.clearDataValidations();

        // 2. Grava o status final como OK
        e.range.setValue("OK");

        // 3. Processa treinamento, tipo, visual e arquivamento automático
        executarTreinamento(e, description, currentCategory, "VALIDACAO_CHECKBOX");
      }
    }

    return;
  }

  // Demais cenários do seu onEdit continuam abaixo, se existirem.
}

/**
 * 🛠️ CORE: EXECUTAR TREINAMENTO E ATUALIZAÇÃO DE TIPO
 */
function executarTreinamento(e, description, category, originInfo) {
  const sheet = e.range.getSheet();
  const row = e.range.getRow();

  console.log(`[PROCESSANDO] Linha ${row} | Categoria: "${category}" | Origem: ${originInfo}`);

  try {
    // 1. TREINAMENTO
    if (typeof trainMemory === 'function') {
      trainMemory(description, category, originInfo);
    }

    // 2. FEEDBACK VISUAL
    let msgToast = (originInfo === "VALIDACAO_CHECKBOX")
      ? "✅ Confirmado e ajustado"
      : "🧠 Aprendido e ajustado";

    // 3. LIMPEZA VISUAL
    sheet.getRange(row, 6).setBackground(null);

    // 4. GARANTIA DE STATUS NA EDIÇÃO MANUAL DE CATEGORIA
    if (e.range.getColumn() === 6) {
      const cellStatus = sheet.getRange(row, 9);
      cellStatus.clearDataValidations();
      cellStatus.setValue("OK");
    }

    // 5. ATUALIZAÇÃO INTELIGENTE DO TIPO
    const novoTipo = atualizarTipoTransacao(sheet, row, category);

    if (novoTipo) {
      msgToast += ` (Tipo definido para: ${novoTipo})`;
    }

    // 6. REGRA GFP 16.1.18.1:
    // NÃO ordenar automaticamente.
    // NÃO arquivar automaticamente.
    // A linha fica na DB_TRANSACOES até André clicar em "Arquivar Linhas OK".
    try {
      const metaCell = sheet.getRange(row, 14);
      const metaRaw = String(metaCell.getValue() || "");
      let meta = {};

      try {
        meta = metaRaw ? JSON.parse(metaRaw) : {};
      } catch (eMetaParse) {
        meta = {};
      }

      if (!meta.manualValidation) meta.manualValidation = {};

      meta.manualValidation.lastOnEditAt = new Date().toISOString();
      meta.manualValidation.origin = originInfo || "";
      meta.manualValidation.patch = "16.1.18.1";
      meta.manualValidation.autoSort = false;
      meta.manualValidation.autoArchive = false;

      metaCell.setValue(JSON.stringify(meta));
    } catch (eMeta) {
      console.warn("[GFP 16.1.18.1] Falha ao registrar manualValidation: " + eMeta.message);
    }

    e.source.toast(
      msgToast + " — ficará na mesa até Arquivar Linhas OK.",
      "GFP 16.1.18.1",
      8
    );

  } catch (err) {
    console.error(`❌ ERRO CRÍTICO no Trigger: ` + err.message);
  }
}



/**
 * 🕵️‍♀️ ANALISADOR DE TIPO DE TRANSAÇÃO — GFP 15.4.1
 *
 * Regras:
 * 1. Se já for Split (S), preserva.
 * 2. Se categoria for 99.* ou transferência/movimentação interna/fatura/aplicação -> T.
 * 3. Caso contrário, valor positivo -> C; valor negativo -> D.
 *
 * IMPORTANTE:
 * O usuário NÃO precisa inserir T manualmente.
 * A troca para T acontece quando a categoria é confirmada/treinada.
 */
function atualizarTipoTransacao(sheet, row, category) {
  const rangeTipo = sheet.getRange(row, 4); // Coluna D = TIPO
  const tipoAtual = String(rangeTipo.getValue() || "").trim().toUpperCase();

  // 🛡️ TRAVA DE SEGURANÇA PARA SPLIT
  // Se já for "S", não toca, pois é uma linha mãe complexa.
  if (tipoAtual === "S") return null;

  const categoria = String(category || "").trim();
  const categoriaNorm = categoria
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const ehCategoria99 = /^99(?:\.| —| -|$)/.test(categoria);

  const termosTransferencia = [
    "transferencia",
    "transferencia entre contas",
    "movimentacao interna",
    "movimentacao entre contas",
    "movimentacao",
    "pagamento de fatura",
    "faturas",
    "cartao de credito",
    "cartão de crédito",
    "resgate",
    "aplicacao",
    "aplicação",
    "investimento",
    "saldo inicial",
    "ajuste de saldo"
  ];

  const ehTransferencia = ehCategoria99 || termosTransferencia.some(function(termo) {
    return categoriaNorm.indexOf(
      String(termo).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    ) >= 0;
  });

  const valorTransacao = sheet.getRange(row, 3).getValue(); // Coluna C = VALOR

  let novoTipo = "";

  if (ehTransferencia) {
    novoTipo = "T";
  } else if (typeof valorTransacao === "number") {
    novoTipo = valorTransacao >= 0 ? "C" : "D";
  } else {
    novoTipo = "D";
  }

  if (novoTipo !== tipoAtual) {
    rangeTipo.setValue(novoTipo);
    console.log(`[TIPO 15.4.1] Linha ${row} corrigida de '${tipoAtual}' para '${novoTipo}' | Categoria: ${categoria}`);
    return novoTipo;
  }

  return null;
}
