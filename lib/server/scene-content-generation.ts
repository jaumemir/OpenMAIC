import { callLLM } from '@/lib/ai/llm';
import {
  applyOutlineFallbacks,
  buildVisionUserContent,
  generateSceneContent,
  type AgentInfo,
} from '@/lib/generation/generation-pipeline';
import { resolveThemeManifest, resolveThemeCSS, resolveThemeInstructions } from '@/lib/generation/theme-instructions';
import { themeToSlideTheme } from '@/lib/generation/theme-utils';
import { createLogger } from '@/lib/logger';
import { resolveModel } from '@/lib/server/resolve-model';
import type {
  GeneratedInteractiveContent,
  GeneratedPBLContent,
  GeneratedQuizContent,
  GeneratedSlideContent,
  ImageMapping,
  PdfImage,
  SceneOutline,
} from '@/lib/types/generation';
import type { SlideTheme } from '@/lib/types/slides';

const log = createLogger('Scene Content API');

export interface SceneContentGenerationModelConfig {
  modelString?: string;
  apiKey?: string;
  baseUrl?: string;
  providerType?: string;
  requiresApiKey?: boolean;
}

export interface SceneContentGenerationInput {
  outline: SceneOutline;
  allOutlines: SceneOutline[];
  pdfImages?: PdfImage[];
  imageMapping?: ImageMapping;
  stageInfo: {
    name: string;
    description?: string;
    language?: string;
    style?: string;
    themeId?: string;
  };
  stageId: string;
  agents?: AgentInfo[];
  modelConfig: SceneContentGenerationModelConfig;
}

export interface SceneContentGenerationResult {
  content:
    | GeneratedSlideContent
    | GeneratedQuizContent
    | GeneratedInteractiveContent
    | GeneratedPBLContent;
  effectiveOutline: SceneOutline;
  slideTheme?: SlideTheme;
}

export async function generateSceneContentFromInput(
  input: SceneContentGenerationInput,
): Promise<SceneContentGenerationResult> {
  const {
    outline: rawOutline,
    allOutlines,
    pdfImages,
    imageMapping,
    stageInfo,
    stageId,
    agents,
    modelConfig,
  } = input;

  if (!rawOutline) {
    throw new Error('outline is required');
  }
  if (!allOutlines || allOutlines.length === 0) {
    throw new Error('allOutlines is required and must not be empty');
  }
  if (!stageId) {
    throw new Error('stageId is required');
  }

  const outline: SceneOutline = {
    ...rawOutline,
    language: rawOutline.language || (stageInfo?.language as 'zh-CN' | 'en-US') || 'zh-CN',
  };

  const { model: languageModel, modelInfo, modelString } = resolveModel(modelConfig);
  const hasVision = !!modelInfo?.capabilities?.vision;

  const aiCall = async (
    systemPrompt: string,
    userPrompt: string,
    images?: Array<{ id: string; src: string }>,
  ): Promise<string> => {
    if (images?.length && hasVision) {
      const result = await callLLM(
        {
          model: languageModel,
          system: systemPrompt,
          messages: [
            {
              role: 'user' as const,
              content: buildVisionUserContent(userPrompt, images),
            },
          ],
          maxOutputTokens: modelInfo?.outputWindow,
        },
        'scene-content',
      );
      return result.text;
    }

    const result = await callLLM(
      {
        model: languageModel,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: modelInfo?.outputWindow,
      },
      'scene-content',
    );
    return result.text;
  };

  const effectiveOutline = applyOutlineFallbacks(outline, !!languageModel);

  let assignedImages: PdfImage[] | undefined;
  if (
    pdfImages &&
    pdfImages.length > 0 &&
    effectiveOutline.suggestedImageIds &&
    effectiveOutline.suggestedImageIds.length > 0
  ) {
    const suggestedIds = new Set(effectiveOutline.suggestedImageIds);
    assignedImages = pdfImages.filter((img) => suggestedIds.has(img.id));
  }

  const generatedMediaMapping: ImageMapping = {};

  log.info(
    `Generating content: "${effectiveOutline.title}" (${effectiveOutline.type}) [model=${modelString}]`,
  );

  const themeInstructions = await resolveThemeInstructions(stageInfo.themeId);

  const content = await generateSceneContent(
    effectiveOutline,
    aiCall,
    assignedImages,
    imageMapping,
    effectiveOutline.type === 'pbl' ? languageModel : undefined,
    hasVision,
    generatedMediaMapping,
    agents,
    themeInstructions || undefined,
  );

  if (!content) {
    log.error(`Failed to generate content for: "${effectiveOutline.title}"`);
    throw new Error(`Failed to generate content: ${effectiveOutline.title}`);
  }

  log.info(`Content generated successfully: "${effectiveOutline.title}"`);

  const themeManifest = await resolveThemeManifest(stageInfo.themeId);
  const slideTheme = themeManifest ? themeToSlideTheme(themeManifest) : undefined;

  // Inject theme CSS into interactive HTML content
  if (stageInfo.themeId && content && 'html' in content && typeof content.html === 'string') {
    const themeCSS = await resolveThemeCSS(stageInfo.themeId);
    if (themeCSS) {
      const styleTag = `<style>\n${themeCSS}\n</style>`;
      content.html = content.html.includes('</head>')
        ? content.html.replace('</head>', `${styleTag}\n</head>`)
        : `${styleTag}\n${content.html}`;
    }
  }

  return { content, effectiveOutline, slideTheme };
}
