import { config } from 'dotenv';
import { z } from 'zod';

config();

export const Env = z.object({
    TEXT_MODEL_API_KEY: z.string().min(1, 'TEXT_MODEL_API_KEY is required'),
    AUDIO_MODEL_API_KEY: z.string().min(1, 'AUDIO_MODEL_API_KEY is required'),
});
export type EnvType = z.infer<typeof Env>;

export const env = Env.parse(process.env);
