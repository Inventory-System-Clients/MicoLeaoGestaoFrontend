import React, { useEffect, useState } from "react";
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
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: 540,
        margin: "0 auto",
        padding: 32,
        background: "#f7ecd7", // bege claro
        borderRadius: 18,
        boxShadow: "0 4px 24px #e2cfa3",
        position: "relative",
        border: "2px solid #e2cfa3",
        overflowY: "auto",
        maxHeight: "90vh",
      }}
    >
      {/* Botão Voltar no topo à esquerda */}
      <button
        type="button"
        onClick={() => window.history.back()}
        style={{
          top: 16,
          left: 16,
          background: "#e2cfa3",
          color: "#a67c52",
          border: "none",
          borderRadius: 8,
          padding: "8px 18px",
          fontWeight: 600,
          fontSize: 16,
          boxShadow: "0 2px 8px #e2cfa3",
          cursor: "pointer",
        }}
      >
        ← Voltar
      </button>
      {/* Pelúcia decorativa topo */}
      <div style={{ position: "absolute", left: -38, top: -38 }}>
        <img
          src="/public/pelucia-urso.png"
          alt="Pelúcia"
          style={{ width: 64, height: 64 }}
        />
      </div>
      <div style={{ position: "absolute", right: -38, top: -38 }}>
        <img
          src="/public/pelucia-coelho.png"
          alt="Pelúcia"
          style={{ width: 64, height: 64 }}
        />
      </div>
      <h2
        style={{
          fontWeight: 800,
          fontSize: 26,
          marginBottom: 18,
          color: "#a67c52",
          letterSpacing: 1,
        }}
      >
        <span role="img" aria-label="dinheiro" style={{ marginRight: 8 }}>
          💰
        </span>
        Registrar Dinheiro
      </h2>
      {/* Gastos Variáveis - só aparece se registrarTotalLoja estiver marcado */}
      {registrarTotalLoja && (
        <div
          style={{
            marginBottom: 18,
            background: "#fffbe6",
            border: "1.5px solid #e2cfa3",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <label style={{ fontWeight: 600, color: "#a67c52", fontSize: 17 }}>
              Gastos Variáveis:
            </label>
            <button
              type="button"
              onClick={handleAddGasto}
              style={{
                background: "#e2cfa3",
                color: "#a67c52",
                border: "none",
                borderRadius: 8,
                padding: "6px 16px",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              + Adicionar Gasto
            </button>
          </div>
          {gastosVariaveis.length === 0 && (
            <div style={{ color: "#a67c52", fontSize: 15, marginBottom: 8 }}>
              Nenhum gasto adicionado.
            </div>
          )}
          {gastosVariaveis.map((gasto, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-end",
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 2, minWidth: 120 }}>
                <label style={{ fontSize: 14, color: "#a67c52" }}>Nome</label>
                <input
                  type="text"
                  value={gasto.nome}
                  onChange={(e) =>
                    handleChangeGasto(idx, "nome", e.target.value)
                  }
                  required
                  placeholder="Ex: Energia, Limpeza..."
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: "1.5px solid #e2cfa3",
                    background: "#fdf6e9",
                    color: "#a67c52",
                    fontWeight: 500,
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <label style={{ fontSize: 14, color: "#a67c52" }}>
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
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: "1.5px solid #e2cfa3",
                    background: "#fdf6e9",
                    color: "#a67c52",
                    fontWeight: 500,
                  }}
                />
              </div>
              <div style={{ flex: 2, minWidth: 120 }}>
                <label style={{ fontSize: 14, color: "#a67c52" }}>
                  Observação
                </label>
                <input
                  type="text"
                  value={gasto.observacao}
                  onChange={(e) =>
                    handleChangeGasto(idx, "observacao", e.target.value)
                  }
                  placeholder="Opcional"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: "1.5px solid #e2cfa3",
                    background: "#fdf6e9",
                    color: "#a67c52",
                    fontWeight: 500,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveGasto(idx)}
                style={{
                  background: "#fff0f0",
                  color: "#a67c52",
                  border: "1px solid #e2cfa3",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontWeight: 600,
                  fontSize: 15,
                  marginLeft: 4,
                  cursor: "pointer",
                }}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
      <label style={{ fontWeight: 600, color: "#a67c52" }}>Loja:</label>
      <select
        value={lojaSelecionada}
        onChange={handleLojaChange}
        required
        style={{
          width: "100%",
          marginTop: 6,
          padding: "10px 12px",
          borderRadius: 8,
          border: "1.5px solid #e2cfa3",
          background: "#fdf6e9",
          fontWeight: 500,
          color: "#a67c52",
          fontSize: 16,
        }}
      >
        <option value="">Selecione a loja</option>
        {lojas &&
          lojas.map((loja) => (
            <option key={loja.id} value={loja.id}>
              {loja.nome}
            </option>
          ))}
      </select>
      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <input
          type="checkbox"
          id="registrarTotalLoja"
          checked={registrarTotalLoja}
          onChange={(e) => setRegistrarTotalLoja(e.target.checked)}
          style={{ accentColor: "#e2cfa3", width: 18, height: 18 }}
        />
        <label
          htmlFor="registrarTotalLoja"
          style={{ fontSize: 15, color: "#a67c52" }}
        >
          Registrar valor total da loja (não selecionar máquina)
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, color: "#a67c52" }}>Máquina:</label>
        <select
          value={maquinaSelecionada}
          onChange={(e) => setMaquinaSelecionada(e.target.value)}
          style={{
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1.5px solid #e2cfa3",
            background: registrarTotalLoja ? "#f7ecd7" : "#fdf6e9",
            fontWeight: 500,
            color: "#a67c52",
            fontSize: 16,
            opacity: registrarTotalLoja ? 0.6 : 1,
          }}
          disabled={registrarTotalLoja}
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
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, color: "#a67c52" }}>Fechamento:</label>
        <div style={{ marginTop: 6 }}>
          <label style={{ fontSize: 14, color: "#a67c52" }}>Mês</label>
          <input
            type="month"
            value={mesReferencia}
            onChange={(e) => setMesReferencia(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1.5px solid #e2cfa3",
              background: "#fdf6e9",
              color: "#a67c52",
              fontWeight: 500,
              minWidth: 0,
            }}
          />
        </div>
      </div>
      {!registrarTotalLoja && (
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontWeight: 600, color: "#a67c52" }}>
            Dinheiro (R$):
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={valorDinheiro}
            onChange={(e) => setValorDinheiro(e.target.value)}
            placeholder="Ex: 10,50"
            style={{
              width: "100%",
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1.5px solid #e2cfa3",
              background: "#fdf6e9",
              color: "#a67c52",
              fontWeight: 500,
              fontSize: 16,
            }}
          />
        </div>
      )}
      {!registrarTotalLoja && (
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontWeight: 600, color: "#a67c52" }}>
            Cartão / Pix (R$):
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={valorCartaoPix}
            onChange={(e) => setValorCartaoPix(e.target.value)}
            placeholder="Ex: 25,90"
            style={{
              width: "100%",
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1.5px solid #e2cfa3",
              background: "#fdf6e9",
              color: "#a67c52",
              fontWeight: 500,
              fontSize: 16,
            }}
          />
        </div>
      )}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, color: "#a67c52" }}>
          Blink (R$):
        </label>
        {registrarTotalLoja && (
          <p style={{ margin: "2px 0 6px", fontSize: 13, color: "#a67c52" }}>
            Valor total vindo da trocadora (sistema Blink) no período.
          </p>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={valorBlink}
          onChange={(e) => setValorBlink(e.target.value)}
          placeholder="Ex: 15,00"
          style={{
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1.5px solid #e2cfa3",
            background: "#fdf6e9",
            color: "#a67c52",
            fontWeight: 500,
            fontSize: 16,
          }}
        />
      </div>
      {(valorEsperado !== null || carregandoEsperado) && (
        <div
          style={{
            marginBottom: 18,
            borderRadius: 10,
            padding: 14,
            border: `2px solid ${
              diferenca === null
                ? "#e2cfa3"
                : Math.abs(diferenca) < 0.01
                  ? "#7cb87c"
                  : "#d9534f"
            }`,
            background:
              diferenca === null
                ? "#fdf6e9"
                : Math.abs(diferenca) < 0.01
                  ? "#eef8ee"
                  : "#fdecec",
          }}
        >
          {carregandoEsperado ? (
            <span style={{ color: "#a67c52" }}>Calculando valor esperado...</span>
          ) : (
            <>
              <p style={{ margin: 0, color: "#a67c52", fontWeight: 600 }}>
                Esperado pelo sistema: R$ {valorEsperado.toFixed(2)} · Contado:
                R$ {valorContadoTotal.toFixed(2)}
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontWeight: 800,
                  color: Math.abs(diferenca) < 0.01 ? "#3c763d" : "#a94442",
                }}
              >
                {Math.abs(diferenca) < 0.01
                  ? "✅ Sem divergência"
                  : `⚠️ Divergência de R$ ${diferenca.toFixed(2)}`}
              </p>
            </>
          )}
        </div>
      )}
      {!registrarTotalLoja && (
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontWeight: 600, color: "#a67c52" }}>
            Taxa média de cartão (%):
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={percentualTaxaCartaoMedia}
            onChange={(e) => setPercentualTaxaCartaoMedia(e.target.value)}
            placeholder="Ex: 4,99"
            style={{
              width: "100%",
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1.5px solid #e2cfa3",
              background: "#fdf6e9",
              color: "#a67c52",
              fontWeight: 500,
              fontSize: 16,
            }}
          />
        </div>
      )}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, color: "#a67c52" }}>
          Quem conferiu (opcional):
        </label>
        <select
          value={conferidoPorId}
          onChange={(e) => setConferidoPorId(e.target.value)}
          style={{
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1.5px solid #e2cfa3",
            background: "#fdf6e9",
            color: "#a67c52",
            fontWeight: 500,
            fontSize: 16,
          }}
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
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, color: "#a67c52" }}>
          Foto/comprovante (opcional):
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleSelecionarComprovante}
          disabled={enviandoComprovante}
          style={{
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1.5px solid #e2cfa3",
            background: "#fdf6e9",
            color: "#a67c52",
            fontWeight: 500,
            fontSize: 15,
          }}
        />
        {enviandoComprovante && (
          <p style={{ marginTop: 6, fontSize: 14, color: "#a67c52" }}>
            Enviando foto...
          </p>
        )}
        {!enviandoComprovante && comprovanteUrl && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src={comprovanteUrl}
              alt="Comprovante"
              style={{
                width: 56,
                height: 56,
                objectFit: "cover",
                borderRadius: 8,
                border: "1.5px solid #e2cfa3",
              }}
            />
            <span style={{ fontSize: 14, color: "#3c763d", fontWeight: 600 }}>
              ✅ Foto anexada
            </span>
            <button
              type="button"
              onClick={() => setComprovanteUrl("")}
              style={{
                background: "none",
                border: "none",
                color: "#a94442",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Remover
            </button>
          </div>
        )}
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, color: "#a67c52" }}>
          Observações:
        </label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          style={{
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1.5px solid #e2cfa3",
            background: "#fdf6e9",
            color: "#a67c52",
            fontWeight: 500,
            fontSize: 16,
          }}
          rows={3}
        />
      </div>
      <div
        style={{
          color: "#a67c52",
          fontSize: 14,
          marginBottom: 18,
          background: "#fdf6e9",
          borderRadius: 8,
          padding: "10px 14px",
          border: "1px solid #e2cfa3",
        }}
      >
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li>Se marcar valor total da loja, não selecione máquina.</li>
          <li>
            O lançamento do dinheiro de cada máquina não soma no dinheiro total
            da loja.
          </li>
          <li>O dinheiro das fichas não soma mais no valor inteiro da loja.</li>
        </ul>
      </div>
      <button
        type="submit"
        style={{
          width: "100%",
          padding: 14,
          background: "linear-gradient(90deg, #e2cfa3 0%, #f7ecd7 100%)",
          color: "#a67c52",
          border: "none",
          borderRadius: 10,
          fontWeight: "bold",
          fontSize: 18,
          boxShadow: "0 2px 8px #e2cfa3",
          letterSpacing: 1,
          marginTop: 8,
        }}
      >
        <span role="img" aria-label="pelúcia" style={{ marginRight: 8 }}>
          🧸
        </span>
        Registrar
      </button>
    </form>
  );
};

export default RegistrarDinheiro;
