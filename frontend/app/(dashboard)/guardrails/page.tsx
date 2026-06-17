"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Save, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

type GuardrailsFormState = {
  enabled: boolean;
  action: "warn" | "block";
  policyText: string;
  prohibitedTerms: string;
  requiredPhrases: string;
  maxOutputChars: string;
  inputAction: "warn" | "block";
  inputProhibitedTerms: string;
  inputRequiredPhrases: string;
  maxInputChars: string;
};

const defaultState: GuardrailsFormState = {
  enabled: false,
  action: "warn",
  policyText: "",
  prohibitedTerms: "",
  requiredPhrases: "",
  maxOutputChars: "",
  inputAction: "warn",
  inputProhibitedTerms: "",
  inputRequiredPhrases: "",
  maxInputChars: ""
};

const listToText = (items?: string[]) => (items || []).filter(Boolean).join("\n");
const textToList = (value: string) => value
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

function InfoTooltip({ content }: { content: string }) {
  return (
    <div className="group relative inline-flex items-center justify-center cursor-help self-center">
      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-primary transition-colors" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:block w-56 p-2.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 leading-normal rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-black/10 z-[9999] animate-in fade-in slide-in-from-bottom-1 duration-150 font-semibold select-none text-[10px] text-left opacity-100 font-sans normal-case tracking-normal">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-zinc-900" />
      </div>
    </div>
  );
}

export default function GuardrailsPage() {
  const [formState, setFormState] = useState<GuardrailsFormState>(defaultState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    const loadGuardrails = async () => {
      setIsLoading(true);
      try {
        const res = await fetchWithAuth("/guardrails/system");
        if (!res.ok) {
          throw new Error("Failed to load guardrails");
        }
        const data = await res.json();
        setFormState({
          enabled: Boolean(data.enabled),
          action: data.action === "block" ? "block" : "warn",
          policyText: data.policy_text || "",
          prohibitedTerms: listToText(data.prohibited_terms),
          requiredPhrases: listToText(data.required_phrases),
          maxOutputChars: data.max_output_chars ? String(data.max_output_chars) : "",
          inputAction: data.input_action === "block" ? "block" : "warn",
          inputProhibitedTerms: listToText(data.input_prohibited_terms),
          inputRequiredPhrases: listToText(data.input_required_phrases),
          maxInputChars: data.max_input_chars ? String(data.max_input_chars) : ""
        });
      } catch (error) {
        console.error(error);
        addNotification("error", "Không thể tải guardrails", "Vui lòng thử lại sau.");
      } finally {
        setIsLoading(false);
      }
    };

    loadGuardrails();
  }, [addNotification]);

  const handleSave = async () => {
    const rawMax = formState.maxOutputChars.trim();
    let maxOutputValue: number | null = null;
    if (rawMax) {
      const parsed = Number(rawMax);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        addNotification("warning", "Giá trị không hợp lệ", "Max output chars phải là số dương.");
        return;
      }
      maxOutputValue = parsed;
    }

    const rawMaxInput = formState.maxInputChars.trim();
    let maxInputValue: number | null = null;
    if (rawMaxInput) {
      const parsed = Number(rawMaxInput);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        addNotification("warning", "Giá trị không hợp lệ", "Max input chars phải là số dương.");
        return;
      }
      maxInputValue = parsed;
    }

    setIsSaving(true);
    try {
      const payload = {
        enabled: formState.enabled,
        action: formState.action,
        policy_text: formState.policyText,
        prohibited_terms: textToList(formState.prohibitedTerms),
        required_phrases: textToList(formState.requiredPhrases),
        max_output_chars: maxOutputValue,
        input_action: formState.inputAction,
        input_prohibited_terms: textToList(formState.inputProhibitedTerms),
        input_required_phrases: textToList(formState.inputRequiredPhrases),
        max_input_chars: maxInputValue
      };

      const res = await fetchWithAuth("/guardrails/system", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("Failed to save guardrails");
      }

      addNotification("success", "Đã lưu guardrails", "Cấu hình đã được áp dụng cho tất cả agents.");
    } catch (error) {
      console.error(error);
      addNotification("error", "Lưu thất bại", "Không thể lưu guardrails. Thử lại sau.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cấu hình Guardrails</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium opacity-80">
              Lưu cấu hình bảo mật hệ thống áp dụng đồng bộ cho tất cả Agent trong Workspace.
            </p>
          </div>
        </div>
        
        <Button onClick={handleSave} disabled={isSaving || isLoading} className="gap-2 rounded-xl font-bold px-6 shadow-lg shadow-primary/20">
          <Save className="w-4 h-4" />
          {isSaving ? "Đang lưu..." : "Lưu Cấu hình"}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Main Forms Column */}
        <div className="space-y-6">
          {/* Card 1: Global Activation Switch */}
          <Card className="rounded-2xl border border-muted-foreground/10 bg-white/40 dark:bg-zinc-950/20 backdrop-blur-xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-foreground/90">Kích hoạt Hệ thống bảo vệ Guardrails</p>
                    <InfoTooltip content="Bật/Tắt đồng bộ tất cả bộ lọc bảo vệ ở cả đầu vào (User) và đầu ra (AI). Nếu tắt, hệ thống sẽ bỏ qua mọi bước lọc và kiểm tra." />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">Bật chế độ an toàn để giám sát và phòng chống tấn công Prompt Injection hoặc phát ngôn sai lệch.</p>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={formState.enabled ? "default" : "secondary"} className="font-extrabold text-[9px] uppercase tracking-wide px-2 rounded-md">
                    {formState.enabled ? "Hoạt động" : "Đang tắt"}
                  </Badge>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setFormState((prev) => ({ ...prev, enabled: !prev.enabled }))}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
                      formState.enabled ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        formState.enabled ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Output Guardrails */}
          <Card className="rounded-2xl border border-muted-foreground/10 bg-white/40 dark:bg-zinc-950/20 backdrop-blur-xl shadow-sm">
            <CardHeader className="p-6 border-b bg-muted/5 shrink-0">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-foreground/80">Bộ lọc Đầu ra (Output Guardrails)</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/70 uppercase">
                    <span>Chế độ xử lý vi phạm</span>
                    <InfoTooltip content="Chế độ xử lý khi phát hiện nội dung AI trả về vi phạm bộ lọc. Cảnh báo: Vẫn hiển thị câu trả lời của AI và lưu cảnh báo vào log hệ thống. Chặn: Không hiển thị câu trả lời, thay thế bằng nội dung thông báo chặn an toàn." />
                  </label>
                  <Select
                    value={formState.action}
                    onValueChange={(value) => setFormState((prev) => ({ ...prev, action: value as "warn" | "block" }))}
                  >
                    <SelectTrigger className="w-full rounded-xl border-muted-foreground/20 bg-background/50 h-11">
                      <SelectValue placeholder="Chọn chế độ" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="warn" className="cursor-pointer">Cảnh báo (Giữ câu trả lời)</SelectItem>
                      <SelectItem value="block" className="cursor-pointer">Chặn hoàn toàn (Thay thế nội dung)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/70 uppercase">
                    <span>Max Output Chars</span>
                    <InfoTooltip content="Giới hạn số lượng ký tự tối đa của câu trả lời từ AI. Giúp kiểm soát dung lượng token trả về. Để trống nếu không muốn giới hạn." />
                  </label>
                  <Input
                    placeholder="VD: 1200"
                    className="rounded-xl border-muted-foreground/20 bg-background/50 h-11"
                    value={formState.maxOutputChars}
                    onChange={(event) => setFormState((prev) => ({ ...prev, maxOutputChars: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/70 uppercase">
                  <span>Quy tắc hệ thống (Policy text)</span>
                  <InfoTooltip content="Văn bản mô tả chi tiết các nguyên tắc hệ thống bắt buộc áp dụng cho Agent (ví dụ: phạm vi trả lời, phong cách, cách từ chối khéo léo). Nội dung này sẽ được tự động chèn vào Prompt hệ thống của tất cả các Agent." />
                </label>
                <Textarea
                  placeholder="Ví dụ: Chỉ trả lời các nội dung liên quan đến dịch vụ khách hàng của công ty. Từ chối trả lời các câu hỏi chính trị, tôn giáo..."
                  className="rounded-xl border-muted-foreground/20 bg-background/50 font-medium text-sm leading-relaxed p-4"
                  rows={4}
                  value={formState.policyText}
                  onChange={(event) => setFormState((prev) => ({ ...prev, policyText: event.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/70 uppercase">
                    <span>Từ khóa bị cấm (Prohibited terms)</span>
                    <InfoTooltip content="Quét đầu ra của AI và phát hiện các từ khóa hoặc cụm từ bị cấm xuất hiện (mỗi dòng nhập một từ/cụm từ). Bộ lọc kiểm tra không phân biệt chữ hoa, chữ thường." />
                  </label>
                  <Textarea
                    placeholder="Nhập từ khóa bị cấm...&#10;Từ cấm 1&#10;Từ cấm 2"
                    className="rounded-xl border-muted-foreground/20 bg-background/50 font-medium text-sm leading-relaxed p-4"
                    rows={4}
                    value={formState.prohibitedTerms}
                    onChange={(event) => setFormState((prev) => ({ ...prev, prohibitedTerms: event.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/70 uppercase">
                    <span>Cụm từ bắt buộc (Required phrases)</span>
                    <InfoTooltip content="Đảm bảo câu trả lời của AI luôn có sự xuất hiện của các cụm từ này (mỗi dòng một cụm từ). Hệ thống sẽ kích hoạt cảnh báo hoặc chặn nếu phát hiện câu trả lời thiếu các cụm từ này." />
                  </label>
                  <Textarea
                    placeholder="Nhập cụm từ bắt buộc...&#10;Cụm từ bắt buộc 1&#10;Cụm từ bắt buộc 2"
                    className="rounded-xl border-muted-foreground/20 bg-background/50 font-medium text-sm leading-relaxed p-4"
                    rows={4}
                    value={formState.requiredPhrases}
                    onChange={(event) => setFormState((prev) => ({ ...prev, requiredPhrases: event.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Input Guardrails */}
          <Card className="rounded-2xl border border-muted-foreground/10 bg-white/40 dark:bg-zinc-950/20 backdrop-blur-xl shadow-sm">
            <CardHeader className="p-6 border-b bg-muted/5 shrink-0">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-foreground/80">Bộ lọc Đầu vào (Input Guardrails)</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/70 uppercase">
                    <span>Chế độ xử lý vi phạm</span>
                    <InfoTooltip content="Chế độ xử lý khi phát hiện nội dung người dùng nhập vào vi phạm. Cảnh báo: Vẫn gửi câu hỏi tới LLM nhưng ghi nhận cảnh báo. Chặn: Chặn ngay lập tức trên UI và không gửi câu hỏi tới LLM." />
                  </label>
                  <Select
                    value={formState.inputAction}
                    onValueChange={(value) => setFormState((prev) => ({ ...prev, inputAction: value as "warn" | "block" }))}
                  >
                    <SelectTrigger className="w-full rounded-xl border-muted-foreground/20 bg-background/50 h-11">
                      <SelectValue placeholder="Chọn chế độ" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="warn" className="cursor-pointer">Cảnh báo (Vẫn gọi Model)</SelectItem>
                      <SelectItem value="block" className="cursor-pointer">Chặn ngay (Không gửi tới LLM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/70 uppercase">
                    <span>Max Input Chars</span>
                    <InfoTooltip content="Giới hạn số lượng ký tự tối đa của câu hỏi từ người dùng nhập vào. Tránh trường hợp người dùng chèn lượng văn bản quá lớn để khai thác lỗ hổng bảo mật. Để trống nếu không muốn giới hạn." />
                  </label>
                  <Input
                    placeholder="VD: 600"
                    className="rounded-xl border-muted-foreground/20 bg-background/50 h-11"
                    value={formState.maxInputChars}
                    onChange={(event) => setFormState((prev) => ({ ...prev, maxInputChars: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/70 uppercase">
                    <span>Từ khóa bị cấm (Prohibited terms)</span>
                    <InfoTooltip content="Quét câu hỏi đầu vào của người dùng và phát hiện các từ khóa hoặc cụm từ bị cấm xuất hiện (mỗi dòng một cụm). Bộ lọc kiểm tra không phân biệt chữ hoa, chữ thường." />
                  </label>
                  <Textarea
                    placeholder="Nhập từ khóa bị cấm...&#10;Từ cấm 1&#10;Từ cấm 2"
                    className="rounded-xl border-muted-foreground/20 bg-background/50 font-medium text-sm leading-relaxed p-4"
                    rows={4}
                    value={formState.inputProhibitedTerms}
                    onChange={(event) => setFormState((prev) => ({ ...prev, inputProhibitedTerms: event.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/70 uppercase">
                    <span>Cụm từ bắt buộc (Required phrases)</span>
                    <InfoTooltip content="Yêu cầu câu hỏi của người dùng nhập vào phải có sự xuất hiện của các cụm từ này (mỗi dòng một cụm). Nếu thiếu, hệ thống sẽ cảnh báo hoặc ngăn chặn." />
                  </label>
                  <Textarea
                    placeholder="Nhập cụm từ bắt buộc...&#10;Cụm từ bắt buộc 1&#10;Cụm từ bắt buộc 2"
                    className="rounded-xl border-muted-foreground/20 bg-background/50 font-medium text-sm leading-relaxed p-4"
                    rows={4}
                    value={formState.inputRequiredPhrases}
                    onChange={(event) => setFormState((prev) => ({ ...prev, inputRequiredPhrases: event.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Telemetry Side Rails */}
        <div className="hidden xl:flex flex-col gap-6 sticky top-6">
          <Card className="rounded-2xl border border-muted-foreground/10 bg-white/40 dark:bg-zinc-950/20 backdrop-blur-xl shadow-sm">
            <CardHeader className="p-5 border-b bg-muted/5 flex flex-row items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-[10px] font-mono tracking-widest text-muted-foreground/70 uppercase">Các hạng mục cần thiết</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3.5 text-xs text-muted-foreground font-medium leading-relaxed">
              <div className="flex items-start gap-2.5">
                <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0.5 rounded border-emerald-500/20 text-emerald-600 bg-emerald-500/5">01</Badge>
                <span>Xác định **Policy text** chi tiết làm kim chỉ nam để kiểm soát phạm vi và phản hồi từ chối của Agent.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0.5 rounded border-emerald-500/20 text-emerald-600 bg-emerald-500/5">02</Badge>
                <span>Thiết lập **Đầu ra**: chặn từ ngữ thô tục, bắt buộc đính kèm cụm bản quyền, giới hạn chiều dài phản hồi.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0.5 rounded border-emerald-500/20 text-emerald-600 bg-emerald-500/5">03</Badge>
                <span>Thiết lập **Đầu vào**: phòng ngừa prompt injection, chặn truy vấn trái phép, khống chế ký tự câu hỏi.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-muted-foreground/10 bg-white/40 dark:bg-zinc-950/20 backdrop-blur-xl shadow-sm">
            <CardHeader className="p-5 border-b bg-muted/5 flex flex-row items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-[10px] font-mono tracking-widest text-muted-foreground/70 uppercase">Cơ chế Vận hành</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3.5 text-xs text-muted-foreground font-medium leading-relaxed">
              <div className="flex items-start gap-2.5">
                <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0.5 rounded border-amber-500/20 text-amber-600 bg-amber-500/5">A</Badge>
                <span>Policy text tự động đóng gói và biên dịch trực tiếp vào system instructions của mọi Agent.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0.5 rounded border-amber-500/20 text-amber-600 bg-amber-500/5">B</Badge>
                <span>Truy vấn đầu vào của người dùng được kiểm duyệt tại tầng đệm trước khi gửi đến máy chủ LLM.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0.5 rounded border-amber-500/20 text-amber-600 bg-amber-500/5">C</Badge>
                <span>Nội dung phản hồi được sàng lọc qua màng lọc đầu ra để ngăn ngừa rò rỉ dữ liệu hoặc sai lệch thông tin.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
