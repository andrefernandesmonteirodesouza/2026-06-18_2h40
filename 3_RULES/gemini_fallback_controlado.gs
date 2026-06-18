/**
 * 📂 ARQUIVO: 3_RULES/gemini_fallback_controlado.gs
 * 🧠 MÓDULO: GEMINI FALLBACK CONTROLADO COM FAIXA VISUAL
 * 🔢 VERSÃO: 14.1.0
 * 📅 DATA: 09/06/2026
 * 👤 AUTOR OPERACIONAL: André Fernandes
 * -----------------------------------------------------------------------------
 * OBJETIVO:
 * Usar Gemini como retaguarda controlada para sugerir categorias com faixas
 * visuais de confiança, sem marcar OK automaticamente.
 *
 * ESCALA OFICIAL:
 * 95% a 100%  → GEMINI_FORTE
 * 80% a 94%   → GEMINI_MEDIO
 * 60% a 79%   → GEMINI_FRACO
 * abaixo 60%  → GEMINI_BAIXO, sem preencher categoria
 * bloqueada    → GEMINI_BLOQUEADO, sem preencher categoria
 *
 * REGRAS INVIOLÁVEIS:
 * - Não mexer em STATUS = OK.
 * - Não mexer em TIPO = T.
 * - Não mexer em TIPO = S.
 * - Não sobrescrever categoria já preenchida, salvo migração legacy específica.
 * - Não marcar OK automaticamente.
 * - DRE/Dashboard devem ignorar qualquer STATUS iniciado por GEMINI_ ou MODELO_.
 * -----------------------------------------------------------------------------
 */

const GFP_GEMINI_FALLBACK_MODEL = "gemini-flash-latest";

const GFP_GEMINI_STATUS_LEGACY = "GEMINI_SUGERIDO";
const GFP_GEMINI_STATUS_FORTE = "GEMINI_FORTE";
const GFP_GEMINI_STATUS_MEDIO = "GEMINI_MEDIO";
const GFP_GEMINI_STATUS_FRACO = "GEMINI_FRACO";
const GFP_GEMINI_STATUS_BAIXO = "GEMINI_BAIXO";
const GFP_GEMINI_STATUS_BLOQUEADO = "GEMINI_BLOQUEADO";

/**
 * Liga a trava do Gemini fallback controlado.
 */
function GFP_ENABLE_GEMINI_FALLBACK_CONTROLADO() {
  PropertiesService.getScriptProperties().setProperty("GFP_ENABLE_GEMINI_FALLBACK_CONTROLADO", "TRUE");
  GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Gemini fallback controlado ATIVADO com faixas visuais.",
    "GFP"
  );
}

/**
 * Desliga a trava do Gemini fallback controlado.
 */
function GFP_DISABLE_GEMINI_FALLBACK_CONTROLADO() {
  PropertiesService.getScriptProperties().setProperty("GFP_ENABLE_GEMINI_FALLBACK_CONTROLADO", "FALSE");

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Gemini fallback controlado DESATIVADO.",
    "GFP"
  );
}

/**
 * Dry-run: consulta Gemini, mostra sugestões no log, mas não escreve na planilha.
 *
 * @param {number=} limit Limite de linhas. Padrão: 10. Máximo: 30.
 */
function GFP_GEMINI_FALLBACK_DRYRUN(limit) {
  return GFP_GEMINI_FALLBACK_RUN_(limit || 10, true);
}

/**
 * Apply: consulta Gemini e escreve sugestão com faixa visual.
 *
 * @param {number=} limit Limite de linhas. Padrão: 10. Máximo: 30.
 */
function GFP_GEMINI_FALLBACK_APPLY(limit) {
  return GFP_GEMINI_FALLBACK_RUN_(limit || 10, false);
}

/**
 * Núcleo do fallback controlado.
 */
function GFP_GEMINI_FALLBACK_RUN_(limit, dryRun) {
  const functionName = "GFP_GEMINI_FALLBACK_RUN_";
  const props = PropertiesService.getScriptProperties();

  const enabled = String(props.getProperty("GFP_ENABLE_GEMINI_FALLBACK_CONTROLADO") || "").toUpperCase() === "TRUE";
  if (!enabled) {
    throw new Error(
      "Gemini fallback controlado está DESATIVADO. Execute GFP_ENABLE_GEMINI_FALLBACK_CONTROLADO() antes."
    );
  }

  const apiKey = props.getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada em Script Properties.");
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 30));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("DB_TRANSACOES");
  if (!sheet) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log(`[${functionName}] Nenhuma transação para processar.`);
    return { dryRun: !!dryRun, candidates: 0, suggestions: 0 };
  }

  const categories = GFP_getOfficialCategoriesForGemini_();
  if (!categories.length) {
    throw new Error("Nenhuma categoria oficial encontrada em CFG_Categorias.");
  }

  // GFP 14.5 — Modelo próprio antes do Gemini.
  // Em APPLY, o modelo classifica primeiro o que já sabe.
  // Em DRY-RUN, apenas registra no log sem alterar a planilha.
  try {
    if (typeof GFP_MODELO_PRECLASSIFICAR_PENDENTES_DRYRUN_14_5 === "function") {
      const preLimit = Math.max(30, Math.min(safeLimit * 5, 150));
      const preResult = dryRun
        ? GFP_MODELO_PRECLASSIFICAR_PENDENTES_DRYRUN_14_5(preLimit)
        : (
            typeof GFP_MODELO_PRECLASSIFICAR_MAYBE_APPLY_14_5 === "function"
              ? GFP_MODELO_PRECLASSIFICAR_MAYBE_APPLY_14_5(preLimit, "ANTES_GEMINI")
              : { skipped: true, reason: "helper apply não encontrado" }
          );

      Logger.log("[GFP 14.5] Resultado do modelo antes do Gemini: " + JSON.stringify(preResult));
    }
  } catch (preModelError) {
    Logger.warn("[GFP 14.5] Falha no modelo antes do Gemini; seguindo para Gemini: " + preModelError.message);
  }

  // Recarrega a DB_TRANSACOES após o modelo próprio, pois algumas linhas podem ter virado MODELO_*.
  const values = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  const candidates = [];


  values.forEach((row, idx) => {
    if (candidates.length >= safeLimit) return;

    const sheetRow = idx + 2;
    const desc = String(row[1] || "").trim();
    const valor = row[2];
    const tipo = String(row[3] || "").trim().toUpperCase();
    const conta = String(row[4] || "").trim();
    const categoria = String(row[5] || "").trim();
    const status = String(row[8] || "").trim().toUpperCase();
    const notas = String(row[9] || "").trim();

    if (!desc) return;

    // Linhas já resolvidas ou reservadas.
    if (status === "OK" || status === "CONCILIADO" || status === "SPLIT") return;
    if (status.indexOf("GEMINI_") === 0 || status.indexOf("MODELO_") === 0) return;

    // Transferência/split nunca vão ao Gemini.
    if (tipo === "T" || tipo === "S") return;

    // Não sobrescrever categoria já preenchida.
    if (categoria) return;

    // Proteções de fatura explícita.
    if (desc.toUpperCase().includes("PAGAMENTO DE FATURA")) return;
    if (desc.toUpperCase().includes("FATURA PICPAY CARD")) return;

    candidates.push({
      row: sheetRow,
      data: GFP_formatDateForGemini_(row[0]),
      descricao: desc,
      valor: typeof valor === "number" ? valor : GFP_parseNumberForGemini_(valor),
      tipo: tipo,
      conta: conta,
      notas: notas
    });
  });

  Logger.log(`[${functionName}] ${dryRun ? "DRY-RUN" : "APPLY"} | candidatos=${candidates.length} | limite=${safeLimit}`);

  if (!candidates.length) {
    return { dryRun: !!dryRun, candidates: 0, suggestions: 0 };
  }

  const suggestions = GFP_callGeminiForCategorySuggestions_(apiKey, candidates, categories);
  const validSet = {};
  categories.forEach(c => validSet[c] = true);

  const accepted = [];

  suggestions.forEach(sug => {
    const rowNumber = Number(sug.row);
    const category = String(sug.categoria || "").trim();
    let confidence = Number(sug.confidence || 0);
    const reason = String(sug.reason || "").trim();

    if (!rowNumber || !category) return;

    if (!validSet[category]) {
      Logger.warn(`[${functionName}] Categoria rejeitada por não existir na CFG_Categorias | row=${rowNumber} | categoria='${category}'`);
      return;
    }

    const match = candidates.find(c => c.row === rowNumber);
    if (!match) return;

    // Rebaixamento automático para categorias sem informação real.
    // Ex.: A Identificar / Não Identificada nunca deve virar "forte".
    const lowInfoCategory = GFP_isGeminiLowInformationCategory_(category);
    const lowInfoDescription = GFP_isGeminiLowInformationDescription_(match.descricao);

    if (lowInfoCategory || lowInfoDescription) {
      confidence = Math.min(confidence, 59);
    }

    const faixa = GFP_getGeminiConfidenceBand_(confidence, false);

    accepted.push({
      row: rowNumber,
      categoria: category,
      confidence: confidence,
      reason: reason,
      faixa: faixa.faixa,
      status: faixa.status,
      shouldWriteCategory: faixa.shouldWriteCategory,
      input: match
    });
  });

  Logger.log(`[${functionName}] sugestões_validas=${accepted.length}`);

  accepted.slice(0, 30).forEach(s => {
    Logger.log(
      `[${functionName}] ${dryRun ? "[DRY]" : "[APPLY]"} ` +
      `linha=${s.row} | conf=${s.confidence} | faixa=${s.faixa} | status=${s.status} | ` +
      `preenche_categoria=${s.shouldWriteCategory ? "SIM" : "NAO"} | ` +
      `categoria='${s.categoria}' | desc='${s.input.descricao}' | motivo='${s.reason}'`
    );
  });

  if (!dryRun) {
    accepted.forEach(s => {
      const row = s.row;
      const metaCell = sheet.getRange(row, 14);
      const meta = GFP_parseMetadataForGemini_(metaCell.getValue());

      meta.classificationParams = Object.assign({}, meta.classificationParams || {}, {
        source: "GEMINI_FALLBACK_CONTROLADO",
        confidence: s.confidence,
        faixa: s.faixa,
        status: s.status,
        suggestedCategory: s.categoria,
        categoryWritten: !!s.shouldWriteCategory,
        reason: s.reason,
        suggestedAt: new Date().toISOString(),
        model: GFP_GEMINI_FALLBACK_MODEL,
        patch: "14.1"
      });

      // CATEGORIA:
      // - FORTE/MEDIA/FRACA: preenche como sugestão.
      // - BAIXO/BLOQUEADO: não preenche categoria; guarda apenas em metadados/notas.
      if (s.shouldWriteCategory) {
        sheet.getRange(row, 6).setValue(s.categoria);
      } else {
        sheet.getRange(row, 6).clearContent();
      }

      // STATUS visual.
      sheet.getRange(row, 9).setValue(s.status);

      // NOTAS.
      const oldNote = String(sheet.getRange(row, 10).getValue() || "").trim();
      const actionTxt = s.shouldWriteCategory
        ? `categoria preenchida como sugestão`
        : `categoria NÃO preenchida; sugestão guardada em metadados`;
      const addNote = `[Gemini ${s.faixa} ${s.confidence}%] ${actionTxt}: ${s.categoria}. ${s.reason}`;

      sheet.getRange(row, 10).setValue(oldNote ? `${oldNote}\n${addNote}` : addNote);

      // METADADOS.
      metaCell.setValue(JSON.stringify(meta));
    });

    GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1();

    try {
      if (typeof GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1 === "function") {
        GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1();
      }
    } catch (checkboxError) {
      Logger.warn("[GFP 14.2.2] Falha ao aplicar checkbox após Gemini APPLY: " + checkboxError.message);
    }

        try {
      if (typeof GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3 === "function") {
        GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3();
      }
    } catch (sortError) {
      Logger.warn("[GFP 14.3] Falha ao ordenar DB_TRANSACOES após Gemini APPLY: " + sortError.message);
    }

  }

  return {
    dryRun: !!dryRun,
    candidates: candidates.length,
    suggestions: accepted.length,
    examples: accepted.slice(0, 20)
  };
}

/**
 * Chama Gemini para classificar um lote pequeno.
 */
function GFP_callGeminiForCategorySuggestions_(apiKey, candidates, categories) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GFP_GEMINI_FALLBACK_MODEL}:generateContent?key=${apiKey}`;

  const prompt = GFP_buildGeminiFallbackPrompt_(candidates, categories);

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: "application/json"
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code !== 200) {
    throw new Error(`Gemini API falhou. HTTP ${code}: ${body}`);
  }

  const json = JSON.parse(body);
  let txt = json.candidates &&
            json.candidates[0] &&
            json.candidates[0].content &&
            json.candidates[0].content.parts &&
            json.candidates[0].content.parts[0] &&
            json.candidates[0].content.parts[0].text;

  if (!txt) {
    throw new Error("Gemini retornou resposta vazia.");
  }

  txt = String(txt).replace(/```json/g, "").replace(/```/g, "").trim();

  const parsed = JSON.parse(txt);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.suggestions)) return parsed.suggestions;

  throw new Error("Formato inválido retornado pelo Gemini. Esperado array ou { suggestions: [] }.");
}

/**
 * Prompt controlado.
 */
function GFP_buildGeminiFallbackPrompt_(candidates, categories) {
  return `
Você é um assistente de categorização financeira do sistema GFP.

TAREFA:
Sugerir uma categoria oficial para cada transação pendente.

REGRAS OBRIGATÓRIAS:
1. Escolha SOMENTE uma categoria da lista oficial.
2. Não invente categoria.
3. Não use categoria 99.xx, salvo quando for claramente movimentação/fatura/transferência.
4. Não classifique pagamento de fatura como despesa.
5. 99APP é transporte.
6. 99FOOD, IFD, IFOOD e RAPPI são delivery de alimentação, salvo quando a natureza for claramente outra.
7. PET CENTER, PETZ, COBASI e PETLOVE são Pets, mesmo quando comprados por IFD/iFood.
8. TARIFA é ambígua; só classifique se o contexto for claramente tarifa bancária.
9. ZÉ DELIVERY é ambíguo; use baixa confiança se não houver contexto.
10. Compra realizada sem nome de estabelecimento deve ter confiança baixa.
11. Pix para pessoa física sem contexto deve ter confiança baixa ou média-baixa.
12. Categoria "A Identificar" ou "Não Identificada" nunca deve ter confiança alta.
13. Retorne JSON puro, sem markdown.

ESCALA DE CONFIANÇA:
- 95 a 100: certeza muito alta, padrão explícito e recorrente.
- 80 a 94: boa sugestão, mas ainda revisável.
- 60 a 79: sugestão fraca, precisa revisão atenta.
- abaixo de 60: baixa confiança; sistema não preencherá categoria.

FORMATO DE RESPOSTA:
[
  {
    "row": 123,
    "categoria": "02.02 — Despesas — Alimentação — Delivery",
    "confidence": 85,
    "reason": "Descrição indica iFood/delivery de alimentação"
  }
]

CATEGORIAS OFICIAIS:
${categories.map(c => `- ${c}`).join("\n")}

TRANSAÇÕES:
${JSON.stringify(candidates, null, 2)}
`;
}

/**
 * Lê categorias oficiais da CFG_Categorias.
 * Aceita qualquer célula que contenha o padrão " — ".
 */
function GFP_getOfficialCategoriesForGemini_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("CFG_Categorias");
  if (!sh) return [];

  const values = sh.getDataRange().getDisplayValues();
  const out = [];

  values.forEach(row => {
    row.forEach(cell => {
      const txt = String(cell || "").trim();
      if (!txt) return;
      if (!txt.includes(" — ")) return;
      if (!/^\d{2}\.\d{2}/.test(txt)) return;
      if (out.indexOf(txt) === -1) out.push(txt);
    });
  });

  return out;
}

/**
 * Converte confiança numérica na faixa visual oficial.
 */
function GFP_getGeminiConfidenceBand_(confidence, blocked) {
  const n = Math.max(0, Math.min(100, Number(confidence || 0)));

  if (blocked) {
    return {
      faixa: "BLOQUEADA",
      status: GFP_GEMINI_STATUS_BLOQUEADO,
      shouldWriteCategory: false
    };
  }

  if (n >= 95) {
    return {
      faixa: "FORTE",
      status: GFP_GEMINI_STATUS_FORTE,
      shouldWriteCategory: true
    };
  }

  if (n >= 80) {
    return {
      faixa: "MEDIA",
      status: GFP_GEMINI_STATUS_MEDIO,
      shouldWriteCategory: true
    };
  }

  if (n >= 60) {
    return {
      faixa: "FRACA",
      status: GFP_GEMINI_STATUS_FRACO,
      shouldWriteCategory: true
    };
  }

  return {
    faixa: "BAIXA_NAO_PREENCHER",
    status: GFP_GEMINI_STATUS_BAIXO,
    shouldWriteCategory: false
  };
}

/**
 * Categorias genéricas não devem gerar confiança alta nem preencher categoria.
 */
function GFP_isGeminiLowInformationCategory_(category) {
  const txt = GFP_stripAccentsForGemini_(String(category || "")).toUpperCase();

  return txt.includes("A IDENTIFICAR") ||
         txt.includes("NAO IDENTIFICADA") ||
         txt.includes("NAO IDENTIFICADO") ||
         txt.includes("NAO IDENTIFICAR") ||
         txt.includes("A CLASSIFICAR");
}

/**
 * Descrições genéricas não devem preencher categoria automaticamente.
 */
function GFP_isGeminiLowInformationDescription_(description) {
  const txt = GFP_stripAccentsForGemini_(String(description || ""))
    .toUpperCase()
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]+\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!txt) return true;

  const generic = [
    "COMPRA REALIZADA",
    "PAGAMENTO REALIZADO",
    "PIX ENVIADO",
    "PIX RECEBIDO",
    "COMPRA COM CARTAO",
    "COMPRA COM CARTÃO"
  ];

  return generic.indexOf(txt) >= 0;
}

/**
 * Aplica cores visuais na DB_TRANSACOES.
 *
 * Cores:
 * - FORTE: verde
 * - MEDIA: amarelo
 * - FRACA: laranja
 * - BAIXO: cinza
 * - BLOQUEADO: vermelho
 * - LEGACY GEMINI_SUGERIDO: azul
 */
function GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");
  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const maxRows = Math.max(sh.getMaxRows() - 1, 1);

  // Colunas F:J = CATEGORIA até NOTAS.
  const range = sh.getRange(2, 6, maxRows, 5);

  const existing = sh.getConditionalFormatRules() || [];

  // Remove regras antigas criadas por este patch/instalador para evitar duplicidade.
  const kept = existing.filter(rule => {
    try {
      const bc = rule.getBooleanCondition();
      if (!bc) return true;

      const vals = bc.getCriteriaValues();
      const formula = vals && vals[0] ? String(vals[0]) : "";

      if (formula.includes("GEMINI_")) return false;
      if (formula.includes("MODELO_")) return false;
      if (formula.includes("BLOQUEADA")) return false;

      return true;
    } catch (e) {
      return true;
    }
  });

  const rules = kept.slice();

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=OR($I2="GEMINI_FORTE",$I2="MODELO_FORTE")')
      .setBackground("#d9ead3")
      .setFontColor("#14532d")
      .setRanges([range])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=OR($I2="GEMINI_MEDIO",$I2="MODELO_MEDIO")')
      .setBackground("#fff2cc")
      .setFontColor("#7c5e00")
      .setRanges([range])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=OR($I2="GEMINI_FRACO",$I2="MODELO_FRACO")')
      .setBackground("#fce5cd")
      .setFontColor("#9a3412")
      .setRanges([range])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=OR($I2="GEMINI_BAIXO",$I2="MODELO_BAIXO")')
      .setBackground("#f3f4f6")
      .setFontColor("#4b5563")
      .setRanges([range])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=OR($I2="GEMINI_BLOQUEADO",$I2="MODELO_BLOQUEADO",$I2="BLOQUEADA")')
      .setBackground("#f4cccc")
      .setFontColor("#991b1b")
      .setRanges([range])
      .build()
  );

  // Legacy: sugestões antigas anteriores ao patch 14.1.
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$I2="GEMINI_SUGERIDO"')
      .setBackground("#dbeafe")
      .setFontColor("#1e3a8a")
      .setRanges([range])
      .build()
  );

  sh.setConditionalFormatRules(rules);

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Cores Gemini/Modelo aplicadas na DB_TRANSACOES.",
    "GFP 14.1"
  );

  Logger.log("[GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1] Regras visuais aplicadas.");
}

/**
 * DRY-RUN de migração dos antigos GEMINI_SUGERIDO para as faixas novas.
 */
function GFP_MIGRAR_GEMINI_SUGERIDO_PARA_FAIXAS_DRYRUN_14_1() {
  return GFP_MIGRAR_GEMINI_SUGERIDO_PARA_FAIXAS_14_1_(true);
}

/**
 * APPLY de migração dos antigos GEMINI_SUGERIDO para as faixas novas.
 */
function GFP_MIGRAR_GEMINI_SUGERIDO_PARA_FAIXAS_APPLY_14_1() {
  return GFP_MIGRAR_GEMINI_SUGERIDO_PARA_FAIXAS_14_1_(false);
}

/**
 * Migra linhas legacy GEMINI_SUGERIDO.
 *
 * Observação:
 * - Não marca OK.
 * - Não altera linhas OK.
 * - Se a categoria atual for genérica ou confiança < 60, limpa a categoria
 *   e guarda a sugestão nos metadados/notas.
 */
function GFP_MIGRAR_GEMINI_SUGERIDO_PARA_FAIXAS_14_1_(dryRun) {
  const functionName = "GFP_MIGRAR_GEMINI_SUGERIDO_PARA_FAIXAS_14_1_";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TRANSACOES");
  if (!sh) throw new Error("Aba DB_TRANSACOES não encontrada.");

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { dryRun: !!dryRun, found: 0, updated: 0 };

  const values = sh.getRange(2, 1, lastRow - 1, 14).getValues();

  const updates = [];

  values.forEach((row, idx) => {
    const sheetRow = idx + 2;

    const categoria = String(row[5] || "").trim();
    const status = String(row[8] || "").trim().toUpperCase();
    const notas = String(row[9] || "").trim();
    const meta = GFP_parseMetadataForGemini_(row[13]);

    if (status !== GFP_GEMINI_STATUS_LEGACY) return;

    let confidence = GFP_extractGeminiConfidenceFromText_(notas);

    if (!confidence && meta && meta.classificationParams) {
      confidence = Number(meta.classificationParams.confidence || 0);
    }

    if (!confidence) confidence = 0;

    const lowInfoCategory = GFP_isGeminiLowInformationCategory_(categoria);
    if (lowInfoCategory) confidence = Math.min(confidence, 59);

    const faixa = GFP_getGeminiConfidenceBand_(confidence, false);

    updates.push({
      row: sheetRow,
      oldStatus: status,
      newStatus: faixa.status,
      faixa: faixa.faixa,
      confidence: confidence,
      categoria: categoria,
      clearCategory: !faixa.shouldWriteCategory
    });
  });

  Logger.log(`[${functionName}] ${dryRun ? "DRY-RUN" : "APPLY"} | encontrados=${updates.length}`);

  updates.forEach(u => {
    Logger.log(
      `[${functionName}] ${dryRun ? "[DRY]" : "[APPLY]"} ` +
      `linha=${u.row} | ${u.oldStatus} → ${u.newStatus} | conf=${u.confidence} | ` +
      `limpar_categoria=${u.clearCategory ? "SIM" : "NAO"} | categoria='${u.categoria}'`
    );
  });

  if (!dryRun) {
    updates.forEach(u => {
      const row = u.row;
      const metaCell = sh.getRange(row, 14);
      const meta = GFP_parseMetadataForGemini_(metaCell.getValue());

      meta.classificationParams = Object.assign({}, meta.classificationParams || {}, {
        migratedFrom: GFP_GEMINI_STATUS_LEGACY,
        migratedTo: u.newStatus,
        migratedAt: new Date().toISOString(),
        faixa: u.faixa,
        confidence: u.confidence,
        suggestedCategoryLegacy: u.categoria,
        categoryWritten: !u.clearCategory,
        patch: "14.1_migration"
      });

      if (u.clearCategory) {
        sh.getRange(row, 6).clearContent();
      }

      sh.getRange(row, 9).setValue(u.newStatus);

      const oldNote = String(sh.getRange(row, 10).getValue() || "").trim();
      const addNote = `[Migração 14.1] ${GFP_GEMINI_STATUS_LEGACY} convertido para ${u.newStatus} (${u.confidence}%).`;
      sh.getRange(row, 10).setValue(oldNote ? `${oldNote}\n${addNote}` : addNote);

      metaCell.setValue(JSON.stringify(meta));
    });

    GFP_APPLY_GEMINI_CONFIDENCE_VISUAL_RULES_14_1();

    try {
      if (typeof GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1 === "function") {
        GFP_APLICAR_CHECKBOX_APROVACAO_GEMINI_14_2_1();
      }
    } catch (checkboxError) {
      Logger.warn("[GFP 14.2.2] Falha ao aplicar checkbox após migração Gemini: " + checkboxError.message);
    }

        try {
      if (typeof GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3 === "function") {
        GFP_SORT_DB_TRANSACOES_REVISAO_INTELIGENTE_14_3();
      }
    } catch (sortError) {
      Logger.warn("[GFP 14.3] Falha ao ordenar DB_TRANSACOES após Gemini APPLY: " + sortError.message);
    }
    
  }

  return {
    dryRun: !!dryRun,
    found: updates.length,
    updated: dryRun ? 0 : updates.length,
    examples: updates.slice(0, 30)
  };
}

function GFP_extractGeminiConfidenceFromText_(txt) {
  const m = String(txt || "").match(/Gemini\s+(?:sugest[aã]o\s+)?(\d{1,3})%/i);
  if (!m) return 0;

  const n = Number(m[1]);
  if (isNaN(n)) return 0;

  return Math.max(0, Math.min(100, n));
}

function GFP_formatDateForGemini_(value) {
  if (value instanceof Date && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value || "");
}

function GFP_parseNumberForGemini_(value) {
  if (typeof value === "number") return value;

  const txt = String(value || "")
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");

  const n = Number(txt);
  return isNaN(n) ? 0 : n;
}

function GFP_parseMetadataForGemini_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch (e) {
    return {};
  }
}

function GFP_stripAccentsForGemini_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
