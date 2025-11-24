import pkg from 'contentful-management';
import { env } from './env.js'

const { createClient } = pkg;
const client = createClient({
  accessToken: env.CONTENTFUL_MANAGEMENT_API_KEY,
});

function textToRichText(text: string) {
    return {
        nodeType: 'document',
        data: {},
        content: [
            {
                nodeType: 'paragraph',
                data: {},
                content: [
                    {
                        nodeType: 'text',
                        value: text,
                        marks: [],
                        data: {}
                    }
                ]
            }
        ]
    };
}

export async function createEvent(
    title: string,
    summary: string,
    description: string,
    dmNotes: string,
): Promise<void> {
    const space = await client.getSpace(env.CONTENTFUL_SPACE_ID);
    const environment = await space.getEnvironment('master');
    const entry = await environment.createEntry('event', {
        fields: {
            title: { 'en-US': title },
            summary: { 'en-US': textToRichText(summary) },
            description: { 'en-US': textToRichText(description) },
            dmNotes: { 'en-US': textToRichText(dmNotes) },
        },
    });

    console.log(`Edit and publish this event at:\nhttps://app.contentful.com/spaces/${env.CONTENTFUL_SPACE_ID}/entries/${entry.sys.id}`);
}
