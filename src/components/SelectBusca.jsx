import { useEffect, useMemo, useRef, useState } from "react";

// Lista de escolha com busca: no lugar de um <select> com muitas opções
// (lojas, produtos, fornecedores...). Digita e a lista vai filtrando (sem
// diferenciar maiúsculas nem acentos); setas + Enter escolhem, Esc fecha.
//
// opcoes: [{ valor, rotulo, detalhe? }] — `detalhe` (ex.: SKU) aparece ao lado
//   e também entra na busca.
// opcaoVazia: texto da opção de valor "" (ex.: "Todos", "Nenhuma"); sem ela,
//   não dá pra limpar a escolha.
// required: o formulário não envia sem escolha (validação nativa do navegador).
const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function SelectBusca({
  opcoes,
  valor,
  aoMudar,
  placeholder = "Buscar...",
  opcaoVazia,
  className = "",
  disabled = false,
  required = false,
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [destaque, setDestaque] = useState(0);
  const caixaRef = useRef(null);
  const listaRef = useRef(null);

  const todas = useMemo(
    () => [
      ...(opcaoVazia !== undefined ? [{ valor: "", rotulo: opcaoVazia }] : []),
      ...opcoes,
    ],
    [opcoes, opcaoVazia],
  );

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return todas;
    // Digitando, a opção vazia ("Todos", "Selecione...") sai da lista pra
    // Enter não escolher ela por engano
    return opcoes.filter(
      (opcao) =>
        normalizar(opcao.rotulo).includes(termo) ||
        normalizar(opcao.detalhe).includes(termo),
    );
  }, [todas, opcoes, busca]);

  const selecionada = todas.find((opcao) => String(opcao.valor) === String(valor ?? ""));

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = (evento) => {
      if (caixaRef.current && !caixaRef.current.contains(evento.target)) {
        setAberto(false);
        setBusca("");
      }
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  // Mantém o item destacado visível ao navegar com as setas
  useEffect(() => {
    listaRef.current?.children[destaque]?.scrollIntoView({ block: "nearest" });
  }, [destaque]);

  const escolher = (opcao) => {
    aoMudar(opcao.valor);
    setAberto(false);
    setBusca("");
  };

  const abrir = () => {
    if (disabled) return;
    setAberto(true);
    setDestaque(0);
  };

  const aoTeclar = (evento) => {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      if (!aberto) return abrir();
      setDestaque((atual) => Math.min(atual + 1, filtradas.length - 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setDestaque((atual) => Math.max(atual - 1, 0));
    } else if (evento.key === "Enter") {
      if (aberto && filtradas[destaque]) {
        evento.preventDefault();
        escolher(filtradas[destaque]);
      }
    } else if (evento.key === "Escape") {
      setAberto(false);
      setBusca("");
    }
  };

  return (
    <div ref={caixaRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">
          🔍
        </span>
        <input
          type="text"
          value={aberto ? busca : selecionada?.rotulo || ""}
          placeholder={aberto ? selecionada?.rotulo || placeholder : placeholder}
          onFocus={abrir}
          onClick={abrir}
          onChange={(evento) => {
            setBusca(evento.target.value);
            setDestaque(0);
            if (!aberto) setAberto(true);
          }}
          onKeyDown={aoTeclar}
          disabled={disabled}
          className={`w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 outline-none focus:border-blue-500 disabled:bg-gray-100 ${className}`}
          autoComplete="off"
        />
        {required && (
          // Campo invisível só pra validação nativa do formulário
          <input
            tabIndex={-1}
            aria-hidden="true"
            required
            value={valor ?? ""}
            onChange={() => {}}
            onFocus={abrir}
            className="pointer-events-none absolute inset-0 opacity-0"
          />
        )}
      </div>

      {aberto && (
        <ul
          ref={listaRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
        >
          {filtradas.length === 0 ? (
            <li className="px-3 py-2 text-gray-500">Nada encontrado</li>
          ) : (
            filtradas.map((opcao, indice) => (
              <li
                key={`${opcao.valor}-${indice}`}
                onMouseDown={(evento) => {
                  evento.preventDefault();
                  escolher(opcao);
                }}
                onMouseEnter={() => setDestaque(indice)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 ${
                  indice === destaque ? "bg-orange-50" : ""
                } ${String(opcao.valor) === String(valor ?? "") ? "font-semibold" : ""} ${
                  opcao.valor === "" ? "text-gray-500" : "text-gray-800"
                }`}
              >
                <span className="truncate">{opcao.rotulo}</span>
                {opcao.detalhe && (
                  <span className="shrink-0 text-xs text-gray-400">{opcao.detalhe}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default SelectBusca;
