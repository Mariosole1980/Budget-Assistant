/**
 * functions/api/geo.js
 * 
 * Cloudflare Pages Function at Edge:
 * Detects visitor country from IP headers and recommends 'el' for Greece/Cyprus or 'en' for rest of world.
 */
export async function onRequest(context) {
  const { request } = context;

  // Cloudflare provides the 2-letter ISO country code in context.request.cf.country or 'cf-ipcountry'
  const country = (context.request.cf && context.request.cf.country) 
    || request.headers.get('cf-ipcountry') 
    || 'GR';
    
  const greekTerritories = ['GR', 'CY'];
  const isGreek = greekTerritories.includes(country.toUpperCase());
  const recommendedLang = isGreek ? 'el' : 'en';

  const payload = {
    country: country.toUpperCase(),
    isGreek: isGreek,
    recommendedLang: recommendedLang
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'private, no-cache'
    }
  });
}
