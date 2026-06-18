/**
 * 📂 ARQUIVO: 1_CORE/core_main.gs
 * ⚙️ MÓDULO: ORQUESTRADOR DE PIPELINE (CORRECTED ORDER)
 * 🔢 VERSÃO: 8.1 (ANTIDUP FIRST)
 * 📅 DATA: 24/12/2025
 * -----------------------------------------------------------------------------
 * 📝 CORREÇÃO CRÍTICA V8.1:
 * Inversão de ordem: O 'runAntiDupFilter' agora roda ANTES do 'coreIdPipeline'.
 * Isso garante que:
 * 1. Não gastamos processamento gerando IDs para itens que serão descartados.
 * 2. O 'coreIdPipeline' pode ler e usar o 'hash' gerado pelo AntiDup, garantindo
 * que ID e HASH sejam idênticos no banco de dados.
 * -----------------------------------------------------------------------------
 */

function pipelineExecute() {
  const functionName = "pipelineExecute";
  Logger.log(`--- 🚀 NOVA EXECUÇÃO DO PIPELINE ---`);
  Logger.log(`[${functionName}] [START] Pipeline Iniciado.`);

  try {
    let payload = { 
      raw: [], 
      context: { filesProcessed: [] },
      warnings: [],
      errors: [],
      meta: {},
      normalized: [] 
    };

    // 1. INGESTÃO A: IMPORTAÇÃO CSV
    if (typeof coreImportPipeline === 'function') {
       payload = coreImportPipeline(payload);
    }

    // 2. INGESTÃO B: IMPORTAÇÃO PDF
    if (typeof corePdfPipeline === 'function') {
       payload = corePdfPipeline(payload);
    }

    if (!payload.raw || payload.raw.length === 0) {
      Logger.log(`[${functionName}] [END] Nenhum dado novo encontrado.`);
      return;
    }

    // 3. NORMALIZAÇÃO
    if (typeof coreNormalizePipeline === 'function') {
       payload = coreNormalizePipeline(payload);
    }

    // 🚨 MUDANÇA DE ORDEM AQUI 🚨
    
    // 4. FILTRAGEM DE DUPLICATAS (PRIMEIRO O FILTRO!)
    // O AntiDup gera o Hash Oficial e remove o lixo.
    if (typeof runAntiDupFilter === 'function') {
       payload = runAntiDupFilter(payload);
    } else {
       if (typeof coreAntiDupEngine === 'function') payload = coreAntiDupEngine(payload);
    }

    // Verifica se sobrou algo
    if (!payload.normalized || payload.normalized.length === 0) {
      Logger.log(`[${functionName}] [END] Todos os itens eram duplicatas e foram filtrados.`);
      return;
    }

    // 5. GERAÇÃO DE IDs ÚNICOS (DEPOIS DO FILTRO!)
    // Agora ele pode usar o Hash do AntiDup como ID.
    if (typeof coreIdPipeline === 'function') {
       payload = coreIdPipeline(payload);
    }

    // 6. INTELIGÊNCIA & CLASSIFICAÇÃO
    if (typeof runClassificationPipeline === 'function') {
       payload = runClassificationPipeline(payload);
    }

    // 7. PERSISTÊNCIA
    if (typeof coreDatalakePersistence === 'function') {
       coreDatalakePersistence(payload);
    }

    // 8. CONCILIAÇÃO
    if (typeof runConciliationMatch === 'function') {
       runConciliationMatch(payload);
    }

    Logger.log(`[${functionName}] [SUCCESS] Pipeline finalizado com sucesso.`);

  } catch (e) {
    Logger.log(`[${functionName}] [CRITICAL] FATAL ERROR: ${e.message}`);
    Logger.log(e.stack);
    try { SpreadsheetApp.getActiveSpreadsheet().toast("❌ Erro Fatal. Verifique Logs.", "Erro"); } catch(e){}
  }
}