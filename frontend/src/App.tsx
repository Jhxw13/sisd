import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivateRoute } from "./components/PrivateRoute";

// Páginas públicas
import Login from "./pages/Login";
import FormularioRelatorio from "./pages/FormularioRelatorio";

// Painel gerencial (privado)
import Index from "./pages/Index";
import EntradasPendentes from "./pages/EntradasPendentes";
import Historico from "./pages/Historico";
import Gerencial from "./pages/Gerencial";
import Institucional from "./pages/Institucional";
import NucleosCadastro from "./pages/NucleosCadastro";
import Ocorrencias from "./pages/Ocorrencias";
import Clientes from "./pages/Clientes";
import RedeHidrica from "./pages/RedeHidrica";
import Manutencao from "./pages/Manutencao";
import Monitoramento from "./pages/Monitoramento";
import Localidades from "./pages/Localidades";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

const qc = new QueryClient();
const P = ({ children }: { children: React.ReactNode }) => (
  <PrivateRoute>{children}</PrivateRoute>
);

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <Toaster /><Sonner />
        <BrowserRouter>
          <Routes>
            {/* Públicas */}
            <Route path="/relatorio" element={<FormularioRelatorio />} />
            <Route path="/gestao/login" element={<Login />} />
            <Route path="/login" element={<Navigate to="/relatorio" replace />} />

            {/* Painel — privadas */}
            <Route path="/"                  element={<P><Index /></P>} />
            <Route path="/entradas"          element={<P><EntradasPendentes /></P>} />
            <Route path="/historico"         element={<P><Historico /></P>} />
            <Route path="/gerencial"         element={<P><Gerencial /></P>} />
            <Route path="/institucional"     element={<P><Institucional /></P>} />
            <Route path="/nucleos-cadastro"  element={<P><NucleosCadastro /></P>} />
            <Route path="/ocorrencias"       element={<P><Ocorrencias /></P>} />
            <Route path="/clientes"          element={<P><Clientes /></P>} />
            <Route path="/rede-hidrica"      element={<P><RedeHidrica /></P>} />
            <Route path="/manutencao"        element={<P><Manutencao /></P>} />
            <Route path="/monitoramento"     element={<P><Monitoramento /></P>} />
            <Route path="/localidades"       element={<P><Localidades /></P>} />
            <Route path="/relatorios"        element={<P><Relatorios /></P>} />
            <Route path="/configuracoes"     element={<P><Configuracoes /></P>} />
            <Route path="*"                  element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
