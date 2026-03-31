import { NextRequest, NextResponse } from "next/server";

const VLLM_URL = process.env.VLLM_URL || "https://nongzhi.ai-muninn.com";

const SYSTEM_PROMPT = `你是台灣作物病蟲害辨識專家。請分析這張作物照片，辨識可能的病害或蟲害。

請簡潔回覆：
1. 觀察到的症狀
2. 最可能的病害/蟲害名稱（中文+英文+學名）
3. 病害類型（真菌/細菌/病毒/蟲害）
4. 建議處理方式（使用台灣常見農藥商品名）
5. 預防措施

用繁體中文回答，不要重複。`;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const cropType = (formData.get("crop_type") as string) || "未知作物";
  const userNote = (formData.get("user_note") as string) || "";

  if (!image) {
    return NextResponse.json({ error: "請上傳圖片" }, { status: 400 });
  }

  const bytes = await image.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  const payload = {
    model: "qwen3.5-35b",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `這是一張${cropType}的照片。請辨識是否有病蟲害，並給出處理建議。${userNote ? `\n\n使用者補充說明：${userNote}` : ""}`,
          },
          {
            type: "image_url",
            image_url: { url: `data:image/${image.type.split("/")[1] || "jpeg"};base64,${base64}` },
          },
        ],
      },
    ],
    max_tokens: 2048,
    temperature: 0.1,
    repetition_penalty: 1.1,
    chat_template_kwargs: { enable_thinking: false },
  };

  const startTime = Date.now();

  try {
    const response = await fetch(`${VLLM_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `AI 服務錯誤: ${response.status}`, detail: errorText },
        { status: 502 }
      );
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;
    const content = data.choices?.[0]?.message?.content || "";
    const tokens = data.usage?.completion_tokens || 0;

    return NextResponse.json({
      result: content,
      latency_ms: latencyMs,
      tokens,
      model: "qwen3.5-35b",
    });
  } catch (err) {
    return NextResponse.json(
      { error: `無法連接 AI 服務: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
