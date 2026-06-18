/**
 * 📂 ARQUIVO: 4_MODULOS/mod_generic.gs
 * 🏦 MÓDULO GENÉRICO
 * 📝 RESUMO: Fallback para bancos sem módulo específico.
 */

function processModuleGeneric(textContext) {
  const prompt = `
    Analise o texto financeiro genérico e extraia transações em JSON.
    Formato Data: DD/MM/YYYY.
    Valor: Float (Negativo=Gasto).
    TEXTO: """${textContext.substring(0, 30000)}"""
  `;
  return callGemini(prompt);
}