# Lumen

키 없이 동작하는 AI 이미지 생성 웹 서비스입니다. 짧은 아이디어를 입력하면 영문 디테일 프롬프트로 다듬은 뒤, [Pollinations AI](https://pollinations.ai) 무료 엔드포인트로 이미지를 만듭니다.

## 실행

Node.js 18 이상이 필요합니다.

```bash
npm install
npm start
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

## 하는 일

- 한국어 아이디어나 영문 문장을 입력해 이미지를 생성합니다.
- 생성 중에는 스피너와 함께 "AI가 그림을 그리는 중..." 상태를 보여 줍니다.
- 결과 이미지 다운로드, 같은 프롬프트로 다시 만들기, 프롬프트 복사를 지원합니다.
- 라이트/다크 테마와 모바일·데스크톱 레이아웃을 지원합니다.

`Ctrl + Enter`(Mac은 `⌘ + Enter`)로도 생성할 수 있습니다.

## 프롬프트 확장

입력한 주제만 영어로 옮기고, 그림 스타일은 항상 같은 규칙으로 고정합니다. 실사나 입체 표현을 적어도 선화 규칙이 우선합니다.

고정 스타일:

- 화면 전체를 채우는 단순한 2D 만화 낙서
- 손그림, 필요하다면 막대 인간
- 얇은 검은 윤곽선, 최소한의 평면 색, 거친 스케치
- 그라데이션 없는 플랫 디자인
- 실사, 3D, 볼류메트릭 조명, 반사, 복잡한 질감, 사실적인 털 표현을 제외

| 조건 | 동작 |
| --- | --- |
| `.env`에 `GROQ_API_KEY`가 없음 | 내장 규칙으로 주제를 영문으로 바꾼 뒤 위 스타일을 붙입니다. |
| Groq 키가 있음 | Llama 3가 주제만 영어로 정리합니다. 돌아온 문장에도 같은 선화 스타일을 다시 붙입니다. |
| 다시 만들기 | 이전에 실사 문장이 남아 있어도 선화 스타일로 다시 감쌉니다. |

Groq 키는 서버에서만 사용합니다. 브라우저로 전달하지 않습니다. 무료 키는 [Groq Console](https://console.groq.com/keys)에서 발급할 수 있으며, 없어도 서비스는 동작합니다.

```bash
cp .env.example .env
```

`.env` 예시:

```
PORT=3000
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

## 프로젝트 구조

```
ai-image-studio/
├── server.js           Express 서버, 프롬프트 확장, 이미지 프록시
├── public/index.html   화면
├── public/style.css    스타일
├── public/app.js       화면 동작
├── .env.example        환경 변수 예시
└── package.json
```

## API

- `POST /api/generate` — 프롬프트를 확장하고 이미지 작업 ID를 돌려줍니다.
- `GET /api/image/:id` — Pollinations 이미지를 같은 출처로 프록시합니다. `?download=1` 이면 파일로 저장됩니다.
- `GET /api/health` — 서버와 프롬프트 확장 방식(`rules` 또는 `groq`)을 확인합니다.

이미지 요청 주소는 아래 형식입니다.

```
https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true&seed={seed}
```

## 알아둘 점

키 없는 Pollinations 응답은 현재 1024를 요청해도 768×768 JPEG로 돌아오고, 모서리에 Pollinations 로고가 남을 수 있습니다. 쓸 수 있는 모델은 `sana`뿐이라, 고양이나 강아지처럼 익숙한 대상은 선화 지시에도 둥근 음영이 남을 수 있습니다. 유료 키가 필요한 `gen.pollinations.ai` 는 사용하지 않습니다.

이미지 서버가 `402`, `429`, `503`처럼 잠시 거절하면 서버가 최대 4번까지 기다렸다가 다시 요청합니다. 이때 화면의 로딩은 1분 가까이 이어질 수 있습니다.

생성된 이미지는 서버 메모리에 잠시 보관됩니다. 서버를 재시작하면 이전 이미지 주소는 만료됩니다.

## 작업 기록

### 2026-10-16

- Express와 정적 화면으로 Lumen을 만들었다. 키 없이 Pollinations로 이미지를 만들고, Groq 키가 있을 때만 Llama 3로 주제를 확장한다.
- 기본 확장이 `photorealistic cinematic`으로 붙어 실사 그림이 나오던 문제를 고쳤다. 모든 입력에 단순한 2D 손그림 선화 스타일과 제외 문장을 강제한다.
- 한 장 생성 뒤 다음 요청이 `402`로 끊기던 문제를 고쳤다. 거절 응답의 `Retry-After`를 보고 다시 요청한다.
- 프롬프트에 종이와 펜을 넣으면 책상 위 그림을 찍은 것처럼 나와, 화면 전체가 평면 만화라는 문장으로 바꿨다.
