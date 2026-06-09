import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, ShieldCheck, KeySquare, Brain, FileText, Boxes,
  History, Library, Network, BrainCircuit, GitGraph, User, LifeBuoy, Plane,
  Image, Wrench, Database, HeartPulse,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { currentUser } from "@/lib/mock-store";


import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

export function BuilderSidebar() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => currentPath === p;

  const main = [
    { url: "/", icon: LayoutDashboard, key: "nav.dashboard" },
    { url: "/users", icon: Users, key: "nav.users" },
    { url: "/roles", icon: ShieldCheck, key: "nav.roles" },
    { url: "/permissions", icon: KeySquare, key: "nav.permissions" },
  ];
  const project = [
    { url: "/memory", icon: Brain, key: "nav.memory" },
    { url: "/decisions", icon: FileText, key: "nav.decisions" },
    { url: "/modules", icon: Boxes, key: "nav.modules" },
    { url: "/audit", icon: History, key: "nav.audit" },
  ];
  const registry = [
    { url: "/registry/taxonomy", icon: Library, key: "nav.taxonomy" },
    { url: "/registry/fields", icon: Database, key: "nav.fields" },
    { url: "/registry/federation", icon: Network, key: "nav.federation" },
    { url: "/registry/ai", icon: BrainCircuit, key: "nav.ai" },
    { url: "/registry/knowledge", icon: GitGraph, key: "nav.knowledge" },
  ];
  const personal = [{ url: "/profile", icon: User, key: "nav.profile" }];
  const stubs = [
    { url: "/stubs/support", icon: LifeBuoy, key: "nav.support" },
    { url: "/stubs/travel", icon: Plane, key: "nav.travel" },
    { url: "/stubs/media", icon: Image, key: "nav.media" },
    { url: "/stubs/garage", icon: Wrench, key: "nav.garage" },
  ];

  const viewer = currentUser();
  const isAdmin = Boolean(viewer?.isGlobalSuperadmin || viewer?.roles?.includes("builder_admin"));
  const admin = isAdmin
    ? [{ url: "/admin/db-health", icon: HeartPulse, key: "nav.adminDbHealth" }]
    : [];


  const Group = ({ label, items }: { label: string; items: typeof main }) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link to={item.url} className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {!collapsed && <span>{t(item.key)}</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-3">
          <div className="text-sm font-semibold">{t("app.name")}</div>
          {!collapsed && <div className="text-[11px] text-muted-foreground">{t("app.tagline")}</div>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Group label={t("nav.dashboard")} items={main} />
        <Group label={t("nav.memory")} items={project} />
        <Group label={t("nav.registry")} items={registry} />
        <Group label={t("nav.profile")} items={personal} />
        <Group label={t("nav.stubs")} items={stubs} />
        {admin.length > 0 && <Group label={t("nav.admin")} items={admin} />}
      </SidebarContent>
    </Sidebar>
  );
}
