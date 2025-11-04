import z from "zod";
import OpenAI from "openai";
import { env } from "./env.js";
import { config } from "./config.js";

export const ClientModel = z.object({
    client: z.instanceof(OpenAI),
    apiKey: z.string().min(1, 'API key is required'),
    model: z.string().min(1, 'model is required'),
    baseURL: z.string().min(1, 'base URL is required'),
});
export type ClientModel = z.infer<typeof ClientModel>;

export const textClientModel: ClientModel = {
    client: new OpenAI({
        apiKey: env.TEXT_MODEL_API_KEY,
        baseURL: config.models.text.baseURL,
    }),
    apiKey: env.TEXT_MODEL_API_KEY,
    model: config.models.text.model,
    baseURL: config.models.text.baseURL,
};

export const audioClientModel: ClientModel = {
    client: new OpenAI({
        apiKey: env.AUDIO_MODEL_API_KEY,
        baseURL: config.models.audio.baseURL,
    }),
    apiKey: env.AUDIO_MODEL_API_KEY,
    model: config.models.audio.model,
    baseURL: config.models.audio.baseURL,
};
