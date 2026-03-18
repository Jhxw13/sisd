import { AppLayout } from "@/components/AppLayout";
import { SectionHeader } from "@/components/DataDisplay";
import { Settings as SettingsIcon, User, Bell, Shield, Palette, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

const sections = [
  { icon: User, title: "Perfil do Usuário", desc: "Nome, email e informações pessoais" },
  { icon: Bell, title: "Notificações", desc: "Preferências de alertas e avisos" },
  { icon: Shield, title: "Segurança", desc: "Senha, autenticação e permissões" },
  { icon: Palette, title: "Aparência", desc: "Tema e personalização visual" },
  { icon: Database, title: "Dados", desc: "Exportação e backup de dados" },
];

export default function Configuracoes() {
  return (
    <AppLayout title="Configurações" subtitle="Preferências e configurações do sistema">
      <div className="max-w-3xl space-y-6">
        {sections.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass-surface rounded-2xl p-6"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <section.icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">{section.title}</h3>
                  <p className="text-xs text-muted-foreground">{section.desc}</p>
                </div>
              </div>
              {section.title === "Perfil do Usuário" && (
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Nome</label>
                      <Input defaultValue="Operador Sistema" className="bg-secondary border-border" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
                      <Input defaultValue="operador@sabesp.com.br" className="bg-secondary border-border" />
                    </div>
                  </div>
                  <Button size="sm" className="active-press">Salvar Alterações</Button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
