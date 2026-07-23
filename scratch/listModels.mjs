import { GoogleGenAI } from '@google/genai'; const ai = new GoogleGenAI({}); ai.models.list().then(async res => { for await (const m of res) { console.log(m.name); } }).catch(console.error);
