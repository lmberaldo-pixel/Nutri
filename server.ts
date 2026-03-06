import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", hasApiKey: !!process.env.GEMINI_API_KEY });
  });

  // Debug middleware
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // API routes FIRST
  app.post("/api/extract-food", async (req, res) => {
    const { text } = req.body;
    console.log("[Server] Extracting food from:", text);
    if (!text) return res.status(400).json({ error: "Text is required" });

    if (!process.env.GEMINI_API_KEY) {
      console.error("[Server] GEMINI_API_KEY is missing!");
      return res.status(500).json({ error: "Configuração do servidor incompleta (API Key ausente)" });
    }

    try {
      const ai = getAI();
      // Try gemini-1.5-flash as it's the most reliable for basic tasks if gemini-3 fails
      const modelName = "gemini-1.5-flash"; 
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `Analise o seguinte texto e identifique todos os alimentos. Para cada item, forneça a contagem estimada de calorias com base na quantidade mencionada (ex: "20g", "uma colher"). Se a quantidade não for especificada, assuma uma porção padrão.
        Retorne APENAS um array JSON de objetos com 'name' (string), 'calories' (number) e 'amount' (string, opcional). 
        Texto: ${text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                calories: { type: Type.NUMBER },
                amount: { type: Type.STRING },
              },
              required: ["name", "calories"],
            },
          },
        },
      });

      const responseText = response.text || "[]";
      console.log("[Server] Gemini response:", responseText);
      
      // Clean the response string just in case
      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleanJson));
    } catch (error: any) {
      console.error("[Server] Extraction error:", error);
      res.status(500).json({ 
        error: "Erro na IA", 
        details: error.message,
        code: error.status || 500
      });
    }
  });

  app.post("/api/search-food", async (req, res) => {
    const { description } = req.body;
    console.log("[Server] Searching food for:", description);
    if (!description) return res.status(400).json({ error: "Description is required" });

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "API Key ausente no servidor" });
    }

    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `O usuário disse: "${description}". Identifique os alimentos e suas contagens calóricas estimadas. Use o Google Search para encontrar informações precisas para as quantidades específicas mencionadas (ex: "20g", "uma colher", "um pote"). 
        Retorne APENAS um array JSON de objetos com 'name' (string), 'calories' (number) e 'amount' (string, opcional). 
        Exemplo: [{"name": "Mel", "calories": 60, "amount": "20g"}]`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "[]";
      console.log("[Server] Gemini search response:", text);
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleanJson));
    } catch (error: any) {
      console.error("[Server] Search error:", error);
      res.status(500).json({ error: "Erro na busca de calorias", details: error.message });
    }
  });

  app.get("/api/proxy-fetch", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const text = await response.text();
      res.json({ content: text });
    } catch (error: any) {
      console.error("Proxy fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch URL" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
      },
      appType: "spa",
    });
    
    app.use(vite.middlewares);

    app.get("*", async (req, res, next) => {
      // Skip API and Vite-handled assets (anything with an extension like .tsx, .js, .css)
      if (req.originalUrl.startsWith('/api') || req.path.includes('.')) return next();
      
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        // Transform the HTML to inject Vite client and resolve paths
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
