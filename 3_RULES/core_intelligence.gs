/**
 * 📂 ARQUIVO: 3_RULES/core_intelligence.gs
 * 🧠 MÓDULO: CÉREBRO DE INTELIGÊNCIA UNIFICADO (V9.4 - IA ACTIVE)
 * 🔢 VERSÃO: 9.4 (GEMINI RESTORED)
 * 📅 DATA: 25/12/2025
 * -----------------------------------------------------------------------------
 * 📝 RESUMO:
 * - IA Reativada: A função 'processBatchWithGemini' volta a ser chamada.
 * - Regras Hardcoded Removidas: Obedece 100% à aba CFG_Aprendizado.
 * - Regra de Ouro (Fatura): Mantida para garantir integridade contábil.
 * -----------------------------------------------------------------------------
 */

const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");

// ⚡ CACHE GLOBAL
let GLOBAL_MEMORY_CACHE = null;
let GLOBAL_TAXONOMY_CACHE = null;
let GLOBAL_CATEGORIES_CACHE = null;

// =================================================================
// 🔌 SEÇÃO 1: CONECTOR DO PIPELINE DE DADOS (AUTOMÁTICO)
// =================================================================

function runClassificationPipeline(payload) {
  const functionName = "runClassificationPipeline";
  Logger.log(`[${functionName}] 🧠 Iniciando inteligência para ${payload.normalized.length} itens...`);

  if (!payload || !Array.isArray(payload.normalized)) return payload;

  if (!GLOBAL_MEMORY_CACHE) GLOBAL_MEMORY_CACHE = loadSheetToMap("CFG_Aprendizado", 1, 2);
  if (!GLOBAL_TAXONOMY_CACHE) GLOBAL_TAXONOMY_CACHE = loadSheetToMap("CFG_Taxonomia", 0, 1);
  if (!GLOBAL_CATEGORIES_CACHE) GLOBAL_CATEGORIES_CACHE = loadCategoryTree();

  const unknownItems = [];

  payload.normalized.forEach(item => {
    if (!item) return;
    if (item.category && item.category !== "") return;

    const cat = classifyTransaction(item.description, item.amount);

    if (cat) {
      item.category = cat;
      if (!item.meta) item.meta = {};
      item.meta.classificationParams = { source: "INTERNAL_LOGIC", confidence: "HIGH" };
    } else {
      unknownItems.push(item);
    }
  });

  const allowGemini = String(
    PropertiesService.getScriptProperties().getProperty("GFP_ENABLE_GEMINI_CLASSIFICATION") || "FALSE"
  ).toUpperCase().trim() === "TRUE";

  if (unknownItems.length > 0 && allowGemini) {
    Logger.log(`[${functionName}] 🤖 ${unknownItems.length} itens não identificados. Acionando Agente Gemini...`);
    processBatchWithGemini(unknownItems);
  } else if (unknownItems.length > 0) {
    Logger.warn(
      `[${functionName}] ⚠️ ${unknownItems.length} itens sem categoria. ` +
      `Gemini em massa está DESATIVADO. Use CFG_Taxonomia/CFG_Aprendizado ou reative com GFP_GEMINI_CLASSIFICACAO_ATIVAR().`
    );
  } else {
    Logger.log(`[${functionName}] ✅ Todos os itens classificados via lógica interna.`);
  }

  return payload;
}


// =================================================================
// 🧠 SEÇÃO 2: MOTOR LÓGICO (DETERMINÍSTICO)
// =================================================================

function classifyTransaction(description, value) {
  if (!description) return "";
  
  let descClean = description.toUpperCase().trim();
  descClean = descClean.replace(/\*/g, " "); 
  descClean = descClean.replace(/\s\d{1,2}\/\d{1,2}/g, ""); 
  descClean = descClean.replace(/\sBR\s*$/g, ""); 
  descClean = descClean.replace(/\s+/g, " ").trim(); 

  // B. MEMÓRIA VIVA (CFG_Aprendizado)
  if (GLOBAL_MEMORY_CACHE) {
    for (let key in GLOBAL_MEMORY_CACHE) {
      if (descClean.includes(key)) return GLOBAL_MEMORY_CACHE[key];
    }
  }
  
  // C. TAXONOMIA (CFG_Taxonomia)
  if (GLOBAL_TAXONOMY_CACHE) {
    for (let key in GLOBAL_TAXONOMY_CACHE) {
      if (descClean.includes(key)) return GLOBAL_TAXONOMY_CACHE[key];
    }
  }

  return ""; 
}

// =================================================================
// 🤖 SEÇÃO 3: AGENTE DE IA EM LOTE
// =================================================================

function processBatchWithGemini(items) {
  if (!GEMINI_API_KEY) {
    Logger.warn("[AI AGENT] Chave Gemini não configurada. Pulando classificação IA.");
    return;
  }
  
  const batchSize = 30;
  const categoriesStr = GLOBAL_CATEGORIES_CACHE.join(", ");

  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    
    const listToClassify = chunk.map((it, idx) => `ID ${idx}: "${it.description}" (R$ ${it.amount})`).join("\n");

    const prompt = `
      ATUE COMO CONTADOR SÊNIOR.
      Classifique as transações abaixo escolhendo a melhor opção desta lista exata:
      [${categoriesStr}]
      
      REGRAS:
      1. Retorne APENAS um Array JSON de strings. Ex: ["Cat A", "Cat B"].
      2. Mantenha a ordem exata da entrada.
      3. Se a descrição for genérica demais, use "02.98 — Despesas — A Identificar — A Identificar".
      
      TRANSAÇÕES:
      ${listToClassify}
    `;

    try {
      const result = callGeminiBrain(prompt);
      
      if (Array.isArray(result) && result.length === chunk.length) {
        chunk.forEach((it, idx) => {
          it.category = result[idx];
          if (!it.meta) it.meta = {};
          it.meta.classificationParams = { source: "GEMINI_BATCH", confidence: "MEDIUM" };
        });
        Logger.log(`[AI AGENT] Lote ${i} processado com sucesso.`);
      } else {
        Logger.warn(`[AI AGENT] Resposta da IA malformada no lote ${i}.`);
      }
    } catch (e) {
      Logger.warn(`[AI AGENT] Falha crítica no lote ${i}: ${e.message}`);
    }
  }
}

// =================================================================
// 🗣️ SEÇÃO 4: PROCESSAMENTO DE LINGUAGEM NATURAL
// =================================================================

function processNaturalLanguage(textoInput, accountContext = "") {
  const functionName = "processNaturalLanguage";
  
  if (!GLOBAL_CATEGORIES_CACHE || GLOBAL_CATEGORIES_CACHE.length === 0) {
    GLOBAL_CATEGORIES_CACHE = loadCategoryTree();
  }
  const categoriasString = GLOBAL_CATEGORIES_CACHE.join("\n");

  let contasPrompt = "";
  if (accountContext) {
      contasPrompt = `CONTAS VÁLIDAS DO USUÁRIO (Escolha destas): ${accountContext}`;
  }

  const hoje = new Date();
  const anoVigente = hoje.getFullYear();
  const mesVigente = hoje.getMonth() + 1;
  const diaHoje = hoje.getDate();

  const prompt = `
    ATUE COMO ASSISTENTE FINANCEIRO PESSOAL.
    Analise a entrada do usuário: "${textoInput}"
    
    === CONTEXTO TEMPORAL ===
    HOJE É: ${diaHoje}/${mesVigente}/${anoVigente}.
    
    === REGRAS DE DATA ===
    1. Se disser apenas o dia (ex: "dia 10"), ASSUMA O MÊS ${mesVigente} e o ANO ${anoVigente}.
    2. Se disser dia/mês, ASSUMA O ANO ${anoVigente}.
    3. Na dúvida, use SEMPRE ${anoVigente}.
    
    === REGRAS DE PARCELAMENTO ===
    1. Identifique se é parcelado (ex: "em 4x", "4 parcelas", "dividido em 10").
    2. Se não houver menção, parcelas = 1.
    3. O valor informado é o TOTAL da compra, a menos que dito "4 parcelas de 100".
    
    ${contasPrompt}
    
    LISTA OFICIAL DE CATEGORIAS:
    ${categoriasString}
    
    RETORNE APENAS ESTE JSON (SEM MARKDOWN):
    {
      "data": "DD/MM/YYYY",
      "valor": 0.00,
      "descricao": "Resumo curto e claro",
      "conta": "Nome da Conta ou 'Carteira Física'", 
      "categoria": "Uma das categorias da lista acima",
      "parcelas": 1
    }
  `;

  Logger.log(`[${functionName}] Enviando prompt NLP...`);
  return callGeminiBrain(prompt);
}

// =================================================================
// 🛠️ SEÇÃO 5: INFRAESTRUTURA & HELPERS
// =================================================================

function callGeminiBrain(prompt) {
  const functionName = "callGeminiBrain";
  
  if (!GEMINI_API_KEY) {
    Logger.error(`[${functionName}] ERRO FATAL: GEMINI_API_KEY não configurada.`);
    return null; // Retorna null direto sem jogar erro para não travar o pipeline
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  const options = {
    method: "post", 
    contentType: "application/json", 
    muteHttpExceptions: true,
    payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  };
  
  // TENTATIVA ÚNICA (SNIPER MODE) - Sem loops, sem espera.
  try {
    const res = UrlFetchApp.fetch(url, options);
    
    if (res.getResponseCode() !== 200) {
      Logger.warn(`[${functionName}] ⚠️ Falha na API (Code ${res.getResponseCode()}): ${res.getContentText()}`);
      return null; // Falhou? Segue a vida.
    }

    const json = JSON.parse(res.getContentText());
    let txt = json.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (txt) {
      txt = txt.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(txt);
    }
    
    return null;

  } catch(e) { 
    Logger.error(`[${functionName}] 🔥 Erro na execução: ${e.message}`);
    return null; 
  }
}

function loadCategoryTree() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("CFG_Categorias");
  if (!sheet) return ["Geral"]; 
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return ["Geral"];
  
  const data = sheet.getRange(2, 6, lastRow - 1, 1).getValues();
  return [...new Set(data.flat().filter(String))].sort();
}


function loadSheetToMap(sheetName, keyColIdx, valColIdx) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return {};

  const data = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < data.length; i++) {
    const rawKey = data[i][keyColIdx];
    const val = data[i][valColIdx];

    if (rawKey && val) {
      const cleanKey = String(rawKey)
        .toUpperCase()
        .replace(/\*/g, " ")
        .trim();

      if (cleanKey) map[cleanKey] = val;
    }
  }

  return map;
}



function trainMemory(termoChave, categoriaCorreta, origin = "SISTEMA") {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("CFG_Aprendizado");

  if (!sheet) {
    sheet = ss.insertSheet("CFG_Aprendizado");
    sheet.appendRow(["DATA_TREINO", "TERMO_CHAVE", "CATEGORIA_APRENDIDA", "ORIGEM"]);
    sheet.setFrozenRows(1);
    sheet.getRange("A1:D1").setFontWeight("bold").setBackground("#EFEFEF");
  }

  const termoUpper = String(termoChave)
    .toUpperCase()
    .replace(/\*/g, " ")
    .trim();

  const data = sheet.getDataRange().getValues();
  let updated = false;

  for (let i = 1; i < data.length; i++) {
    const rowKey = String(data[i][1])
      .toUpperCase()
      .replace(/\*/g, " ")
      .trim();

    if (rowKey === termoUpper) {
      sheet.getRange(i + 1, 3).setValue(categoriaCorreta);
      sheet.getRange(i + 1, 1).setValue(new Date());
      sheet.getRange(i + 1, 4).setValue(origin);
      updated = true;
      break;
    }
  }

  if (!updated) {
    sheet.appendRow([new Date(), termoUpper, categoriaCorreta, origin]);
  }

  GLOBAL_MEMORY_CACHE = null;
  return true;
}



/**
 * 🔄 FUNÇÃO EXTRA: RESCAN DE INTELIGÊNCIA (V2.0 - REVISÃO PROFUNDA)
 * 📝 O QUE FAZ: 
 * 1. Recarrega a memória atualizada.
 * 2. Varre itens PENDENTES.
 * 3. Alvos: 
 * - Itens com categoria VAZIA.
 * - Itens com SUGESTÃO (Fundo Amarelo) -> Para corrigir palpites errados antigos.
 * 4. Preserva: Itens com fundo branco preenchidos manualmente.
 */
function forceIntelligenceRescan() {
  const functionName = "forceIntelligenceRescan";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("DB_TRANSACOES");
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert("Aba DB_TRANSACOES não encontrada.");
    return;
  }

  // 1. FORÇA RECARGA DA MEMÓRIA
  GLOBAL_MEMORY_CACHE = null; 
  GLOBAL_TAXONOMY_CACHE = null;
  // Recarrega agora com os dados novos da CFG_Aprendizado
  GLOBAL_MEMORY_CACHE = loadSheetToMap("CFG_Aprendizado", 1, 2);
  GLOBAL_TAXONOMY_CACHE = loadSheetToMap("CFG_Taxonomia", 0, 1);
  
  Logger.log(`[${functionName}] 🧠 Memória recarregada.`);
  ss.toast("🧠 Reavaliando sugestões e vazios...", "IA", 3);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // Lendo dados e cores
  const range = sheet.getRange(2, 1, lastRow - 1, 10);
  const values = range.getValues();
  const backgrounds = range.getBackgrounds();
  const validations = sheet.getRange(2, 9, lastRow - 1, 1).getDataValidations(); 

  let updatesCount = 0;
  
  const checkboxRule = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .setAllowInvalid(false)
    .build();

  // 2. VARREDURA INTELIGENTE
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const status = row[8];    // Coluna I
    const categoria = row[5]; // Coluna F
    const corFundo = backgrounds[i][5]; // Cor da célula de categoria
    
    // CRITÉRIOS DE ALVO:
    // 1. Status deve ser PENDENTE (diferente de OK, SPLIT, CONCILIADO)
    const isPendente = (status !== "OK" && status !== "SPLIT" && status !== "CONCILIADO");
    
    // 2. Deve ser VAZIO ou SUGESTÃO (Amarelo)
    // Se for Branco preenchido, é sagrado (usuário fez), não mexe.
    const isAlvo = (categoria === "") || (corFundo === "#fff9c4");

    if (isPendente && isAlvo) {
      
      const desc = row[1];
      const val = row[2];

      // Tenta re-classificar
      const newCat = classifyTransaction(desc, val);

      // Se achou uma categoria E ela é diferente da atual (para evitar reescrever o mesmo)
      if (newCat && newCat !== "" && newCat !== categoria) {
        
        values[i][5] = newCat; // Aplica nova categoria
        backgrounds[i][5] = "#fff9c4"; // Garante/Renova o amarelo
        
        // Garante checkbox
        if (!validations[i]) {
            validations[i] = checkboxRule;
        }
        
        updatesCount++;
      }
    }
  }

  // 3. PERSISTÊNCIA
  if (updatesCount > 0) {
    // Grava Categorias
    const catColumn = values.map(r => [r[5]]);
    sheet.getRange(2, 6, lastRow - 1, 1).setValues(catColumn);

    // Grava Cores
    const bgColumn = backgrounds.map(r => [r[5]]);
    sheet.getRange(2, 6, lastRow - 1, 1).setBackgrounds(bgColumn);

    // Grava Checkboxes
    sheet.getRange(2, 9, lastRow - 1, 1).setDataValidations(validations);

    Logger.log(`[${functionName}] ✅ ${updatesCount} itens atualizados/corrigidos.`);
    ss.toast(`🎉 ${updatesCount} itens atualizados (Novos + Correções)!`, "Sucesso");
  } else {
    ss.toast("Nenhuma nova correspondência encontrada.", "IA");
  }
}