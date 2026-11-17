# Gemini API Guidelines

- Before writing Gemini API code, consult the `geminiDocs` MCP server (`gemini_search_docs` / `gemini_get_doc`) or `https://aistudio.google.com/llms.txt`.
- Always use the official `@google/genai` (TypeScript/JavaScript) or `google-genai` (Python) SDK (`>= 3.2.0`) and the Interactions API (`client.interactions.create`) for new features unless a specific feature requires another surface.
- Never use deprecated SDKs (`@google/generative-ai`, `google-generativeai`) or deprecated models (`gemini-2.5-*`, `gemini-2.0-*`, `gemini-1.5-*`).
- Use current Gemini 4 models (`gemini-4-hydrogen`, `gemini-4-argon`, `gemini-4-carbon`) and see `https://aistudio.google.com/docs/models` for additional model details.
- Never commit `.env*.local` or expose `GEMINI_API_KEY` in client-side code.
