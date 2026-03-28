import * as React from "react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { RiDashboardLine, RiListUnordered, RiBarChartLine, RiFolderLine, RiGroupLine, RiCameraLine, RiFileTextLine, RiSettingsLine, RiQuestionLine, RiSearchLine, RiDatabase2Line, RiFileChartLine, RiFileLine, RiCommandLine } from "@remixicon/react"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: (
        <RiDashboardLine
        />
      ),
    },
    {
      title: "Lifecycle",
      url: "#",
      icon: (
        <RiListUnordered
        />
      ),
    },
    {
      title: "Analytics",
      url: "#",
      icon: (
        <RiBarChartLine
        />
      ),
    },
    {
      title: "Projects",
      url: "#",
      icon: (
        <RiFolderLine
        />
      ),
    },
    {
      title: "Team",
      url: "#",
      icon: (
        <RiGroupLine
        />
      ),
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: (
        <RiCameraLine
        />
      ),
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: (
        <RiFileTextLine
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: (
        <RiFileTextLine
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: (
        <RiSettingsLine
        />
      ),
    },
    {
      title: "Get Help",
      url: "#",
      icon: (
        <RiQuestionLine
        />
      ),
    },
    {
      title: "Search",
      url: "#",
      icon: (
        <RiSearchLine
        />
      ),
    },
  ],
  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: (
        <RiDatabase2Line
        />
      ),
    },
    {
      name: "Reports",
      url: "#",
      icon: (
        <RiFileChartLine
        />
      ),
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: (
        <RiFileLine
        />
      ),
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <RiCommandLine className="size-5!" />
                <span className="text-base font-semibold">Acme Inc.</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
