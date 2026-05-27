"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export interface AgentArtifact {
  id: string;
  type: "chart" | "table" | "metric_grid" | "timeline" | "entity_list";
  title: string;
  description?: string;
  source: {
    provider: string;
    tool: string;
    generated_at: string;
  };
  data: any;
  display: {
    renderer: "line" | "bar" | "area" | "pie" | "table" | "metric_grid" | "timeline";
    x?: string;
    y?: string | string[];
    series?: string;
    unit?: string;
  };
}

const COLORS = ["#2563eb", "#059669", "#dc2626", "#7c3aed", "#d97706"];

function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function formatValue(value: any) {
  if (typeof value === "number") return new Intl.NumberFormat("vi-VN").format(value);
  if (value === null || value === undefined) return "";
  return String(value);
}

export function ArtifactRenderer({ artifact }: { artifact: AgentArtifact }) {
  const rows = Array.isArray(artifact.data) ? artifact.data : [];
  const yKeys = asArray(artifact.display?.y);
  const xKey = artifact.display?.x || "label";

  return (
    <Card className="w-full max-w-3xl rounded-lg border bg-white dark:bg-zinc-900 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">{artifact.title}</h3>
          {artifact.description && <p className="mt-1 text-xs text-muted-foreground">{artifact.description}</p>}
        </div>
        <Badge variant="outline" className="rounded-md text-[10px] uppercase">
          {artifact.source.provider}
        </Badge>
      </div>

      {artifact.display.renderer === "metric_grid" && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {rows.map((item: any, index: number) => (
            <div key={`${item.label}-${index}`} className="rounded-md border bg-muted/20 p-3">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-xl font-black">{formatValue(item.value)}</p>
            </div>
          ))}
        </div>
      )}

      {artifact.display.renderer === "line" && (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {yKeys.map((key, index) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {artifact.display.renderer === "bar" && (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {yKeys.map((key, index) => (
                <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {artifact.display.renderer === "table" && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b text-[10px] uppercase text-muted-foreground">
              <tr>
                {(rows[0] ? Object.keys(rows[0]).filter((key) => key !== "raw" && key !== "replies") : ["message"]).slice(0, 6).map((key) => (
                  <th key={key} className="px-2 py-2 font-bold">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((row: any, index: number) => (
                <tr key={row.id || index} className="border-b last:border-0">
                  {(Object.keys(rows[0] || row).filter((key) => key !== "raw" && key !== "replies")).slice(0, 6).map((key) => (
                    <td key={key} className="max-w-[240px] truncate px-2 py-2">{formatValue(row[key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
