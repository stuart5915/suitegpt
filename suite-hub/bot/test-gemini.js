import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testGemini() {
    const modelsToTry = [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-3-flash',
        'gemini-3-flash-preview',
        'gemini-2.5-flash-lite'
    ];

    console.log('Testing Gemini API...');
    console.log('API Key:', process.env.GEMINI_API_KEY);

    for (const modelName of modelsToTry) {
        try {
            console.log(`\n🔄 Trying model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Say hello in 5 words');
            const response = result.response.text();
            console.log(`✅ SUCCESS with ${modelName}!`);
            console.log('Response:', response);
            return; // Stop after first success
        } catch (error) {
            console.log(`❌ Failed: ${error.message.split('\n')[0]}`);
        }
    }

    console.error('\n❌ All models failed. Your API key might not have access to any Gemini models.');
    console.error('Create a new API key at: https://aistudio.google.com/apikey');
}

testGemini();
