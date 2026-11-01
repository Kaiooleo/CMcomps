// Cartas recomendadas por PvP (só cartas, sem Umas).
// Cada PvP tem uma ou mais sugestões de deck, uma por estilo ("Front Runner",
// "Pace Chaser"…); no seletor, a Uma só vê as do estilo dela. Cada sugestão tem
// 6 espaços; cada espaço tem o tipo e uma ou mais cartas (alternativas),
// pelo número da carta (o mesmo do link do uma.guide / GameTora).
// "note" (opcional) é um lembrete curto que aparece embaixo do espaço.
window.CM_RECS = {
  // Exemplo:
  // CM22: [
  //   {
  //     style: "Front Runner",
  //     slots: [
  //       { type: "Speed", cards: ["30107"] }, // Maruzensky
  //       { type: "Wit", cards: ["30010", "30097"] }, // Fine Motion / Mr. C.B.
  //       …
  //     ],
  //   },
  // ],
};
