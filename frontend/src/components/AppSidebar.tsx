import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, AlertTriangle, Users, FileBarChart,
  Droplets, Wrench, MapPin, Settings, ChevronLeft, Gauge,
  ClipboardList, History, BarChart3, FileText, BookOpen, LogOut,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

const navGroups = [
  {
    label: "Operacional",
    items: [
      { title: "Dashboard",       url: "/",               icon: LayoutDashboard },
      { title: "Entradas",        url: "/entradas",        icon: ClipboardList },
      { title: "Histórico",       url: "/historico",       icon: History },
    ],
  },
  {
    label: "Análise",
    items: [
      { title: "Painel Gerencial",url: "/gerencial",       icon: BarChart3 },
      { title: "Institucional",   url: "/institucional",   icon: FileText },
      { title: "Ocorrências",     url: "/ocorrencias",     icon: AlertTriangle },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Núcleos",         url: "/nucleos-cadastro",icon: BookOpen },
      { title: "Localidades",     url: "/localidades",     icon: MapPin },
      { title: "Clientes",        url: "/clientes",        icon: Users },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Rede Hídrica",    url: "/rede-hidrica",    icon: Droplets },
      { title: "Manutenção",      url: "/manutencao",      icon: Wrench },
      { title: "Monitoramento",   url: "/monitoramento",   icon: Gauge },
      { title: "Relatórios",      url: "/relatorios",      icon: FileBarChart },
      { title: "Configurações",   url: "/configuracoes",   icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border z-50 flex-shrink-0"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Droplets className="w-4 h-4 text-primary-foreground" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }} className="overflow-hidden whitespace-nowrap">
                <span className="text-sm font-semibold text-foreground tracking-tight">Sabesp</span>
                <span className="text-xs text-muted-foreground block -mt-0.5">Gestão Operacional</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-1 px-3">
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <NavLink key={item.url} to={item.url} end={item.url === "/"}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}>
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="whitespace-nowrap overflow-hidden text-ellipsis">
                          {item.title}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="py-3 px-3 border-t border-sidebar-border space-y-0.5 flex-shrink-0">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Sair</motion.span>
            )}
          </AnimatePresence>
        </button>
        <button onClick={() => setCollapsed(v => !v)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-sidebar-accent/50 transition-colors">
          <ChevronLeft className={cn("w-4 h-4 flex-shrink-0 transition-transform", collapsed && "rotate-180")} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Recolher</motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
