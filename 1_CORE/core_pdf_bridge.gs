/**
 * 📂 ARQUIVO: 1_CORE/core_pdf_bridge.gs
 * 🔢 VERSÃO: 13.0 (UPGRADE: BRADESCO & INTER NATIVE)
 * 📅 DATA: 25/12/2025
 * * 📝 RESUMO DO MÓDULO:
 * Gerente de Orquestração (Mãe). Gerencia o fluxo brutos -> especialistas.
 * * 🔄 HISTÓRICO RECENTE:
 * - V12.1: Fix de Synthetic Rawline.
 * - V13.0 (ATUAL): 
 * > Injeção dos módulos especialistas BRADESCO e INTER.
 * > Correção da função callGemini para usar a chave correta e parsing seguro.
 */

// 🚫 BLACKLIST GLOBAL (Segurança Universal - Camada 1)
const GLOBAL_BLACKLIST = [
  "SALDO ANTERIOR", "SALDO DA FATURA ANTERIOR",
  "TOTAL DA FATURA", "AJUSTE SALDO RESTANTE", "SUBTOTAL DOS LANCAMENTOS",
  "SALDO RESTANTE DA FATURA", "PAGAMENTOS/CRÉDITOS", "SALDO FINANCIADO",
  "DESPESAS ATÉ A EMISSÃO", "PAGAMENTO DE FATURA", "PAGAMENTO DA FATURA",
  "PAGAMENTO EM", "PAGAMENTO RECEBIDO", "PAGAMENTO EFETUADO"
];

function corePdfPipeline(payload) {
  const functionName = "corePdfPipeline";
  Logger.log(`[START] ${functionName}: Iniciando Pipeline Híbrido (Regex > AI > Intelligence)...`, functionName);

  if (!payload || typeof payload !== 'object') payload = { raw: [] };
  if (!payload.raw) payload.raw = [];
  
  const folderId = PROJECT_CONFIG.FOLDER_ID_IMPORTS;
  const files = listImportFiles(folderId); 
  const mapaCartoes = carregarMapaCartoes();
  
  if (files.length === 0) {
    Logger.warn(`[WARN] Pasta vazia.`, functionName);
    return payload;
  }

  files.forEach((file) => {
    try {
      Logger.log(`[INFO] Processando arquivo: '${file.name}'...`, functionName);
      
      // 1. Extração do Texto (TXT Direto ou OCR via Google Docs)
      let rawText = "";
      if (file.mime === MimeType.PLAIN_TEXT) {
         rawText = DriveApp.getFileById(file.id).getBlob().getDataAsString();
      } else {
         rawText = convertPdfToText(file.id);
      }
      
      if (!rawText || rawText.length < 50) {
         Logger.warn(`[SKIP] Arquivo '${file.name}' vazio ou ilegível.`, functionName);
         return;
      }

      // 2. ROTEAMENTO DE ESPECIALISTAS 🧠 (Chama os Módulos Filhos)
      let extractedData = [];
      const fileNameUpper = file.name.toUpperCase();
      let bancoDetectado = "GENERICO";

      // --- MÓDULOS EXISTENTES ---
      if (fileNameUpper.includes("PICPAY")) {
          bancoDetectado = "PICPAY";
          if (typeof processModulePicPay === 'function') extractedData = processModulePicPay(rawText);
      } 
      else if (fileNameUpper.includes("XP")) {
          bancoDetectado = "XP";
          if (typeof processModuleXP === 'function') extractedData = processModuleXP(rawText);
      } 
      else if (fileNameUpper.includes("NUBANK") || fileNameUpper.includes("NU_")) {
          bancoDetectado = "NUBANK";
          if (typeof processModuleNubank === 'function') extractedData = processModuleNubank(rawText);
      } 
      // --- MÓDULOS NOVOS (INSERIDOS AQUI) ---
      else if (fileNameUpper.includes("BRADESCO")) {
          bancoDetectado = "BRADESCO";
          if (typeof processModuleBradesco === 'function') extractedData = processModuleBradesco(rawText);
          else Logger.warn("[WARN] Módulo Bradesco não encontrado!", functionName);
      }
      else if (fileNameUpper.includes("INTER") || fileNameUpper.includes("FATURA-INTER")) {
          bancoDetectado = "INTER";
          if (typeof processModuleInter === 'function') extractedData = processModuleInter(rawText);
          else Logger.warn("[WARN] Módulo Inter não encontrado!", functionName);
      }
      // --- FALLBACK GENÉRICO (IA) ---
      else {
          Logger.warn(`[WARN] Banco não reconhecido para '${file.name}'. Usando genérico (apenas IA).`, functionName);
          extractedData = processModuleGeneric(rawText);
      }

      // 3. PÓS-PROCESSAMENTO (Normalização e Enriquecimento)
      const contaArquivo = resolveAccountFromFileName(file.name);

      if (extractedData && extractedData.length > 0) {
        let itemsCount = 0;
        
         // 💳 PATCH DRE CASH BASIS V1.0:
         // Enriquece faturas de cartão com cashMonth/invoiceDueDate extraídos do PDF.
         // Não altera valor, descrição, ID, hash ou rawLine.
        if (typeof enrichCardInvoiceCashMetadata_ === "function") {
          extractedData = enrichCardInvoiceCashMetadata_(extractedData, rawText, file.name, bancoDetectado);
        }

        extractedData.forEach(item => {
          const descUpper = (item.descricao || "").toUpperCase();

          // Blacklist Check (Segurança Camada 2)
          const isLixo = GLOBAL_BLACKLIST.some(term => descUpper.includes(term));
          if (isLixo) return; 
          
          // Filtro Extra: Pagamentos positivos que escaparam da Blacklist
          if (descUpper.includes("PAGAMENTO") && item.valor > 0) return;

          // Mapping Cartão
          let contaFinal = contaArquivo; 
          if (item.cartao_final && item.cartao_final !== "MASTER" && item.cartao_final.length >= 4) {
             const finalLimpo = String(item.cartao_final).replace(/\D/g, "");
             if (mapaCartoes[finalLimpo]) { contaFinal = mapaCartoes[finalLimpo]; }
          }

          // 4. 🔥 INTELLIGENCE INJECTION 🔥
          let categoriaDetectada = "";
          if (typeof classifyTransaction === 'function') {
              categoriaDetectada = classifyTransaction(item.descricao, item.valor);
          }

          // 🛡️ SECURITY PATCH (V12.1): SYNTHETIC RAWLINE
          const syntheticRawLine = item.rawLine || `${item.data}|${item.descricao}|${item.valor}`;

          // 🧩 GFP 14.9.18.1 — preserva metadados gerados pelo parser/modulador
          // Ex.: cashMonth, vencimento_fatura, data_compra_original_texto,
          // data_compra_normalizada, regra_data_compra etc.
          const sourceMeta = (item._meta && typeof item._meta === "object") ? item._meta : {};

          payload.raw.push({
            data: item.data,
            desc: item.descricao,
            value: Math.abs(item.valor),
            type: item.valor < 0 ? "D" : "C", // Se vier negativo do parser, é despesa
            account: contaFinal,
            category: categoriaDetectada || "",
            installments: {
              current: parseInt(item.parcela_atual) || 1,
              total: parseInt(item.parcela_total) || 1,
              is_installment: (parseInt(item.parcela_total) || 1) > 1
            },
            rawLine: syntheticRawLine,
            _meta: Object.assign({}, sourceMeta, {
              fileId: file.id,
              fileName: file.name,
              origin: item._origin || `MOD_${bancoDetectado}`
            })
          });
          itemsCount++;


        });
        Logger.log(`[SUCCESS] ${itemsCount} itens importados de '${file.name}'.`, functionName);
      } else {
        Logger.warn(`[WARN] Módulo ${bancoDetectado} retornou 0 transações de '${file.name}'.`, functionName);
      }
    } catch (e) {
      Logger.error(`[ERROR] Falha em '${file.name}': ${e.message}`, functionName);
    }
  });
  // 🔥 AQUI É O LUGAR EXATO DA MÁGICA DIAMANTE:
  Logger.log(`[FINISH] Pipeline concluído. Acionando Ordenação Master...`);
  applyMasterSorting();
  
  return payload;
}

// === FERRAMENTA IA (FALLBACK) ===

/**
 * 🧠 FERRAMENTA IA: GEMINI ONE-SHOT (VERSÃO 2.0 - SNIPER)
 * 📝 RESUMO: Executa uma única chamada à API do Gemini. 
 * Sem loops, sem retries, sem esperas de 5 segundos. 
 * Se funcionar, ótimo. Se falhar (cota/erro), retorna vazio e segue o baile.
 */
function callGemini(prompt) {
  const functionName = "callGemini";
  
  // Recupera a chave de API segura
  const API_KEY = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!API_KEY) {
    Logger.error(`[${functionName}] ❌ Erro: Chave GEMINI_API_KEY não configurada.`);
    return [];
  }

  const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

  Logger.log(`[${functionName}] 🤖 Acionando Gemini (Tentativa Única)...`);

  try {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1, // Baixa criatividade = Mais precisão JSON
        maxOutputTokens: 2048
      }
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(MODEL_URL, options);
    const responseCode = response.getResponseCode();

    // Tratamento de Erros HTTP
    if (responseCode !== 200) {
      Logger.warn(`[${functionName}] ⚠️ Falha na API (Code ${responseCode}): ${response.getContentText()}`);
      return []; // Falhou? Retorna vazio e vida que segue.
    }

    // Parsing da Resposta
    const json = JSON.parse(response.getContentText());
    let txt = json.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!txt) {
      Logger.warn(`[${functionName}] ⚠️ API retornou 200 mas sem texto.`);
      return [];
    }

    // Limpeza Cirúrgica de Markdown (Remove ```json ... ```)
    txt = txt.replace(/```json/g, "").replace(/```/g, "").trim();

    // Tenta converter o texto limpo em Objeto JSON
    const parsedResult = JSON.parse(txt);
    
    Logger.log(`[${functionName}] ✅ Sucesso! IA retornou dados estruturados.`);
    return parsedResult;

  } catch (e) {
    // Erro de Parsing ou Conexão
    Logger.error(`[${functionName}] 🔥 Erro Crítico: ${e.message}`);
    return [];
  }
}

// === FUNÇÕES UTILITÁRIAS DE SUPORTE ===

function carregarMapaCartoes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("CFG_Cartoes");
  const mapa = {};
  if (!sh) return mapa;
  const dados = sh.getRange(2, 1, sh.getLastRow()-1, 2).getValues();
  dados.forEach(r => {
    const nome = r[0];
    const final = String(r[1]).trim();
    if (final && final.length >= 4) mapa[final] = nome; 
  });
  return mapa;
}

function resolveAccountFromFileName(fileName) {
  const name = fileName.toUpperCase();

  // --- REGRAS DE NÍVEL 1 (PADRÃO POR ARQUIVO) ---
  if (name.includes("NUBANK")) return "Nubank André"; 
  
  if (name.includes("PICPAY")) {
      if (name.includes("YAN")) return "PicPay Yan";
      return "PicPay André";
  }

  if (name.includes("XP")) return "XP André";

  if (name.includes("INTER")) {
      if (name.includes("YAN")) return "Inter Yan"; 
      return "Inter André"; // <--- Isso já estava no seu código e foi mantido
  }

  if (name.includes("MERCADO") || name.includes("MERCADOPAGO")) return "Mercado Pago André";

  // --- REGRAS PARA NOVOS BANCOS ---
  if (name.includes("BRADESCO")) return "Bradesco André";
  if (name.includes("SANTANDER")) return "Santander André";
  if (name.includes("ITAU") || name.includes("ITAÚ")) return "Itaú André";

  // Fallback Seguro
  return "Carteira Física"; 
}

function convertPdfToText(fileId) {
  const MAX_RETRIES = 3;
  for (let i = 0; i < MAX_RETRIES; i++) {
    let tempFileId;
    try {
      const resource = { title: "TEMP_" + Date.now(), mimeType: "application/vnd.google-apps.document" };
      const tempFile = Drive.Files.copy(resource, fileId, { convert: true });
      tempFileId = tempFile.id;
      Utilities.sleep(3500 * (i + 1)); 
      const doc = DocumentApp.openById(tempFileId);
      const text = doc.getBody().getText();
      Drive.Files.remove(tempFileId); 
      if (text && text.length > 50) return text;
    } catch (e) {
      if (tempFileId) { try { Drive.Files.remove(tempFileId); } catch(err) {} }
      if (e.message.includes("429")) Utilities.sleep(5000);
    }
  }
  return "";
}

function listImportFiles(folderId) {
  const out = [];
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  while (files.hasNext()) { 
    const f = files.next(); 
    const mime = f.getMimeType();
    if (mime === MimeType.PDF || mime === MimeType.PLAIN_TEXT) {
       out.push({id:f.getId(), name:f.getName(), mime: mime});
    }
  }
  return out;
}

// 🧠 GFP 15.9.2 — fallback legado do PDF Bridge.
// A função pública oficial `processModuleGeneric` fica em:
//   2_MOD/generico.gs
//
// Esta versão foi renomeada para evitar duplicidade global no Apps Script.
// Não é chamada no fluxo oficial, mas fica preservada temporariamente para
// referência até a limpeza final 16.0.
function processModuleGenericPdfBridgeFallback_15_9_2_(text) {
  const prompt = `
    EXTRAIA TRANSAÇÕES DESTE TEXTO:
    "${String(text || "").substring(0, 10000)}"

    RETORNE APENAS JSON ARRAY: [{"data":"DD/MM/YYYY", "descricao":"desc", "valor": 0.00}]
  `;

  return callGemini(prompt);
}
