export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Auth — senha do app
  const { messages, password } = req.body || {};
  const APP_PASSWORD = process.env.ATLAS_PASSWORD;
  if (APP_PASSWORD && password !== APP_PASSWORD) {
    return res.status(401).json({ error: "Senha incorreta" });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Mensagens inválidas" });
  }

  // System prompt vem da variável de ambiente — NUNCA exposto ao frontend
  const SYSTEM_PROMPT = process.env.ATLAS_SYSTEM_PROMPT;
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  const MODEL = process.env.ATLAS_MODEL || "claude-sonnet-4-20250514";

  if (!API_KEY) return res.status(500).json({ error: "API key não configurada no servidor" });
  if (!SYSTEM_PROMPT) return res.status(500).json({ error: "Base de conhecimento não configurada no servidor" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(response.status).json({ error: data.error.message || "Erro na API" });
    }

    const reply = data.content
      ?.map((b) => b.text || "")
      .filter(Boolean)
      .join("\n");

    return res.status(200).json({ reply: reply || "Sem resposta." });
  } catch (e) {
    return res.status(500).json({ error: "Falha na comunicação com a IA: " + e.message });
  }
}
