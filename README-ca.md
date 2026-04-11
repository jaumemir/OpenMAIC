<!-- <p align="center">
  <img src="assets/logo-horizontal.png" alt="OpenMAIC" width="420"/>
</p> -->

<p align="center">
  <img src="assets/banner.png" alt="OpenMAIC Banner" width="680"/>
</p>

<p align="center">
  Obteniu una experiència d'aprenentatge immersiva i multi-agent amb un sol clic
</p>

<p align="center">
  <strong>Edició Enterprise</strong> — un fork d'<a href="https://github.com/THU-MAIC/OpenMAIC">OpenMAIC</a> preparat per a entorns empresarials, amb autenticació, gestió d'usuaris, emmagatzematge al servidor, exportació SCORM i desplegament a Azure
</p>

<p align="center">
  <a href="https://jcst.ict.ac.cn/en/article/doi/10.1007/s11390-025-6000-0"><img src="https://img.shields.io/badge/Paper-JCST'26-blue?style=flat-square" alt="Paper"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=flat-square" alt="License: AGPL-3.0"/></a>
  <a href="https://open.maic.chat/"><img src="https://img.shields.io/badge/Demo-Live-brightgreen?style=flat-square" alt="Live Demo"/></a>
  <a href="#-integració-openclaw"><img src="https://img.shields.io/badge/OpenClaw-Integration-F4511E?style=flat-square" alt="OpenClaw Integration"/></a>
  <a href="https://github.com/THU-MAIC/OpenMAIC/stargazers"><img src="https://img.shields.io/github/stars/THU-MAIC/OpenMAIC?style=flat-square" alt="Stars"/></a>
  <br/>
  <a href="https://discord.gg/PtZaaTbH"><img src="https://img.shields.io/badge/Discord-Join_Community-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"/></a>
  &nbsp;
  <a href="community/feishu.md"><img src="https://img.shields.io/badge/Feishu-飞书交流群-00D6B9?style=for-the-badge&logo=bytedance&logoColor=white" alt="Feishu"/></a>
  <br/>
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/LangGraph-1.1-purple?style=flat-square" alt="LangGraph"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"/>
</p>

<p align="center">
  <a href="./README.md">English</a> | <strong>Català</strong>
  <br/>
  <a href="https://open.maic.chat/">Demo en Viu</a> · <a href="#-inici-ràpid">Inici Ràpid</a> · <a href="#-funcionalitats">Funcionalitats</a> · <a href="#-casos-dús">Casos d'Ús</a> · <a href="#-integració-openclaw">OpenClaw</a>
</p>


## 🗞️ Novetats

- **2026-03-26** — [v0.1.0 publicat!](https://github.com/THU-MAIC/OpenMAIC/releases/tag/v0.1.0) TTS en discussions, mode immersiu, dreceres de teclat, millores a la pissarra, nous proveïdors i molt més. Vegeu el [registre de canvis](CHANGELOG.md).

## 📖 Descripció

**OpenMAIC** (Open Multi-Agent Interactive Classroom) és una plataforma d'IA de codi obert que transforma qualsevol tema o document en una experiència d'aula interactiva i enriquidora. Amb orquestració multi-agent, genera diapositives, qüestionaris, simulacions interactives i activitats d'aprenentatge basat en projectes (PBL) — tot impartit per professors i companys d'IA que poden parlar, dibuixar a la pissarra i mantenir discussions en temps real. Amb la integració integrada d'[OpenClaw](https://github.com/openclaw/openclaw), podeu generar aules directament des d'aplicacions de missatgeria com Feishu, Slack o Telegram.

**Aquest repositori és una evolució orientada a l'empresa del projecte original OpenMAIC**, adaptat per a desplegaments organitzatius on l'autenticació, l'aïllament de dades i el compliment normatiu importa. Preserva totes les capacitats bàsiques d'aula d'IA mentre afegeix infraestructura de qualitat productiva:

- **Autenticació i gestió d'usuaris** — Registre només per invitació amb rols d'Administrador i Usuari. El panell d'administració cobreix la gestió d'usuaris (convidar, editar, desactivar), la configuració global de models, l'emmagatzematge de cursos per usuari i un registre d'auditoria complet.
- **Emmagatzematge al servidor** — Tot el contingut dels cursos (escenes, multimèdia, àudio TTS) es persisteix al servidor: filesystem + SQLite en desenvolupament; Azure Blob Storage + PostgreSQL en producció. Res crític no viu al navegador.
- **Aïllament de cursos per usuari** — Cada usuari veu només els seus propis cursos; els administradors tenen una vista global de tots els usuaris.
- **Azure Communication Services** — Correus d'invitació i de restabliment de contrasenya enviats a través d'Azure, amb plantilles adaptades al locale de l'usuari.
- **Exportació SCORM 1.2** — Exporteu aules completes — narració, vídeo i elements interactius — com a paquets SCORM 1.2 per a plataformes LMS corporatives com Moodle.
- **Azure AI Foundry TTS** — Nou proveïdor de text a veu amb models Azure Foundry per a veus multilingües d'alta qualitat.
- **Desplegament basat en contenidors** — Es distribueix com a contenidor Docker dissenyat per a Azure Container Apps o qualsevol host compatible amb OCI.

https://github.com/user-attachments/assets/b4ab35ac-f994-46b1-8957-e82fe87ff0e9

### Punts Destacats

- **Generació de lliçons amb un clic** — Descriu un tema o adjunta materials; la IA construeix una lliçó completa en minuts
- **Aula multi-agent** — Professors i companys d'IA fan lliçons, debaten i interactuen amb tu en temps real
- **Tipus d'escenes variades** — Diapositives, qüestionaris, simulacions HTML interactives i aprenentatge basat en projectes (PBL)
- **Pissarra i TTS** — Els agents dibuixen diagrames, escriuen fórmules i expliquen en veu alta amb múltiples proveïdors de veu
- **Exportació flexible** — Diapositives `.pptx` editables, pàgines `.html` interactives i paquets **SCORM 1.2** per a plataformes LMS corporatives
- **Preparat per a l'empresa** — Control d'accés basat en rols, gestió d'usuaris per invitació, panell d'administració i emmagatzematge al servidor
- **[Integració OpenClaw](#-integració-openclaw)** — Genera aules des de Feishu, Slack, Telegram i 20+ aplicacions de missatgeria

---

> [!TIP]
> ### <img src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/openclaw.png" height="28" align="top"/> OpenClaw — Usa OpenMAIC des de la teva app de xat, sense cap configuració
>
> Amb [OpenClaw](https://github.com/openclaw/openclaw), podeu generar aules directament des de Feishu, Slack, Discord, Telegram i 20+ aplicacions de missatgeria.
>
> 1. `clawhub install openmaic` o simplement digueu al vostre Claw *"install OpenMAIC skill"*
> 2. Trieu un mode:
>    - **Mode allotjat** — Obteniu un codi d'accés a [open.maic.chat](https://open.maic.chat/), sense configuració local
>    - **Mode autoallotjat** — La skill us guia pas a pas per clonar, configurar i iniciar
> 3. Digueu al vostre assistent *"ensenya'm física quàntica"* — fet!
>
> [Més informació →](#-integració-openclaw)

---

## 🚀 Inici Ràpid

### Requisits Previs

- **Node.js** >= 20
- **pnpm** >= 10

### 1. Clona i Instal·la

```bash
git clone https://github.com/jaumemir/OpenMAIC.git
cd OpenMAIC
pnpm install
```

### 2. Configura

```bash
cp .env.example .env.local
```

Defineix les variables obligatòries:

```env
# Autenticació — genera amb: openssl rand -hex 32
BETTER_AUTH_SECRET=<secret-aleatori>
BETTER_AUTH_URL=http://localhost:3000

# Clau de xifratge de la configuració — 64 caràcters hex (32 bytes): openssl rand -hex 32
CONFIG_ENCRYPTION_KEY=<64-hex-chars>

# Correu electrònic — Azure Communication Services (necessari per a invitacions i restabliment de contrasenya)
ACS_CONNECTION_STRING=endpoint=https://...
ACS_SENDER_ADDRESS=noreply@elteudomain.com
```

Per a producció, afegeix també la URL de la base de dades i la URL pública de l'aplicació:

```env
DATABASE_URL=postgresql://usuari:contrasenya@host:5432/openmaic
BETTER_AUTH_URL=https://elteudomain.com
```

> **Els proveïdors LLM es configuren des del panell d'administració** després del primer inici de sessió — no calen claus d'API a `.env.local`. Les credencials s'emmagatzemen xifrades amb AES-256-GCM a la base de dades i es filtren per rol d'usuari.
>
> Opcionalment, defineix `DEFAULT_MODEL=google:gemini-2.5-flash-preview` com a model de reserva del servidor durant la configuració inicial. Consulta `.env.example` per a totes les opcions disponibles: TTS, ASR, generació d'imatges/vídeo, anàlisi de PDF, cerca web i molt més.

### 3. Executa

```bash
pnpm dev
```

Obre **http://localhost:3000** i comença a aprendre!

### 4. Build per a Producció

```bash
pnpm build && pnpm start
```

### Desplegament amb Docker

La manera recomanada d'executar l'Edició Enterprise d'OpenMAIC en producció és com a contenidor Docker:

```bash
cp .env.example .env.local
# Omple les variables obligatòries (auth secret, clau de xifratge, correu, URL de BD)
docker compose up --build
```

La imatge es construeix amb `output: 'standalone'` (Next.js), la qual cosa la fa adequada per a qualsevol runtime compatible amb OCI — Docker Compose, Azure Container Apps, AWS ECS o Kubernetes.

> **Primera configuració:** un cop iniciada la imatge, obre l'aplicació i completa la creació del compte d'administrador. Llavors inicia sessió com a admin i configura els teus proveïdors LLM a **Configuració → Proveïdors**.

### Opcional: MinerU (Anàlisi Avançada de Documents)

[MinerU](https://github.com/opendatalab/MinerU) proporciona anàlisi millorada per a taules complexes, fórmules i OCR. Podeu usar l'[API oficial de MinerU](https://mineru.net/) o [allotjar la vostra pròpia instància](https://opendatalab.github.io/MinerU/quick_start/docker_deployment/).

Definiu `PDF_MINERU_BASE_URL` (i `PDF_MINERU_API_KEY` si és necessari) a `.env.local`.

---

## ✨ Funcionalitats

### Generació de Lliçons

Descriu allò que vols aprendre o adjunta materials de referència. El pipeline de dues etapes d'OpenMAIC fa la resta:

| Etapa | Què Passa |
|-------|-----------|
| **Esquema** | La IA analitza la teva entrada i genera un esquema de lliçó estructurat |
| **Escenes** | Cada element de l'esquema es converteix en una escena rica — diapositives, qüestionaris, mòduls interactius o activitats PBL |

### Components de l'Aula

<table>
<tr>
<td width="50%" valign="top">

**🎓 Diapositives**

Els professors d'IA imparteixen lliçons amb narració per veu, efectes de spotlight i animacions de punter làser — com una aula real.

<img src="assets/slides.gif" width="100%"/>

</td>
<td width="50%" valign="top">

**🧪 Qüestionari**

Qüestionaris interactius (resposta única, múltiple o oberta) amb correcció i retroalimentació en temps real per part de la IA.

<img src="assets/quiz.gif" width="100%"/>

</td>
</tr>
<tr>
<td width="50%" valign="top">

**🔬 Simulació Interactiva**

Experiments interactius basats en HTML per a un aprenentatge visual i pràctic — simuladors de física, diagrames de flux i molt més.

<img src="assets/interactive.gif" width="100%"/>

</td>
<td width="50%" valign="top">

**🏗️ Aprenentatge Basat en Projectes (PBL)**

Tria un rol i col·labora amb agents d'IA en projectes estructurats amb fites i lliuraments.

<img src="assets/pbl.gif" width="100%"/>

</td>
</tr>
</table>

### Interacció Multi-Agent

<table>
<tr>
<td valign="top">

- **Discussió a l'Aula** — Els agents inicien debats proactivament; tu pots intervenir en qualsevol moment o ser cridat a participar
- **Debat de Taula Rodona** — Múltiples agents amb personalitats diverses debaten un tema, amb il·lustracions a la pissarra
- **Mode Preguntes i Respostes** — Fes preguntes lliurement; el professor d'IA respon amb diapositives, diagrames o dibuixos a la pissarra
- **Pissarra** — Els agents d'IA dibuixen en una pissarra compartida en temps real — resolent equacions pas a pas, esbossant diagrames o il·lustrant conceptes visualment

</td>
<td width="360" valign="top">

<img src="assets/discussion.gif" width="340"/>

</td>
</tr>
</table>

### <img src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/openclaw.png" height="22" align="top"/> Integració OpenClaw

<table>
<tr>
<td valign="top">

OpenMAIC s'integra amb [OpenClaw](https://github.com/openclaw/openclaw) — un assistent d'IA personal que es connecta a les plataformes de missatgeria que ja utilitzes (Feishu, Slack, Discord, Telegram, WhatsApp, etc.). Amb aquesta integració, podeu **generar i visualitzar aules interactives directament des de la vostra app de xat** sense mai tocar un terminal.

</td>
<td width="360" valign="top">

<img src="assets/openclaw-feishu-demo.gif" width="340"/>

</td>
</tr>
</table>

Simplement digueu al vostre assistent OpenClaw allò que voleu aprendre — ell s'encarrega de la resta:

- **Mode allotjat** — Obteniu un codi d'accés d'[open.maic.chat](https://open.maic.chat/), deseu-lo a la vostra configuració i genereu aules a l'instant — sense configuració local
- **Mode autoallotjat** — Cloneu, instal·leu les dependències, configureu les claus d'API i inicieu el servidor — la skill us guia pas a pas
- **Seguiment del progrés** — Consulta el job de generació asíncron i t'envia l'enllaç quan estigui llest

Cada pas demana la vostra confirmació primer. Sense automatitzacions de caixa negra.

<table><tr><td>

**Disponible a ClawHub** — Instal·la amb una comanda:

```bash
clawhub install openmaic
```

O copia manualment:

```bash
mkdir -p ~/.openclaw/skills
cp -R /path/to/OpenMAIC/skills/openmaic ~/.openclaw/skills/openmaic
```

</td></tr></table>

<details>
<summary>Configuració i detalls</summary>

| Fase | Què fa la skill |
|------|----------------|
| **Clonar** | Detecta un checkout existent o pregunta abans de clonar/instal·lar |
| **Inici** | Tria entre `pnpm dev`, `pnpm build && pnpm start` o Docker |
| **Claus de Proveïdor** | Recomana un camí de proveïdor; tu edites `.env.local` manualment |
| **Generació** | Envia un job de generació asíncron i fa polling fins que es completa |

Configuració opcional a `~/.openclaw/openclaw.json`:

```jsonc
{
  "skills": {
    "entries": {
      "openmaic": {
        "config": {
          // Mode allotjat: enganxa el teu codi d'accés d'open.maic.chat
          "accessCode": "sk-xxx",
          // Mode autoallotjat: ruta local del repositori i URL
          "repoDir": "/path/to/OpenMAIC",
          "url": "http://localhost:3000"
        }
      }
    }
  }
}
```

</details>

### Exportació

| Format | Descripció |
|--------|------------|
| **PowerPoint (.pptx)** | Diapositives totalment editables amb imatges, gràfics i fórmules LaTeX renderitzades via MathML |
| **HTML Interactiu** | Pàgines web autocontingudes amb simulacions interactives i estils del tema incrustats |
| **SCORM 1.2** | Paquets complets d'aula (àudio de narració, vídeo, escenes interactives) per a Moodle i altres plataformes LMS corporatives |

### I Molt Més

- **Text a Veu** — Múltiples proveïdors: OpenAI, Azure AI Foundry, Google, ElevenLabs, MiniMax i més
- **Reconeixement de Veu** — Parla amb el teu professor d'IA usant el micròfon
- **Cerca Web** — Els agents cerquen a la web informació actualitzada durant la classe
- **Temes** — Temes integrats i personalitzats amb sobreescriptura de colors i instruccions de model; CSS injectat en les exportacions HTML interactives
- **i18n** — Interfície disponible en xinès (zh-CN), anglès (en-US), català (ca), japonès (ja-JP) i rus (ru-RU)
- **Mode Fosc** — Còmode per a les sessions d'estudi nocturnes
- **Registre d'Auditoria** — Totes les accions d'administrador es registren amb usuari, marca de temps i càrrega útil per a compliment normatiu i traçabilitat

---

## 💡 Casos d'Ús

<table>
<tr>
<td width="50%" valign="top">

> *"Teach me Python from scratch in 30 min"*

<img src="assets/python.gif" width="100%"/>

</td>
<td width="50%" valign="top">

> *"How to play the board game Avalon"*

<img src="assets/avalon.gif" width="100%"/>

</td>
</tr>
<tr>
<td width="50%" valign="top">

> *"Analyze the stock prices of Zhipu and MiniMax"*

<img src="assets/zhipu-minimax.gif" width="100%"/>

</td>
<td width="50%" valign="top">

> *"Break down the latest DeepSeek paper"*

<img src="assets/deepseek.gif" width="100%"/>

</td>
</tr>
</table>

---

## 🤝 Contribuir

Donem la benvinguda a les contribucions de la comunitat! Tant si són informes d'errors, idees de funcionalitats o pull requests — tot ajuda.

### Estructura del Projecte

```
OpenMAIC/
├── app/                        # Next.js App Router
│   ├── (admin)/                #   Admin panel (SSR layout guard — admin role required)
│   │   └── admin/
│   │       ├── page.tsx        #     Dashboard: statistics + navigation
│   │       ├── users/          #     User management (invite, edit, deactivate)
│   │       ├── courses/        #     Global course list with owner info
│   │       ├── audit/          #     Audit log viewer
│   │       └── config/         #     Global config (allowed models, LLM providers)
│   ├── (auth)/                 #   Authentication pages
│   │   ├── login/
│   │   ├── accept-invite/      #     Invitation acceptance form (locale-aware)
│   │   └── reset-password/     #     Password reset form (locale-aware)
│   ├── api/                    #   Server API routes
│   │   ├── auth/               #     better-auth routes + forgot/reset password
│   │   ├── admin/              #     Admin-only endpoints
│   │   │   ├── config/         #       LLM provider config (AES-256-GCM encrypted, DB-backed)
│   │   │   ├── users/          #       User CRUD + invitation dispatch
│   │   │   ├── audit/          #       Audit log
│   │   │   └── stages/         #       All stages (admin view)
│   │   ├── generate/           #     Scene generation pipeline (outlines, content, TTS, images …)
│   │   ├── generate-classroom/ #     Async classroom job submission + polling
│   │   ├── chat/               #     Multi-agent discussion (SSE streaming)
│   │   ├── stages/             #     Course stages CRUD (owner-protected)
│   │   ├── themes/             #     Theme management
│   │   ├── user/               #     User profile + preferences
│   │   └── invitations/        #     Token verification + acceptance
│   ├── classroom/[id]/         #   Classroom playback page
│   └── page.tsx                #   Home page (course generation input)
│
├── lib/                        # Core business logic
│   ├── auth/                   #   better-auth server instance + client hooks
│   ├── ai/                     #   LLM provider abstraction (20+ providers)
│   ├── generation/             #   Two-stage lesson generation pipeline + prompt templates
│   ├── orchestration/          #   LangGraph multi-agent orchestration (director graph)
│   ├── server/                 #   Server utilities: requireAuth, config crypto, SSRF guard
│   ├── store/                  #   Zustand state stores (settings, user prefs, layout)
│   ├── types/                  #   Centralized TypeScript type definitions
│   ├── audio/                  #   TTS & ASR providers
│   ├── media/                  #   Image & video generation providers
│   ├── export/                 #   PPTX, HTML & SCORM 1.2 export
│   ├── hooks/                  #   React custom hooks
│   ├── i18n/                   #   i18next + locales (zh-CN, en-US, ca, ja-JP, ru-RU)
│   └── ...                     #   prosemirror, pdf, web-search, utils
│
├── components/                 # React UI components
│   ├── slide-renderer/         #   Canvas-based slide editor & renderer
│   ├── scene-renderers/        #   Quiz, Interactive, PBL scene renderers
│   ├── settings/               #   Settings panel (providers, TTS, ASR, media …)
│   ├── whiteboard/             #   SVG-based whiteboard drawing
│   └── ...                     #   header, generation toolbar, agent, chat, ui primitives
│
├── prisma/                     # Database schema & migrations
│   ├── schema.dev.prisma       #   SQLite (development)
│   ├── schema.prod.prisma      #   PostgreSQL (production)
│   └── migrations/             #   Applied SQLite migrations
│
├── packages/                   # Workspace packages
│   ├── pptxgenjs/              #   Customised PowerPoint generation library
│   └── mathml2omml/            #   MathML → Office Math XML conversion
│
├── skills/                     # OpenClaw / ClawHub skills
│   └── openmaic/               #   Guided OpenMAIC setup & generation SOP
│
├── configs/                    # Shared constants (shapes, fonts, hotkeys, themes …)
├── data/                       # Server-side data — not committed (filesystem storage in dev)
│   └── themes/                 #   Custom themes
└── public/                     # Static assets (logos, avatars)
```

### Arquitectura Clau

- **Autenticació i RBAC** (`lib/auth/`, `app/(auth)/`, `app/api/auth/`) — sessions better-auth amb registre només per invitació, rols d'Administrador i Usuari, i flux de restabliment de contrasenya via Azure Communication Services
- **Panell d'Administració** (`app/(admin)/`) — dashboard protegit per SSR per a la gestió d'usuaris, configuració de proveïdors LLM (xifrada AES-256-GCM a la BD amb filtratge de models per usuari) i registre d'auditoria
- **Emmagatzematge al Servidor** (`lib/server/`, `app/api/stages/`) — tot el contingut dels cursos (escenes, multimèdia, àudio TTS) persistit via `/api/stages/*`; filesystem + SQLite en desenvolupament, Azure Blob Storage + PostgreSQL en producció
- **Pipeline de Generació** (`lib/generation/`) — dues etapes: generació d'esquema → generació del contingut de l'escena
- **Orquestració Multi-Agent** (`lib/orchestration/`) — màquina d'estats LangGraph que gestiona els torns dels agents i les discussions
- **Motor de Reproducció** (`lib/playback/`) — màquina d'estats que controla la reproducció de l'aula i la interacció en viu
- **Motor d'Accions** (`lib/action/`) — executa 28+ tipus d'acció (speech, whiteboard draw/text/shape/chart, spotlight, laser …)

### Com Contribuir

1. Fes un fork del repositori
2. Crea la teva branca de funcionalitat (`git checkout -b feature/nova-funcionalitat`)
3. Fes commit dels canvis (`git commit -m 'Add nova funcionalitat'`)
4. Puja la branca (`git push origin feature/nova-funcionalitat`)
5. Obre una Pull Request

---

## 💼 Llicència Comercial

Aquest projecte té llicència AGPL-3.0. Per a consultes sobre llicències comercials, poseu-vos en contacte amb: **thu_maic@tsinghua.edu.cn**

---

## 📝 Citació

Aquest repositori és una obra derivada de [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC). Si utilitzeu la plataforma subjacent en la vostra recerca, citeu l'article original:

```bibtex
@Article{JCST-2509-16000,
  title = {From MOOC to MAIC: Reimagine Online Teaching and Learning through LLM-driven Agents},
  journal = {Journal of Computer Science and Technology},
  volume = {},
  number = {},
  pages = {},
  year = {2026},
  issn = {1000-9000(Print) /1860-4749(Online)},
  doi = {10.1007/s11390-025-6000-0},
  url = {https://jcst.ict.ac.cn/en/article/doi/10.1007/s11390-025-6000-0},
  author = {Ji-Fan Yu and Daniel Zhang-Li and Zhe-Yuan Zhang and Yu-Cheng Wang and Hao-Xuan Li and Joy Jia Yin Lim and Zhan-Xin Hao and Shang-Qing Tu and Lu Zhang and Xu-Sheng Dai and Jian-Xiao Jiang and Shen Yang and Fei Qin and Ze-Kun Li and Xin Cong and Bin Xu and Lei Hou and Man-Li Li and Juan-Zi Li and Hui-Qin Liu and Yu Zhang and Zhi-Yuan Liu and Mao-Song Sun}
}
```

---

## ⭐ Historial d'Estrelles

[![Star History Chart](https://api.star-history.com/svg?repos=THU-MAIC/OpenMAIC&type=Date)](https://star-history.com/#THU-MAIC/OpenMAIC&Date)

---

## 📄 Llicència

Aquest projecte té llicència [GNU Affero General Public License v3.0](LICENSE).
