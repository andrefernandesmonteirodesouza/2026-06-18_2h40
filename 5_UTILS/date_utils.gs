/**
 * 🛠️ UTILITÁRIO GORDELÍCIO: Captura a data master injetada pelo Extrator Master Python.
 * Varre as primeiras 10 linhas buscando a tag oficial.
 */
function extractVencimentoMaster(lines) {
  for (let i = 0; i < 10; i++) {
    if (lines[i] && lines[i].includes("VENCIMENTO_MASTER:")) {
      const parts = lines[i].split(":");
      if (parts.length > 1) {
        const dt = parts[1].trim();
        if (dt.match(/^\d{4}-\d{2}-\d{2}$/)) return dt;
      }
    }
  }
  return null; // Força o Fallback do módulo a agir
}