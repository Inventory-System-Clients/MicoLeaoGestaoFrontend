import React, { useState, useEffect } from "react";
import api from "../services/api";

// Componente para avisar máquinas sem movimentação nas últimas 12h de uma loja
export default function AvisosMaquinasFaltam({ lojas }) {
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [maquinas, setMaquinas] = useState([]);
  const [maquinasSemMov, setMaquinasSemMov] = useState([]);
  const [loading, setLoading] = useState(false);
  const [maquinasComMov, setMaquinasComMov] = useState(new Set());

  useEffect(() => {
    if (!lojaSelecionada) {
      setMaquinas([]);
      setMaquinasSemMov([]);
      return;
    }
    setLoading(true);
    // Buscar máquinas da loja selecionada
    api
      .get(`/maquinas?lojaId=${lojaSelecionada}`)
      .then((res) => {
        setMaquinas(res.data || []);
        return res.data || [];
      })
      .then(async (maqs) => {
        // Buscar movimentações das últimas 12h
        const desde = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const movRes = await api.get(
          `/movimentacoes?lojaId=${lojaSelecionada}&desde=${desde.toISOString()}`
        );
        const movimentacoes = movRes.data || [];
        // Mapear máquinas que tiveram movimentação nas últimas 12h (garantindo data)
        const maquinasComMovSet = new Set();
        movimentacoes.forEach((m) => {
          // Use o campo correto de data, ex: createdAt, data, dataMovimentacao
          const dataMov = new Date(m.createdAt || m.data || m.dataMovimentacao);
          if (!isNaN(dataMov) && dataMov >= desde) {
            maquinasComMovSet.add(m.maquinaId);
          }
        });
        setMaquinasComMov(maquinasComMovSet);
        // Filtrar máquinas sem movimentação, exceto se nome começa com 'Poltrona'
        const semMov = maqs.filter(
          (m) =>
            !maquinasComMovSet.has(m.id) &&
            !(
              typeof m.nome === "string" &&
              m.nome.trim().toLowerCase().startsWith("poltrona")
            )
        );
        setMaquinasSemMov(semMov);
      })
      .catch(() => {
        setMaquinas([]);
        setMaquinasSemMov([]);
      })
      .finally(() => setLoading(false));
  }, [lojaSelecionada]);

  return (
    <div className="card p-4 mb-4">
      <h2 className="text-lg font-bold mb-2">
        Aviso de Máquinas sem Movimentação
      </h2>
      <label className="block mb-2 font-semibold">Escolha a loja:</label>
      <select
        className="input-field mb-4"
        value={lojaSelecionada}
        onChange={(e) => setLojaSelecionada(e.target.value)}
      >
        <option value="">Nenhuma</option>
        {(lojas || []).map((loja) => (
          <option key={loja.id} value={loja.id}>
            {loja.nome}
          </option>
        ))}
      </select>
      {loading && <div>Carregando...</div>}
      {lojaSelecionada && !loading && (
        <>
          {/* Aviso logo abaixo do select */}
          {maquinas.length > 0 && maquinasSemMov.length === 0 ? (
            <div className="bg-green-100 border-l-4 border-green-600 p-3 mb-4 font-bold text-green-800 text-lg">
              ✅ Todas as máquinas tiveram movimentação nas últimas 12 horas.
            </div>
          ) : maquinasSemMov.length > 0 ? (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3 mb-2">
              <strong>Atenção:</strong> As máquinas abaixo não tiveram
              movimentação nas últimas 12 horas:
              <ul className="mt-2">
                {maquinasSemMov.map((m) => (
                  <li key={m.id} className="text-red-600 font-bold">
                    {m.nome}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <h3 className="font-semibold mb-2">Máquinas da loja:</h3>
          <ul className="mb-4">
            {maquinas.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span>{m.nome}</span>
                {maquinasComMov.has(m.id) && (
                  <span
                    className="text-green-600 font-bold"
                    title="Teve movimentação nas últimas 12h"
                  >
                    ✔️
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
