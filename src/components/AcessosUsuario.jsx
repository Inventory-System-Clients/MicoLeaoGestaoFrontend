import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

const PERFIS_ACESSO_TOTAL = ["ADMIN", "DESENVOLVEDOR"];

// Lista de ações do sistema com caixinhas. Marcado = a pessoa pode.
// O padrão vem do perfil; o que for mudado vira ajuste do usuário:
//   ajustes = { adicionadas: [chaves dadas a mais], removidas: [chaves tiradas],
//               limites: { chave: { dias: 3, somenteProprias: true } } }
// Ações com `limites` no catálogo mostram as opções de limite quando marcadas.
export function AcessosUsuario({ role, ajustes, onChange }) {
  const [catalogo, setCatalogo] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    api
      .get("/permissoes/catalogo")
      .then(({ data }) => setCatalogo(data))
      .catch(() => setErro("Não foi possível carregar a lista de acessos."));
  }, []);

  const padrao = useMemo(
    () => new Set(catalogo?.padroes?.[role] || []),
    [catalogo, role],
  );
  const adicionadas = useMemo(() => new Set(ajustes.adicionadas), [ajustes]);
  const removidas = useMemo(() => new Set(ajustes.removidas), [ajustes]);

  const acoesPorChave = useMemo(
    () =>
      new Map(
        (catalogo?.areas || []).flatMap((area) =>
          area.acoes.map((acao) => [acao.chave, acao]),
        ),
      ),
    [catalogo],
  );

  if (PERFIS_ACESSO_TOTAL.includes(role)) {
    return (
      <p className="text-sm text-gray-600">
        Administrador e Desenvolvedor têm acesso total — não há o que ajustar.
      </p>
    );
  }
  if (erro) return <p className="text-sm text-red-600">{erro}</p>;
  if (!catalogo) return <p className="text-sm text-gray-500">Carregando acessos...</p>;

  const liberada = (chave) =>
    (padrao.has(chave) && !removidas.has(chave)) || adicionadas.has(chave);

  // Liga/desliga a ação; ao ligar, liga junto o que ela precisa (requer)
  const alternar = (chave) => {
    const novasAdicionadas = new Set(adicionadas);
    const novasRemovidas = new Set(removidas);

    const ligar = (alvo) => {
      if (liberadaCom(alvo, novasAdicionadas, novasRemovidas)) return;
      if (padrao.has(alvo)) novasRemovidas.delete(alvo);
      else novasAdicionadas.add(alvo);
      (acoesPorChave.get(alvo)?.requer || []).forEach(ligar);
    };
    const desligar = (alvo) => {
      if (padrao.has(alvo)) novasRemovidas.add(alvo);
      else novasAdicionadas.delete(alvo);
    };

    if (liberada(chave)) desligar(chave);
    else ligar(chave);

    onChange({
      ...ajustes,
      adicionadas: [...novasAdicionadas],
      removidas: [...novasRemovidas],
    });
  };

  // Limites ajustados neste usuário. Ação sem ajuste usa o limite padrão
  // (que vale para todos menos Admin); ajuste vazio ({}) = sem limite.
  const limitesAtuais = ajustes.limites || {};
  const limitesPadrao = catalogo.limitesPadrao || {};
  const temAjusteDeLimite = (chave) =>
    Object.prototype.hasOwnProperty.call(limitesAtuais, chave);
  const limiteEfetivo = (chave) =>
    temAjusteDeLimite(chave) ? limitesAtuais[chave] : limitesPadrao[chave] || {};
  const mesmoLimite = (a, b) =>
    JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

  // valor undefined/false/vazio tira o limite
  const alterarLimite = (chave, limite, valor) => {
    const daAcao = { ...limiteEfetivo(chave) };
    if (valor === undefined || valor === false || valor === "") delete daAcao[limite];
    else daAcao[limite] = valor;

    const novos = { ...limitesAtuais };
    // Voltou a ser igual ao padrão: não precisa guardar ajuste
    if (mesmoLimite(daAcao, limitesPadrao[chave] || {})) delete novos[chave];
    else novos[chave] = daAcao;
    onChange({ ...ajustes, limites: novos });
  };

  const totalLimites = Object.keys(limitesAtuais).length;

  const liberadaCom = (chave, adds, rems) =>
    (padrao.has(chave) && !rems.has(chave)) || adds.has(chave);

  const voltarAoPadrao = () =>
    onChange({ adicionadas: [], removidas: [], limites: {} });

  const termo = busca.trim().toLowerCase();
  const areas = catalogo.areas
    .map((area) => ({
      ...area,
      acoes: area.acoes.filter(
        (acao) =>
          !acao.somenteAdmin &&
          (!termo ||
            acao.nome.toLowerCase().includes(termo) ||
            area.nome.toLowerCase().includes(termo)),
      ),
    }))
    .filter((area) => area.acoes.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Marcado = pode usar. Vem marcado o padrão do perfil; o que você mudar
          vale só para este usuário.
          {(adicionadas.size > 0 || removidas.size > 0 || totalLimites > 0) && (
            <span className="ml-1 font-semibold text-gray-800">
              {adicionadas.size} dado(s) a mais · {removidas.size} tirado(s) ·{" "}
              {totalLimites} com limite
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={voltarAoPadrao}
          disabled={
            adicionadas.size === 0 && removidas.size === 0 && totalLimites === 0
          }
          className="text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:text-gray-400"
        >
          Voltar ao padrão do perfil
        </button>
      </div>

      <input
        type="search"
        className="input-field"
        placeholder="Buscar acesso (ex.: dinheiro, roteiro, excluir)"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <div className="space-y-2">
        {areas.map((area) => {
          const total = area.acoes.length;
          const marcadas = area.acoes.filter((acao) => liberada(acao.chave)).length;
          const mudadas = area.acoes.filter(
            (acao) =>
              adicionadas.has(acao.chave) ||
              removidas.has(acao.chave) ||
              limitesAtuais[acao.chave],
          ).length;
          return (
            <details
              key={area.area}
              open={Boolean(termo) || undefined}
              className="rounded-lg border border-gray-200 bg-white"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm">
                <span className="font-semibold text-gray-800">{area.nome}</span>
                <span className="text-gray-500">
                  {marcadas} de {total}
                  {mudadas > 0 && (
                    <span className="ml-2 font-semibold text-orange-600">
                      {mudadas} ajuste(s)
                    </span>
                  )}
                </span>
              </summary>
              <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {area.acoes.map((acao) => (
                  <li key={acao.chave}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={liberada(acao.chave)}
                        onChange={() => alternar(acao.chave)}
                      />
                      <span className="flex-1 text-gray-800">{acao.nome}</span>
                      {adicionadas.has(acao.chave) && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                          dado a mais
                        </span>
                      )}
                      {removidas.has(acao.chave) && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                          tirado
                        </span>
                      )}
                      {!adicionadas.has(acao.chave) &&
                        !removidas.has(acao.chave) &&
                        padrao.has(acao.chave) && (
                          <span className="text-xs text-gray-400">padrão</span>
                        )}
                    </label>
                    {liberada(acao.chave) && acao.limites?.length > 0 && (
                      <div className="flex flex-col gap-2 bg-gray-50 px-4 py-2 pl-10 text-sm">
                        <span className="text-xs font-semibold uppercase text-gray-500">
                          Limites (vazio = sem limite)
                          {temAjusteDeLimite(acao.chave) ? (
                            <span className="ml-2 normal-case text-orange-600">
                              ajustado para este usuário
                            </span>
                          ) : (
                            limitesPadrao[acao.chave] && (
                              <span className="ml-2 normal-case text-gray-400">
                                padrão
                              </span>
                            )
                          )}
                        </span>
                        {acao.limites.map((limite) => {
                          const valor = limiteEfetivo(acao.chave)[limite.chave];
                          if (limite.tipo === "dias") {
                            return (
                              <label
                                key={limite.chave}
                                className="flex flex-wrap items-center gap-2 text-gray-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={Boolean(valor)}
                                  onChange={(e) =>
                                    alterarLimite(
                                      acao.chave,
                                      limite.chave,
                                      e.target.checked ? 3 : undefined,
                                    )
                                  }
                                />
                                Só dos últimos
                                <input
                                  type="number"
                                  min="1"
                                  max="3650"
                                  className="input-field w-20 py-1"
                                  value={valor || ""}
                                  disabled={!valor}
                                  onChange={(e) =>
                                    alterarLimite(
                                      acao.chave,
                                      limite.chave,
                                      Math.max(1, parseInt(e.target.value, 10) || 1),
                                    )
                                  }
                                />
                                dias
                              </label>
                            );
                          }
                          return (
                            <label
                              key={limite.chave}
                              className="flex items-center gap-2 text-gray-700"
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(valor)}
                                onChange={(e) =>
                                  alterarLimite(acao.chave, limite.chave, e.target.checked)
                                }
                              />
                              {limite.nome}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

export default AcessosUsuario;
