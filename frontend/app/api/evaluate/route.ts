import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 30

const ZG_BASE = "https://router-api.0g.ai/v1"
const MODEL   = "glm-5.2"

export async function POST(req: NextRequest) {
  const apiKey = process.env.ZERO_G_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "ZERO_G_API_KEY not configured" }, { status: 500 })
  }

  const { criteria, output, threshold = 70 } = await req.json()

  const res = await fetch(`${ZG_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an objective AI quality evaluator running inside a Trusted Execution Environment. " +
            "Score outputs against criteria fairly and precisely. " +
            "Return ONLY a valid JSON object with no markdown, no code fences, no extra text.",
        },
        {
          role: "user",
          content: `Evaluate the following AI output against the given criteria. Score from 0 to 100.

CRITERIA:
${criteria}

OUTPUT:
${output}

Return JSON exactly: {"score": <integer 0-100>, "reasoning": "<one concise sentence explaining the score>"}`,
        },
      ],
      temperature: 0,
      max_tokens: 200,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: `0G API ${res.status}: ${body}` }, { status: 502 })
  }

  const data = await res.json()
  const content: string = data.choices?.[0]?.message?.content ?? ""

  const match = content.match(/\{[\s\S]*\}/)
  if (!match) {
    return NextResponse.json({ error: "Could not parse evaluation JSON", raw: content }, { status: 500 })
  }

  const parsed = JSON.parse(match[0])
  const score  = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)))
  const passed = score >= threshold

  return NextResponse.json({ score, passed, reasoning: parsed.reasoning ?? "" })
}
