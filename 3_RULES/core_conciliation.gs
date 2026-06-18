/**
 * 📂 ARQUIVO: 3_RULES/core_conciliation.gs
 * 🤝 MÓDULO: MOTOR DE CONCILIAÇÃO (AUTO-BAIXA)
 * 🔢 VERSÃO: 7.9 (MEMORY UPDATE)
 * 📅 DATA: 20/12/2025
 * -----------------------------------------------------------------------------
 * 🔄 HISTÓRICO DE VERSÕES:
 * - V1.1: Introdução do algoritmo de Fuzzy Match.
 * - V1.2: Adicionado Auto-Setup para criar a aba DB_MEMORIA.
 * - V1.3: Ajuste de colunas.
 * - V1.4 (ATUAL - DIAMOND STANDARD):
 * > SINCRONIZAÇÃO DE COLUNAS: Atualizado para garantir que o Auto-Setup crie
 * a aba 'DB_MEMORIA' com as exatas 10 colunas esperadas pelos módulos de entrada.
 * > ESTRUTURA: [ID, DATA, DESCRICAO, VALOR, CONTA, CATEGORIA, NOTA, STATUS, QUEM, METADADOS].
 * > LÓGICA DE MATCH: Refinada para tolerância de 4 dias e 5 centavos.
 * 📝 NOVIDADE V7.9:
 * Além de trazer a categoria para a transação oficial, este script agora vai até
 * a linha correspondente na DB_MEMORIA e muda o Status de "PENDENTE" para
 * "CONCILIADO". Isso permite criar Dashboards de "Contas a Pagar" que se limpam
 * sozinhos.
 * -----------------------------------------------------------------------------
 */

function runConciliationMatch(payload) {
  const functionName = "runConciliationMatch";
  Logger.log(`[${functionName}] 🏁 Iniciando rodada de conciliação...`);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetTransacoes = ss.getSheetByName("DB_TRANSACOES");
  const sheetMemoria = ss.getSheetByName("DB_MEMORIA");

  if (!sheetTransacoes || !sheetMemoria) {
    Logger.warn("Abas de dados não encontradas. Conciliação abortada.");
    return;
  }

  // 1. Carrega Dados da Memória (Só os PENDENTES)
  const lastRowMem = sheetMemoria.getLastRow();
  if (lastRowMem < 2) return;
  const dataMem = sheetMemoria.getRange(2, 1, lastRowMem - 1, 10).getValues();
  
  // Filtra candidatos válidos (Status = PENDENTE)
  const memoryCandidates = [];
  dataMem.forEach((row, index) => {
    if (row[7] === "PENDENTE") { // Coluna H (Index 7)
      memoryCandidates.push({
        rowIndex: index + 2, // Base 1 + Cabeçalho
        date: row[1],
        desc: row[2],
        val: row[3],
        account: row[4],
        category: row[5]
      });
    }
  });

  Logger.log(`[${functionName}] 🧠 Candidatos na Memória: ${memoryCandidates.length}`);
  if (memoryCandidates.length === 0) return;

  // 2. Carrega Transações Recentes (Para otimizar, pega as últimas 200)
  const lastRowTrans = sheetTransacoes.getLastRow();
  if (lastRowTrans < 2) return;
  
  // Pega tudo para garantir (ou ajuste range se ficar lento)
  const dataTrans = sheetTransacoes.getDataRange().getValues();
  
  let matchCount = 0;

  // 3. O Loop do Cupido (Match Maker)
  // Varre de baixo para cima (mais recentes)
  for (let i = dataTrans.length - 1; i >= 1; i--) {
    const tRow = dataTrans[i];
    
    // Pula se já estiver categorizado/conciliado
    if (tRow[5] && tRow[5] !== "" && tRow[8] === "OK") continue;

    const tDate = new Date(tRow[0]); // Col A
    const tVal = parseFloat(tRow[2]); // Col C
    const tAccount = String(tRow[4]); // Col E

    // Busca par na memória
    for (let m = 0; m < memoryCandidates.length; m++) {
      const mem = memoryCandidates[m];
      
      // CRITÉRIOS DE DIAMANTE 💎
      
      // A. CONTA (Crucial!)
      // A conta da memória deve estar contida na conta do extrato (ex: "Nubank" em "Nubank André")
      const isAccountMatch = tAccount.toLowerCase().includes(mem.account.toLowerCase()) || 
                             mem.account.toLowerCase().includes(tAccount.toLowerCase());
      if (!isAccountMatch) continue;

      // B. VALOR (Absoluto, pois extrato vem negativo)
      const diffVal = Math.abs(Math.abs(tVal) - Math.abs(mem.val));
      if (diffVal > 0.05) continue; // Tolerância de centavos

      // C. DATA (Janela de 4 dias)
      if (!(mem.date instanceof Date)) continue; // Segurança
      const diffDays = Math.abs((tDate - mem.date) / (1000 * 60 * 60 * 24));
      if (diffDays > 4) continue;

      // D. MATCH CONFIRMADO! 💘
      
      // Ação 1: Atualiza Transação Oficial
      sheetTransacoes.getRange(i + 1, 6).setValue(mem.category); // Col F: Categoria
      sheetTransacoes.getRange(i + 1, 9).setValue("OK");         // Col I: Status
      sheetTransacoes.getRange(i + 1, 10).setValue(mem.desc);    // Col J: Notas (Traz a desc original da memória)

      // Ação 2: Baixa na Memória (AQUI ESTÁ A MÁGICA)
      sheetMemoria.getRange(mem.rowIndex, 8).setValue("CONCILIADO"); // Col H: Status
      
      Logger.log(`[MATCH] Transação: "${tRow[1]}" conciliada com Memória: "${mem.desc}"`);
      
      // Remove do array de candidatos para não usar 2x
      memoryCandidates.splice(m, 1);
      matchCount++;
      break; 
    }
  }
  
  Logger.log(`[${functionName}] 🎉 Total de Matches: ${matchCount}`);
}