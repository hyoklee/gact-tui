import { createContext } from 'react';

/** Native questions and legacy interactive responses share the same viewport placement. */
export const ResponseViewportContext = createContext<'inline' | 'fullscreen'>('inline');
