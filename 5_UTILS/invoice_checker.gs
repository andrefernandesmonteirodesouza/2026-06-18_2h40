/**
 * 📂 ARQUIVO: 5_UTILS/invoice_checker.gs
 * 🔢 VERSÃO: 2.0 (GORDELÍCIO - TOTALIZAÇÃO POR GRUPO & MMAA INPUT)
 * 📅 DATA: 26/12/2025
 * 📝 RESUMO: Conferência de faturas com agrupamento familiar (André + Yan)
 * e suporte a input ultra-rápido MMAA.
 */

function runInvoiceSummaryCheck() {
  const functionName = "runInvoiceSummaryCheck";
  const ui = SpreadsheetApp.getUi();
  
  Logger.log(`[${functionName}] Iniciando interface de conferência V2.0.`);

  // 1. SOLICITA O PERÍODO (PADRÃO MMAA)
  const response = ui.prompt(
    '📊 Conferência de Faturas',
    'Digite o período do VENCIMENTO (MMAA - Ex: 1225):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  let input = response.getResponseText().trim();
  
  // 🔥 TRATAMENTO MMAA -> MM/AAAA
  if (input.length === 4 && /^\d+$/.test(input)) {
    const mm = input.substring(0, 2);
    const aa = "20" + input.substring(2, 4);
    input = `${mm}/${aa}`;
  }

  if (!/^\d{2}\/\d{4}$/.test(input)) {
    ui.alert('❌ Erro: Formato inválido. Use MMAA (Ex: 1225).');
    return;
  }

  const [targetMonth, targetYear] = input.split('/');
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DB_TRANSACOES'); 
    
    if (!sheet) {
      ui.alert('❌ Erro: Aba DB_TRANSACOES não encontrada.');
      return;
    }

    const data = sheet.getDataRange().getValues();
    const summary = {}; // { "Inter André": 100, "Inter Yan": 50 }

    // 2. LOOP DE PROCESSAMENTO
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rawDate = row[0]; // Coluna A
      const valor = parseFloat(row[2]); // Coluna C
      const conta = row[4]; // Coluna E

      if (!rawDate || isNaN(valor)) continue;

      let dateObj = (rawDate instanceof Date) ? rawDate : new Date(rawDate);
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const year = dateObj.getFullYear().toString();

      if (month === targetMonth && year === targetYear) {
        summary[conta] = (summary[conta] || 0) + valor;
      }
    }

    // 3. LÓGICA DE AGRUPAMENTO (ANDRÉ + YAN)
    const accounts = Object.keys(summary).sort();
    if (accounts.length === 0) {
      ui.alert(`ℹ️ Nenhum lançamento para ${input}.`);
      return;
    }

    let message = `📝 RESUMO DE FATURAS - VENCIMENTO ${input}\n\n`;
    let totalGeral = 0;
    const totalsByGroup = { "INTER": 0, "PICPAY": 0 };
    const processedGroups = new Set();

    // Função interna para formatar moeda
    const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    accounts.forEach(acc => {
      const val = summary[acc];
      totalGeral += val;
      message += `🔹 ${acc}: ${fmt(val)}\n`;

      // Acumula para os grupos Inter e PicPay
      if (acc.toUpperCase().includes("INTER")) totalsByGroup["INTER"] += val;
      if (acc.toUpperCase().includes("PICPAY")) totalsByGroup["PICPAY"] += val;
    });

    // 4. INJEÇÃO DE TOTALIZADORES DE GRUPO
    let subtotalMsg = "";
    if (totalsByGroup["INTER"] !== 0) {
      subtotalMsg += `\n🔸 TOTAL INTER (André+Yan): ${fmt(totalsByGroup["INTER"])}`;
    }
    if (totalsByGroup["PICPAY"] !== 0) {
      subtotalMsg += `\n🔸 TOTAL PICPAY (André+Yan): ${fmt(totalsByGroup["PICPAY"])}`;
    }

    if (subtotalMsg) {
      message += `\n--- TOTALIZADORES POR GRUPO ---${subtotalMsg}\n`;
    }

    message += `\n------------------------------------------\n`;
    message += `💰 TOTAL LÍQUIDO GERAL: ${fmt(totalGeral)}\n\n`;
    message += `💡 Verifique se os totais batem com o PDF.`;

    ui.alert(message);

  } catch (error) {
    Logger.error(`[${functionName}] Erro: ${error.message}`);
    ui.alert(`🔥 Erro: ${error.message}`);
  }
}