const axios = require('axios');

async function fetchSearchResults(query, domains = [], namespace = 'general') {
  if (!process.env.TAVILY_API_KEY) return [];

  try {
    const { data } = await axios.post('https://api.tavily.com/search', {
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: 5,
      search_depth: 'advanced',
      include_domains: domains,
    }, { timeout: 20000 });

    return (data.results || []).map((item) => ({
      namespace,
      title: item.title,
      url: item.url,
      content: item.content || item.snippet || '',
      providerScore: item.score || 0,
    }));
  } catch (err) {
    console.warn(`AI report search failed for "${query}": ${err.message}`);
    return [];
  }
}

module.exports = { fetchSearchResults };
