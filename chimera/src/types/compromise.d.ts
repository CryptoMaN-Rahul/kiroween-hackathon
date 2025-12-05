/**
 * Type declarations for the 'compromise' NLP library
 */
declare module 'compromise' {
  interface Document {
    /** Get people names */
    people(): Document;
    /** Get places */
    places(): Document;
    /** Get organizations */
    organizations(): Document;
    /** Get nouns */
    nouns(): Document;
    /** Get verbs */
    verbs(): Document;
    /** Get adjectives */
    adjectives(): Document;
    /** Get the text as an array */
    out(format: 'array'): string[];
    /** Get the text as a string */
    out(format?: 'text'): string;
    /** Get JSON representation */
    json(): Array<{ text: string; terms: Array<{ text: string; tags: string[] }> }>;
    /** Match a pattern */
    match(pattern: string): Document;
    /** Check if document has content */
    found: boolean;
    /** Get length */
    length: number;
  }

  function nlp(text: string): Document;
  export = nlp;
}
