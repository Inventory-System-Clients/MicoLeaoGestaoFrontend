// RoteiroItem.maquinasConcluidas guarda { maquinaId, movimentacaoId } por
// máquina concluída, para saber exatamente qual movimentação resultou daquela
// conclusão (importante quando a mesma máquina aparece mais de uma vez no
// roteiro — pegar "a última movimentação da máquina" pegaria a errada).
// Registros antigos (de antes dessa mudança) podem ainda ser só o id em
// texto, por isso os dois formatos são aceitos aqui.
export const obterEntradaMaquinaConcluida = (item, maquinaId) => {
  const lista = Array.isArray(item?.maquinasConcluidas)
    ? item.maquinasConcluidas
    : [];
  const entrada = lista.find((registro) =>
    typeof registro === "string"
      ? registro === String(maquinaId)
      : String(registro?.maquinaId) === String(maquinaId),
  );
  if (!entrada) return { concluida: false, movimentacaoId: null };
  return {
    concluida: true,
    movimentacaoId:
      typeof entrada === "string" ? null : entrada.movimentacaoId || null,
  };
};
