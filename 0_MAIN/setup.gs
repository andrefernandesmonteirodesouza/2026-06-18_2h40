/**
 * 📂 ARQUIVO: 0_MAIN/setup.gs
 * ⚙️ MÓDULO: CONFIGURAÇÃO GLOBAL & INSTALAÇÃO
 * 🔢 VERSÃO: 2.0 (ENVIRONMENT SETUP)
 * 📅 DATA: 18/12/2025
 * -----------------------------------------------------------------------------
 * 📝 RESUMO:
 * Define as constantes globais (PROJECT_CONFIG) e a função de instalação
 * que cria as abas necessárias (SYS_LOGS, DB_TRANSACOES, etc.) se não existirem.
 * É a "Fundação" sobre a qual o sistema é construído.
 * -----------------------------------------------------------------------------
 */

const PROJECT_CONFIG = {
  APP_NAME: "GFP 1.0 - Gestão Financeira Pessoal",
  VERSION: "1.0.0-Gold",
  LOG_SHEET_NAME: "SYS_LOGS",
  DATA_SHEET_NAME: "DB_TRANSACOES",   // Nome da aba Datalake
  PLANO_CONTAS_SHEET_NAME: "CFG_Categorias",
  FOLDER_ID_IMPORTS: "17a0Q-pn-Q-rRJbUfI0zz72bDAo1bUmtc", // ⚠️ SEU ID AQUI
  TIMEZONE: "America/Sao_Paulo"
};

/**
 * Função de Setup Inicial
 * Cria as abas necessárias se não existirem e configura triggers.
 * Execute manualmente uma vez (rodando 'installProject' no menu Run).
 */
function installProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const functionName = "installProject";
  
  if (typeof Logger === 'undefined') {
    console.error("Logger não está definido! Verifique 2_UTILS/logger.gs.");
    ui.alert("ERRO CRÍTICO", "O Logger não foi encontrado. O setup falhou. Cole o código no 2_UTILS/logger.gs primeiro.", ui.ButtonSet.OK);
    return;
  }
  
  Logger.log(`[START] ${functionName}: Iniciando instalação do ${PROJECT_CONFIG.APP_NAME}...`, functionName);

  try {
    // 1. Verificar/Criar Aba de Logs (SYS_LOGS)
    let logSheet = ss.getSheetByName(PROJECT_CONFIG.LOG_SHEET_NAME);
    if (!logSheet) {
      logSheet = ss.insertSheet(PROJECT_CONFIG.LOG_SHEET_NAME);
      logSheet.appendRow(["Timestamp", "Level", "Function", "Message", "Stack Trace"]);
      logSheet.setFrozenRows(1);
      logSheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#e6e6e6");
    }

    // 2. Verificar/Criar Aba de Dados (DB_TRANSACOES) - Datalake
    let dataSheet = ss.getSheetByName(PROJECT_CONFIG.DATA_SHEET_NAME);
    if (!dataSheet) {
      dataSheet = ss.insertSheet(PROJECT_CONFIG.DATA_SHEET_NAME);
      // Header Final do Datalake
      dataSheet.appendRow([
        "DATA", "DESCRICAO", "VALOR", "TIPO", 
        "CONTA", "CATEGORIA", "ID_UNICO", "ID_ARQUIVO", "HASH_LINHA"
      ]);
      dataSheet.setFrozenRows(1);
    }
    
    // 3. Verificar/Criar Aba de Plano de Contas (CFG_Plano_Contas)
    let planoContasSheet = ss.getSheetByName(PROJECT_CONFIG.PLANO_CONTAS_SHEET_NAME);
    if (!planoContasSheet) {
        planoContasSheet = ss.insertSheet(PROJECT_CONFIG.PLANO_CONTAS_SHEET_NAME);
        planoContasSheet.appendRow(["Grupo", "Subgrupo", "Detalhe", "Código", "Tipo", "Categoria Completa"]);
        planoContasSheet.setFrozenRows(1);
    }

    ui.alert("Instalação Concluída", "O ambiente foi configurado com sucesso. Verifique a aba SYS_LOGS.", ui.ButtonSet.OK);

  } catch (error) {
    Logger.critical(`[CRITICAL] ${functionName}: Falha na instalação.`, functionName, error);
    throw new Error(`Erro fatal no setup: ${error.message}`);
    
  } finally {
    Logger.log(`[END] ${functionName}: Instalação finalizada.`, functionName);
  }
}
