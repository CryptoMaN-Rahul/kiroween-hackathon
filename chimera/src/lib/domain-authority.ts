/**
 * Domain Authority Lookup
 * 
 * Production-grade domain authority scoring using free APIs.
 * Falls back to heuristic scoring when APIs are unavailable.
 * 
 * Uses Open PageRank API (free, no API key required for basic usage)
 * https://www.domcop.com/openpagerank/
 * 
 * @module domain-authority
 */

// =============================================================================
// Types
// =============================================================================

export interface DomainAuthorityResult {
  domain: string;
  score: number;
  source: 'api' | 'cache' | 'heuristic';
  confidence: number;
  fetchedAt?: Date;
}

export interface DomainAuthorityConfig {
  /** Open PageRank API key (optional, increases rate limit) */
  apiKey?: string;
  /** Cache TTL in seconds (default: 86400 = 24 hours) */
  cacheTtlSeconds?: number;
  /** Request timeout in ms (default: 5000) */
  timeoutMs?: number;
  /** Whether to use heuristic fallback (default: true) */
  useFallback?: boolean;
}

interface OpenPageRankResponse {
  status_code: number;
  response: Array<{
    domain: string;
    page_rank_decimal: number;
    rank: string;
    status_code: number;
  }>;
}

// =============================================================================
// Static Domain Database (Fallback)
// =============================================================================

const KNOWN_DOMAIN_SCORES: Record<string, number> = {
  // ==========================================================================
  // Tier 1: Major platforms (95-100)
  // ==========================================================================
  'google.com': 100, 'youtube.com': 100, 'facebook.com': 96, 'twitter.com': 94,
  'x.com': 94, 'linkedin.com': 98, 'instagram.com': 95, 'wikipedia.org': 98,
  'github.com': 96, 'amazon.com': 96, 'apple.com': 95, 'microsoft.com': 95,
  'netflix.com': 93, 'spotify.com': 92, 'tiktok.com': 91, 'pinterest.com': 90,
  'whatsapp.com': 92, 'zoom.us': 88, 'dropbox.com': 87, 'salesforce.com': 90,
  'adobe.com': 92, 'oracle.com': 90, 'ibm.com': 91, 'intel.com': 89,
  'nvidia.com': 88, 'amd.com': 85, 'cisco.com': 88, 'vmware.com': 85,
  'paypal.com': 90, 'stripe.com': 85, 'square.com': 82, 'shopify.com': 86,
  'atlassian.com': 86, 'notion.so': 80, 'figma.com': 82, 'canva.com': 83,
  'openai.com': 88, 'anthropic.com': 82, 'huggingface.co': 80,
  
  // ==========================================================================
  // Tier 2: Major news/media (85-95)
  // ==========================================================================
  'nytimes.com': 95, 'wsj.com': 94, 'bbc.com': 96, 'cnn.com': 94,
  'reuters.com': 95, 'apnews.com': 93, 'theguardian.com': 94,
  'washingtonpost.com': 93, 'forbes.com': 92, 'bloomberg.com': 93,
  'usatoday.com': 91, 'nbcnews.com': 92, 'cbsnews.com': 91, 'abcnews.go.com': 91,
  'foxnews.com': 90, 'huffpost.com': 88, 'politico.com': 89, 'axios.com': 87,
  'theatlantic.com': 89, 'newyorker.com': 90, 'economist.com': 91,
  'time.com': 90, 'newsweek.com': 87, 'latimes.com': 89, 'chicagotribune.com': 86,
  
  // ==========================================================================
  // Tier 3: Tech media (80-92)
  // ==========================================================================
  'techcrunch.com': 91, 'wired.com': 90, 'theverge.com': 89,
  'arstechnica.com': 88, 'engadget.com': 87, 'zdnet.com': 86,
  'venturebeat.com': 85, 'thenextweb.com': 84, 'mashable.com': 85,
  'cnet.com': 89, 'gizmodo.com': 84, 'techradar.com': 83, 'tomshardware.com': 82,
  'anandtech.com': 81, 'digitaltrends.com': 80, '9to5mac.com': 79, '9to5google.com': 78,
  'macrumors.com': 80, 'androidcentral.com': 77, 'windowscentral.com': 76,
  'protocol.com': 82, 'semafor.com': 78, 'theinformation.com': 85,
  
  // ==========================================================================
  // Tier 4: Developer resources (75-95)
  // ==========================================================================
  'stackoverflow.com': 95, 'dev.to': 80, 'medium.com': 85,
  'hashnode.dev': 75, 'hackernoon.com': 78, 'freecodecamp.org': 82,
  'css-tricks.com': 78, 'smashingmagazine.com': 80,
  'npmjs.com': 88, 'pypi.org': 85, 'rubygems.org': 82, 'crates.io': 80,
  'docs.microsoft.com': 90, 'developer.mozilla.org': 92, 'w3schools.com': 78,
  'digitalocean.com': 83, 'aws.amazon.com': 92, 'cloud.google.com': 91,
  'azure.microsoft.com': 90, 'heroku.com': 80, 'vercel.com': 82, 'netlify.com': 81,
  'gitlab.com': 85, 'bitbucket.org': 82, 'codepen.io': 77, 'jsfiddle.net': 75,
  'replit.com': 76, 'codesandbox.io': 75, 'glitch.com': 74,
  
  // ==========================================================================
  // Tier 5: Social/Community (70-92)
  // ==========================================================================
  'reddit.com': 91, 'quora.com': 85, 'discord.com': 80,
  'slack.com': 82, 'producthunt.com': 78,
  'news.ycombinator.com': 88, 'lobste.rs': 72, 'slashdot.org': 75,
  'dribbble.com': 78, 'behance.net': 80, 'deviantart.com': 76,
  'twitch.tv': 85, 'vimeo.com': 82, 'dailymotion.com': 75,
  
  // ==========================================================================
  // Tier 6: Business/Finance (75-92)
  // ==========================================================================
  'businessinsider.com': 90, 'inc.com': 88, 'entrepreneur.com': 87,
  'fastcompany.com': 86, 'hbr.org': 88, 'fortune.com': 87,
  'cnbc.com': 91, 'marketwatch.com': 88, 'seekingalpha.com': 82,
  'investopedia.com': 85, 'fool.com': 80, 'barrons.com': 86,
  'ft.com': 92, 'crunchbase.com': 80,
  'glassdoor.com': 82, 'indeed.com': 85, 'monster.com': 78,
  
  // ==========================================================================
  // Tier 7: E-commerce (75-95)
  // ==========================================================================
  'ebay.com': 93, 'walmart.com': 92, 'target.com': 90, 'bestbuy.com': 88,
  'etsy.com': 85, 'alibaba.com': 88, 'aliexpress.com': 82,
  'wayfair.com': 80, 'overstock.com': 75, 'newegg.com': 78, 'zappos.com': 80,
  
  // ==========================================================================
  // Tier 8: Education (80-95)
  // ==========================================================================
  'coursera.org': 88, 'udemy.com': 82, 'edx.org': 86, 'khanacademy.org': 87,
  'udacity.com': 80, 'pluralsight.com': 78, 'skillshare.com': 75,
  'mit.edu': 95, 'stanford.edu': 95, 'harvard.edu': 95, 'berkeley.edu': 94,
  'yale.edu': 94, 'princeton.edu': 94, 'columbia.edu': 93, 'cornell.edu': 93,
  'ox.ac.uk': 94, 'cam.ac.uk': 94, 'ethz.ch': 92,
  
  // ==========================================================================
  // Tier 9: Government/Official (85-95)
  // ==========================================================================
  'gov.uk': 92, 'usa.gov': 90, 'europa.eu': 91, 'un.org': 92,
  'who.int': 91, 'cdc.gov': 90, 'nih.gov': 91, 'fda.gov': 89,
  'sec.gov': 88, 'ftc.gov': 87, 'fcc.gov': 86,
  
  // ==========================================================================
  // Tier 10: Regional domains (70-90)
  // ==========================================================================
  // UK
  'bbc.co.uk': 95, 'theguardian.co.uk': 93, 'telegraph.co.uk': 88,
  'independent.co.uk': 86, 'dailymail.co.uk': 82, 'mirror.co.uk': 78,
  // Germany
  'spiegel.de': 88, 'zeit.de': 86, 'faz.net': 85, 'sueddeutsche.de': 84,
  'heise.de': 82, 'golem.de': 78,
  // France
  'lemonde.fr': 88, 'lefigaro.fr': 85, 'liberation.fr': 82,
  // Japan
  'nikkei.com': 86, 'asahi.com': 84, 'mainichi.jp': 82,
  // India
  'timesofindia.indiatimes.com': 85, 'hindustantimes.com': 82, 'ndtv.com': 80,
  // Australia
  'abc.net.au': 88, 'smh.com.au': 84, 'theaustralian.com.au': 82,
  // Canada
  'cbc.ca': 88, 'globalnews.ca': 82, 'theglobeandmail.com': 84,
  
  // ==========================================================================
  // Tier 11: Industry-specific (70-88)
  // ==========================================================================
  // Healthcare
  'webmd.com': 85, 'mayoclinic.org': 90, 'healthline.com': 82,
  'medicalnewstoday.com': 78, 'drugs.com': 75, 'rxlist.com': 72,
  'clevelandclinic.org': 88, 'hopkinsmedicine.org': 89, 'medscape.com': 80,
  'everydayhealth.com': 75, 'verywellhealth.com': 76, 'health.com': 78,
  // Legal
  'law.cornell.edu': 88, 'findlaw.com': 80, 'justia.com': 78,
  'nolo.com': 75, 'avvo.com': 72, 'lawyers.com': 70, 'martindale.com': 72,
  'lexisnexis.com': 82, 'westlaw.com': 82, 'law360.com': 78,
  // Real Estate
  'zillow.com': 85, 'realtor.com': 82, 'redfin.com': 80,
  'trulia.com': 78, 'apartments.com': 75, 'homes.com': 72, 'movoto.com': 70,
  // Travel
  'tripadvisor.com': 88, 'booking.com': 86, 'expedia.com': 85,
  'airbnb.com': 85, 'kayak.com': 80, 'hotels.com': 78, 'vrbo.com': 78,
  'skyscanner.com': 80, 'priceline.com': 78, 'travelocity.com': 75,
  // Food
  'yelp.com': 85, 'allrecipes.com': 80, 'foodnetwork.com': 78,
  'epicurious.com': 76, 'seriouseats.com': 75, 'bonappetit.com': 78,
  'delish.com': 72, 'tasty.co': 70, 'food52.com': 74,
  // Sports
  'espn.com': 92, 'sports.yahoo.com': 88, 'bleacherreport.com': 82,
  'cbssports.com': 85, 'nba.com': 88, 'nfl.com': 88, 'mlb.com': 87,
  'fifa.com': 85, 'uefa.com': 84, 'premierleague.com': 82, 'nhl.com': 85,
  'theathletic.com': 82, 'sportingnews.com': 78, 'si.com': 85,
  // Gaming
  'ign.com': 85, 'gamespot.com': 82, 'kotaku.com': 78,
  'polygon.com': 80, 'pcgamer.com': 78, 'eurogamer.net': 76,
  'rockpapershotgun.com': 74, 'destructoid.com': 72, 'gamesradar.com': 75,
  'steam.com': 88, 'epicgames.com': 82, 'playstation.com': 85, 'xbox.com': 85,
  // Science
  'nature.com': 94, 'science.org': 93, 'scientificamerican.com': 88,
  'newscientist.com': 85, 'livescience.com': 78, 'phys.org': 80,
  'arxiv.org': 90, 'pubmed.ncbi.nlm.nih.gov': 92, 'sciencedirect.com': 88,
  'researchgate.net': 82, 'academia.edu': 78, 'scholar.google.com': 90,
  
  // ==========================================================================
  // Tier 12: Startup/VC Ecosystem (70-88)
  // ==========================================================================
  'ycombinator.com': 88, 'a16z.com': 85, 'sequoiacap.com': 84,
  'accel.com': 82, 'greylock.com': 80, 'benchmark.com': 80,
  'angellist.com': 78, 'f6s.com': 70, 'startupgrind.com': 72,
  'techstars.com': 78, '500.co': 75, 'seedcamp.com': 72,
  'indiehackers.com': 75, 'betalist.com': 68, 'launchingnext.com': 65,
  
  // ==========================================================================
  // Tier 13: Regional News - Asia (70-88)
  // ==========================================================================
  // China (English)
  'scmp.com': 85, 'chinadaily.com.cn': 78, 'globaltimes.cn': 72,
  // South Korea
  'koreaherald.com': 78, 'koreatimes.co.kr': 76, 'en.yna.co.kr': 80,
  // Singapore
  'straitstimes.com': 82, 'channelnewsasia.com': 80, 'todayonline.com': 75,
  // Indonesia
  'thejakartapost.com': 75, 'kompas.com': 72, 'detik.com': 70,
  // Thailand
  'bangkokpost.com': 75, 'nationthailand.com': 72,
  // Vietnam
  'vnexpress.net': 72, 'vietnamnews.vn': 70,
  // Philippines
  'inquirer.net': 75, 'philstar.com': 72, 'rappler.com': 74,
  // Malaysia
  'thestar.com.my': 75, 'nst.com.my': 72, 'malaymail.com': 70,
  
  // ==========================================================================
  // Tier 14: Regional News - Latin America (70-85)
  // ==========================================================================
  // Brazil
  'folha.uol.com.br': 82, 'globo.com': 85, 'estadao.com.br': 80,
  'uol.com.br': 82, 'terra.com.br': 75,
  // Mexico
  'eluniversal.com.mx': 78, 'milenio.com': 75, 'reforma.com': 76,
  // Argentina
  'lanacion.com.ar': 78, 'clarin.com': 80, 'infobae.com': 76,
  // Colombia
  'eltiempo.com': 76, 'elespectador.com': 74,
  // Chile
  'emol.com': 74, 'latercera.com': 72,
  
  // ==========================================================================
  // Tier 15: Regional News - Middle East/Africa (70-85)
  // ==========================================================================
  // Middle East
  'aljazeera.com': 88, 'arabnews.com': 78, 'gulfnews.com': 75,
  'thenationalnews.com': 76, 'middleeasteye.net': 74, 'haaretz.com': 80,
  'timesofisrael.com': 78, 'jpost.com': 76,
  // Africa
  'news24.com': 75, 'dailymaverick.co.za': 74, 'mg.co.za': 72,
  'nation.africa': 70, 'standardmedia.co.ke': 68, 'punch.ng': 68,
  
  // ==========================================================================
  // Tier 16: Developer Tools & SaaS (70-88)
  // ==========================================================================
  'datadog.com': 82, 'newrelic.com': 80, 'splunk.com': 82,
  'elastic.co': 80, 'mongodb.com': 82, 'redis.com': 78,
  'postgresql.org': 85, 'mysql.com': 82, 'mariadb.org': 75,
  'docker.com': 85, 'kubernetes.io': 88, 'terraform.io': 82,
  'ansible.com': 78, 'puppet.com': 75, 'chef.io': 72,
  'jenkins.io': 80, 'circleci.com': 78, 'travis-ci.com': 75,
  'sentry.io': 78, 'bugsnag.com': 72, 'rollbar.com': 70,
  'twilio.com': 82, 'sendgrid.com': 78, 'mailchimp.com': 80,
  'intercom.com': 78, 'zendesk.com': 82, 'freshdesk.com': 75,
  'hubspot.com': 85, 'marketo.com': 78, 'pardot.com': 75,
  'segment.com': 78, 'mixpanel.com': 76, 'amplitude.com': 76,
  'auth0.com': 80, 'okta.com': 82, 'onelogin.com': 75,
  'cloudflare.com': 88, 'fastly.com': 80, 'akamai.com': 85,
  
  // ==========================================================================
  // Tier 17: Crypto/Web3 (65-85)
  // ==========================================================================
  'coinbase.com': 85, 'binance.com': 82, 'kraken.com': 78,
  'coindesk.com': 80, 'cointelegraph.com': 78, 'decrypt.co': 72,
  'theblock.co': 75, 'messari.io': 72, 'defipulse.com': 68,
  'etherscan.io': 78, 'coingecko.com': 75, 'coinmarketcap.com': 80,
  'opensea.io': 78, 'rarible.com': 70, 'foundation.app': 68,
  
  // ==========================================================================
  // Tier 18: AI/ML Resources (70-90)
  // ==========================================================================
  'paperswithcode.com': 82, 'kaggle.com': 85, 'towardsdatascience.com': 78,
  'machinelearningmastery.com': 75, 'fast.ai': 80, 'deeplearning.ai': 82,
  'tensorflow.org': 88, 'pytorch.org': 88, 'keras.io': 80,
  'scikit-learn.org': 82, 'numpy.org': 80, 'pandas.pydata.org': 80,
};

// =============================================================================
// Heuristic Scoring
// =============================================================================

/**
 * TLD authority scores - some TLDs are inherently more trustworthy
 */
const TLD_SCORES: Record<string, number> = {
  // Government/Official (highest trust)
  'gov': 90, 'gov.uk': 90, 'gov.au': 88, 'gov.ca': 88, 'gov.in': 85,
  'gov.sg': 86, 'gov.nz': 85, 'gov.za': 82, 'gov.br': 82,
  'mil': 88, 'int': 85,
  // Education (high trust)
  'edu': 85, 'ac.uk': 85, 'edu.au': 83, 'edu.sg': 82, 'edu.in': 80,
  'ac.jp': 82, 'edu.cn': 78, 'edu.br': 78, 'edu.mx': 76,
  // Established TLDs
  'org': 55, 'net': 45, 'com': 40,
  // Country codes - Tier 1 (developed markets)
  'co.uk': 50, 'de': 48, 'fr': 48, 'jp': 48, 'au': 48, 'ca': 48,
  'nl': 47, 'se': 47, 'ch': 48, 'at': 46, 'be': 46, 'dk': 46,
  'no': 46, 'fi': 46, 'ie': 45, 'nz': 45, 'sg': 46, 'hk': 45,
  // Country codes - Tier 2 (emerging markets)
  'in': 42, 'br': 42, 'mx': 40, 'kr': 44, 'tw': 42, 'my': 40,
  'id': 38, 'th': 38, 'ph': 36, 'vn': 36, 'za': 40, 'ae': 42,
  'il': 44, 'pl': 42, 'cz': 40, 'hu': 38, 'ro': 36, 'tr': 38,
  // Country codes - Tier 3 (smaller markets)
  'ar': 38, 'cl': 38, 'co': 42, 'pe': 34, 'ec': 32, // 'co' is both Colombia and business TLD
  'ng': 32, 'ke': 32, 'eg': 34, 'pk': 32, 'bd': 30,
  // Tech TLDs (moderate trust - popular with startups)
  'io': 45, 'dev': 45, 'app': 44, 'tech': 42, 'ai': 45,
  'cloud': 42, 'software': 40, 'digital': 38, 'systems': 38,
  'solutions': 36, 'services': 36, 'tools': 38, 'codes': 36,
  // Business TLDs (note: 'co' is also Colombia country code, using higher value)
  'biz': 35, 'info': 35, 'pro': 38, 'company': 35,
  'business': 35, 'agency': 36, 'consulting': 35, 'partners': 35,
  // Media/Content TLDs
  'media': 38, 'news': 40, 'blog': 35, 'press': 38, 'tv': 40,
  'fm': 38, 'video': 35, 'photos': 32, 'gallery': 30,
  // E-commerce TLDs
  'shop': 32, 'store': 32, 'market': 32, 'buy': 30, 'sale': 28,
  'deals': 28, 'discount': 25, 'cheap': 22,
  // New gTLDs (lower trust by default)
  'xyz': 30, 'online': 30, 'site': 28, 'website': 28,
  'club': 30, 'space': 30, 'life': 28, 'world': 28,
  'today': 30, 'live': 32, 'rocks': 28, 'ninja': 25,
  // Suspicious TLDs (often used for spam)
  'top': 20, 'work': 22, 'click': 18, 'link': 20, 'win': 18,
  'download': 18, 'stream': 20, 'gdn': 15, 'men': 15, 'loan': 15,
};

/**
 * Known brand patterns that indicate established companies
 */
const BRAND_PATTERNS = [
  // Tech companies often have short, memorable names
  /^[a-z]{3,6}$/, // 3-6 letter names like "uber", "lyft", "slack"
  // Compound words without hyphens
  /^[a-z]+[A-Z][a-z]+$/, // camelCase like "airBnb" (normalized)
];

/**
 * Common English words that make good domain names (indicates established brand)
 */
const DICTIONARY_WORDS = new Set([
  // Common tech/business words
  'cloud', 'data', 'code', 'tech', 'labs', 'works', 'hub', 'base', 'flow',
  'stack', 'sync', 'link', 'node', 'grid', 'core', 'edge', 'wave', 'spark',
  'beam', 'bolt', 'dash', 'dock', 'gate', 'helm', 'hive', 'loop', 'mesh',
  'nest', 'path', 'peak', 'port', 'pulse', 'root', 'seed', 'shift', 'snap',
  'spot', 'swift', 'track', 'vault', 'view', 'wire', 'zoom',
  // Business words
  'market', 'trade', 'sales', 'leads', 'deals', 'growth', 'scale', 'boost',
  'reach', 'engage', 'convert', 'retain', 'acquire', 'launch', 'build',
  // General words
  'blue', 'green', 'red', 'black', 'white', 'gold', 'silver', 'bright',
  'clear', 'fast', 'quick', 'smart', 'simple', 'easy', 'open', 'free',
]);

/**
 * Subdomain patterns that indicate official/authoritative subdomains
 */
const AUTHORITATIVE_SUBDOMAINS = new Set([
  'www', 'blog', 'docs', 'api', 'dev', 'developer', 'developers',
  'help', 'support', 'status', 'news', 'press', 'media', 'ir',
  'careers', 'jobs', 'about', 'legal', 'privacy', 'security',
  'enterprise', 'business', 'pro', 'premium', 'app', 'mobile',
  'cloud', 'platform', 'console', 'dashboard', 'admin', 'portal',
]);

/**
 * Calculate domain authority using improved heuristics when API is unavailable.
 * 
 * Scoring factors:
 * 1. Known domain database (highest priority)
 * 2. Subdomain of known domain (with smart inheritance)
 * 3. TLD authority
 * 4. Domain name characteristics (length, patterns, dictionary words)
 * 5. Negative signals (numbers, hyphens, suspicious patterns)
 * 6. Domain structure analysis
 */
export function calculateHeuristicScore(domain: string): number {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
  
  // Check known domains first (highest priority)
  if (KNOWN_DOMAIN_SCORES[normalizedDomain]) {
    return KNOWN_DOMAIN_SCORES[normalizedDomain];
  }
  
  // Check if it's a subdomain of a known domain
  for (const [knownDomain, score] of Object.entries(KNOWN_DOMAIN_SCORES)) {
    if (normalizedDomain.endsWith(`.${knownDomain}`)) {
      // Extract subdomain
      const subdomain = normalizedDomain.slice(0, -(knownDomain.length + 1));
      
      // Authoritative subdomains get less penalty
      if (AUTHORITATIVE_SUBDOMAINS.has(subdomain)) {
        return Math.max(score - 5, 60);
      }
      
      // User-generated subdomains (like username.github.io) get more penalty
      if (subdomain.length > 15 || /\d/.test(subdomain)) {
        return Math.max(score - 20, 40);
      }
      
      // Standard subdomains
      return Math.max(score - 10, 50);
    }
  }
  
  // Parse domain parts
  const parts = normalizedDomain.split('.');
  const domainName = parts[0];
  const tld = parts.slice(1).join('.');
  
  // Start with TLD-based score
  let score = TLD_SCORES[tld] || TLD_SCORES[parts[parts.length - 1]] || 35;
  
  // ==========================================================================
  // Positive signals
  // ==========================================================================
  
  // Short domain names are often more established (acquired early)
  if (domainName.length <= 3) {
    score += 20; // Very short = likely established (rare, valuable)
  } else if (domainName.length <= 5) {
    score += 15;
  } else if (domainName.length <= 7) {
    score += 10;
  } else if (domainName.length <= 10) {
    score += 5;
  }
  
  // Single dictionary word domains are valuable
  if (/^[a-z]+$/.test(domainName)) {
    if (DICTIONARY_WORDS.has(domainName)) {
      score += 15; // Known dictionary word = high value
    } else if (domainName.length >= 4 && domainName.length <= 10) {
      score += 8; // Likely a word
    }
  }
  
  // Check for brand-like patterns
  for (const pattern of BRAND_PATTERNS) {
    if (pattern.test(domainName)) {
      score += 5;
      break;
    }
  }
  
  // Compound words without hyphens (like "mailchimp", "hubspot")
  if (/^[a-z]{6,12}$/.test(domainName) && !DICTIONARY_WORDS.has(domainName)) {
    // Check if it could be two words combined
    const vowelCount = (domainName.match(/[aeiou]/g) || []).length;
    const consonantCount = domainName.length - vowelCount;
    // Good ratio of vowels to consonants suggests real word(s)
    if (vowelCount >= 2 && consonantCount >= 3 && vowelCount / domainName.length > 0.25) {
      score += 5;
    }
  }
  
  // Premium TLD combinations
  if (tld === 'com' && domainName.length <= 6 && /^[a-z]+$/.test(domainName)) {
    score += 10; // Short .com domains are premium
  }
  
  // ==========================================================================
  // Negative signals
  // ==========================================================================
  
  // Numbers in domain name (often spam or low-quality)
  if (/\d/.test(domainName)) {
    // Exception: year-like numbers at end (company2024) are less suspicious
    if (/\d{4}$/.test(domainName) && domainName.length > 6) {
      score -= 5;
    } else {
      score -= 15;
      // Multiple numbers are worse
      if ((domainName.match(/\d/g) || []).length > 2) {
        score -= 10;
      }
    }
  }
  
  // Hyphens in domain name (often keyword-stuffed)
  if (domainName.includes('-')) {
    const hyphenCount = (domainName.match(/-/g) || []).length;
    if (hyphenCount === 1 && domainName.length <= 15) {
      score -= 5; // Single hyphen in reasonable length is okay
    } else {
      score -= 10;
      if (hyphenCount > 2) {
        score -= 15; // Multiple hyphens = likely spam
      }
    }
  }
  
  // Very long domain names (often spam)
  if (domainName.length > 25) {
    score -= 20;
  } else if (domainName.length > 20) {
    score -= 15;
  } else if (domainName.length > 15) {
    score -= 8;
  }
  
  // Suspicious keyword-stuffed patterns
  const suspiciousStarts = /^(best|top|free|cheap|buy|get|my|the|your|our|1st|first|real|true|official|legit)/;
  const suspiciousEnds = /(online|web|site|blog|news|info|hub|zone|world|guru|ninja|expert|pro|hq|central|direct|now|today|24|365)$/;
  
  if (suspiciousStarts.test(domainName)) {
    score -= 12;
  }
  if (suspiciousEnds.test(domainName)) {
    score -= 8;
  }
  
  // Random-looking strings (likely spam or auto-generated)
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/.test(domainName)) {
    score -= 15; // 5+ consonants in a row
  }
  if (/[aeiou]{4,}/.test(domainName)) {
    score -= 10; // 4+ vowels in a row (unusual)
  }
  
  // Repeated characters (spam indicator)
  if (/(.)\1{2,}/.test(domainName)) {
    score -= 10; // 3+ repeated characters
  }
  
  // All caps-looking (alternating pattern often used in spam)
  if (/^[a-z]([A-Z][a-z])+$/.test(domain.replace(/^www\./, ''))) {
    score -= 5;
  }
  
  // Clamp score to valid range
  return Math.max(10, Math.min(100, score));
}

// =============================================================================
// API Integration
// =============================================================================

/**
 * Fetch domain authority from Open PageRank API.
 * Free tier: 10 requests/second, no API key required.
 * With API key: Higher rate limits.
 */
async function fetchFromOpenPageRank(
  domains: string[],
  config: DomainAuthorityConfig
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const { apiKey, timeoutMs = 5000 } = config;
  
  // Open PageRank API endpoint
  const url = 'https://openpagerank.com/api/v1.0/getPageRank';
  
  // Build query string with domains
  const params = new URLSearchParams();
  domains.forEach((domain, i) => {
    params.append(`domains[${i}]`, domain.replace(/^www\./, ''));
  });
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(apiKey && { 'API-OPR': apiKey })
      },
      signal: controller.signal
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data: OpenPageRankResponse = await response.json();
    
    if (data.status_code === 200 && data.response) {
      for (const item of data.response) {
        if (item.status_code === 200 && item.page_rank_decimal !== undefined) {
          // Convert PageRank (0-10) to our scale (0-100)
          const score = Math.round(item.page_rank_decimal * 10);
          results.set(item.domain.toLowerCase(), score);
        }
      }
    }
  } catch (error) {
    console.warn('[DomainAuthority] API fetch failed:', error);
  } finally {
    clearTimeout(timeoutId);
  }
  
  return results;
}

// =============================================================================
// Domain Authority Service
// =============================================================================

export interface DomainAuthorityService {
  /** Get authority score for a single domain */
  getScore(domain: string): Promise<DomainAuthorityResult>;
  /** Get authority scores for multiple domains (batched) */
  getBatchScores(domains: string[]): Promise<Map<string, DomainAuthorityResult>>;
  /** Clear the cache */
  clearCache(): void;
  /** Get cache statistics */
  getCacheStats(): { hits: number; misses: number; size: number };
}

export function createDomainAuthorityService(
  config: DomainAuthorityConfig = {}
): DomainAuthorityService {
  const {
    cacheTtlSeconds = 86400, // 24 hours
    useFallback = true
  } = config;
  
  // In-memory cache with TTL
  const cache = new Map<string, { result: DomainAuthorityResult; expiresAt: number }>();
  let cacheHits = 0;
  let cacheMisses = 0;
  
  function getCached(domain: string): DomainAuthorityResult | null {
    const entry = cache.get(domain.toLowerCase());
    if (entry && Date.now() < entry.expiresAt) {
      cacheHits++;
      return entry.result;
    }
    cacheMisses++;
    return null;
  }
  
  function setCache(domain: string, result: DomainAuthorityResult): void {
    cache.set(domain.toLowerCase(), {
      result,
      expiresAt: Date.now() + cacheTtlSeconds * 1000
    });
  }
  
  return {
    async getScore(domain: string): Promise<DomainAuthorityResult> {
      const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
      
      // Check cache first
      const cached = getCached(normalizedDomain);
      if (cached) {
        return { ...cached, source: 'cache' };
      }
      
      // Try API
      const apiResults = await fetchFromOpenPageRank([normalizedDomain], config);
      
      if (apiResults.has(normalizedDomain)) {
        const result: DomainAuthorityResult = {
          domain: normalizedDomain,
          score: apiResults.get(normalizedDomain)!,
          source: 'api',
          confidence: 0.9,
          fetchedAt: new Date()
        };
        setCache(normalizedDomain, result);
        return result;
      }
      
      // Fallback to heuristic
      if (useFallback) {
        const result: DomainAuthorityResult = {
          domain: normalizedDomain,
          score: calculateHeuristicScore(normalizedDomain),
          source: 'heuristic',
          confidence: 0.5
        };
        setCache(normalizedDomain, result);
        return result;
      }
      
      // No score available
      return {
        domain: normalizedDomain,
        score: 30,
        source: 'heuristic',
        confidence: 0.1
      };
    },
    
    async getBatchScores(domains: string[]): Promise<Map<string, DomainAuthorityResult>> {
      const results = new Map<string, DomainAuthorityResult>();
      const uncachedDomains: string[] = [];
      
      // Check cache for each domain
      for (const domain of domains) {
        const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
        const cached = getCached(normalizedDomain);
        
        if (cached) {
          results.set(normalizedDomain, { ...cached, source: 'cache' });
        } else {
          uncachedDomains.push(normalizedDomain);
        }
      }
      
      // Batch fetch uncached domains (max 100 per request for API limits)
      if (uncachedDomains.length > 0) {
        const batchSize = 100;
        
        for (let i = 0; i < uncachedDomains.length; i += batchSize) {
          const batch = uncachedDomains.slice(i, i + batchSize);
          const apiResults = await fetchFromOpenPageRank(batch, config);
          
          for (const domain of batch) {
            if (apiResults.has(domain)) {
              const result: DomainAuthorityResult = {
                domain,
                score: apiResults.get(domain)!,
                source: 'api',
                confidence: 0.9,
                fetchedAt: new Date()
              };
              setCache(domain, result);
              results.set(domain, result);
            } else if (useFallback) {
              const result: DomainAuthorityResult = {
                domain,
                score: calculateHeuristicScore(domain),
                source: 'heuristic',
                confidence: 0.5
              };
              setCache(domain, result);
              results.set(domain, result);
            }
          }
          
          // Rate limiting: wait 100ms between batches
          if (i + batchSize < uncachedDomains.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
      
      return results;
    },
    
    clearCache(): void {
      cache.clear();
      cacheHits = 0;
      cacheMisses = 0;
    },
    
    getCacheStats(): { hits: number; misses: number; size: number } {
      return {
        hits: cacheHits,
        misses: cacheMisses,
        size: cache.size
      };
    }
  };
}

// =============================================================================
// Convenience Export
// =============================================================================

let defaultService: DomainAuthorityService | null = null;

/**
 * Get domain authority score using the default service.
 * Creates a singleton service instance on first call.
 */
export async function getDomainAuthority(domain: string): Promise<number> {
  if (!defaultService) {
    defaultService = createDomainAuthorityService();
  }
  const result = await defaultService.getScore(domain);
  return result.score;
}

/**
 * Get domain authority scores for multiple domains.
 */
export async function getBatchDomainAuthority(domains: string[]): Promise<Map<string, number>> {
  if (!defaultService) {
    defaultService = createDomainAuthorityService();
  }
  const results = await defaultService.getBatchScores(domains);
  const scores = new Map<string, number>();
  results.forEach((result, domain) => scores.set(domain, result.score));
  return scores;
}
