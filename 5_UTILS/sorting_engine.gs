/**
 * 📂 ARQUIVO: 4_INTERFACE/sorting_engine.gs
 * 🔢 VERSÃO: 14.0 (SMART SORT - SUGESTÕES PRIMEIRO)
 * 📅 DATA: 26/12/2025
 * 📝 RESUMO: Hierarquia de Gestão Eficiente:
 * 1. STATUS: Pendentes (Vazio) sobem.
 * 2. CATEGORIA: Preenchidas sobem (Descendente), Vazias descem.
 * 3. DATA: Recentes sobem.
 * 4. CONTA: Agrupamento A-Z.
 */

function applyMasterSorting() {
  const functionName = "applyMasterSorting";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('DB_TRANSACOES');
  
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // --- PASSO 1: O EXORCISTA DE DATAS ---
  const rangeData = sheet.getRange(2, 1, lastRow - 1, 1);
  const rawValues = rangeData.getValues();
  
  const cleanValues = rawValues.map(row => {
    let val = row[0];
    if (typeof val === 'string' && val.includes('/')) {
      try {
        const parts = val.split('/'); 
        return [new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))];
      } catch (e) { return [val]; }
    }
    return [val];
  });

  rangeData.setValues(cleanValues);
  rangeData.setNumberFormat('dd/mm/yyyy');

  // --- PASSO 2: A ORDENAÇÃO DE 4 CAMADAS ---
  const rangeTotal = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  
  rangeTotal.sort([
    // 1. STATUS: Ascendente (Vazios/Pendentes no Topo)
    {column: 9, ascending: false}, 
    
    // 2. CATEGORIA: Descendente (Texto ganha de Vazio -> Sugestões sobem)
    // Obs: Descendente coloca texto preenchido antes de célula vazia.
    {column: 6, ascending: false}, 
    
    // 3. DATA: Descendente (Mais recentes primeiro dentro do grupo)
    {column: 1, ascending: false}, 
    
    // 4. CONTA: Ascendente (Agrupamento visual)
    {column: 5, ascending: true}   
  ]);
  
  ss.toast("Ordem: Sugestões > Vazios > OK! 🧠", "Sistema André");
}