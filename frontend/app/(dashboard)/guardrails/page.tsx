"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Save, CheckCircle2, AlertTriangle } from "lucide-react";
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Guardrails</h1>
              <p className="text-muted-foreground mt-1 text-sm font-medium opacity-80">
                Lưu theo Workspace/System, áp dụng cho tất cả agents.
              </p>
            </div>
          </div>
        </div>
        <div />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
        <Card className="rounded-[0.75rem]">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Cấu hình guardrails</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Nhập đầy đủ thông tin, backend sẽ lưu và áp dụng ngay cho mỗi phiên chat.
              </p>
            </div>
            <Badge variant={formState.enabled ? "default" : "secondary"}>
              {formState.enabled ? "Đang bật" : "Đang tắt"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Bật guardrails</p>
                <p className="text-xs text-muted-foreground">Nếu tắt, không chèn vào prompt và không kiểm tra output.</p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-muted"
                  checked={formState.enabled}
                  onChange={(event) => setFormState((prev) => ({ ...prev, enabled: event.target.checked }))}
                  disabled={isLoading}
                />
              </label>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">Guardrails đầu ra (Output)</p>
              <p className="text-xs text-muted-foreground">
                Kiểm tra nội dung AI trả về trước khi hiển thị cho người dùng.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Chế độ xử lý vi phạm</label>
                <Select
                  value={formState.action}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, action: value as "warn" | "block" }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn chế độ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warn">Cảnh báo (giữ output)</SelectItem>
                    <SelectItem value="block">Chặn (thay thế output)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Backend kiểm tra output; nếu vi phạm sẽ cảnh báo hoặc chặn theo chế độ này.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max output chars</label>
                <Input
                  placeholder="VD: 1200"
                  value={formState.maxOutputChars}
                  onChange={(event) => setFormState((prev) => ({ ...prev, maxOutputChars: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Để trống nếu không giới hạn.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Policy text (system prompt)</label>
              <Textarea
                placeholder="Mô tả các quy tắc bắt buộc: phạm vi, từ chối, cách hỏi lại..."
                rows={6}
                value={formState.policyText}
                onChange={(event) => setFormState((prev) => ({ ...prev, policyText: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Backend sẽ chèn vào system instructions cho tất cả agents.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Prohibited terms (output)</label>
                <Textarea
                  placeholder="Mỗi dòng một từ/chuỗi bị cấm"
                  rows={6}
                  value={formState.prohibitedTerms}
                  onChange={(event) => setFormState((prev) => ({ ...prev, prohibitedTerms: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Backend sẽ đổi sang danh sách, kiểm tra chứa chuỗi vi phạm (không phân biệt hoa thường).
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Required phrases (output)</label>
                <Textarea
                  placeholder="Mỗi dòng một cụm bắt buộc"
                  rows={6}
                  value={formState.requiredPhrases}
                  onChange={(event) => setFormState((prev) => ({ ...prev, requiredPhrases: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Backend sẽ kiểm tra thiếu cụm bắt buộc và cảnh báo/chặn.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-border/60 space-y-4">
              <div>
                <p className="text-sm font-semibold">Guardrails đầu vào (Input)</p>
                <p className="text-xs text-muted-foreground">Kiểm tra nội dung người dùng trước khi gọi model.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Chế độ xử lý vi phạm</label>
                  <Select
                    value={formState.inputAction}
                    onValueChange={(value) => setFormState((prev) => ({ ...prev, inputAction: value as "warn" | "block" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn chế độ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warn">Cảnh báo (vẫn xử lý)</SelectItem>
                      <SelectItem value="block">Chặn (không gửi model)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Nếu vi phạm, backend sẽ cảnh báo hoặc chặn trước khi gọi model.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max input chars</label>
                  <Input
                    placeholder="VD: 600"
                    value={formState.maxInputChars}
                    onChange={(event) => setFormState((prev) => ({ ...prev, maxInputChars: event.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Để trống nếu không giới hạn.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prohibited terms (input)</label>
                  <Textarea
                    placeholder="Mỗi dòng một từ/chuỗi bị cấm"
                    rows={6}
                    value={formState.inputProhibitedTerms}
                    onChange={(event) => setFormState((prev) => ({ ...prev, inputProhibitedTerms: event.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Backend kiểm tra nội dung đầu vào chứa các cụm bị cấm.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Required phrases (input)</label>
                  <Textarea
                    placeholder="Mỗi dòng một cụm bắt buộc"
                    rows={6}
                    value={formState.inputRequiredPhrases}
                    onChange={(event) => setFormState((prev) => ({ ...prev, inputRequiredPhrases: event.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Backend kiểm tra thiếu cụm bắt buộc trong nội dung đầu vào.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button onClick={handleSave} disabled={isSaving || isLoading} className="gap-2 rounded-[0.5rem]">
                <Save className="w-4 h-4" />
                {isSaving ? "Đang lưu..." : "Lưu guardrails"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[0.75rem]">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">Cần điền gì?</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Tóm tắt phần bắt buộc cho cả input và output.</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px]">1</Badge>
                <span>Policy text rõ ràng cho toàn hệ thống: phạm vi, từ chối, cách hỏi lại.</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px]">2</Badge>
                <span>Output: từ/chuỗi cấm, cụm bắt buộc, giới hạn độ dài nếu cần.</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px]">3</Badge>
                <span>Input: từ/chuỗi cấm, cụm bắt buộc, giới hạn độ dài nếu cần.</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px]">4</Badge>
                <span>Chọn chế độ xử lý cho cả input/output (cảnh báo hoặc chặn).</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[0.75rem]">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">Backend xử lý ra sao?</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Luồng xử lý từ input đến output.</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px]">A</Badge>
                <span>Chèn policy text vào system instructions của mỗi agent.</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px]">B</Badge>
                <span>Kiểm tra input trước khi gọi model (từ cấm, cụm bắt buộc, độ dài).</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px]">C</Badge>
                <span>Kiểm tra output cuối và cảnh báo/chặn theo cấu hình.</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px]">D</Badge>
                <span>Gửi thông báo guardrails về UI để hiển thị rõ input/output.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
