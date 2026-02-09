import { GoogleGenAI } from '@google/genai';
import { Coin } from '../types';

export const getCoinAnalysis = async (coin: Coin): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = 'Analyses cette crypto-monnaie: ' + coin.name + ' (' + coin.symbol.toUpperCase() + '). ' +
    'Prix actuel: $' + coin.current_price + '. ' +
    'Record Historique (ATH): $' + coin.ath + '. ' +
    'Record Minimum (ATL): $' + coin.atl + '. ' +
    'Capitalisation: $' + coin.market_cap + '. ' +
    'Fournis un résumé ultra-rapide en 3 phrases maximum sur son potentiel et son état actuel. Utilise un ton professionnel mais dynamique.';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    return response.text || 'Analyse indisponible.';
  } catch (error) {
    console.error('Gemini API Error:', error);
    return 'Erreur lors de la génération de l\'analyse.';
  }
};

export const getCoinDeepReport = async (coin: Coin): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = 'Effectue un rapport d\'analyse COMPLET et DÉTAILLÉ pour la crypto-monnaie ' + coin.name + ' (' + coin.symbol.toUpperCase() + '). ' +
    'Structure le rapport avec ces sections : MISSION ET UTILITÉ, TOKENOMICS, POSITION SUR LE MARCHÉ, DÉVELOPPEMENTS RÉCENTS, ANALYSE DES RISQUES, PERSPECTIVES DE CROISSANCE. ' +
    'Utilise un style "Terminal Quantum" et des informations récentes.';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.4,
      },
    });

    return response.text || 'Le rapport profond est temporairement indisponible.';
  } catch (error) {
    console.error('Gemini Deep Report Error:', error);
    return 'Échec de la synchronisation du rapport profond.';
  }
};

export const getCoinOfficialLinks = async (coin: Coin): Promise<{uri: string, title: string}[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = 'Trouve l\'URL du site web officiel principal de la crypto-monnaie ' + coin.name + ' (' + coin.symbol.toUpperCase() + ').';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const links: {uri: string, title: string}[] = [];
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          links.push({
            uri: chunk.web.uri,
            title: chunk.web.title || 'Site Officiel'
          });
        }
      });
    }

    if (links.length === 0 && response.text) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = response.text.match(urlRegex);
      if (matches) {
        matches.slice(0, 2).forEach(url => links.push({ uri: url.replace(/[.,)]+$/, ''), title: 'Lien Officiel' }));
      }
    }

    return links;
  } catch (error) {
    console.error('Gemini Search Error:', error);
    return [];
  }
};