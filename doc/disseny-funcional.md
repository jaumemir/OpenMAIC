# Disseny Funcional — OpenMAIC

**Versió:** 1.0 · **Data:** Abril 2026  
**Projecte:** Open Multi-Agent Interactive Classroom (OpenMAIC)  
**Llicència:** AGPL-3.0

---

## 1. Visió General

OpenMAIC és una plataforma educativa basada en intel·ligència artificial que **transforma qualsevol tema o document en una experiència d'aula interactiva**. L'usuari descriu el contingut que vol ensenyar i el sistema genera automàticament:

- **Diapositives** amb text, imatges, gràfics i equacions
- **Quizzes** d'opció múltiple amb retroalimentació detallada
- **Simulacions HTML** interactives (models científics, circuits, mapes, etc.)
- **Activitats PBL** (Project-Based Learning) amb projectes guiats
- **Àudio narratiu** (TTS) per a cada escena
- **Discussions multi-agent** en temps real (agents AI que debaten i expliquen)
- **Pissarra virtual** amb dibuixos, gràfics, equacions LaTeX i taules

El resultat és una "sala de classe" autònoma que es pot reproduir com una classe en directe o explorar interactivament.

---

## 2. Rols d'Usuari

### 2.1 Administrador (`role: admin`)

L'administrador té accés a tot el que té un usuari, més:

| Capacitat | Descripció |
|-----------|-----------|
| Configurar proveïdors LLM | Introduir API keys per a OpenAI, Anthropic, Google, etc. |
| Configurar TTS/ASR/Media | Escollir proveïdors i claus per a veu, transcripció, imatges i vídeos |
| Gestió d'usuaris | Convidar, editar, desactivar i eliminar comptes |
| Llista global de cursos | Veure i eliminar cursos de qualsevol usuari |
| Log d'auditoria | Accés a totes les accions registrades al sistema |
| Models permesos | Definir una llista blanca de models LLM disponibles per als usuaris |

### 2.2 Usuari estàndard (`role: user`)

| Capacitat | Descripció |
|-----------|-----------|
| Crear cursos | Generar cursos a partir de text o PDF |
| Gestionar els seus cursos | Veure, reanomenar i eliminar els seus propis cursos |
| Reproduir cursos | Mode playback autònom o interactiu |
| Preferències personals | Seleccionar model LLM, veu TTS, mode d'agents, etc. |
| Configuració visual | Escollir temes visuals per als cursos |

---

## 3. Casos d'Ús Principals

### CU-01: Generar un Curs des de Text

**Actor:** Usuari autenticat  
**Precondicions:** Model LLM configurat per l'admin (o configuració pròpia si és admin)

**Flux principal:**
1. L'usuari escriu un requisit a la pantalla principal: *"Explica els principis de la termodinàmica per a estudiants de batxillerat, amb exemples pràctics i un quiz"*
2. Opcions addicionals: idioma (CA/EN/ZH-CN), cerca web, tema visual
3. Clica "Generar" (o prem Enter / botó de micròfon)
4. La pantalla de **preview de generació** mostra el progrés pas a pas:
   - Cerca web (si activada)
   - Generació d'esborranys d'escenes (Stage 1)
   - Generació de contingut de la primera escena (Stage 2)
   - Generació d'accions (narracions, pissarra, discussions)
5. En completar la primera escena, el sistema navega a `/classroom/[stageId]`
6. Les escenes restants es generen en segon pla mentre l'usuari ja pot explorar el curs

**Resultat:** Un curs amb 5-8 escenes, cada una amb contingut, narració TTS i accions d'agents

---

### CU-02: Generar un Curs des de Document PDF

**Actor:** Usuari autenticat  
**Precondicions:** Proveïdor PDF configurat

**Flux principal:**
1. A la pantalla principal, l'usuari adjunta un PDF (apunts, article, informe)
2. Escriu un requisit que referencia el document: *"Crea una classe sobre el contingut d'aquest document, amb exemples visuals i exercicis"*
3. El sistema:
   - Parseja el PDF: extreu text i imatges
   - Envia les imatges al model de visió per context
   - Genera escenes que incorporen i referencien el material del PDF
4. Les imatges del PDF apareixen integrades a les diapositives generades

---

### CU-03: Reproduir un Curs (Mode Autònom)

**Actor:** Usuari o estudiant  
**Precondicions:** Curs generat a `/classroom/[id]`

**Flux principal:**
1. L'usuari veu la primera escena
2. Selecciona els agents participants (de 1 a N; pot ser "auto" per deixar-ho al sistema)
3. Clica "Play":
   - Les diapositives es van omplint amb accions animades
   - Els agents "parlen" via TTS mentre apareix text a la pissarra virtual
   - La roundtable mostra els avatars dels agents parlant en torns
   - Les discussions es mostren al xat inferior
4. L'usuari pot pausar, avançar/retrocedir accions, o passar a la següent escena
5. Si hi ha un quiz, pot respondre les preguntes i rebre correcció automàtica

---

### CU-04: Discussió Interactiva en Directe

**Actor:** Docent durant una classe  
**Precondicions:** Curs en reproducció

**Flux principal:**
1. Durant la reproducció, el docent interromp per fer una pregunta (text o veu via ASR)
2. Els agents responen en temps real (LLM + TTS), considerant el context de la discussió
3. El docent pot fer preguntes de seguiment, forçar un altre agent a respondre, o acabar la discussió
4. La conversa es guarda a l'historial del xat d'aquella escena

---

### CU-05: Configuració de Proveïdors (Admin)

**Actor:** Administrador

**Flux principal:**
1. Accedeix a **Configuració** → secció de proveïdors LLM
2. Cada proveïdor (OpenAI, Anthropic, Google, etc.) té:
   - Camp API key (xifrat a la BD, mai visible en clar un cop guardat)
   - URL base personalitzada (opcional, per proxies o endpoints propis)
   - Llista de models: l'admin pot afegir, editar i eliminar models
   - Capacitats per model: streaming, tools, visió, thinking
3. El botó "Desa" fa `PUT /api/admin/config/providers` que xifra les claus i guarda a BD
4. Un cop guardat, tots els usuaris tenen accés als models configurats

---

### CU-06: Gestió d'Usuaris (Admin)

**Actor:** Administrador

**Flux principal:**
1. Accedeix al panell d'administrador → **Gestió d'usuaris**
2. Pot:
   - **Convidar**: introdueix nom + email → el sistema genera un token d'invitació → envia email (si ACS configurat) o mostra URL per compartir manualment
   - **Editar**: nom, cognom, organització, departament, càrrec, ciutat
   - **Canviar rol**: user ↔ admin
   - **Inhabilitar/Habilitar**: bloqueja l'accés sense esborrar dades
   - **Esborrar**: elimina l'usuari i totes les seves dades (amb confirmació)

---

### CU-07: Registre via Invitació

**Actor:** Usuari convidat  
**Precondicions:** Rep email amb URL d'invitació vàlida (token de 24h)

**Flux principal:**
1. Obre l'URL: `/accept-invite?token=xxx`
2. La pàgina mostra el seu nom i email pre-omplerts (des del token)
3. Introdueix una contrasenya (mínim 8 caràcters)
4. Envia el formulari → el sistema crea el compte i inicia sessió
5. Redirigeix a la pantalla principal

---

### CU-08: Recuperació de Contrasenya

**Actor:** Usuari registrat

**Flux principal:**
1. A `/login`, clica "Has oblidat la contrasenya?"
2. Introdueix el seu email → el sistema envia un link de restabliment (expira en 1h)
3. Obre el link → `/reset-password?token=xxx`
4. Introdueix nova contrasenya dues vegades
5. El sistema valida el token, actualitza la contrasenya, invalida el token

---

### CU-09: Gestió de Cursos Propis

**Actor:** Usuari autenticat

**Flux principal:**
1. A la pantalla principal, la secció "Cursos recents" mostra els cursos amb miniatura de la primera diapositiva
2. L'usuari pot:
   - Clicar per obrir el curs (`/classroom/[id]`)
   - Reanomenar (click in-line al títol)
   - Eliminar (amb confirmació)
   - Regenerar àudio TTS (si ha canviat de veu)

---

### CU-10: Exportació i Utilitats

**Actor:** Usuari autenticat

**Funcions addicionals disponibles:**
- **Exportar a PPTX**: Descarrega el curs com a fitxer PowerPoint
- **Exportar a SCORM**: Paquet SCORM per integrar en LMS (Moodle, Canvas, etc.)
- **Exportar a PDF**: Vista imprimible del contingut

---

## 4. Pantalles Principals

### 4.1 Pantalla Principal (Home)

```
┌──────────────────────────────────────────────────────┐
│  [Logo OpenMAIC]                    [Avatar] [Config] │
├──────────────────────────────────────────────────────┤
│                                                      │
│        Hola, [Nom]! Què vols ensenyar avui?          │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Escriu un tema o puja un document...          │  │
│  │                                                │  │
│  │                                    [Micro] [→] │  │
│  └────────────────────────────────────────────────┘  │
│  [Idioma ▼] [Cerca web ☑] [Tema ▼] [PDF ⊕]          │
│                                                      │
│  ── Cursos recents ─────────────────────────────── ▼ │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ [miniatu│ │ [miniatu│ │ [miniatu│ │ [miniatu│   │
│  │ ra]     │ │ ra]     │ │ ra]     │ │ ra]     │   │
│  │ Títol 1 │ │ Títol 2 │ │ Títol 3 │ │ Títol 4 │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└──────────────────────────────────────────────────────┘
```

### 4.2 Preview de Generació

```
┌──────────────────────────────────────────────────────┐
│  ← Enrere                     Generant curs...       │
├──────────────────────────────────────────────────────┤
│                                                      │
│   ● Analitzant document PDF        [✓ completat]    │
│   ● Cerca web                      [✓ completat]    │
│   ● Creant agents d'ensenyament    [✓ completat]    │
│   ● Generant estructura del curs   [en curs... ●●●] │
│   ○ Generant contingut escenes     [pendent]        │
│   ○ Generant àudio i accions       [pendent]        │
│                                                      │
│   [Card agent 1] [Card agent 2] [Card agent 3]      │
│                                                      │
│   "Creant 6 escenes sobre Termodinàmica..."          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 4.3 Sala de Classe (Playback)

```
┌──────────────────────────────────────────────────────────────┐
│  ◀ Escena 2/6: Primer Principi  [▶] [⏸] [⏭] [⚙] [Agents▼] │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────────────────────────┐ ┌──────────┐  │
│ │ Escena 1 │ │                              │ │  Àgent A │  │
│ │ [thumb]  │ │   DIAPOSITIVA / QUIZ /       │ │  parla   │  │
│ │ Escena 2 │ │   INTERACTIVE / PBL          │ │  [avata] │  │
│ │ [thumb ●]│ │                              │ │  Àgent B │  │
│ │ Escena 3 │ │   + PISSARRA VIRTUAL          │ │  escolt  │  │
│ │ [thumb]  │ │     (si activa)              │ │  [avata] │  │
│ │ Escena 4 │ │                              │ └──────────┘  │
│ │ [thumb]  │ └──────────────────────────────┘               │
│ │ Escena 5 │ ┌──────────────────────────────────────────┐   │
│ │ [thumb]  │ │ Agent A: "El primer principi estableix..." │  │
│ │ Escena 6 │ │ Agent B: "Exacte, i una aplicació és..." │   │
│ │ [thumb]  │ │ ┌─────────────────────────────────────┐ │   │
│ └──────────┘ │ │ Escriu una pregunta...    [Micro][→] │ │   │
│              │ └─────────────────────────────────────┘ │   │
│              └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 Panell d'Administrador

```
┌──────────────────────────────────────────────────────┐
│  [← Tornar a l'App]  OpenMAIC Admin                 │
├──────────────────────────────────────────────────────┤
│  Dashboard: 12 usuaris · 47 cursos · 3 jobs actius  │
│                                                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │ 👥 Usuaris │ │ 📚 Cursos  │ │ 🔑 Config  │       │
│  └────────────┘ └────────────┘ └────────────┘       │
│  ┌────────────┐                                      │
│  │ 📋 Auditoria│                                     │
│  └────────────┘                                      │
│                                                      │
│  Activitat recent:                                   │
│  · admin@openmaic.local — CONFIG_UPDATED — fa 2 min │
│  · jaume@example.com — STAGE_CREATED — fa 5 min     │
└──────────────────────────────────────────────────────┘
```

---

## 5. Tipus de Contingut Generat

### 5.1 Diapositiva (Slide)

Equivalent visual a una diapositiva de PowerPoint. Pot contenir:

| Element | Descripció |
|---------|-----------|
| Text | Títols, subtítols, llistes, paràgrafs amb format rich |
| Imatge | Imatges del PDF original o generades per AI (gen_img_*) |
| Forma | Rectangles, cercles, fletxes, línies amb colors temàtics |
| Gràfic | Barres, línies, pastís, dispersió (dades generades per LLM) |
| Equació LaTeX | Fórmules matemàtiques i científiques renderitzades |
| Taula | Dades estructurades amb capçaleres |
| Vídeo | Vídeo generat o embegut (gen_vid_*) |

### 5.2 Quiz

Preguntes d'opció múltiple amb:
- Enunciat i fins a 6 opcions
- Resposta correcta marcada
- Anàlisi/explicació per a cada opció (per quines és incorrecta i per quina és correcta)
- Nivell de dificultat (1-5)
- Correcció automàtica en temps real

### 5.3 Interactiu (HTML)

Simulació interactiva en HTML/CSS/JavaScript injectada en un iframe. Exemples:
- Model molecular (3D amb Three.js)
- Circuit elèctric amb sliders
- Mapa interactiu amb zones clicables
- Animació de processos (cicle de l'aigua, divisió cel·lular, etc.)
- Calculadora científica especialitzada

El codi HTML respecta els colors i estil del tema visual seleccionat.

### 5.4 PBL (Project-Based Learning)

Estructura d'un projecte educatiu amb:
- **Descripció general** del projecte i objectius
- **Issues** (tasques) desglosades: títol, descripció, criteris d'acceptació, dificultat
- **Recursos** suggerits (URLs, materials)
- **Rols** per als membres de l'equip (si és treball en grup)

---

## 6. Sistema d'Agents Virtuals

### 6.1 Tipus d'Agents

Els agents AI representen "professors" o "experts" que participen en la classe:

- **Generats automàticament** (`mode: auto`): El sistema crea 2-3 agents amb noms, rols i personalitats adequats al tema
- **Predefinits** (`mode: preset`): L'usuari ha guardat un conjunt d'agents preferits (p.ex. "Professora Ana" + "Estudiant curiós")

Cada agent té:
- Nom i avatar (emoji o imatge)
- Rol (professor, expert, estudiant, moderador, etc.)
- Persona (descripció del caràcter i estil de comunicació)
- Idioma de preferència

### 6.2 Accions dels Agents

Durant la reproducció, els agents executen accions de forma seqüencial:

| Acció | Descripció |
|-------|-----------|
| `speech` | Narren un text via TTS o text a la pantalla |
| `discussion` | Inicien una ronda de discussió multi-agent |
| `spotlight` | Il·luminen un element de la diapositiva |
| `laser` | Apunten a un element (punter làser virtual) |
| `wb_draw_text` | Escriuen text a la pissarra |
| `wb_draw_shape` | Dibuixen formes (cercles, rectangles, fletxes) |
| `wb_draw_chart` | Dibuixen gràfics a la pissarra |
| `wb_draw_latex` | Escriuen equacions LaTeX a la pissarra |
| `wb_draw_table` | Dibuixen taules a la pissarra |
| `wb_draw_line` | Dibuixen línies lliures |
| `wb_eraser` | Esborren elements de la pissarra |
| `wb_close` | Tanquen la pissarra |
| `play_video` | Reprodueixen un vídeo embegut |

---

## 7. Configuració del Sistema

### 7.1 Configuració Global (Admin)

Emmagatzemada a la BD (`AdminConfig`, clau: `globalConfig`), xifrada amb AES-256-GCM:

- **Proveïdors LLM**: API keys, URL base, llista de models, capacitats per model
- **Proveïdor PDF**: per parsejar documents (GPT-4V, LlamaParse, etc.)
- **Proveïdor TTS**: veu, velocitat, model (OpenAI, Azure, ElevenLabs, etc.)
- **Proveïdor ASR**: model de transcripció (Whisper, Azure, etc.)
- **Proveïdor d'imatges**: DALL-E, Seedream, MiniMax Image, etc.
- **Proveïdor de vídeo**: Sora, Seedance, Kling, Veo, etc.
- **Cerca web**: Tavily, Google Custom Search, etc.
- **Models permesos**: llista blanca opcional; si buida, tots els models disponibles

### 7.2 Preferències d'Usuari

Emmagatzemades a BD (`UserPreferences`), carregades al login:

| Preferència | Valor per defecte | Descripció |
|-------------|------------------|-----------|
| `providerId` | `openai` | Proveïdor LLM preferit |
| `modelId` | `` (primer disponible) | Model específic |
| `ttsEnabled` | `true` | Activar síntesi de veu |
| `asrEnabled` | `true` | Activar reconeixement de veu |
| `imageGenerationEnabled` | `false` | Generar imatges AI |
| `videoGenerationEnabled` | `false` | Generar vídeos AI |
| `asrLanguage` | `zh-CN` | Idioma de reconeixement |
| `agentMode` | `auto` | Mode de selecció d'agents |

### 7.3 Preferències de Layout

Guardades a `localStorage` (no persisteixen al servidor; per sessió/navegador):

- Sidebar col·lapsada o expandida
- Àrea de xat col·lapsada o expandida
- Amplada de l'àrea de xat
- TTS silenciat
- Volum TTS
- Velocitat de reproducció
- Reproducció automàtica de la conferència

---

## 8. Temes Visuals

Els temes defineixen l'aparença dels cursos generats:

| Tema | Descripció |
|------|-----------|
| **sistema** (built-in) | Disseny neutre, professional, colors violeta |
| **gencat** (demo) | Colors de la Generalitat de Catalunya |
| **custom** (del servidor) | Temes pujats per l'admin a `data/themes/` |

Cada tema defineix:
- Paleta de colors (primari, secundari, fons, text, accents)
- Tipografia (font per títols i cos)
- Instruccions per al LLM (estil de contingut, to, vocabulari)
- Assets (logo, banner)

---

## 9. Internacionalització

L'aplicació suporta tres idiomes d'interfície:

| Codi | Idioma |
|------|--------|
| `zh-CN` | Xinès simplificat (per defecte) |
| `en-US` | Anglès |
| `ca` | Català |

El contingut generat pot estar en qualsevol idioma (el model LLM respecta l'idioma seleccionat a la generació).

---

## 10. Seguretat i Privacitat

- **Registre invitation-only**: Cap usuari pot registrar-se sense una invitació de l'admin
- **API keys xifrades**: Mai s'emmagatzemen en clar; xifrades AES-256-GCM a la BD
- **Sessions segures**: Cookies httpOnly, Secure (prod), SameSite=Lax
- **Propietat de cursos**: Cada curs pertany a un usuari; cap altre usuari pot accedir-hi
- **Auditoria**: Totes les accions importants (login, canvis de config, eliminacions) queden registrades
- **Contrasenyes**: Hash Argon2id (algoritme recomanat OWASP 2024)
