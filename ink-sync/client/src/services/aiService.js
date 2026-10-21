import api from './api'; // This uses your existing axios instance with the auth token

export const generateAIDiagram = async (prompt) => {
  try {
    const response = await api.post('/ai/generate', { prompt });
    return response.data.operations;
  } catch (error) {
    console.error('AI Service Error:', error);
    throw error;
  }
};