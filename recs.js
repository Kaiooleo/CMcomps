// Cartas recomendadas por PvP (só cartas, sem Umas).
// Cada PvP tem uma ou mais sugestões de deck (por estilo). Cada sugestão tem
// 6 espaços; cada espaço tem o tipo e uma ou mais cartas (alternativas),
// pelo número da carta (o mesmo do link do uma.guide / GameTora).
// "note" é um lembrete curto que aparece embaixo do espaço (ex.: "free").
window.CM_RECS = {
  CM22: [
    {
      style: "Front",
      slots: [
        { type: "Speed", cards: ["30107"] }, // Maruzensky
        { type: "Speed", cards: ["30028", "30101"] }, // Kitasan Black / Agnes Tachyon
        { type: "Speed", cards: ["30053"] }, // Taiki Shuttle
        { type: "Wit", cards: ["30066"], note: "free" }, // Mihono Bourbon
        { type: "Wit", cards: ["30010", "30097", "30111"] }, // Fine Motion / Mr. C.B. / Tokai Teio
        { type: "Pal", cards: ["30052"] }, // Light Hello
      ],
    },
  ],
};
