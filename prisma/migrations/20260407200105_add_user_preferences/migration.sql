-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL DEFAULT 'openai',
    "model_id" TEXT NOT NULL DEFAULT '',
    "tts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "asr_enabled" BOOLEAN NOT NULL DEFAULT true,
    "image_generation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "video_generation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "asr_language" TEXT NOT NULL DEFAULT 'zh-CN',
    "agent_mode" TEXT NOT NULL DEFAULT 'auto',
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
