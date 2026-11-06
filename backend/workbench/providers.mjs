const instructions = 'Assist with research tasks. Distinguish source evidence from assumptions. No wallet or payment tools are available. Never claim a purchase or task execution that has not occurred.';
export async function callProvider({ credential, model, prompt, fetchImpl = fetch }) {
  if (typeof model !== 'string' || !/^[a-zA-Z0-9._:/-]{1,100}$/.test(model)) throw new Error('Enter an explicit provider model ID');
  const openai = credential.provider === 'openai';
  const anthropic = credential.provider === 'anthropic', gemini = credential.provider === 'gemini';
  const compatible = { openrouter: 'https://openrouter.ai/api/v1/chat/completions', groq: 'https://api.groq.com/openai/v1/chat/completions' }[credential.provider];
  if (!openai && !anthropic && !gemini && !compatible) throw new Error('Unsupported provider');
  if (gemini && !/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Use a Gemini model ID without a path');
  const endpoint = openai ? 'https://api.openai.com/v1/responses' : anthropic ? 'https://api.anthropic.com/v1/messages'
    : gemini ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` : compatible;
  const response = await fetchImpl(endpoint, {
    method: 'POST', signal: AbortSignal.timeout(45000), redirect: 'error',
    headers: anthropic ? { 'x-api-key': credential.key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
      : gemini ? { 'x-goog-api-key': credential.key, 'Content-Type': 'application/json' }
      : { Authorization: `Bearer ${credential.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(openai ? { model, instructions, input: prompt, max_output_tokens: 800, store: false }
      : anthropic ? { model, system: instructions, messages: [{ role: 'user', content: prompt }], max_tokens: 800 }
      : gemini ? { systemInstruction: { parts: [{ text: instructions }] }, contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 800 } }
      : { model, messages: [{ role: 'system', content: instructions }, { role: 'user', content: prompt }], max_tokens: 800 }),
  });
  if (!response.ok) throw new Error(`${credential.provider} request failed (HTTP ${response.status}); check the model, key and provider limits`);
  const data = await response.json();
  const text = openai ? (data.output ?? []).flatMap(item => item.content ?? []).filter(item => item.type === 'output_text').map(item => item.text).join('\n')
    : anthropic ? (data.content ?? []).filter(item => item.type === 'text').map(item => item.text).join('\n')
    : gemini ? (data.candidates?.[0]?.content?.parts ?? []).map(item => item.text ?? '').join('\n') : data.choices?.[0]?.message?.content;
  const requestId = data.id ?? data.responseId ?? response.headers.get('x-request-id');
  if (!text) throw new Error('Provider returned no usable response');
  return { text, provider: credential.provider, model, requestId: requestId ?? null, usage: data.usage ?? data.usageMetadata ?? null };
}
