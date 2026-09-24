import { Navigate, Route, Routes } from "react-router-dom";
import { DocumentHead } from "./components/DocumentHead";
import { AppShell } from "./components/layout/AppShell";
import { MarketingLayout } from "./components/layout/MarketingLayout";
import { RequireAuth } from "./components/RequireAuth";
import { RequireClinic } from "./components/RequireClinic";
import { RequireTipo } from "./components/RequireTipo";
import { AdminAvaliacoesPage } from "./pages/admin/AdminAvaliacoesPage";
import { AdminCatalogosPage } from "./pages/admin/AdminCatalogosPage";
import { AdminClinicasPage } from "./pages/admin/AdminClinicasPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminFaturamentoPage } from "./pages/admin/AdminFaturamentoPage";
import { AdminLgpdPage } from "./pages/admin/AdminLgpdPage";
import { AdminTicketsPage } from "./pages/admin/AdminTicketsPage";
import { AdminTokensPage } from "./pages/admin/AdminTokensPage";
import { AdminUsuariosPage } from "./pages/admin/AdminUsuariosPage";
import { AgendaExpedientePage } from "./pages/app/AgendaExpedientePage";
import { AgendaPage } from "./pages/app/AgendaPage";
import { AtendimentosPage } from "./pages/app/AtendimentosPage";
import { EquipePage } from "./pages/app/EquipePage";
import { SettingsPage } from "./pages/app/SettingsPage";
import { ServicosPage } from "./pages/app/ServicosPage";
import { TutoresPage } from "./pages/app/TutoresPage";
import { CadastroPage } from "./pages/CadastroPage";
import { LoginPage } from "./pages/LoginPage";
import { RecuperarSenhaPage } from "./pages/RecuperarSenhaPage";
import { ClientClinicasPage } from "./pages/client/ClientClinicasPage";
import { ClientHomePage } from "./pages/client/ClientHomePage";
import { ClientPetDetailPage } from "./pages/client/ClientPetDetailPage";
import { ClientAgendaPage, ClientVacinacaoPage } from "./pages/client/ClientSimpleLists";
import { ClientAtendimentosPage } from "./pages/client/ClientAtendimentosPage";
import { AvaliacoesPage } from "./pages/clinic/AvaliacoesPage";
import { ChatPage } from "./pages/clinic/ChatPage";
import { ClientChatPage } from "./pages/client/ClientChatPage";
import { ClinicCatalogosPage } from "./pages/clinic/ClinicCatalogosPage";
import { ClinicHomePage } from "./pages/clinic/ClinicHomePage";
import { ClinicNotificationLogsPage } from "./pages/clinic/ClinicNotificationLogsPage";
import { ClinicLocalizacaoPage } from "./pages/clinic/ClinicLocalizacaoPage";
import { ClinicSupportPage } from "./pages/clinic/ClinicSupportPage";
import { AssinaturaPage } from "./pages/clinic/AssinaturaPage";
import { AssinaturaPagamentoPage } from "./pages/clinic/AssinaturaPagamentoPage";
import { FinanceiroPage } from "./pages/clinic/FinanceiroPage";
import { PaginaClinicaPage } from "./pages/clinic/PaginaClinicaPage";
import { PetDetailPage } from "./pages/clinic/PetDetailPage";
import { RelatoriosPage } from "./pages/clinic/RelatoriosPage";
import { VacinacaoPage } from "./pages/clinic/VacinacaoPage";
import { AdminEnterClinicPage } from "./pages/admin/AdminEnterClinicPage";
import { ClientClinicContextPage } from "./pages/client/ClientClinicContextPage";
import { ClinicaPublicaPage } from "./pages/ClinicaPublicaPage";
import { ConsultaPetsPage } from "./pages/ConsultaPetsPage";
import { RequireClinicAdmin } from "./components/RequireClinicAdmin";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { LandingPage } from "./pages/LandingPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { MeusDadosLgpdPage } from "./pages/account/MeusDadosLgpdPage";
import { PrivacidadePublicaPage } from "./pages/legal/PrivacidadePublicaPage";
import { TermosPage } from "./pages/legal/TermosPage";

export default function App() {
  return (
    <>
      <DocumentHead />
      <Routes>
      <Route path="/clinica/:slug" element={<ClinicaPublicaPage />} />

      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireTipo tipos={["ADMINISTRADOR_SISTEMA"]}>
              <AppShell variant="platform" />
            </RequireTipo>
          </RequireAuth>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="clinicas" element={<AdminClinicasPage />} />
        <Route path="clinicas/:id" element={<AdminEnterClinicPage />} />
        <Route path="assinaturas" element={<Navigate to="/admin/faturamento" replace />} />
        <Route path="faturamento" element={<AdminFaturamentoPage />} />
        <Route path="tokens" element={<AdminTokensPage />} />
        <Route path="usuarios" element={<AdminUsuariosPage />} />
        <Route path="avaliacoes" element={<AdminAvaliacoesPage />} />
        <Route path="consulta-pets" element={<ConsultaPetsPage />} />
        <Route path="suporte" element={<AdminTicketsPage />} />
        <Route path="lgpd" element={<AdminLgpdPage />} />
        <Route path="catalogos" element={<AdminCatalogosPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
      </Route>

      <Route
        path="/app"
        element={
          <RequireClinic>
            <AppShell variant="clinic" />
          </RequireClinic>
        }
      >
        <Route index element={<ClinicHomePage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="expediente" element={<AgendaExpedientePage />} />
        <Route path="localizacao" element={<ClinicLocalizacaoPage />} />
        <Route path="atendimentos" element={<AtendimentosPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="clientes" element={<TutoresPage />} />
        <Route path="tutores" element={<Navigate to="/app/clientes" replace />} />
        <Route path="pets" element={<Navigate to="/app/consulta-pets" replace />} />
        <Route
          path="consulta-pets"
          element={
            <RequireClinicAdmin>
              <ConsultaPetsPage />
            </RequireClinicAdmin>
          }
        />
        <Route path="pets/:id" element={<PetDetailPage />} />
        <Route path="vacinacao" element={<VacinacaoPage />} />
        <Route path="servicos" element={<ServicosPage />} />
        <Route path="equipe" element={<EquipePage />} />
        <Route path="catalogos" element={<ClinicCatalogosPage />} />
        <Route path="especialidades" element={<Navigate to="/app/catalogos" replace />} />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route path="pagina" element={<PaginaClinicaPage />} />
        <Route path="avaliacoes" element={<AvaliacoesPage />} />
        <Route path="financeiro" element={<FinanceiroPage />} />
        <Route path="assinatura" element={<AssinaturaPage />} />
        <Route path="assinatura/pagar" element={<AssinaturaPagamentoPage />} />
        <Route path="relatorios" element={<RelatoriosPage />} />
        <Route path="suporte" element={<ClinicSupportPage />} />
        <Route path="meus-dados" element={<MeusDadosLgpdPage />} />
        <Route
          path="logs"
          element={
            <RequireClinicAdmin>
              <ClinicNotificationLogsPage />
            </RequireClinicAdmin>
          }
        />
        <Route path="admin" element={<Navigate to="/admin" replace />} />
        <Route path="tutor" element={<Navigate to="/cliente" replace />} />
      </Route>

      <Route
        path="/cliente"
        element={
          <RequireAuth>
            <RequireTipo tipos={["CLIENTE"]}>
              <AppShell variant="client" />
            </RequireTipo>
          </RequireAuth>
        }
      >
        <Route index element={<ClientHomePage />} />
        <Route path="pets" element={<ConsultaPetsPage />} />
        <Route path="consulta-pets" element={<Navigate to="/cliente/pets" replace />} />
        <Route path="pets/:id" element={<ClientPetDetailPage />} />
        <Route path="agenda" element={<ClientAgendaPage />} />
        <Route path="vacinacao" element={<ClientVacinacaoPage />} />
        <Route path="atendimentos" element={<ClientAtendimentosPage />} />
        <Route path="chat" element={<ClientChatPage />} />
        <Route path="clinicas" element={<ClientClinicasPage />} />
        <Route path="clinica" element={<ClientClinicContextPage />} />
        <Route path="suporte" element={<ClinicSupportPage />} />
        <Route path="meus-dados" element={<MeusDadosLgpdPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
      </Route>

      <Route element={<MarketingLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/privacidade" element={<PrivacidadePublicaPage />} />
        <Route path="/termos" element={<TermosPage />} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </>
  );
}
