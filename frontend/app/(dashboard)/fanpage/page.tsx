"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BarChart3, Inbox, MessageSquare, RefreshCw, Settings, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchWithAuth } from "@/lib/api";
import { AgentArtifact, ArtifactRenderer } from "@/components/shared/ArtifactRenderer";

export default function FanpageManagerPage() {
  const [status, setStatus] = useState<any>(null);
  const [artifacts, setArtifacts] = useState<AgentArtifact[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, dashboardRes, convRes, commentsRes, postsRes] = await Promise.all([
        fetchWithAuth("/meta/fanpage/status"),
        fetchWithAuth("/meta/fanpage/dashboard"),
        fetchWithAuth("/meta/fanpage/conversations?limit=20"),
        fetchWithAuth("/meta/fanpage/comments/unreplied?limit=25"),
        fetchWithAuth("/meta/fanpage/posts?limit=20"),
      ]);

      if (!statusRes.ok) throw new Error("Bạn chưa kết nối Facebook Page hoặc token không hợp lệ.");
      setStatus(await statusRes.json());
      setArtifacts((await dashboardRes.json()).artifacts || []);
      setConversations((await convRes.json()).conversations || []);
      setComments((await commentsRes.json()).comments || []);
      setPosts((await postsRes.json()).posts || []);
    } catch (err: any) {
      setError(err?.message || "Không tải được dữ liệu Fanpage.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fanpage Manager</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={status?.connected ? "default" : "secondary"} className="rounded-md">
              {status?.selected_page_name || "Chưa kết nối Page"}
            </Badge>
            {status?.graph_version && <Badge variant="outline" className="rounded-md">{status.graph_version}</Badge>}
            {status?.webhook_configured && <Badge variant="outline" className="rounded-md">Webhook ready</Badge>}
          </div>
        </div>
        <Button onClick={loadData} disabled={loading} className="h-10 rounded-lg gap-2">
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Sync now
        </Button>
      </div>

      {error && (
        <Card className="rounded-lg border-destructive/30 bg-destructive/5 p-5 text-sm font-semibold text-destructive">
          {error}
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="grid w-full grid-cols-3 rounded-lg md:w-fit md:grid-cols-6">
          <TabsTrigger value="overview" className="gap-2"><BarChart3 className="h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="inbox" className="gap-2"><Inbox className="h-4 w-4" />Inbox</TabsTrigger>
          <TabsTrigger value="comments" className="gap-2"><MessageSquare className="h-4 w-4" />Comments</TabsTrigger>
          <TabsTrigger value="posts" className="gap-2"><FileText className="h-4 w-4" />Posts</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2"><Users className="h-4 w-4" />Contacts</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" />Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {artifacts.length > 0 ? (
            artifacts.map((artifact) => <ArtifactRenderer key={artifact.id} artifact={artifact} />)
          ) : (
            <EmptyState label="Chưa có dữ liệu biểu đồ." />
          )}
        </TabsContent>

        <TabsContent value="inbox">
          <DataList
            rows={conversations}
            empty="Chưa có hội thoại."
            render={(item) => (
              <Row title={item.participant_name || item.participant_id} meta={item.updated_time} body={item.last_message} />
            )}
          />
        </TabsContent>

        <TabsContent value="comments">
          <DataList
            rows={comments}
            empty="Không có comment chưa trả lời."
            render={(item) => (
              <Row title={item.author_name || item.author_id} meta={item.created_time} body={item.message} badge={item.post_id} />
            )}
          />
        </TabsContent>

        <TabsContent value="posts">
          <DataList
            rows={posts}
            empty="Chưa có bài viết."
            render={(item) => (
              <Row
                title={item.message || item.id}
                meta={item.created_time}
                body={`${item.comments_count || 0} comments · ${item.reactions_count || 0} reactions · ${item.shares_count || 0} shares`}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="contacts">
          <Card className="rounded-lg p-5 text-sm text-muted-foreground">
            Contact search hiện nằm trong agent tool `facebook_find_contact`; danh sách contact cache sẽ được lấp dần từ conversations, comments và webhook.
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="rounded-lg p-5">
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <Info label="Page ID" value={status?.selected_page_id} />
              <Info label="Token health" value={status?.token_health?.status || status?.token_health} />
              <Info label="Last sync" value={status?.last_sync_at} />
              <Info label="Scopes" value={(status?.scopes || []).join(", ")} />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <Card className="rounded-lg border-dashed p-10 text-center text-sm font-semibold text-muted-foreground">{label}</Card>;
}

function DataList({ rows, empty, render }: { rows: any[]; empty: string; render: (item: any) => ReactNode }) {
  if (!rows.length) return <EmptyState label={empty} />;
  return <div className="space-y-3">{rows.map((item, index) => <div key={item.id || index}>{render(item)}</div>)}</div>;
}

function Row({ title, meta, body, badge }: { title?: string; meta?: string; body?: string; badge?: string }) {
  return (
    <Card className="rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{title || "Không có tên"}</p>
          {body && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{body}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {badge && <Badge variant="outline" className="max-w-[180px] truncate rounded-md text-[10px]">{badge}</Badge>}
          {meta && <span className="text-[10px] text-muted-foreground">{meta}</span>}
        </div>
      </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value?: any }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value || "N/A"}</p>
    </div>
  );
}
