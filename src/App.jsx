import Veiculos from "./pages/Veiculos";
import Alertas from "./pages/Alertas";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AlertasProvider } from "./contexts/AlertasContext";
import { PrivateRoute } from "./components/PrivateRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Usuarios } from "./pages/Usuarios";
import { UsuarioForm } from "./pages/UsuarioForm";
import { Lojas } from "./pages/Lojas";
import { LojaForm } from "./pages/LojaForm";
import { ProjetosLoja } from "./pages/ProjetosLoja";
import { ProjetoLojaForm } from "./pages/ProjetoLojaForm";
import { LojaDetalhes } from "./pages/LojaDetalhes";
import { VisaoLojas } from "./pages/VisaoLojas";
import { VisaoMaquinas } from "./pages/VisaoMaquinas";
import { MaquinaForm } from "./pages/MaquinaForm";
import { MaquinaDetalhes } from "./pages/MaquinaDetalhes";
import { Produtos } from "./pages/Produtos";
import { ProdutoForm } from "./pages/ProdutoForm";
import { Estoque } from "./pages/Estoque";
import { Movimentacoes } from "./pages/Movimentacoes";
import { Roteiros } from "./pages/Roteiros";
// import { AuditoriaMaquinas } from "./pages/AuditoriaMaquinas"; // desativada por enquanto
import { RoteiroExecucao } from "./pages/RoteiroExecucao";
import { Treinamentos } from "./pages/Treinamentos";
import { Desenvolvimento } from "./pages/Desenvolvimento";
import { ModoSeguranca } from "./pages/ModoSeguranca";
import ManutencaoPage from "./pages/ManutencaoPage";
import FabricacaoPelucia from "./pages/FabricacaoPelucia";
import Pecas from "./pages/Pecas";
import Envios from "./pages/Envios";
import ConferenciaLacre from "./pages/ConferenciaLacre";
import Compras from "./pages/Compras";
import ContasPagar from "./pages/ContasPagar";
import ConfiguracaoMoeda from "./pages/ConfiguracaoMoeda";
import { Graficos } from "./pages/Graficos";
import { Relatorios } from "./pages/Relatorios";
import { RelatorioTransferenciasMaquinas } from "./pages/RelatorioTransferenciasMaquinas";
import { Sangrias } from "./pages/Sangrias";
import { GastosVariaveis } from "./pages/GastosVariaveis";
import { RegistroDinheiro } from "./pages/RegistroDinheiro";
import { StyleGuide } from "./pages/StyleGuide";
import { AnaliseEstoque } from "./pages/AnaliseEstoque";
import { InicioPerfilRestrito } from "./pages/InicioPerfilRestrito";
import { acessoATela } from "./utils/perfis";
import "./App.css";

function HomeRoute() {
  const { usuario } = useAuth();
  // Quem não tem o Dashboard (perfis restritos ou acesso tirado) vê só o
  // que foi liberado
  if (!acessoATela(usuario, "/", true)) {
    return <InicioPerfilRestrito />;
  }
  return <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AlertasProvider>
        <BrowserRouter>
          <Routes>
          <Route
            path="/veiculos"
            element={
              <PrivateRoute
                roles={[
                  "ADMIN",
                  "DESENVOLVEDOR",
                  "FUNCIONARIO",
                  "FUNCIONARIO_CADASTRO",
                ]}
              >
                <Veiculos />
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/modo-seguranca" element={<ModoSeguranca />} />
          <Route
            path="/alertas"
            element={
              <PrivateRoute
                roles={["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"]}
              >
                <Alertas />
              </PrivateRoute>
            }
          />
          ;
          {/* Cadastro público desativado: usuários são criados pelo Admin */}
          <Route path="/registrar" element={<Navigate to="/login" replace />} />
          <Route path="/style-guide" element={<StyleGuide />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <HomeRoute />
              </PrivateRoute>
            }
          />
          <Route
            path="/usuarios"
            element={
              <PrivateRoute adminOnly>
                <Usuarios />
              </PrivateRoute>
            }
          />
          <Route
            path="/usuarios/novo"
            element={
              <PrivateRoute adminOnly>
                <UsuarioForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/usuarios/:id/editar"
            element={
              <PrivateRoute adminOnly>
                <UsuarioForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/lojas"
            element={
              <PrivateRoute>
                <Lojas />
              </PrivateRoute>
            }
          />
          <Route
            path="/visao-lojas"
            element={
              <PrivateRoute
                roles={["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"]}
              >
                <VisaoLojas />
              </PrivateRoute>
            }
          />
          <Route
            path="/visao-maquinas"
            element={
              <PrivateRoute
                roles={["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"]}
              >
                <VisaoMaquinas />
              </PrivateRoute>
            }
          />
          <Route
            path="/lojas/:id"
            element={
              <PrivateRoute>
                <LojaDetalhes />
              </PrivateRoute>
            }
          />
          <Route
            path="/lojas/nova"
            element={
              <PrivateRoute>
                <LojaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/lojas/:id/editar"
            element={
              <PrivateRoute>
                <LojaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/projetos-loja"
            element={
              <PrivateRoute adminOnly>
                <ProjetosLoja />
              </PrivateRoute>
            }
          />
          <Route
            path="/projetos-loja/novo"
            element={
              <PrivateRoute adminOnly>
                <ProjetoLojaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/projetos-loja/:id/editar"
            element={
              <PrivateRoute adminOnly>
                <ProjetoLojaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/maquinas"
            element={
              // A antiga lista de máquinas foi substituída pela Visão das Máquinas
              <Navigate to="/visao-maquinas" replace />
            }
          />
          <Route
            path="/maquinas/nova"
            element={
              <PrivateRoute>
                <MaquinaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/maquinas/:id/editar"
            element={
              <PrivateRoute>
                <MaquinaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/maquinas/:id"
            element={
              <PrivateRoute>
                <MaquinaDetalhes />
              </PrivateRoute>
            }
          />
          <Route
            path="/produtos"
            element={
              <PrivateRoute>
                <Produtos />
              </PrivateRoute>
            }
          />
          <Route
            path="/compras"
            element={
              <PrivateRoute
                roles={[
                  "ADMIN",
                  "DESENVOLVEDOR",
                  "FUNCIONARIO_ESTOQUE",
                  "FUNCIONARIO_CADASTRO",
                ]}
              >
                <Compras />
              </PrivateRoute>
            }
          />
          <Route
            path="/configuracao-moeda"
            element={
              <PrivateRoute roles={["ADMIN", "DESENVOLVEDOR"]}>
                <ConfiguracaoMoeda />
              </PrivateRoute>
            }
          />
          <Route
            path="/contas-a-pagar"
            element={
              <PrivateRoute roles={["ADMIN", "DESENVOLVEDOR"]}>
                <ContasPagar />
              </PrivateRoute>
            }
          />
          <Route
            path="/estoque"
            element={
              <PrivateRoute
                roles={[
                  "ADMIN",
                  "DESENVOLVEDOR",
                  "FUNCIONARIO_ESTOQUE",
                  "FUNCIONARIO_CADASTRO",
                ]}
              >
                <Estoque />
              </PrivateRoute>
            }
          />
          <Route
            path="/fabricacao-pelucia"
            element={
              <PrivateRoute
                roles={[
                  "ADMIN",
                  "DESENVOLVEDOR",
                  "FUNCIONARIO_CADASTRO",
                  "FUNCIONARIO_ESTOQUE",
                ]}
              >
                <FabricacaoPelucia />
              </PrivateRoute>
            }
          />
          <Route
            path="/pecas"
            element={
              <PrivateRoute
                roles={[
                  "ADMIN",
                  "DESENVOLVEDOR",
                  "FUNCIONARIO",
                  "FUNCIONARIO_CADASTRO",
                ]}
              >
                <Pecas />
              </PrivateRoute>
            }
          />
          <Route
            path="/envios"
            element={
              <PrivateRoute
                roles={[
                  "ADMIN",
                  "DESENVOLVEDOR",
                  "FUNCIONARIO_ESTOQUE",
                  "FUNCIONARIO_CADASTRO",
                ]}
              >
                <Envios />
              </PrivateRoute>
            }
          />
          <Route
            path="/conferencia-lacre"
            element={
              <PrivateRoute>
                <ConferenciaLacre />
              </PrivateRoute>
            }
          />
          <Route
            path="/produtos/novo"
            element={
              <PrivateRoute>
                <ProdutoForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/produtos/:id/editar"
            element={
              <PrivateRoute>
                <ProdutoForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/movimentacoes"
            element={
              <PrivateRoute
                roles={["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"]}
              >
                <Movimentacoes />
              </PrivateRoute>
            }
          />
          <Route
            path="/roteiros"
            element={
              <PrivateRoute>
                <Roteiros />
              </PrivateRoute>
            }
          />
          {/* Auditoria de Máquinas: desativada por enquanto (página em pages/AuditoriaMaquinas.jsx)
          <Route
            path="/auditoria-maquinas"
            element={
              <PrivateRoute
                roles={["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"]}
              >
                <AuditoriaMaquinas />
              </PrivateRoute>
            }
          />
          */}
          <Route
            path="/roteiros/:id/executar"
            element={
              <PrivateRoute>
                <RoteiroExecucao />
              </PrivateRoute>
            }
          />
          <Route
            path="/treinamentos"
            element={
              <PrivateRoute>
                <Treinamentos />
              </PrivateRoute>
            }
          />
          <Route
            path="/desenvolvimento"
            element={
              <PrivateRoute
                roles={["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"]}
              >
                <Desenvolvimento />
              </PrivateRoute>
            }
          />
          <Route
            path="/analise-estoque"
            element={
              <PrivateRoute
                roles={["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"]}
              >
                <AnaliseEstoque />
              </PrivateRoute>
            }
          />
          <Route
            path="/manutencao"
            element={
              <PrivateRoute>
                <ManutencaoPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/graficos"
            element={
              <PrivateRoute adminOnly>
                <Graficos />
              </PrivateRoute>
            }
          />
          <Route
            path="/relatorios"
            element={
              <PrivateRoute adminOnly>
                <Relatorios />
              </PrivateRoute>
            }
          />
          <Route
            path="/relatorios/transferencias-maquinas"
            element={
              <PrivateRoute
                roles={["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"]}
              >
                <RelatorioTransferenciasMaquinas />
              </PrivateRoute>
            }
          />
          <Route
            path="/sangrias"
            element={
              <PrivateRoute>
                <Sangrias />
              </PrivateRoute>
            }
          />
          <Route
            path="/gastos-variaveis"
            element={
              <PrivateRoute adminOnly>
                <GastosVariaveis />
              </PrivateRoute>
            }
          />
          <Route
            path="/registrar-dinheiro"
            element={
              <PrivateRoute roles={["ADMIN", "DESENVOLVEDOR"]}>
                <RegistroDinheiro />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </AlertasProvider>
    </AuthProvider>
  );
}

export default App;
