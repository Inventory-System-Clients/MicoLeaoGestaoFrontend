import { useEffect, useState } from "react";
import api from "../services/api";
import { aviso } from "../utils/alerts";
import { enviarImagemParaCloudinary } from "../utils/cloudinary";

const RegistrarDinheiro = ({ lojas, maquinas, usuarios, onSubmit }) => {
  const obterMesAnteriorPadrao = () => {
    const hoje = new Date();
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const ano = mesAnterior.getFullYear();
    const mes = String(mesAnterior.getMonth() + 1).padStart(2, "0");

    return `${ano}-${mes}`;
  };

  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [maquinaSelecionada, setMaquinaSelecionada] = useState("");
  const [registrarTotalLoja, setRegistrarTotalLoja] = useState(false);
  const [mesReferencia, setMesReferencia] = useState(obterMesAnteriorPadrao);
  const [valorDinheiro, setValorDinheiro] = useState("");
  const [valorCartaoPix, setValorCartaoPix] = useState("");
  const [valorBlink, setValorBlink] = useState("");
  const [percentualTaxaCartaoMedia, setPercentualTaxaCartaoMedia] =
    useState("");
  const [observacoes, setObservacoes] = useState("");
  const [gastosVariaveis, setGastosVariaveis] = useState([]);
  const [conferidoPorId, setConferidoPorId] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);
  const [valorEsperado, setValorEsperado] = useState(null);
  const [carregandoEsperado, setCarregandoEsperado] = useState(false);

  const obterPeriodoDoMes = (valorMes) => {
    if (!valorMes) return null;

    const [anoTexto, mesTexto] = valorMes.split("-");
    const ano = Number(anoTexto);
    const mes = Number(mesTexto);

    if (
      !Number.isInteger(ano) ||
      !Number.isInteger(mes) ||
      mes < 1 ||
      mes > 12
    ) {
      return null;
    }

    const inicio = new Date(ano, mes - 1, 1, 0, 0, 0);
    const fim = new Date(ano, mes, 0, 23, 59, 59);

    const formatarDataHoraLocal = (data) => {
      const pad = (numero) => String(numero).padStart(2, "0");

      return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}:${pad(data.getSeconds())}`;
    };

    return {
      inicio: formatarDataHoraLocal(inicio),
      fim: formatarDataHoraLocal(fim),
    };
  };

  const parseLocaleNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    // Aceita formatos como 10,50 e 1.234,56 sem quebrar o parse no backend.
    const normalized = raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw;
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleAddGasto = () => {
    setGastosVariaveis([
      ...gastosVariaveis,
      { nome: "", valor: "", observacao: "" },
    ]);
  };

  const handleRemoveGasto = (idx) => {
    setGastosVariaveis(gastosVariaveis.filter((_, i) => i !== idx));
  };

  const handleChangeGasto = (idx, field, value) => {
    setGastosVariaveis(
      gastosVariaveis.map((g, i) => (i === idx ? { ...g, [field]: value } : g)),
    );
  };

  const handleLojaChange = (e) => {
    setLojaSelecionada(e.target.value);
    setMaquinaSelecionada("");
  };

  const handleSelecionarComprovante = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    try {
      setEnviandoComprovante(true);
      const url = await enviarImagemParaCloudinary(arquivo);
      setComprovanteUrl(url);
    } catch {
      aviso("Erro no upload", "Não foi possível enviar a foto. Tente novamente.");
    } finally {
      setEnviandoComprovante(false);
      e.target.value = "";
    }
  };

  // Busca o valor esperado pelo sistema (fichas x valor da ficha) assim que
  // loja/máquina/período estiverem preenchidos, pra já mostrar a divergência
  // em tempo real enquanto a pessoa conta o dinheiro.
  useEffect(() => {
    const periodoSelecionado = obterPeriodoDoMes(mesReferencia);

    if (
      !lojaSelecionada ||
      !periodoSelecionado ||
      (!registrarTotalLoja && !maquinaSelecionada)
    ) {
      setValorEsperado(null);
      return undefined;
    }

    let cancelado = false;
    setCarregandoEsperado(true);

    api
      .get("/registro-dinheiro/valor-esperado", {
        params: {
          lojaId: lojaSelecionada,
          maquinaId: registrarTotalLoja ? undefined : maquinaSelecionada,
          registrarTotalLoja,
          inicio: periodoSelecionado.inicio,
          fim: periodoSelecionado.fim,
        },
      })
      .then((response) => {
        if (!cancelado) {
          setValorEsperado(response.data?.valorEsperadoSistema ?? 0);
        }
      })
      .catch(() => {
        if (!cancelado) setValorEsperado(null);
      })
      .finally(() => {
        if (!cancelado) setCarregandoEsperado(false);
      });

    return () => {
      cancelado = true;
    };
  }, [lojaSelecionada, maquinaSelecionada, registrarTotalLoja, mesReferencia]);

  const valorContadoTotal =
    (parseLocaleNumber(valorDinheiro) || 0) +
    (parseLocaleNumber(valorCartaoPix) || 0) +
    (parseLocaleNumber(valorBlink) || 0);

  const diferenca =
    valorEsperado !== null ? Number((valorContadoTotal - valorEsperado).toFixed(2)) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const periodoSelecionado = obterPeriodoDoMes(mesReferencia);

    // Garantir que campos obrigatórios estejam preenchidos corretamente
    if (!lojaSelecionada || !periodoSelecionado) {
      aviso("Campos obrigatórios", "Preencha loja e mês de fechamento.");
      return;
    }

    if (enviandoComprovante) {
      aviso("Aguarde", "A foto ainda está sendo enviada.");
      return;
    }

    const dinheiroNumero = parseLocaleNumber(valorDinheiro);
    const cartaoPixNumero = parseLocaleNumber(valorCartaoPix);
    const blinkNumero = parseLocaleNumber(valorBlink);
    const taxaMediaNumero = parseLocaleNumber(percentualTaxaCartaoMedia);

    if (valorDinheiro !== "" && dinheiroNumero === null) {
      aviso("Valor inválido", "Valor de dinheiro inválido.");
      return;
    }

    if (valorCartaoPix !== "" && cartaoPixNumero === null) {
      aviso("Valor inválido", "Valor de cartão/pix inválido.");
      return;
    }

    if (valorBlink !== "" && blinkNumero === null) {
      aviso("Valor inválido", "Valor do Blink inválido.");
      return;
    }

    if (percentualTaxaCartaoMedia !== "" && taxaMediaNumero === null) {
      aviso("Taxa inválida", "Taxa média de cartão inválida.");
      return;
    }

    const gastosNormalizados = registrarTotalLoja
      ? gastosVariaveis.map((gasto) => ({
          ...gasto,
          valor: parseLocaleNumber(gasto.valor),
        }))
      : [];

    if (gastosNormalizados.some((gasto) => gasto.valor === null)) {
      aviso("Gastos inválidos", "Preencha os valores dos gastos variáveis corretamente.");
      return;
    }

    await onSubmit({
      loja: lojaSelecionada,
      maquina: registrarTotalLoja ? null : maquinaSelecionada || null,
      registrarTotalLoja,
      inicio: periodoSelecionado.inicio,
      fim: periodoSelecionado.fim,
      valorDinheiro: dinheiroNumero,
      valorCartaoPix: cartaoPixNumero,
      valorBlink: blinkNumero,
      percentualTaxaCartaoMedia: taxaMediaNumero,
      observacoes: observacoes === "" ? null : observacoes,
      conferidoPorId: conferidoPorId || null,
      comprovanteUrl: comprovanteUrl.trim() === "" ? null : comprovanteUrl.trim(),
      gastosVariaveis: gastosNormalizados,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Loja e máquina */}
      <div className="rounded-lg border border-orange-100 bg-orange-50/70 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-orange-800">
          <span className="text-lg">🏪</span> Loja e máquina
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700">
              Loja
            </label>
            <select
              value={lojaSelecionada}
              onChange={handleLojaChange}
              required
              className="select-field"
            >
              <option value="">Selecione a loja</option>
              {lojas &&
                lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700">
              🎮 Máquina
            </label>
            <select
              value={maquinaSelecionada}
              onChange={(e) => setMaquinaSelecionada(e.target.value)}
              disabled={registrarTotalLoja}
              className="select-field disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Selecione a máquina</option>
              {maquinas &&
                (() => {
                  // Encontrar a loja selecionada pelo id
                  const lojaObj = lojas?.find((l) => l.id === lojaSelecionada);
                  // Se for Agarramais Aeroporto, mostrar todas as máquinas da loja
                  if (
                    lojaObj &&
                    lojaObj.nome &&
                    lojaObj.nome.trim().toLowerCase().includes("aeroporto")
                  ) {
                    return maquinas
                      .filter((m) => m.lojaId === lojaSelecionada)
                      .map((maquina) => (
                        <option key={maquina.id} value={maquina.id}>
                          {maquina.nome}
                        </option>
                      ));
                  } else {
                    // Lógica padrão: só takeball e poltrona
                    return maquinas
                      .filter(
                        (m) =>
                          m.lojaId === lojaSelecionada &&
                          ((typeof m.nome === "string" &&
                            m.nome.trim().toUpperCase().endsWith("TAKEBALL")) ||
                            (typeof m.nome === "string" &&
                              m.nome.toLowerCase().includes("poltrona"))),
                      )
                      .map((maquina) => (
                        <option key={maquina.id} value={maquina.id}>
                          {maquina.nome}
                        </option>
                      ));
                  }
                })()}
            </select>
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={registrarTotalLoja}
            onChange={(e) => setRegistrarTotalLoja(e.target.checked)}
          />
          Registrar valor total da loja (não selecionar máquina)
        </label>
      </div>

      {/* Gastos Variáveis - só aparece se registrarTotalLoja estiver marcado */}
      {registrarTotalLoja && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-amber-800">
              <span className="text-lg">🧾</span> Gastos Variáveis
            </h3>
            <button
              type="button"
              onClick={handleAddGasto}
              className="btn-secondary px-4 py-2 text-xs"
            >
              + Adicionar Gasto
            </button>
          </div>
          {gastosVariaveis.length === 0 && (
            <p className="mb-2 text-sm text-gray-600">
              Nenhum gasto adicionado.
            </p>
          )}
          <div className="space-y-3">
            {gastosVariaveis.map((gasto, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-2 rounded-lg border border-amber-100 bg-white p-2 sm:grid-cols-[2fr_1fr_2fr_auto]"
              >
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-600">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={gasto.nome}
                    onChange={(e) =>
                      handleChangeGasto(idx, "nome", e.target.value)
                    }
                    required
                    placeholder="Ex: Energia, Limpeza..."
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-600">
                    Valor (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={gasto.valor}
                    onChange={(e) =>
                      handleChangeGasto(idx, "valor", e.target.value)
                    }
                    required
                    placeholder="0,00"
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-600">
                    Observação
                  </label>
                  <input
                    type="text"
                    value={gasto.observacao}
                    onChange={(e) =>
                      handleChangeGasto(idx, "observacao", e.target.value)
                    }
                    placeholder="Opcional"
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-orange-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveGasto(idx)}
                    className="btn-danger px-3 py-1.5 text-xs"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Período */}
      <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-blue-800">
          <span className="text-lg">📅</span> Fechamento
        </h3>
        <div className="max-w-xs">
          <label className="mb-1 block text-sm font-bold text-gray-700">
            Mês
          </label>
          <input
            type="month"
            value={mesReferencia}
            onChange={(e) => setMesReferencia(e.target.value)}
            required
            className="input-field"
          />
        </div>
      </div>

      {/* Valores contados */}
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-800">
          <span className="text-lg">💰</span> Valores contados
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {!registrarTotalLoja && (
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-700">
                💵 Dinheiro
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={valorDinheiro}
                onChange={(e) => setValorDinheiro(e.target.value)}
                placeholder="Ex: 10,50"
                className="input-field"
              />
            </div>
          )}

          {!registrarTotalLoja && (
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-700">
                💳 Cartão / Pix
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={valorCartaoPix}
                onChange={(e) => setValorCartaoPix(e.target.value)}
                placeholder="Ex: 25,90"
                className="input-field"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700">
              ⚡ Blink
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={valorBlink}
              onChange={(e) => setValorBlink(e.target.value)}
              placeholder="Ex: 15,00"
              className="input-field"
            />
          </div>

          {!registrarTotalLoja && (
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-700">
                📊 Taxa cartão %
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={percentualTaxaCartaoMedia}
                onChange={(e) => setPercentualTaxaCartaoMedia(e.target.value)}
                placeholder="Ex: 4,99"
                className="input-field"
              />
            </div>
          )}
        </div>
        {registrarTotalLoja && (
          <p className="mt-2 text-xs text-gray-500">
            Blink: valor total vindo da trocadora (sistema Blink) no período.
          </p>
        )}

        {(valorEsperado !== null || carregandoEsperado) && (
          <div
            className={`mt-4 rounded-lg border-2 p-3 ${
              diferenca === null
                ? "border-gray-200 bg-gray-50"
                : Math.abs(diferenca) < 0.01
                  ? "border-emerald-300 bg-emerald-100"
                  : "border-red-300 bg-red-50"
            }`}
          >
            {carregandoEsperado ? (
              <span className="text-sm text-gray-600">
                🧮 Calculando valor esperado...
              </span>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-700">
                  🧮 Esperado pelo sistema: R$ {valorEsperado.toFixed(2)} ·
                  Contado: R$ {valorContadoTotal.toFixed(2)}
                </p>
                <p
                  className={`mt-1 font-black ${
                    Math.abs(diferenca) < 0.01
                      ? "text-emerald-700"
                      : "text-red-700"
                  }`}
                >
                  {Math.abs(diferenca) < 0.01
                    ? "✅ Sem divergência"
                    : `⚠️ Divergência de R$ ${diferenca.toFixed(2)}`}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Conferência e comprovante */}
      <div className="rounded-lg border border-violet-100 bg-violet-50/70 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-violet-800">
          <span className="text-lg">🔎</span> Conferência
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700">
              👤 Quem conferiu (opcional)
            </label>
            <select
              value={conferidoPorId}
              onChange={(e) => setConferidoPorId(e.target.value)}
              className="select-field"
            >
              <option value="">Ninguém conferiu junto</option>
              {usuarios &&
                usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nome}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700">
              📸 Foto/comprovante (opcional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleSelecionarComprovante}
              disabled={enviandoComprovante}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
            {enviandoComprovante && (
              <p className="mt-1 text-xs text-gray-500">Enviando foto...</p>
            )}
            {!enviandoComprovante && comprovanteUrl && (
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={comprovanteUrl}
                  alt="Comprovante"
                  className="h-14 w-14 rounded-lg border border-gray-300 object-cover"
                />
                <span className="text-xs font-semibold text-emerald-700">
                  ✅ Foto anexada
                </span>
                <button
                  type="button"
                  onClick={() => setComprovanteUrl("")}
                  className="text-xs font-bold text-red-600 hover:text-red-700"
                >
                  Remover
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-bold text-gray-700">
          📝 Observações
        </label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          className="input-field min-h-22.5"
          rows={3}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-slate-50 p-3 text-xs text-gray-600">
        <ul className="list-disc space-y-1 pl-4">
          <li>Se marcar valor total da loja, não selecione máquina.</li>
          <li>
            O lançamento do dinheiro de cada máquina não soma no dinheiro total
            da loja.
          </li>
          <li>O dinheiro das fichas não soma mais no valor inteiro da loja.</li>
        </ul>
      </div>

      <button type="submit" className="btn-primary w-full">
        🧸 Registrar
      </button>
    </form>
  );
};

export default RegistrarDinheiro;
