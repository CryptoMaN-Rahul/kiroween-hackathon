/**
 * Content Transformer
 * 
 * Transforms content into AI-preferred formats (listicles, comparisons, Top N).
 * Production-grade implementation with real content extraction.
 * 
 * @module content-transformer
 */

export type TransformFormat = 'roundup' | 'comparison' | 'topN' | 'faq';

export interface TransformationResult {
  original: string;
  transformed: string;
  format: TransformFormat;
  confidence: number;
  itemsExtracted: number;
}

export interface ListicleSuitability {
  suitable: boolean;
  format: TransformFormat | null;
  confidence: number;
  reasons: string[];
}

export interface ExtractedItem {
  title: string;
  description: string;
  attributes: Record<string, string>;
}

function extractItems(content: string): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  
  // Split content into lines for easier processing
  const lines = content.split('\n');
  
  // Process each line looking for numbered or bullet items
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Check for numbered list item: "1. Item title" or "1. Item title - description"
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      let title = numberedMatch[2].trim();
      let description = '';
      
      // Remove markdown bold markers
      title = title.replace(/\*\*/g, '');
      
      // Check if title contains a separator (: or - or –)
      const sepMatch = title.match(/^(.+?)\s*[-–:]\s+(.+)$/);
      if (sepMatch) {
        title = sepMatch[1].trim();
        description = sepMatch[2].trim();
      }
      
      if (title.length > 0) {
        items.push({ title, description, attributes: {} });
      }
      continue;
    }
    
    // Check for bullet list item: "- Item title" or "* Item title"
    const bulletMatch = trimmedLine.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      let title = bulletMatch[1].trim();
      let description = '';
      
      // Remove markdown bold markers
      title = title.replace(/\*\*/g, '');
      
      // Check if title contains a separator
      const sepMatch = title.match(/^(.+?)\s*[-–:]\s+(.+)$/);
      if (sepMatch) {
        title = sepMatch[1].trim();
        description = sepMatch[2].trim();
      }
      
      if (title.length > 0) {
        items.push({ title, description, attributes: {} });
      }
    }
  }
  
  if (items.length >= 2) return items;
  
  // Headers followed by content
  const headerPattern = /^#{2,3}\s+(.+)$\n+([\s\S]*?)(?=^#{2,3}\s|\n\n\n|$)/gm;
  let match;
  while ((match = headerPattern.exec(content)) !== null) {
    const title = match[1].trim();
    const body = match[2].trim();
    const attributes: Record<string, string> = {};
    const attrPattern = /\*?\*?([A-Za-z]+)\*?\*?\s*[:]\s*([^\n]+)/g;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(body)) !== null) {
      attributes[attrMatch[1].toLowerCase()] = attrMatch[2].trim();
    }
    items.push({ title, description: body.split('\n')[0] || '', attributes });
  }
  if (items.length >= 2) return items;
  
  // Paragraphs
  const paragraphs = content.split(/\n\n+/).filter(p => {
    const trimmed = p.trim();
    return trimmed.length > 30 && !trimmed.startsWith('#') && !trimmed.startsWith('|');
  });
  for (const para of paragraphs.slice(0, 10)) {
    const firstSentence = para.match(/^[^.!?]+[.!?]/)?.[0] || para.substring(0, 100);
    items.push({
      title: firstSentence.trim(),
      description: para.length > firstSentence.length ? para.substring(firstSentence.length).trim() : '',
      attributes: {}
    });
  }
  return items;
}

function extractComparisonData(content: string) {
  const data = { items: [] as string[], attributes: [] as string[], values: {} as Record<string, Record<string, string>> };
  
  // Check for existing table
  const tableMatch = content.match(/\|(.+)\|\n\|[-:\s|]+\|\n([\s\S]*?)(?=\n\n|\n[^|]|$)/);
  if (tableMatch) {
    const headers = tableMatch[1].split('|').map(h => h.trim()).filter(Boolean);
    const rows = tableMatch[2].split('\n').filter(r => r.includes('|'));
    if (headers.length > 1) {
      data.attributes = [headers[0]];
      data.items = headers.slice(1);
      for (const row of rows) {
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
          const attr = cells[0];
          if (!data.attributes.includes(attr)) data.attributes.push(attr);
          for (let i = 1; i < cells.length && i <= data.items.length; i++) {
            const item = data.items[i - 1];
            if (!data.values[item]) data.values[item] = {};
            data.values[item][attr] = cells[i];
          }
        }
      }
      return data;
    }
  }
  
  // Extract from vs patterns
  const vsPattern = /\b([A-Z][a-zA-Z0-9\s]+?)\s+(?:vs\.?|versus|compared to)\s+([A-Z][a-zA-Z0-9\s]+?)(?:\s|$|[,.])/gi;
  let match;
  while ((match = vsPattern.exec(content)) !== null) {
    if (!data.items.includes(match[1].trim())) data.items.push(match[1].trim());
    if (!data.items.includes(match[2].trim())) data.items.push(match[2].trim());
  }
  
  if (data.items.length < 2) {
    data.items = extractItems(content).slice(0, 5).map(i => i.title);
  }
  
  const commonAttrs = ['price', 'cost', 'rating', 'quality', 'features', 'performance'];
  const contentLower = content.toLowerCase();
  for (const attr of commonAttrs) {
    if (contentLower.includes(attr)) {
      data.attributes.push(attr.charAt(0).toUpperCase() + attr.slice(1));
    }
  }
  if (data.attributes.length === 0) data.attributes = ['Feature', 'Rating', 'Notes'];
  
  for (const item of data.items) {
    data.values[item] = {};
    for (const attr of data.attributes) {
      const pattern = new RegExp(`${item}[^.]*?${attr.toLowerCase()}[:\\s]+([^,.\\n]+)`, 'i');
      const valueMatch = content.match(pattern);
      data.values[item][attr] = valueMatch ? valueMatch[1].trim() : '—';
    }
  }
  return data;
}

function extractFAQPairs(content: string): Array<{ question: string; answer: string }> {
  const pairs: Array<{ question: string; answer: string }> = [];
  
  const qaPattern = /(?:Q:|Question:)\s*(.+?)\s*(?:A:|Answer:)\s*([\s\S]+?)(?=(?:Q:|Question:)|$)/gi;
  let match;
  while ((match = qaPattern.exec(content)) !== null) {
    pairs.push({ question: match[1].trim(), answer: match[2].trim() });
  }
  if (pairs.length > 0) return pairs;
  
  const questionPattern = /([^.!?\n]+\?)\s*\n+([^?]+?)(?=\n\n|[^.!?\n]+\?|$)/g;
  while ((match = questionPattern.exec(content)) !== null) {
    if (match[2].trim().length > 20) {
      pairs.push({ question: match[1].trim(), answer: match[2].trim() });
    }
  }
  return pairs;
}

export function detectListicleSuitability(content: string): ListicleSuitability {
  const reasons: string[] = [];
  let comparisonScore = 0, listScore = 0, faqScore = 0;
  
  const vsMatches = content.match(/\bvs\.?\b|\bversus\b/gi) || [];
  if (vsMatches.length > 0) { comparisonScore += 0.3 * Math.min(vsMatches.length, 3); reasons.push(`${vsMatches.length} comparison phrases`); }
  
  const bulletMatches = content.match(/^\s*[-*•]\s+.+$/gm) || [];
  const numberedMatches = content.match(/^\s*\d+\.\s+.+$/gm) || [];
  if (bulletMatches.length >= 3) { listScore += 0.4; reasons.push(`${bulletMatches.length} bullet points`); }
  if (numberedMatches.length >= 3) { listScore += 0.4; reasons.push(`${numberedMatches.length} numbered items`); }
  if (content.match(/\btop\s+\d+\b|\bbest\s+\d+\b/gi)) { listScore += 0.2; reasons.push('Top N pattern'); }
  
  const questionMarks = (content.match(/\?/g) || []).length;
  if (questionMarks >= 3) { faqScore += 0.3 + Math.min(questionMarks / 20, 0.3); reasons.push(`${questionMarks} questions`); }
  if (content.match(/(?:Q:|Question:|FAQ)/gi)) { faqScore += 0.3; reasons.push('FAQ formatting'); }
  
  const maxScore = Math.max(comparisonScore, listScore, faqScore);
  let format: TransformFormat | null = null;
  
  if (maxScore >= 0.3) {
    if (comparisonScore === maxScore) format = 'comparison';
    else if (listScore === maxScore) format = content.match(/\btop\s+\d+\b|\bbest\s+\d+\b/gi) ? 'topN' : 'roundup';
    else format = 'faq';
  }
  
  return { suitable: maxScore >= 0.5, format, confidence: Math.round(Math.min(1, maxScore) * 100) / 100, reasons };
}

export function transformToRoundup(content: string): TransformationResult {
  const items = extractItems(content);
  if (items.length === 0) return { original: content, transformed: content, format: 'roundup', confidence: 0, itemsExtracted: 0 };
  
  let transformed = `## Roundup: ${items.length} Key Points\n\n`;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    transformed += `### ${i + 1}. ${item.title.substring(0, 60)}${item.title.length > 60 ? '...' : ''}\n\n`;
    if (item.description) transformed += `${item.description}\n\n`;
    for (const [key, value] of Object.entries(item.attributes)) {
      transformed += `- **${key.charAt(0).toUpperCase() + key.slice(1)}**: ${value}\n`;
    }
    if (Object.keys(item.attributes).length > 0) transformed += '\n';
  }
  return { original: content, transformed: transformed.trim(), format: 'roundup', confidence: Math.min(1, items.length / 5), itemsExtracted: items.length };
}

export function generateComparisonTable(content: string): string {
  const data = extractComparisonData(content);
  if (data.items.length < 2) return content;
  
  const headers = ['Feature', ...data.items.slice(0, 5)];
  let table = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n`;
  for (const attr of data.attributes) {
    const row = [attr, ...data.items.slice(0, 5).map(item => data.values[item]?.[attr] || '—')];
    table += `| ${row.join(' | ')} |\n`;
  }
  return table;
}

export function createTopNList(content: string, n: number): string {
  const items = extractItems(content).slice(0, n);
  if (items.length === 0) return content;
  
  let result = `## Top ${items.length} Picks\n\n`;
  for (let i = 0; i < items.length; i++) {
    result += `### ${i + 1}. ${items[i].title}\n\n`;
    if (items[i].description) result += `${items[i].description}\n\n`;
  }
  return result.trim();
}

export function transformToFAQ(content: string): TransformationResult {
  const pairs = extractFAQPairs(content);
  if (pairs.length === 0) return { original: content, transformed: content, format: 'faq', confidence: 0, itemsExtracted: 0 };
  
  let transformed = `## Frequently Asked Questions\n\n`;
  for (const { question, answer } of pairs) {
    transformed += `### ${question}\n\n${answer}\n\n`;
  }
  return { original: content, transformed: transformed.trim(), format: 'faq', confidence: Math.min(1, pairs.length / 5), itemsExtracted: pairs.length };
}

export function createContentTransformer() {
  return {
    detectSuitability: detectListicleSuitability,
    toRoundup: transformToRoundup,
    toComparisonTable: generateComparisonTable,
    toTopN: createTopNList,
    toFAQ: transformToFAQ,
    transform(content: string, format?: TransformFormat): TransformationResult {
      const suitability = detectListicleSuitability(content);
      const targetFormat = format || suitability.format || 'roundup';
      switch (targetFormat) {
        case 'roundup': return transformToRoundup(content);
        case 'comparison': return { original: content, transformed: generateComparisonTable(content), format: 'comparison', confidence: suitability.confidence, itemsExtracted: extractComparisonData(content).items.length };
        case 'topN': return { original: content, transformed: createTopNList(content, 5), format: 'topN', confidence: suitability.confidence, itemsExtracted: Math.min(5, extractItems(content).length) };
        case 'faq': return transformToFAQ(content);
        default: return transformToRoundup(content);
      }
    }
  };
}
