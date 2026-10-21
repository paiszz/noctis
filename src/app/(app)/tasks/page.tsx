import type { Metadata } from "next";
import { TasksView } from "@/components/tasks/TasksView";

export const metadata: Metadata = {
  title: "Tasks",
  description: "Kelola tugas, prioritas, dan deadline.",
};

export default function TasksPage() {
  return <TasksView />;
}
