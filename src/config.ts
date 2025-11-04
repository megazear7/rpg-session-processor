import z from "zod";
import { promises as fs } from 'fs';
import path from "path";

export const Config = z.object({
    models: z.object({
        text: z.object({
            model: z.string().min(1, 'text model is required'),
            baseURL: z.string().min(1, 'text model base URL is required'),
        }),
        audio: z.object({
            model: z.string().min(1, 'audio model is required'),
            baseURL: z.string().min(1, 'audio model base URL is required'),
        }),
    }),
});
export type Config = z.infer<typeof Config>;

export const config = Config.parse(await fs.readFile(path.join(process.cwd(), 'config.json'), 'utf-8'));
