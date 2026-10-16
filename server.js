require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const crypto = require("crypto");
const path = require("path");
const express = require("express");
const cors = require("cors");

const PORT = Number(process.env.PORT) || 3000;
const IMAGE_WIDTH = 1024;
const IMAGE_HEIGHT = 1024;
const MAX_JOBS = 24;
const PROMPT_LIMIT = 500;
const ENHANCED_LIMIT = 900;

const jobs = new Map();
const hits = new Map();

const PARTICLES = [
  "에서",
  "으로",
  "까지",
  "부터",
  "에게",
  "한테",
  "처럼",
  "같이",
  "보다",
  "마다",
  "을",
  "를",
  "이",
  "가",
  "은",
  "는",
  "의",
  "에",
  "와",
  "과",
  "도",
  "로",
  "만",
  "랑",
];

const STYLE_TOKENS = [
  "애니메이션",
  "픽셀아트",
  "수묵화",
  "동양화",
  "일러스트",
  "지브리",
  "수채화",
  "미니멀",
  "쓰리디",
  "스타일",
  "느낌",
  "유화",
  "픽셀",
  "애니",
  "무드",
  "사진",
  "실사",
  "카툰",
  "만화",
  "손그림",
  "선화",
  "낙서",
  "졸라맨",
  "형식",
];

const RULES = [
  ["비 오는 서울 야경", "a rainy night street in Seoul, simple neon sign shapes and a distant tower"],
  ["우주를 걷는 고양이", "a small cat walking through outer space, simple stars around it"],
  ["한옥 마당의 봄", "a spring courtyard of a traditional Korean hanok, wooden pillars, a stone path, and pale blossoms"],
  ["눈 내리는 제주 돌담", "snow falling over Jeju Island basalt stone walls, a quiet winter village, soft overcast light"],
  ["빨간 우산을 든 소녀", "a girl holding a red umbrella"],
  ["유리 온실", "a glass greenhouse filled with plants"],
  ["서울 야경", "Seoul at night, simple neon sign shapes"],
  ["비 오는", "rainy weather"],
  ["눈 내리는", "falling snow"],
  ["골든아워", "golden hour sunlight"],
  ["사이버펑크", "cyberpunk city lights"],
  ["네온사인", "neon signage"],
  ["광안대교", "Gwangan Bridge"],
  ["경복궁", "Gyeongbokgung Palace"],
  ["해운대", "Haeundae beach"],
  ["남산타워", "Namsan Tower"],
  ["벚꽃", "cherry blossoms"],
  ["단풍", "autumn maple leaves"],
  ["야경", "a night cityscape with neon lights and reflections"],
  ["한옥", "a traditional Korean hanok"],
  ["돌담", "a basalt stone wall"],
  ["마당", "a courtyard"],
  ["골목", "a narrow alley"],
  ["한강", "the Han River"],
  ["남산", "Namsan mountain"],
  ["시장", "a bustling market"],
  ["카페", "a quiet cafe"],
  ["도서관", "a quiet library"],
  ["등대", "a lighthouse"],
  ["폭포", "a waterfall"],
  ["호수", "a calm lake"],
  ["사막", "a desert"],
  ["해변", "a shoreline"],
  ["바다", "the sea"],
  ["숲", "a dense forest"],
  ["정원", "a garden"],
  ["들판", "an open field"],
  ["은하", "a bright galaxy"],
  ["우주", "outer space"],
  ["성", "a castle"],
  ["기차", "a train"],
  ["비행기", "an airplane"],
  ["로봇", "a robot"],
  ["드래곤", "a dragon"],
  ["고양이", "a cat"],
  ["강아지", "a puppy"],
  ["호랑이", "a tiger"],
  ["여우", "a fox"],
  ["고래", "a whale"],
  ["소녀", "a girl"],
  ["소년", "a boy"],
  ["아이", "a child"],
  ["노인", "an elderly person"],
  ["사람", "a person"],
  ["우산", "an umbrella"],
  ["꽃", "flowers"],
  ["달", "the moon"],
  ["별", "stars"],
  ["구름", "soft clouds"],
  ["하늘", "open sky"],
  ["안개", "thick fog"],
  ["노을", "a sunset glow"],
  ["새벽", "blue hour before sunrise"],
  ["아침", "soft morning light"],
  ["밤", "night"],
  ["눈", "snow"],
  ["비", "rain"],
  ["파도", "ocean waves"],
  ["산", "mountains"],
  ["새", "a bird"],
  ["서울", "Seoul"],
  ["부산", "Busan"],
  ["제주", "Jeju Island"],
  ["인천", "Incheon"],
  ["경주", "Gyeongju"],
  ["강릉", "Gangneung"],
  ["전주", "Jeonju"],
  ["속초", "Sokcho"],
  ["여수", "Yeosu"],
  ["명동", "Myeongdong"],
  ["홍대", "Hongdae"],
  ["빨간", "red"],
  ["파란", "blue"],
  ["노란", "yellow"],
  ["하얀", "white"],
  ["검은", "black"],
  ["금빛", "golden"],
  ["네온", "neon"],
  ["따뜻한", "warm"],
  ["차가운", "cold"],
  ["고요한", "quiet and still"],
  ["신비로운", "mysterious"],
  ["귀여운", "cute"],
  ["웅장한", "grand"],
  ["화려한", "vivid"],
  ["걷는", "walking"],
  ["봄", "spring"],
  ["여름", "summer"],
  ["가을", "autumn"],
  ["겨울", "winter"],
  ["도시", "a city"],
  ["거리", "a street"],
];

const LINE_LEAD =
  "The entire image is a simple flat cartoon doodle, full frame, not a photo of a drawing. Thin wobbly black outlines, flat unshaded color fills, stick-figure characters, simple 2D line drawing of";
const LINE_SUFFIX = [
  "hand-drawn doodle style",
  "stick-figure style where applicable",
  "minimalist colors",
  "clean black outlines",
  "rough sketch texture",
  "no gradients, flat design",
  "no shading, no volume, no pencil rendering, no depth",
].join(", ");
const LINE_NEGATIVE =
  "no photorealism, no 3D render, no volumetric lighting, no reflections, no intricate textures, no realistic fur";

const PHOTO_LANGUAGE = [
  /\bphotorealistic\b/gi,
  /\bcinematic(?:\s+lighting)?\b/gi,
  /\bvolumetric(?:\s+lighting)?\b/gi,
  /\b3d(?:\s+render(?:ing)?)?\b/gi,
  /\boctane\b/gi,
  /\bultra detailed\b/gi,
  /\bhighly detailed\b/gi,
  /\bsharp focus\b/gi,
  /\bunreal engine\b/gi,
  /\brealistic\b/gi,
  /\bdepth of field\b/gi,
  /\breflections?\b/gi,
  /\bmirroring\b/gi,
  /\bglobal illumination\b/gi,
];

const GROQ_SYSTEM = [
  "You describe only the subject of an image in English.",
  "Output one line. No quotes, labels, markdown, or explanation.",
  "Preserve the user's subject and setting. Do not invent a different scene.",
  "Do not describe medium, lighting, realism, or rendering.",
  "The image will always be drawn as a simple 2D hand-drawn doodle, so describe shapes a line drawing can show.",
  "If the user asks for photorealism, 3D, or a cinematic look, ignore that and describe only the subject.",
  "Translate Korean faithfully.",
  "Keep it under 40 words.",
  "Do not name living artists.",
].join(" ");

function cleanText(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function scriptStats(text) {
  return {
    hangul: (text.match(/[가-힣]/g) || []).length,
    latin: (text.match(/[A-Za-z]/g) || []).length,
  };
}

function tryConsume(text, start, phrase) {
  if (!phrase || text.slice(start, start + phrase.length) !== phrase) return -1;
  const before = start > 0 ? text[start - 1] : "";
  if (/[가-힣A-Za-z0-9]/.test(before)) return -1;

  let end = start + phrase.length;
  const rest = text.slice(end);
  for (const particle of PARTICLES) {
    if (!rest.startsWith(particle)) continue;
    const next = rest[particle.length] || "";
    if (!/[가-힣]/.test(next)) {
      end += particle.length;
      break;
    }
  }

  const nextChar = text[end] || "";
  if (/[가-힣]/.test(nextChar)) return -1;
  return end;
}

function extractKeywords(original) {
  const sorted = [...RULES].sort((a, b) => b[0].length - a[0].length);
  const found = [];
  let rest = "";
  let index = 0;

  while (index < original.length) {
    let matched = null;
    for (const [phrase, english] of sorted) {
      const end = tryConsume(original, index, phrase);
      if (end > index) {
        matched = { end, english };
        break;
      }
    }

    if (matched) {
      found.push(matched.english);
      index = matched.end;
      rest += " ";
      continue;
    }

    rest += original[index];
    index += 1;
  }

  const unique = [];
  const seen = new Set();
  for (const item of found) {
    if (seen.has(item)) continue;
    seen.add(item);
    unique.push(item);
  }

  return { found: unique, rest: rest.replace(/\s+/g, " ").trim() };
}

function hasSceneHangul(rest) {
  let text = rest;
  const tokens = [...STYLE_TOKENS].sort((a, b) => b.length - a.length);
  for (const token of tokens) text = text.split(token).join(" ");
  text = text.replace(/에서|으로|까지|부터|에게|한테|처럼|같이|은|는|이|가|을|를|의|에|와|과|도|로|만|랑/g, " ");
  return /[가-힣]/.test(text);
}

function stripPhotoLanguage(text) {
  let cleaned = text;
  for (const pattern of PHOTO_LANGUAGE) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, " ");
  }
  return cleaned.replace(/\s+/g, " ").replace(/\s+([,.;])/g, "$1").trim();
}

function enforceLineStyle(scene) {
  const normalized = String(scene || "").replace(/\s+/g, " ").trim();
  if (normalized.startsWith(LINE_LEAD) && normalized.includes(LINE_NEGATIVE)) {
    return normalized.slice(0, ENHANCED_LIMIT);
  }

  const fixed = `, ${LINE_SUFFIX}. ${LINE_NEGATIVE}`;
  const lead = `${LINE_LEAD} `;
  const budget = Math.max(40, ENHANCED_LIMIT - lead.length - fixed.length);
  const subject = cleanText(stripPhotoLanguage(normalized), budget) || "the requested subject";
  return `${lead}${subject}${fixed}`;
}

function enhanceWithRules(input) {
  const original = cleanText(input, PROMPT_LIMIT);
  if (!original) return "";

  const { hangul, latin } = scriptStats(original);
  if (hangul === 0 && latin > 0) return enforceLineStyle(original);

  const { found, rest } = extractKeywords(original);
  let extra = rest.replace(/[가-힣]/g, " ").replace(/\s+/g, " ").trim();
  if (!/[A-Za-z0-9]/.test(extra)) extra = "";

  const subject = [];
  if (found.length) subject.push(found.join(", "));
  if (extra) subject.push(extra);

  let scene;
  if (subject.length === 0) {
    scene = `this idea: "${original}"`;
  } else {
    scene = subject.join(", ");
    if (hasSceneHangul(rest)) scene += `, faithfully depicting: "${original}"`;
  }

  return enforceLineStyle(scene);
}

function groqModels() {
  const configured = process.env.GROQ_MODEL && process.env.GROQ_MODEL.trim();
  return [...new Set([configured, "llama-3.3-70b-versatile", "llama-3.1-8b-instant"].filter(Boolean))];
}

function cleanModelOutput(text) {
  let raw = String(text || "").trim();
  raw = raw.replace(/^```[a-z]*\s*/i, "").replace(/```$/i, "").trim();
  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const withoutLabels = lines.filter((line) => !/^(prompt|enhanced prompt|here|sure|note)\b/i.test(line));
  const chosen = (withoutLabels.length ? withoutLabels : lines).join(" ");
  return cleanText(chosen.replace(/^["']|["']$/g, ""), ENHANCED_LIMIT);
}

async function callGroq(apiKey, model, prompt) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 280,
      messages: [
        { role: "system", content: GROQ_SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(body.slice(0, 180) || `Groq ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const content = cleanModelOutput(data.choices?.[0]?.message?.content || "");
  if (content.length < 8) {
    const error = new Error("Groq 응답이 비어 있습니다.");
    error.status = 502;
    throw error;
  }
  return { text: content, model };
}

async function enhancePrompt(prompt, skipEnhance, provided) {
  if (skipEnhance) {
    const text = enforceLineStyle(provided);
    if (text.length < 2) {
      const error = new Error("다시 만들 프롬프트가 없습니다.");
      error.status = 400;
      throw error;
    }
    return { text, by: "reuse", model: "", notice: "" };
  }

  const apiKey = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim();
  if (!apiKey) {
    return { text: enhanceWithRules(prompt), by: "rules", model: "", notice: "" };
  }

  let lastError = null;
  for (const model of groqModels()) {
    try {
      const result = await callGroq(apiKey, model, prompt);
      return { text: enforceLineStyle(result.text), by: "groq", model: result.model, notice: "" };
    } catch (error) {
      lastError = error;
      console.error(`[groq] ${model} failed (${error.status || "network"}): ${error.message}`);
      if (error.status === 401 || error.status === 403) break;
    }
  }

  const notice =
    lastError?.status === 401 || lastError?.status === 403
      ? "Groq API 키가 올바르지 않아 내장 규칙으로 프롬프트를 확장했습니다."
      : lastError?.status === 429
        ? "Groq 사용량 한도에 도달해 내장 규칙으로 프롬프트를 확장했습니다."
        : "Groq 응답을 받지 못해 내장 규칙으로 프롬프트를 확장했습니다.";

  return { text: enhanceWithRules(prompt), by: "rules", model: "", notice };
}

function pollinationsUrl(prompt, seed) {
  const query = new URLSearchParams({
    width: String(IMAGE_WIDTH),
    height: String(IMAGE_HEIGHT),
    nologo: "true",
    seed: String(seed),
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${query}`;
}

function sniffImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 6) {
    const signature = buffer.toString("ascii", 0, 6);
    if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
  }
  return "";
}

function extensionFor(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response) {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000 + 500, 20000);
  return 8000;
}

async function fetchPollinationsOnce(job, timeoutMs) {
  const response = await fetch(pollinationsUrl(job.enhancedPrompt, job.seed), {
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const error = new Error(`이미지 서버가 ${response.status} 응답을 반환했습니다.`);
    error.status = response.status;
    error.retryAfterMs = retryDelayMs(response);
    await response.arrayBuffer().catch(() => {});
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const sniffed = sniffImage(buffer);
  const headerType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const contentType = sniffed || (headerType.startsWith("image/") ? headerType : "");
  if (!contentType || buffer.length < 500) {
    throw new Error("이미지 데이터를 받지 못했습니다. 다시 시도해 주세요.");
  }
  return { buffer, contentType };
}

async function fetchPollinations(job) {
  const deadline = Date.now() + 85000;
  let lastError = null;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining < 4000) break;

    try {
      return await fetchPollinationsOnce(job, Math.min(remaining, 40000));
    } catch (error) {
      lastError = error;
      const retryable = [402, 408, 429, 500, 502, 503, 504].includes(error.status);
      const delay = Math.min(error.retryAfterMs || 8000, deadline - Date.now() - 4000);
      if (!retryable || attempt === 4 || delay < 1000) break;
      console.log(`[image] ${error.status}, ${delay}ms 후 재시도 (${attempt}/4)`);
      await wait(delay);
    }
  }

  if (lastError?.status === 402 || lastError?.status === 429) {
    const error = new Error("이미지 서버가 잠시 바쁘습니다. 몇 초 뒤 다시 생성해 주세요.");
    error.status = lastError.status;
    throw error;
  }
  throw lastError || new Error("이미지를 가져오지 못했습니다.");
}

async function resolveImage(job) {
  if (job.buffer) return job;
  if (!job.pending) {
    job.pending = fetchPollinations(job)
      .then((image) => {
        job.buffer = image.buffer;
        job.contentType = image.contentType;
        return job;
      })
      .finally(() => {
        job.pending = null;
      });
  }
  return job.pending;
}

function remember(job) {
  jobs.set(job.id, job);
  while (jobs.size > MAX_JOBS) {
    const oldest = jobs.keys().next().value;
    jobs.delete(oldest);
  }
}

function rateLimit(req, res, next) {
  const ip = req.ip || "local";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < 60000);
  if (recent.length >= 30) {
    return res.status(429).json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });
  }
  recent.push(now);
  hits.set(ip, recent);
  next();
}

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  next();
});

app.get("/api/health", (req, res) => {
  const hasGroq = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim());
  res.json({ ok: true, enhance: hasGroq ? "groq" : "rules" });
});

app.post("/api/generate", rateLimit, async (req, res, next) => {
  try {
    const prompt = cleanText(req.body?.prompt, PROMPT_LIMIT);
    if (!prompt) {
      return res.status(400).json({ error: "프롬프트를 입력해 주세요." });
    }

    const skipEnhance = req.body?.skipEnhance === true;
    const enhanced = await enhancePrompt(prompt, skipEnhance, req.body?.enhancedPrompt);
    const seed = crypto.randomInt(0, 2147483647);
    const id = crypto.randomUUID();
    const job = {
      id,
      originalPrompt: prompt,
      enhancedPrompt: enhanced.text,
      seed,
      enhancedBy: enhanced.by,
      model: enhanced.model,
      notice: enhanced.notice,
      buffer: null,
      contentType: "",
      pending: null,
    };
    remember(job);

    console.log(`[generate] by=${enhanced.by} seed=${seed} prompt="${prompt.slice(0, 48)}"`);
    res.json({
      id,
      originalPrompt: prompt,
      enhancedPrompt: enhanced.text,
      seed,
      enhancedBy: enhanced.by,
      model: enhanced.model,
      notice: enhanced.notice,
      imageUrl: `/api/image/${id}`,
      downloadUrl: `/api/image/${id}?download=1`,
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

app.get("/api/image/:id", async (req, res, next) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) {
      return res.status(404).json({ error: "이미지를 찾을 수 없습니다." });
    }
    const job = jobs.get(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "이미지가 만료되었습니다. 다시 생성해 주세요." });
    }

    const ready = await resolveImage(job);
    const download = req.query.download === "1";
    const extension = extensionFor(ready.contentType);
    res.status(200);
    res.set("Content-Type", ready.contentType);
    res.set("Content-Length", String(ready.buffer.length));
    res.set("Cache-Control", "private, max-age=86400");
    res.set(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="lumen-${ready.seed}.${extension}"`
    );
    res.end(ready.buffer);
  } catch (error) {
    console.error(`[image] ${req.params.id} ${error.message}`);
    if (res.headersSent) return;
    const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
    res.status(502).json({
      error: timedOut
        ? "이미지 서버 응답이 지연되고 있습니다. 다시 시도해 주세요."
        : error.message || "이미지를 가져오지 못했습니다.",
    });
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "요청한 API를 찾을 수 없습니다." });
});

app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders(res, filePath) {
      if (/\.(html|js|css)$/.test(filePath)) res.set("Cache-Control", "no-cache");
    },
  })
);

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "요청 형식을 확인해 주세요." });
  }
  console.error(error);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

if (require.main === module) {
  const server = app.listen(PORT, () => {
    const mode = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() ? "Groq" : "내장 규칙";
    console.log(`Lumen running at http://localhost:${PORT}`);
    console.log(`프롬프트 확장: ${mode}`);
  });
  server.requestTimeout = 180000;
  server.headersTimeout = 185000;
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`포트 ${PORT}번이 이미 사용 중입니다. .env의 PORT 값을 바꿔 다시 실행해 주세요.`);
    } else {
      console.error(error);
    }
    process.exit(1);
  });
}

module.exports = { app, enhanceWithRules };
