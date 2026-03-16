import { LayoutDashboard, FileText, Kanban, MessageCircle, Settings, LogOut, ChevronRight } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Precatórios", url: "/precatorios", icon: FileText },
  { title: "Kanban", url: "/kanban", icon: Kanban },
  {
    title: "EvaChat",
    url: "/evachat",
    icon: MessageCircle,
    items: [
      { title: "Conectar", url: "/evachat/conectar" },
      { title: "Chat", url: "/evachat/chat" },
      { title: "Templates", url: "/evachat/templates" },
    ],
  },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon" className="border-r-2 border-border">
      <SidebarContent className="pt-0">
        <div className="h-14 flex items-center px-4 border-b-2 border-border mb-4">
          {!collapsed && (
            <div className="flex items-center">
              <span
                className="text-2xl font-black tracking-tighter select-none"
                style={{ color: "#FF6B35", fontFamily: "'Arial Black', Impact, sans-serif", letterSpacing: "-1px" }}
              >
                mogui
              </span>
              <span className="w-1.5 h-1.5 rounded-full ml-0.5 mb-1 self-end" style={{ background: "#FF6B35", opacity: 0.8 }} />
            </div>
          )}
          {collapsed && (
            <span
              className="text-2xl font-black tracking-tighter select-none mx-auto"
              style={{ color: "#FF6B35", fontFamily: "'Arial Black', Impact, sans-serif" }}
            >
              m
            </span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.items ? (
                    <Collapsible className="group/collapsible">
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="flex items-center gap-3 px-3 py-2 rounded-none border-2 border-transparent text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-default font-mono">
                          <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                          {!collapsed && (
                            <>
                              <span>{item.title}</span>
                              <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </>
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub className="ml-4 border-l-2 border-border">
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink
                                  to={subItem.url}
                                  className="flex items-center px-4 py-2 rounded-none text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-full hover:text-foreground transition-default"
                                  activeClassName="text-primary font-black border-l-2 border-primary -ml-[2px]"
                                >
                                  <span>{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="flex items-center gap-3 px-3 py-2 rounded-none border-2 border-transparent text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-sidebar-accent hover:border-border transition-default"
                        activeClassName="bg-primary/10 text-primary border-primary shadow-[2px_2px_0_0_rgba(17,17,17,1)]"
                      >
                        <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-none border-2 border-transparent text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive hover:border-border hover:bg-destructive/10 transition-default cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
