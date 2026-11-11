import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import {
  PageHeader,
  DataTable,
  AlertBox,
  ConfirmDialog,
  Badge,
} from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const STATUS_INFO = {
  PLANEJAMENTO: { label: "Planejamento", variant: "info" },
  EM_ANDAMENTO: { label: "Em andamento", variant: "warning" },
  CONCLUIDO: { label: "Concluído", variant: "success" },
  CANCELADO: { label: "Cancelado", variant: "danger" },
};

export function ProjetosLoja() {
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });

  const carregarProjetos = async () => {
    try {
      setLoading(true);
      const response = await api.get("/projetos-loja");
      setProjetos(Array.isArray(response.data) ? response.data : []);
      setError("");
    } catch (err) {
      setError(
        "Erro ao carregar projetos de loja: " +
          (err.response?.data?.error || err.message),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarProjetos();
  }, []);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/projetos-loja/${id}`);
      setProjetos((prev) => prev.filter((projeto) => projeto.id !== id));
      setDeleteDialog({ open: false, id: null });
      setError("");
    } catch (err) {
      setDeleteDialog({ open: false, id: null });
      setError(
        "Erro ao excluir projeto: " +
          (err.response?.data?.error || err.message),
      );
    }
  };

  const headers = [
    { label: "Projeto", key: "nome" },
    {
      label: "Loja",
      key: "loja",
      render: (projeto) => {
        if (!projeto.loja) return "—";
        // Loja nova ainda escondida (só vira real ao concluir o projeto)
        const emImplantacao =
          projeto.loja.statusOperacao === "EM_IMPLANTACAO" &&
          projeto.loja.ativo === false;
        return emImplantacao ? (
          <span>
            🆕 {projeto.loja.nome}{" "}
            <span className="text-xs text-gray-500">(loja nova)</span>
          </span>
        ) : (
          projeto.loja.nome
        );
      },
    },
    {
      label: "Status",
      key: "status",
      render: (projeto) => {
        const info = STATUS_INFO[projeto.status] || STATUS_INFO.PLANEJAMENTO;
        return <Badge variant={info.variant}>{info.label}</Badge>;
      },
    },
    {
      label: "Máquinas",
      key: "maquinas",
      // Gravadas no projeto: as que estão na loja + as reservadas
      render: (projeto) => `${projeto.maquinas?.length || 0} máquina(s)`,
    },
    {
      label: "Total investido",
      key: "totalInvestido",
      render: (projeto) => (
        <span className="font-semibold text-gray-700">
          R$ {formatCurrency(projeto.totalInvestido)}
        </span>
      ),
    },
    {
      label: "Ações",
      key: "acoes",
      render: (projeto) => (
        <div className="flex gap-2">
          <Link
            to={`/projetos-loja/${projeto.id}/editar`}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Editar
          </Link>
          <button
            type="button"
            onClick={() => setDeleteDialog({ open: true, id: projeto.id })}
            className="text-red-600 hover:text-red-800 font-medium"
          >
            Excluir
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Projetos Loja"
          subtitle="Planeje e acompanhe o investimento de abertura de cada loja"
          icon="🏗️"
          action={
            <Link to="/projetos-loja/novo" className="btn-primary">
              + Novo Projeto
            </Link>
          }
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}

        <DataTable
          headers={headers}
          data={projetos}
          emptyMessage="Nenhum projeto de loja cadastrado. Clique em 'Novo Projeto' para começar."
        />
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, id: null })}
        onConfirm={() => handleDelete(deleteDialog.id)}
        title="Excluir Projeto"
        message="Tem certeza que deseja excluir este projeto? As máquinas, custos e fotos cadastrados nele também serão removidos — e, se a loja nova ainda não foi concluída, o cadastro dela (com gastos fixos e extintores) também. Esta ação não pode ser desfeita."
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        type="danger"
      />

      <Footer />
    </div>
  );
}

export default ProjetosLoja;
